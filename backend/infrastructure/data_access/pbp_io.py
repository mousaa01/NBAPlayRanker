# backend/pbp_io.py

"""Small cached parquet reader utilities for Dataset2 (PBP).

Why this exists:
  - VS Code / Pylance was complaining that `pbp_io` couldn't be resolved.
  - Multiple PBP helpers need a *cached* canonical parquet read, but we don't
    want to scan the large file on every request.

Implementation:
  - For the canonical parquet (`pbp_constants.CANONICAL_PARQUET`), we reuse the
    existing `pbp_loader.get_pbp_canonical_df()` which already keeps a process-
    level cache and handles rebuild checks.
  - For any other parquet, we do a lightweight LRU cache keyed by path + mtime.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

import pandas as pd

from pbp_constants import CANONICAL_PARQUET
from pbp_loader import get_pbp_canonical_df


@lru_cache(maxsize=4)
def _read_parquet_full(path_str: str, mtime_ns: int) -> pd.DataFrame:
    # NOTE: returning a DataFrame object from an LRU cache is okay as long as callers
    # do not mutate it. We return copies when subsetting columns.
    return pd.read_parquet(path_str)


def read_parquet_cached(path: Path, columns: Optional[list[str]] = None) -> pd.DataFrame:
    """
    Cached parquet read.

    Args:
      path: parquet file path
      columns: optional list of columns to return (copied subset)
    """
    p = Path(path)

    # Canonical parquet: use the existing loader cache
    try:
        if p.resolve() == CANONICAL_PARQUET.resolve():
            df = get_pbp_canonical_df(ensure=True, force_rebuild=False)
        else:
            st = p.stat()
            df = _read_parquet_full(str(p), st.st_mtime_ns)
    except FileNotFoundError:
        raise
    except Exception:
        # Re-raise any other errors as-is to keep debugging clear
        raise

    if columns:
        missing = [c for c in columns if c not in df.columns]
        if missing:
            raise KeyError(f"Parquet missing expected columns {missing}. Available: {list(df.columns)}")
        return df[columns].copy()

    return df
