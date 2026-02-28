-- Atomic task completion with streak update and subject increment
-- Depends on existing increment_completed_items RPC

create or replace function public.complete_task_with_streak(p_task_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks%rowtype;
  v_profile profiles%rowtype;
  v_today date := current_date;
  v_yesterday date := current_date - interval '1 day';
begin
  -- Lock the task row for this user
  select * into v_task
  from tasks
  where id = p_task_id
    and user_id = auth.uid()
  for update;

  if not found then
    return json_build_object('status', 'noop');
  end if;

  if v_task.completed then
    return json_build_object('status', 'noop');
  end if;

  -- Mark task completed
  update tasks
  set completed = true
  where id = p_task_id
    and user_id = auth.uid();

  -- Load profile and lock
  select streak_current, streak_longest, streak_last_completed_date
  into v_profile
  from profiles
  where id = auth.uid()
  for update;

  if not found then
    return json_build_object('status', 'noop');
  end if;

  -- Compute new streak values
  v_profile.streak_current := coalesce(v_profile.streak_current, 0);
  v_profile.streak_longest := coalesce(v_profile.streak_longest, 0);

  if v_profile.streak_last_completed_date = v_today then
    -- already counted today; no change to current streak
  elsif v_profile.streak_last_completed_date = v_yesterday then
    v_profile.streak_current := v_profile.streak_current + 1;
  else
    v_profile.streak_current := 1;
  end if;

  if v_profile.streak_current > v_profile.streak_longest then
    v_profile.streak_longest := v_profile.streak_current;
  end if;

  update profiles
  set streak_current = v_profile.streak_current,
      streak_longest = v_profile.streak_longest,
      streak_last_completed_date = v_today
  where id = auth.uid();

  -- Increment subject counts (existing RPC)
  perform increment_completed_items(v_task.subject_id);

  return json_build_object('status', 'completed');
end;
$$;
