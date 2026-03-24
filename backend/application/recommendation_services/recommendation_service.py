# Application Layer - Recommendation Services subsystem

from domain.baseline_recommendation.baseline_recommender import rank_playtypes_baseline
from domain.context_ml_recommendation.ml_context_recommender import rank_ml_with_context

def get_baseline_recommendations(season: str, our_team: str, opp_team: str, k: int = 5):
    """Service for baseline recommendations"""
    return rank_playtypes_baseline(season, our_team, opp_team, k)

def get_context_ml_recommendations(season: str, our_team: str, opp_team: str, margin: float, period: int, time_remaining: float, k: int = 5):
    """Service for context-aware ML recommendations"""
    return rank_ml_with_context(season, our_team, opp_team, margin, period, time_remaining, k)