import type { PortfolioConfig } from '@/types'

export const PORTFOLIOS: Record<string, PortfolioConfig> = {
  A: {
    id: 'A',
    name: 'Portfolio A',
    aum: 30,
    maxNet: 70,
    grossLongTarget: 60,
    grossShortTarget: 30,
    hardCap: 10,
    defaultNames: 8,
    payoutCycle: 'quarterly',
    carryRate: 10,
    retainerQuarterly: 40000,
    isHedged: false,
    exposure: 'europe_us',
    timingMultiplier: 1.0,
    winRate: 0.5,
    notes: 'High net (70%). Concentrated 8-name book. Quarterly carry — each quarter is an independent game. 10% hard cap is ceiling not target. $40K retainer base.',
  },
  B: {
    id: 'B',
    name: 'Portfolio B',
    aum: 35,
    maxNet: 20,
    grossLongTarget: 50,
    grossShortTarget: 50,
    hardCap: 10,
    defaultNames: 25,
    payoutCycle: 'semiannual',
    carryRate: 12.5,
    retainerQuarterly: 0,
    isHedged: false,
    exposure: 'europe',
    timingMultiplier: 0.8,
    winRate: 0.5,
    notes: 'Europe only. 25 names. Semi-annual 10–15% carry. AUM can scale to $75M. Governance shorts are the alpha edge — Europe structurally rich in all 15 flags. Optimise for Sharpe.',
  },
  C: {
    id: 'C',
    name: 'Portfolio C',
    aum: 25,
    maxNet: 20,
    grossLongTarget: 50,
    grossShortTarget: 50,
    hardCap: 10,
    defaultNames: 25,
    payoutCycle: 'semiannual',
    carryRate: 12.5,
    retainerQuarterly: 0,
    isHedged: false,
    exposure: 'us',
    timingMultiplier: 0.8,
    winRate: 0.5,
    notes: 'US only. June 2026 launch. Semi-annual 10–15% carry. First 60 days are the most important. AUM can scale to $75M. Momentum signals dominate US mid-caps.',
  },
  D: {
    id: 'D',
    name: 'Portfolio D',
    aum: 60,
    maxNet: 0,
    grossLongTarget: 60,
    grossShortTarget: 40,
    hardCap: 10,
    defaultNames: 20,
    payoutCycle: 'quarterly',
    carryRate: 0,
    retainerQuarterly: 30000,
    isHedged: true,
    exposure: 'europe_us',
    timingMultiplier: 0.8,
    winRate: 0.5,
    notes: 'Market neutral. Largest mandate at $60M. $30K/qtr floor + performance fee. Index hedged (ES/SX5E). Pure alpha — no beta contribution. All 3 screen types at maximum intensity.',
  },
  E: {
    id: 'E',
    name: 'Portfolio E',
    aum: 25,
    maxNet: 0,
    grossLongTarget: 60,
    grossShortTarget: 40,
    hardCap: 10,
    defaultNames: 20,
    payoutCycle: 'annual',
    carryRate: 15,
    retainerQuarterly: 0,
    isHedged: true,
    exposure: 'europe_us',
    timingMultiplier: 0.6,
    winRate: 0.5,
    notes: 'Market neutral. Annual 15% carry — highest % payout. Hold positions through full innings 7–9. Tolerate 5–8% drawdowns if thesis intact. Index hedged. 4:1 skew, +75% upside assumption.',
  },
  F: {
    id: 'F',
    name: 'Portfolio F',
    aum: 5,
    maxNet: 10,
    grossLongTarget: 45,
    grossShortTarget: 45,
    hardCap: 10,
    defaultNames: 25,
    payoutCycle: 'quarterly',
    carryRate: 0,
    retainerQuarterly: 10000,
    isHedged: false,
    exposure: 'europe',
    timingMultiplier: 0.8,
    winRate: 0.5,
    notes: 'Europe only. $5M AUM — smallest mandate but highest strategic optionality. Managed account conversion at 18 months is the prize. Showroom portfolio. Tightest risk discipline. 14% 1yr track record.',
  },
}

export const PORTFOLIO_LIST = Object.values(PORTFOLIOS)

// Which portfolios can hold a given exposure
export function eligiblePortfolios(exposure: 'us' | 'europe'): string[] {
  return PORTFOLIO_LIST
    .filter(p => p.exposure === 'europe_us' || p.exposure === exposure)
    .map(p => p.id)
}

// Payout-aware urgency threshold — positions in innings >= this need action
export function inningUrgencyThreshold(portfolioId: string): number {
  const p = PORTFOLIOS[portfolioId]
  if (!p) return 7
  if (p.payoutCycle === 'quarterly') return 6   // quarterly: act earlier
  if (p.payoutCycle === 'semiannual') return 7
  return 8                                        // annual: let it ride
}
