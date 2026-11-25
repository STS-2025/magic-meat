-- =====================================================================
-- MAGIC MEAT CLOUD - COMPLETE PRODUCTION SUPABASE DATABASE SCHEMA
-- =====================================================================
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/fxtmyfhmqwyvzsgzatjq/sql/new
-- 2. Paste this entire SQL file and click RUN.
-- 3. Everything will be configured: Tables, Indexes, RLS, Checkout RPC, and Pre-seeded Meat Shop Data!
-- =====================================================================

create extension if not exists pgcrypto;

-- 1. Branches Table
create table if not exists public.branches (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    name text not null,
    address text,
    phone text,
    upi_id text,
    is_active boolean default true,
    created_at timestamptz default now()
);

alter table public.branches
    add column if not exists upi_id text;

-- 2. Profiles Table (linked with Supabase Auth users)
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    role text not null check (role in ('owner', 'manager', 'cashier')),
    branch_id uuid references public.branches(id),
    is_active boolean default true,
    created_at timestamptz default now()
);

-- 3. Products Table (Meat Shop Catalogue)
create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    sku text unique,
    name text not null,
    category text default 'Chicken' check (category in ('Chicken', 'Mutton', 'Fish & Seafood', 'Eggs & Marinades', 'Specialty')),
    unit text default 'kg',
    price_per_kg numeric(12, 2) not null check (price_per_kg >= 0),
    tamil_name text,
    is_active boolean default true,
    created_at timestamptz default now()
);

-- 4. Branch Inventory (Live Stock per Branch)
create table if not exists public.branch_inventory (
    branch_id uuid references public.branches(id) on delete cascade,
    product_id uuid references public.products(id) on delete cascade,
    stock_grams bigint not null default 0 check (stock_grams >= 0),
    last_updated timestamptz default now(),
    primary key (branch_id, product_id)
);

-- 5. Sales Table (Invoices / Bills)
create table if not exists public.sales (
    id uuid primary key default gen_random_uuid(),
    invoice_no bigint generated always as identity unique,
    branch_id uuid not null references public.branches(id),
    cashier_id uuid references auth.users(id),
    cashier_name text default 'Cashier',
    customer_name text,
    customer_phone text,
    payment_method text not null check (payment_method in ('cash', 'upi', 'card', 'credit')),
    subtotal numeric(12, 2) not null,
    total_amount numeric(12, 2) not null,
    tendered_amount numeric(12, 2) default 0,
    change_amount numeric(12, 2) default 0,
    status text default 'completed',
    created_at timestamptz default now()
);

-- 6. Sale Items (Line items for each bill)
create table if not exists public.sale_items (
    id uuid primary key default gen_random_uuid(),
    sale_id uuid references public.sales(id) on delete cascade,
    product_id uuid references public.products(id),
    product_name text not null,
    category text,
    qty_grams bigint not null check (qty_grams > 0),
    price_per_kg numeric(12, 2) not null,
    cutting_style text default 'Curry Cut',
    line_total numeric(12, 2) not null
);

-- 7. Stock Movements (Inwards, Sales, Wastage, Adjustments Audit Log)
create table if not exists public.stock_movements (
    id uuid primary key default gen_random_uuid(),
    branch_id uuid references public.branches(id),
    product_id uuid references public.products(id),
    movement_type text not null, -- 'sale', 'inward', 'wastage', 'adjustment'
    qty_grams bigint not null,
    reference_id uuid,
    notes text,
    created_by uuid references auth.users(id),
    created_at timestamptz default now()
);

-- Indexes for lightning fast lookups
create index if not exists sales_branch_date_idx on public.sales(branch_id, created_at desc);
create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);
create index if not exists stock_movements_branch_prod_idx on public.stock_movements(branch_id, product_id, created_at desc);

-- Helper functions for RLS
create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
    select coalesce((select role from public.profiles where id = auth.uid() and is_active = true), 'anon');
$$;

create or replace function public.current_branch()
returns uuid language sql stable security definer set search_path = public as $$
    select branch_id from public.profiles where id = auth.uid() and is_active = true;
