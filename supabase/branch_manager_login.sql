-- Run once on an existing project so branch-code sign-in selects the manager
-- account created by the manage-branch-login Edge Function.
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
