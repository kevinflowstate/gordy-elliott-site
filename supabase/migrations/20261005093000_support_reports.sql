-- Technical support is separate from coaching DM. Anonymous access is write-only
-- through the server; no direct anon/authenticated table or RPC access.
create table public.support_reports (
 id uuid primary key default gen_random_uuid(),
 submission_key uuid not null unique,
 reference text not null unique,
 name text not null check (length(name) between 1 and 100),
 email text not null check (length(email) <= 254),
 area text not null, description text not null check (length(description) between 1 and 4000),
 expected text not null default '', impact text not null, device text not null default '', page text not null default '',
 reporter_hash text not null,
 status text not null default 'New' check (status in ('New','Triaged','Needs more information','In progress','Ready to retest','Resolved','Duplicate')),
 priority text not null default 'Normal' check (priority in ('Low','Normal','High','Urgent')),
 owner text not null default '', internal_notes text not null default '', resolution text not null default '',
 image_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.support_reports enable row level security;
revoke all on public.support_reports from anon, authenticated;
grant select, insert, update, delete on public.support_reports to service_role;
create index support_reports_recent on public.support_reports (created_at desc);
create index support_reports_abuse on public.support_reports (reporter_hash, created_at desc);
create or replace function public.submit_support_report(p_input jsonb, p_reporter_hash text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare ticket public.support_reports; report_id uuid := gen_random_uuid();
begin
 -- One durable lock/rate counter across serverless instances. Idempotent retries
 -- return only the original receipt, never report content or private notes.
 perform pg_advisory_xact_lock(hashtextextended(p_reporter_hash, 0));
 select * into ticket from public.support_reports where submission_key = (p_input->>'submission_key')::uuid;
 if found then return jsonb_build_object('id',ticket.id,'reference',ticket.reference,'duplicate',true); end if;
 if (select count(*) from public.support_reports where reporter_hash=p_reporter_hash and created_at > now()-interval '1 hour') >= 5 then
  raise exception 'SUPPORT_RATE_LIMIT' using errcode='P0001';
 end if;
 insert into public.support_reports(id,submission_key,reference,name,email,area,description,expected,impact,device,page,reporter_hash)
 values(report_id,(p_input->>'submission_key')::uuid,'AC-'||upper(substr(replace(report_id::text,'-',''),1,12)),p_input->>'name',p_input->>'email',p_input->>'area',p_input->>'description',coalesce(p_input->>'expected',''),p_input->>'impact',coalesce(p_input->>'device',''),coalesce(p_input->>'page',''),p_reporter_hash)
 returning * into ticket;
 return jsonb_build_object('id',ticket.id,'reference',ticket.reference,'duplicate',false);
end $$;
revoke all on function public.submit_support_report(jsonb,text) from public, anon, authenticated;
grant execute on function public.submit_support_report(jsonb,text) to service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('support-images','support-images',false,2097152,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/jpeg'];
-- Restrictive guard remains effective even if an older installation has a broad
-- permissive storage policy. Service-role upload/signing bypasses RLS.
create policy "Support screenshots server only" on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'support-images')
with check (bucket_id <> 'support-images');

-- Bound expensive anonymous image work, including retries and rejected uploads.
create table public.support_request_limits (
 reporter_hash text primary key,
 window_start timestamptz not null default now(),
 requests integer not null default 1
);
alter table public.support_request_limits enable row level security;
revoke all on public.support_request_limits from anon, authenticated;
grant select, insert, update, delete on public.support_request_limits to service_role;
create index support_request_limits_expiry on public.support_request_limits(window_start);
create function public.reserve_support_request(p_reporter_hash text)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare request_count integer;
begin
 delete from public.support_request_limits where window_start < now()-interval '1 day';
 insert into public.support_request_limits(reporter_hash) values(p_reporter_hash)
 on conflict(reporter_hash) do update set
 window_start=case when support_request_limits.window_start < now()-interval '10 minutes' then now() else support_request_limits.window_start end,
 requests=case when support_request_limits.window_start < now()-interval '10 minutes' then 1 else support_request_limits.requests+1 end
 returning requests into request_count;
 if request_count>20 then raise exception 'SUPPORT_REQUEST_LIMIT' using errcode='P0001'; end if;
end $$;
revoke all on function public.reserve_support_request(text) from public,anon,authenticated;
grant execute on function public.reserve_support_request(text) to service_role;
