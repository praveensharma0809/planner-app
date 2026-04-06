begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  streak_current integer not null default 0,
  streak_longest integer not null default 0,
  streak_last_completed_date date,
  created_at timestamp with time zone not null default now()
);

create table public.subjects (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  archived boolean not null default false,
  deadline date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint subjects_pkey primary key (id),
  constraint no_others_subject check (lower(trim(name)) <> 'others')
);

create table public.topics (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  archived boolean not null default false,
  estimated_hours numeric(6,1) not null default 0,
  deadline date,
  earliest_start date,
  depends_on uuid[] not null default '{}',
  session_length_minutes integer not null default 60,
  rest_after_days integer not null default 0,
  max_sessions_per_day integer not null default 0,
  study_frequency text not null default 'daily',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint topics_pkey primary key (id),
  constraint topics_estimated_hours_check check (estimated_hours >= 0),
  constraint topics_session_length_minutes_check check (session_length_minutes between 15 and 240),
  constraint topics_rest_after_days_check check (rest_after_days >= 0),
  constraint topics_max_sessions_per_day_check check (max_sessions_per_day >= 0),
  constraint topics_study_frequency_check check (study_frequency in ('daily', 'spaced')),
  constraint topics_date_window_check check (earliest_start is null or deadline is null or earliest_start <= deadline)
);

create table public.topic_tasks (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  title text not null,
  duration_minutes integer not null default 60,
  completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint topic_tasks_pkey primary key (id),
  constraint topic_tasks_duration_minutes_check check (duration_minutes > 0)
);

create table public.planner_settings (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  study_start_date date not null,
  exam_date date not null,
  weekday_capacity_minutes integer not null,
  weekend_capacity_minutes integer not null,
  max_active_subjects integer not null default 0,
  day_of_week_capacity jsonb,
  custom_day_capacity jsonb,
  flexibility_minutes integer not null default 0,
  max_daily_minutes integer not null default 480,
  intake_import_mode text not null default 'all',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint planner_settings_pkey primary key (id),
  constraint planner_settings_user_id_key unique (user_id),
  constraint planner_settings_weekday_capacity_minutes_check check (weekday_capacity_minutes >= 0),
  constraint planner_settings_weekend_capacity_minutes_check check (weekend_capacity_minutes >= 0),
  constraint planner_settings_max_active_subjects_check check (max_active_subjects >= 0),
  constraint planner_settings_flexibility_minutes_check check (flexibility_minutes >= 0),
  constraint planner_settings_max_daily_minutes_check check (max_daily_minutes between 30 and 720),
  constraint planner_settings_intake_import_mode_check check (intake_import_mode in ('all', 'undone'))
);

create table public.plan_snapshots (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_count integer not null default 0,
  schedule_json jsonb not null default '[]'::jsonb,
  settings_snapshot jsonb not null default '{}'::jsonb,
  summary text,
  commit_hash text,
  created_at timestamp with time zone not null default now(),
  constraint plan_snapshots_pkey primary key (id),
  constraint plan_snapshots_task_count_check check (task_count >= 0),
  constraint plan_snapshots_commit_hash_format_check check (commit_hash is null or commit_hash ~ '^[0-9a-f]{64}$')
);

