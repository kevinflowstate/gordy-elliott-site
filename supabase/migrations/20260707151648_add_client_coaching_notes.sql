create table if not exists public.client_coaching_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.client_profiles(id) on delete cascade,
  source_type text not null default 'other' check (
    source_type in ('call', 'zoom', 'loom', 'fathom', 'whatsapp', 'voice_note', 'email', 'other')
  ),
  source_title text,
  source_date date,
  raw_notes text not null,
  coach_summary text,
  client_summary text,
  coach_notes text,
  priorities jsonb not null default '[]'::jsonb,
  task_suggestions jsonb not null default '[]'::jsonb,
  follow_up_questions jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  saved_task_ids uuid[] not null default '{}'::uuid[],
  client_visible boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_coaching_notes_client_date_idx
  on public.client_coaching_notes(client_id, source_date desc, created_at desc);

create index if not exists client_coaching_notes_created_by_idx
  on public.client_coaching_notes(created_by);

alter table public.client_coaching_notes enable row level security;

drop policy if exists "Admins can manage client coaching notes" on public.client_coaching_notes;
create policy "Admins can manage client coaching notes"
  on public.client_coaching_notes
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.role = 'admin'
    )
  );

grant select, insert, update, delete on public.client_coaching_notes to authenticated;
