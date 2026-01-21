// app/page.js
//
// Home page (committee-friendly).
//
// Requirements addressed:
// - Replace old tiles/squares with short descriptions of each page.
// - Remove “how to demo” and unnecessary filler.
// - Explain the real-world problem for NON-basketball reviewers.
// - Make the “AI use case” explicit and defensible.
//
// This page is intentionally short and readable: it tells reviewers where to click next.

import Link from "next/link";

const PAGES = [
  {
    title: "Data Explorer",
    href: "/data-explorer",
    desc:
      "Preview the cleaned, team-level dataset used by the system. Filter by season/team/play type and export raw CSV for analysis.",
    tag: "Raw data + transparency",
  },
  {
    title: "Matchup (Baseline)",
    href: "/matchup",
    desc:
      "Explainable recommendations: ranks play types using our offense + opponent defense, stabilized using shrinkage to avoid small-sample noise.",
    tag: "No AI — fully explainable",
  },
  {
    title: "Context Simulator (AI)",
    href: "/context",
    desc:
      "AI use case: ML predicts offense efficiency and applies small, transparent adjustments based on game context (score/time).",
    tag: "AI model + context",
  },
  {
    title: "Model Performance",
    href: "/model-metrics",
    desc:
      "Shows testing evidence: season-holdout metrics (RMSE/MAE/R²) comparing baseline vs ML models, plus optional statistical comparison.",
    tag: "Evaluation + defense proof",
  },
  {
    title: "Glossary",
    href: "/glossary",
    desc:
      "Plain-English definitions so the app is reviewable even if you don’t follow basketball terminology.",
    tag: "Non-basketball friendly",
  },
];

export default function Home() {
  return (
    <section className="card">
      <h1 className="h1">Basketball Strategy Decision Support</h1>

      <p className="muted" style={{ marginTop: 10 }}>
        This prototype helps a coaching or analytics staff decide{" "}
        <strong>which offensive play types to prioritize</strong> against a specific opponent.
        The core problem is a real decision-support problem:
        teams have a lot of data, but limited time to convert it into actionable guidance.
      </p>

      <div style={{ marginTop: 14 }}>
        <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>What makes this a CS capstone?</h2>
        <ul className="muted" style={{ fontSize: 13, paddingLeft: 18, margin: 0 }}>
          <li>
            A reproducible data pipeline: player-level Synergy rows are aggregated into team-level play-type features.
          </li>
          <li>
            Two recommendation approaches: an explainable baseline and an AI-assisted context simulator.
          </li>
          <li>
            Model evaluation: season-holdout testing with standard regression metrics to justify model choice.
          </li>
          <li>
            Service-oriented architecture: Next.js frontend + FastAPI backend with cached model/data for multi-user access.
          </li>
        </ul>
      </div>

      <div style={{ marginTop: 14 }}>
        <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Where to start</h2>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Start with <Link href="/data-explorer">Data Explorer</Link> to see the dataset and export it.
          Then compare <Link href="/matchup">Baseline</Link> vs <Link href="/context">AI Context</Link>,
          and verify evidence on <Link href="/model-metrics">Model Performance</Link>.
        </p>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {PAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 16,
                padding: 14,
                background: "rgba(255,255,255,0.65)",
                boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>{p.title}</h3>
                <span className="badge">{p.tag}</span>
              </div>
              <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                {p.desc}
              </p>
              <div style={{ marginTop: 10 }}>
                <span className="btn">Open</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>One-sentence problem statement</h2>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Teams need a repeatable way to convert play-type data into recommendations for a specific matchup,
          and a controlled way to explore “what if” game contexts without relying only on intuition.
        </p>
      </div>
    </section>
  );
}
