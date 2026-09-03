-- Phase 7.4-7.5: LINE Messaging API backend — webhook ingestion, #งาน task
-- creation, group approval/binding, reminder scheduler + push queue.
--
-- No file/#เก็บ/Drive/Storage/deployment here (out of scope).
--
-- Design notes:
-- * webhook_events UNIQUE(line_webhook_event_id) is the single dedupe gate for
--   both "don't double-process an event" and "don't create a duplicate task".
-- * #งาน handling is done INLINE in the line-webhook Edge Function, not via
--   processing_jobs: LINE reply tokens are single-use and expire in seconds, so
--   a cron-drained queue cannot reply. The parse is a regex + two queries.
--   processing_jobs is used for send_reminder, which is genuinely async.
-- * processing_jobs.status keeps its existing vocabulary
--   (queued/running/succeeded/failed); the phase text's pending/processing/
--   done/failed maps 1:1 onto those.
-- * Backend-only functions are granted to service_role only. Only the three
--   Settings RPCs (status / approve / unbind) are granted to authenticated.
-- * Raw LINE userId/groupId is never returned by any authenticated-callable
--   function (same constraint as family_member_list).


-- =========================================================================
-- 1. Extensions
-- =========================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;


-- =========================================================================
-- 2. line_conversations: approval/binding metadata
-- =========================================================================
alter table public.line_conversations
  add column if not exists display_label text,
  add column if not exists approved_by_profile_id uuid
    references public.profiles (id) on delete set null,
  add column if not exists approved_at timestamptz;

-- An approved GROUP mapping must be bound to a workspace.
alter table public.line_conversations
  drop constraint if exists line_conversations_approved_group_bound_ck;
alter table public.line_conversations
  add constraint line_conversations_approved_group_bound_ck
  check (
    line_source_type <> 'group'
    or approved = false
    or workspace_id is not null
  );

