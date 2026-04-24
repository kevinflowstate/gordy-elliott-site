do $$
declare
  constraint_name text;
begin
  select con.conname
  into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'client_profiles'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%tier%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.client_profiles drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.client_profiles
  add constraint client_profiles_tier_check
  check (tier in ('coached', 'premium', 'vip', 'ai_only'));
