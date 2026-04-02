# backend/tests/conftest.py
#
# Pytest session bootstrap for backend tests.
#
# Why this file exists:
#   pytest collects test files and runs them in a subprocess.  The subprocess
#   does not automatically know about the custom package layout under backend/.
#   Without this file, every import of the form
#
#       from infrastructure.model_management.ml_models import ...
#       from domain.baseline_recommendation.baseline_recommender import ...
#
#   would fail with ModuleNotFoundError.
#
# This conftest runs once before any test is collected and adds the two
# directories that pytest needs to resolve all backend imports:
#
#   1. backend/                          ← top-level package root
#      Lets Python resolve dot-separated imports:
#        from infrastructure.model_management.ml_models import ...
#        from domain.baseline_recommendation.baseline_recommender import ...
#
#   2. backend/domain/baseline_recommendation/   ← flat-import compatibility
#      Lets the existing test_baseline.py use:
#        from baseline_recommender import BaselineRecommender
#      (that flat-style import is already in the repo; we keep it working.)

import sys
from pathlib import Path

# ── 1. backend/ root ────────────────────────────────────────────────────────
BACKEND_DIR: Path = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# ── 2. Flat-import compatibility for test_baseline.py ────────────────────────
_BASELINE_PKG_DIR: Path = BACKEND_DIR / "domain" / "baseline_recommendation"
if str(_BASELINE_PKG_DIR) not in sys.path:
    sys.path.append(str(_BASELINE_PKG_DIR))
