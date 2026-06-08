import type { SizingInputs, SizingOutput, PortfolioId } from '@/types'
import { PORTFOLIOS } from './portfolios'

// ─── Modifier lookup tables (exact from CLAUDE.md) ───────────────────────────

const CONVICTION_MULT: Record<string, number> = {
  low: 0.70, medium: 0.90, high: 1.00, highest: 1.25,
}
const BETA_MULT: Record<string, number> = {
  '<0.5': 1.00, '0.5-1.0': 0.95, '1.0-1.5': 0.85, '>1.5': 0.75,
}
const CROWD_MULT: Record<string, number> = {
  uncrowded: 1.00, some: 0.85, crowded: 0.70, very_crowded: 0.55,
}
const VOL_MULT: Record<string, number> = {
  '<20': 1.00, '20-40': 0.90, '40-60': 0.78, '>60': 0.65,
}
const LIQ_MULT: Record<string, number> = {
  '<1': 1.00, '1-3': 0.90, '3-7': 0.75, '>7': 0.55,
}
const VOLUME_CONFIRM_MULT: Record<string, number> = {
  confirmed: 1.00, moderate: 0.85, low: 0.70,
}
// Short-specific
const SQUEEZE_MULT: Record<string, number> = {
  low: 1.00, medium: 0.80, high: 0.60, extreme: 0.40,
}
const LIQ_SHORT_MULT: Record<string, number> = {
  '<1': 1.00, '1-3': 0.85, '3-7': 0.65, '>7': 0.45,
}
const BETA_SHORT_MULT: Record<string, number> = {
  '<0.5': 1.00, '0.5-1.0': 0.90, '1.0-1.5': 0.75, '>1.5': 0.60,
}

// Catalyst timing multipliers
function timingMultiplier(months: 3 | 6 | 9): number {
  return months === 3 ? 1.0 : months === 6 ? 0.8 : 0.6
}

// ─── Band setters (longs only) ────────────────────────────────────────────────
function getBand(downside: number): { floor: number; ceiling: number } {
  if (downside <= 10) return { floor: 0.30, ceiling: 1.00 }
  if (downside <= 20) return { floor: 0.20, ceiling: 0.70 }
  return { floor: 0.15, ceiling: 0.50 }
}

// ─── Long sizer ───────────────────────────────────────────────────────────────
export function sizeLong(portfolioId: PortfolioId, inputs: SizingInputs): SizingOutput {
  const port = PORTFOLIOS[portfolioId]
  const avgPosition = port.grossLongTarget / port.defaultNames

  const gain = inputs.expected_gain_pct / 100
  const loss = inputs.downside_risk_pct / 100
  const win = inputs.win_rate

  // Skew-adjusted R/R
  const skew = gain / loss
  const skewAdjRR = (gain * 0.75 + (loss * skew) * 0.25) / loss
  const kellyRaw = win - (1 - win) / skewAdjRR

  // Band
  const { floor, ceiling } = getBand(inputs.downside_risk_pct)
  const kellyNorm = Math.max(floor, Math.min(ceiling, kellyRaw))
  const kellyBanded = kellyNorm * avgPosition

  // Timing
  const timingMult = timingMultiplier(inputs.catalyst_months)
  const afterTiming = kellyBanded * timingMult

  // Modifiers
  const conviction = CONVICTION_MULT[inputs.conviction ?? 'high']
  const beta = BETA_MULT[inputs.beta_bucket ?? '0.5-1.0']
  const crowd = CROWD_MULT[inputs.crowdedness ?? 'uncrowded']
  const vol = VOL_MULT[inputs.vol_60d_ann ?? '<20']
  const liq = LIQ_MULT[inputs.liquidity_days ?? '<1']
  const volConf = VOLUME_CONFIRM_MULT[inputs.volume_confirm ?? 'confirmed']

  const combinedMods = conviction * beta * crowd * vol * liq * volConf
  const prelim = afterTiming * combinedMods
  const floorAbs = floor * 0.4 * avgPosition
  const finalRaw = Math.max(floorAbs, prelim)
  const finalSize = Math.min(port.hardCap, finalRaw)

  // Flags
  const flags: string[] = []
  if (finalSize >= port.hardCap) flags.push('At hard cap')
  if (inputs.catalyst_months === 9) flags.push('9-month catalyst — sized at 60%')
  if (inputs.conviction === 'highest') flags.push('Highest conviction override active')
  if (crowd <= 0.70) flags.push('Crowded — squeeze risk modifier applied')
  if (vol <= 0.78) flags.push('Elevated 60d volatility')
  if (liq <= 0.75) flags.push('Liquidity constraint (>3 days to build)')
  if (beta <= 0.85) flags.push('High beta drag')
  if (volConf <= 0.70) flags.push('Low-volume MA cross — weak signal quality')
  if (kellyRaw <= 0) flags.push('Negative EV — pass on this position')
  if (combinedMods < 0.5) flags.push('Combined modifiers heavily compress sizing — consider passing')
  if (getBand(inputs.downside_risk_pct).ceiling < 1.0) flags.push('Wide downside — band compressed')

  return {
    avg_position: avgPosition,
    floor_pct: floor * avgPosition,
    ceiling_pct: ceiling * avgPosition,
    skew_adj_rr: skewAdjRR,
    kelly_raw: kellyRaw,
    kelly_banded: kellyBanded,
    timing_multiplier: timingMult,
    combined_modifiers: combinedMods,
    final_size: finalSize,
    hard_cap: port.hardCap,
    flags,
    at_hard_cap: finalSize >= port.hardCap,
    negative_ev: kellyRaw <= 0,
  }
}

