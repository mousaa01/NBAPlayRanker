"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type UserRole = "coach" | "analyst" | null;

type NavItem = {
  href: string;
  label: string;
  accent?: boolean;
};

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const headerRef = useRef<HTMLElement | null>(null);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const publicPrimaryLinks = useMemo<NavItem[]>(() => [{ href: "/", label: "Home" }], []);
  const signedInPrimaryLinks = useMemo<NavItem[]>(
    () => [
      { href: "/", label: "Home" },
      { href: "/glossary", label: "Glossary" },
    ],
    []
  );

  const coachWorkspaceLinks = useMemo<NavItem[]>(
    () => [
      { href: "/matchup", label: "Matchup / Baseline" },
      { href: "/context", label: "Context / ML" },
      { href: "/gameplan", label: "Gameplan", accent: true },
    ],
    []
  );

  const analystWorkspaceLinks = useMemo<NavItem[]>(
    () => [
      { href: "/data-explorer", label: "Data Explorer" },
      { href: "/model-metrics", label: "Model Metrics" },
      { href: "/statistical-analysis", label: "Statistical Analysis" },
      { href: "/shot-explorer", label: "Shot Explorer" },
      { href: "/shot-heatmap", label: "Shot Heatmap" },
      { href: "/shot-plan", label: "Shot Plan" },
      { href: "/shot-model-metrics", label: "Shot Model Metrics" },
      { href: "/shot-statistical-analysis", label: "Shot Statistical Analysis" },
    ],
    []
  );

  const primaryLinks = userEmail ? signedInPrimaryLinks : publicPrimaryLinks;

  const workspaceLinks = useMemo<NavItem[]>(() => {
    if (userRole === "coach") return coachWorkspaceLinks;
    if (userRole === "analyst") return analystWorkspaceLinks;
    return [];
  }, [userRole, coachWorkspaceLinks, analystWorkspaceLinks]);

  const workspaceLabel =
    userRole === "coach"
      ? "Coach workspace"
      : userRole === "analyst"
      ? "Analyst workspace"
      : null;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  function closeAll() {
    setMobileOpen(false);
  }

  async function loadProfile() {
    setAuthLoading(true);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      setUserEmail(null);
      setUserRole(null);
      setAuthLoading(false);
      return;
    }

    setUserEmail(user.email ?? null);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const metadataRole =
      user.user_metadata?.role === "coach" || user.user_metadata?.role === "analyst"
        ? (user.user_metadata.role as UserRole)
        : null;

    setUserRole(((profile?.role as UserRole | undefined) ?? metadataRole ?? null) as UserRole);
    setAuthLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!mounted) return;
      await loadProfile();
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (!mounted) return;
      loadProfile();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      const inside = headerRef.current?.contains(target);
      if (!inside) setMobileOpen(false);
    }

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUserEmail(null);
    setUserRole(null);
    setMobileOpen(false);
    router.push("/");
    router.refresh();
  }

  function NavLink({
    item,
    mobile = false,
    workspace = false,
  }: {
    item: NavItem;
    mobile?: boolean;
    workspace?: boolean;
  }) {
    const active = isActive(item.href);

    const className = [
      "npr-link",
      mobile ? "npr-link-mobile" : "",
      workspace ? "npr-link-workspace" : "",
      item.accent ? "npr-link-accent" : "",
      active ? "npr-link-active" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <Link
        href={item.href}
        className={className}
        aria-current={active ? "page" : undefined}
        onClick={closeAll}
      >
        {item.label}
      </Link>
    );
  }

  function DesktopAuth() {
    if (authLoading) {
      return <div className="npr-status-pill">Loading…</div>;
    }

    if (!userEmail) {
      return (
        <div className="npr-auth-group">
          <Link href="/login" className="npr-auth-link" onClick={closeAll}>
            Log in
          </Link>
          <Link href="/signup" className="npr-auth-link npr-auth-link-primary" onClick={closeAll}>
            Sign up
          </Link>
        </div>
      );
    }

    return (
      <div className="npr-auth-group">
        <div className="npr-status-pill">
          <span className="npr-status-dot" aria-hidden />
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
        <div className="npr-mobile-auth">
          <Link href="/login" className="npr-auth-link npr-auth-link-mobile" onClick={closeAll}>
            Log in
          </Link>
          <Link
            href="/signup"
            className="npr-auth-link npr-auth-link-primary npr-auth-link-mobile"
            onClick={closeAll}
          >
            Sign up
          </Link>
        </div>
      );
    }

    return (
      <div className="npr-mobile-auth">
        <div className="npr-mobile-meta">
          Signed in as {userRole === "coach" ? "Coach" : userRole === "analyst" ? "Analyst" : "User"}
        </div>
        <button
          type="button"
          className="npr-auth-link npr-auth-link-mobile"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <header ref={headerRef} className="npr-header">
      <div className="npr-shell">
        <div className="npr-topbar">
          <div className="npr-brand">
            <Link href="/" className="npr-brand-wrap" onClick={closeAll}>
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

              <div className="npr-brand-copy">
                <div className="npr-brand-title">NBA Play Ranker</div>
                <div className="npr-brand-subtitle">Decision Support • Explainable + AI</div>
              </div>
            </Link>
          </div>

          <div className="npr-desktop">
            <nav className="npr-primary-nav" aria-label="Primary navigation">
              {primaryLinks.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </nav>

            <DesktopAuth />
          </div>

          <button
            type="button"
            className={`npr-burger ${mobileOpen ? "open" : ""}`}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {userEmail && workspaceLinks.length > 0 ? (
          <div className="npr-workspace-row">
            <div className="npr-workspace-pill">
              <span className="npr-workspace-pill-dot" aria-hidden />
              {workspaceLabel}
            </div>

            <nav className="npr-workspace-scroll" aria-label="Workspace navigation">
              {workspaceLinks.map((item) => (
                <NavLink key={item.href} item={item} workspace />
              ))}
            </nav>
          </div>
        ) : null}
      </div>

      <div className={`npr-mobile-panel ${mobileOpen ? "open" : ""}`}>
        <div className="npr-mobile-section">
          <div className="npr-mobile-heading">Navigation</div>
          {primaryLinks.map((item) => (
            <NavLink key={item.href} item={item} mobile />
          ))}
        </div>

        {userEmail && workspaceLinks.length > 0 ? (
          <div className="npr-mobile-section">
            <div className="npr-mobile-heading">{workspaceLabel}</div>
            {workspaceLinks.map((item) => (
              <NavLink key={item.href} item={item} mobile workspace />
            ))}
          </div>
        ) : null}

        <div className="npr-mobile-section">
          <div className="npr-mobile-heading">Account</div>
          <MobileAuth />
        </div>
      </div>

      <style jsx>{`
        .npr-header {
          position: sticky;
          top: 0;
          z-index: 60;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }

        .npr-header::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(860px 140px at 12% -30%, rgba(29, 66, 138, 0.2), transparent 60%),
            radial-gradient(760px 140px at 88% -30%, rgba(124, 58, 237, 0.16), transparent 60%),
            radial-gradient(860px 180px at 72% 120%, rgba(236, 72, 153, 0.1), transparent 60%);
          opacity: 0.95;
        }

        .npr-shell {
          position: relative;
          max-width: 1220px;
          margin: 0 auto;
          padding: 12px 16px 14px;
        }

        .npr-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .npr-brand {
          min-width: 0;
          flex: 0 1 auto;
        }

        .npr-brand-wrap {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }

        .npr-mark {
          width: 38px;
          height: 38px;
          border-radius: 13px;
          background:
            radial-gradient(circle at 35% 30%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.55) 36%, transparent 68%),
            linear-gradient(135deg, #1d428a 0%, #7c3aed 56%, #c8102e 100%);
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,0.36);
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.16);
          flex-shrink: 0;
        }

        .npr-mark-icon {
          width: 30px;
          height: 30px;
          filter: drop-shadow(0 2px 6px rgba(15, 23, 42, 0.22));
        }

        .npr-brand-copy {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .npr-brand-title {
          font-size: 18px;
          line-height: 1.05;
          font-weight: 950;
          letter-spacing: -0.03em;
          color: #0f172a;
        }

        .npr-brand-subtitle {
          font-size: 12px;
          color: rgba(15, 23, 42, 0.62);
          white-space: nowrap;
        }

        .npr-desktop {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          min-width: 0;
          flex: 1 1 auto;
        }

        .npr-primary-nav {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: nowrap;
          min-width: 0;
        }

        .npr-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          white-space: nowrap;
          border-radius: 999px;
          padding: 10px 14px;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.58);
          color: rgba(15, 23, 42, 0.86);
          font-weight: 850;
          line-height: 1;
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
          transition:
            transform 160ms ease,
            background 160ms ease,
            border-color 160ms ease,
            box-shadow 160ms ease,
            filter 160ms ease;
        }

        .npr-link:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.9);
          border-color: rgba(29, 66, 138, 0.16);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
        }

        .npr-link-active {
          background: rgba(29, 66, 138, 0.1);
          border-color: rgba(29, 66, 138, 0.22);
          color: rgba(15, 23, 42, 0.96);
          box-shadow: 0 14px 30px rgba(29, 66, 138, 0.12);
        }

        .npr-link-workspace {
          background: rgba(255, 255, 255, 0.72);
          border-color: rgba(15, 23, 42, 0.08);
        }

        .npr-link-accent {
          background: linear-gradient(135deg, #2563eb 0%, #7c3aed 55%, #ec4899 100%);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.24);
          box-shadow: 0 18px 38px rgba(37, 99, 235, 0.22);
        }

        .npr-link-accent:hover {
          border-color: rgba(255, 255, 255, 0.38);
          filter: brightness(1.05);
        }

        .npr-link-accent.npr-link-active {
          box-shadow: 0 22px 46px rgba(124, 58, 237, 0.26);
          outline: 2px solid rgba(255, 255, 255, 0.52);
          outline-offset: 2px;
        }

        .npr-auth-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .npr-auth-link {
          appearance: none;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(255, 255, 255, 0.72);
          color: rgba(15, 23, 42, 0.9);
          padding: 10px 14px;
          border-radius: 999px;
          font-weight: 850;
          line-height: 1;
          text-decoration: none;
          cursor: pointer;
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
          transition:
            transform 160ms ease,
            background 160ms ease,
            border-color 160ms ease,
            box-shadow 160ms ease,
            filter 160ms ease;
        }

        .npr-auth-link:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.94);
          border-color: rgba(29, 66, 138, 0.18);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
        }

        .npr-auth-link-primary {
          background: linear-gradient(135deg, #1d428a 0%, #2563eb 56%, #7c3aed 100%);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.22);
        }

        .npr-auth-link-primary:hover {
          border-color: rgba(255, 255, 255, 0.36);
          filter: brightness(1.05);
        }

        .npr-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.66);
          color: rgba(15, 23, 42, 0.88);
          font-weight: 850;
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
          white-space: nowrap;
        }

        .npr-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(135deg, #2563eb 0%, #7c3aed 55%, #ec4899 100%);
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        .npr-workspace-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(15, 23, 42, 0.08);
          min-width: 0;
        }

        .npr-workspace-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 13px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: rgba(255, 255, 255, 0.72);
          color: rgba(15, 23, 42, 0.82);
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
          flex-shrink: 0;
        }

        .npr-workspace-pill-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(135deg, #1d428a 0%, #7c3aed 55%, #ec4899 100%);
        }

        .npr-workspace-scroll {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
          min-width: 0;
          flex: 1 1 auto;
        }

        .npr-workspace-scroll::-webkit-scrollbar {
          display: none;
        }

        .npr-burger {
          display: none;
          width: 46px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(255, 255, 255, 0.86);
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.06);
          cursor: pointer;
          padding: 0;
          position: relative;
          flex-shrink: 0;
        }

        .npr-burger span {
          position: absolute;
          left: 13px;
          right: 13px;
          height: 2px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.86);
          transition: transform 180ms ease, opacity 180ms ease, top 180ms ease;
        }

        .npr-burger span:nth-child(1) {
          top: 14px;
        }

        .npr-burger span:nth-child(2) {
          top: 20px;
        }

        .npr-burger span:nth-child(3) {
          top: 26px;
        }

        .npr-burger.open span:nth-child(1) {
          top: 20px;
          transform: rotate(45deg);
        }

        .npr-burger.open span:nth-child(2) {
          opacity: 0;
        }

        .npr-burger.open span:nth-child(3) {
          top: 20px;
          transform: rotate(-45deg);
        }

        .npr-mobile-panel {
          display: none;
          max-width: 1220px;
          margin: 0 auto;
          padding: 0 16px 16px;
        }

        .npr-mobile-panel.open {
          display: block;
        }

        .npr-mobile-section {
          margin-top: 12px;
          padding: 14px;
          border-radius: 20px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: rgba(255, 255, 255, 0.74);
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
        }

        .npr-mobile-heading {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.56);
          margin-bottom: 10px;
        }

        .npr-link-mobile {
          display: flex;
          justify-content: flex-start;
          width: 100%;
          margin-top: 8px;
          border-radius: 16px;
          padding: 13px 14px;
        }

        .npr-mobile-auth {
          display: grid;
          gap: 10px;
        }

        .npr-auth-link-mobile {
          display: inline-flex;
          justify-content: center;
          width: 100%;
          border-radius: 16px;
          padding: 13px 14px;
        }

        .npr-mobile-meta {
          padding: 13px 14px;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(15, 23, 42, 0.03);
          color: rgba(15, 23, 42, 0.78);
          font-weight: 800;
        }

        @media (max-width: 1120px) {
          .npr-link,
          .npr-auth-link,
          .npr-status-pill {
            padding: 10px 12px;
            font-size: 14px;
          }

          .npr-primary-nav,
          .npr-auth-group,
          .npr-workspace-scroll {
            gap: 8px;
          }
        }

        @media (max-width: 980px) {
          .npr-desktop {
            display: none;
          }

          .npr-workspace-row {
            display: none;
          }

          .npr-burger {
            display: inline-block;
          }
        }

        @media (max-width: 640px) {
          .npr-shell {
            padding: 10px 14px 12px;
          }

          .npr-brand-title {
            font-size: 17px;
          }

          .npr-brand-subtitle {
            font-size: 11.5px;
            white-space: normal;
          }

          .npr-mark {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>
    </header>
  );
}