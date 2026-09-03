-- Phase 7.2D: provision one private workspace per authenticated LINE user
-- and add the minimum profile/private-workspace RLS access policies.
--
-- This migration deliberately does not create family workspace onboarding,
-- workspace_members rows, broad table INSERT policies, or policies for the
-- remaining application tables.

create or replace function public.provision_current_line_profile()
returns table (
  profile_provisioned boolean,
  profile_id_matches_auth_user boolean,
  profile_line_user_id_matches_line_sub boolean,
  blocked_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_identity_data jsonb;
  v_line_user_id text;
  v_display_name text;
  v_avatar_url text;
  v_email text;
  v_existing_profile_id uuid;
begin
  if v_uid is null then
    return query select false, false, false, 'not_authenticated'::text;
    return;
  end if;

  select i.identity_data
    into v_identity_data
  from auth.identities as i
  where i.user_id = v_uid
    and lower(i.provider) = 'custom:line'
    and jsonb_typeof(i.identity_data) = 'object'
    and nullif(btrim(i.identity_data ->> 'sub'), '') is not null
  order by i.created_at asc
  limit 1;

  v_line_user_id := nullif(btrim(v_identity_data ->> 'sub'), '');

  if v_line_user_id is null then
    return query select false, false, false, 'missing_line_sub'::text;
    return;
  end if;

  v_display_name := nullif(btrim(v_identity_data ->> 'name'), '');
  if v_display_name is not null then
    v_display_name := left(v_display_name, 200);
  end if;

  v_avatar_url := nullif(btrim(v_identity_data ->> 'picture'), '');
  if v_avatar_url is not null
    and (
      length(v_avatar_url) > 2048
      or v_avatar_url !~* '^https?://'
    )
  then
    v_avatar_url := null;
  end if;

  select nullif(btrim(u.email), '')
    into v_email
  from auth.users as u
  where u.id = v_uid;

  if v_email is not null then
    v_email := left(v_email, 320);
  end if;

  select p.id
    into v_existing_profile_id
  from public.profiles as p
  where p.line_user_id = v_line_user_id;

  if v_existing_profile_id is not null and v_existing_profile_id <> v_uid then
    return query select false, false, false, 'line_sub_already_linked'::text;
    return;
  end if;

  insert into public.profiles (
    id,
    line_user_id,
    display_name,
    avatar_url,
    email
  )
  values (
    v_uid,
    v_line_user_id,
    v_display_name,
    v_avatar_url,
    v_email
  )
  on conflict (id) do update
    set line_user_id = excluded.line_user_id,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        email = excluded.email;

  insert into public.workspaces (
    type,
    name,
    owner_profile_id
  )
  values (
    'private'::public.workspace_type,
    'ส่วนตัว',
    v_uid
  )
  on conflict (owner_profile_id)
    where type = 'private'::public.workspace_type
    do nothing;

  return query
    select
      exists (
        select 1
        from public.profiles as p
        where p.id = v_uid
      ),
      exists (
        select 1
        from public.profiles as p
        where p.id = v_uid
      ),
      exists (
        select 1
        from public.profiles as p
        where p.id = v_uid
          and p.line_user_id = v_line_user_id
      ),
      null::text;
exception
  when unique_violation then
    return query select false, false, false, 'profile_or_workspace_unique_conflict'::text;
  when insufficient_privilege then
    return query select false, false, false, 'profile_or_workspace_permission_denied'::text;
end;
$$;

revoke execute on function public.provision_current_line_profile() from public;
revoke execute on function public.provision_current_line_profile() from anon;
grant execute on function public.provision_current_line_profile() to authenticated;

comment on function public.provision_current_line_profile() is
  'Provision or refresh the current authenticated LINE user profile and exactly one private workspace without trusting client-supplied identity fields.';

revoke all on public.profiles from public;
revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, email, notification_prefs)
  on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke all on public.workspaces from public;
revoke all on public.workspaces from anon;
revoke all on public.workspaces from authenticated;
grant select on public.workspaces to authenticated;

drop policy if exists workspaces_select_own_private on public.workspaces;
create policy workspaces_select_own_private
  on public.workspaces
  for select
  to authenticated
  using (
    type = 'private'::public.workspace_type
    and owner_profile_id = auth.uid()
  );
