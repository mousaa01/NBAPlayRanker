// app/model-metrics/page.tsx
//
// Model Performance (defense page)
//
// Updated to align with your finished Statistical Analysis page:
// ✅ Still shows HOLDOUT evaluation (Baseline vs ML) from /metrics/baseline-vs-ml
// ✅ NOW also pulls the *tuning + feature selection evidence* from /analysis/ml
// ✅ Adds a clear “Holdout vs Tuning” distinction (committee-friendly)
// ✅ Keeps the same UI style + RMSE bars + table + optional t-test + pipeline/module section
//
// Requirements:
// - ../utils must export: fetchModelMetrics, fetchPipelineInfo, fetchMlAnalysis
// - /analysis/ml must return model_selection.tuning + dataset info (like your Statistical Analysis page)

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchModelMetrics, fetchPipelineInfo, fetchMlAnalysis } from "../utils";

type MetricsRow = {
  model: string;
  RMSE_mean: number;
  RMSE_std: number;
  MAE_mean: number;
  MAE_std: number;
  R2_mean: number;
  R2_std: number;
};

type MetricsResponse = {
  n_splits: number;
  metrics: MetricsRow[];
  rf_vs_baseline_t: number | null;
  rf_vs_baseline_p: number | null;
};

type PipelineInfo = {
  dataSource?: string;
  cleaning_and_aggregation?: string[];
  modeling?: string[];
};

type MlTuning = {
  cv: string;
  features_used: string[];
  ridge: { best_params: { alpha: number }; best_rmse: number };
  random_forest: { best_params: any; best_rmse: number };
  gradient_boosting: { best_params: any; best_rmse: number };
};

type MlAnalysisSlim = {
  dataset?: {
    rows_after_filters: number;
    min_poss_filter: number;
    n_seasons: number;
    seasons: string[];
    n_teams?: number;
    n_play_types?: number;
    feature_cols?: string[];
    target_col?: string;
  };
  feature_selection?: {
    select_k_best?: { k: number; selected: string[] };
    rfe?: { selected: string[] };
    correlation_filter?: { threshold: number; kept: string[]; dropped: string[] };
  };
  model_selection?: {
    tuning: MlTuning;
  };
};

function fmt(n: any, digits = 3) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

