from __future__ import annotations

import sys
from pathlib import Path


def _ensure_backend_on_path() -> Path:
    backend_dir = Path(__file__).resolve().parents[2]
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    return backend_dir


def main() -> None:
    backend_dir = _ensure_backend_on_path()
    from shot_etl import build_shots_dataset, CLEAN_PARQUET, SOURCE_PARQUET, ALT_SOURCE_PARQUET

    print("[build_shots_dataset] Starting ETL for Dataset 2 (shot attempts)")
    print(f"[build_shots_dataset] Backend dir: {backend_dir}")
    print(f"[build_shots_dataset] Source parquet: {SOURCE_PARQUET}")
    if ALT_SOURCE_PARQUET.exists():
        print(f"[build_shots_dataset] Alt source parquet found: {ALT_SOURCE_PARQUET}")
    print(f"[build_shots_dataset] Output parquet: {CLEAN_PARQUET}")

    output_path = build_shots_dataset(parquet_path=SOURCE_PARQUET, output_path=CLEAN_PARQUET)
    print(f"[build_shots_dataset] Done. Wrote: {output_path}")


if __name__ == "__main__":
    main()
