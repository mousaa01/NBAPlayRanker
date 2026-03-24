# Application Layer - Analytics Services subsystem

from domain.statistical_analysis.ml_stat_analysis import compute_ml_analysis
from domain.shot_analysis.shot_ml_stat_analysis import compute_shot_ml_analysis
from infrastructure.model_management.ml_models import run_cv_evaluation

def get_ml_model_metrics():
    """Service for ML model metrics and evaluation"""
    return run_cv_evaluation()

def get_ml_analysis(season: str):
    """Service for ML statistical analysis"""
    return compute_ml_analysis(season)

def get_shot_ml_analysis(season: str):
    """Service for shot ML statistical analysis"""
    return compute_shot_ml_analysis(season)