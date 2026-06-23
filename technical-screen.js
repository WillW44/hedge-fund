// ============================================================
// CAA TECHNICAL SHORT SCREEN
// Computes 5 short-timing signals per ticker from EODHD daily data,
// scores them, prints a ranked table, writes CSV, and upserts to
// Supabase table `technical_signals`.
//
// Usage (CMD):
//   cd C:\Users\willw\hedge-fund
//   set EODHD_API_KEY=your_key
//   set SUPABASE_URL=https://owhenoimtkqpoldjwjsh.supabase.co
//   set SUPABASE_SERVICE_KEY=your_service_role_key
//   node technical-screen.js                 (full universe)
//   node technical-screen.js --ticker AERO.SW (single name)
//   node technical-screen.js --no-supabase    (skip DB write)
//   node technical-screen.js --selftest       (synthetic data check, no API)
//
// Signals (each true/false, score = count, SHORT-READY = score>=3 AND sig2):
//   1 failed_breakout       lower-high retest of prior high on weak volume
//   2 ma_structure          close < falling 50dma, 200dma flat/down (MANDATORY GATE)
//   3 rs_breakdown          relative strength vs benchmark rolling over
//   4 volume_distribution   heavy down-day volume / OBV divergence
//   5 unreclaimed_gap       high-volume gap-down never reclaimed
// ============================================================

const fs = require("fs");
const path = require("path");

const EODHD_KEY = process.env.EODHD_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ARGS = process.argv.slice(2);
const FLAG_NO_SUPABASE = ARGS.includes("--no-supabase");
const FLAG_SELFTEST = ARGS.includes("--selftest");
const FLAG_RESUME = ARGS.includes("--resume");      // skip names already in the checkpoint
const FLAG_FRESH = ARGS.includes("--fresh");        // ignore/clear any checkpoint
const tickerArgIdx = ARGS.indexOf("--ticker");
const SINGLE_TICKER = tickerArgIdx >= 0 ? ARGS[tickerArgIdx + 1] : null;
const bookArgIdx = ARGS.indexOf("--book");          // --book book  | --book universe
const BOOK_FILTER = bookArgIdx >= 0 ? ARGS[bookArgIdx + 1] : null;

const DELAY_MS = 1200; // be polite to EODHD, mirrors orchestrator rate-limit discipline
const LOOKBACK_DAYS = 560; // calendar days fetched (~380 trading sessions)
const CHECKPOINT_EVERY = 10; // flush results to disk + Supabase every N names

// ------------------------------------------------------------
// Generic helpers
// ------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const round = (x, d = 2) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null);

function sma(closes, n, i) {
  if (i + 1 < n) return NaN;
  return avg(closes.slice(i - n + 1, i + 1));
}

