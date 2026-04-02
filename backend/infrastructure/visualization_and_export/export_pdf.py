# backend/export_pdf.py
#
# 1-page PDF export for SportyPy visualization + caption.
#
# Provides:
#   GET /export/playtype-viz.pdf?season=...&our=...&opp=...&play_type=...&k=...&w_off=...
#
# This module is written to avoid circular imports:
# - app.py owns `rec`, VALID_SEASONS, VALID_TEAMS, TEAM_NAMES
# - app.py includes the router returned by create_pdf_router(...)
#
# Requires:
#   pip install reportlab pillow matplotlib sportypy
#
# Depends on:
#   backend/viz_sportypy.py  (render_playtype_zone_png)
#   backend/baseline_recommender.py (rank_playtypes_baseline)

from __future__ import annotations

import io
from typing import Dict, Iterable, Optional, Set

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from domain.baseline_recommendation.baseline_recommender import BaselineRecommender, rank_playtypes_baseline


def _require_in(value: str, allowed: Set[str], label: str) -> None:
    if value not in allowed:
        raise HTTPException(status_code=400, detail=f"Unknown {label} '{value}'.")


def _team_label(team: str, team_names: Optional[Dict[str, str]]) -> str:
    if not team_names:
        return team
    name = team_names.get(team)
    return f"{team} ({name})" if name else team


def create_pdf_router(
    rec: BaselineRecommender,
    valid_seasons: Iterable[str],
    valid_teams: Iterable[str],
    team_names: Optional[Dict[str, str]] = None,
) -> APIRouter:
    """
    Create a FastAPI router that can be included by app.py.

    In app.py you will do:
      from export_pdf import create_pdf_router
      app.include_router(create_pdf_router(rec, VALID_SEASONS, VALID_TEAMS, TEAM_NAMES))
    """
    valid_seasons_set = set(valid_seasons)
    valid_teams_set = set(valid_teams)

    router = APIRouter(tags=["export"])

    @router.get("/export/playtype-viz.pdf")
    def export_playtype_viz_pdf(
        season: str = Query(...),
        our: str = Query(..., description="Our team abbreviation."),
        opp: str = Query(..., description="Opponent team abbreviation."),
        play_type: str = Query(..., description="Play type (must exist in the Top-K result)."),
        k: int = Query(10, ge=1, le=10, description="Top-K used for the baseline ranking (1..10)."),
        w_off: float = Query(0.7, ge=0, le=1),
    ) -> StreamingResponse:
        """
        1-page PDF export containing:
        - Title + matchup
        - SportyPy court map (PNG)
        - Caption with baseline numbers
        """
        _require_in(season, valid_seasons_set, "season")
        _require_in(our, valid_teams_set, "our team")
        _require_in(opp, valid_teams_set, "opponent team")
        if our == opp:
            raise HTTPException(status_code=400, detail="Our team and opponent must be different.")

        w_def = float(1.0 - w_off)

        # Compute the same baseline table the UI uses, then pick the requested play type
        try:
            df = rank_playtypes_baseline(
                team_df=rec.team_df,
                league_df=rec.league_df,
                season=season,
                our_team=our,
                opp_team=opp,
                k=int(k),
                w_off=float(w_off),
                w_def=float(w_def),
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        row = df[df["PLAY_TYPE"] == play_type]
        if row.empty:
            raise HTTPException(
                status_code=404,
                detail="Play type not found in Top-K output. Export a play type that appears in the ranking table.",
            )

        r = row.iloc[0]
        caption = (
            f"{play_type}: Pred {float(r['PPP_PRED']):.3f} PPP. "
            f"Our(off) {float(r['PPP_OFF_SHRUNK']):.3f} vs Opp(def) {float(r['PPP_DEF_SHRUNK']):.3f}."
        )

        # Render SportyPy PNG
        try:
            from infrastructure.visualization_and_export.viz_sportypy import render_playtype_zone_png
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"viz_sportypy.py missing or failed to import. Error: {e}",
            )

        title = f"{our} vs {opp} • {season} • {play_type}"
        png_bytes = render_playtype_zone_png(play_type=play_type, title=title)

        # Build 1-page PDF (Letter)
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=letter)
        page_w, page_h = letter

        margin = 0.65 * inch
        y = page_h - margin

        # Header
        c.setFont("Helvetica-Bold", 16)
        c.drawString(margin, y, "Play Type Court Map (SportyPy)")
        y -= 0.28 * inch

        c.setFont("Helvetica", 11)
        matchup_line = f"{_team_label(our, team_names)} vs {_team_label(opp, team_names)} • {season}"
        c.drawString(margin, y, matchup_line)
        y -= 0.18 * inch

        c.setFont("Helvetica", 10)
        weights_line = f"Weights: w_off={float(w_off):.2f}, w_def={float(w_def):.2f}   |   Top-K: {int(k)}"
        c.drawString(margin, y, weights_line)
        y -= 0.22 * inch

        # Image placement
        img_reader = ImageReader(io.BytesIO(png_bytes))

        # Fit image into a nice box (keep aspect ratio)
        max_img_w = page_w - 2 * margin
        max_img_h = 6.1 * inch

        # conservative: draw at full width, clamp by height
        draw_w = max_img_w
        draw_h = max_img_h

        img_y = y - draw_h
        if img_y < margin + 1.2 * inch:
            # if too tall, shrink to fit remaining space
            available_h = y - (margin + 1.2 * inch)
            draw_h = max(3.5 * inch, available_h)
            img_y = y - draw_h

        c.drawImage(img_reader, margin, img_y, width=draw_w, height=draw_h, preserveAspectRatio=True, anchor="c")
        y = img_y - 0.18 * inch

        # Caption
        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin, y, "Caption")
        y -= 0.16 * inch

        c.setFont("Helvetica", 10)
        # simple wrap
        text = c.beginText(margin, y)
        text.setLeading(13)

        words = caption.split(" ")
        line = ""
        for w in words:
            candidate = (line + " " + w).strip()
            if c.stringWidth(candidate, "Helvetica", 10) <= (page_w - 2 * margin):
                line = candidate
            else:
                text.textLine(line)
                line = w
        if line:
            text.textLine(line)

        c.drawText(text)

        # Footer
        c.setFont("Helvetica-Oblique", 8)
        c.drawRightString(page_w - margin, margin * 0.75, "Generated by Basketball Strategy Analysis (Capstone)")
        c.showPage()
        c.save()

        buf.seek(0)

        filename = f"playtype_viz_{season}_{our}_vs_{opp}_{play_type}.pdf".replace(" ", "_")
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    return router
