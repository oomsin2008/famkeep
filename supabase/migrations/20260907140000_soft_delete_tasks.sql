-- Task deletion (soft). Reverses the earlier "no delete task in MVP" decision,
-- at the user's request. deleted_at already exists on public.tasks and every
-- read path filters `deleted_at is null`; enqueue_due_reminders also filters it,
-- so a deleted task's pending reminders stop on their own.

-- Single task: authorize with can_access_task, same shape as set_task_lifecycle.
create or replace function public.soft_delete_task(p_task_id uuid)
returns table(blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return query select 'not_authenticated'::text; return;
  end if;
  if not public.can_access_task(p_task_id, v_uid) then
    return query select 'no_task_access'::text; return;
  end if;

  update public.tasks
  set deleted_at = now()
  where id = p_task_id and deleted_at is null;

  return query select null::text;
end;
$$;

revoke all on function public.soft_delete_task(uuid) from public, anon;
grant execute on function public.soft_delete_task(uuid) to authenticated;

-- Bulk: every task (any lifecycle status) in the caller's own private workspace.
create or replace function public.soft_delete_all_my_tasks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ws uuid;
  v_count integer := 0;
begin
  if v_uid is null then
    return 0;
  end if;

  select id into v_ws
  from public.workspaces
  where type = 'private' and owner_profile_id = v_uid
  limit 1;

  if v_ws is null then
    return 0;
  end if;

  with deleted as (
    update public.tasks
    set deleted_at = now()
    where workspace_id = v_ws and deleted_at is null
    returning 1
  )
  select count(*) into v_count from deleted;

  return v_count;
end;
$$;

revoke all on function public.soft_delete_all_my_tasks() from public, anon;
grant execute on function public.soft_delete_all_my_tasks() to authenticated;