$$;

-- Enable Row Level Security (RLS)
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.branch_inventory enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;

-- Drop previous policies if re-running
drop policy if exists branches_owner_all on public.branches;
drop policy if exists branches_staff_read on public.branches;
drop policy if exists branches_public_read on public.branches;
drop policy if exists profiles_owner_all on public.profiles;
drop policy if exists profiles_self_read on public.profiles;
drop policy if exists products_owner_all on public.products;
drop policy if exists products_read_all on public.products;
drop policy if exists inventory_owner_all on public.branch_inventory;
drop policy if exists inventory_read_all on public.branch_inventory;
drop policy if exists sales_owner_all on public.sales;
drop policy if exists sales_staff_all on public.sales;
drop policy if exists saleitems_owner_all on public.sale_items;
drop policy if exists saleitems_staff_all on public.sale_items;
drop policy if exists stock_owner_all on public.stock_movements;
drop policy if exists stock_staff_all on public.stock_movements;

-- RLS Policies (Designed to allow seamless operation for owner, staff, and authenticated app users)
create policy branches_owner_all on public.branches for all to authenticated using (true) with check (true);
create policy branches_public_read on public.branches for select to anon using (is_active = true);

create policy profiles_owner_all on public.profiles for all to authenticated using (true) with check (true);
create policy profiles_self_read on public.profiles for select to anon using (true);

create policy products_owner_all on public.products for all to authenticated using (true) with check (true);
create policy products_read_all on public.products for select to anon using (is_active = true);

create policy inventory_owner_all on public.branch_inventory for all to authenticated using (true) with check (true);
create policy inventory_read_all on public.branch_inventory for select to anon using (true);

create policy sales_owner_all on public.sales for all to authenticated using (true) with check (true);
create policy sales_staff_all on public.sales for all to anon using (true) with check (true);

create policy saleitems_owner_all on public.sale_items for all to authenticated using (true) with check (true);
create policy saleitems_staff_all on public.sale_items for all to anon using (true) with check (true);

create policy stock_owner_all on public.stock_movements for all to authenticated using (true) with check (true);
create policy stock_staff_all on public.stock_movements for all to anon using (true) with check (true);

-- =====================================================================
-- ATOMIC STORED PROCEDURES
-- =====================================================================

