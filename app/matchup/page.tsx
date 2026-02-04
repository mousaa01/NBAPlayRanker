// app/matchup/page.tsx
//
// This is the “Baseline Matchup Console” — the explainable version of the recommender.
// The whole point is trust + clarity: you pick a season + matchup, and it ranks the best play types
// using the baseline formula (shrunk offense PPP + shrunk opponent allowed PPP).
//
// Why this page matters (for product + defense):
// - This is my “trust anchor” page. Everything is transparent, repeatable, and easy to explain.
// - It shows Top-K ranked play types + the rationale + (optional) raw math fields.
// - It also attaches real visuals (SportyPy court map) + exports (CSV + 1-page PDF) so it feels like a finished product.
//


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

// Number formatting helpers so the UI stays clean + consistent.
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

// Used for the little bar chart so widths don’t blow up.
function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

// Defaults just make the page “feel ready” on load (so you don’t land on an empty screen).
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

// I normalize weights so the model is always interpretable (w_off + w_def = 1).
// This prevents weird results if someone types random values and forgets to balance them.
function normalizeWeights(wOff: number, wDef: number) {
  const a = Number(wOff);
  const b = Number(wDef);
  const sum = a + b;
  if (!Number.isFinite(sum) || sum <= 0) return { wOff: 0.7, wDef: 0.3 };
  return { wOff: a / sum, wDef: b / sum };
}

