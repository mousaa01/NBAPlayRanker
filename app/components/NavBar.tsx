// components/NavBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";

type NavItem = { href: string; label: string };
type NavGroup = { heading: string; items: NavItem[] };
type MenuKey = "playtype" | "pbp" | null;

const PANEL_DESCS: Record<string, { desc: string; tag?: string }> = {
  "/matchup": { desc: "Baseline blended PPP by play type.", tag: "Baseline" },
  "/context": { desc: "Adjust rankings by game situation (time/score).", tag: "AI" },
  "/model-metrics": { desc: "Holdout metrics to defend model choice.", tag: "Metrics" },
  "/statistical-analysis": { desc: "EDA, correlations, feature selection, tuning.", tag: "EDA" },

  "/shot-plan": { desc: "Best shot plan by zone/type + optional shooter.", tag: "Baseline" },
  "/shot-explorer": { desc: "Explore Dataset2 shots with filters.", tag: "Explore" },
  "/shot-heatmap": { desc: "Real shot heatmap rendered from play-by-play.", tag: "Viz" },
  "/shot-model-metrics": { desc: "Holdout metrics (GroupKFold by GAME_ID).", tag: "Metrics" },
  "/shot-statistical-analysis": { desc: "EDA + tuning for shot intelligence features.", tag: "EDA" },
};

