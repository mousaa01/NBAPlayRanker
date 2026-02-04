// components/Nav.jsx
//
// Simple navigation component.
// Some pages in the repo still import <Nav />.
// To avoid runtime errors and keep behavior consistent, this Nav matches app/layout.tsx.
//
// later want a single source of truth, can remove page-level Nav usage
// and rely only on the layout navbar

import Link from "next/link";

export default function Nav() {
  return (
    <header className="nav" role="banner">
      <div className="nav-logo">
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
          Strategy Support
        </Link>
        <span>Explainable + AI</span>
      </div>

      <nav className="nav-links" aria-label="Primary navigation">
        <Link href="/">Home</Link>
        <Link href="/data-explorer">Data Explorer</Link>
        <details className="nav-dropdown">
          <summary>Play Type Analysis</summary>
          <div className="nav-dropdown-list">
            <Link href="/matchup">Matchup (Baseline)</Link>
            <Link href="/context">Context Simulator (AI)</Link>
            <Link href="/model-metrics">Model Performance</Link>
            <Link href="/statistical-analysis">Statistical Analysis</Link>
          </div>
        </details>
        <details className="nav-dropdown">
          <summary>Play-by-Play Analysis</summary>
          <div className="nav-dropdown-list">
            <Link href="/shot-plan">Shot Plan (Baseline)</Link>
            <Link href="/shot-model-metrics">Shot Model Metrics</Link>
            <Link href="/shot-statistical-analysis">Shot Statistical Analysis</Link>
          </div>
        </details>
        <Link href="/glossary">Glossary</Link>
      </nav>
    </header>
  );
}
