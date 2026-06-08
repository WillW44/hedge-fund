import type { TechnicalSignal, TechnicalIndicators, PortfolioId, Direction } from '@/types'
import { PORTFOLIOS, eligiblePortfolios } from './portfolios'

// ─── Short termination rules (hard stops) ────────────────────────────────────
export function checkShortTermination(t: TechnicalIndicators): {
  terminate: boolean
  reason: string | null
} {
  if (t.pct_from_52w_high >= 0) return { terminate: true, reason: 'Stock at new 52-week high — exit immediately' }
  if (t.rsi14 < 30) return { terminate: true, reason: `RSI ${t.rsi14.toFixed(1)} below 30 — technically oversold, cover` }
  return { terminate: false, reason: null }
}

// ─── Window-dressing squeeze flag ─────────────────────────────────────────────
// Q-end (final 2 weeks of Mar/Jun/Sep/Dec) + SI > 15% + cap < $2B
export function isQEnd(): boolean {
  const now = new Date()
  const month = now.getMonth() + 1  // 1-12
  const day = now.getDate()
  const isQEndMonth = [3, 6, 9, 12].includes(month)
  return isQEndMonth && day >= 17  // last ~2 weeks of quarter-end month
}

// ─── Main signal evaluator ────────────────────────────────────────────────────
export function evaluateSignals(
  ticker: string,
  direction: Direction,
  t: TechnicalIndicators,
  meta: {
    shortInterestPct?: number
    dtcDays?: number
    dtcTrend?: 'rising' | 'stable' | 'falling'
    borrowCost?: number
    borrowTrend?: 'rising' | 'stable' | 'falling'
    evEbitdaZscore?: number
    evSalesPercentile?: number
    fcfYieldExpandingQuarters?: number
    catalystDaysOut?: number
    catalystDescription?: string
    earningsDaysOut?: number
    inning?: number
    putCallRatio?: number
    marketCap?: number  // millions
    exposure: 'us' | 'europe'
  }
): TechnicalSignal[] {
  const signals: TechnicalSignal[] = []
  const now = new Date().toISOString()
  const eligible = eligiblePortfolios(meta.exposure) as PortfolioId[]

  const addSignal = (
    signal_type: TechnicalSignal['signal_type'],
    urgency: TechnicalSignal['urgency'],
    description: string,
    action: string,
    flag = '',
    value: number | null = null,
    threshold: number | null = null
  ) => {
    signals.push({
      ticker,
      signal_type,
      direction,
      urgency,
      inning: meta.inning ?? 1,
      value,
      threshold,
      description,
      eligible_portfolios: eligible,
      action,
      flag,
      fired_at: now,
    })
  }

  // ── MOMENTUM & TREND ──────────────────────────────────────────────────────

  // MA cross with volume confirmation
  if (t.ma_cross_up) {
    const volConfirmed = t.volume_ratio >= 1.5
    addSignal(
      volConfirmed ? 'ma_cross_volume_confirmed' : 'ma_cross_up',
      volConfirmed ? 'FIRE' : 'WATCH',
      `15d MA crossed above 150d MA${volConfirmed ? ` on ${t.volume_ratio.toFixed(1)}× avg volume` : ' (low volume)'}`,
      volConfirmed ? 'Enter long — volume-confirmed 2nd inning entry' : 'Flag for entry — wait for volume confirmation',
      volConfirmed ? '' : `Volume only ${t.volume_ratio.toFixed(1)}× avg — weak signal`,
      t.volume_ratio,
      1.5
    )
  }

  if (t.ma_cross_down) {
    addSignal(
      'ma_cross_down',
      'FIRE',
      `15d MA crossed below 150d MA on ${t.volume_ratio.toFixed(1)}× avg volume`,
      'Short entry signal — confirm via governance/accounting screen',
      '',
      t.volume_ratio
    )
  }

  // RSI signals
  if (t.rsi14 > 70) {
    const inning = meta.inning ?? 1
    addSignal(
      'rsi_overbought',
      inning >= 7 ? 'FIRE' : 'WATCH',
      `RSI ${t.rsi14.toFixed(1)} — overbought`,
      inning >= 7 ? 'Inning 7+: exit warning. Trim or set stop' : 'Monitor — may still have legs in early innings',
      `Inning ${inning}`,
      t.rsi14, 70
    )
  }

  if (t.rsi14 < 30) {
    addSignal(
      'rsi_oversold',
      direction === 'short' ? 'FIRE' : 'INFO',
      `RSI ${t.rsi14.toFixed(1)} — oversold`,
      direction === 'short' ? 'Cover short immediately — RSI termination rule' : 'Potential long entry forming',
      direction === 'short' ? 'MANDATORY EXIT per CAA rules' : '',
      t.rsi14, 30
    )
  }

  // 52-week proximity
  if (t.pct_from_52w_high >= -0.08 && t.pct_from_52w_high < 0 && direction === 'short') {
    addSignal(
      'near_52w_high_short',
      'FIRE',
      `Short within ${(Math.abs(t.pct_from_52w_high) * 100).toFixed(1)}% of 52-week high`,
      'Warning: approaching hard stop (new high = mandatory exit). Consider reducing',
      'Hard stop triggered at new high',
      t.pct_from_52w_high * 100
    )
  }

  if (t.pct_from_52w_low <= 0.10 && direction === 'long') {
    addSignal(
      'new_52w_low',
      'WATCH',
      `Long near 52-week low — thesis stress test required`,
      'Review catalyst timeline. Is the thesis broken?',
      '',
      t.pct_from_52w_low * 100
    )
  }

  // Relative strength drop
  if (t.relative_strength_30d < -0.05) {
    addSignal(
      'relative_strength_drop',
      'WATCH',
      `Stock underperforming sector by ${(Math.abs(t.relative_strength_30d) * 100).toFixed(1)}% over 30d`,
      direction === 'long' ? 'Thesis review — relative underperformance is early warning' : 'Short confirmation',
      '',
      t.relative_strength_30d * 100
    )
  }

  // Put/call ratio (US names only)
  if (meta.exposure === 'us' && meta.putCallRatio && meta.putCallRatio > 1.5 && direction === 'short') {
    addSignal(
      'put_call_elevated',
      'WATCH',
      `Put/call ratio elevated at ${meta.putCallRatio.toFixed(2)} — institutional short positioning`,
      'Short confirmation signal — size per Kelly',
      '',
      meta.putCallRatio, 1.5
    )
  }

  // ── FUNDAMENTAL CATALYSTS ─────────────────────────────────────────────────

  if (meta.catalystDaysOut !== undefined && meta.catalystDaysOut <= 90) {
    const urg = meta.catalystDaysOut <= 21 ? 'FIRE' : meta.catalystDaysOut <= 60 ? 'WATCH' : 'INFO'
    addSignal(
      'catalyst_countdown',
      urg,
      `Catalyst in ${meta.catalystDaysOut} days: ${meta.catalystDescription ?? 'identified catalyst'}`,
      meta.catalystDaysOut <= 21 ? 'Imminent — ensure full Kelly size deployed' : 'Position should be established now (2nd inning)',
      '',
      meta.catalystDaysOut
    )
  }

  if (meta.earningsDaysOut !== undefined && meta.earningsDaysOut <= 21 && meta.inning && meta.inning >= 6) {
    addSignal(
      'earnings_proximity',
      'WATCH',
      `Earnings in ${meta.earningsDaysOut} days — position at inning ${meta.inning}`,
      meta.inning >= 7 ? 'Consider trimming ahead of earnings — late innings' : 'Review: ride through earnings or reduce risk',
      `Inning ${meta.inning} + earnings proximity`,
      meta.earningsDaysOut
    )
  }

  // FCF yield expanding
  if (meta.fcfYieldExpandingQuarters && meta.fcfYieldExpandingQuarters >= 3) {
    addSignal(
      'fcf_yield_expanding',
      'OK',
      `FCF yield expanding for ${meta.fcfYieldExpandingQuarters} consecutive quarters`,
      'Hold signal — fundamental confirmation of long thesis. Resist early exits (especially Portfolio E)',
      '',
      meta.fcfYieldExpandingQuarters
    )
  }

  // ── VALUATION SIGNALS ─────────────────────────────────────────────────────

  if (meta.evEbitdaZscore !== undefined) {
    if (meta.evEbitdaZscore <= -2.0) {
      addSignal(
        'ev_ebitda_zscore_low',
        'WATCH',
        `EV/EBITDA at ${meta.evEbitdaZscore.toFixed(1)}σ vs 5yr history — deep discount`,
        'Valuation dislocation confirms long entry on any catalyst hit',
        '',
        meta.evEbitdaZscore
      )
    }
    if (meta.evEbitdaZscore >= 2.0) {
      const inning = meta.inning ?? 1
      addSignal(
        'ev_ebitda_zscore_high',
        inning >= 7 ? 'FIRE' : 'WATCH',
        `EV/EBITDA at +${meta.evEbitdaZscore.toFixed(1)}σ vs 5yr history — stretched`,
        inning >= 7 ? 'Exit signal confirmed — innings 7+ and stretched valuation' : 'Flag for month 10 review (Portfolio E) or trim in quarterly books',
        `Inning ${inning}`,
        meta.evEbitdaZscore
      )
    }
  }

  // ── SHORT-SPECIFIC SIGNALS ────────────────────────────────────────────────

  if (direction === 'short') {
    // Borrow cost
    if (meta.borrowCost !== undefined) {
      if (meta.borrowCost >= 20) {
        addSignal(
          'borrow_cost_breach',
          'FIRE',
          `Borrow cost ${meta.borrowCost.toFixed(1)}% — breaches 20% hard limit`,
          'EXIT SHORT IMMEDIATELY — borrow cost termination rule',
          'MANDATORY EXIT per CAA rules',
          meta.borrowCost, 20
        )
      } else if (meta.borrowCost >= 10 || meta.borrowTrend === 'rising') {
        addSignal(
          'borrow_cost_rising',
          'WATCH',
          `Borrow cost ${meta.borrowCost.toFixed(1)}% and ${meta.borrowTrend ?? 'stable'} — approaching threshold`,
          'Monitor trajectory. Reduce if borrow trend continues rising',
          `Trend: ${meta.borrowTrend}`,
          meta.borrowCost, 20
        )
      }
    }

    // Short interest trend
    if (meta.shortInterestPct !== undefined) {
      if (meta.shortInterestPct >= 20) {
        addSignal(
          'short_interest_rising',
          'WATCH',
          `Short interest ${meta.shortInterestPct.toFixed(1)}% of float — high crowding`,
          'Reduce to 50% of Kelly size per crowdedness modifier (0.55×)',
          'Crowdedness override required',
          meta.shortInterestPct, 20
        )
      }
    }

    // DTC trend
    if (meta.dtcTrend === 'rising' && meta.dtcDays && meta.dtcDays >= 5) {
      addSignal(
        'dtc_rising',
        'WATCH',
        `Days-to-cover ${meta.dtcDays.toFixed(1)} and rising — squeeze risk building`,
        'Apply liquidity modifier. Reduce if DTC >7 days',
        `DTC trend: rising`,
        meta.dtcDays, 7
      )
    }

    // Q-end window dressing squeeze
    if (isQEnd() && meta.marketCap && meta.marketCap < 2000 && meta.shortInterestPct && meta.shortInterestPct > 15) {
      addSignal(
        'window_dressing_squeeze',
        'FIRE',
        `Q-end + SI ${meta.shortInterestPct.toFixed(1)}% + cap $${meta.marketCap.toFixed(0)}M — squeeze risk elevated`,
        'Tighten stop. Consider reducing 30–50% before quarter close',
        'Q-end window dressing flag — applies A, D, F',
        meta.shortInterestPct
      )
    }
  }

  return signals
}

