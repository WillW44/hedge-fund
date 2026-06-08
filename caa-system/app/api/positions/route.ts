import { NextRequest, NextResponse } from 'next/server'
import { getPositions, upsertPosition } from '@/lib/supabase'
import { getTechnicals } from '@/lib/polygon'
import { evaluateSignals } from '@/lib/signals'
import { PORTFOLIOS } from '@/lib/portfolios'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const portfolioId = searchParams.get('portfolio') ?? undefined
    const positions = await getPositions(portfolioId)

    // Enrich with live price + signals
    const enriched = await Promise.all(
      positions.map(async (pos) => {
        try {
          const technicals = await getTechnicals(pos.ticker)
          if (!technicals) return { ...pos, technicals: null, signals: [] }

          const portConfig = PORTFOLIOS[pos.portfolio_id]
          const signals = evaluateSignals(
            pos.ticker,
            pos.direction,
            technicals,
            {
              inning: pos.inning,
              exposure: portConfig.exposure === 'europe' ? 'europe' : 'us',
              catalystDaysOut: pos.catalyst_date
                ? Math.floor((new Date(pos.catalyst_date).getTime() - Date.now()) / 86400000)
                : undefined,
              catalystDescription: pos.catalyst_description ?? undefined,
            }
          )

          return {
            ...pos,
            current_price: technicals.close,
            pnl_pct: ((technicals.close - pos.entry_price) / pos.entry_price) *
              (pos.direction === 'short' ? -1 : 1),
            technicals,
            signals,
          }
        } catch {
          return { ...pos, technicals: null, signals: [] }
        }
      })
    )

    return NextResponse.json({ positions: enriched })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const position = await upsertPosition(body)
    return NextResponse.json({ position })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
