-- Phase 7.3 C/D: task + reminder persistence, RLS, and the narrow RPC surface
-- that replaces the in-memory mock store. No LINE/Cron/#งาน here — this phase
-- only stores correct rows.
--
-- Locked product behavior preserved:
--   lifecycle_status persisted: open | done | cancelled
--   progress / duesoon / overdue are DERIVED client-side, never stored
--   backend timestamps UTC; business tz Asia/Bangkok
--   workspace immutable after creation; no delete UI
--   reminders hard max 2 (already DB-enforced: slot IN (1,2),
--     UNIQUE(task_id,slot), UNIQUE(task_id,preset)); presets unique per task
--
-- Access model (unchanged): private = workspaces.owner_profile_id,
--   family = workspace_members. can_access_workspace() branches on both.


-- =========================================================================
-- 1. Helpers
-- =========================================================================

-- Reminder schedule math, mirrored from src/lib/reminders.ts. Pure (no table
-- access); definer-only callers, so no role needs EXECUTE.
create or replace function public.compute_reminder_scheduled_at(
  p_preset text,
  p_due_at timestamptz
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case p_preset
    when 'one_day_before'     then p_due_at - interval '24 hours'
    when 'three_hours_before' then p_due_at - interval '3 hours'
    when 'morning_of_due'     then
      ((p_due_at at time zone 'Asia/Bangkok')::date + time '09:00')
        at time zone 'Asia/Bangkok'
    else null
  end;
$$;

revoke execute on function public.compute_reminder_scheduled_at(text, timestamptz) from public;
revoke execute on function public.compute_reminder_scheduled_at(text, timestamptz) from anon;
revoke execute on function public.compute_reminder_scheduled_at(text, timestamptz) from authenticated;

-- Task-level access check, used by the task_reminders RLS policy (so it is
-- executed as the calling role -> authenticated must keep EXECUTE). Routed
-- through can_access_workspace, which is SECURITY DEFINER and owned by the
-- table owner, so this does not recurse into task_reminders.
create or replace function public.can_access_task(p_task_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and t.deleted_at is null
      and public.can_access_workspace(t.workspace_id, p_uid)
  );
$$;

revoke execute on function public.can_access_task(uuid, uuid) from public;
revoke execute on function public.can_access_task(uuid, uuid) from anon;
grant execute on function public.can_access_task(uuid, uuid) to authenticated;


-- =========================================================================
-- 2. Table privileges + RLS (SELECT only; all writes go through the RPCs)
-- =========================================================================
revoke all on public.tasks from public;
revoke all on public.tasks from anon;
revoke all on public.tasks from authenticated;
grant select on public.tasks to authenticated;

drop policy if exists tasks_select_accessible on public.tasks;
create policy tasks_select_accessible
  on public.tasks
  for select
  to authenticated
  using (
    deleted_at is null
    and public.can_access_workspace(workspace_id, auth.uid())
  );

revoke all on public.task_reminders from public;
revoke all on public.task_reminders from anon;
revoke all on public.task_reminders from authenticated;
grant select on public.task_reminders to authenticated;

drop policy if exists task_reminders_select_accessible on public.task_reminders;
create policy task_reminders_select_accessible
  on public.task_reminders
  for select
  to authenticated
  using (public.can_access_task(task_id, auth.uid()));


-- =========================================================================
-- 3. Workspace immutability trigger (test K)
-- =========================================================================
-- workspace_id is on delete cascade (no cascade-sets-null hazard), so an
-- unconditional immutability check is safe. Fires only when workspace_id is in
-- the UPDATE's SET list.
create or replace function public.enforce_task_workspace_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'tasks.workspace_id cannot be changed after creation'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_workspace_immutable on public.tasks;
create trigger trg_tasks_workspace_immutable
  before update of workspace_id on public.tasks
  for each row
  execute function public.enforce_task_workspace_immutable();


-- =========================================================================
-- 4. RPCs
-- =========================================================================
-- All: SECURITY DEFINER, search_path = '', schema-qualified, derive auth.uid()
-- server-side, validate workspace/task access internally, return a
-- blocked_reason status row (never a raw PG error), revoke EXECUTE from
-- public/anon, grant to authenticated.

-- ---- create_task: task + 0-2 reminders, atomically -----------------------
create or replace function public.create_task(
  p_workspace_id uuid,
  p_title text,
  p_notes text,
  p_assignee_profile_id uuid,
  p_due_at timestamptz,
  p_reminder_presets text[]
)
returns table (task_id uuid, blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_title text;
  v_notes text;
  v_ws_type public.workspace_type;
  v_task_id uuid;
  v_presets text[];
  v_preset text;
  v_slot smallint;
begin
  if v_uid is null then
    return query select null::uuid, 'not_authenticated'::text; return;
  end if;

  if not public.can_access_workspace(p_workspace_id, v_uid) then
    return query select null::uuid, 'no_workspace_access'::text; return;
  end if;

  select w.type into v_ws_type from public.workspaces w where w.id = p_workspace_id;

  v_title := btrim(coalesce(p_title, ''));
  if v_title = '' or char_length(v_title) > 200 then
    return query select null::uuid, 'invalid_title'::text; return;
  end if;

  v_notes := coalesce(p_notes, '');
  if char_length(v_notes) > 5000 then
    return query select null::uuid, 'invalid_notes'::text; return;
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
      where m.workspace_id = p_workspace_id
        and m.profile_id = p_assignee_profile_id
    )
  then
    return query select null::uuid, 'assignee_not_family_member'::text; return;
  end if;

  select array_agg(distinct e order by e) into v_presets
  from unnest(coalesce(p_reminder_presets, '{}'::text[])) as t(e);
  v_presets := coalesce(v_presets, '{}'::text[]);

  if coalesce(array_length(v_presets, 1), 0) > 2 then
    return query select null::uuid, 'too_many_reminders'::text; return;
  end if;

  foreach v_preset in array v_presets loop
    if v_preset not in ('one_day_before', 'three_hours_before', 'morning_of_due') then
      return query select null::uuid, 'invalid_reminder_preset'::text; return;
    end if;
  end loop;

  insert into public.tasks (
    workspace_id, title, notes, assignee_profile_id, due_at,
    lifecycle_status, created_by_profile_id, created_via
  )
  values (
    p_workspace_id, v_title, v_notes,
    case when v_ws_type = 'family' then p_assignee_profile_id else null end,
    p_due_at, 'open'::public.task_lifecycle_status, v_uid, 'app'
  )
  returning id into v_task_id;

  v_slot := 1;
  foreach v_preset in array v_presets loop
    insert into public.task_reminders (task_id, slot, preset, scheduled_at, status)
    values (
      v_task_id, v_slot, v_preset,
      public.compute_reminder_scheduled_at(v_preset, p_due_at),
      'pending'
    );
    v_slot := v_slot + 1;
  end loop;

  return query select v_task_id, null::text;
exception
  when unique_violation then
    return query select null::uuid, 'task_conflict'::text;
  when check_violation then
    return query select null::uuid, 'task_constraint_violation'::text;
  when insufficient_privilege then
    return query select null::uuid, 'permission_denied'::text;
end;
$$;

revoke execute on function public.create_task(uuid, text, text, uuid, timestamptz, text[]) from public;
revoke execute on function public.create_task(uuid, text, text, uuid, timestamptz, text[]) from anon;
grant execute on function public.create_task(uuid, text, text, uuid, timestamptz, text[]) to authenticated;

comment on function public.create_task(uuid, text, text, uuid, timestamptz, text[]) is
  'Create a task (lifecycle open, created_via app) plus 0-2 reminders atomically. Enforces workspace access, private/family assignee rules, and reminder validity.';

-- ---- update_task_fields: title / notes (NULL param = leave unchanged) -----
create or replace function public.update_task_fields(
  p_task_id uuid,
  p_title text,
  p_notes text
)
returns table (blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_title text;
begin
  if v_uid is null then
    return query select 'not_authenticated'::text; return;
  end if;
  if not public.can_access_task(p_task_id, v_uid) then
    return query select 'no_task_access'::text; return;
  end if;

  -- Validate every supplied field BEFORE writing anything, so a bad second
  -- field can never leave a committed first field behind.
  if p_title is not null then
    v_title := btrim(p_title);
    if v_title = '' or char_length(v_title) > 200 then
      return query select 'invalid_title'::text; return;
    end if;
  end if;

  if p_notes is not null and char_length(p_notes) > 5000 then
    return query select 'invalid_notes'::text; return;
  end if;

  if p_title is not null then
    update public.tasks set title = v_title where id = p_task_id;
  end if;
  if p_notes is not null then
    update public.tasks set notes = p_notes where id = p_task_id;
  end if;

  return query select null::text;
end;
$$;

revoke execute on function public.update_task_fields(uuid, text, text) from public;
revoke execute on function public.update_task_fields(uuid, text, text) from anon;
grant execute on function public.update_task_fields(uuid, text, text) to authenticated;

-- ---- set_task_assignee: family only; null clears; must be a member --------
create or replace function public.set_task_assignee(
  p_task_id uuid,
  p_assignee_profile_id uuid
)
returns table (blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ws_id uuid;
  v_ws_type public.workspace_type;
begin
  if v_uid is null then
    return query select 'not_authenticated'::text; return;
  end if;
  if not public.can_access_task(p_task_id, v_uid) then
    return query select 'no_task_access'::text; return;
  end if;

  select t.workspace_id, w.type
    into v_ws_id, v_ws_type
  from public.tasks t
  join public.workspaces w on w.id = t.workspace_id
  where t.id = p_task_id;

  if v_ws_type = 'private' then
    if p_assignee_profile_id is not null then
      return query select 'private_assignee_not_allowed'::text; return;
    end if;
    return query select null::text; return;
  end if;

  if p_assignee_profile_id is not null
    and not exists (
      select 1 from public.workspace_members m
      where m.workspace_id = v_ws_id and m.profile_id = p_assignee_profile_id
    )
  then
    return query select 'assignee_not_family_member'::text; return;
  end if;

  update public.tasks set assignee_profile_id = p_assignee_profile_id where id = p_task_id;
  return query select null::text;
end;
$$;

revoke execute on function public.set_task_assignee(uuid, uuid) from public;
revoke execute on function public.set_task_assignee(uuid, uuid) from anon;
grant execute on function public.set_task_assignee(uuid, uuid) to authenticated;

-- ---- set_task_lifecycle: explicit open/done/cancelled -------------------
create or replace function public.set_task_lifecycle(
  p_task_id uuid,
  p_status text
)
returns table (blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return query select 'not_authenticated'::text; return;
  end if;
  if not public.can_access_task(p_task_id, v_uid) then
    return query select 'no_task_access'::text; return;
  end if;
  if p_status not in ('open', 'done', 'cancelled') then
    return query select 'invalid_status'::text; return;
  end if;

  update public.tasks
  set lifecycle_status = p_status::public.task_lifecycle_status
  where id = p_task_id;

  return query select null::text;
end;
$$;

revoke execute on function public.set_task_lifecycle(uuid, text) from public;
revoke execute on function public.set_task_lifecycle(uuid, text) from anon;
grant execute on function public.set_task_lifecycle(uuid, text) to authenticated;

-- ---- set_task_due_at: reschedule PENDING reminders only ----------------
create or replace function public.set_task_due_at(
  p_task_id uuid,
  p_due_at timestamptz
)
returns table (blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return query select 'not_authenticated'::text; return;
  end if;
  if not public.can_access_task(p_task_id, v_uid) then
    return query select 'no_task_access'::text; return;
  end if;
  if p_due_at is null then
    return query select 'invalid_due_at'::text; return;
  end if;

  perform 1 from public.tasks where id = p_task_id for update;

  update public.tasks set due_at = p_due_at where id = p_task_id;

  update public.task_reminders
  set scheduled_at = public.compute_reminder_scheduled_at(preset, p_due_at)
  where task_id = p_task_id
    and status = 'pending';

  return query select null::text;
end;
$$;

revoke execute on function public.set_task_due_at(uuid, timestamptz) from public;
revoke execute on function public.set_task_due_at(uuid, timestamptz) from anon;
grant execute on function public.set_task_due_at(uuid, timestamptz) to authenticated;

-- ---- add_task_reminder: safe slot allocation --------------------------
create or replace function public.add_task_reminder(
  p_task_id uuid,
  p_preset text
)
returns table (blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_due timestamptz;
  v_slot smallint;
begin
  if v_uid is null then
    return query select 'not_authenticated'::text; return;
  end if;
  if not public.can_access_task(p_task_id, v_uid) then
    return query select 'no_task_access'::text; return;
  end if;
  if p_preset not in ('one_day_before', 'three_hours_before', 'morning_of_due') then
    return query select 'invalid_reminder_preset'::text; return;
  end if;

  -- serialize concurrent adds for this task so slot picking is race-free
  perform 1 from public.tasks where id = p_task_id for update;

  select due_at into v_due from public.tasks where id = p_task_id;

  if exists (
    select 1 from public.task_reminders
    where task_id = p_task_id and preset = p_preset
  ) then
    return query select 'duplicate_reminder'::text; return;
  end if;

  select v.s into v_slot
  from (values (1::smallint), (2::smallint)) as v(s)
  where v.s not in (
    select tr.slot from public.task_reminders tr where tr.task_id = p_task_id
  )
  order by v.s
  limit 1;

  if v_slot is null then
    return query select 'too_many_reminders'::text; return;
  end if;

  insert into public.task_reminders (task_id, slot, preset, scheduled_at, status)
  values (
    p_task_id, v_slot, p_preset,
    public.compute_reminder_scheduled_at(p_preset, v_due),
    'pending'
  );

  return query select null::text;
exception
  when unique_violation then
    return query select 'reminder_conflict'::text;
  when check_violation then
    return query select 'reminder_conflict'::text;
end;
$$;

revoke execute on function public.add_task_reminder(uuid, text) from public;
revoke execute on function public.add_task_reminder(uuid, text) from anon;
grant execute on function public.add_task_reminder(uuid, text) to authenticated;

-- ---- remove_task_reminder: only removes a PENDING reminder ------------
create or replace function public.remove_task_reminder(
  p_task_id uuid,
  p_preset text
)
returns table (blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted int;
begin
  if v_uid is null then
    return query select 'not_authenticated'::text; return;
  end if;
  if not public.can_access_task(p_task_id, v_uid) then
    return query select 'no_task_access'::text; return;
  end if;

  perform 1 from public.tasks where id = p_task_id for update;

  delete from public.task_reminders
  where task_id = p_task_id
    and preset = p_preset
    and status = 'pending';
  get diagnostics v_deleted = row_count;

  if v_deleted = 0
    and exists (
      select 1 from public.task_reminders
      where task_id = p_task_id and preset = p_preset
    )
  then
    return query select 'reminder_already_sent'::text; return;
  end if;

  return query select null::text;
end;
$$;

revoke execute on function public.remove_task_reminder(uuid, text) from public;
revoke execute on function public.remove_task_reminder(uuid, text) from anon;
grant execute on function public.remove_task_reminder(uuid, text) to authenticated;
