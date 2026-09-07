-- Web image upload: resolve the target workspace for the uploader.
--
-- In this project service_role has no table-level DML on public tables; every
-- backend read goes through a SECURITY DEFINER RPC. The file-upload Edge
-- Function was querying public.workspaces directly and hitting
-- "permission denied for table workspaces", so it always reported
-- workspace_not_found. This RPC replaces that direct query.

create or replace function public.web_upload_workspace_id(
  p_actor_profile_id uuid,
  p_choice text
)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when p_choice = 'family' then (
      select m.workspace_id
      from public.workspace_members m
      join public.workspaces w on w.id = m.workspace_id
      where m.profile_id = p_actor_profile_id
        and w.type = 'family'
      order by m.joined_at
      limit 1
    )
    else (
      select w.id
      from public.workspaces w
      where w.type = 'private'
        and w.owner_profile_id = p_actor_profile_id
      limit 1
    )
  end;
$$;

revoke all on function public.web_upload_workspace_id(uuid, text)
  from public, anon, authenticated;
grant execute on function public.web_upload_workspace_id(uuid, text)
  to service_role;
