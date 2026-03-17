// app/page.tsx
//
// Home (PSPI-polished, coach-facing landing)
// Domain Expert feedback applied:
// - Not a redundant sitemap (navbar already routes everywhere).
// - No “category tiles” with descriptions.
// - A premium landing: court hero visual + brief capstone explanation + primary demo CTA.
// - Optional “How to demo” + “Evidence / traceability” collapsed for committee.
//
// NOTE: Server Component (no hooks).


import Link from "next/link";


export default function Page() {
 return (
   <main style={{ display: "grid", gap: 14 }}>
     <style>{`
       .wrap {
         max-width: 1160px;
         margin: 0 auto;
         padding: 18px 16px;
       }


       /* App shell */
       .shell {
         border-radius: 24px;
         border: 1px solid rgba(15,23,42,0.12);
         background:
           radial-gradient(1200px 620px at 18% -12%, rgba(37,99,235,0.20), transparent 60%),
           radial-gradient(1000px 560px at 112% 6%, rgba(124,58,237,0.16), transparent 58%),
           radial-gradient(980px 560px at 62% 118%, rgba(236,72,153,0.12), transparent 58%),
           rgba(255,255,255,0.78);
         overflow: hidden;
         box-shadow: 0 26px 70px rgba(15,23,42,0.11);
         position: relative;
       }


       /* Subtle top “status” strip (not nav) */
       .strip {
         display: flex;
         justify-content: space-between;
         gap: 10px;
         padding: 10px 14px;
         border-bottom: 1px solid rgba(15,23,42,0.08);
         background: rgba(15,23,42,0.02);
         flex-wrap: wrap;
         align-items: center;
       }


       .brand {
         display: inline-flex;
         align-items: center;
         gap: 10px;
         font-weight: 950;
         color: rgba(15,23,42,0.90);
         letter-spacing: -0.2px;
         font-size: 13px;
         white-space: nowrap;
       }
       .dot {
         width: 10px;
         height: 10px;
         border-radius: 999px;
         background: linear-gradient(135deg, #2563eb 0%, #7c3aed 55%, #ec4899 100%);
         box-shadow: 0 0 0 6px rgba(37,99,235,0.10);
       }


       .metaPills {
         display: inline-flex;
         gap: 8px;
         flex-wrap: wrap;
         align-items: center;
         justify-content: flex-end;
       }
       .pill {
         display: inline-flex;
         align-items: center;
         gap: 8px;
         font-size: 12px;
         font-weight: 900;
         padding: 6px 10px;
         border-radius: 999px;
         border: 1px solid rgba(15,23,42,0.10);
         background: rgba(255,255,255,0.65);
         color: rgba(15,23,42,0.74);
         white-space: nowrap;
       }


       /* Hero layout */
       .hero {
         display: grid;
         gap: 14px;
         padding: 16px;
       }
       @media (min-width: 980px) {
         .hero {
           grid-template-columns: 1.15fr 0.85fr;
           align-items: stretch;
         }
       }


       .heroLeft {
         border-radius: 18px;
         border: 1px solid rgba(15,23,42,0.12);
         background: rgba(255,255,255,0.82);
         padding: 16px;
         box-shadow: 0 18px 44px rgba(15,23,42,0.06);
         position: relative;
         overflow: hidden;
       }
       .heroLeft::before {
         content: "";
         position: absolute;
         inset: -2px;
         background:
           radial-gradient(520px 250px at 18% 0%, rgba(37,99,235,0.14), transparent 55%),
           radial-gradient(520px 250px at 88% 10%, rgba(124,58,237,0.12), transparent 55%),
           radial-gradient(520px 250px at 62% 120%, rgba(236,72,153,0.10), transparent 55%);
         pointer-events: none;
       }


       .kicker {
         position: relative;
         display: inline-flex;
         align-items: center;
         gap: 8px;
         font-size: 12px;
         font-weight: 950;
         padding: 6px 10px;
         border-radius: 999px;
         border: 1px solid rgba(15,23,42,0.10);
         background: rgba(15,23,42,0.02);
         color: rgba(15,23,42,0.76);
         margin-bottom: 10px;
       }


       .title {
         position: relative;
         margin: 0;
         font-size: 20px;
         font-weight: 980;
         color: rgba(15,23,42,0.93);
         letter-spacing: -0.35px;
         line-height: 1.15;
       }
       .sub {
         position: relative;
         margin: 10px 0 0 0;
         font-size: 13.5px;
         line-height: 1.65;
         color: rgba(15,23,42,0.72);
         max-width: 860px;
       }


       .calloutGrid {
         position: relative;
         display: grid;
         gap: 10px;
         margin-top: 12px;
       }
       @media (min-width: 720px) {
         .calloutGrid {
           grid-template-columns: 1fr 1fr;
         }
       }


       .callout {
         border-radius: 16px;
         border: 1px solid rgba(15,23,42,0.10);
         background: rgba(255,255,255,0.65);
         padding: 12px;
         display: grid;
         gap: 6px;
       }
       .callout h3 {
         margin: 0;
         font-size: 12.5px;
         font-weight: 950;
         color: rgba(15,23,42,0.90);
       }
       .callout p {
         margin: 0;
         font-size: 12.8px;
         line-height: 1.55;
         color: rgba(15,23,42,0.70);
       }


       .actions {
         position: relative;
         display: flex;
         gap: 10px;
         flex-wrap: wrap;
         margin-top: 14px;
         align-items: center;
       }


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
         font-weight: 950 !important;
         box-shadow: 0 16px 34px rgba(37, 99, 235, 0.22) !important;
       }


       .ghostBtn {
         border: 1px solid rgba(15,23,42,0.12) !important;
         background: rgba(255,255,255,0.70) !important;
         color: rgba(15,23,42,0.86) !important;
         font-weight: 900 !important;
       }


       .note {
         font-size: 12px;
         color: rgba(15,23,42,0.62);
         font-weight: 800;
       }


       /* Right: court visual card */
       .courtCard {
         border-radius: 18px;
         border: 1px solid rgba(15,23,42,0.12);
         background: rgba(255,255,255,0.72);
         padding: 14px;
         box-shadow: 0 18px 44px rgba(15,23,42,0.06);
         display: grid;
         gap: 12px;
         overflow: hidden;
       }


       .courtHead {
         display: flex;
         align-items: flex-start;
         justify-content: space-between;
         gap: 10px;
       }


       .courtTitle {
         margin: 0;
         font-size: 13px;
         font-weight: 950;
         color: rgba(15,23,42,0.90);
       }


       .courtHint {
         margin: 6px 0 0 0;
         font-size: 12.5px;
         line-height: 1.55;
         color: rgba(15,23,42,0.70);
       }


       .badge {
         font-size: 11px;
         font-weight: 950;
         padding: 5px 10px;
         border-radius: 999px;
         border: 1px solid rgba(15,23,42,0.10);
         background: rgba(15,23,42,0.03);
         color: rgba(15,23,42,0.72);
         white-space: nowrap;
       }


       /* Court illustration (pure CSS, no assets) */
       .court {
         border-radius: 16px;
         border: 1px solid rgba(15,23,42,0.12);
         background:
           linear-gradient(180deg, rgba(15,23,42,0.03), rgba(15,23,42,0.01)),
           repeating-linear-gradient(
             90deg,
             rgba(15,23,42,0.04) 0px,
             rgba(15,23,42,0.04) 1px,
             transparent 1px,
             transparent 28px
           ),
           radial-gradient(circle at 50% 48%, rgba(37,99,235,0.14), transparent 55%),
           radial-gradient(circle at 22% 70%, rgba(124,58,237,0.10), transparent 55%),
           radial-gradient(circle at 76% 30%, rgba(236,72,153,0.08), transparent 55%),
           rgba(255,255,255,0.86);
         height: 240px;
         position: relative;
         overflow: hidden;
       }


       .court::before {
         /* half-court line + center circle */
         content: "";
         position: absolute;
         inset: 0;
         background:
           radial-gradient(circle at 50% 50%, transparent 0 42px, rgba(15,23,42,0.18) 43px 44px, transparent 45px),
           linear-gradient(90deg, transparent 0 49.6%, rgba(15,23,42,0.18) 49.6% 50.4%, transparent 50.4% 100%);
         opacity: 0.55;
         pointer-events: none;
       }


       .court::after {
         /* dashed boundary hint */
         content: "";
         position: absolute;
         inset: 18px;
         border-radius: 14px;
         border: 1px dashed rgba(15,23,42,0.22);
         opacity: 0.35;
         pointer-events: none;
       }


       .spark {
         position: absolute;
         width: 10px;
         height: 10px;
         border-radius: 999px;
         opacity: 0.95;
       }
       .spark::after {
         content: "";
         position: absolute;
         inset: -7px;
         border-radius: 999px;
         opacity: 0.18;
         border: 2px solid currentColor;
       }
       .spark.s1 { top: 66%; left: 28%; background: rgba(37,99,235,0.92); color: rgba(37,99,235,1); }
       .spark.s2 { top: 40%; left: 56%; background: rgba(124,58,237,0.90); color: rgba(124,58,237,1); }
       .spark.s3 { top: 28%; left: 78%; background: rgba(236,72,153,0.88); color: rgba(236,72,153,1); }


       /* Bottom “How it works” strip */
       .flow {
         padding: 0 16px 16px;
       }
       .flowCard {
         border-radius: 18px;
         border: 1px solid rgba(15,23,42,0.12);
         background: rgba(255,255,255,0.70);
         padding: 14px;
         box-shadow: 0 14px 30px rgba(15,23,42,0.05);
         display: grid;
         gap: 10px;
       }


       .flowTitle {
         margin: 0;
         font-size: 13.5px;
         font-weight: 950;
         color: rgba(15,23,42,0.90);
       }


       .steps {
         display: grid;
         grid-template-columns: 1fr;
         gap: 10px;
       }
       @media (min-width: 980px) {
         .steps {
           grid-template-columns: repeat(3, 1fr);
         }
       }


       .step {
         border-radius: 16px;
         border: 1px solid rgba(15,23,42,0.10);
         background: rgba(15,23,42,0.02);
         padding: 12px;
         display: grid;
         gap: 6px;
         min-height: 88px;
       }
       .stepTop {
         display: flex;
         align-items: center;
         justify-content: space-between;
         gap: 10px;
       }
       .stepNum {
         font-size: 11px;
         font-weight: 950;
         padding: 4px 10px;
         border-radius: 999px;
         border: 1px solid rgba(15,23,42,0.10);
         background: rgba(255,255,255,0.60);
         color: rgba(15,23,42,0.72);
         white-space: nowrap;
       }
       .stepTitle {
         margin: 0;
         font-size: 12.8px;
         font-weight: 950;
         color: rgba(15,23,42,0.90);
       }
       .stepDesc {
         margin: 0;
         font-size: 12.8px;
         line-height: 1.55;
         color: rgba(15,23,42,0.70);
       }


       /* More info */
       details.moreInfo {
         margin: 0 16px 16px;
         border-top: 1px solid rgba(15,23,42,0.10);
         padding-top: 12px;
       }
       details.moreInfo summary {
         cursor: pointer;
         font-weight: 950;
         color: rgba(15,23,42,0.88);
         list-style: none;
         display: inline-flex;
         gap: 8px;
         align-items: center;
       }
       details.moreInfo summary::-webkit-details-marker { display: none; }


       .moreBox {
         margin-top: 10px;
         border-radius: 14px;
         border: 1px solid rgba(15,23,42,0.10);
         background: rgba(255,255,255,0.72);
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
       <section className="shell">
         {/* Status/brand strip (not navigation) */}
         <div className="strip">
           <div className="brand">
             <span className="dot" />
             NBA PlayRanker • Capstone Decision Support
           </div>
           <div className="metaPills">
             <span className="pill">Evidence-first</span>
             <span className="pill">Context-aware</span>
             <span className="pill">Visual proof</span>
             <span className="pill">Coach workflow</span>
           </div>
         </div>


         {/* HERO */}
         <div className="hero">
           {/* Left: story + CTA */}
           <div className="heroLeft">
             <div className="kicker">Built for pre-game planning & in-game support.</div>
             <h1 className="title">Turn opponent scouting into a clear, explainable gameplan.</h1>
             <p className="sub">
               This web app recommends <strong>which offensive play types to prioritize</strong> against a specific opponent.
               It combines a <strong>baseline (transparent) ranking</strong> with a <strong>context simulator</strong> for late-game
               situations, plus <strong>court visuals</strong> and <strong>model performance</strong> evidence — so coaches can
               trust the output and act on it quickly.
             </p>


             <div className="calloutGrid">
               <div className="callout">
                 <h3>What coaches get</h3>
                 <p>Top options, quick reasoning, visuals, and a plan you can walk into a meeting with.</p>
               </div>
               <div className="callout">
                 <h3>What reviewers can verify</h3>
                 <p>Data explorer, metrics, and traceability pages that show exactly how results were produced.</p>
               </div>
             </div>




           </div>


           {/* Right: court visual */}
           <aside className="courtCard">
             <div className="courtHead">
               <div>
                 <p className="courtTitle">Basketball court view</p>
                 <p className="courtHint">
                   Visuals are used across the product to make decisions easy to validate and communicate.
                 </p>
               </div>
               <span className="badge">PSPI</span>
             </div>


             <div className="court" aria-label="Basketball court illustration">
               <span className="spark s1" />
               <span className="spark s2" />
               <span className="spark s3" />
             </div>




           </aside>
         </div>


         {/* Simple 3-step “how it works” (not category tiles) */}
         <div className="flow">
           <div className="flowCard">
             <p className="flowTitle">How it works (fast coach workflow)</p>


             <div className="steps">
               <div className="step">
                 <div className="stepTop">
                   <p className="stepTitle">Pick the matchup</p>
                   <span className="stepNum">Step 1</span>
                 </div>
                 <p className="stepDesc">
                   Start with the baseline recommender to see the top play types vs the opponent.
                 </p>
               </div>


               <div className="step">
                 <div className="stepTop">
                   <p className="stepTitle">Add context</p>
                   <span className="stepNum">Step 2</span>
                 </div>
                 <p className="stepDesc">
                   Simulate late-game score/time to re-rank options and prep “if/then” scenarios.
                 </p>
               </div>


               <div className="step">
                 <div className="stepTop">
                   <p className="stepTitle">Validate with visuals</p>
                   <span className="stepNum">Step 3</span>
                 </div>
                 <p className="stepDesc">
                   Use court views and performance evidence to justify the plan and communicate it.
                 </p>
               </div>
             </div>
           </div>
         </div>


         {/* Committee / extra detail (collapsed) */}
         <details className="moreInfo">
           <summary>More info</summary>


           <div className="moreBox">
             <h3>Suggested 60-second demo</h3>
             <ul>
               <li>Open <strong>Gameplan</strong> (end-to-end coach workflow)</li>
               <li>Open <strong>Baseline Matchup</strong> (trust anchor)</li>
               <li>Open <strong>Context Simulator</strong> (scenario change)</li>
               <li>Open <strong>Model Performance</strong> (evidence)</li>
             </ul>
           </div>


           <div className="moreBox">
             <h3>Evidence-first design</h3>
             <ul>
               <li>Baseline ranking is the transparent reference point</li>
               <li>Context re-ranking is compared against baseline</li>
               <li>Model metrics provide holdout validation</li>
               <li>Glossary and explorer pages support traceability</li>
             </ul>
           </div>
         </details>
       </section>
     </div>
   </main>
 );
}

