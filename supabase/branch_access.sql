-- Apply this migration to an existing database to enforce owner/staff branch access.
-- Unlike schema.sql, this migration does not reseed or reset inventory.

alter table public.products
    add column if not exists branch_id uuid references public.branches(id) on delete cascade;
create index if not exists products_branch_idx on public.products(branch_id, name);

drop policy if exists branches_owner_all on public.branches;
drop policy if exists branches_staff_read on public.branches;
drop policy if exists branches_public_read on public.branches;
drop policy if exists profiles_owner_all on public.profiles;
drop policy if exists profiles_self_read on public.profiles;
drop policy if exists products_owner_all on public.products;
drop policy if exists products_read_all on public.products;
drop policy if exists products_staff_read on public.products;
drop policy if exists inventory_owner_all on public.branch_inventory;
drop policy if exists inventory_read_all on public.branch_inventory;
drop policy if exists inventory_staff_read on public.branch_inventory;
drop policy if exists sales_owner_all on public.sales;
drop policy if exists sales_staff_all on public.sales;
drop policy if exists sales_staff_read on public.sales;
drop policy if exists saleitems_owner_all on public.sale_items;
drop policy if exists saleitems_staff_all on public.sale_items;
drop policy if exists saleitems_staff_read on public.sale_items;
drop policy if exists stock_owner_all on public.stock_movements;
drop policy if exists stock_staff_all on public.stock_movements;
drop policy if exists stock_staff_read on public.stock_movements;

create policy branches_owner_all on public.branches for all to authenticated
    using (public.current_role() = 'owner')
    with check (public.current_role() = 'owner');
create policy branches_staff_read on public.branches for select to authenticated
    using (id = public.current_branch());
create policy branches_public_read on public.branches for select to anon
    using (is_active = true);

create policy profiles_owner_all on public.profiles for all to authenticated
    using (public.current_role() = 'owner')
    with check (public.current_role() = 'owner');
create policy profiles_self_read on public.profiles for select to authenticated
    using (id = auth.uid());

create policy products_owner_all on public.products for all to authenticated
    using (public.current_role() = 'owner')
    with check (public.current_role() = 'owner');
create policy products_staff_read on public.products for select to authenticated
    using (
        is_active = true
        and (branch_id is null or branch_id = public.current_branch())
        and public.current_role() in ('manager', 'cashier')
    );

create policy inventory_owner_all on public.branch_inventory for all to authenticated
    using (public.current_role() = 'owner')
    with check (public.current_role() = 'owner');
create policy inventory_staff_read on public.branch_inventory for select to authenticated
    using (branch_id = public.current_branch());

create policy sales_owner_all on public.sales for all to authenticated
    using (public.current_role() = 'owner')
    with check (public.current_role() = 'owner');
create policy sales_staff_read on public.sales for select to authenticated
    using (branch_id = public.current_branch());

create policy saleitems_owner_all on public.sale_items for all to authenticated
    using (public.current_role() = 'owner')
    with check (public.current_role() = 'owner');
create policy saleitems_staff_read on public.sale_items for select to authenticated
    using (exists (
        select 1 from public.sales s
        where s.id = sale_items.sale_id
          and s.branch_id = public.current_branch()
    ));

create policy stock_owner_all on public.stock_movements for all to authenticated
    using (public.current_role() = 'owner')
    with check (public.current_role() = 'owner');
create policy stock_staff_read on public.stock_movements for select to authenticated
    using (branch_id = public.current_branch());

create or replace function public.enforce_branch_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    user_role text;
    user_branch uuid;
begin
    if auth.uid() is null then
        raise exception 'Sign in with an assigned branch profile before saving.';
    end if;

    select role, branch_id into user_role, user_branch
    from public.profiles
    where id = auth.uid() and is_active = true;

    if not found then
        raise exception 'No active access profile is assigned to this account.';
    end if;

    if user_role <> 'owner' and (
        user_branch is null or new.branch_id is null or new.branch_id <> user_branch
    ) then
        raise exception 'You can only access your assigned branch.';
    end if;

    return new;
