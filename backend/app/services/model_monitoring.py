"""
Model Monitoring and Drift Detection System
Advanced model monitoring with drift detection, performance tracking, and alerting
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import redis
import pickle
import json
import hashlib
import threading
import time
from sklearn.metrics import accuracy_score, mean_squared_error, precision_score, recall_score, f1_score, roc_auc_score
from scipy import stats
import joblib
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class DriftType(Enum):
    """Drift types"""
    COVARIATE_SHIFT = "covariate_shift"
    PRIOR_PROBABILITY_SHIFT = "prior_probability_shift"
    CONCEPT_DRIFT = "concept_drift"
    DATA_DRIFT = "data_drift"
    LABEL_DRIFT = "label_drift"


class DriftDetectionMethod(Enum):
    """Drift detection methods"""
    KOLMOGOROV_SMIRNOV = "kolmogorov_smirnov"
    POPULATION_STABILITY_INDEX = "population_stability_index"
    KULLBACK_LEIBLER = "kullback_leibler"
    WASSERSTEIN_DISTANCE = "wasserstein_distance"
    CHI_SQUARE = "chi_square"
    ADWIN = "adwin"
    DDM = "ddm"
    EDDM = "eddm"


class AlertSeverity(Enum):
    """Alert severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ModelPerformanceMetrics:
    """Model performance metrics"""
    model_id: str
    timestamp: datetime
    accuracy: float
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    auc_score: Optional[float] = None
    mse: Optional[float] = None
    mae: Optional[float] = None
    r2_score: Optional[float] = None
    latency_ms: float = 0.0
    throughput_per_second: float = 0.0
    memory_usage_mb: float = 0.0
    sample_size: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DriftDetectionResult:
    """Drift detection result"""
    model_id: str
    drift_type: DriftType
    detection_method: DriftDetectionMethod
    drift_detected: bool
    drift_score: float
    p_value: float
    confidence: float
    reference_stats: Dict[str, Any]
    current_stats: Dict[str, Any]
    alert_severity: AlertSeverity
    detected_at: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MonitoringConfig:
    """Monitoring configuration"""
    model_id: str
    monitoring_window_minutes: int = 60
    reference_window_minutes: int = 1440  # 24 hours
    drift_detection_methods: List[DriftDetectionMethod] = field(default_factory=lambda: [DriftDetectionMethod.KOLMOGOROV_SMIRNOV])
    drift_threshold: float = 0.05
    performance_threshold: float = 0.1
    alert_cooldown_minutes: int = 30
    enable_real_time_monitoring: bool = True
    enable_drift_detection: bool = True
    enable_performance_monitoring: bool = True
    sample_size_threshold: int = 100


