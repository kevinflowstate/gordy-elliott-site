-- Delivery evidence is independent of account activation/login. No email body,
-- recovery URL, recipient list or raw webhook payload is stored here.
create table public.client_email_attempts (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.client_profiles(id) on delete cascade,
 kind text not null check(kind in ('setup','password_reset','migration','consultation')),
 idempotency_key text not null unique,
 provider_email_id uuid unique,
 status text not null default 'sending' check(status in ('sending','accepted','failed','unknown')),
 created_at timestamptz not null default now(), accepted_at timestamptz
);
create index client_email_attempts_client_recent on public.client_email_attempts(client_id,created_at desc);
create table public.client_email_delivery_events (
 webhook_id text primary key check(length(webhook_id) between 1 and 200),
 email_id uuid not null,
 event_type text not null check(event_type in ('email.sent','email.delivered','email.delivery_delayed','email.bounced','email.complained','email.failed','email.suppressed')),
 occurred_at timestamptz not null, received_at timestamptz not null default now()
);
-- Events can arrive before an accepted send is recorded, so they deliberately
-- have no attempt FK; only exact provider_email_id matches may bind them.
create index client_email_delivery_events_email on public.client_email_delivery_events(email_id);
alter table public.client_email_attempts enable row level security;
alter table public.client_email_delivery_events enable row level security;
revoke all on public.client_email_attempts,public.client_email_delivery_events from anon,authenticated;
grant select on public.client_email_attempts,public.client_email_delivery_events to authenticated;
grant select,insert,update,delete on public.client_email_attempts,public.client_email_delivery_events to service_role;
create policy "Admins read client email attempts" on public.client_email_attempts for select to authenticated
 using (exists(select 1 from public.users where id=auth.uid() and role='admin'));
create policy "Admins read client email delivery events" on public.client_email_delivery_events for select to authenticated
 using (exists(select 1 from public.users where id=auth.uid() and role='admin'));
