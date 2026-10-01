-- Run once in a fresh Supabase project's SQL editor.
create table public.categories (id uuid primary key default gen_random_uuid(), name text not null unique check(length(name) between 1 and 80), icon text not null default 'store');
create table public.shops (id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120), category_id uuid references categories on delete restrict not null, city text not null, state text not null, address text not null, description text not null default '', image text not null default '', featured boolean not null default false, restaurant boolean not null default false, active boolean not null default true);
create table public.deals (id uuid primary key default gen_random_uuid(),shop_id uuid not null references shops on delete restrict,title text not null check(length(title) between 1 and 150),description text not null default '',price integer not null check(price>0),original_price integer not null check(original_price>=price),stock integer not null check(stock>=0),image text not null default '',active boolean not null default true,featured boolean not null default false,expires_at timestamptz not null);
create table public.profiles(id uuid primary key references auth.users on delete cascade,name text not null default '' check(length(name)<=120),phone text not null default '' check(length(phone)<=30),role text not null default 'customer' check(role in ('customer','admin')),active boolean not null default true);
create table public.orders(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles,created_at timestamptz not null default now(),total integer not null check(total>0),status text not null default 'placed' check(status in ('placed','confirmed','ready','completed','cancelled')),address text not null check(length(address) between 10 and 500),request_id uuid not null,unique(user_id,request_id));
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references orders on delete cascade,deal_id uuid not null references deals,title text not null,quantity integer not null check(quantity between 1 and 20),unit_price integer not null check(unit_price>0));
create index on shops(city,state); create index on deals(shop_id); create index on orders(user_id); create index on order_items(order_id);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into profiles(id,name) values(new.id,left(coalesce(new.raw_user_meta_data->>'name',''),120)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin' and active) $$;
alter table categories enable row level security; alter table shops enable row level security; alter table deals enable row level security; alter table profiles enable row level security; alter table orders enable row level security; alter table order_items enable row level security;
create policy read_categories on categories for select using(true);
create policy read_shops on shops for select using(active or is_admin());
create policy read_deals on deals for select using((active and exists(select 1 from shops where shops.id=shop_id and shops.active)) or is_admin());
create policy admin_categories on categories for all to authenticated using(is_admin()) with check(is_admin());
create policy admin_shops on shops for all to authenticated using(is_admin()) with check(is_admin());
create policy admin_deals on deals for all to authenticated using(is_admin()) with check(is_admin());
create policy read_profile on profiles for select to authenticated using(id=auth.uid() or is_admin());
create policy update_profile on profiles for update to authenticated using(id=auth.uid() or is_admin()) with check(id=auth.uid() or is_admin());
-- Protect sensitive profile fields even on direct API calls.
create function public.guard_profile() returns trigger language plpgsql set search_path=public as $$ begin if (new.role<>old.role or new.active<>old.active) and current_user<>'postgres' and not is_admin() then raise exception 'Administrator required'; end if; return new; end $$;
create trigger guard_profile before update on profiles for each row execute procedure guard_profile();
create policy read_orders on orders for select to authenticated using(user_id=auth.uid() or is_admin());
create policy read_items on order_items for select to authenticated using(exists(select 1 from orders where orders.id=order_id and (orders.user_id=auth.uid() or is_admin())));
-- No client INSERT/UPDATE policies for orders or items: all mutations go through atomic functions.
create function public.place_order(items jsonb, address text, request_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare item record; d deals%rowtype; oid uuid; total_cost bigint:=0; uid uuid:=auth.uid();
begin
 if uid is null or not exists(select 1 from profiles where id=uid and active) then raise exception 'Sign in with an active account'; end if;
 if length(trim(address)) not between 10 and 500 or jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 50 or request_id is null then raise exception 'Invalid checkout'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select id into oid from orders where user_id=uid and orders.request_id=place_order.request_id; if oid is not null then return oid; end if;
 if (select count(*) from jsonb_array_elements(items)) <> (select count(distinct value->>'deal_id') from jsonb_array_elements(items)) then raise exception 'Duplicate items'; end if;
 -- Deterministic row locking prevents overselling and minimizes deadlocks.
 for item in select * from jsonb_to_recordset(items) as x(deal_id uuid, quantity integer) order by deal_id loop
  if item.quantity is null or item.quantity not between 1 and 20 then raise exception 'Invalid quantity'; end if;
  select * into d from deals where id=item.deal_id for update;
  if not found or not d.active or d.expires_at<=now() or d.stock<item.quantity or not exists(select 1 from shops where id=d.shop_id and active) then raise exception 'An item is no longer available'; end if;
  total_cost:=total_cost+d.price::bigint*item.quantity;
 end loop;
 insert into orders(user_id,total,address,request_id) values(uid,total_cost,trim(address),request_id) returning id into oid;
 for item in select * from jsonb_to_recordset(items) as x(deal_id uuid,quantity integer) loop
  select * into d from deals where id=item.deal_id;
  insert into order_items(order_id,deal_id,title,quantity,unit_price) values(oid,d.id,d.title,item.quantity,d.price);
  update deals set stock=stock-item.quantity where id=d.id;
 end loop;
 return oid;
end $$;
create function public.change_order_status(order_id uuid,new_status text) returns void language plpgsql security definer set search_path=public as $$
declare old_status text; item record;
begin
 if not is_admin() then raise exception 'Administrator required'; end if;
 select status into old_status from orders where id=order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if new_status=old_status then return; end if;
 if not ((old_status='placed' and new_status in ('confirmed','cancelled')) or (old_status='confirmed' and new_status in ('ready','cancelled')) or (old_status='ready' and new_status in ('completed','cancelled'))) then raise exception 'Invalid status transition'; end if;
 if new_status='cancelled' then for item in select * from order_items where order_items.order_id=change_order_status.order_id order by deal_id loop update deals set stock=stock+item.quantity where id=item.deal_id; end loop; end if;
 update orders set status=new_status where id=order_id;
end $$;
revoke all on function public.place_order(jsonb,text,uuid) from public,anon; grant execute on function public.place_order(jsonb,text,uuid) to authenticated;
revoke all on function public.change_order_status(uuid,text) from public,anon; grant execute on function public.change_order_status(uuid,text) to authenticated;
grant usage on schema public to anon,authenticated;
grant select on categories,shops,deals to anon;
grant select,insert,update,delete on categories,shops,deals to authenticated;
grant select,update on profiles to authenticated;
grant select on orders,order_items to authenticated;
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
