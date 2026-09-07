-- Let a signed-in user rename their own profile (display_name only).
-- Column-scoped on purpose: never touches line_user_id / email / avatar_url,
-- so the browser cannot widen the update via the profiles_update_own RLS policy.
create or replace function public.update_own_profile(p_display_name text)
returns table(display_name text, blocked_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if v_uid is null then
    return query select null::text, 'not_authenticated'::text;
    return;
  end if;
  if char_length(v_name) < 1 then
    return query select null::text, 'empty_name'::text;
    return;
  end if;
  if char_length(v_name) > 60 then
    v_name := left(v_name, 60);
  end if;

  update public.profiles
     set display_name = v_name, updated_at = now()
   where id = v_uid;

  return query select v_name, null::text;
end;
$$;

revoke all on function public.update_own_profile(text) from public, anon;
grant execute on function public.update_own_profile(text) to authenticated;
