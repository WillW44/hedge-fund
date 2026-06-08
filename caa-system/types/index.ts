// ─── Portfolio definitions ───────────────────────────────────────────────────

export type PortfolioId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
export type Direction = 'long' | 'short'
export type PositionStatus = 'active' | 'closed'
export type IdeaStage = 'screen_hit' | 'dd_in_progress' | 'sized' | 'passed'
export type ThesisOutcome = 'confirmed' | 'partially_confirmed' | 'wrong' | 'pending'
export type Urgency = 'FIRE' | 'WATCH' | 'OK' | 'INFO'
export type PayoutCycle = 'quarterly' | 'semiannual' | 'annual'

export interface PortfolioConfig {
  id: PortfolioId
  name: string
  aum: number              // USD millions
  maxNet: number           // % e.g. 70, 20, 0
  grossLongTarget: number  // % e.g. 60
  grossShortTarget: number // % e.g. 40
  hardCap: number          // % e.g. 10
  defaultNames: number     // typical idea count
  payoutCycle: PayoutCycle
  carryRate: number        // % e.g. 10, 12.5, 15
  retainerQuarterly: number // USD e.g. 40000
  isHedged: boolean
  exposure: 'europe_us' | 'europe' | 'us'
  timingMultiplier: number // 1.0, 0.8, or 0.6
  winRate: number          // 0.5 longs, 0.4 shorts
  notes: string
}

// ─── Supabase table types ─────────────────────────────────────────────────────

export interface Position {
  id: string
  portfolio_id: PortfolioId
  ticker: string
  direction: Direction
  entry_date: string
  entry_price: number
  current_price: number
  size_pct: number         // % of NAV
  inning: number           // 1–9
  thesis_summary: string
  catalyst_date: string | null
  catalyst_description: string | null
  sizing_inputs: SizingInputs
  sizing_output: SizingOutput
  status: PositionStatus
  created_at: string
  updated_at: string
}

export interface Idea {
  id: string
  portfolio_id: PortfolioId
  ticker: string
  direction: Direction
  stage: IdeaStage
  screen_category: 'hard_catalyst' | 'soft_catalyst' | 'momentum' | 'governance' | 'singular_reliance' | 'accounting'
  screen_criteria: string[]
  dd_checklist_pct: number  // 0–100
  thesis_summary: string
  created_at: string
  updated_at: string
}

export interface Trade {
  id: string
  portfolio_id: PortfolioId
  ticker: string
  direction: Direction
  entry_date: string
  exit_date: string
  entry_price: number
  exit_price: number
  size_pct: number
  pnl_pct: number
  holding_days: number
  thesis_outcome: ThesisOutcome
  notes: string
  created_at: string
}

export interface SizingDecision {
  id: string
  portfolio_id: PortfolioId
  ticker: string
  direction: Direction
  inputs: SizingInputs
  kelly_raw: number
  kelly_banded: number
  final_size: number
  flags: string[]
  timestamp: string
}

export interface Memo {
  id: string
  idea_id: string | null
  position_id: string | null
  portfolio_id: PortfolioId
  ticker: string
  version: number
  content: string          // markdown
  created_at: string
}

export interface ScreenResult {
  id: string
  ticker: string
  screen_category: string
  criteria_triggered: string[]
  score: number
  eligible_portfolios: PortfolioId[]
  date: string
  created_at: string
}

export interface DigestLog {
  id: string
  timestamp: string
  digest_type: 'morning' | 'afternoon'
  tickers_covered: string[]
  headlines: string[]
  content: string
}

// ─── Kelly position sizer types ──────────────────────────────────────────────

export interface SizingInputs {
  // Core
  expected_gain_pct: number     // e.g. 50 = +50%
  downside_risk_pct: number     // e.g. 20 = -20%
  catalyst_months: 3 | 6 | 9
  win_rate: number              // 0.5 for longs, 0.4 for shorts

  // Modifiers — longs
  conviction?: 'low' | 'medium' | 'high' | 'highest'
  beta_bucket?: '<0.5' | '0.5-1.0' | '1.0-1.5' | '>1.5'
  crowdedness?: 'uncrowded' | 'some' | 'crowded' | 'very_crowded'
  vol_60d_ann?: '<20' | '20-40' | '40-60' | '>60'
  liquidity_days?: '<1' | '1-3' | '3-7' | '>7'
  volume_confirm?: 'confirmed' | 'moderate' | 'low'

  // Modifiers — shorts
  squeeze_risk?: 'low' | 'medium' | 'high' | 'extreme'
}

