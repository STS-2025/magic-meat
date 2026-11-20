-- Membership Plan Management Phase 1.
-- Run after the existing Supabase schema and branch access setup.

alter table if exists public.membership_plans add column if not exists category text not null default 'Chicken';
alter table if exists public.membership_plans drop constraint if exists membership_plans_plan_name_key;
drop index if exists public.membership_plans_plan_name_key;
alter table if exists public.membership_plans drop constraint if exists membership_plans_plan_category_key;
alter table if exists public.membership_plans add constraint membership_plans_plan_category_key unique (plan_name, category);

create table if not exists public.membership_plans (
    id uuid primary key default gen_random_uuid(),
    plan_name text not null,
    category text not null default 'Chicken',
    duration_weeks integer not null check (duration_weeks > 0),
    original_price numeric(12, 2) not null check (original_price >= 0),
    offer_price numeric(12, 2) not null check (offer_price >= 0 and offer_price <= original_price),
    savings_amount numeric(12, 2) generated always as (original_price - offer_price) stored,
    product_name text not null default 'Broiler Chicken',
    product_quantity text not null default '1 KG per delivery',
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint membership_plans_plan_category_key unique (plan_name, category)
);

create table if not exists public.membership_plan_branches (
    id uuid primary key default gen_random_uuid(),
    plan_id uuid not null references public.membership_plans(id) on delete cascade,
    branch_id uuid not null references public.branches(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint membership_plan_branches_plan_branch_key unique (plan_id, branch_id)
);

create index if not exists membership_plans_active_duration_idx
    on public.membership_plans(is_active, duration_weeks);
create index if not exists membership_plan_branches_branch_plan_idx
    on public.membership_plan_branches(branch_id, plan_id);

create or replace function public.set_membership_plan_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists membership_plans_updated_at on public.membership_plans;
create trigger membership_plans_updated_at
    before update on public.membership_plans
    for each row execute function public.set_membership_plan_updated_at();

alter table public.membership_plans enable row level security;
alter table public.membership_plan_branches enable row level security;

drop policy if exists membership_plans_owner_all on public.membership_plans;
drop policy if exists membership_plans_branch_read on public.membership_plans;
drop policy if exists membership_plan_branches_owner_all on public.membership_plan_branches;
drop policy if exists membership_plan_branches_branch_read on public.membership_plan_branches;

create or replace function public.membership_plan_available_to_branch(p_plan_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.membership_plans p
        join public.membership_plan_branches pb on pb.plan_id = p.id
        where p.id = p_plan_id
          and pb.branch_id = p_branch_id
          and p.is_active = true
          and (
              public.current_role() = 'owner'
              or p_branch_id = public.current_branch()
          )
    );
$$;

revoke all on function public.membership_plan_available_to_branch(uuid, uuid) from public, anon;
grant execute on function public.membership_plan_available_to_branch(uuid, uuid) to authenticated;

create policy membership_plans_owner_all on public.membership_plans
    for all to authenticated
    using (public.current_role() = 'owner')
    with check (public.current_role() = 'owner');
create policy membership_plans_branch_read on public.membership_plans
    for select to authenticated
    using (
        public.current_role() in ('manager', 'cashier')
        and public.membership_plan_available_to_branch(id, public.current_branch())
    );

create policy membership_plan_branches_owner_all on public.membership_plan_branches
    for all to authenticated
    using (public.current_role() = 'owner')
    with check (public.current_role() = 'owner');
create policy membership_plan_branches_branch_read on public.membership_plan_branches
    for select to authenticated
    using (
        public.current_role() in ('manager', 'cashier')
        and branch_id = public.current_branch()
        and public.membership_plan_available_to_branch(plan_id, branch_id)
    );

revoke all on public.membership_plans, public.membership_plan_branches from anon;
grant select, insert, update, delete on public.membership_plans, public.membership_plan_branches to authenticated;

create or replace function public.save_membership_plan(
    p_plan_id uuid,
    p_plan_name text,
    p_duration_weeks integer,
    p_original_price numeric,
    p_offer_price numeric,
    p_product_name text,
    p_product_quantity text,
    p_description text,
    p_is_active boolean,
    p_branch_ids uuid[],
    p_category text default 'Chicken'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    saved_plan_id uuid;
begin
    if auth.uid() is null or public.current_role() <> 'owner' then
        raise exception 'Only an active owner can manage membership plans.';
    end if;
    if nullif(trim(p_plan_name), '') is null
       or p_duration_weeks is null or p_duration_weeks <= 0
       or p_original_price is null or p_original_price < 0
       or p_offer_price is null or p_offer_price < 0 or p_offer_price > p_original_price
       or nullif(trim(p_product_name), '') is null
       or nullif(trim(p_product_quantity), '') is null then
        raise exception 'Enter a valid plan name, duration, prices, product, and quantity.';
    end if;
    if coalesce(cardinality(p_branch_ids), 0) = 0 then
        raise exception 'A membership plan must be assigned to at least one branch.';
    end if;
    if exists (
        select 1
        from unnest(p_branch_ids) as requested(branch_id)
        left join public.branches b on b.id = requested.branch_id
        where b.id is null
    ) then
        raise exception 'One or more selected branches do not exist.';
    end if;

    if p_plan_id is null then
        insert into public.membership_plans (
            plan_name, category, duration_weeks, original_price, offer_price,
            product_name, product_quantity, description, is_active
        ) values (
            trim(p_plan_name), coalesce(nullif(trim(p_category), ''), 'Chicken'), p_duration_weeks, p_original_price, p_offer_price,
            trim(p_product_name), trim(p_product_quantity), nullif(trim(p_description), ''), coalesce(p_is_active, true)
        )
        returning id into saved_plan_id;
    else
        update public.membership_plans
        set plan_name = trim(p_plan_name),
            category = coalesce(nullif(trim(p_category), ''), category, 'Chicken'),
            duration_weeks = p_duration_weeks,
            original_price = p_original_price,
            offer_price = p_offer_price,
            product_name = trim(p_product_name),
            product_quantity = trim(p_product_quantity),
            description = nullif(trim(p_description), ''),
            is_active = coalesce(p_is_active, true)
        where id = p_plan_id
        returning id into saved_plan_id;

        if saved_plan_id is null then
            raise exception 'Membership plan was not found.';
        end if;
        delete from public.membership_plan_branches where plan_id = saved_plan_id;
    end if;

    insert into public.membership_plan_branches (plan_id, branch_id)
    select saved_plan_id, selected.branch_id
    from (select distinct unnest(p_branch_ids) as branch_id) selected
    on conflict (plan_id, branch_id) do nothing;

    return saved_plan_id;
end;
$$;

create or replace function public.prevent_deleting_used_membership_plan()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    membership_exists boolean;
begin
    if to_regclass('public.memberships') is not null then
        execute 'select exists (select 1 from public.memberships where plan_id = $1)'
            into membership_exists
            using old.id;
        if membership_exists then
            raise exception 'This plan is already used by memberships and cannot be deleted.';
        end if;
    end if;
    if to_regclass('public.membership_enrollments') is not null then
        execute 'select exists (select 1 from public.membership_enrollments where plan_id = $1)'
            into membership_exists
            using old.id;
        if membership_exists then
            raise exception 'This plan is already used by memberships and cannot be deleted.';
        end if;
    end if;
    return old;
end;
$$;

drop trigger if exists membership_plans_prevent_used_delete on public.membership_plans;
create trigger membership_plans_prevent_used_delete
    before delete on public.membership_plans
    for each row execute function public.prevent_deleting_used_membership_plan();

create or replace function public.delete_membership_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if auth.uid() is null or public.current_role() <> 'owner' then
        raise exception 'Only an active owner can manage membership plans.';
    end if;

    delete from public.membership_plans where id = p_plan_id;
    if not found then
        raise exception 'Membership plan was not found.';
    end if;
end;
$$;

revoke all on function public.save_membership_plan(uuid, text, integer, numeric, numeric, text, text, text, boolean, uuid[]) from public, anon;
revoke all on function public.save_membership_plan(uuid, text, integer, numeric, numeric, text, text, text, boolean, uuid[], text) from public, anon;
revoke all on function public.delete_membership_plan(uuid) from public, anon;
grant execute on function public.save_membership_plan(uuid, text, integer, numeric, numeric, text, text, text, boolean, uuid[]) to authenticated;
grant execute on function public.save_membership_plan(uuid, text, integer, numeric, numeric, text, text, text, boolean, uuid[], text) to authenticated;
grant execute on function public.delete_membership_plan(uuid) to authenticated;

create table if not exists public.membership_enrollments (
    id uuid primary key default gen_random_uuid(),
    customer_name text not null,
    customer_phone text,
    customer_address text,
    plan_id uuid not null references public.membership_plans(id),
    branch_id uuid not null references public.branches(id),
    paid_amount numeric(12, 2) not null check (paid_amount >= 0),
    max_deliveries integer not null default 3 check (max_deliveries > 0),
    deliveries_used integer not null default 0 check (deliveries_used >= 0 and deliveries_used <= max_deliveries),
    starts_at timestamptz not null default now(),
    expires_at timestamptz not null,
    status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'expired')),
    cancelled_at timestamptz,
    refund_amount numeric(12, 2) not null default 0 check (refund_amount = 0),
    created_at timestamptz not null default now()
);

