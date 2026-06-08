# CAA Technical Analysis System — Deployment Guide

## Overview

Stack: Next.js 14 → Cloudflare Pages, Supabase (Postgres + Auth), Polygon.io (market data), Claude API (AI digest/memos), Resend (email), Cloudflare Workers (cron jobs).

---

## Step 1: Supabase — database setup

1. Go to https://supabase.com → New project → name it `caa-system`
2. Note your **Project URL** and **anon key** (Settings → API)
3. Note your **service_role key** (Settings → API → service_role — keep secret)
4. Open the SQL Editor and run the entire contents of:
   `supabase/migrations/001_initial_schema.sql`
5. Verify 8 tables were created: positions, ideas, trades, sizing_decisions, memos, screen_results, digest_log, technical_cache

---

## Step 2: API keys

### Polygon.io
- Sign up at https://polygon.io → choose **Starter plan** ($29/mo) minimum
- Starter gives: real-time delayed quotes, daily bars, aggregates (all we need)
- Copy your API key

### Anthropic
- https://console.anthropic.com → API keys → Create key
- Ensure your account has access to `claude-sonnet-4-20250514`

### Resend (email)
- https://resend.com → create account (free tier: 3,000 emails/month)
- Add your domain (consumeralphaadvisors.com) → verify DNS records
- Create API key → copy it
- Use `digest@consumeralphaadvisors.com` as FROM (must be verified domain)

### Cloudflare
- https://dash.cloudflare.com → My Profile → API Tokens → Create Token
- Use "Edit Cloudflare Workers" template
- Note your Account ID (right sidebar of Cloudflare dashboard)

---

## Step 3: Environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # NEVER expose this client-side

POLYGON_API_KEY=your_key

ANTHROPIC_API_KEY=sk-ant-...

RESEND_API_KEY=re_...
DIGEST_TO_EMAIL=pm@consumeralphaadvisors.com
DIGEST_FROM_EMAIL=digest@consumeralphaadvisors.com

CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...

NEXT_PUBLIC_APP_URL=https://caa.pages.dev
```

---

## Step 4: Local development

```bash
npm install
npm run dev
# → http://localhost:3000
```

The app will load with empty positions (no data yet). See Step 7 for seeding.

---

## Step 5: Deploy to Cloudflare Pages

```bash
# Install Wrangler globally if not already installed
npm install -g wrangler

# Authenticate
wrangler login

# Build and deploy
npm run build
wrangler pages deploy .next/standalone --project-name caa

# Set environment variables in Cloudflare Pages dashboard:
# Go to: Pages → caa → Settings → Environment variables
# Add ALL variables from .env.local
```

---

## Step 6: Deploy Cloudflare Worker (cron jobs)

```bash
# Set secrets (one by one — these are encrypted)
wrangler secret put POLYGON_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put DIGEST_TO_EMAIL
wrangler secret put DIGEST_FROM_EMAIL

# Update wrangler.toml APP_URL to your actual Cloudflare Pages URL
# Then deploy:
wrangler deploy

# Verify crons are set:
# Cloudflare Dashboard → Workers → caa-screener → Triggers → Cron Triggers
# Should show 3 schedules:
#   30 6 * * 1-5   → 7:30 AM UTC morning digest (BST: 8:30 AM)
#   0 13 * * 1-5   → 2:00 PM UTC afternoon digest (BST: 3:00 PM)  
#   0 22 * * 1-5   → 10:00 PM UTC nightly screen
```

**Note on UKT timing:** The crons run at UTC. During BST (late March – late October), add 1 hour. During GMT (late October – late March), UTC = UKT. Adjust `wrangler.toml` seasonally if needed, or use an environment variable for the timezone offset.

---

## Step 7: Seed initial positions

Add your current positions via Supabase dashboard or via the API.

### Via Supabase dashboard (easiest):
1. Go to Table Editor → `positions`
2. Insert rows manually

### Via API (POST /api/positions):
```bash
curl -X POST https://caa.pages.dev/api/positions \
  -H "Content-Type: application/json" \
  -d '{
    "portfolio_id": "B",
    "ticker": "SECUB SS",
    "direction": "short",
    "entry_date": "2024-09-15",
    "entry_price": 142.50,
    "size_pct": 4.2,
    "inning": 3,
    "thesis_summary": "15-flag governance screen hit. Singular reliance on founder. Accounting irregularities flagged.",
    "status": "active"
  }'
