-- ============================================================
-- CAA Technical Analysis System — Supabase Schema
-- Run in order via Supabase SQL editor or CLI
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── positions ───────────────────────────────────────────────
create table if not exists positions (
  id                  uuid primary key default uuid_generate_v4(),
  portfolio_id        text not null check (portfolio_id in ('A','B','C','D','E','F')),
  ticker              text not null,
  direction           text not null check (direction in ('long','short')),
  entry_date          date not null,
  entry_price         numeric(12,4) not null,
  current_price       numeric(12,4),
  size_pct            numeric(6,2) not null,
  inning              int not null default 1 check (inning between 1 and 9),
  thesis_summary      text,
  catalyst_date       date,
  catalyst_description text,
  catalyst_progress   numeric(4,2) default 0 check (catalyst_progress between 0 and 1),
  sizing_inputs       jsonb,
  sizing_output       jsonb,
  status              text not null default 'active' check (status in ('active','closed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists positions_portfolio_idx on positions(portfolio_id);
create index if not exists positions_status_idx on positions(status);
create index if not exists positions_ticker_idx on positions(ticker);

-- ─── ideas ────────────────────────────────────────────────────
create table if not exists ideas (
  id                  uuid primary key default uuid_generate_v4(),
  portfolio_id        text not null check (portfolio_id in ('A','B','C','D','E','F')),
  ticker              text not null,
  direction           text not null check (direction in ('long','short')),
  stage               text not null default 'screen_hit'
                      check (stage in ('screen_hit','dd_in_progress','sized','passed')),
  screen_category     text not null,
  screen_criteria     text[] not null default '{}',
  dd_checklist_pct    int not null default 0 check (dd_checklist_pct between 0 and 100),
  thesis_summary      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists ideas_portfolio_idx on ideas(portfolio_id);
create index if not exists ideas_stage_idx on ideas(stage);

-- ─── trades ───────────────────────────────────────────────────
create table if not exists trades (
  id                  uuid primary key default uuid_generate_v4(),
  portfolio_id        text not null check (portfolio_id in ('A','B','C','D','E','F')),
  ticker              text not null,
  direction           text not null check (direction in ('long','short')),
  entry_date          date not null,
  exit_date           date not null,
  entry_price         numeric(12,4) not null,
  exit_price          numeric(12,4) not null,
  size_pct            numeric(6,2) not null,
  pnl_pct             numeric(8,4),
  holding_days        int,
  thesis_outcome      text check (thesis_outcome in ('confirmed','partially_confirmed','wrong','pending')),
  inning_at_exit      int check (inning_at_exit between 1 and 9),
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists trades_portfolio_idx on trades(portfolio_id);
create index if not exists trades_ticker_idx on trades(ticker);

-- ─── sizing_decisions ─────────────────────────────────────────
create table if not exists sizing_decisions (
  id                  uuid primary key default uuid_generate_v4(),
  portfolio_id        text not null check (portfolio_id in ('A','B','C','D','E','F')),
  ticker              text not null,
  direction           text not null check (direction in ('long','short')),
  inputs              jsonb not null,
  kelly_raw           numeric(8,4),
  kelly_banded        numeric(8,4),
  final_size          numeric(6,2) not null,
  flags               text[] default '{}',
  timestamp           timestamptz not null default now()
);

create index if not exists sizing_portfolio_idx on sizing_decisions(portfolio_id);
create index if not exists sizing_ticker_idx on sizing_decisions(ticker);
create index if not exists sizing_timestamp_idx on sizing_decisions(timestamp desc);

-- ─── memos ────────────────────────────────────────────────────
create table if not exists memos (
  id                  uuid primary key default uuid_generate_v4(),
  idea_id             uuid references ideas(id),
  position_id         uuid references positions(id),
  portfolio_id        text not null check (portfolio_id in ('A','B','C','D','E','F')),
  ticker              text not null,
  version             int not null default 1,
  content             text not null,
  created_at          timestamptz not null default now()
);

create index if not exists memos_portfolio_idx on memos(portfolio_id);
create index if not exists memos_ticker_idx on memos(ticker);

-- ─── screen_results ───────────────────────────────────────────
create table if not exists screen_results (
  id                  uuid primary key default uuid_generate_v4(),
  ticker              text not null,
  screen_category     text not null,
  criteria_triggered  text[] not null default '{}',
  score               int not null default 0,
  eligible_portfolios text[] not null default '{}',
  date                date not null default current_date,
  created_at          timestamptz not null default now()
);

create index if not exists screen_date_idx on screen_results(date desc);
create index if not exists screen_ticker_idx on screen_results(ticker);
create index if not exists screen_score_idx on screen_results(score desc);

-- ─── digest_log ───────────────────────────────────────────────
create table if not exists digest_log (
  id                  uuid primary key default uuid_generate_v4(),
  timestamp           timestamptz not null default now(),
  digest_type         text not null check (digest_type in ('morning','afternoon')),
  tickers_covered     text[] not null default '{}',
  headlines           text[] not null default '{}',
  content             text not null
);

create index if not exists digest_timestamp_idx on digest_log(timestamp desc);

-- ─── technical_cache ─────────────────────────────────────────
-- Stores last computed technicals per ticker to avoid hitting Polygon on every request
create table if not exists technical_cache (
  ticker              text primary key,
  data                jsonb not null,
  computed_at         timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────
-- All tables are internal — restrict to authenticated users only

alter table positions enable row level security;
alter table ideas enable row level security;
alter table trades enable row level security;
alter table sizing_decisions enable row level security;
alter table memos enable row level security;
alter table screen_results enable row level security;
alter table digest_log enable row level security;
alter table technical_cache enable row level security;

-- Service role bypasses RLS; authenticated users get full access
create policy "authenticated_full_access" on positions for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on ideas for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on trades for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on sizing_decisions for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on memos for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on screen_results for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on digest_log for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on technical_cache for all using (auth.role() = 'authenticated');

-- ─── Helper: update updated_at automatically ────────────────────
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_positions_updated_at before update on positions
  for each row execute function update_updated_at_column();

create trigger update_ideas_updated_at before update on ideas
  for each row execute function update_updated_at_column();
