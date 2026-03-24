from __future__ import annotations

import io
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Table, TableStyle
from reportlab.pdfgen import canvas

from shot_baseline_recommender import ShotBaselineRecommender
from shot_etl import CLEAN_PARQUET


_SHOT_REC: Optional[ShotBaselineRecommender] = None
_SHOTS_DF: Optional[pd.DataFrame] = None


def _get_shot_rec() -> ShotBaselineRecommender:
    global _SHOT_REC
    if _SHOT_REC is None:
        _SHOT_REC = ShotBaselineRecommender()
    return _SHOT_REC


def _get_shots_df() -> pd.DataFrame:
    global _SHOTS_DF
    if _SHOTS_DF is None:
        if not CLEAN_PARQUET.exists():
            raise FileNotFoundError(
                f"shots_clean.parquet not found: {CLEAN_PARQUET}. Run backend/data/etl/build_shots_dataset.py"
            )
        _SHOTS_DF = pd.read_parquet(CLEAN_PARQUET)
    return _SHOTS_DF


def _fmt_num(x: object, digits: int = 3) -> str:
    try:
        return f"{float(x):.{digits}f}"
    except Exception:
        return "—"


def _table_from_rows(title: str, rows: List[List[str]]) -> Table:
    data = [[title, "", ""]] + rows
    table = Table(data, colWidths=[2.8 * inch, 1.1 * inch, 1.0 * inch])
    style = TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ("ALIGN", (0, 0), (-1, 0), "LEFT"),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]
    )
    table.setStyle(style)
    return table


def build_shotplan_pdf(
    *,
    season: str,
    our: str,
    opp: str,
    k: int,
    w_off: float,
    shot_type: Optional[str] = None,
    zone: Optional[str] = None,
) -> Tuple[io.BytesIO, str]:
    # Rankings
    rec = _get_shot_rec()
    w_def = float(1.0 - w_off)
    result = rec.rank(season=season, our_team=our, opp_team=opp, k=int(k), w_off=float(w_off))

    top_shot_types = result.get("top_shot_types", [])
    top_zones = result.get("top_zones", [])

    # Heatmap image (lazy import)
    try:
        from viz_shot_heatmap import render_shot_heatmap_png
    except Exception as e:
        raise RuntimeError(f"viz_shot_heatmap import failed: {e}")

    shots_df = _get_shots_df()
    title = f"{our} vs {opp} • {season}"
    png_bytes = render_shot_heatmap_png(
        shots_df=shots_df,
        season=season,
        our_team=our,
        opp_team=opp,
        shot_type=shot_type,
        zone=zone,
        title=title,
    )

    # Build PDF
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    page_w, page_h = letter
    margin = 0.6 * inch
    y = page_h - margin

    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin, y, "Shot Plan (Dataset 2)")
    y -= 0.28 * inch

    c.setFont("Helvetica", 11)
    c.drawString(margin, y, f"{our} vs {opp} • {season}")
    y -= 0.18 * inch

    c.setFont("Helvetica", 10)
    c.drawString(margin, y, f"Weights: w_off={w_off:.2f}, w_def={w_def:.2f}   |   Top-K: {int(k)}")
    y -= 0.22 * inch

    # Tables (shot types + zones)
    def _rows_from(items: List[Dict[str, object]], label_key: str) -> List[List[str]]:
        rows = []
        for r in items[: int(k)]:
            label = str(r.get(label_key, "—"))
            epa = _fmt_num(r.get("EPA_PRED"))
            attempts = _fmt_num(r.get("attempts_OFF"), digits=0)
            rows.append([label, epa, attempts])
        if not rows:
            rows = [["No data", "—", "—"]]
        return rows

    shot_type_table = _table_from_rows("Top Shot Types (EPA)", _rows_from(top_shot_types, "SHOT_TYPE"))
    zone_table = _table_from_rows("Top Zones (EPA)", _rows_from(top_zones, "ZONE"))

    table_y = y
    shot_type_table.wrapOn(c, page_w - 2 * margin, 2 * inch)
    shot_type_table.drawOn(c, margin, table_y - 1.9 * inch)

    zone_table.wrapOn(c, page_w - 2 * margin, 2 * inch)
    zone_table.drawOn(c, margin + 3.2 * inch, table_y - 1.9 * inch)

    y = table_y - 2.2 * inch

    # Heatmap image
    img_reader = ImageReader(io.BytesIO(png_bytes))
    max_img_w = page_w - 2 * margin
    max_img_h = 4.7 * inch
    img_y = y - max_img_h
    c.drawImage(img_reader, margin, img_y, width=max_img_w, height=max_img_h, preserveAspectRatio=True, anchor="c")
    y = img_y - 0.18 * inch

    # Shrinkage note
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "Shrinkage Note")
    y -= 0.14 * inch

    c.setFont("Helvetica", 9)
    note = (
        "EPA is shrunk toward league baselines using reliability weights "
        "(log1p(attempts)) to reduce small-sample noise. "
        "Matchup EPA blends our offense with opponent defense."
    )
    text = c.beginText(margin, y)
    text.setLeading(12)
    words = note.split(" ")
    line = ""
    for w in words:
        candidate = (line + " " + w).strip()
        if c.stringWidth(candidate, "Helvetica", 9) <= (page_w - 2 * margin):
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
    filename = f"shotplan_{season}_{our}_vs_{opp}.pdf".replace(" ", "_")
    return buf, filename
