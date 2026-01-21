// app/utils.ts
//
// TypeScript API helpers for the PSPI.
//
// Endpoints used:
// - GET  /meta/options
// - GET  /meta/pipeline
// - GET  /meta/baseline-formula
// - GET  /data/team-playtypes
// - GET  /data/team-playtypes.csv
// - GET  /rank-plays/baseline
// - GET  /rank-plays/baseline.csv
// - GET  /rank-plays/context-ml
// - GET  /metrics/baseline-vs-ml
// - GET  /analysis/ml   <-- Statistical Analysis page

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export const FALLBACK_SEASONS = [
  "2019-20",
  "2020-21",
  "2021-22",
  "2022-23",
  "2023-24",
  "2024-25",
];

export const FALLBACK_TEAMS = [
  "ATL","BKN","BOS","CHA","CHI","CLE",
  "DAL","DEN","DET","GSW","HOU","IND",
  "LAC","LAL","MEM","MIA","MIL","MIN",
  "NOP","NYK","OKC","ORL","PHI","PHX",
  "POR","SAC","SAS","TOR","UTA","WAS",
];

// ---------------------------
// Small fetch helper
// ---------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// ---------------------------
// Types
// ---------------------------

export type MetaOptions = {
  seasons: string[];
  teams: string[];
  teamNames?: Record<string, string>;
  playTypes?: string[];
  sides?: string[];
  hasMlPredictions?: boolean;
  _fallback?: boolean;
};

export type TeamPlaytypesPreviewResponse = {
  season: string;
  total_rows: number;
  returned_rows: number;
  rows: Record<string, any>[];
};

export type BaselineRankResponse = {
  season: string;
  our_team: string;
  opp_team: string;
  k: number;
  w_off: number;
  w_def: number;
  rankings: Record<string, any>[];
};

export type ContextRankResponse = {
  season: string;
  our_team: string;
  opp_team: string;
  k: number;
  margin: number;
  period: number;
  time_remaining_period_sec: number;
  w_off: number;
  w_def: number;
  rankings: Record<string, any>[];
};

export type ModelMetricsResponse = {
  n_splits: number;
  metrics: Array<{
    model: string;
    RMSE_mean: number;
    RMSE_std: number;
    MAE_mean: number;
    MAE_std: number;
    R2_mean: number;
    R2_std: number;
  }>;
  rf_vs_baseline_t: number | null;
  rf_vs_baseline_p: number | null;
};

// Statistical analysis response (what /analysis/ml returns)
export type MlAnalysisResponse = {
  dataset: any;
  eda: any;
  correlations: { labels: string[]; matrix: number[][] };
  target_feature_corr: Array<{ feature: string; corr: number; abs: number }>;
  feature_selection: any;
  model_selection: any;
};

// ---------------------------
// Meta
// ---------------------------

export async function fetchMetaOptions(): Promise<MetaOptions> {
  try {
    return await fetchJson<MetaOptions>(`${API_BASE}/meta/options`);
  } catch {
    return {
      seasons: FALLBACK_SEASONS,
      teams: FALLBACK_TEAMS,
      teamNames: {},
      playTypes: [],
      sides: ["offense", "defense"],
      hasMlPredictions: false,
      _fallback: true,
    };
  }
}

export async function fetchPipelineInfo(): Promise<any> {
  return await fetchJson(`${API_BASE}/meta/pipeline`);
}

export async function fetchBaselineInfo(): Promise<any> {
  return await fetchJson(`${API_BASE}/meta/baseline-formula`);
}

// ---------------------------
// Data Explorer
// ---------------------------

export async function fetchTeamPlaytypesPreview(opts: {
  season: string;
  team?: string;
  side?: string;
  playType?: string;
  minPoss?: number;
  limit?: number;
}): Promise<TeamPlaytypesPreviewResponse> {
  const { season, team, side, playType, minPoss = 0, limit = 200 } = opts;

  const params = new URLSearchParams();
  params.set("season", season);
  if (team) params.set("team", team);
  if (side) params.set("side", side);
  if (playType) params.set("play_type", playType);
  params.set("min_poss", String(minPoss));
  params.set("limit", String(limit));

  return await fetchJson<TeamPlaytypesPreviewResponse>(
    `${API_BASE}/data/team-playtypes?${params.toString()}`
  );
}

export function getTeamPlaytypesCsvUrl(opts: {
  season: string;
  team?: string;
  side?: string;
  playType?: string;
  minPoss?: number;
}): string {
  const { season, team, side, playType, minPoss = 0 } = opts;

  const params = new URLSearchParams();
  params.set("season", season);
  if (team) params.set("team", team);
  if (side) params.set("side", side);
  if (playType) params.set("play_type", playType);
  params.set("min_poss", String(minPoss));

  return `${API_BASE}/data/team-playtypes.csv?${params.toString()}`;
}

