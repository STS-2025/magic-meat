-- Run after creating the three confirmed branch users in Supabase Authentication.
-- The Admin email below must match the confirmed admin@gmail.com Auth user.

insert into public.profiles (id, full_name, role, branch_id, is_active)
select u.id, 'Magic Meat Admin', 'owner', null, true
from auth.users u
where u.email = 'admin@gmail.com'
on conflict (id) do update
set full_name = excluded.full_name,
    role = excluded.role,
    branch_id = excluded.branch_id,
    is_active = true;

insert into public.profiles (id, full_name, role, branch_id, is_active)
select u.id, 'Chennai Branch', 'cashier', b.id, true
from auth.users u
join public.branches b on b.code = 'BR001'
where u.email = 'magicmeat.chn@gmail.com'
on conflict (id) do update
set full_name = excluded.full_name,
    role = excluded.role,
    branch_id = excluded.branch_id,
    is_active = true;

insert into public.profiles (id, full_name, role, branch_id, is_active)
select u.id, 'Trichy Branch', 'cashier', b.id, true
from auth.users u
join public.branches b on b.code = 'BR002'
where u.email = 'magicmeat.tcy@gmail.com'
on conflict (id) do update
set full_name = excluded.full_name,
    role = excluded.role,
    branch_id = excluded.branch_id,
    is_active = true;

insert into public.profiles (id, full_name, role, branch_id, is_active)
select u.id, 'Tirunelveli Branch', 'cashier', b.id, true
from auth.users u
join public.branches b on b.code = 'BR003'
where u.email = 'magicmeat.tvl@gmail.com'
on conflict (id) do update
set full_name = excluded.full_name,
    role = excluded.role,
    branch_id = excluded.branch_id,
    is_active = true;
