-- LINE task flow, at the user's request:
--   1. #งาน now auto-adds an at_due_time reminder (slot 1) so every task made
--      from LINE pings at its due time without opening the web app.
--   2. set_task_lifecycle_from_line backs a "Done" postback button on the bot's
--      Flex bubbles.

-- 1. create_task_from_line: same authorization + task insert as before, plus the
--    reminder row. compute_reminder_scheduled_at('at_due_time', due) = due.
create or replace function public.create_task_from_line(
  p_actor_profile_id uuid,
  p_workspace_id uuid,
  p_title text,
  p_notes text,
  p_assignee_profile_id uuid,
  p_due_at timestamptz
)
returns table (task_id uuid, blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_ws_type public.workspace_type;
  v_task_id uuid;
begin
  if p_actor_profile_id is null then
    return query select null::uuid, 'actor_unknown'::text; return;
  end if;
  if not public.can_access_workspace(p_workspace_id, p_actor_profile_id) then
    return query select null::uuid, 'no_workspace_access'::text; return;
  end if;

  select w.type into v_ws_type from public.workspaces w where w.id = p_workspace_id;

  v_title := btrim(coalesce(p_title, ''));
  if v_title = '' or char_length(v_title) > 200 then
    return query select null::uuid, 'invalid_title'::text; return;
  end if;
  if p_due_at is null then
    return query select null::uuid, 'invalid_due_at'::text; return;
  end if;

  if v_ws_type = 'private' then
    if p_assignee_profile_id is not null then
      return query select null::uuid, 'private_assignee_not_allowed'::text; return;
    end if;
  elsif p_assignee_profile_id is not null
    and not exists (
      select 1 from public.workspace_members m
      where m.workspace_id = p_workspace_id and m.profile_id = p_assignee_profile_id
    )
  then
    return query select null::uuid, 'assignee_not_family_member'::text; return;
  end if;

  insert into public.tasks (
    workspace_id, title, notes, assignee_profile_id, due_at,
    lifecycle_status, created_by_profile_id, created_via
  )
  values (
    p_workspace_id, v_title, coalesce(p_notes, ''),
    case when v_ws_type = 'family' then p_assignee_profile_id else null end,
    p_due_at, 'open'::public.task_lifecycle_status, p_actor_profile_id, 'line'
  )
  returning id into v_task_id;

  insert into public.task_reminders (task_id, slot, preset, scheduled_at)
  values (
    v_task_id, 1, 'at_due_time',
    public.compute_reminder_scheduled_at('at_due_time', p_due_at)
  )
  on conflict do nothing;

  return query select v_task_id, null::text;
exception
  when insufficient_privilege then
    return query select null::uuid, 'permission_denied'::text;
end;
$$;

revoke execute on function public.create_task_from_line(uuid, uuid, text, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.create_task_from_line(uuid, uuid, text, text, uuid, timestamptz) to service_role;

-- 2. set_task_lifecycle_from_line: the "Done" button. Service-role only; the
--    actor is passed explicitly (the webhook has no auth.uid()) and authorized
--    with can_access_task, the same rule as the web set_task_lifecycle.
create or replace function public.set_task_lifecycle_from_line(
  p_task_id uuid,
  p_actor_profile_id uuid,
  p_status text
)
returns table (blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_profile_id is null then
    return query select 'actor_unknown'::text; return;
  end if;
  if not public.can_access_task(p_task_id, p_actor_profile_id) then
    return query select 'no_task_access'::text; return;
  end if;
  if p_status not in ('open', 'done', 'cancelled') then
    return query select 'invalid_status'::text; return;
  end if;

  update public.tasks
  set lifecycle_status = p_status::public.task_lifecycle_status
  where id = p_task_id and deleted_at is null;

  return query select null::text;
end;
$$;

revoke execute on function public.set_task_lifecycle_from_line(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_task_lifecycle_from_line(uuid, uuid, text) to service_role;
