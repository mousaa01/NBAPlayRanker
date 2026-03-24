"""backend/pbp_constants.py

Dataset2 (NBA play-by-play / shot attempts) constants.

This module is additive: it does not change existing Dataset1 endpoints/behavior
or the existing Dataset2 `/shot*` endpoints. It provides a stable foundation
for the new `/pbp/*` module (Phase 2+) by centralizing paths and cache versions.
"""

from __future__ import annotations

from pathlib import Path


# ---------------------------------------------------------------------
# Base paths
# ---------------------------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BACKEND_DIR / "data"
PBP_DIR = DATA_DIR / "pbp"
CACHE_DIR = PBP_DIR / "cache"


# ---------------------------------------------------------------------
# Source + primary artifacts (these already match your repo conventions)
# ---------------------------------------------------------------------

# Raw parquet lives here (you confirmed you moved it)
SOURCE_PARQUET = PBP_DIR / "nba_pbp_2021_present.parquet"

# Fallback location some scripts may use
ALT_SOURCE_PARQUET = DATA_DIR / "nba_pbp_2021_present.parquet"

# Existing “official” clean shots parquet used by current `/shot*` endpoints
# (shot_etl.CLEAN_PARQUET points here as well)
CLEAN_PARQUET = PBP_DIR / "shots_clean.parquet"

# Existing aggregates used by current `/shotplan/*` endpoints
AGG_PARQUET = PBP_DIR / "shots_agg.parquet"
AGG_LEAGUE_PARQUET = PBP_DIR / "shots_agg_league.parquet"


# ---------------------------------------------------------------------
# New canonical cache artifacts for `/pbp/*` endpoints (Phase 2+)
# ---------------------------------------------------------------------

# Canonical columns (snake_case) cached for fast reloads + consistent schema.
CANONICAL_PARQUET = CACHE_DIR / "shots_canonical.parquet"

# Cache metadata to validate the canonical parquet against the source.
CANONICAL_META_JSON = CACHE_DIR / "shots_canonical_meta.json"

# Aggregates cache metadata (depends on shots_clean.parquet)
AGG_META_JSON = CACHE_DIR / "shots_agg_meta.json"


# ---------------------------------------------------------------------
# Cache versioning (bump when logic changes)
# ---------------------------------------------------------------------

# If you change how canonical columns are built (rename fields, dtype changes,
# new features), bump this string to invalidate cached canonical files.
CANONICAL_SCHEMA_VERSION = "canonical_v1"

# If you change the aggregate build logic/columns, bump this to invalidate.
AGG_SCHEMA_VERSION = "agg_v1"
