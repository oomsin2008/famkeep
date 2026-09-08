-- Android voice input often splits a Thai name ("สม ชาย" for "สมชาย").
-- resolve_family_member_by_name keeps its exact + unique-prefix matches, then
-- retries both with all spaces removed on each side before giving up.
create or replace function public.resolve_family_member_by_name(
  p_workspace_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := lower(btrim(coalesce(p_name, '')));
  v_bare text := replace(lower(btrim(coalesce(p_name, ''))), ' ', '');
  v_id uuid;
  v_ids uuid[];
begin
  if v_name = '' then
    return null;
  end if;

  select p.id into v_id
  from public.workspace_members m
  join public.profiles p on p.id = m.profile_id
  where m.workspace_id = p_workspace_id
    and lower(btrim(coalesce(p.display_name, ''))) = v_name
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select array_agg(p.id) into v_ids
  from public.workspace_members m
  join public.profiles p on p.id = m.profile_id
  where m.workspace_id = p_workspace_id
    and lower(btrim(coalesce(p.display_name, ''))) like v_name || '%';
  if array_length(v_ids, 1) = 1 then
    return v_ids[1];
  end if;

  -- space-insensitive exact
  select p.id into v_id
  from public.workspace_members m
  join public.profiles p on p.id = m.profile_id
  where m.workspace_id = p_workspace_id
    and replace(lower(btrim(coalesce(p.display_name, ''))), ' ', '') = v_bare
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  -- space-insensitive unique prefix
  select array_agg(p.id) into v_ids
  from public.workspace_members m
  join public.profiles p on p.id = m.profile_id
  where m.workspace_id = p_workspace_id
    and replace(lower(btrim(coalesce(p.display_name, ''))), ' ', '')
        like v_bare || '%';
  if array_length(v_ids, 1) = 1 then
    return v_ids[1];
  end if;

  return null;
end;
$$;

revoke execute on function public.resolve_family_member_by_name(uuid, text)
  from public, anon, authenticated;
grant execute on function public.resolve_family_member_by_name(uuid, text)
  to service_role;
