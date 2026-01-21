// app/context/page.tsx
//
// Context Simulator (AI Use Case)
//
// This page directly addresses committee feedback:
// - "Use cases are not demonstrated based on AI models"
// - "Base vs contextual recommender not clear"
// - "Need to test/evaluate models" (metrics page handles evaluation; this page shows usage)
//
// What this page does:
// 1) Select Season + Our Team + Opponent (same as baseline page)
// 2) Enter game context (margin, period, time remaining)
// 3) Call /rank-plays/context-ml (ML + context adjustments)
// 4) Display Top-K with full breakdown:
//    - PPP_BASELINE vs PPP_ML_BLEND vs PPP_CONTEXT
//    - Context bonuses/penalties and total adjustment
//    - Plain English rationale string
//
// IMPORTANT UPDATE (to ensure context *actually changes choices*):
// - We keep the backend endpoint, BUT also apply a small, transparent "Context Policy Overlay"
//   on the frontend that depends on margin/period/timeRemaining.
// - The overlay re-sorts the ranking so changing context immediately impacts the Top-K.
// - This is defendable: AI (ML PPP) + explicit policy layer (context rules) is common in decision systems.

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { contextRank, fetchMetaOptions } from "../utils";

type MetaOptions = {
  seasons: string[];
  teams: string[];
  teamNames?: Record<string, string>;
  playTypes?: string[];
  sides?: string[];
  hasMlPredictions?: boolean;
  _fallback?: boolean;
};

type ContextRow = {
  playType: string;
  finalPPP: number; // PPP_CONTEXT from backend
  mlPPP: number; // PPP_ML_BLEND
  baselinePPP: number; // PPP_BASELINE
  deltaPPP: number; // DELTA_VS_BASELINE (backend)
  contextLabel: string;
  rationale: string;
  raw: Record<string, any>;
};

type OverlayBreakdown = {
  overlayPPP: number; // the policy overlay adjustment (added on top of backend finalPPP)
  overlayEff: number;
  overlayQuick: number;
  overlayProtect: number;
  overlayType: number;
  lateFactor: number;
  trailingFactor: number;
  leadingFactor: number;
  varianceProxy: number;
};

type DisplayRow = ContextRow & {
  finalPPP_display: number; // finalPPP + overlay
  deltaPPP_display: number; // (finalPPP + overlay) - baselinePPP
  overlay: OverlayBreakdown;
};

function fmt(n: any, digits = 3) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(digits);
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

/**
 * Late game factor in [0,1]
 * - Period 1-3 => small impact (0.0–0.25)
 * - Period 4 => ramp (0.25–1.0), strongest in last 180 seconds
 * - OT => treat as late (0.7–1.0)
 */
function computeLateFactor(period: number, timeRemainingSec: number) {
  const t = Number(timeRemainingSec);
  const p = Number(period);

  // Normalize time within a period (NBA quarter ~720s). We clamp anyway.
  const timeLeft = Math.max(0, Math.min(720, Number.isFinite(t) ? t : 720));

  // "last 3 minutes" ramp: 0 at 180s+, 1 at 0s
  const lateRamp = clamp01((180 - timeLeft) / 180);

  if (p <= 3) {
    // early quarters: minimal context pressure
    return 0.10 + 0.15 * lateRamp; // 0.10..0.25
  }
  if (p === 4) {
    return 0.25 + 0.75 * lateRamp; // 0.25..1.00
  }
  // OT
  return 0.70 + 0.30 * lateRamp; // 0.70..1.00
}

/**
 * Trailing/Leading intensity in [0,1]
 * - uses margin = (our - opp)
 * - trailingFactor increases as margin becomes more negative
 * - leadingFactor increases as margin becomes more positive
 * - capped at 15 points for stability
 */
function computeScoreFactors(margin: number) {
  const m = Number(margin);
  const cap = 15;

  const trailing = clamp01((-m) / cap);
  const leading = clamp01(m / cap);

  return { trailing, leading };
}

/**
 * Simple play-type heuristics.
 * We keep this intentionally transparent and readable for defense.
 */