function Icon({ name }: { name: "play" | "spark" | "download" | "map" | "pdf" | "info" }) {
  // Lightweight inline SVG icons so we don’t add any UI dependencies.
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg" };
  switch (name) {
    case "play":
      return (
        <svg {...common}>
          <path d="M10 8.5v7l6-3.5-6-3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path
            d="M12 2l1.2 4.2L17.4 7.4l-4.2 1.2L12 12.8l-1.2-4.2L6.6 7.4l4.2-1.2L12 2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M19 12l.7 2.4 2.3.6-2.3.6L19 18l-.7-2.4-2.3-.6 2.3-.6L19 12Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 10l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path
            d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M9 3v15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M15 6v15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "pdf":
      return (
        <svg {...common}>
          <path
            d="M7 3h7l3 3v15H7V3Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M14 3v4h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M9 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" strokeWidth="2" />
          <path d="M12 10v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 7h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}

export default function MatchupPage() {
  // Meta drives dropdowns (seasons/teams). Also includes friendly team names when available.
  const [meta, setMeta] = useState<MetaOptions>({
    seasons: [],
    teams: [],
    teamNames: {},
    playTypes: [],
    sides: ["offense", "defense"],
    hasMlPredictions: false,
  });

  // BaselineInfo is “explainability text”: formula, defaults, definitions, shrinkage explanation.
  const [baselineInfo, setBaselineInfo] = useState<BaselineInfo | null>(null);

  // Matchup inputs (these are what we send to the baseline endpoint).
  const [season, setSeason] = useState("");
  const [our, setOur] = useState("");
  const [opp, setOpp] = useState("");
  const [k, setK] = useState(5);

  // User-adjustable weights (I normalize them before sending so interpretation stays stable).
  const [wOff, setWOff] = useState(0.7);
  const [wDef, setWDef] = useState(0.3);

  // Baseline results table (Top-K rows).
  const [rows, setRows] = useState<BaselineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle to show/hide the raw math fields in the table.
  const [showMath, setShowMath] = useState(false);

  // Visualization state: SportyPy returns caption + base64 image for the selected play type.
  const [vizPlayType, setVizPlayType] = useState<string>("");
  const [viz, setViz] = useState<VizResponse | null>(null);
  const [vizLoading, setVizLoading] = useState(false);
  const [vizError, setVizError] = useState<string | null>(null);

  // This prevents the initial “auto-run” from firing multiple times due to re-renders.
  const didAutoRunRef = useRef(false);

  // On first load: pull meta + baseline info, set smart defaults so the page starts “ready”.
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

        // If backend publishes default weights, I respect them here.
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

  // Meta is “ready” once seasons + teams exist (then dropdowns are valid).
  const metaReady = useMemo(() => (meta?.seasons?.length ?? 0) > 0 && (meta?.teams?.length ?? 0) > 0, [meta]);

  // Weight UX: show whether user entered weights sum to ~1 (even though we normalize anyway).
  const weightsSum = useMemo(() => Number(wOff) + Number(wDef), [wOff, wDef]);
  const weightsWarn = useMemo(() => {
    if (!Number.isFinite(weightsSum)) return true;
    return Math.abs(weightsSum - 1) > 0.01;
  }, [weightsSum]);

  // This is what we actually use when calling the API (always sums to 1).
  const norm = useMemo(() => normalizeWeights(wOff, wDef), [wOff, wDef]);

  // Basic run guard: no missing fields and no “team plays itself” matchup.
  const canRun = useMemo(() => {
    if (!metaReady) return false;
    if (!season || !our || !opp) return false;
    if (our === opp) return false;
    return true;
  }, [metaReady, season, our, opp]);

  // CSV link is just a URL builder — it uses the exact same selections as the page.
  const csvUrl = useMemo(() => {
    if (!season || !our || !opp) return "#";
    return getBaselineCsvUrl({ season, our, opp, k, wOff: norm.wOff, wDef: norm.wDef });
  }, [season, our, opp, k, norm.wOff, norm.wDef]);

  // Friendly labels help the UI feel more polished (abbr + full team name).
  const ourLabel = useMemo(() => {
    const name = meta.teamNames?.[our];
    return name ? `${our} (${name})` : our;
  }, [meta.teamNames, our]);

  const oppLabel = useMemo(() => {
    const name = meta.teamNames?.[opp];
    return name ? `${opp} (${name})` : opp;
  }, [meta.teamNames, opp]);

  // Link into the Context page using the same matchup params (smooth flow for users).
  const runContextHref = useMemo(() => {
    const qs = new URLSearchParams({
      season,
      our,
      opp,
      k: String(k),
    });
    return `/context?${qs.toString()}`;
  }, [season, our, opp, k]);

  // If the matchup changes, the old viz becomes invalid, so I reset it.
  useEffect(() => {
    setViz(null);
    setVizError(null);
    setVizPlayType("");
  }, [season, our, opp, k, wOff, wDef]);

  // PDF export link for a specific play type (1-page “coach handout” style export).
  function getPdfUrlForPlayType(playType: string) {
    if (!season || !our || !opp || !playType) return "#";
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

  // Main baseline run:
  // - Clears old rows
  // - Calls baselineRank endpoint
  // - Stores Top-K rows for bars + table
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

  // Court visualization run:
  // - Uses selected play type
  // - Calls SportyPy viz endpoint
  // - Returns caption + base64 image so it can render instantly in the UI
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

  // Auto-run once when defaults are loaded so the page doesn’t feel empty on first visit.
  useEffect(() => {
    if (!metaReady) return;
    if (!season || !our || !opp) return;
    if (didAutoRunRef.current) return;
    if (loading) return;

    didAutoRunRef.current = true;
    runBaseline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaReady, season, our, opp]);

  // Best row is used for the “#1 play type” highlight card (top of results).
  const bestRow = useMemo(() => {
    if (!rows.length) return null;
    const valid = rows.filter((r) => Number.isFinite(Number(r.pppPred)));
    if (!valid.length) return null;
    return valid[0];
  }, [rows]);

  // Convenience: default the viz dropdown to the #1 play type so the user can generate a map fast.
  useEffect(() => {
    if (!rows.length) return;
    if (vizPlayType) return;
    if (bestRow?.playType) setVizPlayType(bestRow.playType);
  }, [rows, bestRow, vizPlayType]);

  // Guard for the viz button (must have matchup + play type selected).
  const vizReady = useMemo(() => Boolean(season && our && opp && vizPlayType), [season, our, opp, vizPlayType]);

  return (
    <section className="card pageRoot">
      {/* Page-only CSS so I can polish this UI without touching global styles */}
      <style>{`
        /*
          Prevent page-level horizontal scrolling.
          The wide, nowrap table below should scroll INSIDE its own wrapper
          (tableWrap), not force the entire page to overflow.
        */
        .pageRoot { max-width: 100%; overflow-x: hidden; }

        .topBar {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          align-items: flex-start;
        }
        .titleBlock { display: grid; gap: 6px; }
        .crumbs { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .pillMini {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(15,23,42,0.03);
          color: rgba(15,23,42,0.72);
          font-size: 12px;
          white-space: nowrap;
        }
        .layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          margin-top: 12px;
          max-width: 100%;
        }
        .layout > * { min-width: 0; }
        @media (min-width: 1060px) {
          .layout { grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); align-items: start; }
          .stickyRight { position: sticky; top: 12px; }
        }
        .panelTitle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .subtleCard {
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,0.08);
          background: rgba(255,255,255,0.72);
          padding: 12px;
          max-width: 100%;
        }
        .divider {
          height: 1px;
          background: rgba(15,23,42,0.08);
          margin: 12px 0;
        }
        .weightRow {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-top: 10px;
        }
        @media (min-width: 760px) {
          .weightRow { grid-template-columns: 1fr 1fr; }
        }
        .weightBox {
          border: 1px solid rgba(15,23,42,0.08);
          background: rgba(15,23,42,0.02);
          border-radius: 14px;
          padding: 10px;
          display: grid;
          gap: 8px;
        }
        .weightTop {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }
        .range {
          width: 100%;
          max-width: 100%;
        }
        .meter {
          height: 10px;
          border-radius: 999px;
          background: rgba(15,23,42,0.08);
          overflow: hidden;
        }
        .meter > div {
          height: 100%;
          background: rgba(15, 23, 42, 0.35);
        }
        .actionDock {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(15,23,42,0.08);
        }
        .actionLeft, .actionRight { display: flex; gap: 10px; flex-wrap: wrap; }
        .btnIcon {
          display: inline-flex;
          gap: 8px;
          align-items: center;
        }
        .tableWrap {
          overflow-x: auto;
          display: block;
          max-width: 100%;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,0.08);
          background: rgba(255,255,255,0.70);
        }
        /* Let the table be as wide as it needs, but keep that scroll contained in tableWrap */
        .tableWrap .table { margin: 0; width: max-content; min-width: 100%; }
        .imgFrame {
          width: 100%;
          max-width: 100%;
          overflow: hidden;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,0.12);
          background: rgba(15,23,42,0.02);
        }
        .imgFrame img { width: 100%; height: auto; display: block; }
      `}</style>

      {/* Top navigation + quick jumps to the rest of the product */}
      <div className="topBar">
        <div className="titleBlock">
          <div className="crumbs">
            <Link className="btn" href="/">
              Home
            </Link>
            <span className="pillMini">
              <Icon name="info" /> Baseline • Explainable
            </span>
            {meta?._fallback ? <span className="pillMini">Fallback meta</span> : null}
            {weightsWarn ? <span className="pillMini">Weights auto-normalized</span> : <span className="pillMini">Weights OK</span>}
          </div>

          <h1 className="h1" style={{ margin: 0 }}>
            Matchup Console (Baseline)
          </h1>

          <p className="muted" style={{ margin: 0 }}>
            Transparent ranking of play types for a matchup. Use this as the <strong>trust anchor</strong>, then compare
            to the AI Context Simulator for scenario-based adjustments.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link className="btn" href="/gameplan">
            <span className="btnIcon">
              <Icon name="spark" /> Gameplan
            </span>
          </Link>
          <Link className="btn" href={runContextHref}>
            <span className="btnIcon">
              <Icon name="spark" /> AI Context
            </span>
          </Link>
          <Link className="btn" href="/shot-plan">
            Shot Plan
          </Link>
          <Link className="btn" href="/shot-heatmap">
            Shot Heatmap
          </Link>
        </div>
      </div>

      {/* Two-column layout: left = controls/results, right = visualization panel */}
      <div className="layout">
        {/* LEFT: explanation + inputs + baseline results */}
        <div>
          {/* “Explain it like I’m presenting it” section (formula + shrinkage reasoning) */}
          <div className="subtleCard">
            <div className="panelTitle">
              <h2 style={{ margin: 0, fontSize: 16 }}>How the baseline works</h2>
              <button className="btn" type="button" onClick={() => setShowMath((v) => v)}>
                {showMath ? "Math is ON" : "Math is OFF"}
              </button>
            </div>

            <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              <code>
                {baselineInfo?.formula ?? "PPP_PRED = w_off * PPP_OFF_SHRUNK + w_def * PPP_DEF_SHRUNK"}
              </code>
            </p>

            {baselineInfo?.whyShrinkage ? (
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                <strong>Why shrinkage?</strong> {baselineInfo.whyShrinkage}
              </p>
            ) : (
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                <strong>Why shrinkage?</strong> It reduces small-sample noise so play types with few possessions don’t
                look unrealistically good or bad.
              </p>
            )}

            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 13 }}>
                What happens in the backend when you run this?
              </summary>
              <ul className="muted" style={{ fontSize: 13, paddingLeft: 18, marginTop: 10, lineHeight: 1.6 }}>
                <li>Frontend sends: season, our team, opponent, k, and weights.</li>
                <li>Backend computes shrunk offense PPP (our) by play type.</li>
                <li>Backend computes shrunk defense-allowed PPP (opponent) by play type.</li>
                <li>Baseline prediction applies the weighted blend and sorts descending.</li>
                <li>Response includes Top-K rows + rationale + raw math fields (optional).</li>
              </ul>
            </details>

            {baselineInfo?.definitions ? (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", fontSize: 13 }}>Show definitions</summary>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {Object.entries(baselineInfo.definitions).map(([kk, vv]) => (
                    <div key={kk} className="muted" style={{ fontSize: 13 }}>
                      <span style={{ fontFamily: "var(--mono)" }}>{kk}</span>: {vv}
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>

          {/* Inputs section: matchup + Top-K + weights */}
          <div className="subtleCard" style={{ marginTop: 12 }}>
            <div className="panelTitle">
              <h2 style={{ margin: 0, fontSize: 16 }}>Matchup inputs</h2>
              <span className="pillMini">{metaReady ? "Ready" : "Loading meta…"}</span>
            </div>

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
            </form>

            <div className="divider" />

            <div className="panelTitle">
              <h2 style={{ margin: 0, fontSize: 16 }}>Weights (auto-normalized)</h2>
              <span className="pillMini">
                off={fmt(norm.wOff, 2)} • def={fmt(norm.wDef, 2)}
              </span>
            </div>

            <div className="weightRow">
              <div className="weightBox">
                <div className="weightTop">
                  <div>
                    <strong style={{ fontSize: 13 }}>Offense weight</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      w_off (input): {fmt(wOff, 2)} → normalized: {fmt(norm.wOff, 2)}
                    </div>
                  </div>
                  <input
                    className="input"
                    style={{ width: 90 }}
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={wOff}
                    onChange={(e) => setWOff(Number(e.target.value))}
                  />
                </div>
                <input
                  className="range"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={Number.isFinite(wOff) ? wOff : 0}
                  onChange={(e) => setWOff(Number(e.target.value))}
                />
              </div>

              <div className="weightBox">
                <div className="weightTop">
                  <div>
                    <strong style={{ fontSize: 13 }}>Defense weight</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      w_def (input): {fmt(wDef, 2)} → normalized: {fmt(norm.wDef, 2)}
                    </div>
                  </div>
                  <input
                    className="input"
                    style={{ width: 90 }}
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={wDef}
                    onChange={(e) => setWDef(Number(e.target.value))}
                  />
                </div>
                <input
                  className="range"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={Number.isFinite(wDef) ? wDef : 0}
                  onChange={(e) => setWDef(Number(e.target.value))}
                />
              </div>
            </div>

            {weightsWarn ? (
              <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                Weights currently sum to <strong>{fmt(weightsSum, 2)}</strong>. We normalize internally so the formula
                stays consistent (w_off + w_def = 1).
              </p>
            ) : (
              <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                Weights sum looks good (≈ 1). You can still enter any values — we normalize on run.
              </p>
            )}

            {/* Action bar: run, export, toggle math, and move forward in the workflow */}
            <div className="actionDock">
              <div className="actionLeft">
                <button className="btn" type="button" onClick={runBaseline} disabled={!canRun || loading}>
                  <span className="btnIcon">
                    <Icon name="play" /> {loading ? "Running…" : "Run Baseline"}
                  </span>
                </button>

                <a className="btn" href={csvUrl} target="_blank" rel="noopener noreferrer" aria-disabled={!canRun}>
                  <span className="btnIcon">
                    <Icon name="download" /> Export CSV
                  </span>
                </a>

                <button className="btn" type="button" onClick={() => setShowMath((v) => !v)}>
                  {showMath ? "Hide math fields" : "Show math fields"}
                </button>
              </div>

              <div className="actionRight">
                <Link className="btn" href="/data-explorer">
                  Data Explorer
                </Link>
                <Link className="btn" href={runContextHref}>
                  Next: AI Context
                </Link>
              </div>
            </div>

            {error ? (
              <p className="muted" style={{ marginTop: 12 }}>
                {error}
              </p>
            ) : null}
          </div>

          {/* Quick KPI strip: makes it obvious what matchup/settings we’re looking at */}
          {season && our && opp ? (
            <div className="grid" style={{ marginTop: 12 }}>
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
                  Ranked from matchup-specific play-type performance.
                </div>
              </div>

              <div className="kpi">
                <div className="label">Weights used</div>
                <div className="value" style={{ fontFamily: "var(--mono)" }}>
                  off={fmt(norm.wOff, 2)} / def={fmt(norm.wDef, 2)}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Normalized for stable, committee-friendly interpretation.
                </div>
              </div>
            </div>
          ) : null}

          {/* Results block: highlight #1, bars for quick scan, then the full explainable table */}
          {!loading && rows.length > 0 ? (
            <div className="subtleCard" style={{ marginTop: 12 }}>
              <div className="panelTitle">
                <h2 style={{ margin: 0, fontSize: 16 }}>Top recommendations</h2>
                <span className="pillMini">
                  {our} vs {opp} • {season}
                </span>
              </div>

              {/* #1 summary card: “here’s the recommendation + why” */}
              {bestRow ? (
                <div className="kpi" style={{ marginTop: 10 }}>
                  <div className="label">#1 Play Type</div>
                  <div className="value" style={{ fontSize: 16, fontWeight: 900 }}>
                    {bestRow.playType} (Pred PPP {fmt(bestRow.pppPred, 3)})
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    {bestRow.rationale}
                  </div>

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
                      <span className="btnIcon">
                        <Icon name="map" /> {vizLoading ? "Generating map…" : "Generate map"}
                      </span>
                    </button>

                    <a className="btn" href={getPdfUrlForPlayType(bestRow.playType)} target="_blank" rel="noopener noreferrer">
                      <span className="btnIcon">
                        <Icon name="pdf" /> Export 1-page PDF
                      </span>
                    </a>
                  </div>
                </div>
              ) : null}

              {/* Quick scan bars: helps non-technical users see ranking strength instantly */}
              <div style={{ marginTop: 12 }}>
                <h3 style={{ margin: "6px 0 10px", fontSize: 14 }}>Predicted PPP bars</h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {rows.map((r) => {
                    const width = clamp01(Number(r.pppPred) / 1.4) * 100;
                    return (
                      <div
                        key={r.playType}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "220px 1fr 90px",
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

                        <div className="meter" aria-label={`Predicted PPP bar for ${r.playType}`}>
                          <div style={{ width: `${width}%` }} />
                        </div>

                        <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{fmt(r.pppPred, 3)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="divider" />

              {/* Full explainable table: this is the “defend it in a presentation” part */}
              <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Explainable ranking table</h3>

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Play Type</th>
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
                              <span className="btnIcon">
                                <Icon name="map" /> Map
                              </span>
                            </button>
                            <a
                              className="btn"
                              href={getPdfUrlForPlayType(r.playType)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ marginLeft: 8 }}
                            >
                              <span className="btnIcon">
                                <Icon name="pdf" /> PDF
                              </span>
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

              <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
                This page is the <strong>baseline</strong> (explainable reference). The AI Context Simulator shows how ML
                + game-state changes the ranking and returns adjustment breakdown fields.
              </p>
            </div>
          ) : !loading ? (
            <div className="subtleCard" style={{ marginTop: 12 }}>
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Run a matchup to see results</h2>
              <p className="muted" style={{ fontSize: 13 }}>
                Pick teams + season, then click <strong>Run Baseline</strong>. You’ll get Top-K ranked play types plus
                explainable reasoning fields and optional court-map visuals.
              </p>
            </div>
          ) : (
            <div className="subtleCard" style={{ marginTop: 12 }}>
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Running baseline…</h2>
              <p className="muted" style={{ fontSize: 13 }}>
                Computing shrunk offense/defense PPP, applying weighted blend, ranking Top-K, and returning reasoning fields.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: SportyPy visual panel + quick exports (this is the “make it real” side) */}
        <div className="stickyRight">
          <div className="subtleCard">
            <div className="panelTitle">
              <h2 style={{ margin: 0, fontSize: 16 }}>Court map (SportyPy)</h2>
              <span className="pillMini">
                <Icon name="map" /> Visual layer
              </span>
            </div>

            <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              Attach a real visual to your recommendation. Pick a play type from the ranked list, then generate the map.
            </p>

            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="muted" style={{ fontSize: 12 }}>Play type</span>
                <select
                  className="input"
                  value={vizPlayType}
                  onChange={(e) => setVizPlayType(e.target.value)}
                  disabled={rows.length === 0}
                >
                  {rows.length ? (
                    rows.map((r) => (
                      <option key={r.playType} value={r.playType}>
                        {r.playType}
                      </option>
                    ))
                  ) : (
                    <option value="">Run baseline first…</option>
                  )}
                </select>
              </label>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn" type="button" onClick={() => runViz()} disabled={!vizReady || vizLoading}>
                  <span className="btnIcon">
                    <Icon name="map" /> {vizLoading ? "Generating…" : "Generate map"}
                  </span>
                </button>

                <a
                  className="btn"
                  href={getPdfUrlForPlayType(vizPlayType)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!vizReady}
                >
                  <span className="btnIcon">
                    <Icon name="pdf" /> Export PDF
                  </span>
                </a>
              </div>

              {vizError ? (
                <p className="muted" style={{ fontSize: 12 }}>
                  {vizError}
                </p>
              ) : null}

              {!viz ? (
                <div style={{ borderRadius: 14, border: "1px dashed rgba(15,23,42,0.18)", padding: 12 }}>
                  <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                    {rows.length
                      ? "Generate a map for the selected play type to get a clean, coach-friendly visual."
                      : "Run the baseline to populate play types, then generate a map."}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 10 }}>
                    {viz.caption}
                  </p>
                  <div className="imgFrame">
                    <img src={`data:image/png;base64,${viz.image_base64}`} alt="Court map" />
                  </div>
                </div>
              )}
            </div>

            <div className="divider" />

            {/* Evidence links: makes it easy to jump into “proof” pages when presenting */}
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Quick links</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn" href="/model-metrics">
                Evidence (Plays)
              </Link>
              <Link className="btn" href="/statistical-analysis">
                Stats Analysis (Plays)
              </Link>
              <Link className="btn" href="/glossary">
                Glossary
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