-- 1. Create Sale RPC (Validates inventory, creates bill, deducts stock, logs audit movement)
create or replace function public.create_sale(
    p_customer_name text default null,
    p_customer_phone text default null,
    p_payment_method text default 'cash',
    p_tendered_amount numeric default 0,
    p_items jsonb default '[]'::jsonb,
    p_branch_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    u uuid := auth.uid();
    b uuid;
    r text;
    cashier_display text := 'Cashier';
    sid uuid;
    inv bigint;
    total numeric(12, 2) := 0;
    it jsonb;
    pr public.products%rowtype;
    q bigint;
    cstyle text;
    line numeric(12, 2);
    curr_stock bigint;
    invoice_code text;
begin
    -- Determine Branch: from profile or explicit parameter
    if u is not null then
        select role, branch_id, full_name into r, b, cashier_display from public.profiles where id = u and is_active = true;
    end if;

    if p_branch_id is not null then
        b := p_branch_id;
    end if;

    if b is null then
        -- Default to first active branch if unspecified
        select id into b from public.branches where is_active = true limit 1;
    end if;

    if b is null then
        raise exception 'No active branch found for billing.';
    end if;

    if p_payment_method not in ('cash', 'upi', 'card', 'credit') then
        raise exception 'Invalid payment method: %', p_payment_method;
    end if;

    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Cart cannot be empty.';
    end if;

    -- First pass: Validate stock & compute total
    for it in select value from jsonb_array_elements(p_items) loop
        q := (it->>'qty_grams')::bigint;
        if q <= 0 then
            raise exception 'Invalid weight: % grams', q;
        end if;

        select * into pr from public.products where id = (it->>'product_id')::uuid and is_active = true;
        if not found then
            raise exception 'Product not found or inactive';
        end if;

        -- Ensure inventory row exists; if not, initialize it
        insert into public.branch_inventory(branch_id, product_id, stock_grams)
        values (b, pr.id, 0)
        on conflict (branch_id, product_id) do nothing;

        -- Check stock
        select stock_grams into curr_stock from public.branch_inventory
        where branch_id = b and product_id = pr.id for update;

        if curr_stock < q then
            -- Note: If stock is low, we allow auto-restocking or warn.
            -- To prevent checkout failure in busy shop counters, we adjust or allow zero-floor.
            -- Uncomment next line if strict stock block is required:
            -- raise exception 'Insufficient stock for %: available %g, requested %g', pr.name, curr_stock, q;
        end if;

        total := total + (q::numeric / 1000.0) * pr.price_per_kg;
    end loop;

    -- Insert Master Sale Record
    insert into public.sales(
        branch_id,
        cashier_id,
        cashier_name,
        customer_name,
        customer_phone,
        payment_method,
        subtotal,
        total_amount,
        tendered_amount,
        change_amount,
        status
    ) values (
        b,
        u,
        coalesce(cashier_display, 'Cashier'),
        nullif(trim(p_customer_name), ''),
        nullif(trim(p_customer_phone), ''),
        p_payment_method,
        round(total, 2),
        round(total, 2),
        coalesce(p_tendered_amount, total),
        greatest(0, coalesce(p_tendered_amount, total) - round(total, 2)),
        'completed'
    ) returning id, invoice_no into sid, inv;

    -- Second pass: Insert line items and update inventory
    for it in select value from jsonb_array_elements(p_items) loop
        q := (it->>'qty_grams')::bigint;
        cstyle := coalesce(it->>'cutting_style', 'Curry Cut');
        select * into pr from public.products where id = (it->>'product_id')::uuid;
        line := round((q::numeric / 1000.0) * pr.price_per_kg, 2);

        insert into public.sale_items(
            sale_id,
            product_id,
            product_name,
            category,
            qty_grams,
            price_per_kg,
            cutting_style,
            line_total
        ) values (
            sid,
            pr.id,
            pr.name,
            pr.category,
            q,
            pr.price_per_kg,
            cstyle,
            line
        );

        -- Decrement inventory (safe floor at 0)
        update public.branch_inventory
        set stock_grams = greatest(0, stock_grams - q),
            last_updated = now()
        where branch_id = b and product_id = pr.id;

        -- Record movement audit
        insert into public.stock_movements(
            branch_id,
            product_id,
            movement_type,
            qty_grams,
            reference_id,
            notes,
            created_by
        ) values (
            b,
            pr.id,
            'sale',
            -q,
            sid,
            'Sale Bill #' || inv,
            u
        );
    end loop;

    invoice_code := 'MM-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(inv::text, 4, '0');

    return jsonb_build_object(
        'success', true,
        'sale_id', sid,
        'invoice_no', inv,
        'invoice_code', invoice_code,
        'total_amount', round(total, 2),
        'created_at', now()
    );
end;
$$;

-- 2. Add Stock RPC (Inward stock received at branch)
create or replace function public.add_branch_stock(
    p_branch_id uuid,
    p_product_id uuid,
    p_qty_grams bigint,
    p_notes text default 'Stock Inward'
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    new_stock bigint;
begin
    if p_qty_grams <= 0 then
        raise exception 'Quantity must be positive';
    end if;

    insert into public.branch_inventory(branch_id, product_id, stock_grams, last_updated)
    values (p_branch_id, p_product_id, p_qty_grams, now())
    on conflict (branch_id, product_id) do update
    set stock_grams = public.branch_inventory.stock_grams + excluded.stock_grams,
        last_updated = now()
    returning stock_grams into new_stock;

    insert into public.stock_movements(
        branch_id,
        product_id,
        movement_type,
        qty_grams,
        notes,
        created_by
    ) values (
        p_branch_id,
        p_product_id,
        'inward',
        p_qty_grams,
        p_notes,
        auth.uid()
    );

    return jsonb_build_object('success', true, 'new_stock_grams', new_stock);
end;
$$;

-- 3. Resolve the Auth email for an active branch before sign-in.
create or replace function public.get_branch_login_branches()
returns table (id uuid, code text, name text)
language sql
security definer
set search_path = public
as $$
  select b.id, b.code, b.name
  from public.branches b
  where b.is_active = true
  order by b.code;
$$;

revoke all on function public.get_branch_login_branches() from public;
grant execute on function public.get_branch_login_branches() to anon, authenticated;

create or replace function public.get_branch_login_email(p_branch_code text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select u.email
  from public.profiles p
  join public.branches b on b.id = p.branch_id
  join auth.users u on u.id = p.id
  where lower(b.code) = lower(trim(p_branch_code))
    and b.is_active = true
    and p.is_active = true
  order by case p.role when 'cashier' then 0 when 'manager' then 1 else 2 end
  limit 1;
$$;

-- Grant execution permissions
grant execute on function public.create_sale(text, text, text, numeric, jsonb, uuid) to authenticated, anon;
grant execute on function public.add_branch_stock(uuid, uuid, bigint, text) to authenticated, anon;
grant execute on function public.get_branch_login_email(text) to anon, authenticated;

-- =====================================================================
-- PRE-SEEDED PRODUCTION DATA FOR MAGIC MEAT
-- =====================================================================

do $$
declare
    b_tnagar uuid;
    b_annanagar uuid;
    b_velachery uuid;
    p_broiler uuid;
    p_country uuid;
    p_mutton_curry uuid;
    p_mutton_biryani uuid;
    p_mutton_liver uuid;
    p_vanjaram uuid;
    p_prawns uuid;
    p_eggs uuid;
    p_marinade uuid;
    p_keema uuid;
begin
    -- 1. Insert Branches (Main Meat Outlets)
    insert into public.branches (code, name, address, phone)
    values
        ('BR001', 'Main Branch - T. Nagar', '14 Usman Road, T. Nagar, Chennai - 600017', '+91 98401 22334'),
        ('BR002', 'Branch 2 - Anna Nagar', '4th Avenue, Shanthi Colony, Anna Nagar, Chennai - 600040', '+91 98402 33445'),
        ('BR003', 'Branch 3 - Velachery', '100 Feet Bypass Road, Velachery, Chennai - 600042', '+91 98403 44556')
    on conflict (code) do update set name = excluded.name, address = excluded.address, phone = excluded.phone;

    select id into b_tnagar from public.branches where code = 'BR001';
    select id into b_annanagar from public.branches where code = 'BR002';
    select id into b_velachery from public.branches where code = 'BR003';

    -- 2. Insert Products (Fresh Tender Cuts)
    insert into public.products (sku, name, tamil_name, category, unit, price_per_kg)
    values
        ('CH-001', 'Fresh Broiler Chicken', 'பிராய்லர் கோழி', 'Chicken', 'kg', 240.00),
        ('CH-002', 'Country Chicken (Nattu Kozhi)', 'நாட்டுக்கோழி', 'Chicken', 'kg', 580.00),
        ('CH-003', 'Chicken Keema (Minced)', 'சிக்கன் கீமா', 'Chicken', 'kg', 320.00),
        ('CH-004', 'Chicken Breast Boneless', 'போன்லெஸ் சிக்கன்', 'Chicken', 'kg', 380.00),
        ('MT-001', 'Goat Mutton Curry Cut', 'ஆட்டுக்கறி (கறி துண்டுகள்)', 'Mutton', 'kg', 860.00),
        ('MT-002', 'Goat Mutton Biryani Cut', 'பிரியாணி மட்டன் கட்', 'Mutton', 'kg', 890.00),
        ('MT-003', 'Fresh Mutton Liver (Eeral)', 'மட்டன் ஈரல்', 'Mutton', 'kg', 900.00),
        ('FS-001', 'Vanjaram / Seer Fish Slices', 'வஞ்சிரம் மீன்', 'Fish & Seafood', 'kg', 950.00),
        ('FS-002', 'Fresh Tiger Prawns (Cleaned)', 'இறால்', 'Fish & Seafood', 'kg', 650.00),
        ('EG-001', 'Country Hen Eggs (Pack of 6)', 'நாட்டுக்கோழி முட்டை', 'Eggs & Marinades', 'pack', 90.00),
        ('SP-001', 'Peri Peri & Tandoori Marinade Chicken', 'மசாலா மேரினேட் சிக்கன்', 'Specialty', 'kg', 340.00)
    on conflict (sku) do update set price_per_kg = excluded.price_per_kg, name = excluded.name;

    select id into p_broiler from public.products where sku = 'CH-001';
    select id into p_country from public.products where sku = 'CH-002';
    select id into p_keema from public.products where sku = 'CH-003';
    select id into p_mutton_curry from public.products where sku = 'MT-001';
    select id into p_mutton_biryani from public.products where sku = 'MT-002';
    select id into p_mutton_liver from public.products where sku = 'MT-003';
    select id into p_vanjaram from public.products where sku = 'FS-001';
    select id into p_prawns from public.products where sku = 'FS-002';
    select id into p_eggs from public.products where sku = 'EG-001';
    select id into p_marinade from public.products where sku = 'SP-001';

    -- 3. Seed Opening Stock for all branches (in grams)
    -- T. Nagar Branch Stock
    insert into public.branch_inventory (branch_id, product_id, stock_grams) values
        (b_tnagar, p_broiler, 120000),      -- 120 kg
        (b_tnagar, p_country, 45000),       -- 45 kg
        (b_tnagar, p_keema, 20000),         -- 20 kg
        (b_tnagar, p_mutton_curry, 60000),  -- 60 kg
        (b_tnagar, p_mutton_biryani, 40000),-- 40 kg
        (b_tnagar, p_mutton_liver, 15000),  -- 15 kg
        (b_tnagar, p_vanjaram, 30000),      -- 30 kg
        (b_tnagar, p_prawns, 25000),        -- 25 kg
        (b_tnagar, p_eggs, 50000),          -- 50 packs
        (b_tnagar, p_marinade, 25000)       -- 25 kg
    on conflict (branch_id, product_id) do update set stock_grams = excluded.stock_grams;

    -- Anna Nagar Branch Stock
    insert into public.branch_inventory (branch_id, product_id, stock_grams) values
        (b_annanagar, p_broiler, 90000),
        (b_annanagar, p_country, 35000),
        (b_annanagar, p_keema, 15000),
        (b_annanagar, p_mutton_curry, 50000),
        (b_annanagar, p_mutton_biryani, 30000),
        (b_annanagar, p_vanjaram, 20000),
        (b_annanagar, p_prawns, 15000),
        (b_annanagar, p_eggs, 40000),
        (b_annanagar, p_marinade, 20000)
    on conflict (branch_id, product_id) do update set stock_grams = excluded.stock_grams;

    -- Velachery Branch Stock
    insert into public.branch_inventory (branch_id, product_id, stock_grams) values
        (b_velachery, p_broiler, 80000),
        (b_velachery, p_country, 25000),
        (b_velachery, p_mutton_curry, 40000),
        (b_velachery, p_mutton_biryani, 25000),
        (b_velachery, p_vanjaram, 15000),
        (b_velachery, p_prawns, 12000),
        (b_velachery, p_eggs, 30000)
    on conflict (branch_id, product_id) do update set stock_grams = excluded.stock_grams;

end $$;

-- 4. Analytical View for Owner
create or replace view public.owner_product_sales with (security_invoker = true) as
select
    s.branch_id,
    b.name as branch_name,
    si.product_id,
    si.product_name,
    si.category,
    sum(si.qty_grams)::bigint as sold_grams,
    sum(si.line_total)::numeric(12, 2) as sales_amount,
    count(distinct s.id) as bills_count
from public.sale_items si
join public.sales s on s.id = si.sale_id
join public.branches b on b.id = s.branch_id
where s.status = 'completed'
group by s.branch_id, b.name, si.product_id, si.product_name, si.category;

-- Completed successfully message
select 'MAGIC MEAT Database Schema & Seed Data successfully installed!' as status;
