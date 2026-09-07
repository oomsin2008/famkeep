-- Web/PWA file rename.
--
-- Browser calls an Edge Function with the user's session token. The function
-- uses these service-role RPCs to fetch the backend-only Drive id and then
-- update metadata only when the same user can access the file.

create or replace function public.prepare_file_rename(
  p_actor_profile_id uuid,
  p_file_id uuid
)
returns table (file_id uuid, name text, drive_file_id text, blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file_id uuid;
  v_name text;
  v_drive_file_id text;
begin
  if p_actor_profile_id is null then
    return query select null::uuid, null::text, null::text, 'actor_unknown'::text;
    return;
  end if;

  select f.id, f.name, f.drive_file_id
  into v_file_id, v_name, v_drive_file_id
  from public.files f
  where f.id = p_file_id
    and f.deleted_at is null
    and public.can_access_file(f.id, p_actor_profile_id)
  limit 1;

  if v_file_id is null then
    return query select null::uuid, null::text, null::text, 'not_found'::text;
    return;
  end if;

  if nullif(btrim(coalesce(v_drive_file_id, '')), '') is null then
    return query select v_file_id, v_name, null::text, 'missing_drive_file'::text;
    return;
  end if;

  return query select v_file_id, v_name, v_drive_file_id, null::text;
end;
$$;

create or replace function public.rename_file_metadata_from_web(
  p_actor_profile_id uuid,
  p_file_id uuid,
  p_new_name text
)
returns table (file_id uuid, blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_new_name, ''));
  v_file uuid;
begin
  if p_actor_profile_id is null then
    return query select null::uuid, 'actor_unknown'::text; return;
  end if;
  if v_name = '' or char_length(v_name) > 300 then
    return query select null::uuid, 'invalid_name'::text; return;
  end if;

  update public.files f
  set name = v_name, updated_at = now()
  where f.id = p_file_id
    and f.deleted_at is null
    and public.can_access_file(f.id, p_actor_profile_id)
  returning f.id into v_file;

  if v_file is null then
    return query select null::uuid, 'not_found'::text; return;
  end if;

  return query select v_file, null::text;
end;
$$;

revoke execute on function public.prepare_file_rename(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.rename_file_metadata_from_web(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.prepare_file_rename(uuid, uuid) to service_role;
grant execute on function public.rename_file_metadata_from_web(uuid, uuid, text)
  to service_role;
