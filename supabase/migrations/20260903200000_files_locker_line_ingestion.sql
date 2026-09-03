-- Phase 7.6: Files + Locker + Google Drive MVP.
--
-- Originals live in Google Drive (uploaded server-side by the line-webhook
-- Edge Function using a backend-only OAuth refresh token). Supabase stores
-- only metadata. No web upload, no download serving, no preview in this phase.
--
-- Ingestion rules (enforced in the Edge Function; the RPCs below just persist
-- the result of an authorized decision):
--   1:1 LINE      -> images + files auto-save to the sender's private workspace
--   Family group  -> documents/files auto-save to the bound family workspace;
--                    a normal image only records a pending_attachments row and
--                    is saved only when a linked member replies #เก็บ /
--                    เก็บรูปนี้ (optionally quoting the image).
-- A file is always attributed to a linked profile (files.saved_by_profile_id
-- is NOT NULL): an unlinked group sender gets an onboarding reply, no save.
--
-- line_conversations stays the single source of truth for LINE source ->
-- profile / workspace. workspaces still never stores a line_group_id.


-- =========================================================================
-- 1. Schema: dedupe index on LINE message id + pending lookup index
-- =========================================================================

-- Belt-and-suspenders dedupe: webhook_events already stops a redelivered
-- event from being reprocessed; this stops two different events that somehow
-- reference the same LINE message from creating two files.
create unique index if not exists files_line_message_id_key
  on public.files (line_message_id)
  where line_message_id is not null;

-- "most recent unresolved pending image for this conversation" lookup.
create index if not exists pending_attachments_unresolved_idx
  on public.pending_attachments (line_conversation_id, created_at desc)
  where resolved_at is null;


-- =========================================================================
-- 2. Table privileges: browser gets SELECT only, writes go through backend
-- =========================================================================
revoke all on public.files from public;
revoke all on public.files from anon;
revoke all on public.files from authenticated;
grant select on public.files to authenticated;

revoke all on public.folders from public;
revoke all on public.folders from anon;
revoke all on public.folders from authenticated;
grant select on public.folders to authenticated;

revoke all on public.tags from public;
revoke all on public.tags from anon;
revoke all on public.tags from authenticated;
grant select on public.tags to authenticated;

revoke all on public.file_tags from public;
revoke all on public.file_tags from anon;
revoke all on public.file_tags from authenticated;
grant select on public.file_tags to authenticated;

-- pending_attachments is backend-only (LINE ingestion bookkeeping).
revoke all on public.pending_attachments from public;
revoke all on public.pending_attachments from anon;
revoke all on public.pending_attachments from authenticated;


-- =========================================================================
-- 3. RLS helper + policies (SELECT only; all writes are backend RPCs)
-- =========================================================================

-- File-level access check for the file_tags policy. Routed through
-- can_access_workspace (SECURITY DEFINER, owned by the table owner) so it does
-- not recurse into files' own RLS.
create or replace function public.can_access_file(p_file_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.files f
    where f.id = p_file_id
      and f.deleted_at is null
      and public.can_access_workspace(f.workspace_id, p_uid)
  );
$$;

revoke execute on function public.can_access_file(uuid, uuid) from public;
revoke execute on function public.can_access_file(uuid, uuid) from anon;
grant execute on function public.can_access_file(uuid, uuid) to authenticated;

drop policy if exists files_select_accessible on public.files;
create policy files_select_accessible
  on public.files
  for select
  to authenticated
  using (
    deleted_at is null
    and public.can_access_workspace(workspace_id, auth.uid())
  );

drop policy if exists folders_select_accessible on public.folders;
create policy folders_select_accessible
  on public.folders
  for select
  to authenticated
  using (
    deleted_at is null
    and public.can_access_workspace(workspace_id, auth.uid())
  );

drop policy if exists tags_select_accessible on public.tags;
create policy tags_select_accessible
  on public.tags
  for select
  to authenticated
  using (public.can_access_workspace(workspace_id, auth.uid()));

drop policy if exists file_tags_select_accessible on public.file_tags;
create policy file_tags_select_accessible
  on public.file_tags
  for select
  to authenticated
  using (public.can_access_file(file_id, auth.uid()));


-- =========================================================================
-- 4. Backend ingestion RPCs (service_role only)
-- =========================================================================

