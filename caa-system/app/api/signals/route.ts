import { NextRequest, NextResponse } from 'next/server'
import { getPositions, createServerClient } from '@/lib/supabase'
import { getTechnicals } from '@/lib/polygon'
import { evaluateSignals } from '@/lib/signals'
import { PORTFOLIOS } from '@/lib/portfolios'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const positions = await getPositions()
    const allSignals = []
    const processed = new Set<string>()

    for (const pos of positions) {
      if (processed.has(pos.ticker)) continue
      processed.add(pos.ticker)

      const technicals = await getTechnicals(pos.ticker)
      if (!technicals) continue

      const portConfig = PORTFOLIOS[pos.portfolio_id]
      const signals = evaluateSignals(pos.ticker, pos.direction, technicals, {
        inning: pos.inning,
        exposure: portConfig.exposure === 'europe' ? 'europe' : 'us',
        catalystDaysOut: pos.catalyst_date
          ? Math.floor((new Date(pos.catalyst_date).getTime() - Date.now()) / 86400000)
          : undefined,
        catalystDescription: pos.catalyst_description ?? undefined,
      })

      allSignals.push(...signals)

      // Cache technicals
      const db = createServerClient()
      await db.from('technical_cache').upsert({
        ticker: pos.ticker,
        data: technicals,
        computed_at: new Date().toISOString(),
      })
    }

    // Sort by urgency: FIRE → WATCH → OK → INFO
    const urgencyOrder = { FIRE: 0, WATCH: 1, OK: 2, INFO: 3 }
    allSignals.sort((a, b) =>
      (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3)
    )

    const stats = {
      total: allSignals.length,
      fire: allSignals.filter(s => s.urgency === 'FIRE').length,
      watch: allSignals.filter(s => s.urgency === 'WATCH').length,
      ok: allSignals.filter(s => s.urgency === 'OK').length,
      mandatory_exits: allSignals.filter(s =>
        s.signal_type === 'borrow_cost_breach' || s.signal_type === 'rsi_oversold'
      ).length,
    }

    return NextResponse.json({ signals: allSignals, stats })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
