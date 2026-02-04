# backend/app.py
#
# Basketball Strategy backend (FastAPI)
#
# This file is intentionally written to be *defense-friendly*:
# - Clear separation of concerns (data access, baseline, ML, context adjustments)
# - API endpoints that map 1:1 to the pages in the frontend
# - Caches expensive artifacts in memory at startup (important for multi-user)
#
# Key committee fixes addressed here:
# Infrastructure for AI models + multi-user: model/data loaded once (startup cache)
# “Use cases not demonstrated based on AI models”: explicit AI endpoint (/rank-plays/context-ml)
# “Pipeline cleaning raw data not demonstrated”: /meta/pipeline describes ETL/aggregation steps
# “Default model used without checking fit”: /metrics/baseline-vs-ml shows CV metrics + optional t-test
# “Need raw data preview + export”: /data/team-playtypes and /data/team-playtypes.csv

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------
# IMPORTANT: make backend/ imports work no matter where uvicorn is run from
# (e.g., repo root: uvicorn backend.app:app --reload)
# ---------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

logger = logging.getLogger("basketball_strategy")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from baseline_recommender import BaselineRecommender, rank_playtypes_baseline
from shot_baseline_recommender import ShotBaselineRecommender
from shot_etl import CLEAN_PARQUET
from ml_models import paired_t_test_rmse, run_cv_evaluation
from ml_stat_analysis import compute_ml_analysis
from shot_ml_models import run_shot_model_cv
from shot_ml_stat_analysis import compute_shot_ml_analysis

from export_pdf import create_pdf_router

# IMPORTANT:
# Do NOT import viz_sportypy here at module load time.
# If SportyPy isn't installed (or is slow/import-heavy), it can prevent the API from starting.
# We'll lazy-import it inside the /viz endpoint.

# ---------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------

app = FastAPI(
    title="Basketball Strategy API",
    description=(
        "Backend for the Basketball Strategy Analysis capstone.\n\n"
        "Endpoints map directly to the frontend pages:\n"
        "- /meta/options: dropdown options\n"
        "- /data/team-playtypes: raw aggregated dataset preview + filtering\n"
        "- /rank-plays/baseline: transparent baseline recommender\n"
        "- /rank-plays/context-ml: AI use case (ML + context)\n"
        "- /metrics/baseline-vs-ml: holdout evaluation (defense evidence)\n"
    ),
)

# ---------------------------------------------------------------------
# IMPORTANT: Dataset2 router should NOT be able to break Dataset1 startup.
# If /pbp modules have an import error, we still want play type pages working.
# ---------------------------------------------------------------------
try:
    from pbp_endpoints import router as pbp_router  # type: ignore

    app.include_router(pbp_router)
    logger.info("Loaded Dataset2 (/pbp) router successfully.")
except Exception as e:
    logger.warning(
        "Dataset2 (/pbp) router NOT loaded due to import error: %s. "
        "Dataset1 playtype endpoints will still work.",
        e,
    )

# ---------------------------------------------------------------------
# IMPORTANT ADDITION:
# Your frontend is calling:
#   /pbp/shots/preview
#   /pbp/shots.csv
#
# Your logs show /pbp/meta/options is working (200), but /pbp/shots/preview was 404.
# That means your current /pbp router does NOT define the shots explorer endpoints.
#
# Fix (safe + non-breaking):
# - We optionally mount a SECOND router that *only* adds the missing shots endpoints.
# - If you haven't created backend/pbp_shots_endpoints.py yet, this block is a no-op.
#
# Create this file (recommended):
#   backend/pbp_shots_endpoints.py
# with:
#   router = APIRouter(prefix="/pbp", tags=["pbp"])
#   @router.get("/shots/preview") ...
#   @router.get("/shots.csv") ...
#
# This keeps Dataset1 stable and avoids changing your existing pbp_endpoints.
# ---------------------------------------------------------------------
try:
    from pbp_shots_endpoints import router as pbp_shots_router  # type: ignore

    app.include_router(pbp_shots_router)
    logger.info("Loaded Dataset2 (/pbp) shots explorer endpoints successfully.")