end;
$$;

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
    if u is null then
        raise exception 'Sign in with an assigned branch profile before saving.';
    end if;

    select role, branch_id, full_name into r, b, cashier_display
    from public.profiles where id = u and is_active = true;
    if not found then
        raise exception 'No active access profile is assigned to this account.';
    end if;

    if r = 'owner' then
        b := coalesce(p_branch_id, b);
    elsif b is null or (p_branch_id is not null and p_branch_id <> b) then
        raise exception 'You can only make sales for your assigned branch.';
    end if;

    if b is null then
        raise exception 'No active branch assigned for billing.';
    end if;
    if p_payment_method not in ('cash', 'upi', 'card', 'credit') then
        raise exception 'Invalid payment method: %', p_payment_method;
    end if;
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Cart cannot be empty.';
    end if;

    for it in select value from jsonb_array_elements(p_items) loop
        q := (it->>'qty_grams')::bigint;
        if q <= 0 then raise exception 'Invalid weight: % grams', q; end if;
        select * into pr from public.products
        where id = (it->>'product_id')::uuid and is_active = true;
        if not found then raise exception 'Product not found or inactive'; end if;
        if pr.branch_id is not null and pr.branch_id <> b then
            raise exception 'This product is not available at the selected branch.';
        end if;

        insert into public.branch_inventory(branch_id, product_id, stock_grams)
        values (b, pr.id, 0)
        on conflict (branch_id, product_id) do nothing;
        select stock_grams into curr_stock from public.branch_inventory
        where branch_id = b and product_id = pr.id for update;
        total := total + (q::numeric / 1000.0) * pr.price_per_kg;
    end loop;

    insert into public.sales(
        branch_id, cashier_id, cashier_name, customer_name, customer_phone,
        payment_method, subtotal, total_amount, tendered_amount, change_amount, status
    ) values (
        b, u, coalesce(cashier_display, 'Cashier'),
        nullif(trim(p_customer_name), ''), nullif(trim(p_customer_phone), ''),
        p_payment_method, round(total, 2), round(total, 2),
        coalesce(p_tendered_amount, total),
        greatest(0, coalesce(p_tendered_amount, total) - round(total, 2)),
        'completed'
    ) returning id, invoice_no into sid, inv;

    for it in select value from jsonb_array_elements(p_items) loop
        q := (it->>'qty_grams')::bigint;
        cstyle := coalesce(it->>'cutting_style', 'Curry Cut');
        select * into pr from public.products where id = (it->>'product_id')::uuid;
        line := round((q::numeric / 1000.0) * pr.price_per_kg, 2);

        insert into public.sale_items(
            sale_id, product_id, product_name, category, qty_grams,
            price_per_kg, cutting_style, line_total
        ) values (sid, pr.id, pr.name, pr.category, q, pr.price_per_kg, cstyle, line);

        update public.branch_inventory
        set stock_grams = greatest(0, stock_grams - q), last_updated = now()
        where branch_id = b and product_id = pr.id;

        insert into public.stock_movements(
            branch_id, product_id, movement_type, qty_grams, reference_id, notes, created_by
        ) values (b, pr.id, 'sale', -q, sid, 'Sale Bill #' || inv, u);
    end loop;

    invoice_code := 'MM-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(inv::text, 4, '0');
    return jsonb_build_object(
        'success', true, 'sale_id', sid, 'invoice_no', inv,
        'invoice_code', invoice_code, 'total_amount', round(total, 2), 'created_at', now()
    );
end;
$$;

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
    if p_qty_grams <= 0 then raise exception 'Quantity must be positive'; end if;
    if auth.uid() is null or not exists (
        select 1 from public.profiles
        where id = auth.uid() and is_active = true
          and (role = 'owner' or branch_id = p_branch_id)
    ) then
        raise exception 'You can only add stock to your assigned branch.';
    end if;
    if not exists (
        select 1 from public.products
        where id = p_product_id and (branch_id is null or branch_id = p_branch_id)
    ) then
        raise exception 'This product is not available at the selected branch.';
    end if;

    insert into public.branch_inventory(branch_id, product_id, stock_grams, last_updated)
    values (p_branch_id, p_product_id, p_qty_grams, now())
    on conflict (branch_id, product_id) do update
    set stock_grams = public.branch_inventory.stock_grams + excluded.stock_grams,
        last_updated = now()
    returning stock_grams into new_stock;

    insert into public.stock_movements(
        branch_id, product_id, movement_type, qty_grams, notes, created_by
    ) values (p_branch_id, p_product_id, 'inward', p_qty_grams, p_notes, auth.uid());

    return jsonb_build_object('success', true, 'new_stock_grams', new_stock);
end;
$$;

drop trigger if exists sales_enforce_branch_access on public.sales;
create trigger sales_enforce_branch_access
    before insert or update on public.sales
    for each row execute function public.enforce_branch_access();

drop trigger if exists stock_movements_enforce_branch_access on public.stock_movements;
create trigger stock_movements_enforce_branch_access
    before insert or update on public.stock_movements
    for each row execute function public.enforce_branch_access();

revoke execute on function public.create_sale(text, text, text, numeric, jsonb, uuid) from anon;
revoke execute on function public.add_branch_stock(uuid, uuid, bigint, text) from anon;
grant execute on function public.create_sale(text, text, text, numeric, jsonb, uuid) to authenticated;
grant execute on function public.add_branch_stock(uuid, uuid, bigint, text) to authenticated;

revoke all on function public.get_branch_login_email(text) from public;
grant execute on function public.get_branch_login_email(text) to anon, authenticated;

-- Prefer the manager account for the branch-code login selector.
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
  order by case p.role when 'manager' then 0 when 'cashier' then 1 else 2 end
  limit 1;
$$;

revoke all on function public.get_branch_login_email(text) from public;
grant execute on function public.get_branch_login_email(text) to anon, authenticated;
