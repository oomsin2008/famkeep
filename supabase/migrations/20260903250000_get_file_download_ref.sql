-- Phase 7.6c fix 2: file-download 404 "(no_drive_ref)" on real, valid files.
--
-- Root cause: in this project `service_role` has NO table-level DML on any
-- public table (only REFERENCES/TRIGGER/TRUNCATE) — every backend path goes
-- through SECURITY DEFINER RPCs. file-download was the one exception: it did a
-- raw `admin.from("files").select("drive_file_id, name")` as service_role,
-- which fails with permission-denied -> the error branch -> `no_drive_ref`.
-- The file rows themselves are fine (all have drive_file_id).
--
-- Fix: give file-download an RPC like everything else. It authorizes the actor
-- and returns the Drive ref in one call.

create or replace function public.get_file_download_ref(
  p_file_id uuid,
  p_actor_profile_id uuid
)
returns table (drive_file_id text, name text, blocked_reason text)
language plpgsql
stable
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

  if v_ws is null or v_deleted is not null then
    return query select null::text, null::text, 'file_not_found'::text; return;
  end if;
  if not public.can_access_workspace(v_ws, p_actor_profile_id) then
    return query select null::text, null::text, 'no_access'::text; return;
  end if;
  if v_drive is null or btrim(v_drive) = '' then
    -- accessible row but no Drive object (legacy / pre-Drive-integration row)
    return query select null::text, v_name, 'no_drive_ref'::text; return;
  end if;

  return query select v_drive, v_name, null::text;
end;
$$;

revoke execute on function public.get_file_download_ref(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_file_download_ref(uuid, uuid) to service_role;
