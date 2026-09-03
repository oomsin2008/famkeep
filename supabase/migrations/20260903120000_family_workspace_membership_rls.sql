-- Phase 7.2E: Family workspace creation, membership management, and the
-- minimal RLS/RPC surface that makes both safe from the browser.
--
-- Locked data model (unchanged here, enforced by 20260902070050):
--   private access  = workspaces.owner_profile_id
--   family access   = workspace_members
--   private workspaces never have workspace_members rows (trigger §16)
--   line_conversations is the only LINE source mapping table
--
-- This migration adds NO LINE Messaging API, task, reminder, or file surface.
-- It does not edit any already-applied migration.
--
-- What it does:
--   1. Locks table privileges on workspace_members (never got the migration-3
--      revoke/grant treatment; cloud auto-exposes new public tables to the
--      Data API roles absent explicit GRANTs).
--   2. Adds SELECT-only RLS policies for workspaces (own private + family
--      member) and workspace_members (family member), both routed through the
--      existing SECURITY DEFINER helper can_access_workspace() so a policy on
--      workspace_members does not recurse into itself.
--   3. Adds five SECURITY DEFINER RPCs for every family mutation. No broad
--      browser INSERT/UPDATE/DELETE on workspaces or workspace_members.
--   4. Adds a last-owner backstop trigger on workspace_members.
--
-- profiles RLS is deliberately left exactly as migration 3 set it
-- (profiles_select_own only). Co-member identity is exposed ONLY through the
-- family_member_list() RPC, which returns id/display_name/avatar_url/role and
-- never line_user_id, email, or notification_prefs.


-- =========================================================================
-- 1. workspace_members table privileges
-- =========================================================================
-- Mirror the migration-3 pattern used for profiles/workspaces: strip every
-- default grant, then hand back SELECT only. All writes go through the RPCs
-- below (which run as the definer, not as the calling role, so they are
-- unaffected by this revoke).
revoke all on public.workspace_members from public;
revoke all on public.workspace_members from anon;
revoke all on public.workspace_members from authenticated;
grant select on public.workspace_members to authenticated;


-- =========================================================================
-- 2. RLS policies (SELECT only)
-- =========================================================================
-- workspaces: replace the private-only policy from migration 3 with one that
-- also covers family workspaces the caller belongs to. can_access_workspace()
-- already branches ownership OR membership, so a single policy is enough.
drop policy if exists workspaces_select_own_private on public.workspaces;
drop policy if exists workspaces_select_accessible on public.workspaces;
create policy workspaces_select_accessible
  on public.workspaces
  for select
  to authenticated
  using (public.can_access_workspace(id, auth.uid()));

