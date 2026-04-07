from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.feature_selection import RFE, SelectKBest, f_regression
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupKFold, GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from infrastructure.model_management import FEATURE_COLS, TARGET_COL


@dataclass
class _Cache:
    n_splits: int
    min_poss: int
    payload: Dict[str, Any]


_CACHE: Optional[_Cache] = None


def _summary_stats(x: np.ndarray) -> Dict[str, float]:
    x = np.asarray(x, dtype=float)
    x = x[np.isfinite(x)]
    if x.size == 0:
        return {k: float("nan") for k in ["min", "p25", "median", "p75", "max", "mean", "std"]}
    return {
        "min": float(np.min(x)),
        "p25": float(np.quantile(x, 0.25)),
        "median": float(np.quantile(x, 0.50)),
        "p75": float(np.quantile(x, 0.75)),
        "max": float(np.max(x)),
        "mean": float(np.mean(x)),
        "std": float(np.std(x, ddof=1)) if x.size > 1 else 0.0,
    }


def _histogram(x: np.ndarray, bins: int = 20) -> Dict[str, Any]:
    x = np.asarray(x, dtype=float)
    x = x[np.isfinite(x)]
    if x.size == 0:
        return {"bins": [], "counts": []}
    counts, edges = np.histogram(x, bins=bins)
    return {"bins": [float(e) for e in edges.tolist()], "counts": [int(c) for c in counts.tolist()]}


def _corr_matrix(df: pd.DataFrame, cols: List[str]) -> Dict[str, Any]:
    sub = df[cols].astype(float)
    corr = sub.corr(method="pearson").fillna(0.0)
    return {"labels": cols, "matrix": [[float(v) for v in row] for row in corr.to_numpy().tolist()]}