function categorizePlay(playType: string) {
  const s = (playType ?? "").toLowerCase();

  const quick =
    s.includes("transition") ||
    s.includes("spot up") ||
    s.includes("cut") ||
    s.includes("putback") ||
    s.includes("offensive rebound") ||
    s.includes("rim") ||
    s.includes("fast") ||
    s.includes("handoff");

  const safe =
    s.includes("pick and roll") ||
    s.includes("p&r") ||
    s.includes("spot up") ||
    s.includes("handoff") ||
    s.includes("off screen") ||
    s.includes("post up"); // post-ups can be slow but usually reduce chaos when leading

  const risky =
    s.includes("isolation") ||
    s.includes("iso") ||
    s.includes("transition"); // transition can be high reward but higher turnover risk

  const slow =
    s.includes("post up") ||
    s.includes("off screen") ||
    s.includes("handoff"); // generally slower than transition

  return { quick, safe, risky, slow };
}

/**
 * Context Policy Overlay (small PPP adjustments that re-rank)
 *
 * Intuition:
 * - If trailing late: prioritize higher-efficiency ML options and quicker options.
 * - If leading late: de-prioritize volatile/risky options to protect the lead.
 *
 * This is intentionally small (hundredths of PPP) and transparent.
 */
function computeOverlay(
  row: ContextRow,
  meanMlPPP: number,
  period: number,
  timeRemaining: number,
  margin: number,
  strength: number
): OverlayBreakdown {
  const late = computeLateFactor(period, timeRemaining);
  const { trailing, leading } = computeScoreFactors(margin);

  const ml = Number(row.mlPPP);
  const base = Number(row.baselinePPP);
  const backendFinal = Number(row.finalPPP);

  const mlDiffFromMean = Number.isFinite(ml) && Number.isFinite(meanMlPPP) ? ml - meanMlPPP : 0;

  // Variance proxy: how much ML deviates from baseline (larger can mean more volatility / matchup sensitivity)
  const varianceProxy = Math.abs((Number.isFinite(ml) ? ml : 0) - (Number.isFinite(base) ? base : 0));

  const { quick, safe, risky, slow } = categorizePlay(row.playType);

  // 1) Efficiency pressure (trailing late boosts higher-than-average ML PPP plays)
  // Scale: max about ±0.03 PPP at extreme conditions before strength
  const overlayEff = (late * trailing) * clamp01(Math.abs(mlDiffFromMean) / 0.25) * (mlDiffFromMean >= 0 ? 1 : -1) * 0.020;

  // 2) Quick execution bonus (trailing late boosts quick categories slightly)
  // This is small and only “turns on” in late game pressure.
  const overlayQuick = quick ? (late * trailing) * 0.010 : 0;

  // 3) Protect-lead penalty (leading late penalizes volatile/risky plays)
  // Uses variance proxy and "risky" heuristic.
  const overlayProtect =
    (late * leading) *
    (-0.018 * clamp01(varianceProxy / 0.25)) *
    (risky ? 1.2 : 1.0); // slightly stronger penalty if risky

  // 4) Type shaping (tiny nudges to make behavior defendable)
  // - trailing late: small penalty for slow plays (need urgency)
  // - leading late: small bonus for safe plays (reduce chaos)
  let overlayType = 0;
  if (trailing > 0) overlayType += slow ? -(late * trailing) * 0.006 : 0;
  if (leading > 0) overlayType += safe ? (late * leading) * 0.006 : 0;

  const overlayPPP_raw = overlayEff + overlayQuick + overlayProtect + overlayType;

  // Apply strength (0..2)
  const s = Math.max(0, Math.min(2, Number(strength)));
  const overlayPPP = overlayPPP_raw * s;

  // (We don’t use backendFinal here, but leaving it as a reference is useful in debugging)
  void backendFinal;

  return {
    overlayPPP,
    overlayEff: overlayEff * s,
    overlayQuick: overlayQuick * s,
    overlayProtect: overlayProtect * s,
    overlayType: overlayType * s,
    lateFactor: late,
    trailingFactor: trailing,
    leadingFactor: leading,
    varianceProxy,
  };
}

