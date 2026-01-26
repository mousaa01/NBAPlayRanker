from __future__ import annotations

from pathlib import Path
from typing import Iterable, Optional, Sequence

import math
import numpy as np
import pandas as pd

from shot_config import normalize_shot_type, season_int_to_str, zone_from_xy

# ---------------------------------------------------------------------
# Paths (relative to backend/)
# ---------------------------------------------------------------------

DATA_DIR = Path(__file__).parent / "data"
PBP_DIR = DATA_DIR / "pbp"
SOURCE_PARQUET = PBP_DIR / "nba_pbp_2021_present.parquet"
CLEAN_PARQUET = PBP_DIR / "shots_clean.parquet"


def _pick_col(df: pd.DataFrame, candidates: Sequence[str], required: bool = False) -> Optional[str]:
    for c in candidates:
        if c in df.columns:
            return c
    if required:
        raise ValueError(f"Required column not found. Tried: {list(candidates)}")
    return None


def _coerce_bool(s: pd.Series) -> pd.Series:
    if s.dtype == bool:
        return s
    if np.issubdtype(s.dtype, np.number):
        return s.fillna(0).astype(float) > 0
    s_str = s.astype(str).str.strip().str.lower()
    return s_str.isin({"1", "true", "t", "yes", "y"})


def _coerce_made(s: pd.Series) -> pd.Series:
    if s.dtype == bool:
        return s.astype(int)
    if np.issubdtype(s.dtype, np.number):
        return (s.fillna(0).astype(float) > 0).astype(int)
    s_str = s.astype(str).str.strip().str.lower()
    made = s_str.isin({"1", "true", "t", "made", "make", "good"})
    miss = s_str.isin({"0", "false", "f", "miss", "missed", "no"})
    out = pd.Series(np.where(made, 1, np.where(miss, 0, np.nan)), index=s.index)
    return out.fillna(0).astype(int)


def _parse_clock_to_sec(val: object) -> float:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return float("nan")
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s:
        return float("nan")
    if ":" in s:
        try:
            mins, secs = s.split(":")
            return float(int(mins) * 60 + int(secs))
        except Exception:
            return float("nan")
    try:
        return float(s)
    except Exception:
        return float("nan")


def _parse_margin(val: object) -> float:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return float("nan")
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().upper()
    if s in {"", "TIE", "TIED", "0"}:
        return 0.0
    try:
        return float(s)
    except Exception:
        return float("nan")


def _compute_distance(x: pd.Series, y: pd.Series) -> pd.Series:
    return np.sqrt(x.astype(float) ** 2 + y.astype(float) ** 2)


def _compute_angle_deg(x: pd.Series, y: pd.Series) -> pd.Series:
    return np.degrees(np.arctan2(y.astype(float), x.astype(float)))


def _normalize_shot_type_from_row(row: pd.Series) -> str:
    return normalize_shot_type(
        type_text=row.get("type_text"),
        type_abbreviation=row.get("type_abbreviation"),
        text=row.get("text"),
    )


