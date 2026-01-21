// app/page.tsx
//
// Home page (non-basketball + non-technical).
//
// Updated goals:
// - Stronger branding (NBA Play Ranker)
// - Easier to scan (single-column, higher contrast, clear CTAs)
// - NBA accent styling via badges + buttons (no extra libraries)
// - Still committee-friendly: plain English, clear demo flow, clear AI vs baseline split
//
// NOTE: Server component (no hooks).

import Link from "next/link";

export default function Page() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* HERO */}
      <section className="card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <span className="badge blue">NBA-themed</span>
          <span className="badge">Explainable Baseline</span>
          <span className="badge red">AI Context Simulator</span>
        </div>

        <h1 className="h1" style={{ marginTop: 10 }}>
          NBA Play Ranker
        </h1>

        <p className="muted" style={{ fontSize: 14, maxWidth: 900 }}>
          This capstone is a <strong>decision-support</strong> web app. It helps a coach or analyst quickly answer:
          <br />
          <strong>“Which offensive play types should we prioritize against this opponent?”</strong>
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          <Link className="btn primary" href="/data-explorer">
            Start Demo (Data Explorer)
          </Link>
          <Link className="btn" href="/matchup">
            Baseline Recommender
          </Link>
          <Link className="btn" href="/context">
            AI Context Simulator
          </Link>
          <Link className="btn" href="/model-metrics">
            Model Performance
          </Link>
        </div>

        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span className="pill">Transparent math</span>
          <span className="pill">ML predictions</span>
          <span className="pill">Context adjustments</span>
          <span className="pill">Traceable outputs</span>
          <span className="pill">Exportable dataset</span>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
          You do <strong>not</strong> need basketball knowledge to evaluate this project.
          Think of “play types” as categories of actions (like “pick-and-roll”, “spot-up”).
          The app returns a ranked list plus the reasoning fields so nothing is “magic.”
        </p>
      </section>

      {/* PROBLEM + VALUE */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>What real problem does this solve?</h2>
        <p className="muted" style={{ fontSize: 14 }}>
          Coaches and analysts have lots of stats, but during games they need a fast, defensible way to narrow down
          options for a specific opponent. This tool turns historical play-type data into a ranked list that is:
        </p>

        <ul className="muted" style={{ fontSize: 14, paddingLeft: 20, marginTop: 10 }}>
          <li>
            <strong>Explainable</strong> (baseline model shows the math and “why”)
          </li>
          <li>
            <strong>Data-driven</strong> (all outputs trace back to the dataset)
          </li>
          <li>
            <strong>Context-aware</strong> (AI/ML + game state changes priorities)
          </li>
          <li>
            <strong>Reproducible</strong> (model metrics + statistical analysis pages show evidence)
          </li>
        </ul>
      </section>

      {/* DEMO FLOW */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Demo flow (click in this order)</h2>

        <ol className="muted" style={{ fontSize: 14, paddingLeft: 20, marginTop: 10 }}>
          <li style={{ marginBottom: 8 }}>
            <Link href="/data-explorer">
              <strong>Data Explorer</strong>
            </Link>{" "}
            — Preview the cleaned team-level dataset used by the models, filter it, and export CSV.
          </li>
          <li style={{ marginBottom: 8 }}>
            <Link href="/matchup">
              <strong>Matchup (Baseline)</strong>
            </Link>{" "}
            — Generates Top-K recommendations using an explainable formula and shows the breakdown.
          </li>
          <li style={{ marginBottom: 8 }}>
            <Link href="/context">
              <strong>Context Simulator (AI)</strong>
            </Link>{" "}
            — Uses ML predictions + game context (score/time) to adjust the ranking and shows what changed.
          </li>
          <li style={{ marginBottom: 8 }}>
            <Link href="/model-metrics">
              <strong>Model Performance</strong>
            </Link>{" "}
            — Seasonal holdout evaluation comparing baseline vs ML (defends model choice).
          </li>
          <li>
            <Link href="/statistical-analysis">
              <strong>Statistical Analysis</strong>
            </Link>{" "}
            — Correlation/heatmaps + feature selection + model selection evidence (defense justification).
          </li>
        </ol>

        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link className="btn primary" href="/data-explorer">
            Run the demo now
          </Link>
          <Link className="btn" href="/glossary">
            Open glossary
          </Link>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
          <strong>What reviewers should observe:</strong> Every recommender page returns both the ranking and the
          reasoning fields (formula inputs, shrinkage weights, and context adjustments).
        </p>
      </section>

      {/* WHY AI */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Where AI is used (and why it’s needed)</h2>

        <p className="muted" style={{ fontSize: 14 }}>
          The project intentionally separates two layers so the AI use case is obvious and defensible:
        </p>

        <ul className="muted" style={{ fontSize: 14, paddingLeft: 20, marginTop: 10 }}>
          <li style={{ marginBottom: 8 }}>
            <strong>Baseline recommender</strong>: purely statistical + explainable. It blends our historical
            efficiency with what the opponent typically allows, with shrinkage to reduce small-sample noise.
          </li>
          <li>
            <strong>Context + ML recommender</strong>: replaces historical offense efficiency with an ML-predicted
            efficiency and applies small, transparent adjustments for game context (late game, trailing/leading).
          </li>
        </ul>

        <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
          This makes it clear which use cases require AI: the <strong>Context Simulator</strong> is the AI use case,
          while the baseline page remains the explainable reference.
        </p>
      </section>

      {/* ARCHITECTURE */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>System architecture (high level)</h2>

        <p className="muted" style={{ fontSize: 14 }}>
          The app is a standard web architecture: a Next.js UI calling a FastAPI backend.
          The backend loads the dataset once (cached in memory per server worker) and exposes endpoints for
          data preview/export, recommendations, and model evaluation.
        </p>

        <pre
          style={{
            background: "rgba(15, 23, 42, 0.04)",
            padding: 12,
            borderRadius: 12,
            overflowX: "auto",
            fontSize: 13,
            marginTop: 12,
            border: "1px solid rgba(15, 23, 42, 0.08)",
          }}
        >
{`Next.js UI (pages)
  ├─ Data Explorer  → GET /data/team-playtypes (+ CSV export)
  ├─ Baseline       → GET /rank-plays/baseline (+ breakdown fields)
  ├─ Context + ML   → GET /rank-plays/context-ml (+ context deltas)
  ├─ Metrics        → GET /metrics/baseline-vs-ml (season holdout)
  └─ Stats Analysis → GET /analysis/ml (EDA + feature/model selection evidence)

FastAPI Backend
  ├─ Loads Synergy snapshot CSV (startup)
  ├─ Aggregates to team-level play-type table
  ├─ Baseline recommender (shrinkage + blend vs opponent)
  ├─ ML predictions (precomputed CSV) for AI page
  ├─ Evaluation (RMSE/MAE/R²) for defense justification
  └─ Statistical analysis endpoints for transparency`}
        </pre>

        <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
          This architecture supports multiple users because requests are stateless, while heavy data/model loading is
          cached at server startup (per worker).
        </p>
      </section>

      {/* REVIEW ARTEFACTS *
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Project artefacts (for review)</h2>

        <p className="muted" style={{ fontSize: 14 }}>
          In your final submission package, ensure these are included/linked clearly:
        </p>

        <ul className="muted" style={{ fontSize: 14, paddingLeft: 20, marginTop: 10 }}>
          <li>GitHub repository (code)</li>
          <li>Jira board (iterations, backlog comments, links to VP/code commits)</li>
          <li>Visual Paradigm diagrams (requirements, sequence, domain model, architecture)</li>
          <li>Dataset description + pipeline notes (see Data Explorer / Model Performance / Statistical Analysis)</li>
        </ul>

        <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
          Tip: Put those links on this page (or the footer) before you re-defend so reviewers can access them quickly.
        </p>
      </section>
      */}
    </div>
  );
}