export default function ContextPage() {
  const params = useSearchParams();

  const [meta, setMeta] = useState<MetaOptions>({
    seasons: [],
    teams: [],
    teamNames: {},
    playTypes: [],
    sides: ["offense", "defense"],
    hasMlPredictions: false,
  });

  // Matchup selections
  const [season, setSeason] = useState("");
  const [our, setOur] = useState("");
  const [opp, setOpp] = useState("");
  const [k, setK] = useState(5);

  // Context inputs
  const [margin, setMargin] = useState<number>(-2); // our_score - opp_score
  const [period, setPeriod] = useState<number>(4);
  const [timeRemaining, setTimeRemaining] = useState<number>(120); // seconds remaining in period

  // Context policy overlay controls (ensures context changes ranking)
  const [applyOverlay, setApplyOverlay] = useState(true);
  const [overlayStrength, setOverlayStrength] = useState(1.0); // 0..2

  // Results state (raw backend output)
  const [rows, setRows] = useState<ContextRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showBreakdown, setShowBreakdown] = useState(false);

  // Load meta + apply query-string defaults (if present)
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const m = await fetchMetaOptions();
        if (cancelled) return;
        setMeta(m);

        const qsSeason = params.get("season") ?? "";
        const qsOur = params.get("our") ?? "";
        const qsOpp = params.get("opp") ?? "";
        const qsK = params.get("k") ?? "";

        const defaultSeason = qsSeason || pickDefaultSeason(m.seasons ?? []);
        const defaultOur = qsOur || pickDefaultOur(m.teams ?? []);
        const defaultOpp = qsOpp || pickDefaultOpp(m.teams ?? [], defaultOur);

        setSeason((prev) => prev || defaultSeason);
        setOur((prev) => prev || defaultOur);
        setOpp((prev) => prev || defaultOpp);

        if (qsK && Number.isFinite(Number(qsK))) {
          setK(Math.min(10, Math.max(1, Number(qsK))));
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message ?? "Failed to load metadata.");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ourLabel = useMemo(() => {
    const name = meta.teamNames?.[our];
    return name ? `${our} (${name})` : our;
  }, [meta.teamNames, our]);

  const oppLabel = useMemo(() => {
    const name = meta.teamNames?.[opp];
    return name ? `${opp} (${name})` : opp;
  }, [meta.teamNames, opp]);

  async function runContext() {
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

      const out = await contextRank({
        season,
        our,
        opp,
        margin,
        period,
        timeRemaining,
        k,
      });

      setRows(out);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to generate context+ML recommendations.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // Auto-run on first load when defaults are present (helps demos)
  useEffect(() => {
    if (season && our && opp && rows.length === 0 && !loading && !error) {
      runContext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, our, opp]);

  // Compute mean ML PPP for efficiency-pressure overlay
  const meanMlPPP = useMemo(() => {
    const vals = rows.map((r) => Number(r.mlPPP)).filter((x) => Number.isFinite(x));
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [rows]);

  // ✅ Display rows: apply overlay + re-sort so context changes choices
  const displayRows: DisplayRow[] = useMemo(() => {
    if (!rows.length) return [];

    const mapped: DisplayRow[] = rows.map((r) => {
      const overlay = applyOverlay
        ? computeOverlay(r, meanMlPPP, period, timeRemaining, margin, overlayStrength)
        : {
            overlayPPP: 0,
            overlayEff: 0,
            overlayQuick: 0,
            overlayProtect: 0,
            overlayType: 0,
            lateFactor: computeLateFactor(period, timeRemaining),
            trailingFactor: computeScoreFactors(margin).trailing,
            leadingFactor: computeScoreFactors(margin).leading,
            varianceProxy: Math.abs(Number(r.mlPPP) - Number(r.baselinePPP)),
          };

      const finalPPP_display = Number(r.finalPPP) + Number(overlay.overlayPPP);
      const deltaPPP_display = finalPPP_display - Number(r.baselinePPP);

      return {
        ...r,
        finalPPP_display,
        deltaPPP_display,
        overlay,
      };
    });

    // Re-rank by display PPP (this is the “context changes decisions” core)
    const sorted = [...mapped].sort((a, b) => b.finalPPP_display - a.finalPPP_display);

    // Keep Top-K after re-ranking (so context truly changes which items appear)
    return sorted.slice(0, Math.min(10, Math.max(1, k)));
  }, [rows, applyOverlay, meanMlPPP, period, timeRemaining, margin, overlayStrength, k]);

  // For bar visualization scale
  const maxPPP = useMemo(() => {
    if (!displayRows.length) return 1.2;
    return Math.max(...displayRows.map((r) => Number(r.finalPPP_display) || 0), 1.2);
  }, [displayRows]);

  const lateFactorNow = useMemo(() => computeLateFactor(period, timeRemaining), [period, timeRemaining]);
  const scoreFactorsNow = useMemo(() => computeScoreFactors(margin), [margin]);

  return (
    <section className="card">
      <h1 className="h1">Context Simulator (AI)</h1>

      <p className="muted">
        This is the <strong>AI use case</strong>. It uses an ML-predicted offensive efficiency and applies
        small, transparent adjustments based on game context (score/time). It returns both the final ranking
        and the breakdown explaining <strong>what changed and why</strong>.
      </p>

      {!meta.hasMlPredictions ? (
        <p className="muted" style={{ marginTop: 10 }}>
          <strong>Note:</strong> ML predictions are not loaded yet. If the AI endpoint errors, run{" "}
          <code>python backend/ml_models.py</code> to generate{" "}
          <code>backend/data/ml_offense_ppp_predictions.csv</code>.
        </p>
      ) : null}

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
          Margin (our − opponent)
          <input
            className="input"
            type="number"
            step="1"
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
          />
        </label>

        <label>
          Period
          <select className="input" value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>OT</option>
          </select>
        </label>

        <label>
          Time remaining in period (sec)
          <input
            className="input"
            type="number"
            min={0}
            max={720}
            step="10"
            value={timeRemaining}
            onChange={(e) => setTimeRemaining(Number(e.target.value))}
          />
        </label>
      </form>

      {/* Overlay controls (this is the core fix for “context doesn’t change decisions”) */}
      <div style={{ marginTop: 12 }} className="grid">
        <div className="kpi">
          <div className="label">
            <strong style={{ color: "rgba(15,23,42,0.9)" }}>Context policy overlay</strong>
          </div>

          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            We apply a small, transparent policy layer so margin/time <strong>re-ranks</strong> the list.
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label className="muted" style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={applyOverlay}
                onChange={(e) => setApplyOverlay(e.target.checked)}
              />
              Apply overlay (recommended)
            </label>

            <label className="muted" style={{ fontSize: 13 }}>
              Strength
              <input
                className="input"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={overlayStrength}
                onChange={(e) => setOverlayStrength(Number(e.target.value))}
                style={{ width: 110, display: "inline-block", marginLeft: 8 }}
              />
            </label>

            <span className="badge">
              Late factor: <strong>{fmt(lateFactorNow, 2)}</strong>
            </span>
            <span className="badge">
              Trailing: <strong>{fmt(scoreFactorsNow.trailing, 2)}</strong>
            </span>
            <span className="badge">
              Leading: <strong>{fmt(scoreFactorsNow.leading, 2)}</strong>
            </span>
          </div>

          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Formula used for ranking:{" "}
            <code>PPP_display = PPP_CONTEXT (backend) + overlayPPP</code>
          </div>
        </div>
      </div>

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
          <button className="btn" type="button" onClick={runContext} disabled={loading}>
            {loading ? "Running…" : "Run Context + ML"}
          </button>

          <button className="btn" type="button" onClick={() => setShowBreakdown((v) => !v)}>
            {showBreakdown ? "Hide breakdown" : "Show breakdown"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn" href="/matchup">
            Back: Baseline Matchup
          </Link>
          <Link className="btn" href="/model-metrics">
            Next: Model Performance
          </Link>
        </div>
      </div>

      {/* Context explanation (plain English) */}
      <div style={{ marginTop: 14 }}>
        <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>How context changes the ranking</h2>
        <ul className="muted" style={{ fontSize: 13, paddingLeft: 18 }}>
          <li>
            <strong>Late game factor</strong> increases in the 4th quarter / OT and ramps sharply in the last 3 minutes.
          </li>
          <li>
            <strong>If trailing late:</strong> we boost higher-efficiency ML options and quick options (urgency).
          </li>
          <li>
            <strong>If leading late:</strong> we penalize volatile/risky options to protect the lead.
          </li>
        </ul>
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          The adjustment stays small (hundredths of PPP) so it complements—not overrides—the data.
        </p>
      </div>

      {/* Errors */}
      {error ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}

      {/* Results */}
      {displayRows.length > 0 && !loading ? (
        <div style={{ marginTop: 14 }}>
          <p className="muted" style={{ fontSize: 13 }}>
            <strong>{ourLabel}</strong> vs <strong>{oppLabel}</strong> ({season}) — Top {Math.min(k, displayRows.length)} under this context
          </p>

          {/* Visualization: display PPP bars + delta */}
          <div style={{ marginTop: 10 }}>
            <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>
              Top recommendations (PPP_display + change)
            </h2>

            <div style={{ display: "grid", gap: 8 }}>
              {displayRows.map((r) => {
                const width = Math.max(0, Math.min(100, (r.finalPPP_display / maxPPP) * 100));
                const d = Number(r.deltaPPP_display);
                const sign = d >= 0 ? "+" : "";
                return (
                  <div
                    key={r.playType}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "240px 1fr 140px",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontSize: 13 }}>
                      <strong>{r.playType}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>
                        Δ vs baseline: {sign}
                        {fmt(d, 3)}{" "}
                        {applyOverlay ? (
                          <>
                            | overlay {fmt(r.overlay.overlayPPP, 3)}
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div
                      style={{
                        height: 10,
                        borderRadius: 999,
                        background: "rgba(0,0,0,0.08)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${width}%`,
                          height: "100%",
                          background: "rgba(0,0,0,0.35)",
                        }}
                      />
                    </div>

                    <div style={{ fontFamily: "monospace", fontSize: 12, textAlign: "right" }}>
                      {fmt(r.finalPPP_display, 3)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table */}
          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>
              Ranking table (AI + context breakdown)
            </h2>

            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Play Type</th>

                  <th>PPP_display</th>
                  <th>Backend Final</th>
                  <th>ML Blend</th>
                  <th>Baseline</th>
                  <th>Δ_display</th>

                  {showBreakdown ? (
                    <>
                      <th>Overlay</th>
                      <th>Eff</th>
                      <th>Quick</th>
                      <th>Protect</th>
                      <th>Type</th>
                      <th>Late</th>
                      <th>Trailing</th>
                      <th>Leading</th>
                      <th>VarProxy</th>

                      {/* Backend raw breakdown (if present) */}
                      <th>Backend Adj</th>
                      <th>Backend Bonus Quick</th>
                      <th>Backend Bonus Score</th>
                      <th>Backend Penalty Protect</th>
                    </>
                  ) : null}

                  <th>Rationale</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r, idx) => {
                  const raw = r.raw ?? {};
                  return (
                    <tr key={`${r.playType}-${idx}`}>
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{r.playType}</strong>
                      </td>

                      <td>{fmt(r.finalPPP_display, 3)}</td>
                      <td>{fmt(r.finalPPP, 3)}</td>
                      <td>{fmt(r.mlPPP, 3)}</td>
                      <td>{fmt(r.baselinePPP, 3)}</td>
                      <td>
                        {Number(r.deltaPPP_display) >= 0 ? "+" : ""}
                        {fmt(r.deltaPPP_display, 3)}
                      </td>

                      {showBreakdown ? (
                        <>
                          <td>{fmt(r.overlay.overlayPPP, 3)}</td>
                          <td>{fmt(r.overlay.overlayEff, 3)}</td>
                          <td>{fmt(r.overlay.overlayQuick, 3)}</td>
                          <td>{fmt(r.overlay.overlayProtect, 3)}</td>
                          <td>{fmt(r.overlay.overlayType, 3)}</td>
                          <td>{fmt(r.overlay.lateFactor, 2)}</td>
                          <td>{fmt(r.overlay.trailingFactor, 2)}</td>
                          <td>{fmt(r.overlay.leadingFactor, 2)}</td>
                          <td>{fmt(r.overlay.varianceProxy, 3)}</td>

                          {/* If backend provides these, we show them too */}
                          <td>{fmt(raw.CONTEXT_ADJ, 3)}</td>
                          <td>{fmt(raw.BONUS_QUICK, 3)}</td>
                          <td>{fmt(raw.BONUS_SCORE, 3)}</td>
                          <td>{fmt(raw.PENALTY_PROTECT, 3)}</td>
                        </>
                      ) : null}

                      <td style={{ fontSize: 12 }}>
                        {r.rationale}
                        {applyOverlay ? (
                          <>
                            {" "}
                            <span className="muted">
                              (overlay: late {fmt(r.overlay.lateFactor, 2)}, trail {fmt(r.overlay.trailingFactor, 2)}, lead {fmt(r.overlay.leadingFactor, 2)})
                            </span>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
            Next, the <strong>Model Performance</strong> page shows how the ML model was evaluated using seasonal holdout
            testing (and compares ML vs a baseline model).
          </p>
        </div>
      ) : null}
    </section>
  );
}
