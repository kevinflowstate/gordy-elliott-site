-- Delivery state is server-only, like the report itself. The existing RLS and
-- grants deny both browser roles access to the table, including these columns.
alter table public.support_reports
  add column notification_sent_at timestamptz,
  add column notification_email_id text;
create index support_reports_pending_notifications
  on public.support_reports(created_at) where notification_sent_at is null;
