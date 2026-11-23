-- Add UPI ID support to branch records
alter table public.branches
    add column if not exists upi_id text;
