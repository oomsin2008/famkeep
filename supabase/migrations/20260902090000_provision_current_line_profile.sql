-- Phase 7.2C: provision the authenticated user's FamKeep profile from LINE.
--
-- This intentionally adds no broad RLS policies. The function derives the
-- LINE subject from Supabase Auth's server-owned auth.identities table using
-- auth.uid(), so callers cannot supply or overwrite line_user_id themselves.

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
    return query select false, false, false, 'profile_unique_conflict'::text;
  when insufficient_privilege then
    return query select false, false, false, 'profile_permission_denied'::text;
end;
$$;

revoke execute on function public.provision_current_line_profile() from public;
revoke execute on function public.provision_current_line_profile() from anon;
grant execute on function public.provision_current_line_profile() to authenticated;

comment on function public.provision_current_line_profile() is
  'Provision or refresh the current authenticated LINE user profile without trusting client-supplied LINE identity fields.';
