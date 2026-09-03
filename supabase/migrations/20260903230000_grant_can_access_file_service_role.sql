-- Phase 7.6c fix: the file-download Edge Function validates the caller's JWT
-- with admin.auth.getUser(token) (service_role introspection) and then needs to
-- run the workspace-access check itself as service_role, rather than relying on
-- a JWT-scoped PostgREST call whose forwarded Authorization header was not
-- reaching auth.uid() (RLS saw a null uid -> 0 rows -> 404).
--
-- can_access_file is SECURITY DEFINER (owned by postgres) so it still evaluates
-- with the table owner's privileges; this only lets service_role invoke it.

grant execute on function public.can_access_file(uuid, uuid) to service_role;