class PerformanceMonitor:
    """Model performance monitoring"""
    
    def __init__(self, config: MonitoringConfig):
        self.config = config
        self.performance_history = []
        self.alerts = []
        self.is_monitoring = False
        
    def start_monitoring(self) -> None:
        """Start performance monitoring"""
        self.is_monitoring = True
        logger.info(f"Started performance monitoring for model {self.config.model_id}")
    
    def stop_monitoring(self) -> None:
        """Stop performance monitoring"""
        self.is_monitoring = False
        logger.info(f"Stopped performance monitoring for model {self.config.model_id}")
    
    def record_prediction(self, y_true: Any, y_pred: Any, prediction_time_ms: float = 0.0,
                      metadata: Optional[Dict[str, Any]] = None) -> ModelPerformanceMetrics:
        """Record prediction and calculate metrics"""
        try:
            # Calculate performance metrics
            metrics = self._calculate_metrics(y_true, y_pred)
            metrics.latency_ms = prediction_time_ms
            metrics.metadata = metadata or {}
            metrics.timestamp = datetime.utcnow()
            
            # Add to history
            self.performance_history.append(metrics)
            
            # Keep only recent history
            cutoff_time = datetime.utcnow() - timedelta(minutes=self.config.monitoring_window_minutes)
            self.performance_history = [
                m for m in self.performance_history 
                if m.timestamp > cutoff_time
            ]
            
            # Check for performance degradation
            self._check_performance_degradation(metrics)
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error recording prediction: {e}")
            raise
    
    def _calculate_metrics(self, y_true: Any, y_pred: Any) -> ModelPerformanceMetrics:
        """Calculate performance metrics"""
        try:
            # Convert to arrays
            if not isinstance(y_true, np.ndarray):
                y_true = np.array(y_true)
            if not isinstance(y_pred, np.ndarray):
                y_pred = np.array(y_pred)
            
            # Determine if classification or regression
            is_classification = len(np.unique(y_true)) < 20 and len(y_true.shape) == 1
            
            metrics = ModelPerformanceMetrics(
                model_id=self.config.model_id,
                timestamp=datetime.utcnow(),
                sample_size=len(y_true)
            )
            
            if is_classification:
                # Classification metrics
                metrics.accuracy = accuracy_score(y_true, y_pred)
                metrics.precision = precision_score(y_true, y_pred, average='weighted', zero_division=0)
                metrics.recall = recall_score(y_true, y_pred, average='weighted', zero_division=0)
                metrics.f1_score = f1_score(y_true, y_pred, average='weighted', zero_division=0)
                
                # AUC score for binary classification
                if len(np.unique(y_true)) == 2:
                    try:
                        metrics.auc_score = roc_auc_score(y_true, y_pred)
                    except:
                        metrics.auc_score = 0.0
            else:
                # Regression metrics
                metrics.mse = mean_squared_error(y_true, y_pred)
                metrics.mae = np.mean(np.abs(y_true - y_pred))
                metrics.r2_score = 1 - np.sum((y_true - y_pred) ** 2) / np.sum((y_true - np.mean(y_true)) ** 2)
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating metrics: {e}")
            return ModelPerformanceMetrics(model_id=self.config.model_id, timestamp=datetime.utcnow())
    
    def _check_performance_degradation(self, current_metrics: ModelPerformanceMetrics) -> None:
        """Check for performance degradation"""
        if len(self.performance_history) < 10:
            return
        
        # Get baseline metrics (first 10% of history)
        baseline_size = max(10, len(self.performance_history) // 10)
        baseline_metrics = self.performance_history[:baseline_size]
        
        if not baseline_metrics:
            return
        
        # Calculate baseline averages
        if baseline_metrics[0].accuracy is not None:  # Classification
            baseline_accuracy = np.mean([m.accuracy for m in baseline_metrics])
            baseline_f1 = np.mean([m.f1_score for m in baseline_metrics if m.f1_score is not None])
            
            # Check degradation
            accuracy_drop = baseline_accuracy - current_metrics.accuracy
            f1_drop = baseline_f1 - current_metrics.f1_score if current_metrics.f1_score is not None else 0
            
            if accuracy_drop > self.config.performance_threshold or f1_drop > self.config.performance_threshold:
                self._create_performance_alert(current_metrics, accuracy_drop, f1_drop)
        else:  # Regression
            baseline_mse = np.mean([m.mse for m in baseline_metrics if m.mse is not None])
            baseline_r2 = np.mean([m.r2_score for m in baseline_metrics if m.r2_score is not None])
            
            # Check degradation
            mse_increase = current_metrics.mse - baseline_mse if current_metrics.mse is not None else 0
            r2_drop = baseline_r2 - current_metrics.r2_score if current_metrics.r2_score is not None else 0
            
            if mse_increase > self.config.performance_threshold or r2_drop > self.config.performance_threshold:
                self._create_performance_alert(current_metrics, mse_increase, r2_drop)
    
    def _create_performance_alert(self, metrics: ModelPerformanceMetrics, degradation_value: float, metric_type: str) -> None:
        """Create performance degradation alert"""
        alert = {
            'alert_id': f"perf_alert_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            'model_id': self.config.model_id,
            'alert_type': 'performance_degradation',
            'severity': AlertSeverity.HIGH if degradation_value > 0.2 else AlertSeverity.MEDIUM,
            'message': f"Performance degradation detected: {metric_type} degraded by {degradation_value:.3f}",
            'current_metrics': {
                'accuracy': metrics.accuracy,
                'precision': metrics.precision,
                'recall': metrics.recall,
                'f1_score': metrics.f1_score,
                'mse': metrics.mse,
                'mae': metrics.mae,
                'r2_score': metrics.r2_score,
                'latency_ms': metrics.latency_ms
            },
            'degradation_value': degradation_value,
            'metric_type': metric_type,
            'detected_at': datetime.utcnow().isoformat()
        }
        
        self.alerts.append(alert)
        logger.warning(f"Performance degradation alert for model {self.config.model_id}: {alert['message']}")
    
    def get_performance_summary(self, window_minutes: int = 60) -> Dict[str, Any]:
        """Get performance summary"""
        cutoff_time = datetime.utcnow() - timedelta(minutes=window_minutes)
        recent_metrics = [m for m in self.performance_history if m.timestamp > cutoff_time]
        
        if not recent_metrics:
            return {'error': 'No performance data available'}
        
        # Calculate summary statistics
        summary = {
            'model_id': self.config.model_id,
            'window_minutes': window_minutes,
            'total_predictions': len(recent_metrics),
            'time_range': {
                'start': min(m.timestamp for m in recent_metrics).isoformat(),
                'end': max(m.timestamp for m in recent_metrics).isoformat()
            }
        }
        
        # Classification metrics
        if recent_metrics[0].accuracy is not None:
            summary['classification_metrics'] = {
                'avg_accuracy': np.mean([m.accuracy for m in recent_metrics]),
                'std_accuracy': np.std([m.accuracy for m in recent_metrics]),
                'min_accuracy': min(m.accuracy for m in recent_metrics),
                'max_accuracy': max(m.accuracy for m in recent_metrics),
                'avg_precision': np.mean([m.precision for m in recent_metrics if m.precision is not None]),
                'avg_recall': np.mean([m.recall for m in recent_metrics if m.recall is not None]),
                'avg_f1_score': np.mean([m.f1_score for m in recent_metrics if m.f1_score is not None])
            }
        
        # Regression metrics
        if recent_metrics[0].mse is not None:
            summary['regression_metrics'] = {
                'avg_mse': np.mean([m.mse for m in recent_metrics if m.mse is not None]),
                'avg_mae': np.mean([m.mae for m in recent_metrics if m.mae is not None]),
                'avg_r2_score': np.mean([m.r2_score for m in recent_metrics if m.r2_score is not None])
            }
        
        # Latency metrics
        summary['latency_metrics'] = {
            'avg_latency_ms': np.mean([m.latency_ms for m in recent_metrics]),
            'p95_latency_ms': np.percentile([m.latency_ms for m in recent_metrics], 95),
            'p99_latency_ms': np.percentile([m.latency_ms for m in recent_metrics], 99)
        }
        
        return summary


class DriftDetector:
    """Drift detection engine"""
    
    def __init__(self, config: MonitoringConfig):
        self.config = config
        self.reference_data = None
        self.current_data = []
        self.drift_history = []
        
    def set_reference_data(self, reference_data: pd.DataFrame) -> None:
        """Set reference data for drift detection"""
        self.reference_data = reference_data
        logger.info(f"Set reference data for drift detection: {reference_data.shape}")
    
    def add_current_data(self, data: pd.DataFrame) -> None:
        """Add current data for drift detection"""
        self.current_data.append({
            'data': data,
            'timestamp': datetime.utcnow()
        })
        
        # Keep only recent data
        cutoff_time = datetime.utcnow() - timedelta(minutes=self.config.monitoring_window_minutes)
        self.current_data = [
            d for d in self.current_data 
            if d['timestamp'] > cutoff_time
        ]
    
    def detect_drift(self) -> List[DriftDetectionResult]:
        """Detect drift in current data compared to reference"""
        if self.reference_data is None:
            return []
        
        if not self.current_data:
            return []
        
        drift_results = []
        
        # Combine current data
        current_df = pd.concat([d['data'] for d in self.current_data], ignore_index=True)
        
        if current_df.empty:
            return []
        
        # Apply drift detection methods
        for method in self.config.drift_detection_methods:
            try:
                if method == DriftDetectionMethod.KOLMOGOROV_SMIRNOV:
                    result = self._kolmogorov_smirnov_test(current_df)
                elif method == DriftDetectionMethod.POPULATION_STABILITY_INDEX:
                    result = self._population_stability_index(current_df)
                elif method == DriftDetectionMethod.KULLBACK_LEIBLER:
                    result = self._kullback_leibler_divergence(current_df)
                elif method == DriftDetectionMethod.WASSERSTEIN_DISTANCE:
                    result = self._wasserstein_distance(current_df)
                elif method == DriftDetectionMethod.CHI_SQUARE:
                    result = self._chi_square_test(current_df)
                else:
                    continue
                
                drift_results.append(result)
                
            except Exception as e:
                logger.error(f"Error in drift detection method {method.value}: {e}")
                continue
        
        return drift_results
    
    def _kolmogorov_smirnov_test(self, current_df: pd.DataFrame) -> DriftDetectionResult:
        """Kolmogorov-Smirnov test for drift detection"""
        try:
            # Select numerical columns
            numeric_cols = current_df.select_dtypes(include=[np.number]).columns
            ref_numeric_cols = self.reference_data.select_dtypes(include=[np.number]).columns
            
            # Use common columns
            common_cols = list(set(numeric_cols) & set(ref_numeric_cols))
            
            if not common_cols:
                return self._create_no_drift_result(DriftDetectionMethod.KOLMOGOROV_SMIRNOV)
            
            max_ks_statistic = 0
            max_p_value = 1.0
            drift_detected = False
            
            for col in common_cols:
                ref_data = self.reference_data[col].dropna()
                curr_data = current_df[col].dropna()
                
                if len(ref_data) > 0 and len(curr_data) > 0:
                    ks_statistic, p_value = stats.ks_2samp(ref_data, curr_data)
                    
                    if ks_statistic > max_ks_statistic:
                        max_ks_statistic = ks_statistic
                        max_p_value = p_value
            
            # Determine drift
            drift_detected = max_p_value < self.config.drift_threshold
            
            return DriftDetectionResult(
                model_id=self.config.model_id,
                drift_type=DriftType.COVARIATE_SHIFT,
                detection_method=DriftDetectionMethod.KOLMOGOROV_SMIRNOV,
                drift_detected=drift_detected,
                drift_score=max_ks_statistic,
                p_value=max_p_value,
                confidence=1 - max_p_value,
                reference_stats={'method': 'KS test'},
                current_stats={'method': 'KS test'},
                alert_severity=self._determine_severity(max_p_value),
                detected_at=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Error in KS test: {e}")
            return self._create_no_drift_result(DriftDetectionMethod.KOLMOGOROV_SMIRNOV)
    
    def _population_stability_index(self, current_df: pd.DataFrame) -> DriftDetectionResult:
        """Population Stability Index for drift detection"""
        try:
            # Select categorical columns
            categorical_cols = current_df.select_dtypes(include=['object', 'category']).columns
            ref_categorical_cols = self.reference_data.select_dtypes(include=['object', 'category']).columns
            
            # Use common columns
            common_cols = list(set(categorical_cols) & set(ref_categorical_cols))
            
            if not common_cols:
                return self._create_no_drift_result(DriftDetectionMethod.POPULATION_STABILITY_INDEX)
            
            min_psi = 1.0
            max_psi = 0.0
            
            for col in common_cols:
                ref_dist = self.reference_data[col].value_counts(normalize=True)
                curr_dist = current_df[col].value_counts(normalize=True)
                
                # Calculate PSI
                psi = 0.0
                for category in set(ref_dist.index) | set(curr_dist.index):
                    ref_prob = ref_dist.get(category, 0)
                    curr_prob = curr_dist.get(category, 0)
                    
                    if ref_prob > 0:
                        if curr_prob == 0:
                            psi += ref_prob * np.log(ref_prob / 1e-10)  # Small epsilon
                        else:
                            psi += (curr_prob - ref_prob) * np.log(curr_prob / ref_prob)
                
                min_psi = min(min_psi, psi)
                max_psi = max(max_psi, psi)
            
            # Determine drift
            drift_detected = max_psi > 0.25  # Common PSI threshold
            
            return DriftDetectionResult(
                model_id=self.config.model_id,
                drift_type=DriftType.COVARIATE_SHIFT,
                detection_method=DriftDetectionMethod.POPULATION_STABILITY_INDEX,
                drift_detected=drift_detected,
                drift_score=max_psi,
                p_value=1.0,  # PSI doesn't have p-value
                confidence=min(max_psi / 0.5, 1.0),
                reference_stats={'psi_method': 'Population Stability Index'},
                current_stats={'psi_method': 'Population Stability Index'},
                alert_severity=self._determine_severity_psi(max_psi),
                detected_at=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Error in PSI calculation: {e}")
            return self._create_no_drift_result(DriftDetectionMethod.POPULATION_STABILITY_INDEX)
    
    def _kullback_leibler_divergence(self, current_df: pd.DataFrame) -> DriftDetectionResult:
        """Kullback-Leibler divergence for drift detection"""
        try:
            # Select numerical columns
            numeric_cols = current_df.select_dtypes(include=[np.number]).columns
            ref_numeric_cols = self.reference_data.select_dtypes(include=[np.number]).columns
            
            # Use common columns
            common_cols = list(set(numeric_cols) & set(ref_numeric_cols))
            
            if not common_cols:
                return self._create_no_drift_result(DriftDetectionMethod.KULLBACK_LEIBLER)
            
            max_kl_divergence = 0
            
            for col in common_cols:
                ref_data = self.reference_data[col].dropna()
                curr_data = current_df[col].dropna()
                
                if len(ref_data) > 0 and len(curr_data) > 0:
                    # Create histograms
                    ref_hist, bin_edges = np.histogram(ref_data, bins=50, density=True)
                    curr_hist, _ = np.histogram(curr_data, bins=bin_edges, density=True)
                    
                    # Calculate KL divergence
                    kl_divergence = np.sum(ref_hist * np.log(ref_hist / (curr_hist + 1e-10)))
                    max_kl_divergence = max(max_kl_divergence, kl_divergence)
            
            # Determine drift
            drift_detected = max_kl_divergence > 0.2  # Common KL threshold
            
            return DriftDetectionResult(
                model_id=self.config.model_id,
                drift_type=DriftType.COVARIATE_SHIFT,
                detection_method=DriftDetectionMethod.KULLBACK_LEIBLER,
                drift_detected=drift_detected,
                drift_score=max_kl_divergence,
                p_value=0.0,  # KL doesn't have p-value
                confidence=min(max_kl_divergence / 0.5, 1.0),
                reference_stats={'method': 'KL Divergence'},
                current_stats={'method': 'KL Divergence'},
                alert_severity=self._determine_severity_kl(max_kl_divergence),
                detected_at=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Error in KL divergence: {e}")
            return self._create_no_drift_result(DriftDetectionMethod.KULLBACK_LEIBLER)
    
    def _wasserstein_distance(self, current_df: pd.DataFrame) -> DriftDetectionResult:
        """Wasserstein distance for drift detection"""
        try:
            # Select numerical columns
            numeric_cols = current_df.select_dtypes(include=[np.number]).columns
            ref_numeric_cols = self.reference_data.select_dtypes(include=[np.number]).columns
            
            # Use common columns
            common_cols = list(set(numeric_cols) & set(ref_numeric_cols))
            
            if not common_cols:
                return self._create_no_drift_result(DriftDetectionMethod.WASSERSTEIN_DISTANCE)
            
            max_wasserstein = 0
            
            for col in common_cols:
                ref_data = self.reference_data[col].dropna()
                curr_data = current_df[col].dropna()
                
                if len(ref_data) > 0 and len(curr_data) > 0:
                    from scipy.stats import wasserstein_distance
                    wasserstein_dist = wasserstein_distance(ref_data, curr_data)
                    max_wasserstein = max(max_wasserstein, wasserstein_dist)
            
            # Determine drift
            drift_detected = max_wasserstein > 0.1  # Common Wasserstein threshold
            
            return DriftDetectionResult(
                model_id=self.config.model_id,
                drift_type=DriftType.COVARIATE_SHIFT,
                detection_method=DriftDetectionMethod.WASSERSTEIN_DISTANCE,
                drift_detected=drift_detected,
                drift_score=max_wasserstein,
                p_value=0.0,  # Wasserstein doesn't have p-value
                confidence=min(max_wasserstein / 0.2, 1.0),
                reference_stats={'method': 'Wasserstein Distance'},
                current_stats={'method': 'Wasserstein Distance'},
                alert_severity=self._determine_severity_wasserstein(max_wasserstein),
                detected_at=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Error in Wasserstein distance: {e}")
            return self._create_no_drift_result(DriftDetectionMethod.WASSERSTEIN_DISTANCE)
    
    def _chi_square_test(self, current_df: pd.DataFrame) -> DriftDetectionResult:
        """Chi-square test for drift detection"""
        try:
            # Select categorical columns
            categorical_cols = current_df.select_dtypes(include=['object', 'category']).columns
            ref_categorical_cols = self.reference_data.select_dtypes(include=['object', 'category']).columns
            
            # Use common columns
            common_cols = list(set(categorical_cols) & set(ref_categorical_cols))
            
            if not common_cols:
                return self._create_no_drift_result(DriftDetectionMethod.CHI_SQUARE)
            
            max_chi_statistic = 0
            min_p_value = 1.0
            
            for col in common_cols:
                # Create contingency tables
                ref_counts = self.reference_data[col].value_counts()
                curr_counts = current_df[col].value_counts()
                
                # Combine categories
                all_categories = set(ref_counts.index) | set(curr_counts.index)
                
                # Create contingency table
                ref_table = [ref_counts.get(cat, 0) for cat in all_categories]
                curr_table = [curr_counts.get(cat, 0) for cat in all_categories]
                
                # Perform chi-square test
                chi2, p_value, _, _ = stats.chi2_contingency([ref_table, curr_table])
                
                if chi2 > max_chi_statistic:
                    max_chi_statistic = chi2
                    min_p_value = p_value
            
            # Determine drift
            drift_detected = min_p_value < self.config.drift_threshold
            
            return DriftDetectionResult(
                model_id=self.config.model_id,
                drift_type=DriftType.COVARIATE_SHIFT,
                detection_method=DriftDetectionMethod.CHI_SQUARE,
                drift_detected=drift_detected,
                drift_score=max_chi_statistic,
                p_value=min_p_value,
                confidence=1 - min_p_value,
                reference_stats={'method': 'Chi-square test'},
                current_stats={'method': 'Chi-square test'},
                alert_severity=self._determine_severity(min_p_value),
                detected_at=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Error in chi-square test: {e}")
            return self._create_no_drift_result(DriftDetectionMethod.CHI_SQUARE)
    
    def _create_no_drift_result(self, method: DriftDetectionMethod) -> DriftDetectionResult:
        """Create no drift result"""
        return DriftDetectionResult(
            model_id=self.config.model_id,
            drift_type=DriftType.DATA_DRIFT,
            detection_method=method,
            drift_detected=False,
            drift_score=0.0,
            p_value=1.0,
            confidence=0.0,
            reference_stats={'method': method.value},
            current_stats={'method': method.value},
            alert_severity=AlertSeverity.LOW,
            detected_at=datetime.utcnow()
        )
    
    def _determine_severity(self, p_value: float) -> AlertSeverity:
        """Determine alert severity from p-value"""
        if p_value < 0.01:
            return AlertSeverity.CRITICAL
        elif p_value < 0.05:
            return AlertSeverity.HIGH
        elif p_value < 0.1:
            return AlertSeverity.MEDIUM
        else:
            return AlertSeverity.LOW
    
    def _determine_severity_psi(self, psi_value: float) -> AlertSeverity:
        """Determine alert severity from PSI value"""
        if psi_value > 0.5:
            return AlertSeverity.CRITICAL
        elif psi_value > 0.25:
            return AlertSeverity.HIGH
        elif psi_value > 0.1:
            return AlertSeverity.MEDIUM
        else:
            return AlertSeverity.LOW
    
    def _determine_severity_kl(self, kl_value: float) -> AlertSeverity:
        """Determine alert severity from KL divergence"""
        if kl_value > 1.0:
            return AlertSeverity.CRITICAL
        elif kl_value > 0.5:
            return AlertSeverity.HIGH
        elif kl_value > 0.2:
            return AlertSeverity.MEDIUM
        else:
            return AlertSeverity.LOW
    
    def _determine_severity_wasserstein(self, wasserstein_value: float) -> AlertSeverity:
        """Determine alert severity from Wasserstein distance"""
        if wasserstein_value > 0.5:
            return AlertSeverity.CRITICAL
        elif wasserstein_value > 0.2:
            return AlertSeverity.HIGH
        elif wasserstein_value > 0.1:
            return AlertSeverity.MEDIUM
        else:
            return AlertSeverity.LOW


class ModelMonitoringService:
    """Main model monitoring service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.models = {}
        self.monitors = {}
        self.detectors = {}
        
    def setup_model_monitoring(self, config: MonitoringConfig, 
                             reference_data: Optional[pd.DataFrame] = None) -> str:
        """Setup monitoring for a model"""
        try:
            # Create performance monitor
            performance_monitor = PerformanceMonitor(config)
            
            # Create drift detector
            drift_detector = DriftDetector(config)
            if reference_data is not None:
                drift_detector.set_reference_data(reference_data)
            
            # Store components
            monitor_id = f"monitor_{config.model_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            
            self.models[monitor_id] = {
                'config': config,
                'performance_monitor': performance_monitor,
                'drift_detector': drift_detector,
                'created_at': datetime.utcnow()
            }
            
            self.monitors[monitor_id] = performance_monitor
            self.detectors[monitor_id] = drift_detector
            
            # Save to Redis
            self._save_monitoring_setup(monitor_id)
            
            logger.info(f"Setup monitoring for model {config.model_id}")
            return monitor_id
            
        except Exception as e:
            logger.error(f"Error setting up model monitoring: {e}")
            raise
    
    def record_prediction(self, monitor_id: str, y_true: Any, y_pred: Any,
                        prediction_time_ms: float = 0.0,
                        current_data: Optional[pd.DataFrame] = None,
                        metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Record prediction and monitor"""
        if monitor_id not in self.models:
            raise ValueError(f"Monitor {monitor_id} not found")
        
        try:
            # Record performance
            performance_metrics = self.monitors[monitor_id].record_prediction(
                y_true, y_pred, prediction_time_ms, metadata
            )
            
            # Add data for drift detection
            if current_data is not None:
                self.detectors[monitor_id].add_current_data(current_data)
            
            # Check for drift
            if self.models[monitor_id]['config'].enable_drift_detection:
                drift_results = self.detectors[monitor_id].detect_drift()
                
                # Handle drift alerts
                for result in drift_results:
                    if result.drift_detected:
                        self._handle_drift_alert(monitor_id, result)
            
            # Save results
            self._save_monitoring_results(monitor_id, performance_metrics, drift_results)
            
            return {
                'monitor_id': monitor_id,
                'performance_metrics': performance_metrics,
                'drift_results': drift_results,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error recording prediction: {e}")
            raise
    
    def get_monitoring_dashboard(self, monitor_id: str) -> Dict[str, Any]:
        """Get monitoring dashboard data"""
        if monitor_id not in self.models:
            return {'error': f'Monitor {monitor_id} not found'}
        
        try:
            performance_monitor = self.monitors[monitor_id]
            drift_detector = self.detectors[monitor_id]
            
            # Get performance summary
            performance_summary = performance_monitor.get_performance_summary()
            
            # Get recent drift results
            recent_drifts = drift_detector.drift_history[-10:] if drift_detector.drift_history else []
            
            # Create dashboard
            dashboard = {
                'monitor_id': monitor_id,
                'model_id': self.models[monitor_id]['config'].model_id,
                'monitoring_config': {
                    'monitoring_window_minutes': self.models[monitor_id]['config'].monitoring_window_minutes,
                    'drift_detection_methods': [m.value for m in self.models[monitor_id]['config'].drift_detection_methods],
                    'drift_threshold': self.models[monitor_id]['config'].drift_threshold,
                    'enable_real_time_monitoring': self.models[monitor_id]['config'].enable_real_time_monitoring,
                    'enable_drift_detection': self.models[monitor_id]['config'].enable_drift_detection
                },
                'performance_summary': performance_summary,
                'recent_drift_detections': [
                    {
                        'drift_type': result.drift_type.value,
                        'detection_method': result.detection_method.value,
                        'drift_score': result.drift_score,
                        'alert_severity': result.alert_severity.value,
                        'detected_at': result.detected_at.isoformat()
                    }
                    for result in recent_drifts
                ],
                'overall_status': self._calculate_overall_status(performance_summary, recent_drifts),
                'last_updated': datetime.utcnow().isoformat()
            }
            
            return dashboard
            
        except Exception as e:
            logger.error(f"Error creating monitoring dashboard: {e}")
            return {'error': str(e)}
    
    def _calculate_overall_status(self, performance_summary: Dict[str, Any], 
                                recent_drifts: List[DriftDetectionResult]) -> str:
        """Calculate overall model status"""
        if not recent_drifts:
            if 'error' in performance_summary:
                return 'error'
            elif performance_summary.get('classification_metrics', {}).get('avg_accuracy', 1.0) > 0.8:
                return 'healthy'
            elif performance_summary.get('classification_metrics', {}).get('avg_accuracy', 1.0) > 0.6:
                return 'warning'
            else:
                return 'critical'
        else:
            # Check for recent critical drift
            has_critical_drift = any(
                result.drift_detected and result.alert_severity == AlertSeverity.CRITICAL
                for result in recent_drifts[-5:]  # Last 5 drifts
            )
            
            if has_critical_drift:
                return 'critical'
            elif any(result.drift_detected for result in recent_drifts[-3:]):
                return 'warning'
            else:
                return 'healthy'
    
    def _handle_drift_alert(self, monitor_id: str, drift_result: DriftDetectionResult) -> None:
        """Handle drift alert"""
        alert = {
            'alert_id': f"drift_alert_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            'monitor_id': monitor_id,
            'model_id': self.models[monitor_id]['config'].model_id,
            'alert_type': 'drift_detected',
            'severity': drift_result.alert_severity.value,
            'message': f"Drift detected: {drift_result.drift_type.value} using {drift_result.detection_method.value}",
            'drift_result': {
                'drift_type': drift_result.drift_type.value,
                'detection_method': drift_result.detection_method.value,
                'drift_score': drift_result.drift_score,
                'p_value': drift_result.p_value,
                'confidence': drift_result.confidence,
                'alert_severity': drift_result.alert_severity.value
            },
            'detected_at': drift_result.detected_at.isoformat()
        }
        
        # Store alert
        if self.redis:
            self.redis.setex(f"alert:{alert['alert_id']}", 
                           86400 * 7, json.dumps(alert))  # 7 days TTL
        
        logger.warning(f"Drift alert for model {self.models[monitor_id]['config'].model_id}: {alert['message']}")
    
    def _save_monitoring_setup(self, monitor_id: str) -> None:
        """Save monitoring setup to Redis"""
        try:
            if self.redis:
                setup_data = {
                    'monitor_id': monitor_id,
                    'config': self.models[monitor_id]['config'].__dict__,
                    'created_at': self.models[monitor_id]['created_at'].isoformat()
                }
                self.redis.setex(f"monitoring_setup:{monitor_id}", 
                               86400 * 30, json.dumps(setup_data))  # 30 days TTL
        except Exception as e:
            logger.error(f"Failed to save monitoring setup: {e}")
    
    def _save_monitoring_results(self, monitor_id: str, performance_metrics: ModelPerformanceMetrics,
                              drift_results: List[DriftDetectionResult]) -> None:
        """Save monitoring results to Redis"""
        try:
            if self.redis:
                results_data = {
                    'monitor_id': monitor_id,
                    'performance_metrics': {
                        'model_id': performance_metrics.model_id,
                        'timestamp': performance_metrics.timestamp.isoformat(),
                        'accuracy': performance_metrics.accuracy,
                        'precision': performance_metrics.precision,
                        'recall': performance_metrics.recall,
                        'f1_score': performance_metrics.f1_score,
                        'mse': performance_metrics.mse,
                        'mae': performance_metrics.mae,
                        'r2_score': performance_metrics.r2_score,
                        'latency_ms': performance_metrics.latency_ms,
                        'sample_size': performance_metrics.sample_size
                    },
                    'drift_results': [
                        {
                            'drift_type': result.drift_type.value,
                            'detection_method': result.detection_method.value,
                            'drift_detected': result.drift_detected,
                            'drift_score': result.drift_score,
                            'p_value': result.p_value,
                            'confidence': result.confidence,
                            'alert_severity': result.alert_severity.value,
                            'detected_at': result.detected_at.isoformat()
                        }
                        for result in drift_results
                    ],
                    'saved_at': datetime.utcnow().isoformat()
                }
                self.redis.setex(f"monitoring_results:{monitor_id}", 
                               86400 * 7, json.dumps(results_data))  # 7 days TTL
        except Exception as e:
            logger.error(f"Failed to save monitoring results: {e}")


# Global model monitoring service instance
model_monitoring_service = ModelMonitoringService()

# Export functions
def setup_model_monitoring(config: MonitoringConfig, reference_data: Optional[pd.DataFrame] = None) -> str:
    """Setup model monitoring"""
    return model_monitoring_service.setup_model_monitoring(config, reference_data)

def record_model_prediction(monitor_id: str, y_true: Any, y_pred: Any,
                           prediction_time_ms: float = 0.0,
                           current_data: Optional[pd.DataFrame] = None,
                           metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Record model prediction"""
    return model_monitoring_service.record_prediction(monitor_id, y_true, y_pred, prediction_time_ms, current_data, metadata)

def get_monitoring_dashboard(monitor_id: str) -> Dict[str, Any]:
    """Get monitoring dashboard"""
    return model_monitoring_service.get_monitoring_dashboard(monitor_id)

# Export all components
__all__ = [
    'DriftType',
    'DriftDetectionMethod',
    'AlertSeverity',
    'ModelPerformanceMetrics',
    'DriftDetectionResult',
    'MonitoringConfig',
    'PerformanceMonitor',
    'DriftDetector',
    'ModelMonitoringService',
    'setup_model_monitoring',
    'record_model_prediction',
    'get_monitoring_dashboard',
    'model_monitoring_service',
]
