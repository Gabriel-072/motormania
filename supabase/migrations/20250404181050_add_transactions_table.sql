-- supabase/migrations/20250405_add_transactions_table.sql
create table transactions (
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

-- Create index for performance
create index idx_transactions_user_id on transactions(user_id);
create index idx_transactions_epayco_ref on transactions(epayco_ref);

-- Optional: Ensure wallet table aligns with clerk_users
alter table wallet alter column user_id type text;
alter table wallet add constraint fk_wallet_user foreign key (user_id) references clerk_users(clerk_id);