except Exception as e:
    logger.warning(
        "Dataset2 (/pbp) shots explorer router NOT loaded (this is ok if you haven't created it yet): %s. "
        "Core endpoints will still work.",
        e,
    )

# ---------------------------------------------------------------------
# IMPORTANT: NLP router should NOT be able to break startup either.
# If NLP modules have an import error, core playtype + shot endpoints must still work.
# ---------------------------------------------------------------------
try:
    from nlp_endpoints import router as nlp_router  # type: ignore

    app.include_router(nlp_router)
    logger.info("Loaded NLP (/nlp) router successfully.")
except Exception as e:
    logger.warning(
        "NLP (/nlp) router NOT loaded due to import error: %s. "
        "Core endpoints will still work.",
        e,
    )


# Allow local dev + keep permissive for defense demo environments.
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------
# Startup cache (important for multi-user + performance)
# ---------------------------------------------------------------------

DATA_DIR = Path(__file__).parent / "data"
SYNERGY_CSV = DATA_DIR / "synergy_playtypes_2019_2025_players.csv"
ML_PRED_CSV = DATA_DIR / "ml_offense_ppp_predictions.csv"

# Load baseline tables ONCE and reuse (fast for multi-user requests).
rec = BaselineRecommender(str(SYNERGY_CSV))

# Cache ML predictions ONCE (if file exists).
ML_PRED_DF: Optional[pd.DataFrame] = None
if ML_PRED_CSV.exists():
    ML_PRED_DF = pd.read_csv(ML_PRED_CSV)

# Shot Intelligence caches (lazy-loaded)
SHOT_REC: Optional[ShotBaselineRecommender] = None
SHOT_CLEAN_DF: Optional[pd.DataFrame] = None

# Precompute meta options from the dataset so we don’t hardcode team/season lists.
VALID_SEASONS = sorted(rec.team_df["SEASON"].dropna().unique().tolist())
VALID_TEAMS = sorted(rec.team_df["TEAM_ABBREVIATION"].dropna().unique().tolist())
VALID_PLAYTYPES = sorted(rec.team_df["PLAY_TYPE"].dropna().unique().tolist())
VALID_SIDES = ["offense", "defense"]

TEAM_NAMES: Dict[str, str] = {}
try:
    tmp = rec.team_df[["TEAM_ABBREVIATION", "TEAM_NAME"]].dropna().drop_duplicates()
    TEAM_NAMES = {r["TEAM_ABBREVIATION"]: r["TEAM_NAME"] for _, r in tmp.iterrows()}
except Exception:
    TEAM_NAMES = {}

# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------


def _require_season(season: str) -> None:
    if season not in VALID_SEASONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown season '{season}'. Allowed: {VALID_SEASONS}",
        )


def _require_team(team: str, label: str) -> None:
    if team not in VALID_TEAMS:
        raise HTTPException(status_code=400, detail=f"Unknown {label} team code '{team}'.")


