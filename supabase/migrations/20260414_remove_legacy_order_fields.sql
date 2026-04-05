begin;

do $$
declare
  legacy_order_key text := 'prio' || 'rity';
begin
  execute format(
    'alter table public.topics drop constraint if exists topics_%s_check',
    legacy_order_key
  );
  execute format(
    'alter table public.topics drop column if exists %I',
    legacy_order_key
  );
  execute format(
    'alter table public.tasks drop constraint if exists tasks_%s_check',
    legacy_order_key
  );
  execute format(
    'alter table public.tasks drop column if exists %I',
    legacy_order_key
  );
end
$$;

create or replace function public.commit_plan_atomic_v2(
  p_tasks jsonb,
  p_snapshot_summary text,
  p_config_snapshot jsonb,
  p_keep_mode text,
  p_new_plan_start_date date,
  p_commit_hash text
)
returns table(status text, task_count integer, snapshot_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_keep_mode text;
  v_new_plan_start date;
  v_snapshot_id uuid;
  v_requested_count integer := 0;
  v_inserted_count integer := 0;
  v_commit_hash text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return query
    select
      'UNAUTHORIZED'::text,
      0::integer,
      null::uuid;
    return;
  end if;

  if p_commit_hash is null then
    raise exception 'commit_hash_required';
  end if;

  v_commit_hash := lower(trim(p_commit_hash));
  if v_commit_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_commit_hash';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || v_commit_hash, 0));

  if exists (
    select 1
    from public.plan_snapshots ps
    where ps.user_id = v_user_id
      and ps.commit_hash = v_commit_hash
  ) then
    raise exception 'duplicate_commit';
  end if;

  v_keep_mode := lower(coalesce(p_keep_mode, 'future'));
  if v_keep_mode not in ('future', 'until', 'none', 'merge') then
    v_keep_mode := 'future';
  end if;

  v_new_plan_start := coalesce(p_new_plan_start_date, current_date);
  v_requested_count := jsonb_array_length(coalesce(p_tasks, '[]'::jsonb));

  if v_requested_count = 0 then
    raise exception 'empty_commit_not_allowed';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) as payload(item)
    where lower(trim(coalesce(item->>'is_manual', 'false'))) not in ('true', 't', '1')
      and trim(coalesce(item->>'topic_id', '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'missing_generated_sessions';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) as payload(item)
    where trim(coalesce(item->>'scheduled_date', '')) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ) then
    raise exception 'invalid_scheduled_date';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) as payload(item)
    where case
      when trim(coalesce(item->>'duration_minutes', '')) ~ '^[0-9]+$'
        then (trim(item->>'duration_minutes'))::integer <= 0
      else true
    end
  ) then
    raise exception 'invalid_duration';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) as payload(item)
    where lower(trim(coalesce(item->>'session_type', ''))) not in ('core', 'revision', 'practice')
  ) then
    raise exception 'invalid_session_type';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) as payload(item)
    where lower(trim(coalesce(item->>'is_manual', 'false'))) not in ('true', 't', '1')
      and (
        trim(coalesce(item->>'session_number', '')) !~ '^[0-9]+$'
        or trim(coalesce(item->>'total_sessions', '')) !~ '^[0-9]+$'
        or (trim(item->>'session_number'))::integer <= 0
        or (trim(item->>'total_sessions'))::integer <= 0
        or (trim(item->>'session_number'))::integer > (trim(item->>'total_sessions'))::integer
      )
  ) then
    raise exception 'invalid_session_counters';
  end if;

  if v_keep_mode = 'none' then
    delete from public.tasks t
    where t.user_id = v_user_id
      and t.task_source = 'plan'
      and t.completed = false;
  elsif v_keep_mode = 'future' then
    delete from public.tasks t
    where t.user_id = v_user_id
      and t.task_source = 'plan'
      and t.completed = false
      and t.scheduled_date >= v_new_plan_start;
  elsif v_keep_mode = 'until' then
    delete from public.tasks t
    where t.user_id = v_user_id
      and t.task_source = 'plan'
      and t.completed = false
      and t.scheduled_date >= v_new_plan_start;
  end if;

  insert into public.plan_snapshots (
    user_id,
    task_count,
    schedule_json,
    settings_snapshot,
    summary,
    commit_hash
  )
  values (
    v_user_id,
    0,
    coalesce(p_tasks, '[]'::jsonb),
    coalesce(p_config_snapshot, '{}'::jsonb),
    coalesce(nullif(trim(p_snapshot_summary), ''), 'Committed plan'),
    v_commit_hash
  )
  returning id into v_snapshot_id;

  with parsed_tasks as (
    select
      case
        when trim(coalesce(item->>'subject_id', '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (trim(item->>'subject_id'))::uuid
        else null
      end as subject_id,
      case
        when trim(coalesce(item->>'topic_id', '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (trim(item->>'topic_id'))::uuid
        else null
      end as topic_id,
      case
        when lower(trim(coalesce(item->>'is_manual', 'false'))) in ('true', 't', '1')
          then true
        else false
      end as is_manual,
      case
        when trim(coalesce(item->>'source_topic_task_id', '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (trim(item->>'source_topic_task_id'))::uuid
        else null
      end as source_topic_task_id,
      case
        when nullif(trim(coalesce(item->>'title', '')), '') is null then 'Study session'
        else left(trim(item->>'title'), 280)
      end as title,
      (trim(item->>'scheduled_date'))::date as scheduled_date,
      (trim(item->>'duration_minutes'))::integer as duration_minutes,
      lower(trim(item->>'session_type')) as session_type,
      case
        when lower(trim(coalesce(item->>'is_manual', 'false'))) in ('true', 't', '1')
          then case
            when trim(coalesce(item->>'session_number', '')) ~ '^[0-9]+$'
              then greatest(1, (trim(item->>'session_number'))::integer)
            else 1
          end
        else (trim(item->>'session_number'))::integer
      end as session_number,
      case
        when lower(trim(coalesce(item->>'is_manual', 'false'))) in ('true', 't', '1')
          then case
            when trim(coalesce(item->>'total_sessions', '')) ~ '^[0-9]+$'
              then greatest(1, (trim(item->>'total_sessions'))::integer)
            else 1
          end
        else (trim(item->>'total_sessions'))::integer
      end as total_sessions
    from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) as payload(item)
  ),
  normalized_tasks as (
    select
      p.subject_id,
      p.topic_id,
      p.is_manual,
      p.source_topic_task_id,
      p.title,
      p.scheduled_date,
      p.duration_minutes,
      p.session_type,
      p.session_number,
      p.total_sessions
    from parsed_tasks p
    where p.subject_id is not null
  ),
  validated_tasks as (
    select
      n.subject_id,
      case when n.topic_id is null then null else tp.id end as topic_id,
      case when n.topic_id is null then null else tt.id end as source_topic_task_id,
      n.title,
      n.scheduled_date,
      n.duration_minutes,
      n.session_type,
      n.session_number,
      n.total_sessions
    from normalized_tasks n
    join public.subjects s
      on s.id = n.subject_id
     and s.user_id = v_user_id
    left join public.topics tp
      on tp.id = n.topic_id
     and tp.user_id = v_user_id
     and tp.subject_id = s.id
    left join public.topic_tasks tt
      on tt.id = n.source_topic_task_id
     and tt.user_id = v_user_id
     and tt.topic_id = tp.id
    where (n.topic_id is null and n.is_manual)
       or (n.topic_id is not null and tp.id is not null)
  )
  insert into public.tasks (
    user_id,
    subject_id,
    topic_id,
    source_topic_task_id,
    title,
    scheduled_date,
    duration_minutes,
    session_type,
    session_number,
    total_sessions,
    completed,
    task_source,
    plan_snapshot_id
  )
  select
    v_user_id,
    vt.subject_id,
    vt.topic_id,
    vt.source_topic_task_id,
    vt.title,
    vt.scheduled_date,
    vt.duration_minutes,
    vt.session_type,
    vt.session_number,
    vt.total_sessions,
    false,
    'plan',
    v_snapshot_id
  from validated_tasks vt;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count <> v_requested_count then
    raise exception 'invalid_task_payload';
  end if;

  update public.plan_snapshots
  set task_count = v_inserted_count
  where id = v_snapshot_id
    and user_id = v_user_id;

  return query
  select
    'SUCCESS'::text,
    v_inserted_count,
    v_snapshot_id;
end;
$$;

commit;
