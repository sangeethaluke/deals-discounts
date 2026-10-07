create table public.merchant_applications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id),
 name text not null check(length(name) between 1 and 120), category_id uuid not null references public.categories(id),
 city text not null check(length(city) between 1 and 120), address text not null check(length(address) between 1 and 500),
 phone text not null check(length(phone) between 1 and 120), status text not null default 'pending' check(status in ('pending','approved'))
);
alter table public.merchant_applications enable row level security;
create policy read_applications on public.merchant_applications for select to authenticated using(user_id=auth.uid() or public.is_admin());
grant select on public.merchant_applications to authenticated;
create function public.request_merchant_registration(business_name text, category uuid, business_city text, business_address text, contact_phone text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from profiles where id=auth.uid() and active) then raise exception 'Active account required'; end if;
 insert into merchant_applications(user_id,name,category_id,city,address,phone) values(auth.uid(),trim(business_name),category,trim(business_city),trim(business_address),trim(contact_phone));
end $$;
create function public.approve_merchant_registration(application_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare a merchant_applications%rowtype;
begin
 if not is_admin() then raise exception 'Administrator required'; end if;
 select * into a from merchant_applications where id=application_id for update;
 if not found or a.status<>'pending' then raise exception 'Pending application required'; end if;
 if not exists(select 1 from profiles where id=a.user_id and active and role<>'admin') then raise exception 'Active non-admin account required'; end if;
 update profiles set role='merchant' where id=a.user_id;
 insert into shops(name,category_id,city,state,address,owner_id,active) values(a.name,a.category_id,a.city,'Andhra Pradesh',a.address,a.user_id,true);
 update merchant_applications set status='approved' where id=a.id;
end $$;
revoke all on function public.request_merchant_registration(text,uuid,text,text,text),public.approve_merchant_registration(uuid) from public,anon;
grant execute on function public.request_merchant_registration(text,uuid,text,text,text),public.approve_merchant_registration(uuid) to authenticated;
