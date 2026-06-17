// caa-system/app/api/eod/route.ts
// Server-side EODHD proxy for the technical long screen.
// The browser calls /api/eod?ticker=...&from=... and this route fetches EODHD
// using the key held in Cloudflare env — so no key is ever exposed in the page,
// and the browser-side CORS block goes away (same-origin request).

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export async function GET(req: Request) {
  // Try the common env var names so it works whatever the key is stored as.
  const key =
    process.env.EODHD_API_KEY ||
    process.env.POLYGON_API_KEY ||
    process.env.EODHD_TOKEN;

  if (!key) {
    return new Response(
      JSON.stringify({ error: "EODHD key not found in environment. Set EODHD_API_KEY in Cloudflare Pages settings." }),
      { status: 500, headers: HEADERS },
    );
  }

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  const from = searchParams.get("from") || "";
  if (!ticker) {
    return new Response(JSON.stringify({ error: "missing ticker" }), { status: 400, headers: HEADERS });
  }

  const url =
    `https://eodhd.com/api/eod/${encodeURIComponent(ticker)}` +
    `?period=d&fmt=json${from ? `&from=${from}` : ""}&api_token=${key}`;

  try {
    const r = await fetch(url);
    const body = await r.text();
    return new Response(body, { status: r.status, headers: HEADERS });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `upstream fetch failed: ${(e as Error).message}` }),
      { status: 502, headers: HEADERS },
    );
  }
}