def _feature_target_corr(df: pd.DataFrame, feature_cols: List[str], target_col: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    y = df[target_col].astype(float)
    for c in feature_cols:
        x = df[c].astype(float)
        v = float(x.corr(y)) if x.notna().any() and y.notna().any() else 0.0
        out.append({"feature": c, "corr": v, "abs": abs(v)})
    out.sort(key=lambda r: r["abs"], reverse=True)
    return out


def _correlation_prune(
    df: pd.DataFrame,
    feature_cols: List[str],
    target_corr: List[Dict[str, Any]],
    threshold: float = 0.90,
) -> Dict[str, Any]:
    abs_target = {r["feature"]: float(r["abs"]) for r in target_corr}
    corr = df[feature_cols].astype(float).corr().abs().fillna(0.0)

    kept = set(feature_cols)
    dropped: List[str] = []

    while True:
        cols = [c for c in feature_cols if c in kept]
        if len(cols) < 2:
            break
        cmat = corr.loc[cols, cols].to_numpy(copy=True)
        np.fill_diagonal(cmat, 0.0)
        max_val = float(cmat.max())
        if max_val <= threshold:
            break
        idx = np.unravel_index(np.argmax(cmat),cmat.shape)
        f1, f2 = cols[idx[0]], cols[idx[1]]
        drop = f2 if abs_target.get(f1, 0.0) >= abs_target.get(f2, 0.0) else f1
        if drop in kept:
            kept.remove(drop)
            dropped.append(drop)

    return {"threshold": float(threshold), "kept": sorted(list(kept)), "dropped": dropped}


def _walk_forward_folds(seasons: List[str], n_splits: int) -> List[Tuple[List[str], str]]:
    seasons = sorted(seasons)
    start = max(1, len(seasons) - n_splits)
    folds: List[Tuple[List[str], str]] = []
    for j in range(start, len(seasons)):
        test_season = seasons[j]
        train_seasons = seasons[:j]
        if train_seasons:
            folds.append((train_seasons, test_season))
    return folds


def compute_ml_analysis(
    team_df: pd.DataFrame,
    league_df: pd.DataFrame,
    *,
    n_splits: int = 5,
    min_poss: int = 25,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    global _CACHE
    if _CACHE and not force_refresh and _CACHE.n_splits == n_splits and _CACHE.min_poss == min_poss:
        return _CACHE.payload

    off = team_df[team_df["SIDE"] == "offense"].copy()

    league_off = (
        league_df[league_df["SIDE"] == "offense"][["SEASON", "PLAY_TYPE", "PPP", "RELIABILITY_WEIGHT"]]
        .rename(columns={"PPP": "PPP_LEAGUE", "RELIABILITY_WEIGHT": "REL_LEAGUE"})
        .copy()
    )

    df = off.merge(league_off, on=["SEASON", "PLAY_TYPE"], how="left")
    df = df[df["POSS"].astype(float) >= float(min_poss)].copy()

    needed = ["SEASON", TARGET_COL, "PPP_LEAGUE"] + FEATURE_COLS
    df = df.dropna(subset=needed).reset_index(drop=True)

    dataset = {
        "rows_after_filters": int(len(df)),
        "min_poss_filter": int(min_poss),
        "n_seasons": int(df["SEASON"].nunique()),
        "seasons": sorted(df["SEASON"].unique().tolist()),
        "n_teams": int(df["TEAM_ABBREVIATION"].nunique()),
        "n_play_types": int(df["PLAY_TYPE"].nunique()),
        "feature_cols": FEATURE_COLS,
        "target_col": TARGET_COL,
    }

    eda = {
        "poss": _summary_stats(df["POSS"].to_numpy(dtype=float)),
        "ppp": _summary_stats(df[TARGET_COL].to_numpy(dtype=float)),
        "hist_poss": _histogram(df["POSS"].to_numpy(dtype=float), bins=20),
        "hist_ppp": _histogram(df[TARGET_COL].to_numpy(dtype=float), bins=20),
        "missing_counts": {c: int(df[c].isna().sum()) for c in needed},
    }

    corr_cols = FEATURE_COLS + [TARGET_COL, "PPP_LEAGUE"]
    correlations = _corr_matrix(df, corr_cols)
    target_corr = _feature_target_corr(df, FEATURE_COLS, TARGET_COL)
    corr_prune = _correlation_prune(df, FEATURE_COLS, target_corr, threshold=0.90)

    X = df[FEATURE_COLS].to_numpy(dtype=float)
    y = df[TARGET_COL].to_numpy(dtype=float)
    groups = df["SEASON"].astype(str).to_numpy()
    gkf = GroupKFold(n_splits=min(n_splits, df["SEASON"].nunique()))

    skb = SelectKBest(score_func=f_regression, k=min(6, X.shape[1]))
    skb.fit(X, y)
    skb_scores = [{"feature": FEATURE_COLS[i], "score": float(skb.scores_[i])} for i in range(len(FEATURE_COLS))]
    skb_scores.sort(key=lambda r: r["score"], reverse=True)
    skb_selected = [FEATURE_COLS[i] for i, keep in enumerate(skb.get_support()) if keep]

    # RFE (wrapper method)
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    rfe = RFE(estimator=Ridge(alpha=1.0), n_features_to_select=min(6, len(FEATURE_COLS)))
    rfe.fit(Xs, y)
    rfe_selected = [FEATURE_COLS[i] for i, keep in enumerate(rfe.get_support()) if keep]
    rfe_ranking = [{"feature": FEATURE_COLS[i], "rank": int(rfe.ranking_[i])} for i in range(len(FEATURE_COLS))]

    feature_selection = {
        "correlation_filter": corr_prune,
        "select_k_best": {"k": int(skb.k), "selected": skb_selected, "scores": skb_scores},
        "rfe": {"selected": rfe_selected, "ranking": sorted(rfe_ranking, key=lambda r: r["rank"])},
    }

    # Model selection + tuning
    model_features = corr_prune["kept"] if corr_prune.get("kept") else FEATURE_COLS
    X_m = df[model_features].to_numpy(dtype=float)

    ridge_pipe = Pipeline([("scaler", StandardScaler()), ("model", Ridge())])
    ridge_search = GridSearchCV(
        ridge_pipe,
        param_grid={"model__alpha": [0.1, 1.0, 10.0, 50.0]},
        scoring="neg_root_mean_squared_error",
        cv=gkf,
        n_jobs=-1,
    )
    ridge_search.fit(X_m, y, groups=groups)

    rf_search = GridSearchCV(
        RandomForestRegressor(),
        param_grid={"n_estimators": [250], "min_samples_leaf": [2, 5], "max_depth": [None, 10]},
        scoring="neg_root_mean_squared_error",
        cv=gkf,
        n_jobs=-1,
    )
    rf_search.fit(X_m, y, groups=groups)

    gbr_search = GridSearchCV(
        GradientBoostingRegressor(),
        param_grid={"n_estimators": [200, 400], "learning_rate": [0.05, 0.1], "max_depth": [2, 3]},
        scoring="neg_root_mean_squared_error",
        cv=gkf,
        n_jobs=-1,
    )
    gbr_search.fit(X_m, y, groups=groups)

    tuning = {
        "cv": "GroupKFold by season (prevents leakage)",
        "features_used": model_features,
        "ridge": {
            "best_params": {"alpha": float(ridge_search.best_params_["model__alpha"])},
            "best_rmse": float(-ridge_search.best_score_),
        },
        "random_forest": {"best_params": rf_search.best_params_, "best_rmse": float(-rf_search.best_score_)},
        "gradient_boosting": {"best_params": gbr_search.best_params_, "best_rmse": float(-gbr_search.best_score_)},
    }

    # ✅ NEW: add notes explaining tuning vs holdout to avoid committee confusion
    payload = {
        "dataset": dataset,
        "eda": eda,
        "correlations": correlations,
        "target_feature_corr": target_corr,
        "feature_selection": feature_selection,
        "model_selection": {
            "tuning": tuning,
            "notes": [
                "Tuning RMSE is from GroupKFold cross-validation during hyperparameter search.",
                "Holdout RMSE (Model Performance page) is a stricter test: train on earlier seasons, test on later seasons.",
                "Because holdout is harder, its RMSE can be higher than the tuning RMSE (this is expected).",
                "We choose the deployed model using holdout generalization, not the tuning score.",
            ],
        },
    }

    _CACHE = _Cache(n_splits=n_splits, min_poss=min_poss, payload=payload)
    return payload
