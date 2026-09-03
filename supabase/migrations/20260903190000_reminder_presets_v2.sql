-- Phase 7.6: reminder preset vocabulary v2.
--
-- OLD presets: one_day_before | three_hours_before | morning_of_due
-- NEW presets: at_due_time | ten_minutes_before | one_day_before | morning_of_due
--
--   at_due_time        scheduled_at = due_at
--   ten_minutes_before scheduled_at = due_at - interval '10 minutes'
--   one_day_before     scheduled_at = due_at - interval '24 hours'   (unchanged)
--   morning_of_due     scheduled_at = 09:00 Asia/Bangkok on the due date (unchanged)
--
-- three_hours_before is removed. Existing rows are migrated to
-- ten_minutes_before when that does not collide with UNIQUE(task_id, preset);
-- any that would collide are deleted (all such rows are disposable test data).
--
-- The 0-2 cap, slot IN (1,2), UNIQUE(task_id, slot) and UNIQUE(task_id, preset)
-- are unchanged.


-- =========================================================================
-- 1. Drop the old preset CHECK so legacy rows can be migrated
-- =========================================================================
alter table public.task_reminders drop constraint task_reminders_preset_check;


-- =========================================================================
-- 2. Migrate legacy three_hours_before rows
-- =========================================================================
update public.task_reminders tr
set preset = 'ten_minutes_before'
where tr.preset = 'three_hours_before'
  and not exists (
    select 1 from public.task_reminders x
    where x.task_id = tr.task_id and x.preset = 'ten_minutes_before'
  );

-- Any remaining three_hours_before row would collide on UNIQUE(task_id, preset);
-- none exist on real data (only disposable test rows), so this is a safe cleanup.
delete from public.task_reminders where preset = 'three_hours_before';


-- =========================================================================
-- 3. Re-add the preset CHECK with the new vocabulary
-- =========================================================================
alter table public.task_reminders
  add constraint task_reminders_preset_check
  check (preset in ('at_due_time', 'ten_minutes_before', 'one_day_before', 'morning_of_due'));


