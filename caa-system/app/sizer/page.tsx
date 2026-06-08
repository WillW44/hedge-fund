'use client'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { sizePosition } from '@/lib/sizer'
import { PORTFOLIOS } from '@/lib/portfolios'
import type { PortfolioId, SizingInputs, SizingOutput } from '@/types'

export default function SizerPage() {
  const [portfolioId, setPortfolioId] = useState<PortfolioId>('A')
  const [ticker, setTicker] = useState('')
  const [direction, setDirection] = useState<'long' | 'short'>('long')
  const [output, setOutput] = useState<SizingOutput | null>(null)
  const [logging, setLogging] = useState(false)
  const [logged, setLogged] = useState(false)

  const [inputs, setInputs] = useState<SizingInputs>({
    expected_gain_pct: 50,
    downside_risk_pct: 20,
    catalyst_months: 6,
    win_rate: 0.5,
    conviction: 'high',
    beta_bucket: '0.5-1.0',
    crowdedness: 'uncrowded',
    vol_60d_ann: '20-40',
    liquidity_days: '1-3',
    volume_confirm: 'confirmed',
    squeeze_risk: 'low',
  })

  const update = (key: keyof SizingInputs, value: any) => {
    setInputs(prev => ({ ...prev, [key]: value }))
    setLogged(false)
  }

  const calc = () => {
    const inp = { ...inputs, win_rate: direction === 'short' ? 0.4 : 0.5 }
    const result = sizePosition(portfolioId, direction, inp)
    setOutput(result)
    setLogged(false)
  }

  const logToDb = async () => {
    if (!ticker || !output) return
    setLogging(true)
    try {
      await fetch('/api/sizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioId, ticker, direction, inputs }),
      })
      setLogged(true)
    } finally {
      setLogging(false)
    }
  }

  const port = PORTFOLIOS[portfolioId]

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '24px 28px', overflow: 'auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>CAA Kelly Sizer</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>Position Sizer</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Deterministic Kelly-based sizing per CLAUDE.md. Every decision logged to Supabase.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Inputs */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="sec-header" style={{ marginTop: 0 }}>Inputs</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Portfolio</label>
                <select value={portfolioId} onChange={e => setPortfolioId(e.target.value as PortfolioId)} style={{ width: '100%' }}>
                  {Object.values(PORTFOLIOS).map(p => (
                    <option key={p.id} value={p.id}>{p.id} — {p.payoutCycle} · {p.aum}M</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Direction</label>
                <select value={direction} onChange={e => setDirection(e.target.value as 'long' | 'short')} style={{ width: '100%' }}>
                  <option value="long">Long (Champagne)</option>
                  <option value="short">Short (Tripwire)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Ticker <span style={{ color: 'var(--accent)' }}>*required to log</span></label>
              <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="e.g. AN US" style={{ width: '100%' }} />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Core Kelly inputs</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Expected {direction === 'long' ? 'gain' : 'fall'}</label>
                  <select value={inputs.expected_gain_pct} onChange={e => update('expected_gain_pct', +e.target.value)} style={{ width: '100%' }}>
                    <option value={30}>+30%</option>
                    <option value={50}>+50%</option>
                    <option value={75}>+75%</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Downside / rally risk</label>
                  <select value={inputs.downside_risk_pct} onChange={e => update('downside_risk_pct', +e.target.value)} style={{ width: '100%' }}>
                    <option value={10}>−10%</option>
                    <option value={20}>−20%</option>
                    <option value={30}>−30%</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Catalyst timing</label>
                  <select value={inputs.catalyst_months} onChange={e => update('catalyst_months', +e.target.value as 3 | 6 | 9)} style={{ width: '100%' }}>
                    <option value={3}>3 months (1.0×)</option>
                    <option value={6}>6 months (0.8×)</option>
                    <option value={9}>9 months (0.6×)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Conviction</label>
                  <select value={inputs.conviction} onChange={e => update('conviction', e.target.value)} style={{ width: '100%' }}>
                    <option value="low">Low (0.70×)</option>
                    <option value="medium">Medium (0.90×)</option>
                    <option value="high">High (1.00×)</option>
                    <option value="highest">Highest (1.25×) ⚑</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Risk modifiers</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {direction === 'long' ? <>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Beta</label>
                    <select value={inputs.beta_bucket} onChange={e => update('beta_bucket', e.target.value)} style={{ width: '100%' }}>
                      <option value="<0.5">&lt;0.5 (1.00×)</option>
                      <option value="0.5-1.0">0.5–1.0 (0.95×)</option>
                      <option value="1.0-1.5">1.0–1.5 (0.85×)</option>
                      <option value=">1.5">&gt;1.5 (0.75×)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Crowdedness</label>
                    <select value={inputs.crowdedness} onChange={e => update('crowdedness', e.target.value)} style={{ width: '100%' }}>
                      <option value="uncrowded">Uncrowded (1.00×)</option>
                      <option value="some">Some (0.85×)</option>
                      <option value="crowded">Crowded (0.70×)</option>
                      <option value="very_crowded">Very crowded (0.55×)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Vol (60d ann.)</label>
                    <select value={inputs.vol_60d_ann} onChange={e => update('vol_60d_ann', e.target.value)} style={{ width: '100%' }}>
                      <option value="<20">&lt;20% (1.00×)</option>
                      <option value="20-40">20–40% (0.90×)</option>
                      <option value="40-60">40–60% (0.78×)</option>
                      <option value=">60">&gt;60% (0.65×)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Liquidity (days to build)</label>
                    <select value={inputs.liquidity_days} onChange={e => update('liquidity_days', e.target.value)} style={{ width: '100%' }}>
                      <option value="<1">&lt;1 day (1.00×)</option>
                      <option value="1-3">1–3 days (0.90×)</option>
                      <option value="3-7">3–7 days (0.75×)</option>
                      <option value=">7">&gt;7 days (0.55×)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Volume confirmation</label>
                    <select value={inputs.volume_confirm} onChange={e => update('volume_confirm', e.target.value)} style={{ width: '100%' }}>
                      <option value="confirmed">Confirmed &gt;1.5× (1.00×)</option>
                      <option value="moderate">Moderate (0.85×)</option>
                      <option value="low">Low — weak signal (0.70×)</option>
                    </select>
                  </div>
                </> : <>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Squeeze risk</label>
                    <select value={inputs.squeeze_risk} onChange={e => update('squeeze_risk', e.target.value)} style={{ width: '100%' }}>
                      <option value="low">Low (1.00×)</option>
                      <option value="medium">Medium (0.80×)</option>
                      <option value="high">High (0.60×)</option>
                      <option value="extreme">Extreme/meme (0.40×)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Vol (60d ann.)</label>
                    <select value={inputs.vol_60d_ann} onChange={e => update('vol_60d_ann', e.target.value)} style={{ width: '100%' }}>
                      <option value="<20">&lt;20% (1.00×)</option>
                      <option value="20-40">20–40% (0.85×)</option>
                      <option value="40-60">40–60% (0.70×)</option>
                      <option value=">60">&gt;60% (0.55×)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Liquidity (days to exit)</label>
                    <select value={inputs.liquidity_days} onChange={e => update('liquidity_days', e.target.value)} style={{ width: '100%' }}>
                      <option value="<1">&lt;1 day (1.00×)</option>
                      <option value="1-3">1–3 days (0.85×)</option>
                      <option value="3-7">3–7 days (0.65×)</option>
                      <option value=">7">&gt;7 days (0.45×)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Beta</label>
                    <select value={inputs.beta_bucket} onChange={e => update('beta_bucket', e.target.value)} style={{ width: '100%' }}>
                      <option value="<0.5">&lt;0.5 (1.00×)</option>
                      <option value="0.5-1.0">0.5–1.0 (0.90×)</option>
                      <option value="1.0-1.5">1.0–1.5 (0.75×)</option>
                      <option value=">1.5">&gt;1.5 (0.60×)</option>
                    </select>
                  </div>
                </>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn primary" style={{ flex: 1 }} onClick={calc}>Calculate size</button>
              {output && ticker && (
                <button className="btn" onClick={logToDb} disabled={logging || logged} style={{ flex: 1 }}>
                  {logging ? 'Logging...' : logged ? '✓ Logged' : 'Log to Supabase'}
                </button>
              )}
            </div>
          </div>

          {/* Output */}
          <div>
            {output ? <>
              <div className="card" style={{ padding: '20px', marginBottom: 16 }}>
                <div className="sec-header" style={{ marginTop: 0 }}>Sizing output — {ticker || '—'} · Port {portfolioId}</div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Final size', value: `${output.final_size.toFixed(2)}%`, big: true, color: output.negative_ev ? '#f87171' : output.at_hard_cap ? '#fbbf24' : '#4ade80' },
                    { label: 'Avg position', value: `${output.avg_position.toFixed(1)}%` },
                    { label: 'Hard cap', value: `${output.hard_cap}%` },
                    { label: 'Raw Kelly', value: `${(output.kelly_raw * 100).toFixed(1)}%` },
                    { label: 'After timing', value: `${output.kelly_banded.toFixed(2)}%` },
                    { label: 'Combined mods', value: `${output.combined_modifiers.toFixed(3)}×` },
                    { label: 'Timing multiplier', value: `${output.timing_multiplier}×` },
                    { label: 'Skew adj. R/R', value: `${output.skew_adj_rr.toFixed(2)}×` },
                    { label: 'Kelly band', value: `${output.floor_pct.toFixed(1)}–${output.ceiling_pct.toFixed(1)}%` },
                  ].map(m => (
                    <div key={m.label} className="metric-card">
                      <div className="metric-label">{m.label}</div>
                      <div className="metric-value" style={{ fontSize: m.big ? 28 : 16, color: m.color ?? 'var(--text)' }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Size bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>
                    <span>0%</span>
                    <span>Avg {output.avg_position.toFixed(1)}%</span>
                    <span>Cap {output.hard_cap}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, position: 'relative' }}>
                    <div style={{
                      height: '100%',
                      borderRadius: 4,
                      width: `${Math.min(100, (output.final_size / output.hard_cap) * 100)}%`,
                      background: output.at_hard_cap ? '#fbbf24' : output.negative_ev ? '#f87171' : '#4ade80',
                      transition: 'width .3s',
                    }} />
                    <div style={{
                      position: 'absolute',
                      top: 0, bottom: 0,
                      left: `${(output.avg_position / output.hard_cap) * 100}%`,
                      width: 1,
                      background: 'var(--muted)',
                    }} />
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    {output.final_size.toFixed(2)}% of portfolio NAV
                    {output.at_hard_cap && <span style={{ color: '#fbbf24', marginLeft: 8 }}>⚑ At hard cap</span>}
                    {output.negative_ev && <span style={{ color: '#f87171', marginLeft: 8 }}>⚑ Pass — negative EV</span>}
                  </div>
                </div>

                {/* Flags */}
                {output.flags.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>Output flags</div>
                    {output.flags.map((f, i) => (
                      <div key={i} style={{
                        fontSize: 11,
                        color: f.includes('Pass') || f.includes('breach') ? '#f87171' : '#fbbf24',
                        padding: '4px 0',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <span>⚑</span>{f}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Portfolio context */}
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Portfolio {portfolioId} context</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11 }}>
                  {[
                    ['AUM', `$${port.aum}M`],
                    ['Payout', port.payoutCycle],
                    ['Carry', port.carryRate > 0 ? `${port.carryRate}%` : `$${port.retainerQuarterly / 1000}K/qtr`],
                    ['Max net', `${port.maxNet === 0 ? 'Neutral' : port.maxNet + '%'}`],
                    ['Hard cap', `${port.hardCap}%`],
                    ['Exposure', port.exposure.replace('_', ' & ')],
                    ['Timing ×', `${port.timingMultiplier}×`],
                    ['Win rate', `${(port.winRate * 100).toFixed(0)}%`],
                    ['Default names', String(port.defaultNames)],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ color: 'var(--muted)', fontSize: 9, marginBottom: 2 }}>{l}</div>
                      <div style={{ fontWeight: 500 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>{port.notes}</div>
              </div>
            </> : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 300,
                color: 'var(--muted)',
                fontSize: 13,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}>
                Select inputs and click "Calculate size" to run the Kelly sizer.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