// ─── Inning stage logic ───────────────────────────────────────────────────────
// Inning is determined by: days held vs expected holding period + catalyst progress

export function calcInning(
  entryDate: string,
  holdingPeriodDays: number,  // 180 for longs (6mo), 120 for shorts (4mo)
  catalystProgress: number    // 0–1: how much of the catalyst journey has played out
): number {
  const daysHeld = Math.floor((Date.now() - new Date(entryDate).getTime()) / 86400000)
  const timeProgress = Math.min(1, daysHeld / holdingPeriodDays)
  const combinedProgress = (timeProgress * 0.6 + catalystProgress * 0.4)
  return Math.min(9, Math.max(1, Math.round(combinedProgress * 9) + 1))
}

// Inning urgency based on portfolio payout cycle
export function inningAction(inning: number, payoutCycle: string): {
  action: string
  urgency: TechnicalSignal['urgency']
} {
  if (payoutCycle === 'quarterly') {
    if (inning >= 8) return { action: 'EXIT — innings 8–9, Q-end risk', urgency: 'FIRE' }
    if (inning === 7) return { action: 'Trim 50% — approaching exit zone', urgency: 'FIRE' }
    if (inning >= 5) return { action: 'Monitor closely — prepare exit plan', urgency: 'WATCH' }
    return { action: 'Hold — mid-innings', urgency: 'OK' }
  }
  if (payoutCycle === 'semiannual') {
    if (inning >= 8) return { action: 'EXIT — late innings', urgency: 'FIRE' }
    if (inning === 7) return { action: 'Month 5 review — trim if catalyst complete', urgency: 'WATCH' }
    if (inning >= 5) return { action: 'Hold — riding innings 3–6', urgency: 'OK' }
    return { action: 'Hold', urgency: 'OK' }
  }
  // annual
  if (inning >= 9) return { action: 'EXIT — innings 9, full alpha captured', urgency: 'FIRE' }
  if (inning === 8) return { action: 'Month 10 review — limited catalyst remaining?', urgency: 'WATCH' }
  if (inning >= 7) return { action: 'Hold — annual window supports late innings', urgency: 'OK' }
  return { action: 'Hold — let it ride', urgency: 'OK' }
}
