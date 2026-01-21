// app/data-explorer/page.tsx
//
// Data Explorer:
// - Shows a preview of the CLEANED, TEAM-LEVEL dataset used by the app.
// - Supports filtering and CSV export.
// - Explicitly shows NO predictions / NO recommender outputs on this page.
//
// Why this page matters for the defense:
// - Proves we have a dataset.
// - Proves we have a cleaning + aggregation pipeline (player rows -> team rows).
// - Lets reviewers export the same table for offline analysis (Excel/R/Python).

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  API_BASE,
  fetchMetaOptions,
  fetchPipelineInfo,
  fetchTeamPlaytypesPreview,
  getTeamPlaytypesCsvUrl,
} from "../utils";

type MetaOptions = {
  seasons: string[];
  teams: string[];
  teamNames?: Record<string, string>;
  playTypes?: string[];
  sides?: string[];
  hasMlPredictions?: boolean;
  _fallback?: boolean;
};

type PipelineInfo = {
  dataSource?: string;
  etl?: any;
  cleaning_and_aggregation?: string[];
  modeling?: string[];
};

type TeamPlayRow = Record<string, any>;

function fmtNum(v: any, digits = 3) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export default function DataExplorerPage() {
  // --------------------------
  // 1) Meta (dropdown options)
  // --------------------------
  const [meta, setMeta] = useState<MetaOptions>({
    seasons: [],
    teams: [],
    playTypes: [],
    sides: ["offense", "defense"],
    hasMlPredictions: false,
  });

  const [pipeline, setPipeline] = useState<PipelineInfo | null>(null);

  // --------------------------
  // 2) Filters (Data Explorer)
  // --------------------------
  const [season, setSeason] = useState<string>("");
  const [team, setTeam] = useState<string>("");
  const [side, setSide] = useState<string>("offense");
  const [playType, setPlayType] = useState<string>(""); // empty = all
  const [minPoss, setMinPoss] = useState<number>(0);
  const [limit, setLimit] = useState<number>(200);

  // --------------------------
  // 3) Data + UI state
  // --------------------------
  const [rows, setRows] = useState<TeamPlayRow[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [returnedRows, setReturnedRows] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --------------------------
  // 4) Load meta + pipeline
  // --------------------------
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const m = await fetchMetaOptions();
        if (cancelled) return;

        setMeta(m);

        // Pick sensible defaults once meta arrives:
        const seasons = m.seasons ?? [];
        const teams = m.teams ?? [];

        // Default to most recent season if available:
        const defaultSeason = seasons.length ? seasons[seasons.length - 1] : "";
        const defaultTeam = teams.includes("TOR") ? "TOR" : teams[0] ?? "";

        setSeason((prev) => prev || defaultSeason);
        setTeam((prev) => prev || defaultTeam);

        // Pipeline info (optional, but useful for committee)
        const p = await fetchPipelineInfo();
        if (!cancelled) setPipeline(p);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setError(e?.message ?? "Failed to load metadata.");
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // --------------------------
  // 5) Fetch preview data when filters change
  // --------------------------
  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Don’t call API until we have at least a season (dataset scoped by season).
      if (!season) return;

      try {
        setLoading(true);
        setError(null);

        const resp = await fetchTeamPlaytypesPreview({
          season,
          team: team || undefined, // allow “all teams” if blank
          side: side || undefined,
          playType: playType || undefined,
          minPoss,
          limit,
        });

        if (cancelled) return;

        setTotalRows(Number(resp.total_rows ?? 0));
        setReturnedRows(Number(resp.returned_rows ?? 0));
        setRows(Array.isArray(resp.rows) ? resp.rows : []);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setError(e?.message ?? "Unable to load data.");
          setRows([]);
          setTotalRows(0);
          setReturnedRows(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [season, team, side, playType, minPoss, limit]);

  // --------------------------
  // 6) CSV export URL (filtered)
  // --------------------------
  const csvUrl = useMemo(() => {
    return getTeamPlaytypesCsvUrl({
      season: season || undefined,
      team: team || undefined,
      side: side || undefined,
      playType: playType || undefined,
      minPoss,
      limit: Math.max(limit, 1000),
    });
  }, [season, team, side, playType, minPoss, limit]);

  // --------------------------
  // 7) Column definition
  // --------------------------
  // We render a focused subset of fields that a committee can understand quickly.
  const columns = useMemo(() => {
    const base = [
      { key: "PLAY_TYPE", label: "Play Type" },
      { key: "SIDE", label: "Side" },
      { key: "POSS", label: "Possessions" },
      { key: "POSS_PCT", label: "Usage %" },
      { key: "PPP", label: "PPP" },
      { key: "EFG_PCT", label: "eFG%" },
      { key: "TOV_POSS_PCT", label: "TOV%" },
      { key: "FT_POSS_PCT", label: "FT%" },
    ];

    // Only show columns that actually exist in returned rows
    const keysInData = new Set(Object.keys(rows?.[0] ?? {}));
    return base.filter((c) => keysInData.has(c.key));
  }, [rows]);

  // Helpful label for team name
  const teamLabel = useMemo(() => {
    const name = meta.teamNames?.[team];
    return name ? `${team} (${name})` : team;
  }, [meta.teamNames, team]);

  return (
    <section className="card">
      <h1 className="h1">Data Explorer</h1>

      <p className="muted">
        This page shows a preview of the <strong>cleaned, team-level dataset</strong> used by the
        recommenders. It contains <strong>no predictions</strong>—only data that can be filtered and
        exported for analysts.
      </p>

      {/* Filters */}
      <form className="form-grid" onSubmit={(e) => e.preventDefault()}>
        <label>
          Season
          <select className="input" value={season} onChange={(e) => setSeason(e.target.value)}>
            {(meta.seasons?.length ? meta.seasons : []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label>
          Team (optional)
          <select className="input" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">All teams</option>
            {(meta.teams?.length ? meta.teams : []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label>
          Side
          <select className="input" value={side} onChange={(e) => setSide(e.target.value)}>
            {(meta.sides?.length ? meta.sides : ["offense", "defense"]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label>
          Play Type (optional)
          <select className="input" value={playType} onChange={(e) => setPlayType(e.target.value)}>
            <option value="">All play types</option>
            {(meta.playTypes?.length ? meta.playTypes : []).map((pt) => (
              <option key={pt} value={pt}>
                {pt}
              </option>
            ))}
          </select>
        </label>

        <label>
          Min possessions
          <input
            className="input"
            type="number"
            min={0}
            step={1}
            value={minPoss}
            onChange={(e) => setMinPoss(Number(e.target.value))}
          />
        </label>

        <label>
          Rows to show
          <input
            className="input"
            type="number"
            min={1}
            max={1000}
            step={1}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
      </form>

      {/* Summary + Export */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <p className="muted" style={{ fontSize: 12 }}>
          Showing <strong>{returnedRows}</strong> / <strong>{totalRows}</strong> rows
          {team ? (
            <>
              {" "}
              for <strong>{teamLabel}</strong>
            </>
          ) : null}{" "}
          ({season}, {side})
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="btn" href={csvUrl} target="_blank" rel="noopener noreferrer">
            Export CSV
          </a>

          <Link className="btn" href="/matchup">
            Next: Baseline Matchup
          </Link>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <p className="muted" style={{ marginTop: 14 }}>
          Loading dataset preview…
        </p>
      )}

      {error && !loading && (
        <p className="muted" style={{ marginTop: 14 }}>
          {error}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="muted" style={{ marginTop: 14 }}>
          No rows match these filters.
        </p>
      )}

      {/* Table */}
      {!loading && !error && rows.length > 0 && (
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.SEASON}-${r.TEAM_ABBREVIATION}-${r.SIDE}-${r.PLAY_TYPE}-${idx}`}>
                  <td>{idx + 1}</td>
                  {columns.map((c) => {
                    const v = r[c.key];
                    if (
                      c.key === "POSS" ||
                      c.key === "GP"
                    ) {
                      return <td key={c.key}>{Number.isFinite(Number(v)) ? Number(v) : "—"}</td>;
                    }
                    if (c.key.endsWith("_PCT") || c.key === "POSS_PCT") {
                      // show as percent (0..1 -> 0..100)
                      const n = Number(v);
                      return <td key={c.key}>{Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—"}</td>;
                    }
                    if (typeof v === "number" || !isNaN(Number(v))) {
                      return <td key={c.key}>{fmtNum(v, 3)}</td>;
                    }
                    return <td key={c.key}>{String(v ?? "—")}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pipeline Panel */}
      <div style={{ marginTop: 16 }}>
        <h2 style={{ margin: "8px 0 6px", fontSize: 16 }}>Pipeline summary (what this data represents)</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          {pipeline?.dataSource ? pipeline.dataSource : "Data source: (not loaded)"}{" "}
          <span className="badge">Explainability</span>
        </p>

        <ul className="muted" style={{ fontSize: 13, paddingLeft: 18, marginTop: 8 }}>
          {(pipeline?.cleaning_and_aggregation ?? [
            "Aggregate player rows into team-level play-type rows (possession-weighted).",
            "Recompute team-level usage % (POSS_PCT) to avoid double-counting.",
            "Add reliability weights to reduce small-sample noise (shrinkage).",
          ]).map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>

        <p className="muted" style={{ marginTop: 10, fontSize: 11 }}>
          API call:{" "}
          <code>
            {API_BASE}/data/team-playtypes?season={season}
            {team ? `&team=${team}` : ""}
            {side ? `&side=${side}` : ""}
            {playType ? `&play_type=${encodeURIComponent(playType)}` : ""}
            {minPoss ? `&min_poss=${minPoss}` : ""}
            {limit ? `&limit=${limit}` : ""}
          </code>
        </p>
      </div>
    </section>
  );
}
