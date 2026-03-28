create extension if not exists pgcrypto;

create schema if not exists private;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'store' check (role in ('store', 'admin')),
  store_name text not null default 'My Store',
  owner_name text not null default 'Store Owner',
  email text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_login_at timestamptz not null default timezone('utc', now())
);

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

create table if not exists public.products (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  sku text not null default '',
  name text not null,
  category text not null,
  unit text not null,
  price numeric(12, 2) not null default 0 check (price >= 0),
  cost_price numeric(12, 2) not null default 0 check (cost_price >= 0),
  stock numeric(12, 2) not null default 0 check (stock >= 0),
  reorder_level numeric(12, 2) not null default 0 check (reorder_level >= 0),
  image_url text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('sale', 'restock')),
  product_id text,
  product_name text not null,
  quantity numeric(12, 2) not null,
  unit text not null,
  unit_price numeric(12, 2) not null,
  unit_cost numeric(12, 2) not null default 0,
  cost_total numeric(12, 2) not null default 0,
  profit_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  customer_name text not null default '',
  receipt_number text not null default '',
  note text not null default '',
  occurred_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.debts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_type text not null check (entry_type in ('charge', 'payment')),
  customer_name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  note text not null default '',
  occurred_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expenses (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  amount numeric(12, 2) not null check (amount > 0),
  note text not null default '',
  occurred_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.activity (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  message text not null,
  product_id text,
  product_name text not null default '',
  occurred_at timestamptz not null default timezone('utc', now())
);

alter table public.products
  add column if not exists cost_price numeric(12, 2);

alter table public.products
  add column if not exists image_url text;

update public.products
set
  cost_price = coalesce(cost_price, price),
  image_url = coalesce(image_url, '')
where cost_price is null
   or image_url is null;

alter table public.products
  alter column cost_price set default 0;

alter table public.products
  alter column cost_price set not null;

alter table public.products
  alter column image_url set default '';

alter table public.products
  alter column image_url set not null;

alter table public.transactions
  add column if not exists unit_cost numeric(12, 2);

alter table public.transactions
  add column if not exists cost_total numeric(12, 2);

alter table public.transactions
  add column if not exists profit_amount numeric(12, 2);

alter table public.transactions
  add column if not exists customer_name text;

alter table public.transactions
  add column if not exists receipt_number text;

update public.transactions
set
  unit_cost = coalesce(unit_cost, unit_price),
  cost_total = coalesce(cost_total, quantity * coalesce(unit_cost, unit_price)),
  profit_amount = coalesce(
    profit_amount,
    case
      when type = 'sale' then total - (quantity * coalesce(unit_cost, unit_price))
      else 0
    end
  ),
  customer_name = coalesce(customer_name, ''),
  receipt_number = coalesce(
    receipt_number,
    case
      when type = 'sale' then 'REC-' || upper(left(replace(id, 'txn-', ''), 12))
      else ''
    end
  )
where unit_cost is null
   or cost_total is null
   or profit_amount is null
   or customer_name is null
   or receipt_number is null;

alter table public.transactions
  alter column unit_cost set default 0;

alter table public.transactions
  alter column unit_cost set not null;

alter table public.transactions
  alter column cost_total set default 0;

alter table public.transactions
  alter column cost_total set not null;

alter table public.transactions
  alter column profit_amount set default 0;

alter table public.transactions
  alter column profit_amount set not null;

alter table public.transactions
  alter column customer_name set default '';

alter table public.transactions
  alter column customer_name set not null;

alter table public.transactions
  alter column receipt_number set default '';

alter table public.transactions
  alter column receipt_number set not null;

create unique index if not exists products_user_id_sku_unique
  on public.products (user_id, sku)
  where sku <> '';

create unique index if not exists transactions_user_id_receipt_number_unique
  on public.transactions (user_id, receipt_number)
  where receipt_number <> '';

create index if not exists products_user_id_idx on public.products (user_id);
create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_occurred_at_idx on public.transactions (occurred_at desc);
create index if not exists debts_user_id_idx on public.debts (user_id);
create index if not exists debts_occurred_at_idx on public.debts (occurred_at desc);
create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists expenses_occurred_at_idx on public.expenses (occurred_at desc);
create index if not exists activity_user_id_idx on public.activity (user_id);
create index if not exists activity_occurred_at_idx on public.activity (occurred_at desc);

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_row_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row
execute function public.set_row_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_role text;
  incoming_owner text;
  incoming_store text;
begin
  incoming_role := case
    when coalesce(new.raw_user_meta_data ->> 'role', 'store') = 'admin' then 'admin'
    else 'store'
  end;

  incoming_owner := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'owner_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    'Store Owner'
  );

  incoming_store := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'store_name'), ''),
    'My Store'
  );

  insert into public.profiles (
    user_id,
    role,
    store_name,
    owner_name,
    email,
    created_at,
    updated_at,
    last_login_at
  )
  values (
    new.id,
    incoming_role,
    incoming_store,
    incoming_owner,
    coalesce(new.email, ''),
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.debts enable row level security;
alter table public.expenses enable row level security;
alter table public.activity enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id or private.is_admin())
with check ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists profiles_delete_self_or_admin on public.profiles;
create policy profiles_delete_self_or_admin
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists products_select_self_or_admin on public.products;
create policy products_select_self_or_admin
on public.products
for select
to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists products_insert_self_or_admin on public.products;
create policy products_insert_self_or_admin
on public.products
for insert
to authenticated
with check ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists products_update_self_or_admin on public.products;
create policy products_update_self_or_admin
on public.products
for update
to authenticated
using ((select auth.uid()) = user_id or private.is_admin())
with check ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists products_delete_self_or_admin on public.products;
create policy products_delete_self_or_admin
on public.products
for delete
to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists transactions_select_self_or_admin on public.transactions;
create policy transactions_select_self_or_admin
on public.transactions
for select
to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists transactions_insert_self_or_admin on public.transactions;
create policy transactions_insert_self_or_admin
on public.transactions
for insert
to authenticated
with check ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists transactions_update_self_or_admin on public.transactions;
create policy transactions_update_self_or_admin
on public.transactions
for update
to authenticated
using ((select auth.uid()) = user_id or private.is_admin())
with check ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists transactions_delete_self_or_admin on public.transactions;
create policy transactions_delete_self_or_admin
on public.transactions
for delete
to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists debts_select_self_or_admin on public.debts;
create policy debts_select_self_or_admin
on public.debts
for select
to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists debts_insert_self_or_admin on public.debts;
create policy debts_insert_self_or_admin
on public.debts
for insert
to authenticated
with check ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists debts_update_self_or_admin on public.debts;
create policy debts_update_self_or_admin
on public.debts
for update
to authenticated
using ((select auth.uid()) = user_id or private.is_admin())
with check ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists debts_delete_self_or_admin on public.debts;
create policy debts_delete_self_or_admin
on public.debts
for delete
to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists expenses_select_self_or_admin on public.expenses;
create policy expenses_select_self_or_admin
on public.expenses
for select
to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists expenses_insert_self_or_admin on public.expenses;
create policy expenses_insert_self_or_admin
on public.expenses
for insert
to authenticated
with check ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists expenses_update_self_or_admin on public.expenses;
create policy expenses_update_self_or_admin
on public.expenses
for update
to authenticated
using ((select auth.uid()) = user_id or private.is_admin())
with check ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists expenses_delete_self_or_admin on public.expenses;
create policy expenses_delete_self_or_admin
on public.expenses
for delete
to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists activity_select_self_or_admin on public.activity;
create policy activity_select_self_or_admin
on public.activity
for select
to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists activity_insert_self_or_admin on public.activity;
create policy activity_insert_self_or_admin
on public.activity
for insert
to authenticated
with check ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists activity_update_self_or_admin on public.activity;
create policy activity_update_self_or_admin
on public.activity
for update
to authenticated
using ((select auth.uid()) = user_id or private.is_admin())
with check ((select auth.uid()) = user_id or private.is_admin());

drop policy if exists activity_delete_self_or_admin on public.activity;
create policy activity_delete_self_or_admin
on public.activity
for delete
to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.debts to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.activity to authenticated;

-- After creating an administrator account, promote it with:
-- update public.profiles
-- set role = 'admin'
-- where email = 'your-admin-email@example.com';
