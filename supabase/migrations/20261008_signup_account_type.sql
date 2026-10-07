-- Account type is onboarding intent only. Authorization always uses profiles.role.
alter table public.profiles add column account_type text not null default 'customer' check(account_type in ('customer','merchant'));
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into profiles(id,name,account_type,role) values(
  new.id,left(coalesce(new.raw_user_meta_data->>'name',''),120),
  case when new.raw_user_meta_data->>'account_type'='merchant' then 'merchant' else 'customer' end,
  'customer'
 );
 return new;
end $$;