export default function NavBar() {
  const pathname = usePathname();

  const headerRef = useRef<HTMLElement | null>(null);
  const playBtnRef = useRef<HTMLButtonElement | null>(null);
  const pbpBtnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<MenuKey>(null);

  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 420,
  });

  // Primary links
  const topHome: NavItem = useMemo(() => ({ href: "/", label: "Home" }), []);
  const dataExplorer: NavItem = useMemo(() => ({ href: "/data-explorer", label: "Data Explorer" }), []);
  const glossary: NavItem = useMemo(() => ({ href: "/glossary", label: "Glossary" }), []);
  const gamePlan: NavItem = useMemo(() => ({ href: "/gameplan", label: "Gameplan" }), []);

  const playTypeLinks: NavItem[] = useMemo(
    () => [
      { href: "/matchup", label: "Matchup (Baseline)" },
      { href: "/context", label: "Context Simulator (AI)" },
      { href: "/model-metrics", label: "Model Performance" },
      { href: "/statistical-analysis", label: "Statistical Analysis" },
    ],
    []
  );

  const pbpLinks: NavItem[] = useMemo(
    () => [
      { href: "/shot-plan", label: "Shot Plan (Baseline)" },
      { href: "/shot-explorer", label: "Shot Explorer" },
      { href: "/shot-heatmap", label: "Shot Heatmap" },
      { href: "/shot-model-metrics", label: "Shot Model Metrics" },
      { href: "/shot-statistical-analysis", label: "Shot Statistical Analysis" },
    ],
    []
  );

  // ✅ Better-looking group headings (UI only — same links/functions)
  const playTypeGroups: NavGroup[] = useMemo(
    () => [
      {
        heading: "Recommend",
        items: [
          { href: "/matchup", label: "Matchup (Baseline)" },
          { href: "/context", label: "Context Simulator (AI)" },
        ],
      },
      {
        heading: "Defend",
        items: [
          { href: "/model-metrics", label: "Model Performance" },
          { href: "/statistical-analysis", label: "Statistical Analysis" },
        ],
      },
    ],
    []
  );

  const pbpGroups: NavGroup[] = useMemo(
    () => [
      {
        heading: "Plan",
        items: [{ href: "/shot-plan", label: "Shot Plan (Baseline)" }],
      },
      {
        heading: "Visualize",
        items: [
          { href: "/shot-explorer", label: "Shot Explorer" },
          { href: "/shot-heatmap", label: "Shot Heatmap" },
        ],
      },
      {
        heading: "Defend",
        items: [
          { href: "/shot-model-metrics", label: "Shot Model Metrics" },
          { href: "/shot-statistical-analysis", label: "Shot Statistical Analysis" },
        ],
      },
    ],
    []
  );

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(null);
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  }

  function closeAll() {
    setMenuOpen(null);
    setMobileOpen(false);
  }

  function anyActive(items: NavItem[]) {
    return items.some((i) => isActive(i.href));
  }

  // ✅ SMALL dropdown sizing (no mega menu)
  function desiredPanelWidth(kind: Exclude<MenuKey, null>, viewportW: number) {
    // ensure it never overflows the viewport
    const maxAllowed = Math.max(280, viewportW - 24);
    const target = kind === "playtype" ? 360 : 420;
    const min = 280;
    return Math.max(min, Math.min(target, maxAllowed));
  }

  function computePanelPosition(anchorEl: HTMLElement | null, kind: Exclude<MenuKey, null>) {
    if (!anchorEl) return;

    const rect = anchorEl.getBoundingClientRect();
    const viewportW = window.innerWidth;

    const desired = desiredPanelWidth(kind, viewportW);
    const top = Math.round(rect.bottom + 10);

    // ✅ left-align like a normal dropdown + clamp to viewport
    const left = Math.round(Math.max(12, Math.min(rect.left, viewportW - desired - 12)));

    setPanelPos({ top, left, width: desired });
  }

  useEffect(() => {
    if (!menuOpen) return;

    const anchor = menuOpen === "playtype" ? playBtnRef.current : pbpBtnRef.current;
    computePanelPosition(anchor, menuOpen);

    function onResizeOrScroll() {
      if (!menuOpen) return;
      const a = menuOpen === "playtype" ? playBtnRef.current : pbpBtnRef.current;
      computePanelPosition(a, menuOpen);
    }

    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    return () => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      const inHeader = headerRef.current?.contains(t);
      const inPanel = panelRef.current?.contains(t);
      if (!inHeader && !inPanel) setMenuOpen(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function NavLink({
    item,
    className,
    block,
    cta,
  }: {
    item: NavItem;
    className?: string;
    block?: boolean;
    cta?: boolean;
  }) {
    const active = isActive(item.href);

    // ✅ inline fallback so the CTA never “washes out”
    const ctaStyle: React.CSSProperties | undefined = cta
      ? {
          background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 55%, #ec4899 100%)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.26)",
          textDecoration: "none",
        }
      : { textDecoration: "none" };

    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={() => closeAll()}
        className={`${className ?? ""} ${active ? "npr-active" : ""} ${cta ? "npr-cta" : ""}`}
        style={{
          ...ctaStyle,
          display: block ? "block" : "inline-flex",
          width: block ? "100%" : undefined,
        }}
      >
        {item.label}
      </Link>
    );
  }

  // ✅ Dropdown menu items: LINKS ONLY (no headers, no tags, no descriptions)
  function PanelItem({ it }: { it: NavItem }) {
    const active = isActive(it.href);

    // keep meta available in code (unused visually) to avoid changing structure elsewhere
    const meta = PANEL_DESCS[it.href];
    void meta;

    return (
      <Link
        href={it.href}
        role="menuitem"
        aria-current={active ? "page" : undefined}
        onClick={() => closeAll()}
        className={`npr-dd-item ${active ? "npr-active" : ""}`}
        style={{ textDecoration: "none" }}
      >
        {it.label}
      </Link>
    );
  }

  function DropdownPanel({
    title,
    subtitle,
    groups,
    kind,
  }: {
    title: string;
    subtitle: string;
    groups: NavGroup[];
    kind: "playtype" | "pbp";
  }) {
    // ✅ Flatten to a simple list (no headings/extra writing in the UI)
    const items = groups.flatMap((g) => g.items);

    return (
      <div
        ref={panelRef}
        role="menu"
        aria-label={title}
        className={`npr-panel ${kind}`}
        style={{
          position: "fixed",
          top: panelPos.top,
          left: panelPos.left,
          width: panelPos.width,
          zIndex: 1000,
          maxHeight: "calc(100vh - 140px)",
          overflow: "auto",
        }}
      >
        <div className="npr-panel-frame">
          <div className="npr-dd-list" aria-label={subtitle}>
            {items.map((it, idx) => (
              <React.Fragment key={it.href}>
                <PanelItem it={it} />
                {idx !== items.length - 1 ? <div className="npr-dd-divider" aria-hidden /> : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <header ref={headerRef} className="npr-header">
      <div className="npr-bar">
        <div className="npr-brand">
          <div className="npr-mark" aria-hidden>
  <svg className="npr-mark-icon" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.92)" strokeWidth="1.8" />
    <path d="M12 3v18" stroke="rgba(255,255,255,0.92)" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M3 12h18" stroke="rgba(255,255,255,0.92)" strokeWidth="1.4" strokeLinecap="round" />
    <path
      d="M6.2 5.2c2.8 3 4.1 5.6 4.1 6.8s-1.3 3.8-4.1 6.8"
      stroke="rgba(255,255,255,0.92)"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <path
      d="M17.8 5.2c-2.8 3-4.1 5.6-4.1 6.8s1.3 3.8 4.1 6.8"
      stroke="rgba(255,255,255,0.92)"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
</div>

          <div className="npr-brand-text">
            <Link href="/" className="npr-brand-title" onClick={() => closeAll()} style={{ textDecoration: "none" }}>
              NBA Play Ranker
            </Link>
            <div className="npr-brand-sub">Decision Support • Explainable + AI</div>
          </div>
        </div>

        <nav className="npr-nav" aria-label="Primary navigation">
          <NavLink item={topHome} className="npr-link" />
          <NavLink item={dataExplorer} className="npr-link" />

          <div className="npr-dd">
            <button
              ref={playBtnRef}
              type="button"
              className={`npr-dd-trigger ${menuOpen === "playtype" ? "open" : ""} ${
                anyActive(playTypeLinks) ? "npr-active" : ""
              }`}
              aria-haspopup="menu"
              aria-expanded={menuOpen === "playtype"}
              onClick={() => setMenuOpen((v) => (v === "playtype" ? null : "playtype"))}
            >
              <span className="npr-dd-dot" aria-hidden />
              Play Type
              <span className="npr-caret" aria-hidden>
                ▾
              </span>
            </button>
          </div>

          <div className="npr-dd">
            <button
              ref={pbpBtnRef}
              type="button"
              className={`npr-dd-trigger ${menuOpen === "pbp" ? "open" : ""} ${anyActive(pbpLinks) ? "npr-active" : ""}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen === "pbp"}
              onClick={() => setMenuOpen((v) => (v === "pbp" ? null : "pbp"))}
            >
              <span className="npr-dd-dot red" aria-hidden />
              Play-by-Play
              <span className="npr-caret" aria-hidden>
                ▾
              </span>
            </button>
          </div>

          <NavLink item={gamePlan} className="npr-link" cta />
          <NavLink item={glossary} className="npr-link" />
        </nav>

        <button
          className="npr-burger"
          type="button"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          onClick={() => {
            setMobileOpen((v) => !v);
            setMenuOpen(null);
          }}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {menuOpen === "playtype" && (
        <DropdownPanel
          kind="playtype"
          title="Play Type Analysis"
          subtitle="Baseline + context AI recommendations and defensible evaluation."
          groups={playTypeGroups}
        />
      )}
      {menuOpen === "pbp" && (
        <DropdownPanel
          kind="pbp"
          title="Play-by-Play Analysis"
          subtitle="Shot planning, exploration, heatmaps, and model defense for Dataset2."
          groups={pbpGroups}
        />
      )}

      {/* Mobile menu */}
      <div className={`npr-mobile ${mobileOpen ? "open" : ""}`} aria-label="Mobile navigation">
        <NavLink item={topHome} className="npr-mobile-link" block />
        <NavLink item={dataExplorer} className="npr-mobile-link" block />

        <details className="npr-mobile-dd">
          <summary>Play Type Analysis</summary>
          <div className="npr-mobile-dd-list">
            {playTypeLinks.map((it) => (
              <NavLink key={it.href} item={it} className="npr-mobile-sub" block />
            ))}
          </div>
        </details>

        <details className="npr-mobile-dd">
          <summary>Play-by-Play Analysis</summary>
          <div className="npr-mobile-dd-list">
            {pbpLinks.map((it) => (
              <NavLink key={it.href} item={it} className="npr-mobile-sub" block />
            ))}
          </div>
        </details>

        <NavLink item={gamePlan} className="npr-mobile-link npr-cta-mobile" block cta />
        <NavLink item={glossary} className="npr-mobile-link" block />
      </div>

      <style jsx>{`
        /* =========================================================
           Header: more vibrant + “product” feel
        ========================================================= */
        .npr-header {
          position: sticky;
          top: 0;
          z-index: 60;
          background: rgba(255, 255, 255, 0.78);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }

        .npr-header::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(900px 120px at 15% -40%, rgba(29, 66, 138, 0.22) 0%, transparent 60%),
            radial-gradient(850px 120px at 85% -35%, rgba(200, 16, 46, 0.16) 0%, transparent 60%);
          opacity: 0.9;
        }

        .npr-bar {
          position: relative;
          max-width: 1200px;
          margin: 0 auto;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        /* =========================================================
           Brand
        ========================================================= */
        .npr-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 260px;
        }

        .npr-mark {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.55) 35%, transparent 65%),
            linear-gradient(135deg, #1d428a 0%, #7c3aed 55%, #c8102e 100%);
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.35);
        }

        .npr-mark {
  display: grid;
  place-items: center;
}

.npr-mark-icon {
  width: 30px;
  height: 30px;
  filter: drop-shadow(0 2px 6px rgba(15, 23, 42, 0.25));
  opacity: 0.95;
}


        .npr-brand-text {
          display: grid;
          gap: 2px;
        }

        .npr-brand-title {
          font-weight: 900;
          font-size: 18px;
          letter-spacing: -0.35px;
          line-height: 1.1;
          color: #0f172a;
          position: relative;
          display: inline-block;
        }

        .npr-brand-title::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -6px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            rgba(29, 66, 138, 0),
            rgba(29, 66, 138, 0.85),
            rgba(200, 16, 46, 0.75),
            rgba(200, 16, 46, 0)
          );
          opacity: 0.75;
          transform: scaleX(0.55);
          transform-origin: left;
          transition: transform 220ms ease, opacity 220ms ease;
        }

        .npr-brand:hover .npr-brand-title::after {
          transform: scaleX(1);
          opacity: 1;
        }

        .npr-brand-sub {
          font-size: 12px;
          color: rgba(15, 23, 42, 0.62);
          letter-spacing: -0.1px;
        }

        /* =========================================================
           Desktop nav links
        ========================================================= */
        .npr-nav {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: nowrap;
        }

        .npr-link {
          color: rgba(15, 23, 42, 0.88);
          padding: 10px 12px;
          border-radius: 999px;
          font-weight: 750;
          line-height: 1;
          white-space: nowrap;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.55);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
          transition: background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
        }

        .npr-link:not(.npr-cta):hover {
          background: rgba(255, 255, 255, 0.92);
          border-color: rgba(29, 66, 138, 0.18);
          transform: translateY(-1px);
          box-shadow: 0 14px 26px rgba(15, 23, 42, 0.1);
        }

        .npr-link.npr-active:not(.npr-cta) {
          background: rgba(29, 66, 138, 0.1);
          border-color: rgba(29, 66, 138, 0.22);
          box-shadow: 0 14px 30px rgba(29, 66, 138, 0.14);
        }

        /* =========================================================
           Dropdown triggers
        ========================================================= */
        .npr-dd-trigger {
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.55);
          cursor: pointer;
          padding: 10px 12px;
          border-radius: 999px;
          font-weight: 850;
          color: rgba(15, 23, 42, 0.9);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
          transition: background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
        }

        .npr-dd-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(29, 66, 138, 0.95);
          box-shadow: 0 0 0 4px rgba(29, 66, 138, 0.12);
        }

        .npr-dd-dot.red {
          background: rgba(200, 16, 46, 0.95);
          box-shadow: 0 0 0 4px rgba(200, 16, 46, 0.12);
        }

        .npr-dd-trigger:hover {
          background: rgba(255, 255, 255, 0.92);
          border-color: rgba(15, 23, 42, 0.1);
          transform: translateY(-1px);
          box-shadow: 0 14px 26px rgba(15, 23, 42, 0.1);
        }

        .npr-caret {
          font-size: 12px;
          opacity: 0.8;
          transition: transform 180ms ease;
        }

        .npr-dd-trigger.open .npr-caret {
          transform: rotate(180deg);
        }

        .npr-dd-trigger.npr-active {
          border-color: rgba(29, 66, 138, 0.22);
          background: rgba(29, 66, 138, 0.08);
          box-shadow: 0 14px 30px rgba(29, 66, 138, 0.14);
        }

        /* =========================================================
           Gameplan CTA
        ========================================================= */
        .npr-cta {
          font-weight: 900;
          position: relative;
          overflow: hidden;
          box-shadow: 0 16px 34px rgba(37, 99, 235, 0.26);
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.15);
        }

        .npr-link.npr-cta:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 22px 50px rgba(37, 99, 235, 0.34) !important;
          filter: brightness(1.06) saturate(1.06);
          border-color: rgba(255, 255, 255, 0.36) !important;
        }

        .npr-link.npr-cta.npr-active {
          box-shadow: 0 24px 60px rgba(124, 58, 237, 0.32) !important;
          outline: 2px solid rgba(255, 255, 255, 0.55);
          outline-offset: 2px;
          filter: saturate(1.08);
        }

        .npr-cta::after {
          content: "";
          position: absolute;
          top: -60%;
          left: -40%;
          width: 60%;
          height: 220%;
          background: rgba(255, 255, 255, 0.18);
          transform: rotate(25deg);
          transition: left 520ms ease;
          pointer-events: none;
        }

        .npr-cta:hover::after {
          left: 140%;
        }

        /* =========================================================
           ✅ Dropdown panel: SOLID, CLEAN, LINKS ONLY
        ========================================================= */
        .npr-panel {
          animation: nprPop 140ms ease-out;
        }

        @keyframes nprPop {
          from {
            transform: translateY(-6px) scale(0.985);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        /* SOLID menu frame (no transparency) */
        .npr-panel-frame {
          border-radius: 14px;
          padding: 8px;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.14);
          box-shadow: 0 22px 60px rgba(15, 23, 42, 0.18);
          position: relative;
          overflow: hidden;
        }

        /* simple single-column list */
        .npr-dd-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
        }

        .npr-dd-divider {
          height: 1px;
          margin: 2px 6px;
          background: rgba(15, 23, 42, 0.08);
          border-radius: 999px;
        }

        .npr-dd-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.02);
          border: 1px solid rgba(15, 23, 42, 0.08);
          color: rgba(15, 23, 42, 0.92);
          font-weight: 850;
          font-size: 13px;
          letter-spacing: -0.2px;
          white-space: nowrap;
          transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
        }

        .npr-dd-item:hover {
          background: rgba(15, 23, 42, 0.04);
          border-color: rgba(15, 23, 42, 0.12);
          transform: translateY(-1px);
        }

        .npr-dd-item:focus-visible {
          outline: 2px solid rgba(29, 66, 138, 0.35);
          outline-offset: 2px;
        }

        .npr-dd-item.npr-active {
          background: rgba(29, 66, 138, 0.1);
          border-color: rgba(29, 66, 138, 0.22);
        }

        /* =========================================================
           Burger + Mobile
        ========================================================= */
        .npr-burger {
          display: none;
          border: 1px solid rgba(15, 23, 42, 0.14);
          background: rgba(255, 255, 255, 0.9);
          border-radius: 14px;
          padding: 10px;
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
        }

        .npr-burger span {
          display: block;
          width: 18px;
          height: 2px;
          background: rgba(15, 23, 42, 0.85);
          margin: 4px 0;
          border-radius: 999px;
        }

        .npr-mobile {
          display: none;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 16px 14px 16px;
        }

        .npr-mobile.open {
          display: block;
        }

        .npr-mobile-link {
          display: block;
          padding: 12px 12px;
          border-radius: 16px;
          font-weight: 900;
          color: rgba(15, 23, 42, 0.9);
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(15, 23, 42, 0.1);
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
          margin-top: 8px;
        }

        .npr-mobile-link:hover {
          background: rgba(255, 255, 255, 0.95);
        }

        .npr-mobile-dd {
          margin-top: 10px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 16px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.85);
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
        }

        .npr-mobile-dd summary {
          cursor: pointer;
          font-weight: 950;
          list-style: none;
          color: rgba(15, 23, 42, 0.9);
        }

        .npr-mobile-dd summary::-webkit-details-marker {
          display: none;
        }

        .npr-mobile-dd-list {
          margin-top: 10px;
          display: grid;
          gap: 8px;
        }

        .npr-mobile-sub {
          display: block;
          padding: 10px 10px;
          border-radius: 14px;
          font-weight: 750;
          color: rgba(15, 23, 42, 0.88);
          background: rgba(15, 23, 42, 0.03);
          border: 1px solid rgba(15, 23, 42, 0.08);
        }

        .npr-mobile-sub:hover {
          background: rgba(15, 23, 42, 0.05);
        }

        @media (max-width: 980px) {
          .npr-nav {
            display: none;
          }
          .npr-burger {
            display: inline-block;
          }
        }
      `}</style>
    </header>
  );
}