create table public.tasks (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_type text not null default 'subject',
  subject_id uuid references public.subjects (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  source_topic_task_id uuid references public.topic_tasks (id) on delete set null,
  title text not null,
  scheduled_date date not null,
  duration_minutes integer not null,
  session_type text not null default 'core',
  session_number integer not null default 0,
  total_sessions integer not null default 1,
  sort_order integer not null default 0,
  completed boolean not null default false,
  task_source text not null default 'manual',
  plan_snapshot_id uuid references public.plan_snapshots (id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint tasks_pkey primary key (id),
  constraint tasks_duration_minutes_check check (duration_minutes > 0),
  constraint tasks_session_type_check check (session_type in ('core', 'revision', 'practice')),
  constraint tasks_task_source_check check (task_source in ('manual', 'plan')),
  constraint tasks_source_topic_task_plan_only_check check (source_topic_task_id is null or task_source = 'plan'),
  constraint tasks_task_type_check check (task_type in ('subject', 'standalone')),
  constraint task_type_subject_check check (
    (task_type = 'subject' and subject_id is not null) or
    (task_type = 'standalone' and subject_id is null)
  ),
  constraint tasks_standalone_fk_clear_check check (
    task_type <> 'standalone' or (topic_id is null and source_topic_task_id is null)
  )
);

create table public.off_days (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  reason text,
  created_at timestamp with time zone not null default now(),
  constraint off_days_user_date_unique unique (user_id, date)
);

create table public.ops_events (
  id uuid not null default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_name text not null,
  event_status text not null,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint ops_events_pkey primary key (id),
  constraint ops_events_status_check check (event_status in ('started', 'success', 'warning', 'error')),
  constraint ops_events_duration_ms_check check (duration_ms is null or duration_ms >= 0)
);

create unique index uq_subjects_user_name_active
  on public.subjects (user_id, lower(name))
  where archived = false;

create index idx_subjects_user_archived_sort
  on public.subjects (user_id, archived, sort_order);

create index idx_subjects_user_deadline
  on public.subjects (user_id, deadline);

create index idx_topics_user_subject_sort
  on public.topics (user_id, subject_id, sort_order);

create index idx_topics_user_archived
  on public.topics (user_id, archived);

create index idx_topics_user_deadline
  on public.topics (user_id, deadline);

create index idx_topics_depends_on_gin
  on public.topics using gin (depends_on);

create index idx_topic_tasks_user_topic_sort
  on public.topic_tasks (user_id, topic_id, sort_order, created_at);

create index idx_topic_tasks_user_subject
  on public.topic_tasks (user_id, subject_id);

create index idx_topic_tasks_user_completed
  on public.topic_tasks (user_id, completed);

create index idx_tasks_user_date
  on public.tasks (user_id, scheduled_date);

create index idx_tasks_user_completed_date
  on public.tasks (user_id, completed, scheduled_date);

create index idx_tasks_user_topic_sort
  on public.tasks (user_id, topic_id, sort_order, created_at);

create index idx_tasks_user_source_date
  on public.tasks (user_id, task_source, scheduled_date);

create index idx_tasks_plan_snapshot_id
  on public.tasks (plan_snapshot_id);

create index idx_tasks_user_source_topic_task
  on public.tasks (user_id, source_topic_task_id);

create index idx_plan_snapshots_user_created
  on public.plan_snapshots (user_id, created_at desc);

create unique index uq_plan_snapshots_user_commit_hash
  on public.plan_snapshots (user_id, commit_hash)
  where commit_hash is not null;

create index idx_plan_snapshots_user_commit_hash_created
  on public.plan_snapshots (user_id, commit_hash, created_at desc)
  where commit_hash is not null;

create index idx_off_days_user_date
  on public.off_days (user_id, date);

create index idx_ops_events_user_created
  on public.ops_events (user_id, created_at desc);

create index idx_ops_events_name_created
  on public.ops_events (event_name, created_at desc);

create trigger subjects_set_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

create trigger topics_set_updated_at
before update on public.topics
for each row execute function public.set_updated_at();

create trigger topic_tasks_set_updated_at
before update on public.topic_tasks
for each row execute function public.set_updated_at();

create trigger planner_settings_set_updated_at
before update on public.planner_settings
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.topic_tasks enable row level security;
alter table public.planner_settings enable row level security;
alter table public.plan_snapshots enable row level security;
alter table public.tasks enable row level security;
alter table public.off_days enable row level security;
alter table public.ops_events enable row level security;

create policy profiles_select_own on public.profiles
for select using (auth.uid() = id);

create policy profiles_insert_own on public.profiles
for insert with check (auth.uid() = id);

create policy profiles_update_own on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

create policy subjects_owner_select on public.subjects
for select using (auth.uid() = user_id);

create policy subjects_owner_insert on public.subjects
for insert with check (auth.uid() = user_id);

create policy subjects_owner_update on public.subjects
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy subjects_owner_delete on public.subjects
for delete using (auth.uid() = user_id);

create policy topics_owner_select on public.topics
for select using (auth.uid() = user_id);

create policy topics_owner_insert on public.topics
for insert with check (auth.uid() = user_id);

create policy topics_owner_update on public.topics
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy topics_owner_delete on public.topics
for delete using (auth.uid() = user_id);

create policy topic_tasks_owner_select on public.topic_tasks
for select using (auth.uid() = user_id);

create policy topic_tasks_owner_insert on public.topic_tasks
for insert with check (auth.uid() = user_id);

create policy topic_tasks_owner_update on public.topic_tasks
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy topic_tasks_owner_delete on public.topic_tasks
for delete using (auth.uid() = user_id);

create policy planner_settings_owner_select on public.planner_settings
for select using (auth.uid() = user_id);

create policy planner_settings_owner_insert on public.planner_settings
for insert with check (auth.uid() = user_id);

create policy planner_settings_owner_update on public.planner_settings
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy planner_settings_owner_delete on public.planner_settings
for delete using (auth.uid() = user_id);

create policy plan_snapshots_owner_select on public.plan_snapshots
for select using (auth.uid() = user_id);

create policy plan_snapshots_owner_insert on public.plan_snapshots
for insert with check (auth.uid() = user_id);

create policy plan_snapshots_owner_update on public.plan_snapshots
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy plan_snapshots_owner_delete on public.plan_snapshots
for delete using (auth.uid() = user_id);

create policy tasks_owner_select on public.tasks
for select using (auth.uid() = user_id);

create policy tasks_owner_insert on public.tasks
for insert with check (auth.uid() = user_id);

create policy tasks_owner_update on public.tasks
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy tasks_owner_delete on public.tasks
for delete using (auth.uid() = user_id);

create policy off_days_select_own on public.off_days
for select using (auth.uid() = user_id);

create policy off_days_insert_own on public.off_days
for insert with check (auth.uid() = user_id);

create policy off_days_update_own on public.off_days
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy off_days_delete_own on public.off_days
for delete using (auth.uid() = user_id);

create policy ops_events_owner_select on public.ops_events
for select using (auth.uid() = user_id);

create policy ops_events_owner_insert on public.ops_events
for insert with check (user_id is null or auth.uid() = user_id);

create policy ops_events_owner_update on public.ops_events
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy ops_events_owner_delete on public.ops_events
for delete using (auth.uid() = user_id);

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.subjects to authenticated;
grant select, insert, update, delete on table public.topics to authenticated;
grant select, insert, update, delete on table public.topic_tasks to authenticated;
grant select, insert, update, delete on table public.planner_settings to authenticated;
grant select, insert, update, delete on table public.plan_snapshots to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.off_days to authenticated;
grant select, insert, update, delete on table public.ops_events to authenticated;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.subjects to service_role;
grant select, insert, update, delete on table public.topics to service_role;
grant select, insert, update, delete on table public.topic_tasks to service_role;
grant select, insert, update, delete on table public.planner_settings to service_role;
grant select, insert, update, delete on table public.plan_snapshots to service_role;
grant select, insert, update, delete on table public.tasks to service_role;
grant select, insert, update, delete on table public.off_days to service_role;
grant select, insert, update, delete on table public.ops_events to service_role;

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

create or replace function public.commit_plan_atomic_v2_wrapper(
  p_tasks jsonb,
  p_snapshot_summary text,
  p_config_snapshot jsonb,
  p_keep_mode text,
  p_new_plan_start_date date
)
returns table(status text, task_count integer, snapshot_id uuid)
language sql
security definer
set search_path = public, extensions
as $$
  select *
  from public.commit_plan_atomic_v2(
    p_tasks,
    p_snapshot_summary,
    p_config_snapshot,
    p_keep_mode,
    p_new_plan_start_date,
    encode(
      digest(
        (coalesce(auth.uid()::text, '') || ':' || coalesce(p_tasks::text, '[]'))::text,
        'sha256'::text
      ),
      'hex'
    )
  );
$$;

create or replace function public.sync_topic_task_completion(
  p_topic_task_id uuid,
  p_next_completed boolean
)
returns table(status text, synced_execution_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_topic_task_id uuid;
  v_synced_execution_count integer := 0;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return query
    select
      'UNAUTHORIZED'::text,
      0::integer;
    return;
  end if;

  update public.topic_tasks tt
  set completed = p_next_completed
  where tt.id = p_topic_task_id
    and tt.user_id = v_user_id
    and tt.completed is distinct from p_next_completed
  returning tt.id into v_topic_task_id;

  if v_topic_task_id is null then
    select tt.id
    into v_topic_task_id
    from public.topic_tasks tt
    where tt.id = p_topic_task_id
      and tt.user_id = v_user_id
    limit 1;

    if v_topic_task_id is null then
      return query
      select
        'NOT_FOUND'::text,
        0::integer;
      return;
    end if;
  end if;

  update public.tasks t
  set completed = p_next_completed
  where t.user_id = v_user_id
    and t.task_source = 'plan'
    and t.source_topic_task_id = v_topic_task_id
    and t.completed is distinct from p_next_completed;

  get diagnostics v_synced_execution_count = row_count;

  return query
  select
    'SUCCESS'::text,
    v_synced_execution_count;
end;
$$;

grant execute on function public.commit_plan_atomic_v2(jsonb, text, jsonb, text, date, text) to authenticated;
grant execute on function public.commit_plan_atomic_v2(jsonb, text, jsonb, text, date, text) to service_role;
grant execute on function public.commit_plan_atomic_v2_wrapper(jsonb, text, jsonb, text, date) to authenticated;
grant execute on function public.commit_plan_atomic_v2_wrapper(jsonb, text, jsonb, text, date) to service_role;
grant execute on function public.sync_topic_task_completion(uuid, boolean) to authenticated;
grant execute on function public.sync_topic_task_completion(uuid, boolean) to service_role;

notify pgrst, 'reload schema';

commit;
