# backend/pbp_phase2_build.py
from __future__ import annotations

import time
from pathlib import Path

from domain.shot_analysis.shot_ml_models import run_shot_model_cv
from domain.shot_analysis.shot_ml_stat_analysis import compute_shot_ml_analysis

# Must match your project rule: backend/data/pbp/cache/
CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "pbp" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

ANALYSIS_CACHE = CACHE_DIR / "pbp_phase2_shot_ml_analysis.json"
CV_CACHE = CACHE_DIR / "pbp_phase2_shot_model_cv.json"


def main() -> None:
    import json
    import math

    def sanitize(obj):
        if obj is None:
            return None
        if isinstance(obj, float):
            return obj if math.isfinite(obj) else None
        if isinstance(obj, dict):
            return {str(k): sanitize(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [sanitize(v) for v in obj]
        return obj

    print("Building Phase 2 caches...")

    t0 = time.time()
    analysis = compute_shot_ml_analysis(n_splits=5, force_refresh=True)
    analysis_out = {
        "cached": False,
        "computed_at_unix": int(time.time()),
        "compute_seconds": float(time.time() - t0),
        "payload": sanitize(analysis),
    }
    ANALYSIS_CACHE.write_text(json.dumps(analysis_out, indent=2), encoding="utf-8")
    print(f"✅ Wrote: {ANALYSIS_CACHE}")

    t1 = time.time()
    summary_df, fold_df = run_shot_model_cv(n_splits=5, random_state=42)

    metrics = []
    for model_name, row in summary_df.iterrows():
        metrics.append(
            {
                "model": str(model_name),
                "RMSE_mean": float(row.get("RMSE_mean", float("nan"))),
                "RMSE_std": float(row.get("RMSE_std", float("nan"))),
                "MAE_mean": float(row.get("MAE_mean", float("nan"))),
                "MAE_std": float(row.get("MAE_std", float("nan"))),
                "R2_mean": float(row.get("R2_mean", float("nan"))),
                "R2_std": float(row.get("R2_std", float("nan"))),
            }
        )

    try:
        best_model = str(summary_df["RMSE_mean"].idxmin())
    except Exception:
        best_model = None

    cv_out = {
        "cached": False,
        "computed_at_unix": int(time.time()),
        "compute_seconds": float(time.time() - t1),
        "n_splits": 5,
        "best_model": best_model,
        "metrics": sanitize(metrics),
        "fold_summary": sanitize(fold_df.to_dict(orient="records")),
    }
    CV_CACHE.write_text(json.dumps(cv_out, indent=2), encoding="utf-8")
    print(f"✅ Wrote: {CV_CACHE}")

    print("Done.")


if __name__ == "__main__":
    main()