def _df_to_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Convert a DataFrame to JSON-safe records (NaN -> None)."""
    clean = df.replace({np.nan: None})
    return clean.to_dict(orient="records")


def _get_shot_rec() -> ShotBaselineRecommender:
    global SHOT_REC
    if SHOT_REC is None:
        try:
            SHOT_REC = ShotBaselineRecommender()
        except FileNotFoundError as e:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Shot aggregates not found. Run:\n"
                    "  python backend/shot_aggregates.py\n"
                    f"Missing: {e}"
                ),
            )
    return SHOT_REC


def _get_shots_clean_df() -> pd.DataFrame:
    global SHOT_CLEAN_DF
    if SHOT_CLEAN_DF is None:
        if not CLEAN_PARQUET.exists():
            raise HTTPException(
                status_code=400,
                detail=(
                    "shots_clean.parquet not found. Run:\n"
                    "  python backend/data/etl/build_shots_dataset.py"
                ),
            )
        SHOT_CLEAN_DF = pd.read_parquet(CLEAN_PARQUET)
    return SHOT_CLEAN_DF


def _total_seconds_remaining(period: int, time_remaining_period_sec: float) -> float:
    """
    Convert (period, seconds remaining in that period) into total seconds remaining in regulation.
    OT is treated as 0 remaining to represent a 'very late' situation.
    """
    if period >= 5:
        return 0.0
    total_reg = 4 * 12 * 60  # 2880
    elapsed = (period - 1) * 12 * 60 + (12 * 60 - time_remaining_period_sec)
    return float(max(0.0, total_reg - elapsed))


def _clamp(x: float, lo: float, hi: float) -> float:
    return float(max(lo, min(hi, x)))


# Small hand-crafted “play style” weights for context. (Explainable + stable.)
QUICK_WEIGHTS = {
    "Spotup": 1.0,
    "OffScreen": 0.8,
    "Cut": 0.6,
    "Isolation": 0.4,
}

# ---------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------
# Meta endpoints (used by frontend dropdowns + defense explanations)
# ---------------------------------------------------------------------


@app.get("/meta/options")
def meta_options() -> Dict[str, Any]:
    """
    Dropdown options for the frontend.
    Derived from the dataset (no hardcoding), so it stays consistent.
    """
    return {
        "seasons": VALID_SEASONS,
        "teams": VALID_TEAMS,
        "teamNames": TEAM_NAMES,
        "playTypes": VALID_PLAYTYPES,
        "sides": VALID_SIDES,
        "hasMlPredictions": bool(ML_PRED_DF is not None and not ML_PRED_DF.empty),
    }


@app.get("/meta/pipeline")
def pipeline_info() -> Dict[str, Any]:
    """
    A plain-English explanation of the data pipeline.
    This is used on the Model Performance page to satisfy the feedback
    about missing cleaning/processing steps.
    """
    return {
        "dataSource": "Synergy play-type snapshot (player rows) aggregated into team-level play-type tables (offense/defense).",
        "cleaning_and_aggregation": [
            "Map Synergy TYPE_GROUPING to SIDE = offense/defense.",
            "Group player rows into team-level rows by (SEASON, TEAM, PLAY_TYPE, SIDE).",
            "Compute possession-weighted averages for efficiency stats (PPP, eFG%, TOV%, etc.).",
            "Compute RELIABILITY_WEIGHT from log1p(POSS) to reduce noise from small samples (used for shrinkage).",
            "Build league baselines per (SEASON, PLAY_TYPE, SIDE) for shrinkage anchors.",
        ],
        "modeling": [
            "Baseline model: shrink team offense/defense toward league baselines; combine into PPP_PRED.",
            "ML model: RandomForest predicts offense PPP using team-level play-type features (offline CV).",
            "AI use case: ML-based PPP blended with opponent defense, then adjusted using small, transparent context bonuses/penalties.",
        ],
        "etl_reference": "See backend/data/etl/build_synergy_dataset.R for the dataset build logic (if applicable in your repo).",
    }


@app.get("/meta/baseline-formula")
def baseline_formula() -> Dict[str, Any]:
    """
    Baseline formula explanation (so the committee can defend/understand it).
    """
    return {
        "inputs": ["PPP_OFF (team offense)", "PPP_DEF (opponent defense allowed)", "league baselines", "reliability weights"],
        "shrinkage": "PPP_SHRUNK = REL * PPP_TEAM + (1-REL) * PPP_LEAGUE",
        "prediction": "PPP_PRED = w_off * PPP_OFF_SHRUNK + w_def * (2*PPP_LEAGUE_OFF - PPP_DEF_SHRUNK)",
        "defaults": {"w_off": 0.7, "w_def": 0.3},
        "interpretation": "We combine how efficient we are at a play type with how friendly the opponent is at allowing it, while stabilizing small samples using league averages.",
    }


# ---------------------------------------------------------------------
# Data Explorer endpoints (raw preview + CSV export)
# ---------------------------------------------------------------------


@app.get("/data/team-playtypes")
def team_playtypes(
    season: str = Query(..., description="Season label (required)."),
    team: Optional[str] = Query(None, description="Team abbreviation filter (optional)."),
    side: Optional[str] = Query(None, description="Side filter: offense/defense (optional)."),
    play_type: Optional[str] = Query(None, description="Play type filter (optional)."),
    min_poss: float = Query(0, ge=0, description="Minimum possessions (optional)."),
    limit: int = Query(200, ge=1, le=2000, description="Rows to return (preview limit)."),
) -> Dict[str, Any]:
    """
    Returns a preview of the aggregated dataset. NO predictions.
    This is intentionally 'raw' and exportable for analysts.
    """
    _require_season(season)
    df = rec.team_df.copy()

    df = df[df["SEASON"] == season]
    if team:
        _require_team(team, "team")
        df = df[df["TEAM_ABBREVIATION"] == team]
    if side:
        if side not in VALID_SIDES:
            raise HTTPException(status_code=400, detail="side must be 'offense' or 'defense'")
        df = df[df["SIDE"] == side]
    if play_type:
        df = df[df["PLAY_TYPE"] == play_type]
    if min_poss > 0:
        df = df[df["POSS"] >= float(min_poss)]

    total = int(df.shape[0])

    keep_cols = [
        "SEASON",
        "TEAM_ABBREVIATION",
        "TEAM_NAME",
        "SIDE",
        "PLAY_TYPE",
        "GP",
        "POSS",
        "POSS_PCT",
        "PPP",
        "EFG_PCT",
        "SCORE_POSS_PCT",
        "TOV_POSS_PCT",
        "RELIABILITY_WEIGHT",
    ]
    keep_cols = [c for c in keep_cols if c in df.columns]

    df = df[keep_cols].sort_values(["TEAM_ABBREVIATION", "SIDE", "PLAY_TYPE"]).head(limit)
    records = _df_to_records(df)

    return jsonable_encoder(
        {
            "season": season,
            "total_rows": total,
            "returned_rows": len(records),
            "rows": records,
        }
    )


@app.get("/data/team-playtypes.csv")
def team_playtypes_csv(
    season: str = Query(...),
    team: Optional[str] = Query(None),
    side: Optional[str] = Query(None),
    play_type: Optional[str] = Query(None),
    min_poss: float = Query(0, ge=0),
) -> StreamingResponse:
    """CSV export for the Data Explorer table."""
    _require_season(season)
    df = rec.team_df.copy()
    df = df[df["SEASON"] == season]

    if team:
        _require_team(team, "team")
        df = df[df["TEAM_ABBREVIATION"] == team]
    if side:
        if side not in VALID_SIDES:
            raise HTTPException(status_code=400, detail="side must be 'offense' or 'defense'")
        df = df[df["SIDE"] == side]
    if play_type:
        df = df[df["PLAY_TYPE"] == play_type]
    if min_poss > 0:
        df = df[df["POSS"] >= float(min_poss)]

    df = df.replace({np.nan: None})

    import io

    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)

    filename = f"team_playtypes_{season}.csv"
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------
# Baseline endpoint (transparent + explainable)
# ---------------------------------------------------------------------


@app.get("/rank-plays/baseline")
def rank_baseline(
    season: str = Query(...),
    our: str = Query(..., description="Our team abbreviation."),
    opp: str = Query(..., description="Opponent team abbreviation."),
    k: int = Query(5, ge=1, le=10),
    w_off: float = Query(0.7, ge=0, le=1),
) -> Dict[str, Any]:
    """Baseline play-type ranking (transparent)."""
    _require_season(season)
    _require_team(our, "our")
    _require_team(opp, "opponent")
    if our == opp:
        raise HTTPException(status_code=400, detail="Our team and opponent must be different.")

    w_def = float(1.0 - w_off)

    try:
        df = rank_playtypes_baseline(
            team_df=rec.team_df,
            league_df=rec.league_df,
            season=season,
            our_team=our,
            opp_team=opp,
            k=k,
            w_off=float(w_off),
            w_def=w_def,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return jsonable_encoder(
        {
            "season": season,
            "our_team": our,
            "opp_team": opp,
            "k": k,
            "w_off": float(w_off),
            "w_def": float(w_def),
            "rankings": _df_to_records(df),
        }
    )


@app.get("/rank-plays/baseline.csv")
def rank_baseline_csv(
    season: str = Query(...),
    our: str = Query(...),
    opp: str = Query(...),
    k: int = Query(5, ge=1, le=10),
    w_off: float = Query(0.7, ge=0, le=1),
) -> StreamingResponse:
    """CSV download for baseline rankings."""
    w_def = float(1.0 - w_off)
    try:
        df = rank_playtypes_baseline(
            team_df=rec.team_df,
            league_df=rec.league_df,
            season=season,
            our_team=our,
            opp_team=opp,
            k=k,
            w_off=float(w_off),
            w_def=w_def,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    import io

    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)

    filename = f"baseline_{season}_{our}_vs_{opp}_top{k}.csv"
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------
# AI endpoint: ML + context
# ---------------------------------------------------------------------


@app.get("/rank-plays/context-ml")
def rank_context_ml(
    season: str = Query(...),
    our: str = Query(...),
    opp: str = Query(...),
    margin: float = Query(..., description="Our score minus opponent score."),
    period: int = Query(..., ge=1, le=5),
    time_remaining: float = Query(..., ge=0, le=720),
    k: int = Query(5, ge=1, le=10),
    w_off: float = Query(0.7, ge=0, le=1),
) -> Dict[str, Any]:
    """
    AI use case:
      - ML predicts our offense PPP for each play type (offline-trained RandomForest).
      - Opponent defense is shrunk toward league to avoid small-sample noise.
      - Blend offense + defense into PPP_ML_BLEND.
      - Apply small, transparent adjustments from game context (score/time).
    """
    _require_season(season)
    _require_team(our, "our")
    _require_team(opp, "opponent")
    if our == opp:
        raise HTTPException(status_code=400, detail="Our team and opponent must be different.")

    if ML_PRED_DF is None or ML_PRED_DF.empty:
        raise HTTPException(
            status_code=400,
            detail="ML predictions not found. Run backend/ml_models.py to generate data/ml_offense_ppp_predictions.csv",
        )

    w_def = float(1.0 - w_off)

    team_df = rec.team_df
    league_df = rec.league_df

    off = team_df.query("SEASON == @season and TEAM_ABBREVIATION == @our and SIDE == 'offense'").copy()
    deff = team_df.query("SEASON == @season and TEAM_ABBREVIATION == @opp and SIDE == 'defense'").copy()

    if off.empty or deff.empty:
        raise HTTPException(status_code=400, detail="No offense/defense data for this matchup/season.")

    ml_slice = ML_PRED_DF[ML_PRED_DF["SEASON"] == season].copy()
    off = off.merge(
        ml_slice[["SEASON", "TEAM_ABBREVIATION", "PLAY_TYPE", "PPP_ML"]],
        on=["SEASON", "TEAM_ABBREVIATION", "PLAY_TYPE"],
        how="left",
    )

    league_off = league_df.query("SEASON == @season and SIDE == 'offense'")[["PLAY_TYPE", "PPP"]].rename(
        columns={"PPP": "PPP_LEAGUE_OFF"}
    )
    league_def = league_df.query("SEASON == @season and SIDE == 'defense'")[["PLAY_TYPE", "PPP"]].rename(
        columns={"PPP": "PPP_LEAGUE_DEF"}
    )

    merged = off.merge(
        deff[
            ["PLAY_TYPE", "PPP", "POSS", "POSS_PCT", "RELIABILITY_WEIGHT", "EFG_PCT", "TOV_POSS_PCT"]
        ].copy(),
        on="PLAY_TYPE",
        suffixes=("_OFF", "_DEF"),
    )
    merged = merged.merge(league_off, on="PLAY_TYPE", how="left")
    merged = merged.merge(league_def, on="PLAY_TYPE", how="left")

    rel_off = merged["RELIABILITY_WEIGHT_OFF"]
    rel_def = merged["RELIABILITY_WEIGHT_DEF"]

    merged["PPP_OFF_SHRUNK"] = rel_off * merged["PPP_OFF"] + (1 - rel_off) * merged["PPP_LEAGUE_OFF"]
    merged["PPP_DEF_SHRUNK"] = rel_def * merged["PPP_DEF"] + (1 - rel_def) * merged["PPP_LEAGUE_DEF"]

    merged["PPP_BASELINE"] = (
        float(w_off) * merged["PPP_OFF_SHRUNK"]
        + float(w_def) * (2 * merged["PPP_LEAGUE_OFF"] - merged["PPP_DEF_SHRUNK"])
    )

    merged = merged[merged["PPP_ML"].notna()].copy()
    if merged.empty:
        raise HTTPException(status_code=400, detail="No ML predictions available for this matchup.")

    merged["PPP_ML_BLEND"] = (
        float(w_off) * merged["PPP_ML"]
        + float(w_def) * (2 * merged["PPP_LEAGUE_OFF"] - merged["PPP_DEF_SHRUNK"])
    )

    T_left = _total_seconds_remaining(period, time_remaining)
    late_window = 180.0
    late_game_factor = _clamp((late_window - T_left) / late_window, 0.0, 1.0)

    trailing_factor = _clamp((-margin) / 10.0, 0.0, 1.0) if margin < 0 else 0.0
    leading_factor = _clamp((margin) / 10.0, 0.0, 1.0) if margin > 0 else 0.0

    avg_efg = float(merged["EFG_PCT_OFF"].mean()) if "EFG_PCT_OFF" in merged.columns else 0.0
    avg_tov = float(merged["TOV_POSS_PCT_OFF"].mean()) if "TOV_POSS_PCT_OFF" in merged.columns else 0.0

    merged["QUICK_PRIORITY"] = merged["PLAY_TYPE"].map(QUICK_WEIGHTS).fillna(0.0)

    merged["BONUS_QUICK"] = 0.04 * late_game_factor * (0.3 + trailing_factor) * merged["QUICK_PRIORITY"]
    merged["BONUS_SCORE"] = (
        0.25 * late_game_factor * trailing_factor * np.maximum(0.0, merged["EFG_PCT_OFF"] - avg_efg)
    )
    merged["PENALTY_PROTECT"] = (
        0.30 * late_game_factor * leading_factor * np.maximum(0.0, merged["TOV_POSS_PCT_OFF"] - avg_tov)
    )

    merged["CONTEXT_ADJ"] = merged["BONUS_QUICK"] + merged["BONUS_SCORE"] - merged["PENALTY_PROTECT"]
    merged["PPP_CONTEXT"] = merged["PPP_ML_BLEND"] + merged["CONTEXT_ADJ"]
    merged["DELTA_VS_BASELINE"] = merged["PPP_CONTEXT"] - merged["PPP_BASELINE"]

    def label_context() -> str:
        if late_game_factor >= 0.5 and trailing_factor > 0:
            return "Late & trailing"
        if late_game_factor >= 0.5 and leading_factor > 0:
            return "Late & leading"
        return "Normal context"

    context_label = label_context()
    merged["CONTEXT_LABEL"] = context_label

    def build_rationale(row: pd.Series) -> str:
        return (
            f"{row['PLAY_TYPE']}: ML base {row['PPP_ML_BLEND']:.3f}, "
            f"adj {row['CONTEXT_ADJ']:+.3f} ({context_label}). "
            f"Late={late_game_factor:.2f}, trailing={trailing_factor:.2f}, leading={leading_factor:.2f}."
        )

    merged["RATIONALE"] = merged.apply(build_rationale, axis=1)
    merged["LATE_GAME_FACTOR"] = float(late_game_factor)
    merged["TRAILING_FACTOR"] = float(trailing_factor)
    merged["LEADING_FACTOR"] = float(leading_factor)

    merged = merged.sort_values(["PPP_CONTEXT", "PPP_ML_BLEND"], ascending=False).head(k).reset_index(drop=True)

    out_cols = [
        "PLAY_TYPE",
        "PPP_CONTEXT",
        "PPP_ML_BLEND",
        "PPP_BASELINE",
        "DELTA_VS_BASELINE",
        "CONTEXT_LABEL",
        "RATIONALE",
        "CONTEXT_ADJ",
        "BONUS_QUICK",
        "BONUS_SCORE",
        "PENALTY_PROTECT",
        "LATE_GAME_FACTOR",
        "TRAILING_FACTOR",
        "LEADING_FACTOR",
    ]
    out_cols = [c for c in out_cols if c in merged.columns]
    rankings = _df_to_records(merged[out_cols])

    return jsonable_encoder(
        {
            "season": season,
            "our_team": our,
            "opp_team": opp,
            "k": k,
            "margin": float(margin),
            "period": int(period),
            "time_remaining_period_sec": float(time_remaining),
            "w_off": float(w_off),
            "w_def": float(w_def),
            "rankings": rankings,
        }
    )


# ---------------------------------------------------------------------
# Model evaluation endpoint (defense evidence)
# ---------------------------------------------------------------------


@app.get("/metrics/baseline-vs-ml")
def baseline_vs_ml(
    n_splits: int = Query(5, ge=2, le=10, description="K-fold splits used for evaluation."),
) -> Dict[str, Any]:
    summary_df, fold_metrics = run_cv_evaluation(n_splits=int(n_splits))

    metrics: List[Dict[str, Any]] = []
    for model_name, row in summary_df.iterrows():
        metrics.append(
            {
                "model": model_name,
                "RMSE_mean": float(row["RMSE_mean"]),
                "RMSE_std": float(row["RMSE_std"]),
                "MAE_mean": float(row["MAE_mean"]),
                "MAE_std": float(row["MAE_std"]),
                "R2_mean": float(row["R2_mean"]),
                "R2_std": float(row["R2_std"]),
            }
        )

    t_stat, p_val = paired_t_test_rmse(fold_metrics)

    return jsonable_encoder(
        {
            "n_splits": int(n_splits),
            "metrics": metrics,
            "rf_vs_baseline_t": None if (t_stat is None or np.isnan(t_stat)) else float(t_stat),
            "rf_vs_baseline_p": None if (p_val is None or np.isnan(p_val)) else float(p_val),
        }
    )


@app.get("/metrics/shot-models")
def shot_models_metrics(
    n_splits: int = Query(5, ge=2, le=10, description="GroupKFold splits by GAME_ID."),
) -> Dict[str, Any]:
    summary_df, _ = run_shot_model_cv(n_splits=int(n_splits), random_state=42)
    metrics: List[Dict[str, Any]] = []
    for model_name, row in summary_df.iterrows():
        metrics.append(
            {
                "model": model_name,
                "RMSE_mean": float(row["RMSE_mean"]),
                "RMSE_std": float(row["RMSE_std"]),
                "MAE_mean": float(row["MAE_mean"]),
                "MAE_std": float(row["MAE_std"]),
                "R2_mean": float(row["R2_mean"]),
                "R2_std": float(row["R2_std"]),
            }
        )
    return jsonable_encoder({"n_splits": int(n_splits), "metrics": metrics})


@app.get("/analysis/ml")
def ml_statistical_analysis(
    n_splits: int = Query(5, ge=2, le=10),
    min_poss: int = Query(25, ge=0, le=200),
    refresh: bool = Query(False),
) -> Dict[str, Any]:
    payload = compute_ml_analysis(
        rec.team_df,
        rec.league_df,
        n_splits=int(n_splits),
        min_poss=int(min_poss),
        force_refresh=bool(refresh),
    )
    return jsonable_encoder(payload)


@app.get("/analysis/shot-ml")
def shot_statistical_analysis(
    n_splits: int = Query(5, ge=2, le=10),
    refresh: bool = Query(False),
) -> Dict[str, Any]:
    payload = compute_shot_ml_analysis(n_splits=int(n_splits), force_refresh=bool(refresh))
    return jsonable_encoder(payload)


# ---------------------------------------------------------------------
# SportyPy visualization endpoint
# ---------------------------------------------------------------------


@app.get("/viz/playtype-zones")
def viz_playtype_zones(
    season: str = Query(...),
    our: str = Query(...),
    opp: str = Query(...),
    play_type: str = Query(...),
    w_off: float = Query(0.7, ge=0, le=1),
) -> Dict[str, Any]:
    _require_season(season)
    _require_team(our, "our")
    _require_team(opp, "opponent")
    if our == opp:
        raise HTTPException(status_code=400, detail="Our team and opponent must be different.")

    # Lazy-import viz module so backend can start even if SportyPy deps are missing
    try:
        from viz_sportypy import render_playtype_zone_png, png_bytes_to_base64
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                "SportyPy visualization import failed. "
                "Make sure you installed backend deps inside the backend venv:\n"
                "  python3 -m pip install sportypy matplotlib pillow\n"
                f"Import error: {e}"
            ),
        )

    w_def = 1.0 - float(w_off)

    df = rank_playtypes_baseline(
        team_df=rec.team_df,
        league_df=rec.league_df,
        season=season,
        our_team=our,
        opp_team=opp,
        k=10,
        w_off=float(w_off),
        w_def=float(w_def),
    )

    row = df[df["PLAY_TYPE"] == play_type]
    if row.empty:
        raise HTTPException(status_code=404, detail="Play type not found in Top-K output.")

    r = row.iloc[0]
    caption = (
        f"{play_type}: Pred {float(r['PPP_PRED']):.3f} PPP. "
        f"Our(off) {float(r['PPP_OFF_SHRUNK']):.3f} vs Opp(def) {float(r['PPP_DEF_SHRUNK']):.3f}."
    )

    title = f"{our} vs {opp} • {season} • {play_type}"
    png = render_playtype_zone_png(play_type, title)

    return {"caption": caption, "image_base64": png_bytes_to_base64(png)}


# ---------------------------------------------------------------------
# Shot Intelligence endpoints (Dataset 2)
# ---------------------------------------------------------------------


@app.get("/shotplan/rank")
def rank_shotplan(
    season: str = Query(...),
    our: str = Query(..., description="Our team abbreviation."),
    opp: str = Query(..., description="Opponent team abbreviation."),
    k: int = Query(5, ge=1, le=10),
    w_off: float = Query(0.7, ge=0, le=1),
) -> Dict[str, Any]:
    w_def = float(1.0 - w_off)
    rec_shot = _get_shot_rec()
    try:
        result = rec_shot.rank(season=season, our_team=our, opp_team=opp, k=int(k), w_off=float(w_off))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return jsonable_encoder(
        {
            "season": season,
            "our_team": our,
            "opp_team": opp,
            "k": int(k),
            "w_off": float(w_off),
            "w_def": float(w_def),
            "best_shooter": None,
            "top_shot_types": result.get("top_shot_types", []),
            "top_zones": result.get("top_zones", []),
            "metadata": {"data_source": "nba_pbp_2021_present.parquet"},
        }
    )


@app.get("/viz/shot-heatmap")
def viz_shot_heatmap(
    season: str = Query(...),
    our: str = Query(...),
    opp: str = Query(...),
    shot_type: Optional[str] = Query(None),
    zone: Optional[str] = Query(None),
) -> Dict[str, Any]:
    # Lazy import to avoid SportyPy import issues at startup
    try:
        from viz_shot_heatmap import render_shot_heatmap_png, png_bytes_to_base64
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                "Shot heatmap import failed. Install backend deps:\n"
                "  python3 -m pip install sportypy matplotlib pillow\n"
                f"Import error: {e}"
            ),
        )

    shots_df = _get_shots_clean_df()
    title = f"{our} vs {opp} • {season}"
    png = render_shot_heatmap_png(
        shots_df=shots_df,
        season=season,
        our_team=our,
        opp_team=opp,
        shot_type=shot_type,
        zone=zone,
        title=title,
    )
    caption = f"Shot Heatmap • {our} vs {opp} • {season}"
    return {"caption": caption, "image_base64": png_bytes_to_base64(png)}


@app.get("/export/shotplan.pdf")
def export_shotplan_pdf(
    season: str = Query(...),
    our: str = Query(...),
    opp: str = Query(...),
    k: int = Query(5, ge=1, le=10),
    w_off: float = Query(0.7, ge=0, le=1),
    shot_type: Optional[str] = Query(None),
    zone: Optional[str] = Query(None),
) -> StreamingResponse:
    try:
        from export_shotplan_pdf import build_shotplan_pdf
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"export_shotplan_pdf.py missing or failed to import. Error: {e}",
        )

    pdf_bytes, filename = build_shotplan_pdf(
        season=season,
        our=our,
        opp=opp,
        k=int(k),
        w_off=float(w_off),
        shot_type=shot_type,
        zone=zone,
    )
    return StreamingResponse(
        pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------
# Routers (must be registered AFTER app/rec/meta are defined)
# ---------------------------------------------------------------------

app.include_router(create_pdf_router(rec, VALID_SEASONS, VALID_TEAMS, TEAM_NAMES))
