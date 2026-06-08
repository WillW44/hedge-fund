import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Browser client (uses anon key)
export function createBrowserClient() {
  return createClient(url, anonKey)
}

// Server client (uses service role — full access, server-side only)
export function createServerClient() {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ─── Database helpers ─────────────────────────────────────────────────────────

export async function getPositions(portfolioId?: string) {
  const db = createServerClient()
  let q = db
    .from('positions')
    .select('*')
    .eq('status', 'active')
    .order('portfolio_id', { ascending: true })
  if (portfolioId) q = q.eq('portfolio_id', portfolioId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function upsertPosition(position: Record<string, unknown>) {
  const db = createServerClient()
  const { data, error } = await db
    .from('positions')
    .upsert(position, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getIdeas(stage?: string) {
  const db = createServerClient()
  let q = db.from('ideas').select('*').order('created_at', { ascending: false })
  if (stage) q = q.eq('stage', stage)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function logSizingDecision(decision: Record<string, unknown>) {
  const db = createServerClient()
  const { error } = await db.from('sizing_decisions').insert(decision)
  if (error) console.error('Failed to log sizing decision:', error)
}

export async function logScreenResult(result: Record<string, unknown>) {
  const db = createServerClient()
  const { error } = await db.from('screen_results').insert(result)
  if (error) console.error('Failed to log screen result:', error)
}

export async function logDigest(digest: Record<string, unknown>) {
  const db = createServerClient()
  const { error } = await db.from('digest_log').insert(digest)
  if (error) console.error('Failed to log digest:', error)
}

export async function getMemos(portfolioId?: string, ticker?: string) {
  const db = createServerClient()
  let q = db.from('memos').select('*').order('created_at', { ascending: false })
  if (portfolioId) q = q.eq('portfolio_id', portfolioId)
  if (ticker) q = q.eq('ticker', ticker)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getTrades(portfolioId?: string) {
  const db = createServerClient()
  let q = db.from('trades').select('*').order('exit_date', { ascending: false })
  if (portfolioId) q = q.eq('portfolio_id', portfolioId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getScreenResults(days = 7) {
  const db = createServerClient()
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  const { data, error } = await db
    .from('screen_results')
    .select('*')
    .gte('date', since)
    .order('score', { ascending: false })
  if (error) throw error
  return data ?? []
}
