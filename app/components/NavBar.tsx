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

  const links: NavItem[] = useMemo(
    () => [
      { href: "/", label: "Home" },
      { href: "/data-explorer", label: "Data Explorer" },
      { href: "/matchup", label: "Matchup (Baseline)" },
      { href: "/context", label: "Context Simulator (AI)" },
      { href: "/model-metrics", label: "Model Performance" },
      { href: "/statistical-analysis", label: "Statistical Analysis" },
      { href: "/glossary", label: "Glossary" },
    ],
    []
  );

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
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
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
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
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
