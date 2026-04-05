begin;

alter table public.tasks
  add column if not exists task_type text default 'subject';

update public.tasks
set task_type = 'subject'
where task_type is null;

alter table public.tasks
  alter column task_type set default 'subject',
  alter column task_type set not null;

alter table public.tasks
  alter column subject_id drop not null;

with others_subjects as (
  select id
  from public.subjects
  where lower(trim(name)) = 'others'
)
update public.tasks t
set
  task_type = 'standalone',
  subject_id = null,
  topic_id = null,
  source_topic_task_id = null
where t.subject_id in (select id from others_subjects);

update public.tasks
set
  task_type = 'standalone',
  subject_id = null,
  topic_id = null,
  source_topic_task_id = null
where subject_id is null;

alter table public.tasks
  drop constraint if exists tasks_task_type_check;

alter table public.tasks
  add constraint tasks_task_type_check
  check (task_type in ('subject', 'standalone'));

alter table public.tasks
  drop constraint if exists tasks_subject_link_by_type_check;

alter table public.tasks
  drop constraint if exists task_type_subject_check;

alter table public.tasks
  add constraint task_type_subject_check
  check (
    (task_type = 'subject' and subject_id is not null) or
    (task_type = 'standalone' and subject_id is null)
  );

alter table public.tasks
  drop constraint if exists tasks_standalone_fk_clear_check;

alter table public.tasks
  add constraint tasks_standalone_fk_clear_check
  check (
    task_type <> 'standalone'
    or (topic_id is null and source_topic_task_id is null)
  );

update public.subjects
set
  name = '__deprecated_others__',
  archived = true,
  updated_at = now()
where lower(trim(name)) = 'others';

alter table public.subjects
  drop constraint if exists subjects_reserved_name_check;

alter table public.subjects
  drop constraint if exists no_others_subject;

alter table public.subjects
  add constraint no_others_subject
  check (lower(trim(name)) <> 'others');

commit;
