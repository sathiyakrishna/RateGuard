-- RateGuard saved contracts. Optional: without this table the app keeps contracts in the browser (localStorage).
-- There is no login, so rows are scoped to an anonymous per-browser owner id that the API filters on.
create table if not exists public.rateguard_contracts (
  id uuid primary key default gen_random_uuid(),
  owner text not null,
  vendor text not null,
  source_name text not null,
  items jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists rateguard_contracts_owner_idx on public.rateguard_contracts (owner, created_at desc);
-- Server-only table: RLS on with no policies, so only the service role can read or write it.
alter table public.rateguard_contracts enable row level security;
