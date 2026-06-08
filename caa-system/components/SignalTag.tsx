import type { TechnicalSignal } from '@/types'

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  ma_cross_up:              { bg: 'rgba(251,191,36,.15)', color: '#fbbf24' },
  ma_cross_down:            { bg: 'rgba(248,113,113,.15)', color: '#f87171' },
  ma_cross_volume_confirmed:{ bg: 'rgba(74,222,128,.2)', color: '#4ade80' },
  rsi_overbought:           { bg: 'rgba(251,191,36,.15)', color: '#fbbf24' },
  rsi_oversold:             { bg: 'rgba(248,113,113,.2)', color: '#f87171' },
  rsi_divergence_bullish:   { bg: 'rgba(74,222,128,.15)', color: '#4ade80' },
  rsi_divergence_bearish:   { bg: 'rgba(248,113,113,.15)', color: '#f87171' },
  new_52w_high:             { bg: 'rgba(74,222,128,.15)', color: '#4ade80' },
  new_52w_low:              { bg: 'rgba(248,113,113,.15)', color: '#f87171' },
  near_52w_high_short:      { bg: 'rgba(251,191,36,.2)', color: '#fbbf24' },
  insider_buy_at_high:      { bg: 'rgba(74,222,128,.15)', color: '#4ade80' },
  insider_sell_at_low:      { bg: 'rgba(248,113,113,.15)', color: '#f87171' },
  eps_revision_up_20:       { bg: 'rgba(139,92,246,.2)', color: '#a78bfa' },
  eps_revision_down_20:     { bg: 'rgba(248,113,113,.15)', color: '#f87171' },
  governance_flag:          { bg: 'rgba(248,113,113,.15)', color: '#f87171' },
  accounting_flag:          { bg: 'rgba(167,139,250,.15)', color: '#a78bfa' },
  singular_reliance:        { bg: 'rgba(251,146,60,.15)', color: '#fb923c' },
  borrow_cost_breach:       { bg: 'rgba(248,113,113,.3)', color: '#f87171' },
  borrow_cost_rising:       { bg: 'rgba(251,191,36,.15)', color: '#fbbf24' },
  window_dressing_squeeze:  { bg: 'rgba(248,113,113,.2)', color: '#f87171' },
  ev_ebitda_zscore_low:     { bg: 'rgba(96,165,250,.15)', color: '#60a5fa' },
  ev_ebitda_zscore_high:    { bg: 'rgba(251,191,36,.15)', color: '#fbbf24' },
  fcf_yield_expanding:      { bg: 'rgba(74,222,128,.15)', color: '#4ade80' },
  catalyst_countdown:       { bg: 'rgba(139,92,246,.15)', color: '#a78bfa' },
  earnings_proximity:       { bg: 'rgba(251,191,36,.15)', color: '#fbbf24' },
  short_interest_rising:    { bg: 'rgba(251,191,36,.15)', color: '#fbbf24' },
  dtc_rising:               { bg: 'rgba(251,191,36,.15)', color: '#fbbf24' },
  relative_strength_drop:   { bg: 'rgba(248,113,113,.12)', color: '#f87171' },
  put_call_elevated:        { bg: 'rgba(96,165,250,.15)', color: '#60a5fa' },
}

const LABELS: Record<string, string> = {
  ma_cross_up: 'MA cross ↑',
  ma_cross_down: 'MA cross ↓',
  ma_cross_volume_confirmed: 'Vol-confirmed MA ↑',
  rsi_overbought: 'RSI overbought',
  rsi_oversold: 'RSI oversold',
  rsi_divergence_bullish: 'RSI div. bullish',
  rsi_divergence_bearish: 'RSI div. bearish',
  new_52w_high: '52w high',
  new_52w_low: '52w low',
  near_52w_high_short: 'Near 52w high',
  insider_buy_at_high: 'Insider buy @ high',
  insider_sell_at_low: 'Insider sell @ low',
  eps_revision_up_20: '+20% EPS rev.',
  eps_revision_down_20: '−20% EPS rev.',
  governance_flag: 'Governance flag',
  accounting_flag: 'Accounting flag',
  singular_reliance: 'Singular reliance',
  borrow_cost_breach: 'Borrow breach!',
  borrow_cost_rising: 'Borrow rising',
  window_dressing_squeeze: 'Q-end squeeze risk',
  ev_ebitda_zscore_low: 'EV/EBITDA −2σ',
  ev_ebitda_zscore_high: 'EV/EBITDA +2σ',
  fcf_yield_expanding: 'FCF expanding',
  catalyst_countdown: 'Catalyst countdown',
  earnings_proximity: 'Earnings proximity',
  short_interest_rising: 'SI rising',
  dtc_rising: 'DTC rising',
  relative_strength_drop: 'RS drop',
  put_call_elevated: 'Put/call elevated',
}

export function SignalTag({ type }: { type: string }) {
  const style = TAG_STYLES[type] ?? { bg: 'rgba(113,113,122,.15)', color: '#a1a1aa' }
  const label = LABELS[type] ?? type.replace(/_/g, ' ')
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 9,
      fontWeight: 500,
      padding: '2px 6px',
      borderRadius: 3,
      background: style.bg,
      color: style.color,
      marginRight: 3,
      marginBottom: 2,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    FIRE:  { bg: 'rgba(248,113,113,.15)', color: '#f87171' },
    WATCH: { bg: 'rgba(251,191,36,.15)',  color: '#fbbf24' },
    OK:    { bg: 'rgba(74,222,128,.12)',  color: '#4ade80' },
    INFO:  { bg: 'rgba(96,165,250,.12)',  color: '#60a5fa' },
  }
  const s = styles[urgency] ?? styles.INFO
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
      background: s.bg, color: s.color, letterSpacing: '.04em',
    }}>
      {urgency}
    </span>
  )
}