function fmtP(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (x < 0.0001) return "<0.0001";
  return x.toFixed(4);
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export default function ModelMetricsPage() {
  const [pipeline, setPipeline] = useState<PipelineInfo | null>(null);

  const [nSplits, setNSplits] = useState<number>(5);
  const [data, setData] = useState<MetricsResponse | null>(null);

  // ✅ NEW: pull the same tuning evidence used in Statistical Analysis page
  const [ml, setMl] = useState<MlAnalysisSlim | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);

      const [p, m, a] = await Promise.all([
        fetchPipelineInfo(),
        fetchModelMetrics(nSplits),
        // keep consistent with Statistical Analysis defaults: minPoss=25, refresh=false
        fetchMlAnalysis({ nSplits, minPoss: 25, refresh: false }),
      ]);

      setPipeline(p);
      setData(m);
      setMl(a);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to load model metrics.");
      setData(null);
      setMl(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-load when user changes nSplits
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nSplits]);

  const rows = useMemo(() => {
    return Array.isArray(data?.metrics) ? data!.metrics : [];
  }, [data]);

  // Best model by lowest HOLDOUT RMSE
  const bestModel = useMemo(() => {
    if (!rows.length) return null;
    const valid = rows.filter((r) => Number.isFinite(Number(r.RMSE_mean)));
    if (!valid.length) return null;
    return [...valid].sort((a, b) => a.RMSE_mean - b.RMSE_mean)[0];
  }, [rows]);

  // Normalize bar widths for RMSE (lower is better). We invert so better looks longer.
  const rmseBars = useMemo(() => {
    if (!rows.length) return [];
    const vals = rows.map((r) => Number(r.RMSE_mean)).filter((x) => Number.isFinite(x));
    if (!vals.length) return [];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const denom = Math.max(1e-9, max - min);

    return rows.map((r) => {
      const v = Number(r.RMSE_mean);
      const score = Number.isFinite(v) ? 1 - (v - min) / denom : 0;
      const widthPct = clamp01(score) * 100;
      return { model: r.model, widthPct };
    });
  }, [rows]);

  const t = data?.rf_vs_baseline_t;
  const p = data?.rf_vs_baseline_p;

  const holdoutSplitsLabel = useMemo(() => {
    const s = Number(data?.n_splits ?? nSplits);
    return Number.isFinite(s) ? s : nSplits;
  }, [data, nSplits]);

  // ✅ NEW: tuning summary (from /analysis/ml)
  const tuning = ml?.model_selection?.tuning;

  const bestTuned = useMemo(() => {
    if (!tuning) return null;
    const candidates = [
      { name: "Ridge", rmse: tuning.ridge?.best_rmse ?? Infinity },
      { name: "RandomForest", rmse: tuning.random_forest?.best_rmse ?? Infinity },
      { name: "GradientBoosting", rmse: tuning.gradient_boosting?.best_rmse ?? Infinity },
    ].filter((x) => Number.isFinite(x.rmse));
    if (!candidates.length) return null;
    return candidates.sort((a, b) => a.rmse - b.rmse)[0];
  }, [tuning]);

  const selectedFeatures = useMemo(() => {
    // prefer the *actual* tuning features list (what the tuned models used)
    const fromTuning = tuning?.features_used;
    if (Array.isArray(fromTuning) && fromTuning.length) return fromTuning;

    // fallback to your selection stages if needed
    const kbest = ml?.feature_selection?.select_k_best?.selected;
    if (Array.isArray(kbest) && kbest.length) return kbest;

    const rfe = ml?.feature_selection?.rfe?.selected;
    if (Array.isArray(rfe) && rfe.length) return rfe;

    return [];
  }, [tuning, ml]);

  return (
    <section className="card">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 className="h1">Model Performance (Baseline vs ML)</h1>
          <p className="muted" style={{ fontSize: 14 }}>
            This page proves the model was <strong>tested</strong> (not chosen by default). We show:
            <strong> (A) holdout evaluation</strong> across seasons and <strong>(B) tuning evidence</strong> from
            Statistical Analysis (features + best hyperparameters).
          </p>
          <p className="muted" style={{ fontSize: 13 }}>
            <strong>Holdout</strong> answers: “Does it generalize to unseen seasons?” <br />
            <strong>Tuning</strong> answers: “Did we systematically search for good settings/features?”
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn" href="/context">
            Back: Context Simulator (AI)
          </Link>
          <Link className="btn" href="/statistical-analysis">
            Next: Statistical Analysis
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 13 }}>
            Holdout seasons (n_splits)
            <select
              className="input"
              style={{ width: 110, display: "inline-block", marginLeft: 8 }}
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

          <button className="btn" type="button" onClick={loadAll} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {bestModel ? (
          <span className="badge blue">
            Best holdout (lowest RMSE): {bestModel.model} ({fmt(bestModel.RMSE_mean, 3)})
          </span>
        ) : (
          <span className="badge">Best model: —</span>
        )}
      </div>

      {error ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}

      {/* ✅ NEW: Tuning evidence block (pulls from /analysis/ml) */}
      {!loading && tuning ? (
        <div style={{ marginTop: 14 }}>
          <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Tuning evidence (from Statistical Analysis)</h2>

          <div className="grid" style={{ marginTop: 10 }}>
            <div className="kpi">
              <div className="label">Tuning CV method</div>
              <div className="value" style={{ fontSize: 16, fontWeight: 800 }}>
                {tuning.cv}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Same grouping logic as analysis page (no season leakage).
              </div>
            </div>

            <div className="kpi">
              <div className="label">Features used in tuning</div>
              <div className="value">{selectedFeatures.length || "—"}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                This is the final feature set used for hyperparameter search.
              </div>
            </div>

            <div className="kpi">
              <div className="label">Best tuned model (lowest RMSE)</div>
              <div className="value" style={{ fontSize: 16, fontWeight: 800 }}>
                {bestTuned ? `${bestTuned.name} (${fmt(bestTuned.rmse, 4)})` : "—"}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Tuned RMSE is from the analysis endpoint (not holdout table below).
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Best RMSE (tuning)</th>
                  <th>Best Params</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Ridge</strong>
                  </td>
                  <td style={{ fontFamily: "var(--mono)" }}>{fmt(tuning.ridge.best_rmse, 4)}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>
                    alpha={fmt(tuning.ridge.best_params.alpha, 3)}
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>RandomForest</strong>
                  </td>
                  <td style={{ fontFamily: "var(--mono)" }}>{fmt(tuning.random_forest.best_rmse, 4)}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>
                    {JSON.stringify(tuning.random_forest.best_params)}
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>GradientBoosting</strong>
                  </td>
                  <td style={{ fontFamily: "var(--mono)" }}>{fmt(tuning.gradient_boosting.best_rmse, 4)}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>
                    {JSON.stringify(tuning.gradient_boosting.best_params)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: 13 }}>Show feature list used for tuning</summary>
            <pre
              style={{
                marginTop: 10,
                background: "rgba(15, 23, 42, 0.04)",
                padding: 12,
                borderRadius: 12,
                overflowX: "auto",
                fontSize: 12,
                border: "1px solid rgba(15, 23, 42, 0.08)",
                fontFamily: "var(--mono)",
              }}
            >
              {JSON.stringify(selectedFeatures, null, 2)}
            </pre>
          </details>

          <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            <strong>Important:</strong> tuning RMSE and holdout RMSE are different evaluations. Tuning finds good
            settings; holdout confirms generalization to unseen seasons.
          </p>
        </div>
      ) : null}

      {/* Quick KPI summary (holdout) */}
      {!loading && rows.length ? (
        <div className="grid" style={{ marginTop: 14 }}>
          <div className="kpi">
            <div className="label">Holdout evaluation</div>
            <div className="value" style={{ fontSize: 16, fontWeight: 800 }}>
              Season holdout
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              GroupKFold by season (prevents leakage)
            </div>
          </div>

          <div className="kpi">
            <div className="label">Holdout folds</div>
            <div className="value">{holdoutSplitsLabel}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              More splits = more repeated testing
            </div>
          </div>

          <div className="kpi">
            <div className="label">Decision rule (holdout)</div>
            <div className="value" style={{ fontSize: 16, fontWeight: 800 }}>
              Lowest RMSE
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Lower error = better predictions
            </div>
          </div>
        </div>
      ) : null}

      {/* RMSE comparison bars (holdout) */}
      {rows.length > 0 && !loading ? (
        <div style={{ marginTop: 14 }}>
          <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Holdout comparison (lower RMSE is better)</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Bars are scaled within this run. Hover the model name for mean ± std.
          </p>

          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {rmseBars.map((b) => {
              const row = rows.find((r) => r.model === b.model);
              const isBest = bestModel?.model === b.model;

              return (
                <div
                  key={b.model}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "200px 1fr 90px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 13 }}>
                    <strong title={`RMSE ${fmt(row?.RMSE_mean, 3)} ± ${fmt(row?.RMSE_std, 3)}`}>
                      {b.model}
                    </strong>
                    <div className="muted" style={{ fontSize: 11 }}>
                      RMSE {fmt(row?.RMSE_mean, 3)} ± {fmt(row?.RMSE_std, 3)}
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
                        width: `${b.widthPct}%`,
                        height: "100%",
                        background: isBest ? "rgba(29, 66, 138, 0.55)" : "rgba(15, 23, 42, 0.30)",
                      }}
                    />
                  </div>

                  <div style={{ fontFamily: "var(--mono)", fontSize: 12, textAlign: "right" }}>
                    {fmt(row?.RMSE_mean, 3)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Holdout metrics table */}
      {rows.length > 0 && !loading ? (
        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Holdout metrics table</h2>

          <table className="table">
            <thead>
              <tr>
                <th>Model</th>
                <th>RMSE (mean ± std)</th>
                <th>MAE (mean ± std)</th>
                <th>R² (mean ± std)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isBest = bestModel?.model === r.model;
                return (
                  <tr key={r.model}>
                    <td>
                      <strong>{r.model}</strong>{" "}
                      {isBest ? <span className="badge blue" style={{ marginLeft: 8 }}>best</span> : null}
                    </td>
                    <td>
                      {fmt(r.RMSE_mean, 3)} ± {fmt(r.RMSE_std, 3)}
                    </td>
                    <td>
                      {fmt(r.MAE_mean, 3)} ± {fmt(r.MAE_std, 3)}
                    </td>
                    <td>
                      {fmt(r.R2_mean, 3)} ± {fmt(r.R2_std, 3)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            <strong>Interpretation:</strong> RMSE/MAE measure prediction error (lower is better). R² measures how much
            variance the model explains (higher is better). Std shows stability across holdout seasons.
          </p>
        </div>
      ) : null}

      {/* Optional statistical test */}
      {!loading && data ? (
        <div style={{ marginTop: 14 }}>
          <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Statistical comparison</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            If enabled in the backend, we compute a paired t-test comparing RMSE across holdout seasons{" "}
            .
          </p>
          <p className="muted" style={{ fontSize: 13 }}>
            t-stat: <strong>{fmt(t, 3)}</strong> &nbsp; | &nbsp; p-value: <strong>{fmtP(p)}</strong>
          </p>
          <p className="muted" style={{ fontSize: 12 }}>
            If p-value is “—”, SciPy may not be installed or there were not enough folds to run the test.
          </p>
        </div>
      ) : null}

      {/* Pipeline + architecture details */}
      <div style={{ marginTop: 14 }}>
        <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Pipeline + architecture (what runs where)</h2>

        <div className="grid" style={{ marginTop: 10 }}>
          <div className="kpi">
            <div className="label">
              <strong style={{ color: "rgba(15,23,42,0.9)" }}>Frontend (Next.js)</strong>
            </div>
            <ul className="muted" style={{ fontSize: 13, paddingLeft: 18, marginTop: 10 }}>
              <li>Data Explorer: view dataset + columns used</li>
              <li>Matchup (Baseline): explainable baseline scoring</li>
              <li>Context Simulator (AI): ML-based context adjustments</li>
              <li>Model Performance: holdout testing metrics (this page)</li>
              <li>Statistical Analysis: EDA + correlations + feature/model selection</li>
            </ul>
          </div>

          <div className="kpi">
            <div className="label">
              <strong style={{ color: "rgba(15,23,42,0.9)" }}>Backend (FastAPI services)</strong>
            </div>
            <ul className="muted" style={{ fontSize: 13, paddingLeft: 18, marginTop: 10 }}>
              <li>/metrics/baseline-vs-ml (holdout metrics per model)</li>
              <li>/analysis/ml (EDA, correlations, feature selection, tuning)</li>
              <li>/pipeline/info (data source + preprocessing summary)</li>
            </ul>
          </div>

          <div className="kpi">
            <div className="label">
              <strong style={{ color: "rgba(15,23,42,0.9)" }}>Data + preprocessing</strong>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
              {pipeline?.dataSource ? pipeline.dataSource : "Data source not loaded (backend may be offline)."}
            </p>
            <ul className="muted" style={{ fontSize: 13, paddingLeft: 18, marginTop: 8 }}>
              {(pipeline?.cleaning_and_aggregation ?? [
                "Aggregate player rows into team-level rows (possession-weighted).",
                "Recompute team usage % to avoid double-counting (POSS_PCT).",
                "Add reliability weights (shrinkage) to reduce noise from small sample sizes.",
              ]).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          <strong>Why this matters:</strong> reviewers can trace the performance numbers back to (1) the dataset,
          (2) the preprocessing steps, and (3) the exact endpoints used to compute metrics.
        </p>
      </div>

      {/* Practical defense script hints */}
      <div style={{ marginTop: 14 }}>
        <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Defending the ML choice</h2>
        <ol className="muted" style={{ fontSize: 13, paddingLeft: 18 }}>
          <li>“We compared a trivial baseline vs multiple ML models — not a single default.”</li>
          <li>“We tested using season holdout (GroupKFold by season) to avoid leakage.”</li>
          <li>“We tuned hyperparameters/features and show that evidence (tuning table above).”</li>
          <li>“We select by lowest RMSE and deploy ML where it adds value (Context Simulator).”</li>
        </ol>
      </div>
    </section>
  );
}
