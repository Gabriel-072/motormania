-- supabase/migrations/20250405_add_transactions_table.sql
create table if not exists transactions (
    id uuid primary key default uuid_generate_v4(),
    user_id text not null references clerk_users(clerk_id),
    amount numeric not null,
    method text not null check (method in ('PSE', 'credit_card')),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    epayco_ref text,
    processed boolean not null default false,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);