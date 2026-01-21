// app/glossary/page.tsx
//
// Glossary (committee-friendly)
//
// Changes requested:
// - Remove “Quick terms you can reference while demoing the product”
// - Remove unnecessary project-name filler text
//
// What this page does now:
// - Gives plain-English definitions for all terms used in the UI.
// - Keeps it short, non-jargony, and reviewable by non-basketball committee members.

import Link from "next/link";

const TERMS: Array<{
  term: string;
  meaning: string;
  whyItMatters?: string;
}> = [
  {
    term: "Play Type",
    meaning:
      "A category of offensive action (example: pick-and-roll, transition, spot-up). The app ranks play types, not individual plays.",
    whyItMatters:
      "This is the unit of recommendation: we are deciding which categories of actions to prioritize vs an opponent.",
  },
  {
    term: "Possession (POSS)",
    meaning:
      "A single chance for a team to score. The dataset counts how many possessions each play type was used.",
    whyItMatters:
      "More possessions usually means the statistic is more reliable. Low sample sizes can be misleading.",
  },
  {
    term: "Usage % (POSS_PCT)",
    meaning:
      "How often a play type was used compared to the team’s total possessions (as a percentage).",
    whyItMatters:
      "It helps measure how common/familiar a play type is for that team, which is useful for context decisions.",
  },
  {
    term: "PPP (Points Per Possession)",
    meaning:
      "Average points scored per possession for a play type. Higher PPP means more efficient offense (or worse defense if shown on defense side).",
    whyItMatters:
      "PPP is the main efficiency metric used to rank play types.",
  },
  {
    term: "eFG% (Effective Field Goal %)",
    meaning:
      "A shooting efficiency measure that gives extra weight to three-pointers compared to two-pointers.",
    whyItMatters:
      "Used as an efficiency proxy in the context adjustments (e.g., when trailing late).",
  },
  {
    term: "TOV% (Turnover Rate)",
    meaning:
      "How often a possession ends in a turnover for a play type.",
    whyItMatters:
      "In late-game situations when leading, the context model penalizes turnover-prone options.",
  },
  {
    term: "Shrinkage",
    meaning:
      "A statistical technique that pulls extreme values toward the league average when there is limited data (low possessions).",
    whyItMatters:
      "Prevents overconfidence in play types with small samples. This makes the baseline recommender more defensible.",
  },
  {
    term: "Reliability Weight",
    meaning:
      "A 0–1 weight computed from possessions that controls how much we trust a team’s play type stats versus the league average.",
    whyItMatters:
      "Higher possessions → higher reliability → less shrinkage.",
  },
  {
    term: "Baseline Recommender",
    meaning:
      "An explainable model that blends our shrunk offensive PPP and the opponent’s shrunk defensive allowed PPP to produce a predicted PPP for each play type.",
    whyItMatters:
      "This is the transparent reference model. It is easy to defend and helps validate the AI page.",
  },
  {
    term: "Context + ML Recommender",
    meaning:
      "An AI use case that replaces historical offense PPP with an ML-predicted offense PPP, then applies small adjustments based on game context (score/time).",
    whyItMatters:
      "Demonstrates where AI adds value: adapting recommendations to specific game situations.",
  },
  {
    term: "Season Holdout Evaluation",
    meaning:
      "A testing method where the model is trained on earlier seasons and tested on later seasons.",
    whyItMatters:
      "Avoids testing on the same season used for training, and makes the evaluation closer to real-world use.",
  },
  {
    term: "RMSE / MAE / R²",
    meaning:
      "Standard regression metrics: RMSE and MAE measure prediction error (lower is better). R² measures explained variance (higher is better).",
    whyItMatters:
      "These metrics are used on the Model Performance page to defend model choice and show testing was done.",
  },
  {
    term: "Margin",
    meaning:
      "Our score minus opponent score. Negative means we are trailing, positive means we are leading.",
    whyItMatters:
      "Used by the context logic to adjust priorities (score vs protect).",
  },
  {
    term: "Period / Time Remaining",
    meaning:
      "Basic game context inputs: which quarter (or overtime) and how many seconds remain in the current period.",
    whyItMatters:
      "Used to apply a “late game factor” so context adjustments only matter when time is running out.",
  },
];

export default function GlossaryPage() {
  return (
    <section className="card">
      <h1 className="h1">Glossary</h1>
      <p className="muted">
        Plain-English definitions for terms used in the app.
      </p>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {TERMS.map((t) => (
          <div
            key={t.term}
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              padding: 12,
              background: "rgba(255,255,255,0.65)",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>{t.term}</h2>
              {t.whyItMatters ? <span className="badge">Why it matters</span> : null}
            </div>
            <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
              {t.meaning}
            </p>
            {t.whyItMatters ? (
              <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                <strong>Why it matters:</strong> {t.whyItMatters}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <Link className="btn" href="/model-metrics">
          Back: Model Performance
        </Link>
        <Link className="btn" href="/">
          Home
        </Link>
      </div>
    </section>
  );
}
