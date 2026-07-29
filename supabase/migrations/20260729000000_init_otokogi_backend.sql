create table public.shared_groups (
  id bigint generated always as identity primary key,
  share_key_hash text not null unique,
  version bigint not null default 1,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint shared_groups_key_hash_format
    check (share_key_hash ~ '^[a-f0-9]{64}$'),
  constraint shared_groups_version_positive
    check (version > 0),
  constraint shared_groups_state_object
    check (jsonb_typeof(state) = 'object'),
  constraint shared_groups_state_size
    check (octet_length(state::text) <= 524288)
);

create table public.group_audit_log (
  id bigint generated always as identity primary key,
  shared_group_id bigint not null
    references public.shared_groups(id) on delete cascade,
  version bigint not null,
  action text not null,
  snapshot jsonb not null,
  recorded_at timestamptz not null default now(),
  constraint group_audit_version_positive
    check (version > 0),
  constraint group_audit_action_length
    check (char_length(action) between 1 and 40),
  constraint group_audit_snapshot_object
    check (jsonb_typeof(snapshot) = 'object')
);

create index group_audit_group_recorded_idx
  on public.group_audit_log (shared_group_id, recorded_at desc);

alter table public.shared_groups enable row level security;
alter table public.shared_groups force row level security;
alter table public.group_audit_log enable row level security;
alter table public.group_audit_log force row level security;

revoke all on table public.shared_groups
  from public, anon, authenticated;
revoke all on table public.group_audit_log
  from public, anon, authenticated;
revoke all on sequence public.shared_groups_id_seq
  from public, anon, authenticated;
revoke all on sequence public.group_audit_log_id_seq
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.shared_groups to service_role;
grant select, insert, update, delete
  on table public.group_audit_log to service_role;
grant usage, select
  on sequence public.shared_groups_id_seq to service_role;
grant usage, select
  on sequence public.group_audit_log_id_seq to service_role;

comment on table public.shared_groups is
  '男気録の共有URL単位の最新状態。共有キーはSHA-256ハッシュのみ保存する。';
comment on table public.group_audit_log is
  '共有グループの更新履歴と復旧用スナップショット。';
