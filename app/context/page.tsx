// app/context/page.tsx
//
// I built this page as my “Context Simulator” (this is the AI use-case I can point to in a demo/defence).
// The goal is simple: start with ML-predicted efficiency, then apply small + transparent game-context rules
// (score/time) to re-rank the Top-K so it actually feels like a coach workflow.
//

"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  finalPPP: number; // PPP_CONTEXT from backend (backend already did its “context-aware” step)
  mlPPP: number; // PPP_ML_BLEND (the ML blended number I’m using for the AI portion)
  baselinePPP: number; // PPP_BASELINE (what the baseline page shows)
  deltaPPP: number; // DELTA_VS_BASELINE (backend-calculated delta, before my overlay)
  contextLabel: string;
  rationale: string;
  raw: Record<string, any>;
};

type OverlayBreakdown = {
  overlayPPP: number;
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
  finalPPP_display: number;
  deltaPPP_display: number;
  overlay: OverlayBreakdown;
};

// Small formatting helper so the UI doesn’t explode when a number is missing/NaN.
function fmt(n: any, digits = 3) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(digits);
}

// I clamp a bunch of my “factors” to 0..1 because they’re meant to behave like weights.
function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

// Defaults: I pick something sensible so the page can auto-run and show results without extra clicks.
function pickDefaultSeason(seasons: string[]) {
  return seasons.length ? seasons[seasons.length - 1] : "";
}

function pickDefaultOur(teams: string[]) {
  // I default to TOR if it exists because that’s what I demo most often.
  if (teams.includes("TOR")) return "TOR";
  return teams[0] ?? "";
}

function pickDefaultOpp(teams: string[], our: string) {
  // I try to pick a “recognizable” opponent for demos first, otherwise just pick someone that isn’t us.
  const preferred = ["BOS", "LAL", "DEN", "MIA", "GSW"];
  for (const t of preferred) {
    if (teams.includes(t) && t !== our) return t;
  }
  return teams.find((t) => t !== our) ?? "";
}

// “Late factor” is my way of scaling urgency.
// - It ramps hard in the last 3 minutes and behaves differently for early periods vs Q4 vs OT.
function computeLateFactor(period: number, timeRemainingSec: number) {
  const t = Number(timeRemainingSec);
  const p = Number(period);

  const timeLeft = Math.max(0, Math.min(720, Number.isFinite(t) ? t : 720));
  const lateRamp = clamp01((180 - timeLeft) / 180);

  if (p <= 3) return 0.10 + 0.15 * lateRamp;
  if (p === 4) return 0.25 + 0.75 * lateRamp;
  return 0.70 + 0.30 * lateRamp;
}

// Score factors: I normalize margin to a -15..+15 “feel” so extreme margins don’t overreact.
function computeScoreFactors(margin: number) {
  const m = Number(margin);
  const cap = 15;
  const trailing = clamp01((-m) / cap);
  const leading = clamp01(m / cap);
  return { trailing, leading };
}

// Light heuristic tagging so the overlay can nudge decisions in a way that “feels” basketball-real.
// (This is intentionally simple + explainable — not another ML model.)
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
    s.includes("post up");

  const risky = s.includes("isolation") || s.includes("iso") || s.includes("transition");
  const slow = s.includes("post up") || s.includes("off screen") || s.includes("handoff");

  return { quick, safe, risky, slow };
}

// This is the “policy overlay” layer.
// I’m deliberately keeping it small (tiny PPP nudges) because it’s meant to show *why* rankings can change
// based on context — not to replace the backend model.
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

  // I use “diff from mean” as a cheap proxy for “is this play meaningfully above average in this ranking set?”
  const mlDiffFromMean = Number.isFinite(ml) && Number.isFinite(meanMlPPP) ? ml - meanMlPPP : 0;

  // Variance proxy = how much ML disagrees with baseline. If disagreement is large, I treat it as “riskier.”
  const varianceProxy = Math.abs((Number.isFinite(ml) ? ml : 0) - (Number.isFinite(base) ? base : 0));
  const { quick, safe, risky, slow } = categorizePlay(row.playType);

  // Efficiency nudge: if we’re late + trailing, I’ll slightly reward plays that are above the pack.
  const overlayEff =
    late *
    trailing *
    clamp01(Math.abs(mlDiffFromMean) / 0.25) *
    (mlDiffFromMean >= 0 ? 1 : -1) *
    0.020;

  // Quick nudge: if we’re late + trailing, quick hitters get a small bump.
  const overlayQuick = quick ? late * trailing * 0.010 : 0;

  // Protect nudge: if we’re leading late, I pull down high-variance / risky options a bit.
  const overlayProtect =
    late *
    leading *
    (-0.018 * clamp01(varianceProxy / 0.25)) *
    (risky ? 1.2 : 1.0);

  // Type nudge: small “game management” pushes (safe when leading, avoid slow when trailing).
  let overlayType = 0;
  if (trailing > 0) overlayType += slow ? -(late * trailing) * 0.006 : 0;
  if (leading > 0) overlayType += safe ? (late * leading) * 0.006 : 0;

  const overlayPPP_raw = overlayEff + overlayQuick + overlayProtect + overlayType;

  // Strength is user-controlled but clamped so someone can’t accidentally make the overlay dominate.
  const s = Math.max(0, Math.min(2, Number(strength)));
  const overlayPPP = overlayPPP_raw * s;

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

