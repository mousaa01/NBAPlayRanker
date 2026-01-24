// app/matchup/page.tsx
//
// Baseline Matchup Console (Explainable recommender)
//
// Updated to be defense-ready” and consistent with your other pages:
// - Adds a clear “What happens in the backend” section (architecture/module clarity)
// - Adds guardrails for weights (auto-normalize + warning if they don't sum to 1)
// - Improves default-setting logic (prevents early auto-run before meta is ready)
// - Adds KPI summary cards (season/teams/weights) like your Model Metrics/Stat Analysis vibe
// - Keeps: Top-K ranking, rationale, show-math toggle, CSV export, bars + table
//
// ✅ Added ON TOP (without changing your previous logic/UI):
// - SportyPy “Court map” panel (pick play type from Top-K, generate map)
// - Per-row “Map” + “PDF” buttons
// - “Export 1-page PDF” (backend reportlab export)
//
// Assumptions about backend payload (unchanged from your current page):
// - baselineRank(...) returns BaselineRow[]
// - BaselineRow has playType, pppPred, pppOff, pppDef, pppGap, rationale, raw
// - raw contains optional POSS_OFF, POSS_PCT_OFF, RELIABILITY_WEIGHT_OFF/DEF, PPP_LEAGUE_OFF/DEF
//
// New assumptions for viz/pdf:
// - utils.ts has fetchPlaytypeViz({season, our, opp, playType, wOff})
// - backend has GET /viz/playtype-zones returning { caption, image_base64 }
// - backend has GET /export/playtype-viz.pdf returning a PDF stream

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  API_BASE,
  baselineRank,
  fetchBaselineInfo,
  fetchMetaOptions,
  fetchPlaytypeViz,
  getBaselineCsvUrl,
} from "../utils";

type MetaOptions = {
  seasons: string[];
  teams: string[];
  teamNames?: Record<string, string>;
  playTypes?: string[];
  sides?: string[];
  hasMlPredictions?: boolean;
  _fallback?: boolean;
};

type BaselineInfo = {
  formula?: string;
  defaults?: { w_off?: number; w_def?: number };
  definitions?: Record<string, string>;
  whyShrinkage?: string;
};

type BaselineRow = {
  playType: string;
  pppPred: number;
  pppOff: number;
  pppDef: number;
  pppGap: number;
  rationale: string;
  raw: Record<string, any>;
};

type VizResponse = {
  caption: string;
  image_base64: string;
};

function fmt(n: any, digits = 3) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

