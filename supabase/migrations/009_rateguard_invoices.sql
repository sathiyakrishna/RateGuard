-- RateGuard: remembers checked invoices so a resubmitted one can be flagged as a possible duplicate.
-- Optional: the app works without this table (duplicates are then checked within the open page only).
create table if not exists public.rateguard_invoices (
  dup_key text primary key,            -- vendor | invoice number | amount, normalised
  vendor text not null,
  invoice_number text not null,
  amount numeric(16, 2) not null,
  created_at timestamptz not null default now()
);
-- Server-only table: RLS on with no policies, so only the service role can read or write it.
alter table public.rateguard_invoices enable row level security;
