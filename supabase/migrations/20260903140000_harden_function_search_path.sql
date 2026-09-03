-- Phase 7.3 A: small security hardening for FamKeep-owned functions.
-- No behavior change. Bodies are already schema-qualified; this only pins an
-- empty search_path and (for can_access_workspace) tightens EXECUTE.
--
-- rls_auto_enable() is Supabase platform-owned and deliberately untouched.

-- can_access_workspace: used inside RLS policies on workspaces /
-- workspace_members / tasks / task_reminders, so it is executed as the calling
-- role and `authenticated` must keep EXECUTE. `anon` and PUBLIC never need it.
alter function public.can_access_workspace(uuid, uuid) set search_path = '';
revoke execute on function public.can_access_workspace(uuid, uuid) from public;
revoke execute on function public.can_access_workspace(uuid, uuid) from anon;
grant execute on function public.can_access_workspace(uuid, uuid) to authenticated;

-- Trigger functions: fire as the table owner's trigger machinery; body only
-- calls pg_catalog built-ins (now()) or already-qualified public.* lookups.
alter function public.set_updated_at() set search_path = '';
alter function public.enforce_family_only_membership() set search_path = '';
