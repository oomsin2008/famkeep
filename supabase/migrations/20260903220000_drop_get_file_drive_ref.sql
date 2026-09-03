-- Phase 7.6c revision: the file-download Edge Function no longer needs a
-- SECURITY DEFINER RPC to fetch drive_file_id. It now (a) confirms access with
-- a JWT-scoped `select id from files` that the files_select_accessible RLS
-- policy governs, then (b) reads drive_file_id with the service_role key
-- server-side. That keeps drive_file_id off every browser-reachable surface,
-- including /rest/v1/rpc. Drop the now-unused RPC.
--
-- The column-level SELECT grant from 20260903210000 (authenticated cannot read
-- files.drive_file_id) stays in place.

drop function if exists public.get_file_drive_ref(uuid);