-- workspace_members: a member may read the membership rows of any family
-- workspace they belong to (needed to render "who is in this family" and the
-- caller's own role). Routed through the SECURITY DEFINER helper: it reads
-- workspace_members as the function owner (which bypasses RLS), so this
-- policy does not recurse. No INSERT/UPDATE/DELETE policy — those verbs have
-- no grant for authenticated and no policy, so they are fully closed.
drop policy if exists workspace_members_select_family on public.workspace_members;
create policy workspace_members_select_family
  on public.workspace_members
  for select
  to authenticated
  using (public.can_access_workspace(workspace_id, auth.uid()));


-- =========================================================================
-- 3. Owner-check helper
-- =========================================================================
-- True only when p_uid holds an 'owner' membership row on a FAMILY workspace.
-- Used by every mutating RPC below. SECURITY DEFINER + pinned empty
-- search_path + fully schema-qualified, per the project's hardening rules.
-- Locked down entirely: the mutating RPCs are themselves SECURITY DEFINER and
-- can call this regardless of grants, so no role needs EXECUTE.
create or replace function public.is_family_workspace_owner(
  p_workspace_id uuid,
  p_uid uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members as wm
    join public.workspaces as w on w.id = wm.workspace_id
    where wm.workspace_id = p_workspace_id
      and wm.profile_id = p_uid
      and wm.role = 'owner'::public.family_role
      and w.type = 'family'::public.workspace_type
  );
$$;

revoke execute on function public.is_family_workspace_owner(uuid, uuid) from public;
revoke execute on function public.is_family_workspace_owner(uuid, uuid) from anon;
revoke execute on function public.is_family_workspace_owner(uuid, uuid) from authenticated;


-- =========================================================================
-- 4. create_family_workspace
-- =========================================================================
-- Atomic: the workspace row and the creator's 'owner' membership are both
-- inserted in one function body (one transaction) or neither is. The
-- family-only membership trigger (§16 of the initial schema) is AFTER INSERT
-- DEFERRABLE INITIALLY IMMEDIATE, so workspace-then-member ordering is fine.
create or replace function public.create_family_workspace(p_name text)
returns table (
  workspace_id uuid,
  blocked_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_workspace_id uuid;
begin
  if v_uid is null then
    return query select null::uuid, 'not_authenticated'::text;
    return;
  end if;

  -- workspace_members.profile_id FKs to profiles; without a profile row the
  -- membership insert would raise foreign_key_violation.
  if not exists (select 1 from public.profiles as p where p.id = v_uid) then
    return query select null::uuid, 'profile_not_provisioned'::text;
    return;
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if v_name = '' or char_length(v_name) > 120 then
    return query select null::uuid, 'invalid_name'::text;
    return;
  end if;

  insert into public.workspaces (type, name, owner_profile_id)
  values ('family'::public.workspace_type, v_name, null)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, profile_id, role)
  values (v_workspace_id, v_uid, 'owner'::public.family_role);

  return query select v_workspace_id, null::text;
exception
  when insufficient_privilege then
    return query select null::uuid, 'permission_denied'::text;
end;
$$;

revoke execute on function public.create_family_workspace(text) from public;
revoke execute on function public.create_family_workspace(text) from anon;
grant execute on function public.create_family_workspace(text) to authenticated;

comment on function public.create_family_workspace(text) is
  'Create a family workspace (owner_profile_id null) and the creating user''s owner membership atomically. Derives the user from auth.uid().';


-- =========================================================================
-- 5. family_member_list
-- =========================================================================
-- The only path by which one family member sees another member's identity.
-- Returns safe public fields only. A leading blocked_reason row (all other
-- columns null) is returned when the caller is not a member.
create or replace function public.family_member_list(p_workspace_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_url text,
  role public.family_role,
  joined_at timestamptz,
  blocked_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return query
      select null::uuid, null::text, null::text,
             null::public.family_role, null::timestamptz, 'not_authenticated'::text;
    return;
  end if;

  if not exists (
    select 1
    from public.workspace_members as wm
    where wm.workspace_id = p_workspace_id
      and wm.profile_id = v_uid
  ) then
    return query
      select null::uuid, null::text, null::text,
             null::public.family_role, null::timestamptz, 'not_a_member'::text;
    return;
  end if;

  return query
    select p.id, p.display_name, p.avatar_url, wm.role, wm.joined_at, null::text
    from public.workspace_members as wm
    join public.profiles as p on p.id = wm.profile_id
    where wm.workspace_id = p_workspace_id
    order by wm.role, wm.joined_at;
end;
$$;

revoke execute on function public.family_member_list(uuid) from public;
revoke execute on function public.family_member_list(uuid) from anon;
grant execute on function public.family_member_list(uuid) to authenticated;

comment on function public.family_member_list(uuid) is
  'List family workspace members (profile id, display_name, avatar_url, role, joined_at) for a caller who belongs to that workspace. Never returns line_user_id/email/notification_prefs.';


-- =========================================================================
-- 6. add_family_member_by_line_user_id
-- =========================================================================
-- MVP: add an already-registered FamKeep user by their exact LINE user id.
-- No invitation links. Owner-only. The p_line_user_id value is used for a
-- single equality lookup and is never returned or logged by this function.
create or replace function public.add_family_member_by_line_user_id(
  p_workspace_id uuid,
  p_line_user_id text
)
returns table (
  profile_id uuid,
  blocked_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_line text;
  v_target uuid;
begin
  if v_uid is null then
    return query select null::uuid, 'not_authenticated'::text;
    return;
  end if;

  if not public.is_family_workspace_owner(p_workspace_id, v_uid) then
    return query select null::uuid, 'not_owner'::text;
    return;
  end if;

  v_line := btrim(coalesce(p_line_user_id, ''));
  if v_line = '' then
    return query select null::uuid, 'invalid_line_user_id'::text;
    return;
  end if;

  select p.id into v_target
  from public.profiles as p
  where p.line_user_id = v_line;

  if v_target is null then
    return query select null::uuid, 'profile_not_found'::text;
    return;
  end if;

  if exists (
    select 1
    from public.workspace_members as wm
    where wm.workspace_id = p_workspace_id
      and wm.profile_id = v_target
  ) then
    return query select null::uuid, 'already_member'::text;
    return;
  end if;

  insert into public.workspace_members (workspace_id, profile_id, role)
  values (p_workspace_id, v_target, 'member'::public.family_role);

  return query select v_target, null::text;
exception
  when unique_violation then
    return query select null::uuid, 'already_member'::text;
  when insufficient_privilege then
    return query select null::uuid, 'permission_denied'::text;
end;
$$;

revoke execute on function public.add_family_member_by_line_user_id(uuid, text) from public;
revoke execute on function public.add_family_member_by_line_user_id(uuid, text) from anon;
grant execute on function public.add_family_member_by_line_user_id(uuid, text) to authenticated;

comment on function public.add_family_member_by_line_user_id(uuid, text) is
  'Owner-only: add an existing registered FamKeep user (matched by exact line_user_id) to a family workspace as a member. Does not return or log the line_user_id.';


-- =========================================================================
-- 7. remove_family_member
-- =========================================================================
-- Owner-only. Locks the parent workspace row before counting owners so two
-- concurrent removals cannot both pass the last-owner check.
create or replace function public.remove_family_member(
  p_workspace_id uuid,
  p_profile_id uuid
)
returns table (
  blocked_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target_role public.family_role;
  v_owner_count int;
begin
  if v_uid is null then
    return query select 'not_authenticated'::text;
    return;
  end if;

  -- Serialize every owner-count check on this workspace on one row lock,
  -- acquired BEFORE the owner check reads membership, so two concurrent
  -- removals cannot both observe the pre-removal owner count.
  perform 1 from public.workspaces as w where w.id = p_workspace_id for update;

  if not public.is_family_workspace_owner(p_workspace_id, v_uid) then
    return query select 'not_owner'::text;
    return;
  end if;

  select wm.role into v_target_role
  from public.workspace_members as wm
  where wm.workspace_id = p_workspace_id
    and wm.profile_id = p_profile_id;

  if v_target_role is null then
    return query select 'not_a_member'::text;
    return;
  end if;

  if v_target_role = 'owner'::public.family_role then
    select count(*) into v_owner_count
    from public.workspace_members as wm
    where wm.workspace_id = p_workspace_id
      and wm.role = 'owner'::public.family_role;

    if v_owner_count <= 1 then
      return query select 'last_owner'::text;
      return;
    end if;
  end if;

  delete from public.workspace_members
  where workspace_id = p_workspace_id
    and profile_id = p_profile_id;

  return query select null::text;
exception
  when insufficient_privilege then
    return query select 'permission_denied'::text;
end;
$$;

revoke execute on function public.remove_family_member(uuid, uuid) from public;
revoke execute on function public.remove_family_member(uuid, uuid) from anon;
grant execute on function public.remove_family_member(uuid, uuid) to authenticated;

comment on function public.remove_family_member(uuid, uuid) is
  'Owner-only: remove a member from a family workspace. Refuses to remove the last owner.';


-- =========================================================================
-- 8. set_family_member_role
-- =========================================================================
-- Owner-only. Same parent-row lock as remove_family_member. Refuses to demote
-- the last owner.
create or replace function public.set_family_member_role(
  p_workspace_id uuid,
  p_profile_id uuid,
  p_role public.family_role
)
returns table (
  blocked_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_current_role public.family_role;
  v_owner_count int;
begin
  if v_uid is null then
    return query select 'not_authenticated'::text;
    return;
  end if;

  -- Same lock-before-check ordering as remove_family_member.
  perform 1 from public.workspaces as w where w.id = p_workspace_id for update;

  if not public.is_family_workspace_owner(p_workspace_id, v_uid) then
    return query select 'not_owner'::text;
    return;
  end if;

  select wm.role into v_current_role
  from public.workspace_members as wm
  where wm.workspace_id = p_workspace_id
    and wm.profile_id = p_profile_id;

  if v_current_role is null then
    return query select 'not_a_member'::text;
    return;
  end if;

  if v_current_role = p_role then
    return query select null::text;
    return;
  end if;

  if v_current_role = 'owner'::public.family_role
     and p_role = 'member'::public.family_role then
    select count(*) into v_owner_count
    from public.workspace_members as wm
    where wm.workspace_id = p_workspace_id
      and wm.role = 'owner'::public.family_role;

    if v_owner_count <= 1 then
      return query select 'last_owner'::text;
      return;
    end if;
  end if;

  update public.workspace_members
  set role = p_role
  where workspace_id = p_workspace_id
    and profile_id = p_profile_id;

  return query select null::text;
exception
  when insufficient_privilege then
    return query select 'permission_denied'::text;
end;
$$;

revoke execute on function public.set_family_member_role(uuid, uuid, public.family_role) from public;
revoke execute on function public.set_family_member_role(uuid, uuid, public.family_role) from anon;
grant execute on function public.set_family_member_role(uuid, uuid, public.family_role) to authenticated;

comment on function public.set_family_member_role(uuid, uuid, public.family_role) is
  'Owner-only: change a member''s role in a family workspace. Refuses to demote the last owner.';


-- =========================================================================
-- 9. Last-owner backstop trigger
-- =========================================================================
-- The RPCs above already enforce "at least one owner", but they are not the
-- only writer (service_role, future admin tooling). This trigger is the hard
-- guarantee. It fires BEFORE DELETE and BEFORE UPDATE OF role.
--
-- Escape hatch: when the parent workspace row is already gone in this
-- transaction (a cascade delete of the whole workspace), the check is
-- skipped, so deleting a family workspace is never permanently blocked.
--
-- Plain (non-definer) trigger function, matching enforce_family_only_membership
-- in the initial schema. The only writers that reach it are the SECURITY
-- DEFINER RPCs (running as the definer, which bypasses RLS) and service_role
-- (which bypasses RLS), so the owner count it reads is always complete.
create or replace function public.enforce_family_owner_retained()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner_count int;
begin
  -- Not touching an owner row -> the owner set is unchanged.
  if old.role <> 'owner'::public.family_role then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- UPDATE that leaves the row as owner -> owner set unchanged.
  if tg_op = 'UPDATE' and new.role = 'owner'::public.family_role then
    return new;
  end if;

  -- Whole workspace being deleted (cascade) -> allow.
  if not exists (
    select 1 from public.workspaces as w where w.id = old.workspace_id
  ) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select count(*) into v_owner_count
  from public.workspace_members as wm
  where wm.workspace_id = old.workspace_id
    and wm.role = 'owner'::public.family_role;

  if v_owner_count <= 1 then
    raise exception
      'cannot remove or demote the last owner of family workspace %', old.workspace_id
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_workspace_members_owner_retained on public.workspace_members;
create trigger trg_workspace_members_owner_retained
  before delete or update of role on public.workspace_members
  for each row
  execute function public.enforce_family_owner_retained();