// ------------------------------------------------------------
// Data fetch (EODHD), split-adjusted OHLC
// ------------------------------------------------------------
async function fetchEod(ticker) {
  const from = new Date(Date.now() - LOOKBACK_DAYS * 86400e3)
    .toISOString()
    .slice(0, 10);
  const url = `https://eodhd.com/api/eod/${encodeURIComponent(
    ticker
  )}?api_token=${EODHD_KEY}&period=d&fmt=json&from=${from}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EODHD ${ticker}: HTTP ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw) || raw.length < 220)
    throw new Error(`EODHD ${ticker}: insufficient history (${raw?.length || 0} rows, need 220+)`);
  // Adjust OHLC by the adjusted_close factor so splits don't create fake gaps/MA breaks
  return raw.map((r) => {
    const f = r.close ? r.adjusted_close / r.close : 1;
    return {
      date: r.date,
      open: r.open * f,
      high: r.high * f,
      low: r.low * f,
      close: r.adjusted_close,
      volume: r.volume,
    };
  });
}

// ------------------------------------------------------------
// Signal 1: failed breakout / lower high on declining volume
// ------------------------------------------------------------
function sigFailedBreakout(rows) {
  const n = rows.length - 1;
  const recent = rows.slice(n - 24);                  // last 25 sessions
  const prior = rows.slice(Math.max(0, n - 120), n - 24);
  if (prior.length < 40) return { fired: false };

  let rHigh = -Infinity, rIdx = -1;
  recent.forEach((r, i) => { if (r.high > rHigh) { rHigh = r.high; rIdx = i; } });
  const pHigh = Math.max(...prior.map((r) => r.high));
  const close = rows[n].close;

  const retest = rHigh < pHigh && rHigh >= 0.92 * pHigh; // got close, failed
  const rolledOver = close < rHigh * 0.97;               // rejected >=3% off the retest high
  // volume on the retest leg vs the 60-session baseline
  const gIdx = n - 24 + rIdx;
  const legVol = avg(rows.slice(Math.max(0, gIdx - 4), gIdx + 1).map((r) => r.volume));
  const baseVol = avg(rows.slice(n - 59).map((r) => r.volume));
  const weakVolume = legVol < 0.85 * baseVol;

  return {
    fired: retest && rolledOver && weakVolume,
    detail: {
      prior_high: round(pHigh), retest_high: round(rHigh),
      retest_vs_prior_pct: round((rHigh / pHigh - 1) * 100, 1),
      retest_leg_vol_vs_60d: round(legVol / baseVol, 2),
    },
  };
}

// ------------------------------------------------------------
// Signal 2: MA structure broken (mandatory gate)
// ------------------------------------------------------------
function sigMaStructure(rows) {
  const closes = rows.map((r) => r.close);
  const n = closes.length - 1;
  const s50 = sma(closes, 50, n);
  const s50p = sma(closes, 50, n - 10);
  const s200 = sma(closes, 200, n);
  const s200p = sma(closes, 200, n - 20);
  if (![s50, s50p, s200, s200p].every(Number.isFinite)) return { fired: false };

  const belowFalling50 = closes[n] < s50 && s50 < s50p;
  const flat200 = s200 <= s200p * 1.002; // flat or declining
  return {
    fired: belowFalling50 && flat200,
    detail: {
      close: round(closes[n]), sma50: round(s50), sma200: round(s200),
      sma50_slope_10d_pct: round((s50 / s50p - 1) * 100, 2),
      sma200_slope_20d_pct: round((s200 / s200p - 1) * 100, 2),
    },
  };
}

// ------------------------------------------------------------
// Signal 3: relative strength breakdown vs benchmark
// ------------------------------------------------------------
function sigRsBreakdown(rows, benchRows) {
  const benchMap = new Map(benchRows.map((r) => [r.date, r.close]));
  const rs = [];
  for (const r of rows) {
    const b = benchMap.get(r.date);
    if (b) rs.push(r.close / b);
  }
  if (rs.length < 65) return { fired: false };
  const n = rs.length - 1;

  const ret20 = rs[n] / rs[n - 20] - 1;
  const maxRecent = Math.max(...rs.slice(n - 19));
  const maxPrior = Math.max(...rs.slice(n - 59, n - 19));
  const lowerHighs = maxRecent < maxPrior * 0.99;

  return {
    fired: (lowerHighs && ret20 < 0) || ret20 < -0.05,
    detail: {
      rs_ret_20d_pct: round(ret20 * 100, 1),
      rs_lower_highs: lowerHighs,
    },
  };
}

// ------------------------------------------------------------
// Signal 4: distribution volume signature / OBV divergence
// ------------------------------------------------------------
function sigVolumeDistribution(rows) {
  const n = rows.length - 1;
  const last20 = rows.slice(n - 19);
  const downVol = [], upVol = [];
  for (let i = 0; i < last20.length; i++) {
    const prev = i === 0 ? rows[n - 20] : last20[i - 1];
    (last20[i].close < prev.close ? downVol : upVol).push(last20[i].volume);
  }
  const ratio = avg(downVol) / avg(upVol);

  // OBV over last ~60 sessions, compare now vs 30 sessions ago
  let obv = 0;
  const obvSeries = [];
  for (let i = n - 60; i <= n; i++) {
    const d = rows[i].close - rows[i - 1].close;
    obv += d > 0 ? rows[i].volume : d < 0 ? -rows[i].volume : 0;
    obvSeries.push(obv);
  }
  const obvNow = obvSeries[obvSeries.length - 1];
  const obvPrev = obvSeries[obvSeries.length - 31];
  const priceFlatOrUp = rows[n].close >= rows[n - 30].close * 0.97;
  const obvDivergence = obvNow < obvPrev && priceFlatOrUp;

  return {
    fired: ratio > 1.3 || obvDivergence,
    detail: {
      down_up_vol_ratio_20d: round(ratio, 2),
      obv_divergence_30d: obvDivergence,
    },
  };
}

// ------------------------------------------------------------
// Signal 5: unreclaimed high-volume gap-down
// ------------------------------------------------------------
function sigUnreclaimedGap(rows) {
  const n = rows.length - 1;
  for (let i = n - 5; i >= Math.max(21, n - 60); i--) {
    const gapPct = rows[i].open / rows[i - 1].low - 1;
    const vol20 = avg(rows.slice(i - 20, i).map((r) => r.volume));
    if (gapPct < -0.03 && rows[i].volume > 1.5 * vol20) {
      const gapTop = rows[i - 1].low;
      const reclaimed = rows.slice(i, n + 1).some((r) => r.close > gapTop);
      if (!reclaimed) {
        return {
          fired: true,
          detail: {
            gap_date: rows[i].date,
            gap_pct: round(gapPct * 100, 1),
            gap_top: round(gapTop),
            close_vs_gap_top_pct: round((rows[n].close / gapTop - 1) * 100, 1),
          },
        };
      }
    }
  }
  return { fired: false };
}

// ------------------------------------------------------------
// Stop suggestion: recent swing high (15 sessions); flag if too far
// ------------------------------------------------------------
function suggestStop(rows) {
  const n = rows.length - 1;
  const stop = Math.max(...rows.slice(n - 14).map((r) => r.high));
  const dist = stop / rows[n].close - 1;
  return { stop: round(stop), distPct: round(dist * 100, 1) };
}

// ------------------------------------------------------------
// Per-ticker evaluation
// ------------------------------------------------------------
function evaluate(rows, benchRows) {
  const s1 = sigFailedBreakout(rows);
  const s2 = sigMaStructure(rows);
  const s3 = sigRsBreakdown(rows, benchRows);
  const s4 = sigVolumeDistribution(rows);
  const s5 = sigUnreclaimedGap(rows);
  const score = [s1, s2, s3, s4, s5].filter((s) => s.fired).length; // raw count (kept for reference)
  // Weighted: structure = gate (no points); failed breakout + gap = 3 each (Tier-2
  // confirmers); RS + volume = 1 each (Tier-3 context). Max 8.
  const weighted =
    (s1.fired ? 3 : 0) + (s5.fired ? 3 : 0) + (s3.fired ? 1 : 0) + (s4.fired ? 1 : 0);
  const shortReady = s2.fired && weighted >= 3; // gate + at least one Tier-2 confirmer
  const { stop, distPct } = suggestStop(rows);
  return {
    close: round(rows[rows.length - 1].close),
    as_of: rows[rows.length - 1].date,
    sig_failed_breakout: s1.fired,
    sig_ma_structure: s2.fired,
    sig_rs_breakdown: s3.fired,
    sig_volume_distribution: s4.fired,
    sig_unreclaimed_gap: s5.fired,
    score,
    weighted,
    short_ready: shortReady,
    suggested_stop: stop,
    stop_distance_pct: distPct,
    stop_too_far: distPct > 12,
    details: { s1: s1.detail, s2: s2.detail, s3: s3.detail, s4: s4.detail, s5: s5.detail },
  };
}

// ------------------------------------------------------------
// Supabase upsert (REST, merge on ticker)
// ------------------------------------------------------------
async function upsertSupabase(records) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/technical_signals?on_conflict=ticker`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(records),
  });
  if (!res.ok) throw new Error(`Supabase upsert failed: HTTP ${res.status} ${await res.text()}`);
}

