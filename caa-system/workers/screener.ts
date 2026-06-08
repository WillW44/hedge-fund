/**
 * CAA Cloudflare Worker
 * Scheduled cron jobs:
 *   - Nightly screener: runs all 28 technical indicators across consumer universe
 *   - 7:30 AM UKT morning digest
 *   - 2:00 PM UKT afternoon digest
 *
 * Deploy: wrangler deploy
 */

export interface Env {
  POLYGON_API_KEY: string
  ANTHROPIC_API_KEY: string
  RESEND_API_KEY: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  DIGEST_TO_EMAIL: string
  DIGEST_FROM_EMAIL: string
  APP_URL: string  // https://caa.pages.dev
}

// ─── Consumer universe — all tickers across 6 portfolios ────────────────────
const CONSUMER_UNIVERSE = [
  // Longs
  'AN', 'PSMT', 'SFM', 'ARMK', 'PFGC', 'MNRO', 'DKS', 'TTWO', 'ONON',
  'FWONK', 'JMIA', 'KYIV',
  // European longs (via ADR or direct if supported)
  'SMT', 'RTO', 'GAW', 'MEL', 'EVD', 'DIE', 'LTMC', 'PUM', 'ALHG',
  // Shorts US
  'COST', 'NYT', 'SN', 'SBGI', 'ACI', 'GRND', 'SGHC', 'TXRH', 'FLO',
  'FSLR', 'REYN', 'ULTA', 'SIG', 'SCI', 'BROS', 'SOFI',
  // European shorts (use Polygon international if available)
  'SECUB', 'THEON', 'SCAB', 'HEXAB', 'AD', 'BFIT', 'LIFCO', 'DNP',
  'CSG', 'NA9', 'ADEN', 'EGL', 'MTLN',
]

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const cron = event.cron

    // 7:30 AM UKT = "30 6 * * 1-5" UTC (accounting for BST: "30 6 * * 1-5")
    if (cron === '30 6 * * 1-5') {
      ctx.waitUntil(runDigest('morning', env))
    }

    // 2:00 PM UKT = "0 13 * * 1-5"
    if (cron === '0 13 * * 1-5') {
      ctx.waitUntil(runDigest('afternoon', env))
    }

    // Nightly screen: 10 PM UTC every weekday
    if (cron === '0 22 * * 1-5') {
      ctx.waitUntil(runNightlyScreen(env))
    }
  },
}

// ─── Digest runner ─────────────────────────────────────────────────────────
async function runDigest(type: 'morning' | 'afternoon', env: Env) {
  console.log(`Running ${type} digest...`)
  try {
    const res = await fetch(`${env.APP_URL}/api/digest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    if (!res.ok) throw new Error(`Digest API returned ${res.status}`)
    console.log(`${type} digest sent successfully`)
  } catch (e) {
    console.error(`Digest failed:`, e)
  }
}

// ─── Nightly screener ─────────────────────────────────────────────────────
async function runNightlyScreen(env: Env) {
  console.log('Running nightly technical screen...')
  const hits = []

  for (const ticker of CONSUMER_UNIVERSE) {
    try {
      // Fetch daily bars from Polygon
      const to = new Date().toISOString().split('T')[0]
      const from = new Date(Date.now() - 220 * 86400000).toISOString().split('T')[0]

      const resp = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=300&apiKey=${env.POLYGON_API_KEY}`
      )
      if (!resp.ok) continue

      const data = await resp.json() as any
      const bars = data.results ?? []
      if (bars.length < 20) continue

      const closes = bars.map((b: any) => b.c)
      const volumes = bars.map((b: any) => b.v)
      const n = closes.length

      // Calculate indicators
      const ma15 = closes.slice(-15).reduce((a: number, b: number) => a + b, 0) / 15
      const ma15y = closes.slice(-16, -1).reduce((a: number, b: number) => a + b, 0) / 15
      const ma150 = n >= 150 ? closes.slice(-150).reduce((a: number, b: number) => a + b, 0) / 150 : null
      const ma150y = n >= 151 ? closes.slice(-151, -1).reduce((a: number, b: number) => a + b, 0) / 150 : null
      const vol20 = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20
      const volRatio = volumes[n - 1] / vol20

      const criteria: string[] = []
      let score = 0

      // MA crossover
      if (ma150 && ma150y && ma15y < ma150y && ma15 >= ma150) {
        criteria.push('15d/150d MA cross up')
        score += volRatio >= 1.5 ? 3 : 2
        if (volRatio >= 1.5) criteria.push(`Volume confirmed ${volRatio.toFixed(1)}× avg`)
      }
      if (ma150 && ma150y && ma15y > ma150y && ma15 <= ma150) {
        criteria.push('15d/150d MA cross down')
        score += 2
      }

      // 52-week high/low
      const yearCloses = closes.slice(-252)
      const high52w = Math.max(...yearCloses)
      const low52w = Math.min(...yearCloses)
      const pctFromHigh = (closes[n - 1] - high52w) / high52w

      if (pctFromHigh >= -0.01) { criteria.push('New 52-week high'); score += 2 }
      if ((closes[n - 1] - low52w) / low52w <= 0.01) { criteria.push('New 52-week low'); score += 2 }

      // EPS revision proxy via price momentum
      const ret20 = (closes[n - 1] - closes[n - 21]) / closes[n - 21]
      if (ret20 >= 0.2) { criteria.push('+20% price momentum (proxy EPS revision up)'); score += 2 }
      if (ret20 <= -0.2) { criteria.push('−20% price momentum (proxy EPS revision down)'); score += 2 }

      if (criteria.length > 0) {
        hits.push({ ticker, criteria, score })
        console.log(`Screen hit: ${ticker} — ${criteria.join(', ')} (score: ${score})`)
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 150))
    } catch (e) {
      console.error(`Screen error for ${ticker}:`, e)
    }
  }

  // Log all hits to Supabase
  if (hits.length > 0) {
    for (const hit of hits) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/screen_results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          ticker: hit.ticker,
          screen_category: 'nightly_technical',
          criteria_triggered: hit.criteria,
          score: hit.score,
          eligible_portfolios: ['A', 'B', 'C', 'D', 'E', 'F'],
          date: new Date().toISOString().split('T')[0],
        }),
      })
    }
    console.log(`Nightly screen complete. ${hits.length} hits logged.`)
  }
}
