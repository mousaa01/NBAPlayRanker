"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchMlAnalysis } from "../utils";

type CorrMatrix = { labels: string[]; matrix: number[][] };

type TargetCorrRow = { feature: string; corr: number; abs: number };

type MlAnalysisResponse = {
  dataset: {
    rows_after_filters: number;
    min_poss_filter: number;
    n_seasons: number;
    seasons: string[];
    n_teams: number;
    n_play_types: number;
    feature_cols: string[];
    target_col: string;
  };
  eda: {
    poss: any;
    ppp: any;
    hist_poss: { bins: number[]; counts: number[] };
    hist_ppp: { bins: number[]; counts: number[] };
    missing_counts: Record<string, number>;
  };
  correlations: CorrMatrix;
  target_feature_corr: TargetCorrRow[];
  feature_selection: {
    correlation_filter: { threshold: number; kept: string[]; dropped: string[] };
    select_k_best: { k: number; selected: string[]; scores: { feature: string; score: number }[] };
    rfe: { selected: string[]; ranking: { feature: string; rank: number }[] };
  };
  model_selection: {
    tuning: {
      cv: string;
      features_used: string[];
      ridge: { best_params: { alpha: number }; best_rmse: number };
      random_forest: { best_params: any; best_rmse: number };
      gradient_boosting: { best_params: any; best_rmse: number };
    };
  };
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

/**
 * Heatmap cell background using NBA colors:
 * - positive corr => NBA blue intensity
 * - negative corr => NBA red intensity
 */
function corrBg(v: number) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "transparent";
  const a = clamp01(Math.abs(x)); // 0..1 intensity
  if (x >= 0) return `rgba(29, 66, 138, ${0.10 + 0.35 * a})`; // blue
  return `rgba(200, 16, 46, ${0.10 + 0.35 * a})`; // red
}

