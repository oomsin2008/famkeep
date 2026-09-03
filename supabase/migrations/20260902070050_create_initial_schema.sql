-- FamKeep initial schema (Phase 7.1B)
-- Source of truth: Phase 7.0 architecture plan + the five 7.0 corrections
-- (workspaces has no line_group_id; line_conversations is the single source
-- of truth for external LINE identity; profiles.line_user_id = LINE
-- provider-scoped userId; can_access_workspace branches on ownership OR
-- membership rather than assuming every workspace has a membership row).
--
-- This migration creates schema only: tables, enums, integrity checks,
-- indexes, the updated_at trigger, the concurrency-safe max-2-reminders
-- constraints (task_reminders.slot, declarative UNIQUE — see §12), the
-- family-only workspace_members trigger (§16), and the can_access_workspace()
-- RLS helper. RLS is ENABLED on every table
-- but no policies are attached yet (reviewed separately) — with RLS on and
-- zero policies, every table is deny-by-default for the `authenticated` and
-- `anon` roles; only `service_role` (which bypasses RLS) can read/write
-- until policies are added. This is the intended, safe posture for this step.
--
-- Not created here (deliberately out of scope for 7.1B): RLS policies,
-- table grants, Edge Functions, secrets, any LINE/Google/Supabase Auth
-- provider configuration.


-- =========================================================================
-- 1. Enums
-- =========================================================================
-- Kept to four: each models a small, structurally-locked concept that the
-- product rules fix permanently (private/family, owner/member, LINE's own
-- user/group split, and the three locked task lifecycle states). Everything
-- else that could plausibly grow later (file kind, reminder preset, job
-- type/status, webhook processing status) uses text + check instead, so
-- adding a new allowed value later is a lightweight ALTER, not an enum
-- migration with its historical caveats.

create type public.workspace_type as enum ('private', 'family');
create type public.family_role as enum ('owner', 'member');
create type public.line_source_type as enum ('user', 'group');
create type public.task_lifecycle_status as enum ('open', 'done', 'cancelled');


-- =========================================================================
-- 2. profiles
-- =========================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  line_user_id text not null,
  display_name text,
  avatar_url text,
  email text,
  -- Replaces the mock SettingsProvider's two local toggles (Phase 7.0 §9).
  notification_prefs jsonb not null default
    '{"notify_task_due_soon": true, "weekly_summary": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_line_user_id_key unique (line_user_id)
);

comment on column public.profiles.line_user_id is
  'LINE provider-scoped userId (the OIDC sub claim from LINE Login). Locked '
  'identical to the Messaging API webhook userId only when both LINE '
  'channels are created under the same Provider (Phase 7.0 correction 2).';


-- =========================================================================
-- 3. workspaces
-- =========================================================================
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  type public.workspace_type not null,
  name text not null,
  owner_profile_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Integrity rule I: a private workspace must have an owner.
  constraint workspaces_private_owner_ck
    check (type <> 'private' or owner_profile_id is not null),
  -- Integrity rule I: a family workspace must NOT rely on owner_profile_id
  -- as its access mechanism — access is via workspace_members only, so the
  -- column must be null on family rows to avoid it ever being mistaken for
  -- an access shortcut in a future policy.
  constraint workspaces_family_no_owner_ck
    check (type <> 'family' or owner_profile_id is null)
);

-- One private workspace per owner (Phase 7.0 §1/B). Partial unique index
-- rather than a table-level UNIQUE(owner_profile_id), since owner_profile_id
-- is null for every family workspace and a plain unique constraint would
-- still work here (Postgres treats NULLs as distinct) — the WHERE clause is
-- kept anyway to state the rule explicitly and avoid indexing family rows.
create unique index workspaces_one_private_per_owner
  on public.workspaces (owner_profile_id)
  where type = 'private';

comment on table public.workspaces is
  'No line_group_id column (Phase 7.0 correction 3) — LINE group mapping '
  'lives only in line_conversations.';


-- =========================================================================
-- 4. workspace_members
-- =========================================================================
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.family_role not null default 'member',
  joined_at timestamptz not null default now(),
  constraint workspace_members_unique unique (workspace_id, profile_id)
);

-- Reverse lookup ("which workspaces is this profile in") — the composite
-- unique index above is workspace_id-leading, so this covers the other
-- direction; used heavily by can_access_workspace() and family-workspace
-- listing queries.
create index workspace_members_profile_id_idx on public.workspace_members (profile_id);
create index workspace_members_workspace_id_idx on public.workspace_members (workspace_id);