-- Persist one saved file. Actor is explicit (no auth.uid()); mirrors the
-- workspace-access rule the browser RPCs use. Idempotent on line_message_id.
create or replace function public.create_file_from_line(
  p_workspace_id uuid,
  p_actor_profile_id uuid,
  p_name text,
  p_kind text,
  p_size_bytes bigint,
  p_drive_file_id text,
  p_line_message_id text
)
returns table (file_id uuid, blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_drive text := nullif(btrim(coalesce(p_drive_file_id, '')), '');
  v_msg text := nullif(btrim(coalesce(p_line_message_id, '')), '');
  v_existing uuid;
  v_file uuid;
begin
  if p_actor_profile_id is null then
    return query select null::uuid, 'actor_unknown'::text; return;
  end if;
  if not public.can_access_workspace(p_workspace_id, p_actor_profile_id) then
    return query select null::uuid, 'no_workspace_access'::text; return;
  end if;
  if v_name = '' or char_length(v_name) > 300 then
    return query select null::uuid, 'invalid_name'::text; return;
  end if;
  if p_kind not in ('pdf', 'image', 'doc', 'other') then
    return query select null::uuid, 'invalid_kind'::text; return;
  end if;
  if v_drive is null then
    return query select null::uuid, 'missing_drive_file'::text; return;
  end if;

  if v_msg is not null then
    select id into v_existing from public.files where line_message_id = v_msg;
    if v_existing is not null then
      return query select v_existing, 'already_saved'::text; return;
    end if;
  end if;

  insert into public.files (
    workspace_id, name, kind, size_bytes, saved_by_profile_id,
    saved_via_line, drive_file_id, line_message_id
  )
  values (
    p_workspace_id, v_name, p_kind, greatest(coalesce(p_size_bytes, 0), 0),
    p_actor_profile_id, true, v_drive, v_msg
  )
  returning id into v_file;

  return query select v_file, null::text;
exception
  when unique_violation then
    -- lost a race (same line_message_id or drive_file_id) -> return the winner
    if v_msg is not null then
      select id into v_existing from public.files where line_message_id = v_msg;
    end if;
    if v_existing is null and v_drive is not null then
      select id into v_existing from public.files where drive_file_id = v_drive;
    end if;
    return query select v_existing, 'already_saved'::text;
end;
$$;

-- Fast pre-check the webhook runs BEFORE downloading/uploading anything.
create or replace function public.file_exists_for_line_message(p_line_message_id text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select id from public.files
  where line_message_id = nullif(btrim(coalesce(p_line_message_id, '')), '');
$$;

-- LINE source -> our line_conversations PK (needed to attach pending images).
create or replace function public.get_line_conversation_id(
  p_source_type text,
  p_source_id text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select id from public.line_conversations
  where line_source_type = p_source_type::public.line_source_type
    and line_source_id = nullif(btrim(coalesce(p_source_id, '')), '');
$$;

-- Record a normal group image as pending (NOT saved). Idempotent.
create or replace function public.create_pending_line_image(
  p_conversation_id uuid,
  p_line_message_id text,
  p_posted_by_line_user_id text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg text := nullif(btrim(coalesce(p_line_message_id, '')), '');
begin
  if p_conversation_id is null or v_msg is null then
    return;
  end if;

  insert into public.pending_attachments (
    line_conversation_id, line_message_id, line_content_type,
    posted_by_line_user_id, expires_at
  )
  values (
    p_conversation_id, v_msg, 'image',
    coalesce(nullif(btrim(coalesce(p_posted_by_line_user_id, '')), ''), 'unknown'),
    coalesce(p_expires_at, now() + interval '24 hours')
  )
  on conflict (line_conversation_id, line_message_id) do nothing;
end;
$$;

-- Resolve which pending image a #เก็บ reply refers to: the quoted message if
-- given and still valid, else the most recent unresolved unexpired image.
create or replace function public.resolve_pending_line_image(
  p_conversation_id uuid,
  p_quoted_message_id text
)
returns table (line_message_id text, blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quoted text := nullif(btrim(coalesce(p_quoted_message_id, '')), '');
  v_msg text;
begin
  if p_conversation_id is null then
    return query select null::text, 'no_pending_image'::text; return;
  end if;

  if v_quoted is not null then
    select pa.line_message_id into v_msg
    from public.pending_attachments pa
    where pa.line_conversation_id = p_conversation_id
      and pa.line_message_id = v_quoted
      and pa.line_content_type = 'image'
      and pa.resolved_at is null
      and pa.expires_at > now();
    if v_msg is null then
      return query select null::text, 'pending_not_found'::text; return;
    end if;
    return query select v_msg, null::text; return;
  end if;

  select pa.line_message_id into v_msg
  from public.pending_attachments pa
  where pa.line_conversation_id = p_conversation_id
    and pa.line_content_type = 'image'
    and pa.resolved_at is null
    and pa.expires_at > now()
  order by pa.created_at desc
  limit 1;

  if v_msg is null then
    return query select null::text, 'no_pending_image'::text; return;
  end if;
  return query select v_msg, null::text;
end;
$$;

create or replace function public.mark_pending_line_resolved(
  p_conversation_id uuid,
  p_line_message_id text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.pending_attachments
  set resolved_at = now()
  where line_conversation_id = p_conversation_id
    and line_message_id = nullif(btrim(coalesce(p_line_message_id, '')), '')
    and resolved_at is null;
$$;

revoke execute on function public.create_file_from_line(uuid, uuid, text, text, bigint, text, text) from public, anon, authenticated;
revoke execute on function public.file_exists_for_line_message(text) from public, anon, authenticated;
revoke execute on function public.get_line_conversation_id(text, text) from public, anon, authenticated;
revoke execute on function public.create_pending_line_image(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.resolve_pending_line_image(uuid, text) from public, anon, authenticated;
revoke execute on function public.mark_pending_line_resolved(uuid, text) from public, anon, authenticated;

grant execute on function public.create_file_from_line(uuid, uuid, text, text, bigint, text, text) to service_role;
grant execute on function public.file_exists_for_line_message(text) to service_role;
grant execute on function public.get_line_conversation_id(text, text) to service_role;
grant execute on function public.create_pending_line_image(uuid, text, text, timestamptz) to service_role;
grant execute on function public.resolve_pending_line_image(uuid, text) to service_role;
grant execute on function public.mark_pending_line_resolved(uuid, text) to service_role;