-- At most one approved group per family workspace ("one group -> one workspace",
-- and the reminder delivery rule's "exactly one group" stays well-defined).
drop index if exists public.line_conversations_one_approved_group_per_ws;
create unique index line_conversations_one_approved_group_per_ws
  on public.line_conversations (workspace_id)
  where line_source_type = 'group' and approved = true;


-- =========================================================================
-- 3. Table privileges: browser stays fully closed on all three backend tables
-- =========================================================================
revoke all on public.line_conversations from public;
revoke all on public.line_conversations from anon;
revoke all on public.line_conversations from authenticated;

revoke all on public.webhook_events from public;
revoke all on public.webhook_events from anon;
revoke all on public.webhook_events from authenticated;

revoke all on public.processing_jobs from public;
revoke all on public.processing_jobs from anon;
revoke all on public.processing_jobs from authenticated;
-- RLS already enabled on all three (migration 1); no policies => deny-all for
-- anon/authenticated. service_role bypasses RLS for the Edge Functions.


-- =========================================================================
-- 4. Backend helpers (service_role only)
-- =========================================================================

-- Record a webhook event; TRUE if newly inserted, FALSE if it was a duplicate
-- delivery (the UNIQUE on line_webhook_event_id is the dedupe gate).
create or replace function public.record_webhook_event(
  p_event_id text,
  p_source_type text,
  p_source_id text,
  p_event_type text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer := 0;
begin
  insert into public.webhook_events (
    line_webhook_event_id, source_type, source_id, event_type, raw_payload
  )
  values (
    p_event_id, p_source_type, p_source_id, p_event_type, coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (line_webhook_event_id) do nothing;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create or replace function public.mark_webhook_event_processed(
  p_event_id text,
  p_status text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.webhook_events
  set processing_status = case when p_status in ('done', 'error') then p_status else 'done' end,
      processed_at = now()
  where line_webhook_event_id = p_event_id;
$$;

-- 1:1 registration: resolve a LINE userId to a FamKeep profile and upsert an
-- approved user conversation. Returns the profile id, or a blocked_reason.
create or replace function public.register_line_user_conversation(
  p_line_user_id text
)
returns table (profile_id uuid, blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line text := nullif(btrim(p_line_user_id), '');
  v_profile uuid;
  v_conv uuid;
begin
  if v_line is null then
    return query select null::uuid, 'invalid_line_user_id'::text; return;
  end if;

  select p.id into v_profile
  from public.profiles p
  where p.line_user_id = v_line;

  if v_profile is null then
    -- still record the raw conversation so we can debug / onboard later
    insert into public.line_conversations (line_source_type, line_source_id, approved)
    values ('user', v_line, false)
    on conflict (line_source_type, line_source_id) do nothing;
    return query select null::uuid, 'user_not_linked'::text; return;
  end if;

  insert into public.line_conversations (line_source_type, line_source_id, profile_id, approved)
  values ('user', v_line, v_profile, true)
  on conflict (line_source_type, line_source_id)
    do update set profile_id = excluded.profile_id, approved = true
  returning id into v_conv;

  return query select v_profile, null::text;
end;
$$;

-- Group: create/refresh a PENDING (unapproved) mapping. Never downgrades an
-- already-approved binding.
create or replace function public.upsert_pending_line_group(
  p_group_id text,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group text := nullif(btrim(p_group_id), '');
begin
  if v_group is null then
    return;
  end if;

  insert into public.line_conversations (line_source_type, line_source_id, display_label, approved)
  values ('group', v_group, nullif(btrim(p_label), ''), false)
  on conflict (line_source_type, line_source_id) do update
    set display_label = coalesce(nullif(btrim(excluded.display_label), ''), public.line_conversations.display_label);
end;
$$;

-- Webhook source resolution for a GROUP: returns the bound workspace + approval.
create or replace function public.resolve_line_group(
  p_group_id text
)
returns table (workspace_id uuid, approved boolean)
language sql
security definer
set search_path = ''
as $$
  select lc.workspace_id, lc.approved
  from public.line_conversations lc
  where lc.line_source_type = 'group'
    and lc.line_source_id = nullif(btrim(p_group_id), '');
$$;

-- Webhook source resolution for a 1:1 USER: returns the mapped profile (only if
-- approved) and their private workspace.
create or replace function public.resolve_line_user(
  p_line_user_id text
)
returns table (profile_id uuid, private_workspace_id uuid, approved boolean)
language sql
security definer
set search_path = ''
as $$
  select
    lc.profile_id,
    (select w.id from public.workspaces w
       where w.type = 'private' and w.owner_profile_id = lc.profile_id),
    lc.approved
  from public.line_conversations lc
  where lc.line_source_type = 'user'
    and lc.line_source_id = nullif(btrim(p_line_user_id), '');
$$;

-- Task creation from LINE. Actor is explicit (no auth.uid()); mirrors
-- public.create_task's authorization + assignee rules. No reminders from LINE
-- in this phase (the #งาน grammar has none). created_via = 'line'.
create or replace function public.create_task_from_line(
  p_actor_profile_id uuid,
  p_workspace_id uuid,
  p_title text,
  p_notes text,
  p_assignee_profile_id uuid,
  p_due_at timestamptz
)
returns table (task_id uuid, blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_ws_type public.workspace_type;
  v_task_id uuid;
begin
  if p_actor_profile_id is null then
    return query select null::uuid, 'actor_unknown'::text; return;
  end if;
  if not public.can_access_workspace(p_workspace_id, p_actor_profile_id) then
    return query select null::uuid, 'no_workspace_access'::text; return;
  end if;

  select w.type into v_ws_type from public.workspaces w where w.id = p_workspace_id;

  v_title := btrim(coalesce(p_title, ''));
  if v_title = '' or char_length(v_title) > 200 then
    return query select null::uuid, 'invalid_title'::text; return;
  end if;
  if p_due_at is null then
    return query select null::uuid, 'invalid_due_at'::text; return;
  end if;

  if v_ws_type = 'private' then
    if p_assignee_profile_id is not null then
      return query select null::uuid, 'private_assignee_not_allowed'::text; return;
    end if;
  elsif p_assignee_profile_id is not null
    and not exists (
      select 1 from public.workspace_members m
      where m.workspace_id = p_workspace_id and m.profile_id = p_assignee_profile_id
    )
  then
    return query select null::uuid, 'assignee_not_family_member'::text; return;
  end if;

  insert into public.tasks (
    workspace_id, title, notes, assignee_profile_id, due_at,
    lifecycle_status, created_by_profile_id, created_via
  )
  values (
    p_workspace_id, v_title, coalesce(p_notes, ''),
    case when v_ws_type = 'family' then p_assignee_profile_id else null end,
    p_due_at, 'open'::public.task_lifecycle_status, p_actor_profile_id, 'line'
  )
  returning id into v_task_id;

  return query select v_task_id, null::text;
exception
  when insufficient_privilege then
    return query select null::uuid, 'permission_denied'::text;
end;
$$;

-- Resolve a family member by display name within a workspace (case-insensitive,
-- exact match then unique prefix). NULL if zero or ambiguous. Used by the #งาน
-- parser's "ผู้รับผิดชอบ: <name>".
create or replace function public.resolve_family_member_by_name(
  p_workspace_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := lower(btrim(coalesce(p_name, '')));
  v_id uuid;
  v_ids uuid[];
begin
  if v_name = '' then
    return null;
  end if;

  select p.id into v_id
  from public.workspace_members m
  join public.profiles p on p.id = m.profile_id
  where m.workspace_id = p_workspace_id
    and lower(btrim(coalesce(p.display_name, ''))) = v_name
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select array_agg(p.id) into v_ids
  from public.workspace_members m
  join public.profiles p on p.id = m.profile_id
  where m.workspace_id = p_workspace_id
    and lower(btrim(coalesce(p.display_name, ''))) like v_name || '%';

  if array_length(v_ids, 1) = 1 then
    return v_ids[1];
  end if;
  return null;
end;
$$;

revoke execute on function public.record_webhook_event(text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.mark_webhook_event_processed(text, text) from public, anon, authenticated;
revoke execute on function public.register_line_user_conversation(text) from public, anon, authenticated;
revoke execute on function public.upsert_pending_line_group(text, text) from public, anon, authenticated;
revoke execute on function public.resolve_line_group(text) from public, anon, authenticated;
revoke execute on function public.resolve_line_user(text) from public, anon, authenticated;
revoke execute on function public.resolve_family_member_by_name(uuid, text) from public, anon, authenticated;
revoke execute on function public.create_task_from_line(uuid, uuid, text, text, uuid, timestamptz) from public, anon, authenticated;

grant execute on function public.record_webhook_event(text, text, text, text, jsonb) to service_role;
grant execute on function public.mark_webhook_event_processed(text, text) to service_role;
grant execute on function public.register_line_user_conversation(text) to service_role;
grant execute on function public.upsert_pending_line_group(text, text) to service_role;
grant execute on function public.resolve_line_group(text) to service_role;
grant execute on function public.resolve_line_user(text) to service_role;
grant execute on function public.resolve_family_member_by_name(uuid, text) to service_role;
grant execute on function public.create_task_from_line(uuid, uuid, text, text, uuid, timestamptz) to service_role;


-- =========================================================================
-- 5. Reminder scheduler + job queue (service_role, except enqueue = cron)
-- =========================================================================

-- Find pending reminders that are due (task still open, not deleted) and
-- enqueue exactly one send_reminder job each. dedupe_key = reminder id, so the
-- UNIQUE(job_type, dedupe_key) makes a second enqueue a no-op.
create or replace function public.enqueue_due_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  with due as (
    select tr.id as reminder_id
    from public.task_reminders tr
    join public.tasks t on t.id = tr.task_id
    where tr.status = 'pending'
      and tr.scheduled_at <= now()
      and t.lifecycle_status = 'open'
      and t.deleted_at is null
  ), inserted as (
    insert into public.processing_jobs (job_type, dedupe_key, payload, status, run_after)
    select 'send_reminder', due.reminder_id::text,
           jsonb_build_object('reminder_id', due.reminder_id),
           'queued', now()
    from due
    on conflict (job_type, dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;

-- Concurrency-safe claim: FOR UPDATE SKIP LOCKED, bumps attempt_count once.
create or replace function public.claim_reminder_jobs(p_limit integer)
returns setof public.processing_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.processing_jobs j
  set status = 'running', attempt_count = j.attempt_count + 1, updated_at = now()
  where j.id in (
    select c.id
    from public.processing_jobs c
    where c.job_type = 'send_reminder'
      and c.status = 'queued'
      and c.run_after <= now()
      and c.attempt_count < c.max_attempts
    order by c.run_after
    limit greatest(coalesce(p_limit, 10), 1)
    for update skip locked
  )
  returning j.*;
end;
$$;

-- Success: job done + reminder marked sent (never overwrites an already-sent
-- reminder; never resets sent_at).
create or replace function public.complete_reminder_job(
  p_job_id uuid,
  p_reminder_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task_reminders
  set status = 'sent', sent_at = now()
  where id = p_reminder_id and status = 'pending';

  update public.processing_jobs
  set status = 'succeeded', completed_at = now(), updated_at = now(), last_error = null
  where id = p_job_id;
end;
$$;

-- Failure: transient + attempts remain -> requeue with backoff; else fail.
create or replace function public.fail_reminder_job(
  p_job_id uuid,
  p_error text,
  p_transient boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt integer;
  v_max integer;
begin
  select attempt_count, max_attempts into v_attempt, v_max
  from public.processing_jobs where id = p_job_id;

  if coalesce(p_transient, false) and v_attempt < v_max then
    update public.processing_jobs
    set status = 'queued',
        run_after = now() + (make_interval(mins => power(2, greatest(v_attempt, 1))::int)),
        last_error = left(coalesce(p_error, ''), 500),
        updated_at = now()
    where id = p_job_id;
  else
    update public.processing_jobs
    set status = 'failed',
        last_error = left(coalesce(p_error, ''), 500),
        completed_at = now(),
        updated_at = now()
    where id = p_job_id;
  end if;
end;
$$;

-- Everything the worker needs to send one reminder: delivery target (MVP rule)
-- plus the message ingredients. kind is 'user' | 'group' | 'none'.
--   private task  -> owner's approved 1:1 conversation
--   family task   -> assignee's approved 1:1 if any, else the workspace's single
--                    approved group, else 'none' + reason
create or replace function public.reminder_dispatch_info(p_reminder_id uuid)
returns table (
  kind text,
  line_target text,
  reason text,
  task_title text,
  due_at timestamptz,
  preset text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_line text;
  v_group text;
  v_group_count integer;
  v_kind text := 'none';
  v_target text := null;
  v_reason text := null;
begin
  select t.id, t.workspace_id, t.assignee_profile_id, t.title, t.due_at,
         t.lifecycle_status, t.deleted_at, w.type as ws_type, w.owner_profile_id,
         tr.preset
  into v
  from public.task_reminders tr
  join public.tasks t on t.id = tr.task_id
  join public.workspaces w on w.id = t.workspace_id
  where tr.id = p_reminder_id;

  if v.id is null then
    return query select 'none'::text, null::text, 'reminder_not_found'::text,
                        null::text, null::timestamptz, null::text;
    return;
  end if;

  if v.lifecycle_status <> 'open' or v.deleted_at is not null then
    return query select 'none'::text, null::text, 'task_not_open'::text,
                        v.title, v.due_at, v.preset;
    return;
  end if;

  if v.ws_type = 'private' then
    select lc.line_source_id into v_line
    from public.line_conversations lc
    where lc.line_source_type = 'user' and lc.approved = true
      and lc.profile_id = v.owner_profile_id;
    if v_line is null then
      v_reason := 'owner_no_line_link';
    else
      v_kind := 'user'; v_target := v_line;
    end if;
  else
    if v.assignee_profile_id is not null then
      select lc.line_source_id into v_line
      from public.line_conversations lc
      where lc.line_source_type = 'user' and lc.approved = true
        and lc.profile_id = v.assignee_profile_id;
    end if;

    if v_line is not null then
      v_kind := 'user'; v_target := v_line;
    else
      select count(*), max(lc.line_source_id) into v_group_count, v_group
      from public.line_conversations lc
      where lc.line_source_type = 'group' and lc.approved = true
        and lc.workspace_id = v.workspace_id;

      if v_group_count = 1 then
        v_kind := 'group'; v_target := v_group;
      else
        v_reason := case when coalesce(v_group_count, 0) = 0
                         then 'no_delivery_target' else 'multiple_groups' end;
      end if;
    end if;
  end if;

  return query select v_kind, v_target, v_reason, v.title, v.due_at, v.preset;
end;
$$;

revoke execute on function public.enqueue_due_reminders() from public, anon, authenticated;
revoke execute on function public.claim_reminder_jobs(integer) from public, anon, authenticated;
revoke execute on function public.complete_reminder_job(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fail_reminder_job(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.reminder_dispatch_info(uuid) from public, anon, authenticated;

grant execute on function public.claim_reminder_jobs(integer) to service_role;
grant execute on function public.complete_reminder_job(uuid, uuid) to service_role;
grant execute on function public.fail_reminder_job(uuid, text, boolean) to service_role;
grant execute on function public.reminder_dispatch_info(uuid) to service_role;
-- enqueue_due_reminders: no grant — cron runs it as postgres (the owner).


-- =========================================================================
-- 6. Settings > LINE browser RPCs (authenticated)
-- =========================================================================

-- Safe connection status for the signed-in user. Never returns raw
-- userId/groupId — only booleans, labels, and our own PK for pending groups.
create or replace function public.get_line_connection_status()
returns table (
  one_to_one_linked boolean,
  workspace_id uuid,
  workspace_name text,
  is_owner boolean,
  group_bound boolean,
  group_label text,
  bound_conversation_id uuid,
  pending_conversation_id uuid,
  pending_group_label text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_linked boolean;
begin
  if v_uid is null then
    return;
  end if;

  v_linked := exists (
    select 1 from public.line_conversations lc
    where lc.line_source_type = 'user' and lc.approved = true and lc.profile_id = v_uid
  );

  return query
  with my_family as (
    select w.id, w.name,
           exists (
             select 1 from public.workspace_members m
             where m.workspace_id = w.id and m.profile_id = v_uid and m.role = 'owner'
           ) as is_owner
    from public.workspaces w
    join public.workspace_members m on m.workspace_id = w.id
    where w.type = 'family' and m.profile_id = v_uid
  )
  select
    v_linked,
    mf.id,
    mf.name,
    mf.is_owner,
    exists (
      select 1 from public.line_conversations lc
      where lc.line_source_type = 'group' and lc.approved = true and lc.workspace_id = mf.id
    ),
    (
      select lc.display_label from public.line_conversations lc
      where lc.line_source_type = 'group' and lc.approved = true and lc.workspace_id = mf.id
      limit 1
    ),
    (
      select lc.id from public.line_conversations lc
      where lc.line_source_type = 'group' and lc.approved = true and lc.workspace_id = mf.id
      limit 1
    ),
    (
      select lc.id from public.line_conversations lc
      where lc.line_source_type = 'group' and lc.approved = false and lc.workspace_id is null
      order by lc.updated_at desc limit 1
    ),
    (
      select lc.display_label from public.line_conversations lc
      where lc.line_source_type = 'group' and lc.approved = false and lc.workspace_id is null
      order by lc.updated_at desc limit 1
    )
  from my_family mf;

  if not found then
    return query
    select v_linked, null::uuid, null::text, false, false,
           null::text, null::uuid, null::uuid, null::text;
  end if;
end;
$$;

-- Owner binds a pending group to one of their family workspaces.
create or replace function public.approve_line_group(
  p_workspace_id uuid,
  p_conversation_id uuid
)
returns table (blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_src_type public.line_source_type;
  v_current_ws uuid;
begin
  if v_uid is null then
    return query select 'not_authenticated'::text; return;
  end if;
  if not public.is_family_workspace_owner(p_workspace_id, v_uid) then
    return query select 'not_owner'::text; return;
  end if;

  perform 1 from public.workspaces where id = p_workspace_id for update;

  select lc.line_source_type, lc.workspace_id
  into v_src_type, v_current_ws
  from public.line_conversations lc
  where lc.id = p_conversation_id;

  if v_src_type is null then
    return query select 'conversation_not_found'::text; return;
  end if;
  if v_src_type <> 'group' then
    return query select 'not_a_group'::text; return;
  end if;
  if v_current_ws is not null and v_current_ws <> p_workspace_id then
    return query select 'group_bound_elsewhere'::text; return;
  end if;

  begin
    update public.line_conversations
    set workspace_id = p_workspace_id,
        approved = true,
        approved_by_profile_id = v_uid,
        approved_at = now()
    where id = p_conversation_id;
  exception
    when unique_violation then
      return query select 'workspace_already_has_group'::text; return;
  end;

  return query select null::text;
end;
$$;

create or replace function public.unbind_line_group(
  p_conversation_id uuid
)
returns table (blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ws uuid;
begin
  if v_uid is null then
    return query select 'not_authenticated'::text; return;
  end if;

  select lc.workspace_id into v_ws
  from public.line_conversations lc
  where lc.id = p_conversation_id and lc.line_source_type = 'group';

  if v_ws is null then
    return query select 'not_bound'::text; return;
  end if;
  if not public.is_family_workspace_owner(v_ws, v_uid) then
    return query select 'not_owner'::text; return;
  end if;

  update public.line_conversations
  set workspace_id = null, approved = false,
      approved_by_profile_id = null, approved_at = null
  where id = p_conversation_id;

  return query select null::text;
end;
$$;

revoke execute on function public.get_line_connection_status() from public, anon;
revoke execute on function public.approve_line_group(uuid, uuid) from public, anon;
revoke execute on function public.unbind_line_group(uuid) from public, anon;
grant execute on function public.get_line_connection_status() to authenticated;
grant execute on function public.approve_line_group(uuid, uuid) to authenticated;
grant execute on function public.unbind_line_group(uuid) to authenticated;


-- =========================================================================
-- 7. Cron: enqueue due reminders + poke the worker to drain the queue
-- =========================================================================
-- The worker secret is read from Supabase Vault at run time. Until the operator
-- seeds it (vault.create_secret('<value>', 'famkeep_worker_secret')) the header
-- is null and line-worker rejects the call — safe no-op.

select cron.schedule(
  'famkeep-enqueue-reminders',
  '* * * * *',
  $cron$ select public.enqueue_due_reminders(); $cron$
);

select cron.schedule(
  'famkeep-drain-jobs',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://zuoejigurotylrcisycw.supabase.co/functions/v1/line-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Worker-Secret',
      coalesce((select decrypted_secret from vault.decrypted_secrets
                where name = 'famkeep_worker_secret'), '')
    ),
    body := jsonb_build_object('trigger', 'cron'),
    timeout_milliseconds := 8000
  );
  $cron$
);
