import base64
from io import BytesIO
from typing import Dict

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Circle, Wedge

from sportypy.surfaces.basketball import NBACourt
from sportypy._base_classes._base_feature import BaseFeature


# --- 1) SPEED PATCH: SportyPy circle resolution (massive performance fix) ---
def _patch_sportypy_circle(npoints: int = 400) -> None:
    def fast_create_circle(center=(0.0, 0.0), npoints=npoints, r=1.0, start=0.0, end=2.0):
        theta = np.linspace(start * np.pi, end * np.pi, npoints)
        x = center[0] + (r * np.cos(theta))
        y = center[1] + (r * np.sin(theta))
        return pd.DataFrame({"x": x, "y": y})

    BaseFeature.create_circle = staticmethod(fast_create_circle)


# --- 2) Map play types -> zones to highlight (simple & defendable baseline) ---
PLAYTYPE_ZONES: Dict[str, Dict[str, float]] = {
    "Spotup": {"corner3": 1.0, "arc3": 0.8},
    "Cut": {"rim": 1.0},
    "Transition": {"rim": 0.9, "corner3": 0.6},
    "Isolation": {"mid": 0.8, "rim": 0.4},
    "OffScreen": {"arc3": 0.9, "mid": 0.4},
    "HandOff": {"arc3": 0.7, "mid": 0.4},
    "PostUp": {"paint": 1.0},
    "P&R Ball Handler": {"rim": 0.7, "mid": 0.5, "arc3": 0.4},
    "P&R Roll Man": {"rim": 1.0, "paint": 0.6},
}


def zones_for_playtype(play_type: str) -> Dict[str, float]:
    for key, zones in PLAYTYPE_ZONES.items():
        if key.lower() in play_type.lower():
            return zones
    return {"rim": 0.6, "arc3": 0.4}  # fallback


def png_bytes_to_base64(png: bytes) -> str:
    return base64.b64encode(png).decode("utf-8")


# --- 3) Render chart ---
def render_playtype_zone_png(play_type: str, title: str) -> bytes:
    _patch_sportypy_circle(400)
    zones = zones_for_playtype(play_type)

    court = NBACourt()
    fig, ax = plt.subplots(figsize=(7, 6))
    court.draw(ax=ax, display_range="offense")

    # SportyPy stores dimensions in court.court_params (dict)
    cp = getattr(court, "court_params", {}) or {}

    def _scalar(v, default: float) -> float:
        # SportyPy stores some params as lists; normalize to a single float
        if v is None:
            return float(default)
        if isinstance(v, (list, tuple)):
            return float(v[0]) if len(v) else float(default)
        return float(v)

    court_length = _scalar(cp.get("court_length"), 94.0)
    basket_center_to_baseline = _scalar(cp.get("basket_center_to_baseline"), 5.25)
    lane_length = _scalar(cp.get("lane_length"), 19.0)
    lane_width = _scalar(cp.get("lane_width"), 16.0)

    # In SportyPy, x=0 is midcourt; offense baseline is at +court_length/2
    baseline_x = court_length / 2.0  # ~47
    hoop_x = baseline_x - basket_center_to_baseline  # ~41.75

    def add_zone(patch, w):
        patch.set_alpha(0.15 + 0.35 * float(w))
        patch.set_facecolor((1, 0, 0))
        patch.set_edgecolor("none")
        try:
            patch.set_linewidth(0)
        except Exception:
            pass
        ax.add_patch(patch)

    if "rim" in zones:
        add_zone(Circle((hoop_x, 0), radius=4.0), zones["rim"])

    if "paint" in zones:
        add_zone(
            Rectangle((baseline_x - lane_length, -lane_width / 2.0), lane_length, lane_width),
            zones["paint"],
        )

    if "mid" in zones:
        add_zone(Rectangle((baseline_x - lane_length, -19), lane_length, 38), zones["mid"])

    if "corner3" in zones:
        add_zone(Rectangle((baseline_x - 14, 22), 14, 6), zones["corner3"])
        add_zone(Rectangle((baseline_x - 14, -28), 14, 6), zones["corner3"])

    if "arc3" in zones:
        add_zone(Wedge((hoop_x, 0), r=24, theta1=-68, theta2=68, width=6), zones["arc3"])

    ax.set_title(title, fontsize=14, weight="bold")
    ax.axis("off")

    buf = BytesIO()
    # bbox_inches="tight" can crash with some SportyPy artists
    fig.savefig(buf, format="png", dpi=150)
    plt.close(fig)
    return buf.getvalue()
