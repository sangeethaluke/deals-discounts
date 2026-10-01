-- Apply to an existing installation before using Merchant Studio.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('customer','merchant','admin'));
alter table public.shops add column owner_id uuid references public.profiles(id) on delete set null;
create index shops_owner_id_idx on public.shops(owner_id);
create function public.owns_shop(shop uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from shops s join profiles p on p.id=s.owner_id where s.id=shop and p.id=auth.uid() and p.role='merchant' and p.active)
$$;
create policy merchant_read_shops on public.shops for select to authenticated using(owns_shop(id));
create policy merchant_update_shops on public.shops for update to authenticated using(owns_shop(id)) with check(owns_shop(id));
create policy merchant_read_deals on public.deals for select to authenticated using(owns_shop(shop_id));
create policy merchant_insert_deals on public.deals for insert to authenticated with check(owns_shop(shop_id) and not featured);
create policy merchant_update_deals on public.deals for update to authenticated using(owns_shop(shop_id)) with check(owns_shop(shop_id));
create function public.guard_merchant_listing() returns trigger language plpgsql set search_path=public as $$
begin
 if current_user <> 'postgres' and not is_admin() then
  if new.featured is distinct from old.featured then raise exception 'Administrator required to feature listings'; end if;
  if TG_TABLE_NAME='shops' then
   if new.owner_id is distinct from old.owner_id or new.id is distinct from old.id then raise exception 'Administrator required to assign shops'; end if;
  else
   if new.shop_id is distinct from old.shop_id or new.id is distinct from old.id then raise exception 'Administrator required to move offers'; end if;
  end if;
 end if;
 return new;
end $$;
create trigger guard_merchant_shop before update on public.shops for each row execute function public.guard_merchant_listing();
create trigger guard_merchant_deal before update on public.deals for each row execute function public.guard_merchant_listing();