// ------------------------------------------------------------
// Self-test on synthetic data (no API needed)
// ------------------------------------------------------------
function selftest() {
  // Build a synthetic downtrend: 300 sessions, peak mid-way, gap-down, weak retest
  const rows = [];
  let px = 100;
  for (let i = 0; i < 300; i++) {
    let drift;
    if (i < 140) drift = 0.15;          // uptrend to ~121
    else if (i === 200) drift = -6;     // gap-down day
    else if (i < 200) drift = -0.12;    // distribution
    else if (i < 230) drift = 0.08;     // weak retest bounce
    else drift = -0.15;                 // rollover
    px = Math.max(5, px + drift + Math.sin(i / 7) * 0.3);
    const gap = i === 200 ? 0.95 : 1;
    const open = px * gap;
    const vol = i === 200 ? 5e6 : i > 140 && px < (rows[i - 1]?.close ?? px) ? 2.2e6 : 1.1e6;
    rows.push({
      date: new Date(Date.UTC(2025, 0, 1) + i * 86400e3).toISOString().slice(0, 10),
      open, high: Math.max(open, px) * 1.005, low: Math.min(open, px) * 0.995,
      close: px, volume: vol,
    });
  }
  const bench = rows.map((r, i) => ({ date: r.date, close: 100 + i * 0.1 })); // bench grinds up
  const result = evaluate(rows, bench);
  console.log("SELFTEST result:", JSON.stringify(result, null, 2));
  console.log(result.score >= 3 ? "SELFTEST PASS (signals fire on synthetic distribution)" : "SELFTEST: fewer signals than expected — inspect output");
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
async function main() {
  if (FLAG_SELFTEST) return selftest();

  if (!EODHD_KEY) {
    console.error("Missing EODHD_API_KEY. In CMD:  set EODHD_API_KEY=your_key");
    process.exit(1);
  }

  const universePath = path.join(__dirname, "technical-universe.json");
  const universe = JSON.parse(fs.readFileSync(universePath, "utf8"));
  const benchmarks = universe.benchmarks; // { US: "SPY.US", EU: "EXSA.XETRA" }
  let names = universe.tickers;
  if (SINGLE_TICKER) {
    names = names.filter((t) => t.ticker === SINGLE_TICKER);
    if (!names.length) names = [{ ticker: SINGLE_TICKER, name: SINGLE_TICKER, region: SINGLE_TICKER.endsWith(".US") ? "US" : "EU" }];
  }
  if (BOOK_FILTER) {
    names = names.filter((t) => (t.book || "universe") === BOOK_FILTER);
    console.log(`Book filter '${BOOK_FILTER}': ${names.length} names.`);
  }

  // Checkpoint: a JSON map of ticker -> result, so a long run can resume.
  const ckptPath = path.join(__dirname, "technical-screen-checkpoint.json");
  let done = {};
  if (FLAG_FRESH && fs.existsSync(ckptPath)) { fs.unlinkSync(ckptPath); }
  if (FLAG_RESUME && fs.existsSync(ckptPath)) {
    done = JSON.parse(fs.readFileSync(ckptPath, "utf8"));
    console.log(`Resuming — ${Object.keys(done).length} names already in checkpoint, will skip those.`);
  }

  // Fetch benchmarks once
  const benchData = {};
  for (const [region, bt] of Object.entries(benchmarks)) {
    process.stdout.write(`Fetching benchmark ${region} (${bt})... `);
    benchData[region] = await fetchEod(bt);
    console.log(`${benchData[region].length} rows`);
    await sleep(DELAY_MS);
  }

  const total = names.length;
  let i = 0, sinceFlush = 0;
  const flush = async () => {
    fs.writeFileSync(ckptPath, JSON.stringify(done));
    if (!FLAG_NO_SUPABASE && SUPABASE_URL && SUPABASE_KEY) {
      const recs = Object.values(done).map(({ as_of, stop_too_far, weighted, ...r }) => ({ ...r }));
      try { await upsertSupabase(recs); } catch (e) { console.log(`  (flush upsert warning: ${e.message})`); }
    }
  };

  for (const t of names) {
    i++;
    if (done[t.ticker]) continue; // already screened (resume)
    process.stdout.write(`[${i}/${total}] ${t.ticker} (${t.name})... `);
    try {
      const rows = await fetchEod(t.ticker);
      const r = evaluate(rows, benchData[t.region] || benchData.US);
      done[t.ticker] = { ticker: t.ticker, name: t.name, region: t.region, book: t.book || "universe", run_date: r.as_of, ...r };
      console.log(`${r.weighted}/8 pts${r.short_ready ? "  << SHORT-READY" : ""}`);
    } catch (e) {
      console.log(`SKIP (${e.message})`);
    }
    if (++sinceFlush >= CHECKPOINT_EVERY) { await flush(); sinceFlush = 0; process.stdout.write("  …checkpoint saved\n"); }
    await sleep(DELAY_MS);
  }
  await flush(); // final flush

  const out = Object.values(done);
  out.sort((a, b) => b.weighted - a.weighted || a.stop_distance_pct - b.stop_distance_pct);

  // Console table
  console.log("\n================ CAA TECHNICAL SHORT SCREEN (weighted) ================");
  console.log("Gate: 2MA structure (required, 0pts) | Tier-2: 1FB, 5GP = 3pts | Tier-3: 3RS, 4VD = 1pt | SHORT-READY = gate + >=3pts");
  console.log("TICKER        PTS   READY  1FB 2MA 3RS 4VD 5GP   CLOSE    STOP   DIST%");
  for (const r of out) {
    const dot = (b) => (b ? " X " : " . ");
    console.log(
      r.ticker.padEnd(13) +
      ` ${r.weighted}/8  ` + (r.short_ready ? "YES " : " -  ") + " " +
      dot(r.sig_failed_breakout) + dot(r.sig_ma_structure) + dot(r.sig_rs_breakdown) +
      dot(r.sig_volume_distribution) + dot(r.sig_unreclaimed_gap) +
      String(r.close).padStart(9) + String(r.suggested_stop).padStart(8) +
      String(r.stop_distance_pct).padStart(7) + (r.stop_too_far ? "  (stop >12% — wait)" : "")
    );
  }

  // CSV output
  const csvPath = path.join(__dirname, "technical-screen-output.csv");
  const cols = ["ticker","name","region","book","run_date","close","score","weighted","short_ready",
    "sig_failed_breakout","sig_ma_structure","sig_rs_breakdown","sig_volume_distribution",
    "sig_unreclaimed_gap","suggested_stop","stop_distance_pct"];
  fs.writeFileSync(csvPath, [cols.join(","), ...out.map((r) => cols.map((c) => r[c]).join(","))].join("\n"));
  console.log(`\nCSV written: ${csvPath}`);

  // Supabase: already upserted incrementally during the run via flush().
  if (!FLAG_NO_SUPABASE && SUPABASE_URL && SUPABASE_KEY) {
    console.log(`Done. ${out.length} names screened and upserted to technical_signals (incremental).`);
    console.log(`Checkpoint kept at technical-screen-checkpoint.json — delete it or use --fresh to force a clean rerun.`);
  } else {
    console.log("Supabase write skipped (flag or missing env vars).");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
