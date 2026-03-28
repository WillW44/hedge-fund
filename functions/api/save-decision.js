export async function onRequestPost(context) {
  const { SUPABASE_URL, SUPABASE_KEY } = context.env;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return json({ error: 'Supabase credentials not configured' }, 500);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  // Fields sent by both long and short sizers:
  // { ticker, sizer_type, inputs: { loss, gain, skew?, time, conv?, beta, crowd?, vol, liq, squeeze?, N }, final_size }
  const { ticker, sizer_type, inputs, final_size } = body;
  if (!ticker || !sizer_type) {
    return json({ error: 'ticker and sizer_type are required' }, 400);
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
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return json({ error: err }, 500);
  }

  return json({ success: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
