-- Web/PWA image upload after offline OCR.
--
-- OCR happens entirely in the browser before this RPC is called. This RPC only
-- persists metadata for a user-confirmed upload whose bytes have already been
-- stored in Google Drive by the file-upload Edge Function.

create or replace function public.create_file_from_web_upload(
  p_workspace_id uuid,
  p_actor_profile_id uuid,
  p_name text,
  p_kind text,
  p_size_bytes bigint,
  p_drive_file_id text
)
returns table (file_id uuid, blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_drive text := nullif(btrim(coalesce(p_drive_file_id, '')), '');
  v_file uuid;
begin
  if p_actor_profile_id is null then
    return query select null::uuid, 'actor_unknown'::text; return;
  end if;
  if not public.can_access_workspace(p_workspace_id, p_actor_profile_id) then
    return query select null::uuid, 'no_workspace_access'::text; return;
  end if;
  if v_name = '' or char_length(v_name) > 300 then
    return query select null::uuid, 'invalid_name'::text; return;
  end if;
  if p_kind not in ('pdf', 'image', 'doc', 'other') then
    return query select null::uuid, 'invalid_kind'::text; return;
  end if;
  if v_drive is null then
    return query select null::uuid, 'missing_drive_file'::text; return;
  end if;

  insert into public.files (
    workspace_id, name, kind, size_bytes, saved_by_profile_id,
    saved_via_line, drive_file_id, line_message_id
  )
  values (
    p_workspace_id, v_name, p_kind, greatest(coalesce(p_size_bytes, 0), 0),
    p_actor_profile_id, false, v_drive, null
  )
  returning id into v_file;

  return query select v_file, null::text;
exception
  when unique_violation then
    return query select null::uuid, 'already_saved'::text;
end;
$$;

revoke execute on function public.create_file_from_web_upload(uuid, uuid, text, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.create_file_from_web_upload(uuid, uuid, text, text, bigint, text)
  to service_role;

create or replace function public.latest_file_for_line_rename(
  p_actor_profile_id uuid
)
returns table (file_id uuid, name text, drive_file_id text, blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_profile_id is null then
    return query select null::uuid, null::text, null::text, 'actor_unknown'::text;
    return;
  end if;

  return query
    select f.id, f.name, f.drive_file_id, null::text
    from public.files f
    where f.saved_by_profile_id = p_actor_profile_id
      and f.deleted_at is null
      and f.created_at > now() - interval '24 hours'
    order by f.created_at desc
    limit 1;

  if not found then
    return query select null::uuid, null::text, null::text, 'not_found'::text;
  end if;
end;
$$;

create or replace function public.rename_file_metadata_from_line(
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
    and f.saved_by_profile_id = p_actor_profile_id
    and f.deleted_at is null
  returning f.id into v_file;

  if v_file is null then
    return query select null::uuid, 'not_found'::text; return;
  end if;

  return query select v_file, null::text;
end;
$$;

revoke execute on function public.latest_file_for_line_rename(uuid)
  from public, anon, authenticated;
revoke execute on function public.rename_file_metadata_from_line(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.latest_file_for_line_rename(uuid) to service_role;
grant execute on function public.rename_file_metadata_from_line(uuid, uuid, text) to service_role;
