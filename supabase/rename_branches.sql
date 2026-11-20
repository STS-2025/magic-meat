-- Rename the existing branch records without changing their IDs, sales, or inventory.
update public.branches
set name = 'Chennai',
    address = 'Chennai, Tamil Nadu'
where code = 'BR001';

update public.branches
set name = 'Trichy',
    address = 'Tiruchirappalli, Tamil Nadu'
where code = 'BR002';

update public.branches
set name = 'Tirunelveli',
    address = 'Tirunelveli, Tamil Nadu'
where code = 'BR003';

update public.profiles
set full_name = case branch_id
    when (select id from public.branches where code = 'BR001') then 'Chennai Branch'
    when (select id from public.branches where code = 'BR002') then 'Trichy Branch'
    when (select id from public.branches where code = 'BR003') then 'Tirunelveli Branch'
    else full_name
end
where role in ('manager', 'cashier')
  and branch_id in (select id from public.branches where code in ('BR001', 'BR002', 'BR003'));