function fmtInt(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return String(Math.round(x));
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function pickDefaultSeason(seasons: string[]) {
  return seasons.length ? seasons[seasons.length - 1] : "";
}

function pickDefaultOur(teams: string[]) {
  if (teams.includes("TOR")) return "TOR";
  return teams[0] ?? "";
}

function pickDefaultOpp(teams: string[], our: string) {
  const preferred = ["BOS", "LAL", "DEN", "MIA", "GSW"];
  for (const t of preferred) {
    if (teams.includes(t) && t !== our) return t;
  }
  return teams.find((t) => t !== our) ?? "";
}

function safePct(x: any) {
  const v = Number(x);
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

// Normalize weights so they always sum to 1 (defense-friendly + avoids weird results)
function normalizeWeights(wOff: number, wDef: number) {
  const a = Number(wOff);
  const b = Number(wDef);
  const sum = a + b;
  if (!Number.isFinite(sum) || sum <= 0) return { wOff: 0.7, wDef: 0.3 };
  return { wOff: a / sum, wDef: b / sum };
}

export default function MatchupPage() {
  const [meta, setMeta] = useState<MetaOptions>({
    seasons: [],
    teams: [],
    teamNames: {},
    playTypes: [],
    sides: ["offense", "defense"],
    hasMlPredictions: false,
  });

  const [baselineInfo, setBaselineInfo] = useState<BaselineInfo | null>(null);

  // Form state
  const [season, setSeason] = useState("");
  const [our, setOur] = useState("");
  const [opp, setOpp] = useState("");
  const [k, setK] = useState(5);

  // Weights (normalized on-run)
  const [wOff, setWOff] = useState(0.7);
  const [wDef, setWDef] = useState(0.3);

  // Results state
  const [rows, setRows] = useState<BaselineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showMath, setShowMath] = useState(false);

  // ✅ Viz state (added)
  const [vizPlayType, setVizPlayType] = useState<string>("");
  const [viz, setViz] = useState<VizResponse | null>(null);
  const [vizLoading, setVizLoading] = useState(false);
  const [vizError, setVizError] = useState<string | null>(null);

  // Prevent repeated auto-run
  const didAutoRunRef = useRef(false);

  // Load meta + baseline formula info
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setError(null);

        const m = await fetchMetaOptions();
        if (cancelled) return;
        setMeta(m);

        const defaultSeason = pickDefaultSeason(m.seasons ?? []);
        const defaultOur = pickDefaultOur(m.teams ?? []);
        const defaultOpp = pickDefaultOpp(m.teams ?? [], defaultOur);

        setSeason((prev) => prev || defaultSeason);
        setOur((prev) => prev || defaultOur);
        setOpp((prev) => prev || defaultOpp);

        const b = await fetchBaselineInfo();
        if (cancelled) return;
        setBaselineInfo(b);

        // Apply backend defaults if present
        if (b?.defaults?.w_off != null) setWOff(Number(b.defaults.w_off));
        if (b?.defaults?.w_def != null) setWDef(Number(b.defaults.w_def));
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message ?? "Failed to load metadata.");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const weightsSum = useMemo(() => Number(wOff) + Number(wDef), [wOff, wDef]);
  const weightsWarn = useMemo(() => {
    if (!Number.isFinite(weightsSum)) return true;
    return Math.abs(weightsSum - 1) > 0.01; // warn if not close to 1
  }, [weightsSum]);

  // CSV download URL for current selections
  const csvUrl = useMemo(() => {
    if (!season || !our || !opp) return "#";
    const norm = normalizeWeights(wOff, wDef);
    return getBaselineCsvUrl({ season, our, opp, k, wOff: norm.wOff, wDef: norm.wDef });
  }, [season, our, opp, k, wOff, wDef]);

  // Helpful team label (abbr + name)
  const ourLabel = useMemo(() => {
    const name = meta.teamNames?.[our];
    return name ? `${our} (${name})` : our;
  }, [meta.teamNames, our]);

  const oppLabel = useMemo(() => {
    const name = meta.teamNames?.[opp];
    return name ? `${opp} (${name})` : opp;
  }, [meta.teamNames, opp]);

  const runContextHref = useMemo(() => {
    const qs = new URLSearchParams({
      season,
      our,
      opp,
      k: String(k),
    });
    return `/context?${qs.toString()}`;
  }, [season, our, opp, k]);

  async function runBaseline() {
    if (!season || !our || !opp) {
      setError("Please select a season, our team, and an opponent.");
      return;
    }
    if (our === opp) {
      setError("Our team and opponent must be different.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setRows([]);

      const norm = normalizeWeights(wOff, wDef);

      const out = await baselineRank({
        season,
        our,
        opp,
        k,
        wOff: norm.wOff,
        wDef: norm.wDef,
      });

      setRows(Array.isArray(out) ? out : []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to generate baseline recommendations.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Reset viz when matchup inputs change (added)
  useEffect(() => {
    setViz(null);
    setVizError(null);
    setVizPlayType("");
  }, [season, our, opp, k, wOff, wDef]);

  // ✅ Export PDF URL builder (added)
  function getPdfUrlForPlayType(playType: string) {
    if (!season || !our || !opp || !playType) return "#";
    const norm = normalizeWeights(wOff, wDef);

    const params = new URLSearchParams({
      season,
      our,
      opp,
      play_type: playType,
      k: String(k),
      w_off: String(norm.wOff),
    });

    return `${API_BASE}/export/playtype-viz.pdf?${params.toString()}`;
  }

  // ✅ Viz runner (added)
  async function runViz(playTypeOverride?: string) {
    const pt = (playTypeOverride ?? vizPlayType)?.trim();
    if (!pt) {
      setVizError("Pick a play type first.");
      return;
    }
    if (!season || !our || !opp) {
      setVizError("Select season/teams first.");
      return;
    }

    try {
      setVizLoading(true);
      setVizError(null);
      setViz(null);

      const norm = normalizeWeights(wOff, wDef);

      const out = await fetchPlaytypeViz({
        season,
        our,
        opp,
        playType: pt,
        wOff: norm.wOff,
      });

      setViz(out);
    } catch (e: any) {
      console.error(e);
      setVizError(e?.message ?? "Failed to generate court visualization.");
      setViz(null);
    } finally {
      setVizLoading(false);
    }
  }

  // Auto-run once defaults are ready (only once)
  useEffect(() => {
    const metaReady = (meta?.seasons?.length ?? 0) > 0 && (meta?.teams?.length ?? 0) > 0;
    if (!metaReady) return;
    if (!season || !our || !opp) return;
    if (didAutoRunRef.current) return;
    if (loading) return;

    didAutoRunRef.current = true;
    runBaseline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.seasons, meta.teams, season, our, opp]);

  // Simple “best” row (top-ranked already, but we compute just in case)
  const bestRow = useMemo(() => {
    if (!rows.length) return null;
    const valid = rows.filter((r) => Number.isFinite(Number(r.pppPred)));
    if (!valid.length) return null;
    return valid[0];
  }, [rows]);

  // ✅ default viz play type to the #1 recommendation (added)
  useEffect(() => {
    if (!rows.length) return;
    if (vizPlayType) return;
    if (bestRow?.playType) setVizPlayType(bestRow.playType);
  }, [rows, bestRow, vizPlayType]);

  return (
    <section className="card">
      <h1 className="h1">Matchup Console (Baseline)</h1>

      <p className="muted">
        This page uses a <strong>transparent baseline formula</strong> to rank play types for a matchup.
        It is intentionally explainable so the reasoning can be defended.
      </p>

      {/* ✅ Backend / architecture clarity */}
      <div style={{ marginTop: 12 }} className="kpi">
        <div className="label">
          <strong style={{ color: "rgba(15,23,42,0.9)" }}>What happens when you click “Run Baseline”?</strong>
        </div>
        <ul className="muted" style={{ fontSize: 13, paddingLeft: 18, marginTop: 10 }}>
          <li>Frontend (this page) sends: season, our team, opponent, k, weights.</li>
          <li>Backend computes shrunk offense PPP for our team by play type.</li>
          <li>Backend computes shrunk defense-allowed PPP for opponent by play type.</li>
          <li>Baseline prediction uses the weighted formula and sorts descending.</li>
          <li>Response returns Top-K rows + rationale + raw math fields (for transparency).</li>
        </ul>
      </div>

      {/* Baseline formula panel */}
      <div style={{ marginTop: 12 }}>
        <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Baseline formula</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          <code>
            {baselineInfo?.formula ?? "PPP_PRED = w_off * PPP_OFF_SHRUNK + w_def * PPP_DEF_SHRUNK"}
          </code>
        </p>

        {baselineInfo?.whyShrinkage ? (
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            <strong>Why shrinkage?</strong> {baselineInfo.whyShrinkage}
          </p>
        ) : null}

        {baselineInfo?.definitions ? (
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: "pointer", fontSize: 13 }}>Show definitions</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {Object.entries(baselineInfo.definitions).map(([k, v]) => (
                <div key={k} className="muted" style={{ fontSize: 13 }}>
                  <span style={{ fontFamily: "var(--mono)" }}>{k}</span>: {v}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      {/* Controls */}
      <form className="form-grid" onSubmit={(e) => e.preventDefault()} style={{ marginTop: 10 }}>
        <label>
          Season
          <select className="input" value={season} onChange={(e) => setSeason(e.target.value)}>
            {(meta.seasons ?? []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label>
          Our Team
          <select className="input" value={our} onChange={(e) => setOur(e.target.value)}>
            {(meta.teams ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label>
          Opponent
          <select className="input" value={opp} onChange={(e) => setOpp(e.target.value)}>
            {(meta.teams ?? []).map((t) => (
              <option key={t} value={t} disabled={t === our}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label>
          Top-K
          <select className="input" value={k} onChange={(e) => setK(Number(e.target.value))}>
            {[3, 5, 7, 10].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>

        <label>
          Offense weight (w_off)
          <input
            className="input"
            type="number"
            step="0.05"
            min={0}
            max={1}
            value={wOff}
            onChange={(e) => setWOff(Number(e.target.value))}
          />
        </label>

        <label>
          Defense weight (w_def)
          <input
            className="input"
            type="number"
            step="0.05"
            min={0}
            max={1}
            value={wDef}
            onChange={(e) => setWDef(Number(e.target.value))}
          />
        </label>
      </form>

      {/* ✅ Weight warning (committee will like this) */}
      {weightsWarn ? (
        <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          Note: weights currently sum to <strong>{fmt(weightsSum, 2)}</strong>. We normalize them internally so
          the formula remains consistent (w_off + w_def = 1).
        </p>
      ) : null}

      {/* Actions */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={runBaseline} disabled={loading}>
            {loading ? "Running…" : "Run Baseline"}
          </button>

          <a
            className="btn"
            href={csvUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!season || !our || !opp}
          >
            Export CSV
          </a>

          <button className="btn" type="button" onClick={() => setShowMath((v) => !v)}>
            {showMath ? "Hide math fields" : "Show math fields"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn" href="/data-explorer">
            Back: Data Explorer
          </Link>

          <Link className="btn" href={runContextHref}>
            Next: AI Context
          </Link>
        </div>
      </div>

      {/* Errors */}
      {error ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}

      {/* ✅ KPI strip (same vibe as your other pages) */}
      {!loading && season && our && opp ? (
        <div className="grid" style={{ marginTop: 14 }}>
          <div className="kpi">
            <div className="label">Matchup</div>
            <div className="value" style={{ fontSize: 16, fontWeight: 800 }}>
              {our} vs {opp}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {ourLabel} vs {oppLabel}
            </div>
          </div>

          <div className="kpi">
            <div className="label">Season / Top-K</div>
            <div className="value">
              {season} / {k}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Ranking is computed from matchup-specific play-type data.
            </div>
          </div>

          <div className="kpi">
            <div className="label">Weights used</div>
            <div className="value" style={{ fontFamily: "var(--mono)" }}>
              off={fmt(normalizeWeights(wOff, wDef).wOff, 2)} / def={fmt(normalizeWeights(wOff, wDef).wDef, 2)}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Normalized to keep the baseline formula consistent.
            </div>
          </div>
        </div>
      ) : null}

      {/* Results */}
      {rows.length > 0 && !loading ? (
        <div style={{ marginTop: 14 }}>
          <p className="muted" style={{ fontSize: 13 }}>
            <strong>{ourLabel}</strong> vs <strong>{oppLabel}</strong> ({season}) — showing Top {k}
          </p>

          {/* Best recommendation highlight */}
          {bestRow ? (
            <div className="kpi" style={{ marginTop: 10 }}>
              <div className="label">Top recommendation</div>
              <div className="value" style={{ fontSize: 16, fontWeight: 800 }}>
                {bestRow.playType} (Pred PPP {fmt(bestRow.pppPred, 3)})
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Rationale: {bestRow.rationale}
              </div>

              {/* ✅ Added: quick map + pdf buttons (doesn’t change existing content) */}
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setVizPlayType(bestRow.playType);
                    runViz(bestRow.playType);
                  }}
                  disabled={vizLoading}
                >
                  {vizLoading ? "Generating map…" : "Generate court map"}
                </button>

                <a
                  className="btn"
                  href={getPdfUrlForPlayType(bestRow.playType)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Export 1-page PDF
                </a>
              </div>
            </div>
          ) : null}

          {/* ✅ Added: SportyPy visualization panel */}
          <div className="kpi" style={{ marginTop: 12 }}>
            <div className="label">Court map (SportyPy)</div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="muted" style={{ fontSize: 12 }}>Play type</span>
                <select
                  className="input"
                  value={vizPlayType}
                  onChange={(e) => setVizPlayType(e.target.value)}
                  style={{ minWidth: 260 }}
                >
                  {rows.map((r) => (
                    <option key={r.playType} value={r.playType}>
                      {r.playType}
                    </option>
                  ))}
                </select>
              </label>

              <button className="btn" type="button" onClick={() => runViz()} disabled={vizLoading}>
                {vizLoading ? "Generating map…" : "Generate map"}
              </button>

              <a
                className="btn"
                href={getPdfUrlForPlayType(vizPlayType)}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!vizPlayType}
              >
                Export 1-page PDF
              </a>
            </div>

            {vizError ? (
              <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                {vizError}
              </p>
            ) : null}

            {!viz ? (
              <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                Generate a court map to attach a visual to your recommendation (fast, coach-friendly, “feels real”).
              </p>
            ) : (
              <div style={{ marginTop: 12 }}>
                <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                  {viz.caption}
                </p>

                <div
                  style={{
                    width: "100%",
                    overflow: "hidden",
                    borderRadius: 12,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "rgba(15,23,42,0.02)",
                  }}
                >
                  <img
                    src={`data:image/png;base64,${viz.image_base64}`}
                    alt="Court map"
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bars */}
          <div style={{ marginTop: 12 }}>
            <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Top recommendations (PPP bars)</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {rows.map((r) => {
                // keep your original scaling: ~1.4 max PPP
                const width = clamp01(Number(r.pppPred) / 1.4) * 100;

                return (
                  <div
                    key={r.playType}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "220px 1fr 80px",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontSize: 13 }}>
                      <strong>{r.playType}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>
                        gap {fmt(r.pppGap, 3)}
                      </div>
                    </div>

                    <div
                      style={{
                        height: 10,
                        borderRadius: 999,
                        background: "rgba(15,23,42,0.08)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${width}%`,
                          height: "100%",
                          background: "rgba(15, 23, 42, 0.35)",
                        }}
                      />
                    </div>

                    <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                      {fmt(r.pppPred, 3)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table */}
          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Ranking table (explainable fields)</h2>

            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Play Type</th>

                  {/* ✅ Added (doesn’t alter existing columns) */}
                  <th>Viz</th>

                  <th>Pred PPP</th>
                  <th>Our PPP (shrunk)</th>
                  <th>Opp Allowed (shrunk)</th>
                  <th>Gap</th>

                  {showMath ? (
                    <>
                      <th>Poss (our)</th>
                      <th>Poss% (our)</th>
                      <th>Rel (our)</th>
                      <th>Rel (opp)</th>
                      <th>League PPP (off)</th>
                      <th>League PPP (def)</th>
                    </>
                  ) : null}

                  <th>Rationale</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const raw = r.raw ?? {};
                  return (
                    <tr key={`${r.playType}-${idx}`}>
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{r.playType}</strong>
                      </td>

                      {/* ✅ Added: row actions */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => {
                            setVizPlayType(r.playType);
                            runViz(r.playType);
                          }}
                          disabled={vizLoading}
                        >
                          Map
                        </button>
                        <a
                          className="btn"
                          href={getPdfUrlForPlayType(r.playType)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ marginLeft: 8 }}
                        >
                          PDF
                        </a>
                      </td>

                      <td>{fmt(r.pppPred, 3)}</td>
                      <td>{fmt(r.pppOff, 3)}</td>
                      <td>{fmt(r.pppDef, 3)}</td>
                      <td>{fmt(r.pppGap, 3)}</td>

                      {showMath ? (
                        <>
                          <td>{Number.isFinite(Number(raw.POSS_OFF)) ? fmtInt(raw.POSS_OFF) : "—"}</td>
                          <td>{safePct(raw.POSS_PCT_OFF)}</td>
                          <td>{fmt(raw.RELIABILITY_WEIGHT_OFF, 3)}</td>
                          <td>{fmt(raw.RELIABILITY_WEIGHT_DEF, 3)}</td>
                          <td>{fmt(raw.PPP_LEAGUE_OFF, 3)}</td>
                          <td>{fmt(raw.PPP_LEAGUE_DEF, 3)}</td>
                        </>
                      ) : null}

                      <td style={{ fontSize: 12 }}>{r.rationale}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Committee-friendly note */}
          <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
            Note: This is the <strong>baseline</strong> recommender. It is deliberately transparent and acts as a
            reference point. Next, the Context Simulator shows how ML + game-state changes the ranking (and returns
            an adjustment breakdown).
          </p>
        </div>
      ) : null}
    </section>
  );
}
