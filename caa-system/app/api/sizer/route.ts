import { NextRequest, NextResponse } from 'next/server'
import { sizePosition } from '@/lib/sizer'
import { logSizingDecision } from '@/lib/supabase'
import type { PortfolioId, SizingInputs } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { portfolioId, ticker, direction, inputs } = body as {
      portfolioId: PortfolioId
      ticker: string
      direction: 'long' | 'short'
      inputs: SizingInputs
    }

    if (!portfolioId || !ticker || !direction || !inputs) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const output = sizePosition(portfolioId, direction, inputs)

    // Log every sizing decision to Supabase — required for AI learning loop
    await logSizingDecision({
      portfolio_id: portfolioId,
      ticker,
      direction,
      inputs,
      kelly_raw: output.kelly_raw,
      kelly_banded: output.kelly_banded,
      final_size: output.final_size,
      flags: output.flags,
    })

    return NextResponse.json({ output })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