// ─── Short sizer ──────────────────────────────────────────────────────────────
// Short Kelly: WIN - (1-WIN) / (gain / loss)
// gain = how much stock falls (target), loss = how much stock rallies (downside)
export function sizeShort(portfolioId: PortfolioId, inputs: SizingInputs): SizingOutput {
  const port = PORTFOLIOS[portfolioId]
  const grossShort = port.grossShortTarget
  const nShorts = Math.round(port.defaultNames * 0.45) // ~45% of names are shorts
  const avgPosition = grossShort / nShorts
  const maxPosition = 1.8 * avgPosition

  const gain = inputs.expected_gain_pct / 100  // stock falls this much
  const loss = inputs.downside_risk_pct / 100  // stock rallies this much
  const win = inputs.win_rate                  // 0.4 for shorts

  const kellyRaw = win - (1 - win) / (gain / loss)

  // Timing (shorts use simpler timing: 3mo=1.0, 1mo=0.67, 1wk=1.0 — use months as proxy)
  const timingMult = timingMultiplier(inputs.catalyst_months)

  // Normalise to baseline (50% gain / 10% loss / 0.67 timing) → scale to avg position
  const baselineKelly = 0.4 - 0.6 / (0.5 / 0.1)  // ≈ 0.28
  const kellyNorm = baselineKelly > 0 ? (kellyRaw / baselineKelly) : 0
  const kellySized = Math.min(maxPosition, Math.max(0, kellyNorm * avgPosition * timingMult))

  // Risk modifiers
  const squeeze = SQUEEZE_MULT[inputs.squeeze_risk ?? 'low']
  const vol = VOL_MULT[inputs.vol_60d_ann ?? '<20'].toString() === '<20'
    ? 1.00
    : inputs.vol_60d_ann === '20-40' ? 0.85
    : inputs.vol_60d_ann === '40-60' ? 0.70
    : 0.55
  const liq = LIQ_SHORT_MULT[inputs.liquidity_days ?? '<1']
  const beta = BETA_SHORT_MULT[inputs.beta_bucket ?? '0.5-1.0']

  const combinedMods = squeeze * vol * liq * beta
  const prelim = kellySized * combinedMods
  const finalSize = Math.min(maxPosition, Math.max(0.003 * port.aum * 10, prelim)) // floor 0.3%

  // Flags
  const flags: string[] = []
  if (kellyRaw <= 0) flags.push('Negative EV — pass (Kelly ≤ 0)')
  if (squeeze <= 0.60) flags.push('High squeeze risk')
  if (vol <= 0.70) flags.push('Elevated vol modifier')
  if (liq <= 0.65) flags.push('Liquidity constraint')
  if (beta <= 0.75) flags.push('High beta drag')
  if (combinedMods < 0.50) flags.push('Modifiers heavily constrain — consider passing')

  return {
    avg_position: avgPosition,
    floor_pct: 0.3,
    ceiling_pct: maxPosition,
    skew_adj_rr: gain / loss,
    kelly_raw: kellyRaw,
    kelly_banded: kellySized,
    timing_multiplier: timingMult,
    combined_modifiers: combinedMods,
    final_size: finalSize,
    hard_cap: maxPosition,
    flags,
    at_hard_cap: finalSize >= maxPosition * 0.99,
    negative_ev: kellyRaw <= 0,
  }
}

export function sizePosition(
  portfolioId: PortfolioId,
  direction: 'long' | 'short',
  inputs: SizingInputs
): SizingOutput {
  return direction === 'long'
    ? sizeLong(portfolioId, inputs)
    : sizeShort(portfolioId, inputs)
}