```

### Required fields:
- `portfolio_id`: A–F
- `ticker`: exact format (e.g. "SECUB SS", "AN US", "GAW LN")
- `direction`: "long" or "short"
- `entry_date`: YYYY-MM-DD
- `entry_price`: numeric
- `size_pct`: % of portfolio NAV
- `inning`: 1–9
- `status`: "active"

### Optional but recommended:
- `catalyst_date`: YYYY-MM-DD
- `catalyst_description`: brief text
- `catalyst_progress`: 0.0–1.0 (how much of the thesis has played out)
- `thesis_summary`: brief text

---

## Step 8: Verify everything is working

1. **Dashboard loads** → https://caa.pages.dev/dashboard
2. **Positions show** with live prices from Polygon
3. **Signals fire** when technicals are met
4. **Sizer works** → /sizer → calculate a position → logs appear in Supabase `sizing_decisions`
5. **Morning digest** → trigger manually: `POST /api/digest {"type":"morning"}`
6. **Nightly screen** → check Supabase `screen_results` table next morning

---

## Step 9: Portfolio C — June 2026 launch checklist

Before launch:
- [ ] Verify FSLR US: is it consumer? Check sector mandate eligibility
- [ ] Verify SOFI US: fintech — confirm US consumer mandate inclusion
- [ ] Seed 5–7 initial long ideas in `ideas` table (stage: `screen_hit`)
- [ ] Pre-size 3–4 positions using the Kelly sizer
- [ ] First 60 days are highest information value — run daily signals

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/positions` | GET | All active positions, enriched with live price + signals |
| `/api/positions` | POST | Add or update a position |
| `/api/signals` | GET | All 28 indicators across all tickers |
| `/api/sizer` | POST | Run Kelly sizer, log decision |
| `/api/digest` | POST | Generate + email digest |

---

## Architecture

```
Cloudflare Pages (Next.js 14)
  ├── /dashboard     — Overview of all 6 portfolios
  ├── /signals       — All 28 indicators with filtering
  ├── /innings       — Inning stage tracker
  ├── /portfolio/[id] — Per-portfolio view (A–F)
  ├── /cross         — Cross-portfolio matrix + factor exposure
  └── /sizer         — Interactive Kelly position sizer

Cloudflare Worker (cron)
  ├── 7:30 AM UTC    — Morning digest (email via Resend)
  ├── 2:00 PM UTC    — Afternoon digest
  └── 10:00 PM UTC   — Nightly screen (50 tickers → screen_results)

Supabase (Postgres)
  ├── positions      — Active positions
  ├── ideas          — Pipeline ideas
  ├── trades         — Trade history
  ├── sizing_decisions — Kelly sizer log
  ├── memos          — AI-generated memos
  ├── screen_results — Nightly screener hits
  ├── digest_log     — Digest history
  └── technical_cache — Polygon data cache (5-min TTL)

Polygon.io
  └── Daily bars, prev close, aggregates → all technical indicators

Claude API (claude-sonnet-4-20250514)
  └── Digest generation, investment memos, bull/bear debate
```

---

## Estimated monthly costs

| Service | Plan | Cost |
|---------|------|------|
| Cloudflare Pages | Free | $0 |
| Cloudflare Workers | Free (100K req/day) | $0 |
| Supabase | Free tier (500MB, 50K rows) | $0 |
| Polygon.io | Starter | ~$29/mo |
| Anthropic API | Pay-as-you-go | ~$5–15/mo |
| Resend | Free (3K emails/mo) | $0 |
| **Total** | | **~$35–45/mo** |

Scale Supabase to Pro ($25/mo) once you exceed free tier limits (typically at ~200+ positions with full history).
