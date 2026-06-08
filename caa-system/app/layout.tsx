import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CAA — Consumer Alpha Advisors',
  description: 'Technical Analysis System — 6 Portfolios',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
