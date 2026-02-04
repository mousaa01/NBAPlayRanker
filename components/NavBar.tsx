//app/components/NavBar.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type NavItem = {
  href: string;
  label: string;
};

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const topLinks: NavItem[] = useMemo(
    () => [
      { href: "/", label: "Home" },
      { href: "/data-explorer", label: "Data Explorer" },
      { href: "/glossary", label: "Glossary" },
    ],
    []
  );

  const playTypeLinks: NavItem[] = useMemo(
    () => [
      { href: "/matchup", label: "Matchup (Baseline)" },
      { href: "/context", label: "Context Simulator (AI)" },
      { href: "/model-metrics", label: "Model Performance" },
      { href: "/statistical-analysis", label: "Statistical Analysis" },
    ],
    []
  );

  const shotLinks: NavItem[] = useMemo(
    () => [
      { href: "/shot-plan", label: "Shot Plan (Baseline)" },
      { href: "/shot-model-metrics", label: "Shot Model Metrics" },
      { href: "/shot-statistical-analysis", label: "Shot Statistical Analysis" },
    ],
    []
  );

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  }

  function renderLink(l: NavItem) {
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={isActive(l.href) ? "page" : undefined}
        onClick={() => setOpen(false)}
      >
        {l.label}
      </Link>
    );
  }

  function renderDropdown(label: string, items: NavItem[]) {
    return (
      <details className="nav-dropdown">
        <summary>{label}</summary>
        <div className="nav-dropdown-list">
          {items.map(renderLink)}
        </div>
      </details>
    );
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <div className="nav-logo">
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }} onClick={() => setOpen(false)}>
            NBA Play Ranker
          </Link>
          <span>Explainable + AI</span>
        </div>

        {/* Desktop nav */}
        <nav className="nav-links desktop" aria-label="Primary navigation">
          {topLinks.map(renderLink)}
          {renderDropdown("Play Type Analysis", playTypeLinks)}
          {renderDropdown("Play-by-Play Analysis", shotLinks)}
        </nav>

        {/* Mobile toggle */}
        <button
          className="nav-toggle"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {/* Simple hamburger */}
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>
      </div>

      {/* Mobile menu */}
      <nav className={`nav-links mobile ${open ? "open" : ""}`} aria-label="Mobile navigation">
        {topLinks.map(renderLink)}
        {renderDropdown("Play Type Analysis", playTypeLinks)}
        {renderDropdown("Play-by-Play Analysis", shotLinks)}
      </nav>
    </header>
  );
}