-- =========================================================================
-- 4. Schedule math for the new presets
-- =========================================================================
create or replace function public.compute_reminder_scheduled_at(
  p_preset text,
  p_due_at timestamptz
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case p_preset
    when 'at_due_time'        then p_due_at
    when 'ten_minutes_before' then p_due_at - interval '10 minutes'
    when 'one_day_before'     then p_due_at - interval '24 hours'
    when 'morning_of_due'     then
      ((p_due_at at time zone 'Asia/Bangkok')::date + time '09:00')
        at time zone 'Asia/Bangkok'
    else null
  end;
$$;

revoke execute on function public.compute_reminder_scheduled_at(text, timestamptz) from public;
revoke execute on function public.compute_reminder_scheduled_at(text, timestamptz) from anon;
revoke execute on function public.compute_reminder_scheduled_at(text, timestamptz) from authenticated;


-- =========================================================================
-- 5. create_task: accept the new preset vocabulary
-- =========================================================================
create or replace function public.create_task(
  p_workspace_id uuid,
  p_title text,
  p_notes text,
  p_assignee_profile_id uuid,
  p_due_at timestamptz,
  p_reminder_presets text[]
)
returns table (task_id uuid, blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_title text;
  v_notes text;
  v_ws_type public.workspace_type;
  v_task_id uuid;
  v_presets text[];
  v_preset text;
  v_slot smallint;
begin
  if v_uid is null then
    return query select null::uuid, 'not_authenticated'::text; return;
  end if;

  if not public.can_access_workspace(p_workspace_id, v_uid) then
    return query select null::uuid, 'no_workspace_access'::text; return;
  end if;

  select w.type into v_ws_type from public.workspaces w where w.id = p_workspace_id;

  v_title := btrim(coalesce(p_title, ''));
  if v_title = '' or char_length(v_title) > 200 then
    return query select null::uuid, 'invalid_title'::text; return;
  end if;

  v_notes := coalesce(p_notes, '');
  if char_length(v_notes) > 5000 then
    return query select null::uuid, 'invalid_notes'::text; return;
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
      where m.workspace_id = p_workspace_id
        and m.profile_id = p_assignee_profile_id
    )
  then
    return query select null::uuid, 'assignee_not_family_member'::text; return;
  end if;

  select array_agg(distinct e order by e) into v_presets
  from unnest(coalesce(p_reminder_presets, '{}'::text[])) as t(e);
  v_presets := coalesce(v_presets, '{}'::text[]);

  if coalesce(array_length(v_presets, 1), 0) > 2 then
    return query select null::uuid, 'too_many_reminders'::text; return;
  end if;

  foreach v_preset in array v_presets loop
    if v_preset not in ('at_due_time', 'ten_minutes_before', 'one_day_before', 'morning_of_due') then
      return query select null::uuid, 'invalid_reminder_preset'::text; return;
    end if;
  end loop;

  insert into public.tasks (
    workspace_id, title, notes, assignee_profile_id, due_at,
    lifecycle_status, created_by_profile_id, created_via
  )
  values (
    p_workspace_id, v_title, v_notes,
    case when v_ws_type = 'family' then p_assignee_profile_id else null end,
    p_due_at, 'open'::public.task_lifecycle_status, v_uid, 'app'
  )
  returning id into v_task_id;

  v_slot := 1;
  foreach v_preset in array v_presets loop
    insert into public.task_reminders (task_id, slot, preset, scheduled_at, status)
    values (
      v_task_id, v_slot, v_preset,
      public.compute_reminder_scheduled_at(v_preset, p_due_at),
      'pending'
    );
    v_slot := v_slot + 1;
  end loop;

  return query select v_task_id, null::text;
exception
  when unique_violation then
    return query select null::uuid, 'task_conflict'::text;
  when check_violation then
    return query select null::uuid, 'task_constraint_violation'::text;
  when insufficient_privilege then
    return query select null::uuid, 'permission_denied'::text;
end;
$$;

revoke execute on function public.create_task(uuid, text, text, uuid, timestamptz, text[]) from public;
revoke execute on function public.create_task(uuid, text, text, uuid, timestamptz, text[]) from anon;
grant execute on function public.create_task(uuid, text, text, uuid, timestamptz, text[]) to authenticated;


-- =========================================================================
-- 6. add_task_reminder: accept the new preset vocabulary
-- =========================================================================
create or replace function public.add_task_reminder(
  p_task_id uuid,
  p_preset text
)
returns table (blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_due timestamptz;
  v_slot smallint;
begin
  if v_uid is null then
    return query select 'not_authenticated'::text; return;
  end if;
  if not public.can_access_task(p_task_id, v_uid) then
    return query select 'no_task_access'::text; return;
  end if;
  if p_preset not in ('at_due_time', 'ten_minutes_before', 'one_day_before', 'morning_of_due') then
    return query select 'invalid_reminder_preset'::text; return;
  end if;

  -- serialize concurrent adds for this task so slot picking is race-free
  perform 1 from public.tasks where id = p_task_id for update;

  select due_at into v_due from public.tasks where id = p_task_id;

  if exists (
    select 1 from public.task_reminders
    where task_id = p_task_id and preset = p_preset
  ) then
    return query select 'duplicate_reminder'::text; return;
  end if;

  select v.s into v_slot
  from (values (1::smallint), (2::smallint)) as v(s)
  where v.s not in (
    select tr.slot from public.task_reminders tr where tr.task_id = p_task_id
  )
  order by v.s
  limit 1;

  if v_slot is null then
    return query select 'too_many_reminders'::text; return;
  end if;

  insert into public.task_reminders (task_id, slot, preset, scheduled_at, status)
  values (
    p_task_id, v_slot, p_preset,
    public.compute_reminder_scheduled_at(p_preset, v_due),
    'pending'
  );

  return query select null::text;
exception
  when unique_violation then
    return query select 'reminder_conflict'::text;
  when check_violation then
    return query select 'reminder_conflict'::text;
end;
$$;

revoke execute on function public.add_task_reminder(uuid, text) from public;
revoke execute on function public.add_task_reminder(uuid, text) from anon;
grant execute on function public.add_task_reminder(uuid, text) to authenticated;
