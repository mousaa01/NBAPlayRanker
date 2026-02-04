# backend/pbp_router.py
"""
Dataset2 (PBP) FastAPI router.

This file defines the PBP endpoints:
- GET /pbp/meta/options
- GET /pbp/shots/preview
- GET /pbp/shots.csv

Important:
- This file only defines routes.
- The actual data logic lives in backend/pbp_shots.py
- We mount this router in app.py (or your FastAPI entry file).
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from pbp_shots import (
    get_meta_options,
    get_shots_csv_response,
    get_shots_json,
)

# All routes in this router will be under /pbp/*
router = APIRouter(prefix="/pbp", tags=["pbp"])


@router.get("/meta/options")
def pbp_meta_options():
    """
    Returns dropdown options for Dataset2 / PBP.

    Frontend uses this to populate:
    - seasons
    - teams
    - shotTypes
    - zones

    Response shape:
      { seasons: [], teams: [], shotTypes: [], zones: [] }
    """
    return get_meta_options()


@router.get("/shots/preview")
def pbp_shots_preview(
    season: str,
    team: str = "",
    opp: Optional[str] = None,

    # support both shot_type and shotType (frontend sometimes accidentally sends both)
    shot_type: Optional[str] = None,
    shotType: Optional[str] = None,  # noqa: N803

    zone: Optional[str] = None,

    # limit preview rows so UI is fast
    limit: int = Query(50, ge=1, le=500),

    # support "our" silently (some pages might pass our=TOR)
    our: Optional[str] = None,
):
    """
    Preview rows (JSON) for the Shot Explorer table.

    Example:
      /pbp/shots/preview?season=2025-26&team=TOR&opp=BKN&shot_type=Dunk&zone=arc3&limit=50
    """
    # If caller didn't set team but did set our, use that.
    if (not team) and our:
        team = our

    # Normalize shot type
    st = shot_type or shotType

    return get_shots_json(
        season=season,
        team=team,
        opp=opp,
        shot_type=st,
        zone=zone,
        limit=limit,
    )


@router.get("/shots.csv")
def pbp_shots_csv(
    season: str,
    team: str = "",
    opp: Optional[str] = None,

    shot_type: Optional[str] = None,
    shotType: Optional[str] = None,  # noqa: N803

    zone: Optional[str] = None,

    # allow larger downloads, but still keep safe bounds
    limit: int = Query(5000, ge=1, le=100000),

    our: Optional[str] = None,
):
    """
    CSV export for shots.

    Example:
      /pbp/shots.csv?season=2025-26&team=TOR&opp=BKN&limit=5000
    """
    if (not team) and our:
        team = our

    st = shot_type or shotType

    return get_shots_csv_response(
        season=season,
        team=team,
        opp=opp,
        shot_type=st,
        zone=zone,
        limit=limit,
    )
