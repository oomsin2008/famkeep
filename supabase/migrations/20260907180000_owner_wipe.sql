-- "Factory reset" for the family owner: wipe files / tasks across the caller's
-- own private workspace and every family workspace they belong to. Soft-delete
-- only (deleted_at); the Drive originals are moved by the file-delete Edge
-- Function, driven from the server action.

-- True when the caller holds the owner role in some family workspace.
create or replace function public.is_family_owner()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where w.type = 'family'
      and wm.profile_id = auth.uid()
      and wm.role = 'owner'
  );
$$;

revoke all on function public.is_family_owner() from public, anon;
grant execute on function public.is_family_owner() to authenticated;

-- Soft-delete every task in the caller's private + family workspaces.
-- Family-owner only. Returns the number of rows affected, or -1 when blocked.
create or replace function public.owner_wipe_tasks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
begin
  if v_uid is null or not public.is_family_owner() then
    return -1;
  end if;

  with deleted as (
    update public.tasks t
    set deleted_at = now()
    from public.workspaces w
    where w.id = t.workspace_id
      and t.deleted_at is null
      and (
        (w.type = 'private' and w.owner_profile_id = v_uid)
        or (
          w.type = 'family'
          and exists (
            select 1 from public.workspace_members wm
            where wm.workspace_id = w.id and wm.profile_id = v_uid
          )
        )
      )
    returning 1
  )
  select count(*) into v_count from deleted;

  return v_count;
end;
$$;

revoke all on function public.owner_wipe_tasks() from public, anon;
grant execute on function public.owner_wipe_tasks() to authenticated;