def build_shots_clean(raw_df: pd.DataFrame) -> pd.DataFrame:
    df = raw_df.copy()

    shooting_col = _pick_col(df, ["shooting_play", "is_shot_attempt", "is_shot"], required=True)
    df = df[_coerce_bool(df[shooting_col])].copy()

    season_col = _pick_col(df, ["season", "season_year", "season_int"], required=True)
    df["SEASON_STR"] = df[season_col].apply(season_int_to_str)

    team_col = _pick_col(df, ["team_abbr", "team_abbreviation", "team"], required=True)
    df["TEAM_ABBR"] = df[team_col].astype(str).str.strip()

    opp_col = _pick_col(df, ["opp_abbr", "opponent_team_abbr", "opponent_team_abbreviation", "opponent"], required=False)
    if opp_col:
        df["OPP_ABBR"] = df[opp_col].astype(str).str.strip()
    else:
        df["OPP_ABBR"] = None

    home_flag_col = _pick_col(df, ["home_flag", "is_home", "team_is_home", "home"], required=False)
    if home_flag_col:
        df["HOME_FLAG"] = _coerce_bool(df[home_flag_col])
    else:
        home_team_col = _pick_col(df, ["home_team_abbr", "home_team_abbreviation"], required=False)
        if home_team_col:
            df["HOME_FLAG"] = df[home_team_col].astype(str).str.strip().eq(df["TEAM_ABBR"])
        else:
            df["HOME_FLAG"] = False

    # Shot type normalization
    type_text_col = _pick_col(df, ["type_text", "shot_type", "event_subtype"], required=False)
    type_abbrev_col = _pick_col(df, ["type_abbreviation", "type_abbrev", "shot_type_abbr"], required=False)
    text_col = _pick_col(df, ["text", "description", "event_description"], required=False)

    df["type_text"] = df[type_text_col] if type_text_col else None
    df["type_abbreviation"] = df[type_abbrev_col] if type_abbrev_col else None
    df["text"] = df[text_col] if text_col else None
    df["SHOT_TYPE"] = df.apply(_normalize_shot_type_from_row, axis=1)

    # Coordinates
    x_col = _pick_col(df, ["x", "x_loc", "loc_x", "coordinate_x", "shot_x"], required=True)
    y_col = _pick_col(df, ["y", "y_loc", "loc_y", "coordinate_y", "shot_y"], required=True)
    df["X"] = pd.to_numeric(df[x_col], errors="coerce")
    df["Y"] = pd.to_numeric(df[y_col], errors="coerce")

    # Shot distance
    dist_col = _pick_col(df, ["shot_distance", "dist", "distance"], required=False)
    if dist_col:
        df["DIST"] = pd.to_numeric(df[dist_col], errors="coerce")
    else:
        df["DIST"] = _compute_distance(df["X"], df["Y"])

    df["ANGLE"] = _compute_angle_deg(df["X"], df["Y"])

    # Shot value (2 or 3)
    shot_value_col = _pick_col(df, ["shot_value", "shot_pts", "value", "shot_value_pts"], required=False)
    is_three_col = _pick_col(df, ["is_three", "is_three_shot", "three_point_attempt"], required=False)
    if shot_value_col:
        df["SHOT_VALUE"] = pd.to_numeric(df[shot_value_col], errors="coerce")
    elif is_three_col:
        df["SHOT_VALUE"] = np.where(_coerce_bool(df[is_three_col]), 3, 2)
    else:
        df["SHOT_VALUE"] = np.where(df["DIST"].fillna(0) >= 22.0, 3, 2)

    # Made / Points
    made_col = _pick_col(df, ["shot_made", "shot_made_flag", "made", "is_made", "shot_result"], required=False)
    if made_col:
        df["MADE"] = _coerce_made(df[made_col])
    else:
        df["MADE"] = 0
    df["POINTS"] = df["SHOT_VALUE"].fillna(0).astype(int) * df["MADE"].fillna(0).astype(int)

    # Period + clock
    period_col = _pick_col(df, ["period", "period_number"], required=False)
    df["PERIOD"] = pd.to_numeric(df[period_col], errors="coerce") if period_col else np.nan

    clock_col = _pick_col(df, ["clock_sec", "seconds_remaining", "period_time_seconds", "game_clock"], required=False)
    if clock_col:
        df["CLOCK_SEC"] = df[clock_col].apply(_parse_clock_to_sec)
    else:
        df["CLOCK_SEC"] = np.nan

    # Margin
    margin_col = _pick_col(df, ["score_margin", "margin", "score_diff"], required=False)
    if margin_col:
        df["MARGIN"] = df[margin_col].apply(_parse_margin)
    else:
        df["MARGIN"] = np.nan

    # IDs
    game_id_col = _pick_col(df, ["game_id", "gameid"], required=True)
    df["GAME_ID"] = df[game_id_col].astype(str).str.strip()

    shooter_col = _pick_col(df, ["athlete_id_1", "shooter_id", "player_id"], required=False)
    df["SHOOTER_ID"] = df[shooter_col].astype(str).str.strip() if shooter_col else None

    # Zone
    df["ZONE"] = [
        zone_from_xy(x, y, d) if np.isfinite(x) and np.isfinite(y) else "unknown"
        for x, y, d in zip(df["X"], df["Y"], df["DIST"])
    ]

    keep_cols = [
        "SEASON_STR",
        "TEAM_ABBR",
        "OPP_ABBR",
        "HOME_FLAG",
        "SHOT_TYPE",
        "SHOT_VALUE",
        "MADE",
        "POINTS",
        "X",
        "Y",
        "DIST",
        "ANGLE",
        "ZONE",
        "PERIOD",
        "CLOCK_SEC",
        "MARGIN",
        "GAME_ID",
        "SHOOTER_ID",
    ]

    clean = df[keep_cols].copy()

    # Drop rows missing core fields
    clean = clean.dropna(subset=["SEASON_STR", "TEAM_ABBR", "GAME_ID", "X", "Y"]).reset_index(drop=True)

    # Deterministic ordering
    sort_cols = [c for c in ["GAME_ID", "PERIOD", "CLOCK_SEC", "TEAM_ABBR"] if c in clean.columns]
    if sort_cols:
        clean = clean.sort_values(sort_cols).reset_index(drop=True)

    return clean


def build_shots_dataset(
    parquet_path: Path = SOURCE_PARQUET,
    output_path: Path = CLEAN_PARQUET,
) -> Path:
    parquet_path = Path(parquet_path)
    output_path = Path(output_path)

    if not parquet_path.exists():
        raise FileNotFoundError(f"Parquet not found: {parquet_path}")

    print(f"[shot_etl] Loading parquet: {parquet_path}")
    raw = pd.read_parquet(parquet_path)
    print(f"[shot_etl] Raw rows: {len(raw):,} | cols: {len(raw.columns)}")

    print("[shot_etl] Building clean shots table...")
    clean = build_shots_clean(raw)
    print(f"[shot_etl] Clean rows: {len(clean):,}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    clean.to_parquet(output_path, index=False)
    print(f"[shot_etl] Saved: {output_path}")

    return output_path


if __name__ == "__main__":
    build_shots_dataset()