alter table public.membership_enrollments
    add column if not exists customer_address text;

create table if not exists public.membership_deliveries (
    id uuid primary key default gen_random_uuid(),
    membership_id uuid not null references public.membership_enrollments(id) on delete cascade,
    delivery_number integer not null check (delivery_number > 0),
    redeemed_at timestamptz not null default now(),
    constraint membership_deliveries_membership_number_key unique (membership_id, delivery_number)
);

create index if not exists membership_enrollments_branch_created_idx
    on public.membership_enrollments(branch_id, created_at desc);
create index if not exists membership_deliveries_membership_idx
    on public.membership_deliveries(membership_id, redeemed_at desc);

alter table public.membership_enrollments enable row level security;
alter table public.membership_deliveries enable row level security;

drop policy if exists membership_enrollments_owner_all on public.membership_enrollments;
drop policy if exists membership_enrollments_branch_read on public.membership_enrollments;
drop policy if exists membership_deliveries_owner_read on public.membership_deliveries;
drop policy if exists membership_deliveries_branch_read on public.membership_deliveries;

create policy membership_enrollments_owner_all on public.membership_enrollments
    for all to authenticated
    using (public.current_role() = 'owner')
    with check (public.current_role() = 'owner');
create policy membership_enrollments_branch_read on public.membership_enrollments
    for select to authenticated
    using (
        public.current_role() in ('manager', 'cashier')
        and branch_id = public.current_branch()
    );