-- =========================================================================
-- 5. line_conversations (single source of truth for external LINE mapping)
-- =========================================================================
create table public.line_conversations (
  id uuid primary key default gen_random_uuid(),
  line_source_type public.line_source_type not null,
  line_source_id text not null,
  profile_id uuid references public.profiles (id) on delete set null,
  workspace_id uuid references public.workspaces (id) on delete set null,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint line_conversations_source_unique unique (line_source_type, line_source_id),
  -- Integrity rule I ("logically valid ... where practical"): profile_id
  -- only makes sense for a 'user' source; it is allowed to be null even for
  -- a 'user' row (a LINE user can message before ever logging into
  -- FamKeep), but it must never be set on a 'group' row.
  constraint line_conversations_profile_only_for_user_ck
    check (line_source_type = 'user' or profile_id is null),
  constraint line_conversations_workspace_only_for_group_ck
    check (line_source_type = 'group' or workspace_id is null)
);

create index line_conversations_workspace_id_idx on public.line_conversations (workspace_id);

comment on table public.line_conversations is
  'Single source of truth for LINE groupId/userId -> FamKeep workspace/profile '
  'mapping (Phase 7.0 correction 3). Unique (line_source_type, line_source_id) '
  'is both the identity constraint and the webhook-resolution lookup index.';


-- =========================================================================
-- 6. folders
-- =========================================================================
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  parent_folder_id uuid references public.folders (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint folders_sibling_name_unique unique (workspace_id, parent_folder_id, name)
);

create index folders_workspace_id_idx on public.folders (workspace_id);
create index folders_parent_folder_id_idx on public.folders (parent_folder_id);

-- The table-level unique constraint above only catches duplicate sibling
-- names when parent_folder_id is NOT NULL — Postgres treats every NULL as
-- distinct from every other NULL, so two root-level folders (parent_folder_id
-- is null) named the same would NOT be rejected by that constraint alone.
-- This partial index closes that gap for the null-parent (root) case.
create unique index folders_root_sibling_name_unique
  on public.folders (workspace_id, name)
  where parent_folder_id is null;


-- =========================================================================
-- 7. files
-- =========================================================================
create table public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  -- text + check, not enum: file kinds are likely to grow (video, audio,
  -- spreadsheet, ...) and a check constraint is cheaper to extend.
  kind text not null check (kind in ('pdf', 'image', 'doc', 'other')),
  size_bytes bigint not null check (size_bytes >= 0),
  saved_by_profile_id uuid not null references public.profiles (id),
  saved_via_line boolean not null default false,
  drive_file_id text not null,
  folder_id uuid references public.folders (id) on delete set null,
  line_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft-delete: no delete UI exists yet (rule 8), but the column is added
  -- now so a real delete feature never needs a disruptive later migration.
  deleted_at timestamptz,
  constraint files_drive_file_id_key unique (drive_file_id)
);

create index files_workspace_recency_idx on public.files (workspace_id, created_at desc);
create index files_saved_by_profile_id_idx on public.files (saved_by_profile_id);
create index files_folder_id_idx on public.files (folder_id);


-- =========================================================================
-- 8. tags
-- =========================================================================
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  constraint tags_workspace_label_unique unique (workspace_id, label)
);
-- No separate workspace_id index: the unique index above is workspace_id-
-- leading and already serves that lookup direction.


