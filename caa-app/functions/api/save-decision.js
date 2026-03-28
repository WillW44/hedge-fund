export async function onRequestPost(context) {
  const { SUPABASE_URL, SUPABASE_KEY } = context.env;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { ticker, sizer_type, inputs, final_size } = body;
  if (!ticker || !sizer_type) {
    return json({ error: 'ticker and sizer_type are required' }, 400);
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return json({ error: 'Supabase credentials not configured' }, 500);
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/sizing_decisions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      ticker,
      sizer_type,
      inputs,
      final_size,
      decided_at: new Date().toISOString(),
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return json({ error: err }, 500);
  }

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
