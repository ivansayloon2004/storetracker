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
  stock numeric(12, 2) not null default 0 check (stock >= 0),
  reorder_level numeric(12, 2) not null default 0 check (reorder_level >= 0),
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
  total numeric(12, 2) not null,
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

create unique index if not exists products_user_id_sku_unique
  on public.products (user_id, sku)
  where sku <> '';

create index if not exists products_user_id_idx on public.products (user_id);
create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_occurred_at_idx on public.transactions (occurred_at desc);
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
grant select, insert, update, delete on public.activity to authenticated;

-- After creating an administrator account, promote it with:
-- update public.profiles
-- set role = 'admin'
-- where email = 'your-admin-email@example.com';
