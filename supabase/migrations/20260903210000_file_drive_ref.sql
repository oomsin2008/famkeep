-- Phase 7.6c: secure file preview/download.
--
-- The browser never sees drive_file_id. The file-download Edge Function (JWT
-- required) calls get_file_drive_ref with the user's token; the function
-- verifies workspace access via can_access_workspace(auth.uid()) and returns
-- the Drive ref only to an authorized caller. The Edge Function then streams
-- the bytes from Google Drive using its own backend credentials.


-- =========================================================================
-- 1. Column-level hardening: authenticated can never read drive_file_id
-- =========================================================================
-- RLS still governs row visibility; this additionally removes the column from
-- what PostgREST will return to the browser, even on a crafted select.
revoke select on public.files from authenticated;
grant select (
  id, workspace_id, name, kind, size_bytes, saved_by_profile_id,
  saved_via_line, folder_id, line_message_id, created_at, updated_at, deleted_at
) on public.files to authenticated;


-- =========================================================================
-- 2. get_file_drive_ref: authorized Drive-ref lookup for the Edge Function
-- =========================================================================
create or replace function public.get_file_drive_ref(p_file_id uuid)
returns table (drive_file_id text, name text, kind text)
language sql
stable
security definer
set search_path = ''
as $$
  select f.drive_file_id, f.name, f.kind
  from public.files f
  where f.id = p_file_id
    and f.deleted_at is null
    and public.can_access_workspace(f.workspace_id, auth.uid());
$$;

revoke execute on function public.get_file_drive_ref(uuid) from public;
revoke execute on function public.get_file_drive_ref(uuid) from anon;
grant execute on function public.get_file_drive_ref(uuid) to authenticated;
