// app/page.tsx
//
// Home (wireframe-aligned, coach-friendly)
//
// Goals:
// - Match your wireframes: simple header strip + one big intro box + 3 primary tiles + 2 secondary tiles
// - Keep it feeling like a finished product (clean, clickable cards)
// - Keep all functionality (just navigation links; no hooks; server component)
// - Move ALL extra writing into a bottom “More info” collapsible
//
// NOTE: Server Component (no hooks).

import Link from "next/link";

export default function Page() {
  return (
    <main style={{ display: "grid", gap: 14 }}>
      <style>{`
        .wrap {
          max-width: 1100px;
          margin: 0 auto;
          padding: 16px;
        }

        /* Wireframe-style “screen” frame */
        .frame {
          border-radius: 18px;
          border: 1px solid rgba(15,23,42,0.12);
          background: rgba(255,255,255,0.78);
          overflow: hidden;
        }

        /* Top strip nav (visual only; actual nav is your real navbar) */
        .topStrip {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(15,23,42,0.10);
          background: rgba(15,23,42,0.02);
        }
        .topStrip a {
          text-decoration: none;
          color: rgba(15,23,42,0.82);
          font-size: 13px;
          font-weight: 800;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid transparent;
          background: rgba(255,255,255,0.65);
        }
        .topStrip a:hover {
          background: rgba(255,255,255,0.95);
          border-color: rgba(15,23,42,0.10);
        }

        /* Big intro box */
        .heroBox {
          margin: 14px;
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,0.12);
          background: rgba(255,255,255,0.82);
          padding: 14px;
        }
        .heroTitle {
          margin: 0;
          font-size: 16px;
          font-weight: 950;
          color: rgba(15,23,42,0.92);
        }
        .heroSub {
          margin: 8px 0 0 0;
          font-size: 13px;
          line-height: 1.55;
          color: rgba(15,23,42,0.72);
          max-width: 920px;
        }

        /* Tile grid */
        .tiles {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          padding: 0 14px 14px;
        }
        @media (min-width: 900px) {
          .tiles { grid-template-columns: repeat(3, 1fr); }
        }

        /* Secondary row tiles (2 across on desktop) */
        .tiles2 {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          padding: 0 14px 14px;
        }
        @media (min-width: 900px) {
          .tiles2 { grid-template-columns: repeat(2, 1fr); }
        }

        .tile {
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,0.12);
          background: rgba(15,23,42,0.02);
          padding: 14px;
          display: grid;
          gap: 8px;
          min-height: 110px;
          box-shadow: 0 10px 26px rgba(15,23,42,0.06);
        }

        .tileTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .tileTitle {
          margin: 0;
          font-size: 14px;
          font-weight: 950;
          color: rgba(15,23,42,0.92);
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.65);
          color: rgba(15,23,42,0.76);
          white-space: nowrap;
        }

        .tileDesc {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: rgba(15,23,42,0.72);
        }

        .tileActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        /* Use your global .btn, but make sure link looks like it */
        .btnLike {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
        }

        .primaryBtn {
          border: 1px solid rgba(255,255,255,0.26) !important;
          background: linear-gradient(135deg, #2563eb 0%, #7c3aed 55%, #ec4899 100%) !important;
          color: #fff !important;
          font-weight: 900 !important;
          box-shadow: 0 16px 34px rgba(37, 99, 235, 0.22) !important;
        }

        /* Bottom more info */
        details.moreInfo {
          margin: 0 14px 14px;
          border-top: 1px solid rgba(15,23,42,0.10);
          padding-top: 12px;
        }
        details.moreInfo summary {
          cursor: pointer;
          font-weight: 900;
          color: rgba(15,23,42,0.88);
          list-style: none;
          display: inline-flex;
          gap: 8px;
          align-items: center;
        }
        details.moreInfo summary::-webkit-details-marker {
          display: none;
        }
        .moreBox {
          margin-top: 10px;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.75);
          padding: 12px;
        }
        .moreBox h3 {
          margin: 0 0 6px 0;
          font-size: 13px;
          font-weight: 950;
          color: rgba(15,23,42,0.92);
        }
        .moreBox p, .moreBox li {
          font-size: 13px;
          line-height: 1.55;
          color: rgba(15,23,42,0.72);
        }
        .moreBox ul { margin: 8px 0 0 0; padding-left: 18px; }
      `}</style>

      <div className="wrap">
        <section className="frame">
          {/* Wireframe-like top strip (visual) */}
          

          {/* Big intro box (wireframe) */}
          <div className="heroBox">
            <p className="heroTitle">A complete NBA gameplan — plays + shots — in one flow</p>
            <p className="heroSub">
              This capstone is a decision-support web app that recommends best offensive play types for a specific opponent.
              It includes baseline explainability, an AI context simulator (late-game scenarios), real visualizations,
              and defense-friendly evidence pages.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <Link className="btn primaryBtn btnLike" href="/gameplan">
                Open Gameplan
              </Link>
              <Link className="btn btnLike" href="/matchup">
                Matchup / Baseline
              </Link>
              <Link className="btn btnLike" href="/context">
                Context / ML
              </Link>
              <Link className="btn btnLike" href="/model-metrics">
                Model Performance
              </Link>
            </div>
          </div>

          {/* Primary tiles row (3 across in wireframe) */}
          <div className="tiles">
            <div className="tile">
              <div className="tileTop">
                <p className="tileTitle">Data Explorer</p>
                <span className="tag">Dataset1</span>
              </div>
              <p className="tileDesc">Browse the play-type dataset used by the recommenders.</p>
              <div className="tileActions">
                <Link className="btn btnLike" href="/data-explorer">
                  Open
                </Link>
              </div>
            </div>

            <div className="tile">
              <div className="tileTop">
                <p className="tileTitle">Baseline Recommender</p>
                <span className="tag">Matchup</span>
              </div>
              <p className="tileDesc">Explainable Top-K ranking of play types for a matchup.</p>
              <div className="tileActions">
                <Link className="btn btnLike" href="/matchup">
                  Open
                </Link>
                <Link className="btn btnLike" href="/model-metrics">
                  Performance
                </Link>
              </div>
            </div>

            <div className="tile">
              <div className="tileTop">
                <p className="tileTitle">Context / ML</p>
                <span className="tag">AI</span>
              </div>
              <p className="tileDesc">Re-rank Top-K based on score/time context (late-game).</p>
              <div className="tileActions">
                <Link className="btn btnLike" href="/context">
                  Open
                </Link>
                <Link className="btn btnLike" href="/matchup">
                  Compare Baseline
                </Link>
              </div>
            </div>
          </div>

          {/* Secondary tiles row (2 tiles in your wireframe: Tactics Board + Explanation)
              Your real equivalents (for now) are Gameplan + Glossary.
          */}
          <div className="tiles2">
            <div className="tile">
              <div className="tileTop">
                <p className="tileTitle">Gameplan</p>
                <span className="tag">Coach view</span>
              </div>
              <p className="tileDesc">The combined workflow for a coach-friendly demo experience.</p>
              <div className="tileActions">
                <Link className="btn primaryBtn btnLike" href="/gameplan">
                  Open Gameplan
                </Link>
              </div>
            </div>

            <div className="tile">
              <div className="tileTop">
                <p className="tileTitle">Glossary</p>
                <span className="tag">Explanation</span>
              </div>
              <p className="tileDesc">Plain-English definitions and “where you see it” traceability.</p>
              <div className="tileActions">
                <Link className="btn btnLike" href="/glossary">
                  Open Glossary
                </Link>
              </div>
            </div>
          </div>

          {/* More info (ALL extra writing goes here) */}
          <details className="moreInfo">
            <summary>More info</summary>

            <div className="moreBox">
              <h3>What reviewers should notice</h3>
              <ul>
                <li>
                  <strong>Baseline</strong> is the trust anchor (transparent math and repeatable ranking).
                </li>
                <li>
                  <strong>Context / ML</strong> shows scenario-based re-ranking with measurable deltas.
                </li>
                <li>
                  <strong>Model Performance</strong> provides holdout metrics to justify model choice.
                </li>
                <li>
                  <strong>Glossary</strong> provides definitions + traceability across the product.
                </li>
              </ul>
            </div>

            <div className="moreBox">
              <h3>Suggested 60-second demo</h3>
              <ul>
                <li>Open Gameplan (wow experience)</li>
                <li>Open Matchup / Baseline (trust anchor)</li>
                <li>Open Context / ML (scenario change)</li>
                <li>Open Model Performance (evidence)</li>
              </ul>
            </div>

            <div className="moreBox">
              <h3>Note about “shots” pages</h3>
              <p style={{ margin: 0 }}>
                More pages will be visible once we finalize role-based access. This homepage keeps the public-facing experience simple and coach-friendly.
              </p>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}