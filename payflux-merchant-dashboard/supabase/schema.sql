-- TapPay / BasePOS merchant-dashboard: Supabase schema (replaces data/links.json + data/settlement.json)
create table if not exists links (
  id text primary key,
  merchant text not null,
  request jsonb not null,
  inr numeric not null,
  usdc text not null,
  description text default '',
  methods jsonb default '[]',
  customer jsonb default '{}',
  require_billing_address boolean default false,
  created_at bigint not null,
  expires_at bigint not null,
  status text not null default 'open',
  demo boolean default false,
  tx_hash text,
  payer text,
  paid_with_eth boolean,
  method text
);

create index if not exists idx_links_merchant on links(merchant);
create index if not exists links_status_idx on links(status);
create index if not exists links_nonce_idx on links((request->'r'->>'nonce'));

-- Settlement record (single row, keyed by a constant id)
create table if not exists settlement (
  id text primary key default 'default',
  address text not null,
  deployer text,
  set_at bigint not null
);