// ---------------------------
// Baseline ranking
// ---------------------------

export async function baselineRank(opts: {
  season: string;
  our: string;
  opp: string;
  k?: number;
  wOff?: number;
  wDef?: number;
}): Promise<
  Array<{
    playType: string;
    pppPred: number;
    pppOff: number;
    pppDef: number;
    pppGap: number;
    rationale: string;
    raw: Record<string, any>;
  }>
> {
  const { season, our, opp, k = 5, wOff = 0.7 } = opts;

  const params = new URLSearchParams({
    season,
    our,
    opp,
    k: String(k),
    w_off: String(wOff),
    w_def: String(wDef),
  });

  const data = await fetchJson<BaselineRankResponse>(
    `${API_BASE}/rank-plays/baseline?${params.toString()}`
  );

  const rankings = Array.isArray(data.rankings) ? data.rankings : [];

  return rankings.map((r) => ({
    playType: r.PLAY_TYPE,
    pppPred: Number(r.PPP_PRED),
    pppOff: Number(r.PPP_OFF_SHRUNK),
    pppDef: Number(r.PPP_DEF_SHRUNK),
    pppGap: Number(r.PPP_GAP),
    rationale: r.RATIONALE || "",
    raw: r,
  }));
}

export function getBaselineCsvUrl(opts: {
  season: string;
  our: string;
  opp: string;
  k?: number;
  wOff?: number;
  wDef?: number;
}): string {
  const { season, our, opp, k = 5, wOff = 0.7 } = opts;

  const params = new URLSearchParams({
    season,
    our,
    opp,
    k: String(k),
    w_off: String(wOff),
  });

  return `${API_BASE}/rank-plays/baseline.csv?${params.toString()}`;
}

// ---------------------------
// Context + ML ranking (AI use case)
// ---------------------------

export async function contextRank(opts: {
  season: string;
  our: string;
  opp: string;
  margin: number;
  period: number;
  timeRemaining: number; // seconds remaining in current period
  k?: number;
  wOff?: number;
}): Promise<
  Array<{
    playType: string;
    finalPPP: number;
    mlPPP: number;
    baselinePPP: number;
    deltaPPP: number;
    contextLabel: string;
    rationale: string;
    raw: Record<string, any>;
  }>
> {
  const {
    season,
    our,
    opp,
    margin,
    period,
    timeRemaining,
    k = 5,
    wOff = 0.7,
  } = opts;

  const params = new URLSearchParams({
    season,
    our,
    opp,
    margin: String(margin),
    period: String(period),
    time_remaining: String(timeRemaining),
    k: String(k),
    w_off: String(wOff),
  });

  const data = await fetchJson<ContextRankResponse>(
    `${API_BASE}/rank-plays/context-ml?${params.toString()}`
  );

  const rows = Array.isArray(data.rankings) ? data.rankings : [];

  return rows.map((r) => ({
    playType: r.PLAY_TYPE,
    finalPPP: Number(r.PPP_CONTEXT),
    mlPPP: Number(r.PPP_ML_BLEND),
    baselinePPP: Number(r.PPP_BASELINE),
    deltaPPP: Number(r.DELTA_VS_BASELINE),
    contextLabel: r.CONTEXT_LABEL || "",
    rationale: r.RATIONALE || "",
    raw: r,
  }));
}

// ---------------------------
// Model metrics
// ---------------------------

export async function fetchModelMetrics(nSplits = 5): Promise<ModelMetricsResponse> {
  const params = new URLSearchParams({ n_splits: String(nSplits) });
  return await fetchJson<ModelMetricsResponse>(
    `${API_BASE}/metrics/baseline-vs-ml?${params.toString()}`
  );
}

// ---------------------------
// Statistical Analysis
// ---------------------------

export async function fetchMlAnalysis(opts?: {
  nSplits?: number;
  minPoss?: number;
  refresh?: boolean;
}): Promise<MlAnalysisResponse> {
  const nSplits = opts?.nSplits ?? 5;
  const minPoss = opts?.minPoss ?? 25;

  const params = new URLSearchParams();
  params.set("n_splits", String(nSplits));
  params.set("min_poss", String(minPoss));

  // Note: refresh is optional; backend can ignore it if unsupported
  if (opts?.refresh) params.set("refresh", "true");

  return await fetchJson<MlAnalysisResponse>(
    `${API_BASE}/analysis/ml?${params.toString()}`
  );
}