-- =========================================================================
-- 9. file_tags
-- =========================================================================
create table public.file_tags (
  file_id uuid not null references public.files (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (file_id, tag_id)
);

create index file_tags_tag_id_idx on public.file_tags (tag_id);


-- =========================================================================
-- 10. pending_attachments
-- =========================================================================
create table public.pending_attachments (
  id uuid primary key default gen_random_uuid(),
  line_conversation_id uuid not null references public.line_conversations (id) on delete cascade,
  line_message_id text not null,
  line_content_type text not null check (line_content_type in ('image', 'file')),
  posted_by_line_user_id text not null,
  -- Pointer into whatever temp staging mechanism 7.7 lands on (Drive draft
  -- upload id, Storage object path, ...) — intentionally opaque here.
  staging_ref text,
  expires_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pending_attachments_unique unique (line_conversation_id, line_message_id)
);

create index pending_attachments_expires_at_idx on public.pending_attachments (expires_at);


-- =========================================================================
-- 11. tasks
-- =========================================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  notes text not null default '',
  assignee_profile_id uuid references public.profiles (id) on delete set null,
  due_at timestamptz not null,
  -- Persists lifecycle only (rule E) — progress/duesoon/overdue stay
  -- derived from due_at at read time, exactly like deriveTaskStatus() in
  -- src/lib/tasks.ts today; that pure function is reused, not re-implemented,
  -- when the frontend migrates (Phase 7.0 §9).
  lifecycle_status public.task_lifecycle_status not null default 'open',
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  created_via text not null default 'app' check (created_via in ('app', 'line')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft-delete: rule 7 says no task deletion in MVP; column added now to
  -- avoid a later migration when that feature ships.
  deleted_at timestamptz
);

create index tasks_workspace_due_at_idx on public.tasks (workspace_id, due_at);
create index tasks_lifecycle_status_idx on public.tasks (lifecycle_status);


-- =========================================================================
-- 12. task_reminders
-- =========================================================================
-- Rule D (hardened per review): the 0-2 cap and "no duplicate preset per
-- task" rule are both enforced with plain UNIQUE constraints rather than a
-- count-based trigger. A count-then-insert trigger reads sibling rows and
-- then writes — two concurrent transactions inserting for the same task_id
-- can both read a count of 1 before either commits, and both pass the
-- check, landing 3 rows. A UNIQUE constraint has no such window: Postgres
-- enforces it atomically inside the index itself (insert or block/abort on
-- conflict), so it is correct under concurrent writes from the web app, the
-- LINE webhook, and background jobs without any advisory lock or retry
-- logic. `slot` has no product meaning (the UI already treats a task's
-- reminders as an unordered set of up to 2 presets) — it exists purely so
-- UNIQUE(task_id, slot) can express "at most 2 rows per task" declaratively.
-- The backend allocates the first free slot (1 or 2) when creating a
-- reminder; if two writers race for the same slot, one UNIQUE-violates and
-- retries with the other slot — the constraint is the actual guarantee, the
-- slot-picking is just an optimistic hint.
create table public.task_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  -- Which of the task's (at most 2) reminder rows this is. Backend-assigned,
  -- no default — every insert must pick one explicitly.
  slot smallint not null check (slot in (1, 2)),
  preset text not null
    check (preset in ('one_day_before', 'three_hours_before', 'morning_of_due')),
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  failure_reason text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Hard cap: at most one row per (task_id, slot), and slot only takes the
  -- values 1 or 2 above — so a task can never have more than 2 rows here,
  -- full stop, regardless of transaction interleaving.
  constraint task_reminders_slot_unique unique (task_id, slot),
  -- No duplicate preset active twice on the same task, same guarantee.
  constraint task_reminders_preset_unique unique (task_id, preset)
);

create index task_reminders_task_id_idx on public.task_reminders (task_id);
-- The scheduler's core query: "pending reminders due now or earlier". Not
-- affected by the slot column — status/scheduled_at is still the only
-- filter the scheduler needs.
create index task_reminders_scheduler_idx on public.task_reminders (status, scheduled_at);


-- =========================================================================
-- 13. webhook_events
-- =========================================================================
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  line_webhook_event_id text not null,
  -- source_type/event_type are LINE's own raw vocabulary (source_type
  -- includes at least user/group/room; event_type covers message, postback,
  -- follow, join, leave, ...). Left as unconstrained text deliberately: this
  -- table is a raw log and must never reject a row because LINE sent a
  -- value we didn't anticipate. Application code interprets/validates these
  -- values; the DB just records them.
  source_type text,
  source_id text,
  event_type text not null,
  raw_payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processing', 'done', 'error')),
  -- Dedupe ledger for LINE's routine webhook redelivery.
  constraint webhook_events_event_id_key unique (line_webhook_event_id)
);

create index webhook_events_processing_status_idx
  on public.webhook_events (processing_status, received_at);


-- =========================================================================
-- 14. processing_jobs
-- =========================================================================
create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null
    check (job_type in ('ingest_file', 'send_reminder', 'create_task_from_line')),
  -- Natural idempotency key where one exists (e.g. a task_reminder id for
  -- send_reminder jobs). Null is allowed and, unlike the folders case above,
  -- that is exactly what we want here: jobs with no natural dedupe key
  -- (distinct NULLs) can be enqueued freely, while jobs that DO supply one
  -- get real uniqueness enforcement.
  dedupe_key text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  last_error text,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint processing_jobs_dedupe_unique unique (job_type, dedupe_key)
);

-- The Cron poll query: "queued jobs whose run_after has arrived".
create index processing_jobs_poll_idx on public.processing_jobs (status, run_after);


-- =========================================================================
-- 15. updated_at maintenance
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create trigger trg_line_conversations_updated_at
  before update on public.line_conversations
  for each row execute function public.set_updated_at();

create trigger trg_folders_updated_at
  before update on public.folders
  for each row execute function public.set_updated_at();

create trigger trg_files_updated_at
  before update on public.files
  for each row execute function public.set_updated_at();

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger trg_task_reminders_updated_at
  before update on public.task_reminders
  for each row execute function public.set_updated_at();

