const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

async function callClaude(
  messages: ClaudeMessage[],
  system: string,
  maxTokens = 4096
): Promise<string> {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error: ${res.status} — ${err}`)
  }
  const data = await res.json() as any
  return data.content[0].text
}

// ─── CAA system prompt — baked in from CLAUDE.md ─────────────────────────────
const CAA_SYSTEM = `You are the AI engine for Consumer Alpha Advisors (CAA), a global consumer long/short hedge fund.

FUND OVERVIEW:
- Strategy: Global Consumer Long/Short, high conviction, net neutral
- Structure: 10–15 Champagne Longs, 15–20 Tripwire Shorts
- Net exposure: 0–20% net long (varies by portfolio mandate)
- Universe: Global Consumer (predominantly US and Europe)
- 18 years consumer-specific experience

INVESTMENT PHILOSOPHY:
"First Survive" (capital preservation), then generate idiosyncrasy through Significant Change.
Edge: Generalist Significant Change Screens applied against consumer domain expertise.
Baseball analogy: Screen identifies in inning 1. Invest big in inning 2. Ride innings 3–6. Exit innings 7–9.

WRITING RULES:
- Tone: Buyside memo — NOT sell-side. Hedge fund sharp, graduate-level.
- No excessive caveats, no boilerplate disclaimers.
- Write like a PM presenting to an IC.
- Mark [VERIFY] on any unconfirmed datapoint.
- Never fabricate data.
- Be direct. Lead with what matters.`

// ─── Generate investment memo ─────────────────────────────────────────────────
export async function generateMemo(
  ticker: string,
  direction: 'long' | 'short',
  portfolioId: string,
  thesisSummary: string,
  keyData: Record<string, unknown>
): Promise<string> {
  const memoType = direction === 'long' ? 'CHAMPAGNE LONG' : 'TRIPWIRE SHORT'
  const sections = direction === 'long'
    ? '1. INVESTMENT SUMMARY\n2. EXPLANATION OF SIGNIFICANT CHANGE\n3. 3–5 PILLARS OF THE THESIS IN DETAIL\n4. FINANCIALS\n5. VALUATION (a. BASE/BULL/BEAR b. DCF)\n6. ALPHA JOURNEY (a. IDENTIFIABLE CATALYSTS WITH TIMING)\n7. RISKS\n8. CONCLUSION'
    : '1. INVESTMENT SUMMARY\n2. EXPLANATION OF TRIPWIRE (a. BIG DOWNSIDE b. CAPPED UPSIDE c. CATALYSTS)\n3. 3–5 PILLARS OF THE THESIS IN DETAIL\n4. FINANCIALS\n5. VALUATION (a. BASE/BULL/BEAR b. DCF)\n6. ALPHA JOURNEY (a. IDENTIFIABLE CATALYSTS WITH TIMING)\n7. RISKS\n8. CONCLUSION'

  return callClaude([{
    role: 'user',
    content: `Generate a ${memoType} memo for ${ticker} in Portfolio ${portfolioId}.

Thesis summary: ${thesisSummary}

Key data points (mark [VERIFY] on anything not confirmed from primary source):
${JSON.stringify(keyData, null, 2)}

Structure:
${sections}

Length: 7–10 pages equivalent. Write as a PM presenting to IC. No sell-side disclaimers.`,
  }], CAA_SYSTEM, 8000)
}

// ─── Signal analysis — explain why a signal fired ────────────────────────────
export async function analyzeSignal(
  ticker: string,
  signalType: string,
  technicalData: Record<string, unknown>,
  portfolios: string[]
): Promise<string> {
  return callClaude([{
    role: 'user',
    content: `Analyze this technical signal for ${ticker} (relevant to portfolios: ${portfolios.join(', ')}):

Signal: ${signalType}
Technical data: ${JSON.stringify(technicalData, null, 2)}

In 2–3 sentences: what does this signal mean, what action should the PM take, and what are the 1–2 most important things to watch? Be direct. No caveats.`,
  }], CAA_SYSTEM, 500)
}

// ─── Morning / afternoon digest ───────────────────────────────────────────────
export async function generateDigest(
  digestType: 'morning' | 'afternoon',
  data: {
    indexFutures: { symbol: string; changePct: number }[]
    sectorEtfs: { name: string; changePct: number }[]
    positionNews: { ticker: string; portfolio: string; headline: string }[]
    signals: { ticker: string; type: string; urgency: string; action: string }[]
    earningsCalendar: { ticker: string; date: string }[]
  }
): Promise<string> {
  const time = digestType === 'morning' ? '7:30 AM' : '2:00 PM'
  return callClaude([{
    role: 'user',
    content: `Write the ${time} UKT CAA ${digestType} digest.

Index futures: ${JSON.stringify(data.indexFutures)}
Sector ETF moves: ${JSON.stringify(data.sectorEtfs)}
Position news: ${JSON.stringify(data.positionNews)}
Active signals: ${JSON.stringify(data.signals)}
Earnings calendar (next 21 days): ${JSON.stringify(data.earningsCalendar)}

Format rules:
- Lead with what matters most
- No filler, no boilerplate
- Flag any FIRE urgency signals prominently at the top
- Hedge fund sharp — one paragraph per section max
- Mark [VERIFY] on any unconfirmed data
- End with: "Today's priority action" — single most important thing the PM should do

Max 400 words.`,
  }], CAA_SYSTEM, 1000)
}

// ─── Bull vs Bear debate ──────────────────────────────────────────────────────
export async function generateBullBearDebate(
  ticker: string,
  direction: 'long' | 'short',
  thesisData: Record<string, unknown>
): Promise<string> {
  return callClaude([{
    role: 'user',
    content: `Generate a bull vs bear debate for ${ticker} (${direction} thesis).

Data: ${JSON.stringify(thesisData, null, 2)}

Format:
BULL CASE: [3–4 specific data-driven arguments]
BEAR CASE: [3–4 specific data-driven arguments]
BULL ATTACKS BEAR'S BEST POINT: [specific rebuttal with data]
BEAR ATTACKS BULL'S BEST POINT: [specific rebuttal with data]
NET VERDICT: [1 sentence — which side is stronger and why]

Be specific. Use numbers. No vague assertions. Mark [VERIFY] on unconfirmed data.`,
  }], CAA_SYSTEM, 1500)
}

// ─── Screener AI analysis — which screen hits are highest priority ─────────────
export async function rankScreenHits(
  hits: { ticker: string; criteria: string[]; score: number; portfolios: string[] }[]
): Promise<string> {
  return callClaude([{
    role: 'user',
    content: `Rank these screen hits by DD priority for Consumer Alpha Advisors:

${JSON.stringify(hits, null, 2)}

For each ticker:
1. Why is this the most/least urgent to investigate?
2. Which portfolio benefits most and why?
3. One sentence on what the key DD question is

Rank top 5. Be direct. Use the CAA inning framework.`,
  }], CAA_SYSTEM, 1500)
}
