// app/page.tsx
//
// Home page (NBA-branded, “finished product” feel) reflecting the FULL updated project.
//
// Covers:
// - Dataset1 (Synergy play types): baseline + context-ML recommender + SportyPy visuals
// - Dataset2 (NBA play-by-play shots): shot explorer + shot plan + shot heatmap + shot metrics/analysis
// - Final combined experience: “Gameplan” (best plays + best shot plan + visuals + PDF-ready narrative)
//
// NOTE: Server Component (no hooks).

import Link from "next/link";

export default function Page() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Page-only styles (no extra libs, no hooks) */}
      <style>{`
        .heroWrap {
          position: relative;
          overflow: hidden;
          border-radius: 18px;
          isolation: isolate;
        }
        .heroBg {
          position: absolute;
          inset: 0;
          z-index: 0;
          background:
            radial-gradient(1200px 600px at 10% 10%, rgba(59,130,246,0.22), transparent 60%),
            radial-gradient(900px 500px at 90% 15%, rgba(239,68,68,0.18), transparent 55%),
            radial-gradient(900px 700px at 50% 100%, rgba(16,185,129,0.14), transparent 55%),
            linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0.04));
        }
        .heroNoise {
          position: absolute;
          inset: 0;
          z-index: 1;
          opacity: 0.16;
          background-image:
            repeating-linear-gradient(
              0deg,
              rgba(15,23,42,0.08) 0px,
              rgba(15,23,42,0.08) 1px,
              transparent 1px,
              transparent 6px
            );
          mix-blend-mode: multiply;
          pointer-events: none;
        }
        .heroGlow {
          position: absolute;
          inset: -40%;
          z-index: 2;
          background:
            conic-gradient(from 180deg at 50% 50%,
              rgba(59,130,246,0.0),
              rgba(59,130,246,0.22),
              rgba(239,68,68,0.18),
              rgba(16,185,129,0.16),
              rgba(59,130,246,0.0)
            );
          filter: blur(28px);
          opacity: 0.55;
          animation: heroSpin 18s linear infinite;
          pointer-events: none;
        }
        @keyframes heroSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .heroContent { position: relative; z-index: 3; }
        .kickerRow { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
        .heroTitleRow { display: grid; gap: 10px; margin-top: 12px; }

        .subheadline {
          color: rgba(15, 23, 42, 0.78);
          font-size: 14px;
          line-height: 1.55;
          max-width: 980px;
        }

        .ctaRow { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
        .microRow { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }

        .grid2 { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 980px) { .grid2 { grid-template-columns: 1.15fr 0.85fr; } }

        .grid3 { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 980px) { .grid3 { grid-template-columns: repeat(3, 1fr); } }

        .featureGrid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 10px; }
        @media (min-width: 820px) { .featureGrid { grid-template-columns: repeat(3, 1fr); } }

        .cardLite {
          border: 1px solid rgba(15,23,42,0.08);
          border-radius: 16px;
          padding: 12px;
          background: rgba(255,255,255,0.72);
          box-shadow: 0 1px 0 rgba(15,23,42,0.04);
        }

        .featureTop { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
        .featureTitle { font-weight: 800; font-size: 14px; color: rgba(15,23,42,0.92); margin: 0; }
        .featureDesc { font-size: 13px; color: rgba(15,23,42,0.72); margin: 0; line-height: 1.45; }

        .miniTag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(15,23,42,0.03);
          color: rgba(15,23,42,0.75);
          white-space: nowrap;
        }
        .miniTag.blue { border-color: rgba(59,130,246,0.25); background: rgba(59,130,246,0.08); }
        .miniTag.red { border-color: rgba(239,68,68,0.25); background: rgba(239,68,68,0.08); }
        .miniTag.green { border-color: rgba(16,185,129,0.25); background: rgba(16,185,129,0.08); }

        .callout {
          border-radius: 16px;
          padding: 12px;
          border: 1px solid rgba(15,23,42,0.08);
          background:
            radial-gradient(600px 220px at 20% 0%, rgba(59,130,246,0.14), transparent 60%),
            radial-gradient(520px 200px at 90% 10%, rgba(239,68,68,0.12), transparent 55%),
            rgba(255,255,255,0.70);
        }

        .demoTrack { display: grid; gap: 10px; margin-top: 10px; }
        .stepRow {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 10px;
          padding: 10px;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,0.08);
          background: rgba(255,255,255,0.70);
        }
        .stepNum {
          height: 32px;
          width: 32px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-weight: 900;
          font-size: 13px;
          color: rgba(15,23,42,0.85);
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.20);
          margin-top: 2px;
        }
        .stepTitle { margin: 0; font-weight: 900; font-size: 14px; color: rgba(15,23,42,0.92); }
        .stepText { margin: 4px 0 0 0; font-size: 13px; color: rgba(15,23,42,0.72); line-height: 1.45; }

        .split { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 10px; }
        @media (min-width: 980px) { .split { grid-template-columns: 1fr 1fr; } }

        .splitCard {
          border-radius: 16px;
          padding: 12px;
          border: 1px solid rgba(15,23,42,0.08);
          background: rgba(255,255,255,0.70);
        }
        .splitHead { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
        .splitTitle { margin: 0; font-weight: 900; font-size: 14px; color: rgba(15,23,42,0.92); }
        .splitBody { margin: 0; font-size: 13px; color: rgba(15,23,42,0.72); line-height: 1.5; }
        .splitList { margin: 10px 0 0 0; padding-left: 18px; color: rgba(15,23,42,0.72); font-size: 13px; line-height: 1.55; }

        .footerCTA {
          position: relative;
          overflow: hidden;
          border-radius: 18px;
          border: 1px solid rgba(15,23,42,0.08);
          background:
            radial-gradient(800px 380px at 15% 15%, rgba(59,130,246,0.18), transparent 60%),
            radial-gradient(700px 300px at 90% 30%, rgba(239,68,68,0.14), transparent 55%),
            rgba(255,255,255,0.72);
          padding: 14px;
        }
        .footerCTA h2 { margin: 0; font-size: 18px; }
      `}</style>

      {/* HERO */}
      <section className="card heroWrap">
        <div className="heroBg" aria-hidden="true" />
        <div className="heroNoise" aria-hidden="true" />
        <div className="heroGlow" aria-hidden="true" />

        <div className="heroContent">
          <div className="kickerRow">
            <span className="badge blue">NBA Play Ranker</span>
            <span className="badge">Gameplan Builder</span>
            <span className="badge red">AI Context Simulator</span>
            <span className="badge">Shots + Heatmaps</span>
            <span className="badge">PDF-ready</span>
          </div>

          <div className="heroTitleRow">
            <h1 className="h1" style={{ margin: 0, letterSpacing: "-0.02em" }}>
              A complete NBA gameplan — plays + shots — in one flow.
            </h1>

            <p className="subheadline">
              This capstone is a decision-support web app that recommends <strong>best offensive play types</strong>{" "}
              and a <strong>best shot plan</strong> for a specific opponent. It includes baseline explainability, an AI
              context simulator (late-game scenarios), real visualizations (play zones + shot heatmaps), and
              defense-friendly evidence pages.
            </p>
          </div>

          <div className="ctaRow">
            <Link className="btn primary" href="/gameplan">
              Open Gameplan (Full Experience)
            </Link>
            <Link className="btn" href="/matchup">
              Plays: Baseline
            </Link>
            <Link className="btn" href="/context">
              Plays: AI Context
            </Link>
            <Link className="btn" href="/shot-plan">
              Shot Plan
            </Link>
            <Link className="btn" href="/shot-heatmap">
              Shot Heatmap
            </Link>
          </div>

          <div className="microRow">
            <span className="pill">Two datasets</span>
            <span className="pill">Explainable + traceable</span>
            <span className="pill">Context simulation</span>
            <span className="pill">Visual decision support</span>
            <span className="pill">Export-friendly</span>
          </div>

          <p className="muted" style={{ marginTop: 12, fontSize: 14, maxWidth: 980 }}>
            You don’t need basketball knowledge to evaluate this project. Think of “play types” as categories of
            actions, and the “shot plan” as recommended shot types/zones based on historical play-by-play data. The app
            always returns reasoning fields so results can be verified.
          </p>
        </div>
      </section>

      {/* FULL PROJECT OVERVIEW (2-column) */}
      <section className="card">
        <div className="grid2">
          <div>
            <h2 style={{ marginTop: 0 }}>What the finished product does</h2>
            <p className="muted" style={{ fontSize: 14 }}>
              Coaches and analysts need speed <em>and</em> trust. This tool turns historical performance into a plan
              that is easy to scan, easy to justify, and consistent with a real coaching workflow.
            </p>

            <div className="featureGrid">
              <div className="cardLite">
                <div className="featureTop">
                  <p className="featureTitle">Plays (Dataset1)</p>
                  <span className="miniTag blue">Synergy play types</span>
                </div>
                <p className="featureDesc">
                  Baseline + AI-context ranking of offensive play types vs a chosen opponent — with “why” fields.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  <Link className="btn" href="/matchup">
                    Baseline
                  </Link>
                  <Link className="btn" href="/context">
                    AI Context
                  </Link>
                  <Link className="btn" href="/data-explorer">
                    Data Explorer
                  </Link>
                </div>
              </div>

              <div className="cardLite">
                <div className="featureTop">
                  <p className="featureTitle">Shots (Dataset2)</p>
                  <span className="miniTag green">NBA play-by-play</span>
                </div>
                <p className="featureDesc">
                  Shot selection + zones based on historical shots — explore the data, build a shot plan, view heatmaps.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  <Link className="btn" href="/shot-explorer">
                    Shot Explorer
                  </Link>
                  <Link className="btn" href="/shot-plan">
                    Shot Plan
                  </Link>
                  <Link className="btn" href="/shot-heatmap">
                    Heatmap
                  </Link>
                </div>
              </div>

              <div className="cardLite">
                <div className="featureTop">
                  <p className="featureTitle">Gameplan (Combined)</p>
                  <span className="miniTag red">wow flow</span>
                </div>
                <p className="featureDesc">
                  The “final experience”: best plays + best shot plan + visuals in one place — built for real decision-making.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  <Link className="btn primary" href="/gameplan">
                    Open Gameplan
                  </Link>
                  <Link className="btn" href="/glossary">
                    Glossary
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="callout">
            <h2 style={{ marginTop: 0 }}>Best “wow” first impression</h2>
            <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
              Start with the combined Gameplan, then drill down into plays and shots for evidence and deeper analysis.
            </p>

            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <Link className="btn primary" href="/gameplan">
                Launch Gameplan
              </Link>
              <Link className="btn" href="/matchup">
                Compare Plays (Baseline)
              </Link>
              <Link className="btn" href="/context">
                Compare Plays (AI Context)
              </Link>
              <Link className="btn" href="/shot-plan">
                Build Shot Plan
              </Link>
            </div>

            <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
              Reviewers should notice: rankings are paired with reasoning fields, and the AI layer is clearly separated
              from the baseline reference.
            </p>
          </div>
        </div>
      </section>

      {/* DEMO FLOW (3 tracks) */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Demo flow (pick a track)</h2>
        <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
          All tracks end in evidence pages (metrics + statistical analysis) for a strong defense.
        </p>

        <div className="grid3" style={{ marginTop: 10 }}>
          {/* Track A */}
          <div className="cardLite">
            <div className="featureTop">
              <p className="featureTitle">Track A: Full Gameplan</p>
              <span className="miniTag red">best for wow</span>
            </div>
            <div className="demoTrack">
              <div className="stepRow">
                <div className="stepNum">1</div>
                <div>
                  <p className="stepTitle">
                    <Link href="/gameplan">Gameplan</Link>
                  </p>
                  <p className="stepText">Best plays + best shot plan + visuals in one experience.</p>
                </div>
              </div>
              <div className="stepRow">
                <div className="stepNum">2</div>
                <div>
                  <p className="stepTitle">
                    <Link href="/model-metrics">Model Performance</Link>
                  </p>
                  <p className="stepText">Baseline vs ML evaluation (defends your AI choice).</p>
                </div>
              </div>
              <div className="stepRow">
                <div className="stepNum">3</div>
                <div>
                  <p className="stepTitle">
                    <Link href="/shot-model-metrics">Shot Metrics</Link>
                  </p>
                  <p className="stepText">Evidence for Dataset2 modeling/aggregation choices.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Track B */}
          <div className="cardLite">
            <div className="featureTop">
              <p className="featureTitle">Track B: Plays (Dataset1)</p>
              <span className="miniTag blue">explainable + AI</span>
            </div>
            <div className="demoTrack">
              <div className="stepRow">
                <div className="stepNum">1</div>
                <div>
                  <p className="stepTitle">
                    <Link href="/data-explorer">Data Explorer</Link>
                  </p>
                  <p className="stepText">See the cleaned play-type dataset and export CSV.</p>
                </div>
              </div>
              <div className="stepRow">
                <div className="stepNum">2</div>
                <div>
                  <p className="stepTitle">
                    <Link href="/matchup">Baseline</Link>
                  </p>
                  <p className="stepText">Transparent ranking + breakdown fields.</p>
                </div>
              </div>
              <div className="stepRow">
                <div className="stepNum">3</div>
                <div>
                  <p className="stepTitle">
                    <Link href="/context">AI Context</Link>
                  </p>
                  <p className="stepText">Context adjustments + “what changed” deltas.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Track C */}
          <div className="cardLite">
            <div className="featureTop">
              <p className="featureTitle">Track C: Shots (Dataset2)</p>
              <span className="miniTag green">heatmap-ready</span>
            </div>
            <div className="demoTrack">
              <div className="stepRow">
                <div className="stepNum">1</div>
                <div>
                  <p className="stepTitle">
                    <Link href="/shot-explorer">Shot Explorer</Link>
                  </p>
                  <p className="stepText">Preview the shot dataset and how it’s aggregated.</p>
                </div>
              </div>
              <div className="stepRow">
                <div className="stepNum">2</div>
                <div>
                  <p className="stepTitle">
                    <Link href="/shot-plan">Shot Plan</Link>
                  </p>
                  <p className="stepText">Recommended shot types/zones (optionally by shooter).</p>
                </div>
              </div>
              <div className="stepRow">
                <div className="stepNum">3</div>
                <div>
                  <p className="stepTitle">
                    <Link href="/shot-heatmap">Shot Heatmap</Link>
                  </p>
                  <p className="stepText">Visual decision support: where to generate offense.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          <Link className="btn primary" href="/gameplan">
            Start with Gameplan
          </Link>
          <Link className="btn" href="/matchup">
            Plays (Baseline)
          </Link>
          <Link className="btn" href="/shot-plan">
            Shots (Plan)
          </Link>
          <Link className="btn" href="/glossary">
            Glossary
          </Link>
        </div>
      </section>

      {/* AI SPLIT (defensible) */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Where AI is used (and why it’s defensible)</h2>
        <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
          The project separates two layers so the AI use case is obvious: baseline for trust, AI for scenario planning.
        </p>

        <div className="split">
          <div className="splitCard">
            <div className="splitHead">
              <p className="splitTitle">Baseline Recommender (Plays)</p>
              <span className="badge">Explainable</span>
            </div>
            <p className="splitBody">
              Purely statistical + transparent. Blends historical offense efficiency with what the opponent allows,
              using shrinkage to reduce small-sample noise.
            </p>
            <ul className="splitList">
              <li>Clear inputs and weights</li>
              <li>Stable “reference” ranking</li>
              <li>Great for verification + trust</li>
            </ul>
            <div style={{ marginTop: 10 }}>
              <Link className="btn" href="/matchup">
                Open Baseline
              </Link>
            </div>
          </div>

          <div className="splitCard">
            <div className="splitHead">
              <p className="splitTitle">AI Context Simulator (Plays)</p>
              <span className="badge red">AI</span>
            </div>
            <p className="splitBody">
              Replaces historical efficiency with ML-predicted efficiency, then applies small, transparent adjustments
              for context (late game, trailing/leading) and shows deltas.
            </p>
            <ul className="splitList">
              <li>Shows context deltas (what changed)</li>
              <li>Better for scenario planning</li>
              <li>Still traceable outputs</li>
            </ul>
            <div style={{ marginTop: 10 }}>
              <Link className="btn" href="/context">
                Open AI Simulator
              </Link>
            </div>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 10, fontSize: 14 }}>
          The shots module (Dataset2) is also data-driven and evidence-backed via its own explorer, heatmaps, and metrics pages.
        </p>
      </section>

      {/* EVIDENCE */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Evidence & transparency</h2>
        <p className="muted" style={{ fontSize: 14 }}>
          Reviewers can validate the project through metrics and statistical analysis pages for both modules.
        </p>

        <div className="featureGrid">
          <div className="cardLite">
            <div className="featureTop">
              <p className="featureTitle">Plays: Model Performance</p>
              <span className="miniTag blue">baseline vs ML</span>
            </div>
            <p className="featureDesc">Seasonal holdout evaluation (RMSE/MAE/R²) for defendable model selection.</p>
            <div style={{ marginTop: 10 }}>
              <Link className="btn" href="/model-metrics">
                Open
              </Link>
              <Link className="btn" href="/statistical-analysis" style={{ marginLeft: 8 }}>
                Stats Analysis
              </Link>
            </div>
          </div>

          <div className="cardLite">
            <div className="featureTop">
              <p className="featureTitle">Shots: Metrics</p>
              <span className="miniTag green">Dataset2 evidence</span>
            </div>
            <p className="featureDesc">Supports your aggregation/modeling decisions for the shot plan module.</p>
            <div style={{ marginTop: 10 }}>
              <Link className="btn" href="/shot-model-metrics">
                Open
              </Link>
              <Link className="btn" href="/shot-statistical-analysis" style={{ marginLeft: 8 }}>
                Stats Analysis
              </Link>
            </div>
          </div>

          <div className="cardLite">
            <div className="featureTop">
              <p className="featureTitle">Visual Decision Support</p>
              <span className="miniTag red">coach-friendly</span>
            </div>
            <p className="featureDesc">
              Play-type zones (SportyPy) and shot heatmaps make recommendations easier to act on during real workflows.
            </p>
            <div style={{ marginTop: 10 }}>
              <Link className="btn" href="/shot-heatmap">
                Shot Heatmap
              </Link>
              <Link className="btn" href="/gameplan" style={{ marginLeft: 8 }}>
                Gameplan View
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ARCHITECTURE (high level) */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>System architecture (high level)</h2>
        <p className="muted" style={{ fontSize: 14 }}>
          A standard web architecture: a Next.js UI calling a FastAPI backend. The backend loads and caches each dataset
          (per server worker), and exposes endpoints for preview/export, recommendations, shot planning, visuals, and evaluation.
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
{`Next.js UI (key experiences)
  ├─ Gameplan        → combined: plays + shot plan + visuals
  ├─ Plays (Dataset1)→ /data-explorer, /matchup, /context, /model-metrics, /statistical-analysis
  └─ Shots (Dataset2)→ /shot-explorer, /shot-plan, /shot-heatmap, /shot-model-metrics, /shot-statistical-analysis

FastAPI Backend (high-level)
  ├─ Loads Synergy play-type snapshot (Dataset1)
  ├─ Loads NBA play-by-play parquet (Dataset2) + cached aggregates
  ├─ Recommenders: baseline + context-ML (plays)
  ├─ Shot plan + heatmap aggregates (shots)
  ├─ Evaluation endpoints for both modules
  └─ Export-ready outputs (rankings + reasoning fields)`}
        </pre>

        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 800, color: "rgba(15,23,42,0.88)" }}>
            What reviewers should look for
          </summary>
          <ul className="muted" style={{ fontSize: 14, paddingLeft: 20, marginTop: 10, lineHeight: 1.6 }}>
            <li>
              Recommendations always include <strong>reasoning fields</strong> (inputs, weights, adjustments).
            </li>
            <li>
              Baseline vs AI are clearly separated (trust anchor + scenario tool).
            </li>
            <li>
              Shots module has its own explorer + visuals + evidence pages.
            </li>
            <li>
              The combined <strong>Gameplan</strong> experience demonstrates real product value.
            </li>
          </ul>
        </details>
      </section>

      {/* FINAL CTA */}
      <section className="footerCTA">
        <h2>Ready to run a full NBA gameplan demo?</h2>
        <p className="muted" style={{ fontSize: 14, marginTop: 8, maxWidth: 900 }}>
          Start with the Gameplan for the “wow” experience, then drill into plays and shots for deeper evidence.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          <Link className="btn primary" href="/gameplan">
            Start Gameplan
          </Link>
          <Link className="btn" href="/data-explorer">
            Plays Data
          </Link>
          <Link className="btn" href="/matchup">
            Plays Baseline
          </Link>
          <Link className="btn" href="/context">
            Plays AI
          </Link>
          <Link className="btn" href="/shot-plan">
            Shot Plan
          </Link>
          <Link className="btn" href="/shot-heatmap">
            Shot Heatmap
          </Link>
        </div>
      </section>
    </div>
  );
}
