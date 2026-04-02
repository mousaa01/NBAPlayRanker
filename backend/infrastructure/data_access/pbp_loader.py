"""backend/pbp_loader.py

Dataset2 loader (Phase 1).

Provides a fast, single-process cache of the *canonical* (snake_case) shots
dataset produced by `pbp_clean.ensure_canonical_parquet`.

Design goals:
- Load parquet once per backend process.
- If the underlying cache file changes (rebuilt), reload automatically.

This will be used by `/pbp/*` endpoints in Phase 2.
"""

from __future__ import annotations

from typing import Optional

import pandas as pd

from .pbp_constants import CANONICAL_META_JSON, CANONICAL_PARQUET
from .pbp_cache import read_json
from .pbp_clean import ensure_canonical_parquet


_CANONICAL_DF: Optional[pd.DataFrame] = None
_CANONICAL_ID: Optional[str] = None


def _current_cache_id() -> Optional[str]:
    meta = read_json(CANONICAL_META_JSON)
    if not meta:
        return None
    fp = meta.get("fingerprint")
    if not isinstance(fp, dict):
        return None
    try:
        return f"{fp['schema_version']}|{fp['source_path']}|{fp['source_mtime_ns']}|{fp['source_size']}"
    except Exception:
        return None


def get_pbp_canonical_df(*, ensure: bool = True, force_rebuild: bool = False) -> pd.DataFrame:
    """Return the canonical shots dataframe (snake_case), cached in memory.

    Args:
      ensure: if True, build canonical cache on demand when missing.
      force_rebuild: if True and ensure=True, rebuild canonical cache before loading.
    """

    global _CANONICAL_DF, _CANONICAL_ID

    if ensure:
        ensure_canonical_parquet(force_rebuild=force_rebuild)

    if not CANONICAL_PARQUET.exists():
        raise FileNotFoundError(
            "Canonical shots parquet not found. Run:\n"
            "  python backend/data/etl/build_pbp_pipeline.py"
        )

    cache_id = _current_cache_id() or str(CANONICAL_PARQUET.stat().st_mtime_ns)

    if _CANONICAL_DF is None or _CANONICAL_ID != cache_id:
        _CANONICAL_DF = pd.read_parquet(CANONICAL_PARQUET)
        _CANONICAL_ID = cache_id

    return _CANONICAL_DF


def clear_pbp_canonical_cache() -> None:
    """Clear the in-memory canonical dataframe cache (useful for tests/dev)."""
    global _CANONICAL_DF, _CANONICAL_ID
    _CANONICAL_DF = None
    _CANONICAL_ID = None