create trigger trg_processing_jobs_updated_at
  before update on public.processing_jobs
  for each row execute function public.set_updated_at();


-- =========================================================================
-- 16. workspace_members must only reference FAMILY workspaces
-- =========================================================================
-- Locked data model: private-workspace access is workspaces.owner_profile_id
-- only; workspace_members is the family-workspace access mechanism only. A
-- workspace_members row pointing at a private workspace would be a second,
-- contradictory access path into private data, so it must be impossible to
-- create one. This is a cross-table check (workspace_members.workspace_id
-- against workspaces.type), which a plain CHECK constraint cannot express —
-- CHECK bodies can only see columns of the row being written, never another
-- table — so a trigger is required, as instructed.
--
-- A CONSTRAINT TRIGGER is used for the same reason as the reminders table:
-- DEFERRABLE INITIALLY IMMEDIATE fails immediately by default (the common
-- case) while still permitting a future multi-statement transaction (e.g.
-- bulk-seeding a workspace and its members together) to defer the check to
-- COMMIT time if that's ever needed, with no schema change. Unlike the
-- reminders cap, this check reads a different table's data rather than
-- counting sibling rows, so no concurrency hazard applies here — workspaces
-- rows are essentially immutable after creation (no UI ever changes a
-- workspace's type) and no advisory lock is needed.
--
-- Fires on INSERT (always) and on UPDATE only when workspace_id itself
-- changes, exactly as instructed — editing role/joined_at on an existing
-- membership row can't repoint it at a different workspace, so no re-check
-- is needed there.
create or replace function public.enforce_family_only_membership()
returns trigger
language plpgsql
as $$
declare
  target_type public.workspace_type;
begin
  select type into target_type
  from public.workspaces
  where id = new.workspace_id;

  -- Defensive: the FK on workspace_id already guarantees the row exists at
  -- statement time; NULL here would only happen under a concurrent delete
  -- of the target workspace mid-transaction, which the FK's own ON DELETE
  -- behavior governs. Still guarded explicitly so this function never
  -- silently passes on a missing lookup.
  if target_type is null then
    raise exception 'workspace_members.workspace_id % does not reference an existing workspace',
      new.workspace_id
      using errcode = '23503'; -- foreign_key_violation
  end if;

  if target_type <> 'family' then
    raise exception 'workspace_members can only reference family workspaces (workspace % is %)',
      new.workspace_id, target_type
      using errcode = '23514'; -- check_violation
  end if;

  return new;
end;
$$;

create constraint trigger trg_workspace_members_family_only
  after insert or update of workspace_id on public.workspace_members
  deferrable initially immediate
  for each row
  execute function public.enforce_family_only_membership();


-- =========================================================================
-- 17. RLS access helper (concept only — full policies reviewed separately)
-- =========================================================================
-- Phase 7.0 correction 4: must NOT assume every accessible workspace has a
-- workspace_members row (private workspaces never do). Branches on
-- ownership OR membership instead of membership alone.
--
-- SECURITY DEFINER + a pinned search_path: this function is meant to be
-- called from inside RLS policies on workspaces/workspace_members/tasks/
-- files/etc. Running with the function owner's privileges lets it read
-- workspaces/workspace_members regardless of the calling role's own RLS
-- visibility into those two tables (the standard Postgres/Supabase pattern
-- for RLS helper functions) and avoids recursive RLS evaluation when used
-- inside a policy on workspaces itself. `set search_path = public` is a
-- deliberate hardening step for SECURITY DEFINER functions, which are
-- otherwise susceptible to search-path hijacking.
create or replace function public.can_access_workspace(p_workspace_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id
      and w.type = 'private'
      and w.owner_profile_id = p_uid
  )
  or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.profile_id = p_uid
  );
$$;


-- =========================================================================
-- 18. Enable RLS (no policies yet — reviewed separately)
-- =========================================================================
-- With RLS enabled and zero policies attached, every table below is
-- deny-by-default for the `authenticated` and `anon` roles; only
-- `service_role` (which bypasses RLS) can read/write until policies land.
-- webhook_events and processing_jobs are backend-only tables that no
-- client role should ever touch — RLS is still enabled here for
-- defense-in-depth (service_role bypasses it regardless, so this only
-- guards against a future accidental grant).
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.line_conversations enable row level security;
alter table public.files enable row level security;
alter table public.folders enable row level security;
alter table public.tags enable row level security;
alter table public.file_tags enable row level security;
alter table public.pending_attachments enable row level security;
alter table public.tasks enable row level security;
alter table public.task_reminders enable row level security;
alter table public.webhook_events enable row level security;
alter table public.processing_jobs enable row level security;
