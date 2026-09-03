-- Phase 7.6e: Locker delete.
--
-- Soft delete is the app's source of truth (files.deleted_at = now()); the
-- file-delete Edge Function calls this after authenticating the caller, then
-- best-effort moves + renames the Drive original into a cleanup folder.
--
-- No browser UPDATE grant on public.files. This RPC is SECURITY DEFINER and
-- granted to service_role only (it returns drive_file_id, which must never
-- reach the browser). It does its own workspace-access check.

create or replace function public.soft_delete_file(
  p_actor_profile_id uuid,
  p_file_id uuid
)
returns table (drive_file_id text, name text, blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ws uuid;
  v_deleted timestamptz;
  v_drive text;
  v_name text;
begin
  if p_actor_profile_id is null then
    return query select null::text, null::text, 'actor_unknown'::text; return;
  end if;

  select f.workspace_id, f.deleted_at, f.drive_file_id, f.name
    into v_ws, v_deleted, v_drive, v_name
  from public.files f
  where f.id = p_file_id;

  if v_ws is null then
    return query select null::text, null::text, 'file_not_found'::text; return;
  end if;
  if not public.can_access_workspace(v_ws, p_actor_profile_id) then
    return query select null::text, null::text, 'no_workspace_access'::text; return;
  end if;

  if v_deleted is not null then
    -- already soft-deleted: still hand back the ref so a failed Drive move
    -- can be retried by calling this again.
    return query select v_drive, v_name, 'already_deleted'::text; return;
  end if;

  update public.files set deleted_at = now()
  where id = p_file_id and deleted_at is null;

  return query select v_drive, v_name, null::text;
end;
$$;

revoke execute on function public.soft_delete_file(uuid, uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_file(uuid, uuid) to service_role;