create policy membership_deliveries_owner_read on public.membership_deliveries
    for select to authenticated
    using (public.current_role() = 'owner');
create policy membership_deliveries_branch_read on public.membership_deliveries
    for select to authenticated
    using (
        public.current_role() in ('manager', 'cashier')
        and exists (
            select 1
            from public.membership_enrollments m
            where m.id = membership_deliveries.membership_id
              and m.branch_id = public.current_branch()
        )
    );

revoke all on public.membership_enrollments, public.membership_deliveries from anon;
grant select on public.membership_enrollments, public.membership_deliveries to authenticated;

drop function if exists public.create_membership_enrollment(text, text, uuid, uuid);

create or replace function public.create_membership_enrollment(
    p_customer_name text,
    p_customer_phone text,
    p_customer_address text,
    p_plan_id uuid,
    p_branch_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    selected_plan public.membership_plans%rowtype;
    membership_id uuid;
begin
    if auth.uid() is null or public.current_role() not in ('owner', 'manager', 'cashier') then
        raise exception 'An active owner or branch user is required to add membership customers.';
    end if;
    if public.current_role() <> 'owner' and p_branch_id is distinct from public.current_branch() then
        raise exception 'You can only add membership customers to your assigned branch.';
    end if;
    if nullif(trim(p_customer_name), '') is null then
        raise exception 'Enter the customer name.';
    end if;
    if nullif(trim(p_customer_address), '') is null then
        raise exception 'Enter the customer address.';
    end if;

    select p.* into selected_plan
    from public.membership_plans p
    join public.membership_plan_branches pb on pb.plan_id = p.id
    where p.id = p_plan_id
      and pb.branch_id = p_branch_id
      and p.is_active = true;
    if not found then
        raise exception 'This active plan is not available at the selected branch.';
    end if;

    insert into public.membership_enrollments (
        customer_name, customer_phone, customer_address, plan_id, branch_id, paid_amount, expires_at
    ) values (
        trim(p_customer_name), nullif(trim(p_customer_phone), ''), trim(p_customer_address), selected_plan.id,
        p_branch_id, selected_plan.offer_price, now() + make_interval(weeks => selected_plan.duration_weeks)
    )
    returning id into membership_id;

    return membership_id;
end;
$$;

create or replace function public.record_membership_delivery(p_membership_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    selected_membership public.membership_enrollments%rowtype;
    next_delivery integer;
    next_status text;
begin
    if auth.uid() is null or public.current_role() not in ('owner', 'manager', 'cashier') then
        raise exception 'An active owner or branch user is required to record membership deliveries.';
    end if;

    select m.* into selected_membership
    from public.membership_enrollments m
    where m.id = p_membership_id
    for update;
    if not found then
        raise exception 'Membership customer was not found.';
    end if;
    if public.current_role() <> 'owner' and selected_membership.branch_id is distinct from public.current_branch() then
        raise exception 'You can only access memberships from your assigned branch.';
    end if;
    if selected_membership.status <> 'active' then
        raise exception 'Only active memberships can receive deliveries.';
    end if;
    if selected_membership.expires_at <= now() then
        update public.membership_enrollments set status = 'expired' where id = p_membership_id;
        return jsonb_build_object('status', 'expired', 'deliveries_used', selected_membership.deliveries_used);
    end if;

    next_delivery := selected_membership.deliveries_used + 1;
    insert into public.membership_deliveries (membership_id, delivery_number)
    values (p_membership_id, next_delivery);

    update public.membership_enrollments
    set deliveries_used = next_delivery,
        status = case when next_delivery >= max_deliveries then 'completed' else 'active' end
    where id = p_membership_id
    returning status into next_status;

    return jsonb_build_object('status', next_status, 'deliveries_used', next_delivery);
end;
$$;

create or replace function public.cancel_membership_enrollment(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if auth.uid() is null or public.current_role() not in ('owner', 'manager', 'cashier') then
        raise exception 'An active owner or branch user is required to cancel memberships.';
    end if;

    update public.membership_enrollments
    set status = 'cancelled', cancelled_at = now(), refund_amount = 0
    where id = p_membership_id
      and status = 'active'
      and (public.current_role() = 'owner' or branch_id = public.current_branch());
    if not found then
        raise exception 'Only an active membership from your access scope can be cancelled.';
    end if;
end;
$$;

revoke all on function public.create_membership_enrollment(text, text, text, uuid, uuid) from public, anon;
revoke all on function public.record_membership_delivery(uuid) from public, anon;
revoke all on function public.cancel_membership_enrollment(uuid) from public, anon;
grant execute on function public.create_membership_enrollment(text, text, text, uuid, uuid) to authenticated;
grant execute on function public.record_membership_delivery(uuid) to authenticated;
grant execute on function public.cancel_membership_enrollment(uuid) to authenticated;

insert into public.membership_plans (
    plan_name, category, duration_weeks, original_price, offer_price,
    product_name, product_quantity, description, is_active
) values
    ('3 Weeks Plan', 'Chicken', 3, 1050, 810, 'Broiler Chicken', '1 KG per delivery', 'Each delivery includes 1 KG Broiler Chicken.', true),
    ('4 Weeks Plan', 'Chicken', 4, 1400, 1080, 'Broiler Chicken', '1 KG per delivery', 'Each delivery includes 1 KG Broiler Chicken.', true),
    ('5 Weeks Plan', 'Chicken', 5, 1750, 1350, 'Broiler Chicken', '1 KG per delivery', 'Each delivery includes 1 KG Broiler Chicken.', true),
    ('6 Weeks Plan', 'Chicken', 6, 2100, 1620, 'Broiler Chicken', '1 KG per delivery', 'Each delivery includes 1 KG Broiler Chicken.', true),
    ('7 Weeks Plan', 'Chicken', 7, 2450, 1890, 'Broiler Chicken', '1 KG per delivery', 'Each delivery includes 1 KG Broiler Chicken.', true),
    ('3 Weeks Plan', 'Mutton', 3, 2700, 2250, 'Fresh Mutton Cuts', '1 KG per delivery', 'Each delivery includes 1 KG Fresh Mutton Cuts.', true),
    ('3 Weeks Plan', 'Fish & Seafood', 3, 1500, 1200, 'Fresh Seer Fish / Prawns', '1 KG per delivery', 'Each delivery includes 1 KG Fresh Catch.', true)
on conflict (plan_name, category) do nothing;

insert into public.membership_plan_branches (plan_id, branch_id)
select p.id, b.id
from public.membership_plans p
cross join public.branches b
on conflict (plan_id, branch_id) do nothing;