export interface SizingOutput {
  avg_position: number
  floor_pct: number
  ceiling_pct: number
  skew_adj_rr: number
  kelly_raw: number
  kelly_banded: number
  timing_multiplier: number
  combined_modifiers: number
  final_size: number
  hard_cap: number
  flags: string[]
  at_hard_cap: boolean
  negative_ev: boolean
}

// ─── Signal / technical analysis types ───────────────────────────────────────

export interface TechnicalSignal {
  ticker: string
  signal_type: SignalType
  direction: Direction
  urgency: Urgency
  inning: number
  value: number | null       // e.g. RSI value, MA ratio, borrow cost
  threshold: number | null
  description: string
  eligible_portfolios: PortfolioId[]
  action: string
  flag: string
  fired_at: string
}

export type SignalType =
  | 'ma_cross_up'
  | 'ma_cross_down'
  | 'ma_cross_volume_confirmed'
  | 'rsi_overbought'
  | 'rsi_oversold'
  | 'rsi_divergence_bullish'
  | 'rsi_divergence_bearish'
  | 'new_52w_high'
  | 'new_52w_low'
  | 'near_52w_high_short'       // short within 5-8% of high → termination warning
  | 'insider_buy_at_high'
  | 'insider_sell_at_low'
  | 'relative_strength_top_quartile'
  | 'relative_strength_drop'    // dropped from top to bottom quartile
  | 'underperforming_category'
  | 'put_call_elevated'
  | 'eps_revision_up_20'
  | 'eps_revision_down_20'
  | 'revenue_miss_5'
  | 'ebitda_miss_10'
  | 'hard_catalyst'
  | 'soft_catalyst'
  | 'catalyst_countdown'
  | 'earnings_proximity'
  | 'fcf_yield_expanding'
  | 'ev_ebitda_zscore_low'      // <= -2σ (long signal)
  | 'ev_ebitda_zscore_high'     // >= +2σ (exit/short signal)
  | 'ev_sales_percentile_low'
  | 'governance_flag'
  | 'singular_reliance'
  | 'accounting_flag'
  | 'short_interest_rising'
  | 'short_interest_falling'
  | 'dtc_rising'
  | 'borrow_cost_rising'
  | 'borrow_cost_breach'        // >20% → mandatory exit
  | 'window_dressing_squeeze'   // Q-end + SI>15% + cap<$2B
  | 'factor_tilt_warning'
  | 'correlation_cluster_risk'

// ─── Polygon.io market data ───────────────────────────────────────────────────

export interface PolygonQuote {
  ticker: string
  close: number
  open: number
  high: number
  low: number
  volume: number
  vwap: number
  date: string
}

export interface PolygonAggregate {
  ticker: string
  results: {
    c: number  // close
    o: number  // open
    h: number  // high
    l: number  // low
    v: number  // volume
    vw: number // vwap
    t: number  // timestamp ms
  }[]
}

export interface TechnicalIndicators {
  ticker: string
  date: string
  close: number
  ma15: number
  ma150: number
  ma_cross_up: boolean
  ma_cross_down: boolean
  volume_20d_avg: number
  volume_ratio: number       // today / 20d avg
  rsi14: number
  high_52w: number
  low_52w: number
  pct_from_52w_high: number
  pct_from_52w_low: number
  sector_etf_return_30d: number
  stock_return_30d: number
  relative_strength_30d: number
}

// ─── Cross-portfolio ──────────────────────────────────────────────────────────

export interface CrossPortfolioEntry {
  ticker: string
  portfolios: { [K in PortfolioId]?: Direction | 'breach' }
  conviction_count: number
  direction: Direction
  implication: string
}

export interface FactorExposure {
  factor: string
  direction: 'long' | 'short' | 'neutral'
  exposure_score: number  // 0–100
  driven_by: string[]
  portfolios_affected: PortfolioId[]
  risk_note: string
  action: string
}

// ─── Digest ───────────────────────────────────────────────────────────────────

export interface DigestSection {
  title: string
  content: string
  tickers: string[]
  urgency: Urgency
}

export interface DigestPayload {
  type: 'morning' | 'afternoon'
  timestamp: string
  index_futures: { symbol: string; change_pct: number }[]
  sector_etfs: { symbol: string; name: string; change_pct: number }[]
  position_news: { ticker: string; portfolio: PortfolioId; headline: string; source: string }[]
  earnings_calendar: { ticker: string; date: string; consensus_eps: number | null }[]
  signal_alerts: TechnicalSignal[]
  ai_summary: string
}
