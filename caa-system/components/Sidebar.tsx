'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: '◈' },
  { href: '/signals', label: 'All Signals', icon: '⚡' },
  { href: '/innings', label: 'Inning Tracker', icon: '⬡' },
  { href: '/portfolio/A', label: 'Port A — Quarterly', icon: 'A' },
  { href: '/portfolio/B', label: 'Port B — Semi-ann.', icon: 'B' },
  { href: '/portfolio/C', label: 'Port C — Semi-ann.', icon: 'C' },
  { href: '/portfolio/D', label: 'Port D — Quarterly', icon: 'D' },
  { href: '/portfolio/E', label: 'Port E — Annual', icon: 'E' },
  { href: '/portfolio/F', label: 'Port F — Track rec.', icon: 'F' },
  { href: '/cross', label: 'Cross-Portfolio', icon: '⊕' },
  { href: '/sizer', label: 'Position Sizer', icon: '◉' },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside style={{
      width: 200,
      minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Consumer Alpha</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', marginTop: 2 }}>Advisors</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Technical Analysis System</div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 8px', flex: 1 }}>
        {NAV.map(item => {
          const active = path === item.href || path.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 10px',
                borderRadius: 6,
                marginBottom: 1,
                background: active ? 'var(--surface2)' : 'transparent',
                border: active ? '1px solid var(--border)' : '1px solid transparent',
                color: active ? 'var(--text)' : 'var(--muted)',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all .12s',
              }}>
                <span style={{
                  width: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: item.icon.length === 1 && item.icon >= 'A' && item.icon <= 'F'
                    ? 10 : 12,
                  fontWeight: 600,
                  color: active ? 'var(--accent)' : 'var(--muted)',
                  background: active ? 'rgba(201,169,110,.1)' : 'transparent',
                  borderRadius: 3,
                  flexShrink: 0,
                }}>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        fontSize: 10,
        color: 'var(--muted)',
      }}>
        <div>Polygon.io · Supabase · Claude</div>
        <div style={{ marginTop: 3 }}>
          {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>
    </aside>
  )
}
