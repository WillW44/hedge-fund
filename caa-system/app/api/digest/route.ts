import { NextRequest, NextResponse } from 'next/server'
import { getPositions, logDigest } from '@/lib/supabase'
import { getSectorETFReturns, getIndexFutures } from '@/lib/polygon'
import { generateDigest } from '@/lib/claude'

export async function POST(req: NextRequest) {
  try {
    const { type } = await req.json() as { type: 'morning' | 'afternoon' }

    // Gather all inputs
    const [positions, indexFutures, sectorReturns] = await Promise.all([
      getPositions(),
      getIndexFutures(),
      getSectorETFReturns(),
    ])

    const tickers = [...new Set(positions.map(p => p.ticker))]

    const sectorEtfs = Object.entries(sectorReturns).map(([name, ret]) => ({
      name,
      changePct: ret * 100,
    }))

    const indexFuturesFormatted = indexFutures.map((f: any) => ({
      symbol: f.symbol,
      changePct: 0, // Would need yesterday's close to calc — filled from live data
    }))

    // Generate AI digest
    const digestContent = await generateDigest(type, {
      indexFutures: indexFuturesFormatted,
      sectorEtfs,
      positionNews: [],  // Would be filled from AlphaSense API
      signals: [],       // Would be filled from signal engine
      earningsCalendar: [],
    })

    // Log to Supabase
    await logDigest({
      digest_type: type,
      tickers_covered: tickers,
      headlines: [],
      content: digestContent,
    })

    // Send via Resend
    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.DIGEST_FROM_EMAIL,
          to: process.env.DIGEST_TO_EMAIL,
          subject: `CAA ${type === 'morning' ? '7:30 AM' : '2:00 PM'} Digest — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
          text: digestContent,
          html: `<pre style="font-family: Georgia, serif; font-size: 14px; line-height: 1.6; max-width: 700px; margin: 0 auto; padding: 20px;">${digestContent}</pre>`,
        }),
      })
    }

    return NextResponse.json({ content: digestContent })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