// I keep icons inline to avoid extra deps and so the page stays portable.
function Icon({
  name,
}: {
  name:
    | "spark"
    | "play"
    | "bolt"
    | "shield"
    | "clock"
    | "trend"
    | "sliders"
    | "table"
    | "cards"
    | "copy"
    | "link";
}) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  };
  switch (name) {
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
    case "play":
      return (
        <svg {...common}>
          <path d="M10 8.5v7l6-3.5-6-3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path
            d="M13 2L3 14h7l-1 8 10-12h-7l1-8Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path
            d="M12 2l8 4v6c0 6-3.5 9.5-8 10-4.5-.5-8-4-8-10V6l8-4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" strokeWidth="2" />
          <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "trend":
      return (
        <svg {...common}>
          <path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M17 7h4v4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...common}>
          <path d="M4 21v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 10V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 21v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 8V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M20 21v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M20 12V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M2 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M18 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "copy":
      return (
        <svg {...common}>
          <path d="M9 9h10v10H9V9Z" stroke="currentColor" strokeWidth="2" />
          <path
            d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path
            d="M10 13a5 5 0 0 1 0-7l.5-.5a5 5 0 0 1 7 7l-.5.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M14 11a5 5 0 0 1 0 7l-.5.5a5 5 0 0 1-7-7l.5-.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

// Utility to display seconds as m:ss for the UI chips.
function secondsToClock(sec: number) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

// PAGE_CSS stays in-file on purpose:
// - I wanted the styling to be scoped to this route only.
// - It also lets me hard-fix overflow/hydration issues without messing with global CSS.
const PAGE_CSS = `
  /* ✅ hard clamp to avoid whole-page horizontal scrolling */
  .pageWrap{
    width: 100%;
    max-width: 1240px;
    margin: 0 auto;
    padding: 0 12px;
    box-sizing: border-box;
    overflow-x: hidden;
  }
  .pageWrap *{ box-sizing: border-box; }

  /* ✅ grid overflow fix: allow children to shrink inside grid */
  .layout > *{ min-width: 0; }

  /* ✅ clamp potentially-wide blocks */
  .hero, .subtleCard, .tableWrap{ max-width: 100%; }

  /* ✅ local override for global .form-grid (prevents min-content overflow) */
  .form-grid{ width: 100%; max-width: 100%; }
  .form-grid > *{ min-width: 0; }
  .form-grid label{ min-width: 0; }
  .input{ max-width: 100%; }

  .hero {
    border-radius: 18px;
    border: 1px solid rgba(15,23,42,0.10);
    background:
      radial-gradient(1200px 400px at 10% 0%, rgba(59,130,246,0.22), transparent 55%),
      radial-gradient(1000px 500px at 90% 10%, rgba(239,68,68,0.18), transparent 55%),
      linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.65));
    padding: 14px;
    overflow: hidden;
    position: relative;
  }
  .hero::after{
    content:"";
    position:absolute;
    inset:-2px;
    background: radial-gradient(800px 120px at 50% 0%, rgba(15,23,42,0.10), transparent 60%);
    pointer-events:none;
    opacity: .6;
  }
  .topBar {
    display:flex;
    justify-content:space-between;
    gap:12px;
    flex-wrap:wrap;
    align-items:flex-start;
    position:relative;
    z-index:1;
  }
  .crumbs { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
  .pillMini {
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:6px 10px;
    border-radius:999px;
    border:1px solid rgba(15,23,42,0.10);
    background: rgba(255,255,255,0.6);
    color: rgba(15,23,42,0.75);
    font-size:12px;
    white-space:nowrap;
  }
  .headline {
    margin: 8px 0 0;
    font-size: 28px;
    line-height: 1.12;
    letter-spacing: -0.02em;
    font-weight: 900;
  }
  .headline span {
    background: linear-gradient(90deg, rgba(15,23,42,0.95), rgba(59,130,246,0.95));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .sub {
    margin: 8px 0 0;
    max-width: 980px;
    font-size: 14px;
    color: rgba(15,23,42,0.75);
  }
  .layout {
    display:grid;
    grid-template-columns: 1fr;
    gap:14px;
    margin-top: 14px;
    max-width: 100%;
  }
  @media (min-width: 1060px){
    .layout { grid-template-columns: 1.05fr 0.95fr; align-items:start; }
    .stickyRight { position: sticky; top: 12px; }
  }
  .subtleCard {
    border-radius: 16px;
    border: 1px solid rgba(15,23,42,0.08);
    background: rgba(255,255,255,0.72);
    padding: 12px;
  }
  .panelTitle {
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:10px;
    flex-wrap:wrap;
  }
  .divider {
    height:1px;
    background: rgba(15,23,42,0.08);
    margin: 12px 0;
  }
  .btnIcon { display:inline-flex; gap:8px; align-items:center; }
  .presetRow { display:flex; gap:10px; flex-wrap:wrap; margin-top: 10px; }
  .miniBtn {
    border-radius: 999px;
    padding: 8px 10px;
    border: 1px solid rgba(15,23,42,0.10);
    background: rgba(255,255,255,0.65);
    cursor: pointer;
    font-size: 12px;
    color: rgba(15,23,42,0.80);
  }
  .miniBtn:hover { background: rgba(255,255,255,0.85); }
  .actionDock {
    display:flex;
    justify-content:space-between;
    gap:10px;
    flex-wrap:wrap;
    align-items:center;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(15,23,42,0.08);
  }
  .actionLeft, .actionRight { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
  .meter {
    height: 10px;
    border-radius: 999px;
    background: rgba(15,23,42,0.08);
    overflow: hidden;
  }
  .meter > div { height: 100%; background: rgba(15,23,42,0.35); }
  .tone {
    display:grid;
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 10px;
    max-width: 100%;
  }
  @media (min-width: 760px){
    .tone { grid-template-columns: 1fr 1fr; }
  }
  .toneBox{
    border-radius: 14px;
    border: 1px solid rgba(15,23,42,0.08);
    background: rgba(15,23,42,0.02);
    padding: 10px;
    display:grid;
    gap: 8px;
    max-width: 100%;
  }
  .range { width: 100%; max-width: 100%; }
  .tableWrap {
    overflow-x: auto;
    display: block;
    max-width: 100%;
    border-radius: 14px;
    border: 1px solid rgba(15,23,42,0.08);
    background: rgba(255,255,255,0.70);
  }
  .tableWrap .table { margin: 0; }
  .mobileOnly { display: block; }
  .desktopOnly { display: none; }
  @media (min-width: 900px){
    .mobileOnly { display: none; }
    .desktopOnly { display: block; }
  }
  .cardList { display: grid; gap: 10px; }
  .resultCard {
    border-radius: 16px;
    border: 1px solid rgba(15,23,42,0.10);
    background: rgba(255,255,255,0.72);
    padding: 12px;
  }
  .resultTop {
    display:flex;
    justify-content:space-between;
    gap:10px;
    align-items:flex-start;
    flex-wrap:wrap;
  }
  .chip {
    display:inline-flex;
    gap:8px;
    align-items:center;
    border-radius:999px;
    padding: 6px 10px;
    border: 1px solid rgba(15,23,42,0.10);
    background: rgba(15,23,42,0.03);
    font-size: 12px;
    color: rgba(15,23,42,0.75);
    white-space: nowrap;
  }
  .toast {
    border-radius: 14px;
    border: 1px solid rgba(239,68,68,0.22);
    background: rgba(239,68,68,0.07);
    padding: 10px;
    margin-top: 12px;
    color: rgba(15,23,42,0.85);
  }
  .skeleton {
    border-radius: 14px;
    border: 1px solid rgba(15,23,42,0.08);
    background: linear-gradient(90deg, rgba(15,23,42,0.03), rgba(15,23,42,0.06), rgba(15,23,42,0.03));
    background-size: 200% 100%;
    animation: shimmer 1.2s linear infinite;
    height: 14px;
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

// ✅ Inner component contains useSearchParams() so Next can bail out correctly.
// ✅ Outer export wraps it in Suspense (fixes Vercel prerender error).
function ContextInner() {
  const params = useSearchParams();

  // Meta is fetched once so dropdowns have real seasons/teams.
  const [meta, setMeta] = useState<MetaOptions>({
    seasons: [],
    teams: [],
    teamNames: {},
    playTypes: [],
    sides: ["offense", "defense"],
    hasMlPredictions: false,
  });

  // Core matchup inputs
  const [season, setSeason] = useState("");
  const [our, setOur] = useState("");
  const [opp, setOpp] = useState("");
  const [k, setK] = useState(5);

  // Context inputs (what actually drives the re-rank behavior)
  const [margin, setMargin] = useState<number>(-2);
  const [period, setPeriod] = useState<number>(4);
  const [timeRemaining, setTimeRemaining] = useState<number>(120);

  // Overlay controls (the “policy” layer)
  const [applyOverlay, setApplyOverlay] = useState(true);
  const [overlayStrength, setOverlayStrength] = useState(1.0);

  // UI toggles
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [liveMode, setLiveMode] = useState(false);

  // Results + status
  const [rows, setRows] = useState<ContextRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // I use these refs to stop accidental double-runs and to throttle live-mode calls.
  const didAutoRunRef = useRef(false);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial page boot:
  // - fetch meta
  // - apply querystring overrides (so a shared link reproduces the same scenario)
  // - pick sensible defaults if query params aren’t present
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

        const qsMargin = params.get("margin");
        const qsPeriod = params.get("period");
        const qsTime = params.get("timeRemaining");
        const qsOverlay = params.get("overlay");
        const qsStrength = params.get("strength");

        setSeason((prev) => prev || defaultSeason);
        setOur((prev) => prev || defaultOur);
        setOpp((prev) => prev || defaultOpp);

        if (qsK && Number.isFinite(Number(qsK))) setK(Math.min(10, Math.max(1, Number(qsK))));
        if (qsMargin && Number.isFinite(Number(qsMargin))) setMargin(Number(qsMargin));
        if (qsPeriod && Number.isFinite(Number(qsPeriod))) setPeriod(Number(qsPeriod));
        if (qsTime && Number.isFinite(Number(qsTime))) setTimeRemaining(Number(qsTime));
        if (qsOverlay === "0") setApplyOverlay(false);
        if (qsStrength && Number.isFinite(Number(qsStrength))) setOverlayStrength(Number(qsStrength));
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

  // I only consider the page “ready” when we actually have seasons + teams loaded.
  const metaReady = useMemo(() => (meta?.seasons?.length ?? 0) > 0 && (meta?.teams?.length ?? 0) > 0, [meta]);

  // Quick guard so I don’t spam the backend with bad inputs.
  const canRun = useMemo(() => {
    if (!metaReady) return false;
    if (!season || !our || !opp) return false;
    if (our === opp) return false;
    return true;
  }, [metaReady, season, our, opp]);

  // Labels are just for nicer UI display (team code + full name when available).
  const ourLabel = useMemo(() => {
    const name = meta.teamNames?.[our];
    return name ? `${our} (${name})` : our;
  }, [meta.teamNames, our]);

  const oppLabel = useMemo(() => {
    const name = meta.teamNames?.[opp];
    return name ? `${opp} (${name})` : opp;
  }, [meta.teamNames, opp]);

  // Link back to baseline page so reviewers can compare “math-only” vs “ML + context overlay”.
  const baselineHref = useMemo(() => {
    const qs = new URLSearchParams({ season, our, opp, k: String(k) });
    return `/matchup?${qs.toString()}`;
  }, [season, our, opp, k]);

  // I generate a reproducible scenario URL so I can share a specific game context (margin/period/time/etc.).
  function makeShareUrl() {
    const qs = new URLSearchParams({
      season,
      our,
      opp,
      k: String(k),
      margin: String(margin),
      period: String(period),
      timeRemaining: String(timeRemaining),
      overlay: applyOverlay ? "1" : "0",
      strength: String(overlayStrength),
    });
    return `/context?${qs.toString()}`;
  }

  async function copyShareLink() {
    try {
      const url = makeShareUrl();
      await navigator.clipboard.writeText(url);
      setError("Copied share link to clipboard.");
      setTimeout(() => setError(null), 1200);
    } catch {
      // Clipboard APIs can fail depending on browser permissions, so I fall back to a simple message.
      setError("Could not copy. You can manually copy the URL from the address bar.");
      setTimeout(() => setError(null), 1800);
    }
  }

  // This is the main backend call for context+ML recommendations.
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

      setRows(Array.isArray(out) ? out : []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to generate context+ML recommendations.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // Auto-run once when everything is ready so the page isn’t “blank” on first load.
  useEffect(() => {
    if (!canRun) return;
    if (didAutoRunRef.current) return;
    didAutoRunRef.current = true;
    runContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRun]);

  // Live mode: I debounce calls so sliders don’t trigger a request on every tiny movement.
  useEffect(() => {
    if (!liveMode) return;
    if (!canRun) return;
    if (loading) return;

    if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    liveTimerRef.current = setTimeout(() => {
      runContext();
    }, 450);

    return () => {
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMode, margin, period, timeRemaining, season, our, opp, k]);

  // Used for normalizing the overlay effect (so it’s relative to the current Top-K list).
  const meanMlPPP = useMemo(() => {
    const vals = rows.map((r) => Number(r.mlPPP)).filter((x) => Number.isFinite(x));
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [rows]);

  const lateFactorNow = useMemo(() => computeLateFactor(period, timeRemaining), [period, timeRemaining]);
  const scoreFactorsNow = useMemo(() => computeScoreFactors(margin), [margin]);

  // displayRows = backend results + my overlay layer + final sort.
  // I keep the overlay separate so I can show a breakdown and prove it’s not “black box”.
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

      // finalPPP_display is what I actually rank by on this page.
      const finalPPP_display = Number(r.finalPPP) + Number(overlay.overlayPPP);
      const deltaPPP_display = finalPPP_display - Number(r.baselinePPP);

      return { ...r, finalPPP_display, deltaPPP_display, overlay };
    });

    const sorted = [...mapped].sort((a, b) => b.finalPPP_display - a.finalPPP_display);
    return sorted.slice(0, Math.min(10, Math.max(1, k)));
  }, [rows, applyOverlay, meanMlPPP, period, timeRemaining, margin, overlayStrength, k]);

  const bestRow = useMemo(() => (displayRows.length ? displayRows[0] : null), [displayRows]);

  // Used for the little “bar meter” so the highest PPP fills 100%.
  const maxPPP = useMemo(() => {
    if (!displayRows.length) return 1.2;
    return Math.max(...displayRows.map((r) => Number(r.finalPPP_display) || 0), 1.2);
  }, [displayRows]);

  // Presets are just for fast demos (so I can show the ranking actually changes with context).
  function applyPreset(p: { margin: number; period: number; time: number }) {
    setMargin(p.margin);
    setPeriod(p.period);
    setTimeRemaining(p.time);
  }

  return (
    <section className="card">
      {/* I inject the CSS here so it’s hydration-safe and scoped to this page only. */}
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

      {/* This wrapper is what finally stopped the full-page sideways scroll issue. */}
      <div className="pageWrap">
        {/* HERO */}
        <div className="hero">
          <div className="topBar">
            <div className="crumbs">
              <Link className="btn" href="/">
                Home
              </Link>
              <span className="pillMini">
                <Icon name="spark" /> AI Context Simulator
              </span>
              <span className="pillMini">
                <Icon name="trend" /> ML + Policy Overlay
              </span>
              {meta?._fallback ? <span className="pillMini">Fallback meta</span> : null}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "100%" }}>
              <Link className="btn" href="/gameplan">
                <span className="btnIcon">
                  <Icon name="spark" /> Gameplan
                </span>
              </Link>
              <Link className="btn" href={baselineHref}>
                Baseline (Compare)
              </Link>
              <Link className="btn" href="/shot-plan">
                Shot Plan
              </Link>
              <Link className="btn" href="/shot-heatmap">
                Shot Heatmap
              </Link>
            </div>
          </div>

          <h1 className="headline">
            <span>Context</span> changes decisions.
          </h1>
          <p className="sub">
            This is the committee-visible <strong>AI use case</strong>: we use ML-predicted efficiency and then apply
            small, transparent context rules (score/time) that <strong>re-rank</strong> the Top-K. Every result includes
            a breakdown so nothing is “magic.”
          </p>

          <div className="presetRow">
            <button className="miniBtn" type="button" onClick={() => applyPreset({ margin: -6, period: 4, time: 120 })}>
              Down 6 • Q4 • 2:00
            </button>
            <button className="miniBtn" type="button" onClick={() => applyPreset({ margin: -2, period: 4, time: 45 })}>
              Down 2 • Q4 • 0:45
            </button>
            <button className="miniBtn" type="button" onClick={() => applyPreset({ margin: +4, period: 4, time: 90 })}>
              Up 4 • Q4 • 1:30
            </button>
            <button className="miniBtn" type="button" onClick={() => applyPreset({ margin: 0, period: 5, time: 120 })}>
              Tie • OT • 2:00
            </button>
            <button className="miniBtn" type="button" onClick={() => applyPreset({ margin: -10, period: 3, time: 300 })}>
              Down 10 • Q3 • 5:00
            </button>
          </div>
        </div>

        {/* LAYOUT */}
        <div className="layout">
          {/* LEFT SIDE = inputs + results */}
          <div>
            <div className="subtleCard">
              <div className="panelTitle">
                <h2 style={{ margin: 0, fontSize: 16 }}>Matchup + context inputs</h2>
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
                <h2 style={{ margin: 0, fontSize: 16 }}>Live game context</h2>
                <span className="pillMini">
                  <Icon name="clock" /> {secondsToClock(timeRemaining)} left • P{period} • margin{" "}
                  {margin >= 0 ? `+${margin}` : margin}
                </span>
              </div>

              <div className="tone">
                <div className="toneBox">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>Margin (our − opponent)</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Negative = trailing, Positive = leading
                      </div>
                    </div>
                    <input
                      className="input"
                      style={{ width: 110 }}
                      type="number"
                      step={1}
                      value={margin}
                      onChange={(e) => setMargin(Number(e.target.value))}
                    />
                  </div>

                  <input
                    className="range"
                    type="range"
                    min={-15}
                    max={15}
                    step={1}
                    value={Number.isFinite(margin) ? margin : 0}
                    onChange={(e) => setMargin(Number(e.target.value))}
                  />

                  <div className="muted" style={{ fontSize: 12 }}>
                    Trailing factor: <strong>{fmt(scoreFactorsNow.trailing, 2)}</strong> • Leading factor:{" "}
                    <strong>{fmt(scoreFactorsNow.leading, 2)}</strong>
                  </div>
                </div>

                <div className="toneBox">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>Time pressure</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Late factor ramps hard in last 3 minutes
                      </div>
                    </div>

                    <select
                      className="input"
                      value={period}
                      onChange={(e) => setPeriod(Number(e.target.value))}
                      style={{ width: 110 }}
                    >
                      <option value={1}>P1</option>
                      <option value={2}>P2</option>
                      <option value={3}>P3</option>
                      <option value={4}>P4</option>
                      <option value={5}>OT</option>
                    </select>
                  </div>

                  <input
                    className="range"
                    type="range"
                    min={0}
                    max={720}
                    step={10}
                    value={Number.isFinite(timeRemaining) ? timeRemaining : 0}
                    onChange={(e) => setTimeRemaining(Number(e.target.value))}
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Time remaining: <strong>{secondsToClock(timeRemaining)}</strong>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Late factor: <strong>{fmt(lateFactorNow, 2)}</strong>
                    </div>
                  </div>

                  <div className="meter" aria-label="late factor meter">
                    <div style={{ width: `${clamp01(lateFactorNow) * 100}%` }} />
                  </div>
                </div>
              </div>

              <div className="divider" />

              <div className="panelTitle">
                <h2 style={{ margin: 0, fontSize: 16 }}>Context Policy Overlay</h2>
                <span className="pillMini">
                  <Icon name="sliders" /> Ensures re-ranking
                </span>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <label className="muted" style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={applyOverlay} onChange={(e) => setApplyOverlay(e.target.checked)} />
                  Apply overlay (recommended)
                </label>

                <label className="muted" style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
                  Strength
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={overlayStrength}
                    onChange={(e) => setOverlayStrength(Number(e.target.value))}
                    style={{ width: 110 }}
                  />
                </label>

                <label className="muted" style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={liveMode} onChange={(e) => setLiveMode(e.target.checked)} />
                  Live mode (auto-run)
                </label>

                <button className="btn" type="button" onClick={copyShareLink}>
                  <span className="btnIcon">
                    <Icon name="copy" /> Copy share link
                  </span>
                </button>
              </div>

              <div className="actionDock">
                <div className="actionLeft">
                  <button className="btn" type="button" onClick={runContext} disabled={!canRun || loading}>
                    <span className="btnIcon">
                      <Icon name="play" /> {loading ? "Running…" : "Run Context + ML"}
                    </span>
                  </button>

                  <button className="btn" type="button" onClick={() => setShowBreakdown((v) => !v)}>
                    <span className="btnIcon">
                      <Icon name="bolt" /> {showBreakdown ? "Hide breakdown" : "Show breakdown"}
                    </span>
                  </button>
                </div>

                <div className="actionRight">
                  <Link className="btn" href={baselineHref}>
                    Compare Baseline
                  </Link>
                  <Link className="btn" href="/model-metrics">
                    Model Performance
                  </Link>
                </div>
              </div>

              {/* I re-use the error slot as a tiny toast for quick feedback (copy success, validation, etc.). */}
              {error ? <div className="toast">{error}</div> : null}
            </div>

            <div className="grid" style={{ marginTop: 12 }}>
              <div className="kpi">
                <div className="label">Matchup</div>
                <div className="value" style={{ fontSize: 16, fontWeight: 900 }}>
                  {our || "—"} vs {opp || "—"}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {ourLabel || "—"} vs {oppLabel || "—"} • {season || "—"}
                </div>
              </div>

              <div className="kpi">
                <div className="label">Context</div>
                <div className="value">
                  P{period} • {secondsToClock(timeRemaining)} • margin {margin >= 0 ? `+${margin}` : margin}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  late {fmt(lateFactorNow, 2)} • trail {fmt(scoreFactorsNow.trailing, 2)} • lead{" "}
                  {fmt(scoreFactorsNow.leading, 2)}
                </div>
              </div>

              <div className="kpi">
                <div className="label">Top recommendation</div>
                <div className="value" style={{ fontSize: 16, fontWeight: 900 }}>
                  {bestRow ? bestRow.playType : "—"}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {bestRow
                    ? `PPP_display ${fmt(bestRow.finalPPP_display, 3)} (Δ ${
                        bestRow.deltaPPP_display >= 0 ? "+" : ""
                      }${fmt(bestRow.deltaPPP_display, 3)})`
                    : "Run to generate Top-K."}
                </div>
              </div>
            </div>

            {!loading && displayRows.length > 0 ? (
              <div className="subtleCard" style={{ marginTop: 12 }}>
                <div className="panelTitle">
                  <h2 style={{ margin: 0, fontSize: 16 }}>Top {Math.min(k, displayRows.length)} under this context</h2>
                  <span className="pillMini">
                    <Icon name="trend" /> Sorted by PPP_display
                  </span>
                </div>

                {/* Mobile view is cards because tables are painful on phones. */}
                <div className="mobileOnly" style={{ marginTop: 12 }}>
                  <div className="cardList">
                    {displayRows.map((r, idx) => {
                      const width = clamp01((Number(r.finalPPP_display) || 0) / maxPPP) * 100;
                      const d = Number(r.deltaPPP_display);
                      const sign = d >= 0 ? "+" : "";
                      return (
                        <div key={`${r.playType}-${idx}`} className="resultCard">
                          <div className="resultTop">
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                <span className="chip">#{idx + 1}</span>
                                {r.contextLabel ? <span className="chip">{r.contextLabel}</span> : null}
                                {applyOverlay ? (
                                  <span className="chip">
                                    <Icon name="sliders" /> overlay {fmt(r.overlay.overlayPPP, 3)}
                                  </span>
                                ) : null}
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 900 }}>{r.playType}</div>
                              <div className="muted" style={{ fontSize: 12 }}>
                                PPP_display <strong>{fmt(r.finalPPP_display, 3)}</strong> • Δ {sign}
                                <strong>{fmt(d, 3)}</strong>
                              </div>
                            </div>

                            <div className="chip">
                              <Icon name="spark" /> ML {fmt(r.mlPPP, 3)}
                            </div>
                          </div>

                          <div style={{ marginTop: 10 }} className="meter">
                            <div style={{ width: `${width}%` }} />
                          </div>

                          <details style={{ marginTop: 10 }}>
                            <summary style={{ cursor: "pointer", fontSize: 13 }}>Why this ranking?</summary>
                            <div className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
                              <div>
                                <strong>Baseline:</strong> {fmt(r.baselinePPP, 3)}
                              </div>
                              <div>
                                <strong>ML blend:</strong> {fmt(r.mlPPP, 3)}
                              </div>
                              <div>
                                <strong>Backend context:</strong> {fmt(r.finalPPP, 3)}
                              </div>
                              <div>
                                <strong>Overlay:</strong> {fmt(r.overlay.overlayPPP, 3)}
                              </div>
                              <div style={{ marginTop: 8 }}>{r.rationale}</div>
                            </div>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Desktop view uses a table since reviewers usually want raw numbers + breakdown columns. */}
                <div className="desktopOnly" style={{ marginTop: 12 }}>
                  <div className="tableWrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Play Type</th>
                          <th>Label</th>
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
                              <th>Trail</th>
                              <th>Lead</th>
                              <th>VarProxy</th>
                            </>
                          ) : null}

                          <th>Rationale</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayRows.map((r, idx) => {
                          const d = Number(r.deltaPPP_display);
                          const sign = d >= 0 ? "+" : "";
                          return (
                            <tr key={`${r.playType}-${idx}`}>
                              <td>{idx + 1}</td>
                              <td>
                                <strong>{r.playType}</strong>
                                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                                  bar:
                                  <span style={{ display: "inline-block", width: 8 }} />
                                  <span
                                    className="meter"
                                    style={{ display: "inline-block", width: 120, verticalAlign: "middle" }}
                                  >
                                    <span
                                      style={{
                                        display: "block",
                                        width: `${clamp01((Number(r.finalPPP_display) || 0) / maxPPP) * 100}%`,
                                      }}
                                    />
                                  </span>
                                </div>
                              </td>

                              <td>{r.contextLabel || "—"}</td>
                              <td>{fmt(r.finalPPP_display, 3)}</td>
                              <td>{fmt(r.finalPPP, 3)}</td>
                              <td>{fmt(r.mlPPP, 3)}</td>
                              <td>{fmt(r.baselinePPP, 3)}</td>
                              <td>
                                {sign}
                                {fmt(d, 3)}
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
                                </>
                              ) : null}

                              <td style={{ fontSize: 12 }}>
                                {r.rationale}
                                {applyOverlay ? (
                                  <span className="muted">
                                    {" "}
                                    (overlay: {fmt(r.overlay.overlayPPP, 3)} | late {fmt(r.overlay.lateFactor, 2)} | trail{" "}
                                    {fmt(r.overlay.trailingFactor, 2)} | lead {fmt(r.overlay.leadingFactor, 2)})
                                  </span>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* RIGHT SIDE = “reviewer-friendly” explanation panel */}
          <div className="stickyRight">
            <div className="subtleCard">
              <div className="panelTitle">
                <h2 style={{ margin: 0, fontSize: 16 }}>What reviewers should notice</h2>
                <span className="pillMini">
                  <Icon name="shield" /> Defendable AI usage
                </span>
              </div>

              <div className="divider" />

              <div style={{ display: "grid", gap: 10 }}>
                <div className="kpi">
                  <div className="label">Clear separation</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
                    <strong>Baseline page</strong> shows explainable math.
                    <br />
                    <strong>This page</strong> adds ML + context policy that re-ranks.
                  </div>
                </div>

                <div className="kpi">
                  <div className="label">Why it’s “AI”</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
                    We show the full chain:
                    <br />
                    baselinePPP → mlPPP → finalPPP (backend) → finalPPP_display (overlay).
                  </div>
                </div>

                <div className="kpi">
                  <div className="label">Live proof</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
                    Change <strong>margin / time</strong> and the Top-K changes (enable Live mode).
                  </div>
                </div>
              </div>

              <div className="divider" />

              <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Next steps</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link className="btn" href="/model-metrics">
                  Model Performance
                </Link>
                <Link className="btn" href={baselineHref}>
                  Compare Baseline
                </Link>
              </div>

              <div className="divider" />

              <button className="btn" type="button" onClick={copyShareLink}>
                <span className="btnIcon">
                  <Icon name="copy" /> Copy scenario link
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ContextPage() {
  return (
    <Suspense
      fallback={
        <section className="card">
          <div style={{ padding: 16 }}>Loading…</div>
        </section>
      }
    >
      <ContextInner />
    </Suspense>
  );
}
