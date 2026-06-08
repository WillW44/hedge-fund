import type { TechnicalIndicators } from '@/types'

const BASE = 'https://eodhd.com/api'
const KEY = process.env.EODHD_API_KEY!

function toEODHD(ticker: string): string {
  const parts = ticker.trim().split(' ')
  if (parts.length < 2) return ticker
  const sym = parts.slice(0, -1).join('-')
  const exchange = parts[parts.length - 1].toUpperCase()
  const exchangeMap: Record<string, string> = {
    'US': 'US', 'LN': 'LSE', 'GY': 'XETRA', 'SS': 'ST',
    'NA': 'AS', 'SM': 'MC', 'IM': 'MI', 'BB': 'BR',
    'FP': 'PA', 'SW': 'SW', 'PW': 'WSE', 'PL': 'WSE',
  }
  const ex = exchangeMap[exchange] ?? exchange
  return `${sym}.${ex}`
}

async function eodFetch(path: string): Promise<any> {
  const url = `${BASE}${path}&api_token=${KEY}&fmt=json`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`EODHD ${path} -> ${res.status}`)
  return res.json()
}

export async function getDailyBars(ticker: string, from: string, to: string) {
  const sym = toEODHD(ticker)
  try {
    const data = await eodFetch(`/eod/${sym}?from=${from}&to=${to}&period=d`)
    return (data ?? []).map((d: any) => ({
      c: d.close, o: d.open, h: d.high, l: d.low, v: d.volume, t: new Date(d.date).getTime()
    }))
  } catch (e) {
    console.error(`getDailyBars error for ${ticker} (${sym}):`, e)
    return []
  }
}

function calcRSI(closes: number[]): number {
  if (closes.length < 2) return 50
  let gains = 0, losses = 0
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d
    else losses += Math.abs(d)
  }
  const n = closes.length - 1
  const avgGain = gains / n
  const avgLoss = losses / n
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

export async function getTechnicals(ticker: string): Promise<TechnicalIndicators | null> {
  const to = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 220 * 86400000).toISOString().split('T')[0]
  try {
    const bars = await getDailyBars(ticker, from, to)
    if (bars.length < 20) return null
    const closes = bars.map((b: any) => b.c)
    const volumes = bars.map((b: any) => b.v)
    const n = closes.length
    const ma = (arr: number[], period: number, idx: number) => {
      if (idx < period - 1) return null
      return arr.slice(idx - period + 1, idx + 1).reduce((a: number, b: number) => a + b, 0) / period
    }
    const ma15Today  = ma(closes, 15, n - 1) ?? 0
    const ma15Yest   = ma(closes, 15, n - 2) ?? 0
    const ma150Today = ma(closes, 150, n - 1) ?? 0
    const ma150Yest  = ma(closes, 150, n - 2) ?? 0
    const maCrossUp   = ma15Yest < ma150Yest && ma15Today >= ma150Today && ma150Today > 0
    const maCrossDown = ma15Yest > ma150Yest && ma15Today <= ma150Today && ma150Today > 0
    const vol20 = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20
    const volRatio = vol20 > 0 ? volumes[n - 1] / vol20 : 1
    const rsi = calcRSI(closes.slice(-15))
    const yearBars = bars.slice(-252)
    const high52w = Math.max(...yearBars.map((b: any) => b.h))
    const low52w  = Math.min(...yearBars.map((b: any) => b.l))
    const currentClose = closes[n - 1]
    const ret30d = closes[Math.max(0, n - 30)] > 0
      ? (currentClose - closes[Math.max(0, n - 30)]) / closes[Math.max(0, n - 30)]
      : 0
    return {
      ticker, date: to, close: currentClose,
      ma15: ma15Today, ma150: ma150Today,
      ma_cross_up: maCrossUp, ma_cross_down: maCrossDown,
      volume_20d_avg: vol20, volume_ratio: volRatio, rsi14: rsi,
      high_52w: high52w, low_52w: low52w,
      pct_from_52w_high: high52w > 0 ? (currentClose - high52w) / high52w : 0,
      pct_from_52w_low:  low52w  > 0 ? (currentClose - low52w)  / low52w  : 0,
      sector_etf_return_30d: 0, stock_return_30d: ret30d, relative_strength_30d: 0,
    }
  } catch (e) {
    console.error(`getTechnicals error for ${ticker}:`, e)
    return null
  }
}

export async function getBatchTechnicals(tickers: string[]): Promise<Map<string, TechnicalIndicators>> {
  const results = new Map<string, TechnicalIndicators>()
  for (const ticker of tickers) {
    try {
      const t = await getTechnicals(ticker)
      if (t) results.set(ticker, t)
      await new Promise(r => setTimeout(r, 200))
    } catch (e) {
      console.error(`Failed technicals for ${ticker}`, e)
    }
  }
  return results
}

export async function getPrevClose(ticker: string) {
  const sym = toEODHD(ticker)
  try {
    const data = await eodFetch(`/real-time/${sym}?`)
    return { close: data.close, date: data.timestamp }
  } catch { return null }
}

export async function getSectorETFReturns(): Promise<Record<string, number>> {
  const etfs: Record<string, string> = {
    us_consumer_disc: 'XLY.US', us_consumer_staples: 'XLP.US',
    europe_broad: 'EZU.US', us_broad: 'SPY.US',
  }
  const results: Record<string, number> = {}
  for (const [name, sym] of Object.entries(etfs)) {
    try {
      const from = new Date(Date.now() - 35 * 86400000).toISOString().split('T')[0]
      const to   = new Date().toISOString().split('T')[0]
      const bars = await eodFetch(`/eod/${sym}?from=${from}&to=${to}&period=d`)
      if (bars && bars.length >= 2) {
        results[name] = (bars[bars.length - 1].close - bars[0].close) / bars[0].close
      }
    } catch {}
  }
  return results
}

export async function getIndexFutures() {
  const indices = [
    { symbol: 'GSPC.INDX', name: 'S&P 500' },
    { symbol: 'STOXX50E.INDX', name: 'Euro Stoxx 50' },
    { symbol: 'FTSE.INDX', name: 'FTSE 100' },
  ]
  const results = []
  for (const idx of indices) {
    try {
      const data = await eodFetch(`/real-time/${idx.symbol}?`)
      results.push({ symbol: idx.name, price: data.close, change_pct: data.change_p })
    } catch {}
  }
  return results
}

export async function getEarningsCalendar(tickers: string[]) {
  return tickers.map(t => ({ ticker: t, date: null as string | null, consensus_eps: null as number | null }))
}