function MiniHistogram({
  title,
  hist,
}: {
  title: string;
  hist: { bins: number[]; counts: number[] };
}) {
  const bins = hist?.bins ?? [];
  const counts = hist?.counts ?? [];
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

  const digits = title.toLowerCase().includes("poss") ? 0 : 3;

  // Supports both common formats:
  // 1) bins are edges (length = counts + 1)
  // 2) bins are centers (length = counts)
  function getBinRange(i: number): { lo: number; hi: number } {
    const edges = bins;

    // Case 1: edges
    if (edges.length === counts.length + 1) {
      const lo = Number(edges[i]);
      const hi = Number(edges[i + 1]);
      return { lo, hi };
    }

    // Case 2: centers -> approximate real range using midpoints
    if (edges.length === counts.length && edges.length > 0) {
      const c = Number(edges[i]);
      const prev = i > 0 ? Number(edges[i - 1]) : c;
      const next = i < edges.length - 1 ? Number(edges[i + 1]) : c;

      const halfLeft = (c - prev) / 2;
      const halfRight = (next - c) / 2;

      const lo = c - (Number.isFinite(halfLeft) ? halfLeft : 0);
      const hi = c + (Number.isFinite(halfRight) ? halfRight : 0);
      return { lo, hi };
    }

    // Fallback: no bins info
    return { lo: NaN, hi: NaN };
  }

  function rangeLabel(i: number) {
    const { lo, hi } = getBinRange(i);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return "—";
    const left = digits === 0 ? fmtInt(lo) : fmt(lo, digits);
    const right = digits === 0 ? fmtInt(hi) : fmt(hi, digits);
    return `${left}–${right}`;
    }

  const axisMin =
    bins.length === counts.length + 1 ? bins[0] : bins.length ? getBinRange(0).lo : NaN;
  const axisMax =
    bins.length === counts.length + 1
      ? bins[bins.length - 1]
      : bins.length
      ? getBinRange(Math.max(0, counts.length - 1)).hi
      : NaN;

  return (
    <div className="kpi">
      <div className="label" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <strong style={{ color: "rgba(15,23,42,0.9)" }}>{title}</strong>
        <span className="badge">bins: {counts.length}</span>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 4, alignItems: "flex-end", height: 70 }}>
        {counts.map((c, i) => {
          const h = Math.round((c / max) * 70);
          const r = rangeLabel(i);
          return (
            <div
              key={i}
              title={`${r} / count ${fmtInt(c)}`} // ✅ X bin range / Y count
              style={{
                width: 10,
                height: h,
                borderRadius: 6,
                background: "rgba(15,23,42,0.25)",
              }}
            />
          );
        })}
      </div>

      {/* ✅ Quick axis hints */}
      <div className="muted" style={{ marginTop: 8, fontSize: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span>
          X:{" "}
          <strong style={{ fontFamily: "var(--mono)" }}>
            {Number.isFinite(axisMin) ? (digits === 0 ? fmtInt(axisMin) : fmt(axisMin, digits)) : "—"}
          </strong>{" "}
          →{" "}
          <strong style={{ fontFamily: "var(--mono)" }}>
            {Number.isFinite(axisMax) ? (digits === 0 ? fmtInt(axisMax) : fmt(axisMax, digits)) : "—"}
          </strong>
        </span>
        <span>
          Y (count): <strong style={{ fontFamily: "var(--mono)" }}>{fmtInt(max)}</strong> max
        </span>
      </div>

      <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        Hover bars to see: <strong>X bin range</strong> / <strong>Y count</strong>.
      </div>

      {/* ✅ Expandable bin table with real x/y */}
      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontSize: 13 }}>
          Show bin table (x range / y count)
        </summary>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Bin</th>
                <th>X range</th>
                <th>Count (Y)</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c, i) => {
                const { lo, hi } = getBinRange(i);
                const left = Number.isFinite(lo) ? (digits === 0 ? fmtInt(lo) : fmt(lo, digits)) : "—";
                const right = Number.isFinite(hi) ? (digits === 0 ? fmtInt(hi) : fmt(hi, digits)) : "—";
                const pct = total > 0 ? (Number(c) / total) * 100 : 0;

                return (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--mono)" }}>{i + 1}</td>
                    <td style={{ fontFamily: "var(--mono)" }}>
                      {left}–{right}
                    </td>
                    <td style={{ fontFamily: "var(--mono)" }}>{fmtInt(c)}</td>
                    <td style={{ fontFamily: "var(--mono)" }}>{fmt(pct, 1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export default function StatisticalAnalysisPage() {
  const [nSplits, setNSplits] = useState(5);
  const [minPoss, setMinPoss] = useState(25);
  const [refresh, setRefresh] = useState(false);

  const [data, setData] = useState<MlAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = (await fetchMlAnalysis({
        nSplits,
        minPoss,
        refresh,
      })) as unknown as MlAnalysisResponse;
      setData(res);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to load statistical analysis (backend /analysis/ml).");
      setData(null);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topTargetCorr = useMemo(() => {
    const rows = data?.target_feature_corr ?? [];
    return [...rows].sort((a, b) => b.abs - a.abs).slice(0, 10);
  }, [data]);

  const tuning = data?.model_selection?.tuning;

  const bestModel = useMemo(() => {
    if (!tuning) return null;
    const candidates = [
      { name: "Ridge", rmse: tuning.ridge?.best_rmse ?? Infinity },
      { name: "RandomForest", rmse: tuning.random_forest?.best_rmse ?? Infinity },
      { name: "GradientBoosting", rmse: tuning.gradient_boosting?.best_rmse ?? Infinity },
    ].filter((x) => Number.isFinite(x.rmse));
    if (!candidates.length) return null;
    return candidates.sort((a, b) => a.rmse - b.rmse)[0];
  }, [tuning]);

  return (
    <section className="card">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="h1">Statistical Analysis</h1>
          <p className="muted" style={{ fontSize: 14 }}>
            This page shows the evidence: distributions, correlation heatmap, feature selection, and model selection.
            It is designed so reviewers can see exactly how the final model choice was justified.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn" href="/model-metrics">
            Back: Model Performance
          </Link>
          <Link className="btn" href="/glossary">
            Next: Glossary
          </Link>
        </div>
      </div>

      {/* Controls */}
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
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 13 }}>
            n_splits (GroupKFold by season)
            <select
              className="input"
              style={{ width: 120, display: "inline-block", marginLeft: 8 }}
              value={nSplits}
              onChange={(e) => setNSplits(Number(e.target.value))}
            >
              {[3, 4, 5, 6].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 13 }}>
            min_poss filter
            <input
              className="input"
              style={{ width: 120, display: "inline-block", marginLeft: 8 }}
              type="number"
              value={minPoss}
              min={0}
              max={200}
              onChange={(e) => setMinPoss(Number(e.target.value))}
            />
          </label>

          <button className="btn" type="button" onClick={() => { setRefresh(true); load(); }} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {bestModel ? (
          <span className="badge blue">
            Best (lowest RMSE): {bestModel.name} ({fmt(bestModel.rmse, 3)})
          </span>
        ) : (
          <span className="badge">Best model: —</span>
        )}
      </div>

      {err ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {err}
        </p>
      ) : null}

      {/* Dataset summary */}
      {data?.dataset ? (
        <div style={{ marginTop: 14 }} className="grid">
          <div className="kpi">
            <div className="label">Rows after filters</div>
            <div className="value">{fmtInt(data.dataset.rows_after_filters)}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Filter applied: POSS ≥ {data.dataset.min_poss_filter}
            </div>
          </div>

          <div className="kpi">
            <div className="label">Seasons</div>
            <div className="value">{fmtInt(data.dataset.n_seasons)}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              CV groups = seasons (prevents leakage)
            </div>
          </div>

          <div className="kpi">
            <div className="label">Teams / Play Types</div>
            <div className="value">
              {fmtInt(data.dataset.n_teams)} / {fmtInt(data.dataset.n_play_types)}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Team-level aggregated play-type table
            </div>
          </div>
        </div>
      ) : null}

      {/* Histograms */}
      {data?.eda ? (
        <div style={{ marginTop: 14 }} className="grid">
          <MiniHistogram title="POSS distribution" hist={data.eda.hist_poss} />
          <MiniHistogram title={`${data.dataset.target_col} distribution`} hist={data.eda.hist_ppp} />
          <div className="kpi">
            <div className="label">
              <strong style={{ color: "rgba(15,23,42,0.9)" }}>Missing values</strong>
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {Object.entries(data.eda.missing_counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                    <span style={{ fontFamily: "var(--mono)" }}>{k}</span>
                    <span className="badge">{v}</span>
                  </div>
                ))}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Top 10 columns by missing count (after filters).
            </div>
          </div>
        </div>
      ) : null}

      {/* Correlation heatmap */}
      {data?.correlations ? (
        <div style={{ marginTop: 18 }}>
          <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Correlation heatmap (features + target)</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            This supports two course goals: (1) understand relationships and redundancy, (2) justify multicollinearity pruning.
            Blue = positive correlation. Red = negative correlation.
          </p>

          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ position: "sticky", left: 0, background: "rgba(15,23,42,0.03)" }}> </th>
                  {data.correlations.labels.map((c) => (
                    <th key={c} style={{ fontFamily: "var(--mono)" }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.correlations.labels.map((rLabel, i) => (
                  <tr key={rLabel}>
                    <td style={{ position: "sticky", left: 0, background: "rgba(255,255,255,0.92)", fontFamily: "var(--mono)" }}>
                      {rLabel}
                    </td>
                    {data.correlations.matrix[i].map((v, j) => (
                      <td
                        key={`${i}-${j}`}
                        style={{
                          background: corrBg(v),
                          fontFamily: "var(--mono)",
                          textAlign: "right",
                        }}
                        title={`corr(${rLabel}, ${data.correlations.labels[j]}) = ${fmt(v, 3)}`}
                      >
                        {fmt(v, 2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Target-feature correlation bars */}
      {topTargetCorr.length ? (
        <div style={{ marginTop: 18 }}>
          <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Top feature correlations with target</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            This supports feature selection justification: features more strongly correlated with the target are candidates for simpler models.
          </p>

          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {topTargetCorr.map((r) => {
              const w = clamp01(r.abs) * 100;
              return (
                <div
                  key={r.feature}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "220px 1fr 70px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 13, fontFamily: "var(--mono)" }}>{r.feature}</div>

                  <div style={{ height: 10, borderRadius: 999, background: "rgba(15,23,42,0.08)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${w}%`,
                        height: "100%",
                        background: r.corr >= 0 ? "rgba(29, 66, 138, 0.55)" : "rgba(200, 16, 46, 0.55)",
                      }}
                    />
                  </div>

                  <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                    {fmt(r.corr, 3)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Feature selection results */}
      {data?.feature_selection ? (
        <div style={{ marginTop: 18 }}>
          <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Feature selection (course-style)</h2>

          <div className="grid" style={{ marginTop: 10 }}>
            <div className="kpi">
              <div className="label">
                <strong style={{ color: "rgba(15,23,42,0.9)" }}>Correlation filter</strong>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                Threshold: <strong>{fmt(data.feature_selection.correlation_filter.threshold, 2)}</strong>
              </div>
              <div style={{ marginTop: 10 }}>
                <div className="badge blue">Kept: {data.feature_selection.correlation_filter.kept.length}</div>{" "}
                <div className="badge" style={{ marginLeft: 8 }}>
                  Dropped: {data.feature_selection.correlation_filter.dropped.length}
                </div>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                Why: removes highly redundant features to reduce multicollinearity and improve stability.
              </div>
            </div>

            <div className="kpi">
              <div className="label">
                <strong style={{ color: "rgba(15,23,42,0.9)" }}>SelectKBest (f_regression)</strong>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                k = <strong>{data.feature_selection.select_k_best.k}</strong>
              </div>
              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                {data.feature_selection.select_k_best.selected.map((f) => (
                  <span key={f} className="badge blue" style={{ justifySelf: "start" }}>
                    {f}
                  </span>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                Why: fast filter method used as a baseline for feature usefulness.
              </div>
            </div>

            <div className="kpi">
              <div className="label">
                <strong style={{ color: "rgba(15,23,42,0.9)" }}>RFE (Ridge wrapper)</strong>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                Selected features:
              </div>
              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                {data.feature_selection.rfe.selected.map((f) => (
                  <span key={f} className="badge red" style={{ justifySelf: "start" }}>
                    {f}
                  </span>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                Why: wrapper method that selects features improving model performance.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Model selection summary */}
      {tuning ? (
        <div style={{ marginTop: 18 }}>
          <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Model selection summary</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            CV method: <strong>{tuning.cv}</strong>. Models are tuned and compared using RMSE (lower is better).
          </p>

          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Best RMSE</th>
                  <th>Best Params</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Ridge</strong></td>
                  <td style={{ fontFamily: "var(--mono)" }}>{fmt(tuning.ridge.best_rmse, 4)}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>alpha={fmt(tuning.ridge.best_params.alpha, 3)}</td>
                </tr>
                <tr>
                  <td><strong>RandomForest</strong></td>
                  <td style={{ fontFamily: "var(--mono)" }}>{fmt(tuning.random_forest.best_rmse, 4)}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{JSON.stringify(tuning.random_forest.best_params)}</td>
                </tr>
                <tr>
                  <td><strong>GradientBoosting</strong></td>
                  <td style={{ fontFamily: "var(--mono)" }}>{fmt(tuning.gradient_boosting.best_rmse, 4)}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{JSON.stringify(tuning.gradient_boosting.best_params)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Interpretation: Ridge is a strong linear baseline; tree models capture non-linear interactions. The “best model” badge above is selected by lowest tuned RMSE.
          </p>
        </div>
      ) : null}

      {/* Raw JSON (debug/defense) */}
      {data ? (
        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: "pointer", fontSize: 13 }}>
            Show raw analysis JSON (for debugging / transparency)
          </summary>
          <pre
            style={{
              marginTop: 10,
              background: "rgba(15, 23, 42, 0.04)",
              padding: 12,
              borderRadius: 12,
              overflowX: "auto",
              fontSize: 12,
              border: "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
