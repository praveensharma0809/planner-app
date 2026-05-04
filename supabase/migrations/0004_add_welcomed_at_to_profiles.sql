begin;

alter table public.profiles
  add column if not exists welcomed_at timestamptz null default null;

-- Back-fill every existing profile so current users do not see the welcome
-- modal again after this migration.  Only new sign-ups (welcomed_at IS NULL)
-- will trigger the modal going forward.
update public.profiles
  set welcomed_at = created_at
  where welcomed_at is null;

commit;
