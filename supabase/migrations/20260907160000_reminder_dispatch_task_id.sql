-- Add task_id to reminder_dispatch_info so the LINE reminder Flex message can
-- deep-link to /tasks/<id>. Additive column at the end; the only caller is the
-- line-worker Edge Function. Return type changed -> drop + recreate.
drop function if exists public.reminder_dispatch_info(uuid);

create function public.reminder_dispatch_info(p_reminder_id uuid)
 returns table(kind text, line_target text, reason text, task_title text, due_at timestamptz, preset text, task_id uuid)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v record;
  v_line text;
  v_group text;
  v_group_count integer;
  v_kind text := 'none';
  v_target text := null;
  v_reason text := null;
begin
  select t.id, t.workspace_id, t.assignee_profile_id, t.title, t.due_at,
         t.lifecycle_status, t.deleted_at, w.type as ws_type, w.owner_profile_id,
         tr.preset
  into v
  from public.task_reminders tr
  join public.tasks t on t.id = tr.task_id
  join public.workspaces w on w.id = t.workspace_id
  where tr.id = p_reminder_id;

  if v.id is null then
    return query select 'none'::text, null::text, 'reminder_not_found'::text,
                        null::text, null::timestamptz, null::text, null::uuid;
    return;
  end if;

  if v.lifecycle_status <> 'open' or v.deleted_at is not null then
    return query select 'none'::text, null::text, 'task_not_open'::text,
                        v.title, v.due_at, v.preset, v.id;
    return;
  end if;

  if v.ws_type = 'private' then
    select lc.line_source_id into v_line
    from public.line_conversations lc
    where lc.line_source_type = 'user' and lc.approved = true
      and lc.profile_id = v.owner_profile_id;
    if v_line is null then
      v_reason := 'owner_no_line_link';
    else
      v_kind := 'user'; v_target := v_line;
    end if;
  else
    if v.assignee_profile_id is not null then
      select lc.line_source_id into v_line
      from public.line_conversations lc
      where lc.line_source_type = 'user' and lc.approved = true
        and lc.profile_id = v.assignee_profile_id;
    end if;

    if v_line is not null then
      v_kind := 'user'; v_target := v_line;
    else
      select count(*), max(lc.line_source_id) into v_group_count, v_group
      from public.line_conversations lc
      where lc.line_source_type = 'group' and lc.approved = true
        and lc.workspace_id = v.workspace_id;

      if v_group_count = 1 then
        v_kind := 'group'; v_target := v_group;
      else
        v_reason := case when coalesce(v_group_count, 0) = 0
                         then 'no_delivery_target' else 'multiple_groups' end;
      end if;
    end if;
  end if;

  return query select v_kind, v_target, v_reason, v.title, v.due_at, v.preset, v.id;
end;
$function$;

revoke all on function public.reminder_dispatch_info(uuid) from public, anon, authenticated;
grant execute on function public.reminder_dispatch_info(uuid) to service_role;
