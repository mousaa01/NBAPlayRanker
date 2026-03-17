// components/NavBar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type NavItem = { href: string; label: string };
type MenuKey = null; // no dropdowns for now
type UserRole = "coach" | "analyst" | null;

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const headerRef = useRef<HTMLElement | null>(null);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<MenuKey>(null);
  void menuOpen; // kept so structure doesn't shift later when you re-enable RBAC menus

  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Shared links
  const topHome: NavItem = useMemo(() => ({ href: "/", label: "Home" }), []);
  const glossary: NavItem = useMemo(() => ({ href: "/glossary", label: "Glossary" }), []);

  // Coach-only links
  const matchupBaseline: NavItem = useMemo(() => ({ href: "/matchup", label: "Matchup / Baseline" }), []);
  const contextML: NavItem = useMemo(() => ({ href: "/context", label: "Context / ML" }), []);
  const gamePlan: NavItem = useMemo(() => ({ href: "/gameplan", label: "Gameplan" }), []);

  // Analyst-only links
  const dataExplorer: NavItem = useMemo(() => ({ href: "/data-explorer", label: "Data Explorer" }), []);
  const modelPerformance: NavItem = useMemo(() => ({ href: "/model-metrics", label: "Model Performance" }), []);

  // ✅ Future pages (RBAC-ready)
  // const statisticalAnalysis: NavItem = useMemo(
  //   () => ({ href: "/statistical-analysis", label: "Statistical Analysis" }),
  //   []
  // );
  // const shotPlan: NavItem = useMemo(() => ({ href: "/shot-plan", label: "Shot Plan" }), []);
  // const shotExplorer: NavItem = useMemo(() => ({ href: "/shot-explorer", label: "Shot Explorer" }), []);
  // const shotHeatmap: NavItem = useMemo(() => ({ href: "/shot-heatmap", label: "Shot Heatmap" }), []);
  // const shotModelMetrics: NavItem = useMemo(() => ({ href: "/shot-model-metrics", label: "Shot Model Metrics" }), []);
  // const shotStatisticalAnalysis: NavItem = useMemo(
  //   () => ({ href: "/shot-statistical-analysis", label: "Shot Statistical Analysis" }),
  //   []
  // );

  const sharedLinks = useMemo<NavItem[]>(() => [topHome, glossary], [topHome, glossary]);
  const coachLinks = useMemo<NavItem[]>(
    () => [matchupBaseline, contextML, gamePlan],
    [matchupBaseline, contextML, gamePlan]
  );
  const analystLinks = useMemo<NavItem[]>(
    () => [dataExplorer, modelPerformance],
    [dataExplorer, modelPerformance]
  );

  const visibleLinks = useMemo<NavItem[]>(() => {
    if (userRole === "coach") return [...sharedLinks, ...coachLinks];
    if (userRole === "analyst") return [...sharedLinks, ...analystLinks];
    return sharedLinks;
  }, [userRole, sharedLinks, coachLinks, analystLinks]);

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

  async function loadProfile() {
    setAuthLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setUserRole(null);
      setUserEmail(null);
      setAuthLoading(false);
      return;
    }

    setUserEmail(user.email ?? null);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const roleFromProfile = profile?.role as UserRole | undefined;
    const roleFromMetadata =
      user.user_metadata?.role === "coach" || user.user_metadata?.role === "analyst"
        ? (user.user_metadata.role as UserRole)
        : null;

    setUserRole(roleFromProfile ?? roleFromMetadata ?? null);
    setAuthLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      await loadProfile();
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      if (!mounted) return;
      await loadProfile();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      const inHeader = headerRef.current?.contains(t);
      if (!inHeader) setMenuOpen(null);
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    closeAll();
    setUserRole(null);
    setUserEmail(null);
    router.push("/login");
    router.refresh();
  }

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

  function DesktopAuth() {
    if (authLoading) {
      return (
        <div className="npr-auth-shell" aria-hidden>
          <div className="npr-auth-loading">Loading…</div>
        </div>
      );
    }

    if (!userEmail) {
      return (
        <div className="npr-auth-shell">
          <Link href="/login" className="npr-auth-link" onClick={() => closeAll()}>
            Log in
          </Link>
          <Link href="/signup" className="npr-auth-link npr-auth-primary" onClick={() => closeAll()}>
            Sign up
          </Link>
        </div>
      );
    }

    return (
      <div className="npr-auth-shell">
        <div className="npr-role-badge">
          <span className="npr-role-dot" aria-hidden />
          {userRole === "coach" ? "Coach" : userRole === "analyst" ? "Analyst" : "User"}
        </div>
        <button type="button" className="npr-auth-link" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    );
  }

  function MobileAuth() {
    if (authLoading) {
      return <div className="npr-mobile-meta">Loading account…</div>;
    }

    if (!userEmail) {
      return (
        <>
          <Link href="/login" className="npr-mobile-link" onClick={() => closeAll()}>
            Log in
          </Link>
          <Link href="/signup" className="npr-mobile-link npr-mobile-primary" onClick={() => closeAll()}>
            Sign up
          </Link>
        </>
      );
    }

    return (
      <>
        <div className="npr-mobile-meta">
          Signed in as {userRole === "coach" ? "Coach" : userRole === "analyst" ? "Analyst" : "User"}
        </div>
        <button type="button" className="npr-mobile-link npr-mobile-button" onClick={handleSignOut}>
          Sign out
        </button>
      </>
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

        {/* Desktop nav */}
        <nav className="npr-nav" aria-label="Primary navigation">
          {visibleLinks.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              className="npr-link"
              cta={item.href === "/gameplan"}
            />
          ))}
        </nav>

        <div className="npr-desktop-auth">
          <DesktopAuth />
        </div>

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

      {/* Mobile menu */}
      <div className={`npr-mobile ${mobileOpen ? "open" : ""}`} aria-label="Mobile navigation">
        {visibleLinks.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            className={`npr-mobile-link ${item.href === "/gameplan" ? "npr-cta-mobile" : ""}`}
            block
            cta={item.href === "/gameplan"}
          />
        ))}

        <MobileAuth />

        {/* Future pages (RBAC-ready) */}
        {/*
        <NavLink item={statisticalAnalysis} className="npr-mobile-link" block />
        <NavLink item={shotPlan} className="npr-mobile-link" block />
        <NavLink item={shotExplorer} className="npr-mobile-link" block />
        <NavLink item={shotHeatmap} className="npr-mobile-link" block />
        <NavLink item={shotModelMetrics} className="npr-mobile-link" block />
        <NavLink item={shotStatisticalAnalysis} className="npr-mobile-link" block />
        */}
      </div>

      <style jsx>{`
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
          max-width: 1260px;
          margin: 0 auto;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .npr-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 260px;
          flex-shrink: 0;
        }

        .npr-mark {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          background: radial-gradient(
              circle at 35% 30%,
              rgba(255, 255, 255, 0.95) 0%,
              rgba(255, 255, 255, 0.55) 35%,
              transparent 65%
            ),
            linear-gradient(135deg, #1d428a 0%, #7c3aed 55%, #c8102e 100%);
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.35);
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

        .npr-nav {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: nowrap;
          min-width: 0;
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

        .npr-desktop-auth {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          min-width: 170px;
          flex-shrink: 0;
        }

        .npr-auth-shell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .npr-auth-loading {
          padding: 10px 12px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.72);
          background: rgba(255, 255, 255, 0.65);
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
        }

        .npr-auth-link {
          appearance: none;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: rgba(255, 255, 255, 0.75);
          color: rgba(15, 23, 42, 0.9);
          padding: 10px 12px;
          border-radius: 999px;
          font-weight: 800;
          line-height: 1;
          text-decoration: none;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
          transition: background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
        }

        .npr-auth-link:hover {
          background: rgba(255, 255, 255, 0.96);
          border-color: rgba(29, 66, 138, 0.18);
          transform: translateY(-1px);
          box-shadow: 0 14px 26px rgba(15, 23, 42, 0.1);
        }

        .npr-auth-primary {
          background: linear-gradient(135deg, #1d428a 0%, #2563eb 48%, #7c3aed 100%);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.18);
        }

        .npr-auth-primary:hover {
          filter: brightness(1.04);
        }

        .npr-role-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 999px;
          font-weight: 850;
          font-size: 13px;
          color: #0f172a;
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
        }

        .npr-role-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(135deg, #2563eb 0%, #7c3aed 60%, #ec4899 100%);
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }

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
          width: 100%;
          padding: 12px 12px;
          border-radius: 16px;
          font-weight: 900;
          color: rgba(15, 23, 42, 0.9);
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(15, 23, 42, 0.1);
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
          margin-top: 8px;
          text-decoration: none;
        }

        .npr-mobile-link:hover {
          background: rgba(255, 255, 255, 0.95);
        }

        .npr-mobile-button {
          appearance: none;
          text-align: left;
          cursor: pointer;
        }

        .npr-mobile-primary {
          background: linear-gradient(135deg, #1d428a 0%, #2563eb 48%, #7c3aed 100%);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.18);
        }

        .npr-mobile-meta {
          margin-top: 10px;
          padding: 12px 14px;
          border-radius: 16px;
          font-weight: 800;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.78);
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
        }

        @media (max-width: 1180px) {
          .npr-link {
            padding: 10px 10px;
            font-size: 14px;
          }
        }

        @media (max-width: 980px) {
          .npr-nav,
          .npr-desktop-auth {
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