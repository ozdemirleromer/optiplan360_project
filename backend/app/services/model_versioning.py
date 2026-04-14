"""
Model Versioning and A/B Testing System
Advanced model versioning, A/B testing, and experiment management
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
import uuid
import secrets
from sklearn.metrics import accuracy_score, mean_squared_error, precision_score, recall_score, f1_score
import joblib
import threading
import asyncio
from concurrent.futures import ThreadPoolExecutor
import statistics

logger = logging.getLogger(__name__)


class ModelStatus(Enum):
    """Model status types"""
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"
    DEPRECATED = "deprecated"
    ARCHIVED = "archived"


class ExperimentType(Enum):
    """Experiment types"""
    A_B_TEST = "ab_test"
    MULTI_ARMED_BANDIT = "multi_armed_bandit"
    CANARY_DEPLOYMENT = "canary_deployment"
    BLUE_GREEN_DEPLOYMENT = "blue_green_deployment"
    SHADOW_DEPLOYMENT = "shadow_deployment"


class MetricType(Enum):
    """Metric types"""
    ACCURACY = "accuracy"
    PRECISION = "precision"
    RECALL = "recall"
    F1_SCORE = "f1_score"
    MSE = "mse"
    MAE = "mae"
    R2_SCORE = "r2_score"
    LATENCY = "latency"
    THROUGHPUT = "throughput"
    CONVERSION_RATE = "conversion_rate"
    REVENUE = "revenue"


class TrafficSplitType(Enum):
    """Traffic split types"""
    PERCENTAGE = "percentage"
    USER_SEGMENT = "user_segment"
    GEOGRAPHIC = "geographic"
    TIME_BASED = "time_based"
    RANDOM = "random"


@dataclass
class ModelVersion:
    """Model version information"""
    version_id: str
    model_name: str
    version_number: str
    status: ModelStatus
    model_path: str
    model_size_mb: float
    created_at: datetime
    created_by: str
    description: str
    performance_metrics: Dict[str, float] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    parent_version_id: Optional[str] = None
    is_production: bool = False
    deployment_config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Experiment:
    """A/B testing experiment"""
    experiment_id: str
    name: str
    description: str
    experiment_type: ExperimentType
    status: str
    start_time: datetime
    end_time: Optional[datetime]
    traffic_split: Dict[str, float]
    variants: List[str]
    primary_metric: MetricType
    secondary_metrics: List[MetricType]
    sample_size: int
    confidence_level: float
    statistical_power: float
    min_detectable_effect: float
    results: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    created_by: str = ""


@dataclass
class ExperimentResult:
    """Experiment results"""
    experiment_id: str
    variant_id: str
    sample_size: int
    metrics: Dict[str, float]
    confidence_intervals: Dict[str, Tuple[float, float]]
    p_values: Dict[str, float]
    is_winner: bool
    statistical_significance: bool
    effect_size: float
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class TrafficSplitter:
    """Traffic splitting configuration"""
    split_type: TrafficSplitType
    split_ratios: Dict[str, float]
    user_segments: Optional[Dict[str, List[str]]] = None
    geographic_rules: Optional[Dict[str, List[str]]] = None
    time_rules: Optional[Dict[str, str]] = None


class ModelVersionManager:
    """Model version management"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.models = {}
        self.versions = {}
        
    def create_model_version(self, model_name: str, model_path: str, version_number: str,
                           created_by: str, description: str = "", 
                           parent_version_id: Optional[str] = None,
                           model_object: Optional[Any] = None) -> ModelVersion:
        """Create new model version"""
        version_id = f"{model_name}_v{version_number}_{secrets.token_hex(8)}"
        
        try:
            # Calculate model size
            model_size = self._calculate_model_size(model_path, model_object)
            
            # Create version
            version = ModelVersion(
                version_id=version_id,
                model_name=model_name,
                version_number=version_number,
                status=ModelStatus.DEVELOPMENT,
                model_path=model_path,
                model_size_mb=model_size,
                created_at=datetime.utcnow(),
                created_by=created_by,
                description=description,
                parent_version_id=parent_version_id
            )
            
            # Store version
            self.versions[version_id] = version
            
            # Update model versions list
            if model_name not in self.models:
                self.models[model_name] = []
            self.models[model_name].append(version_id)
            
            # Save to Redis
            self._save_model_version(version)
            self._save_model_versions_list(model_name)
            
            logger.info(f"Created model version {version_id}")
            return version
            
        except Exception as e:
            logger.error(f"Error creating model version: {e}")
            raise
    
    def promote_model(self, version_id: str, target_status: ModelStatus, 
                     promoted_by: str) -> ModelVersion:
        """Promote model to different status"""
        if version_id not in self.versions:
            raise ValueError(f"Version {version_id} not found")
        
        version = self.versions[version_id]
        
        # Validate promotion path
        if not self._validate_promotion(version.status, target_status):
            raise ValueError(f"Invalid promotion from {version.status} to {target_status}")
        
        # Update status
        old_status = version.status
        version.status = target_status
        
        # Handle production promotion
        if target_status == ModelStatus.PRODUCTION:
            # Demote current production version
            self._demote_current_production(version.model_name)
            version.is_production = True
            version.deployment_config = {
                'promoted_at': datetime.utcnow(),
                'promoted_by': promoted_by,
                'previous_status': old_status.value
            }
        
        # Save changes
        self._save_model_version(version)
        
        logger.info(f"Promoted {version_id} from {old_status} to {target_status}")
        return version
    
    def get_model_versions(self, model_name: str) -> List[ModelVersion]:
        """Get all versions of a model"""
        if model_name not in self.models:
            return []
        
        versions = []
        for version_id in self.models[model_name]:
            if version_id in self.versions:
                versions.append(self.versions[version_id])
        
        # Sort by version number
        versions.sort(key=lambda x: x.version_number, reverse=True)
        return versions
    
    def get_production_version(self, model_name: str) -> Optional[ModelVersion]:
        """Get production version of a model"""
        versions = self.get_model_versions(model_name)
        for version in versions:
            if version.is_production:
                return version
        return None
    
    def _calculate_model_size(self, model_path: str, model_object: Optional[Any] = None) -> float:
        """Calculate model size in MB"""
        try:
            if model_object is not None:
                # Calculate from object
                model_bytes = pickle.dumps(model_object)
                return len(model_bytes) / (1024 * 1024)
            else:
                # Calculate from file
                import os
                if os.path.exists(model_path):
                    return os.path.getsize(model_path) / (1024 * 1024)
                else:
                    return 0.0
        except Exception:
            return 0.0
    
    def _validate_promotion(self, current_status: ModelStatus, target_status: ModelStatus) -> bool:
        """Validate promotion path"""
        valid_paths = {
            ModelStatus.DEVELOPMENT: [ModelStatus.TESTING],
            ModelStatus.TESTING: [ModelStatus.STAGING, ModelStatus.DEVELOPMENT],
            ModelStatus.STAGING: [ModelStatus.PRODUCTION, ModelStatus.TESTING],
            ModelStatus.PRODUCTION: [ModelStatus.STAGING, ModelStatus.DEPRECATED],
            ModelStatus.DEPRECATED: [ModelStatus.ARCHIVED],
            ModelStatus.ARCHIVED: []
        }
        
        return target_status in valid_paths.get(current_status, [])
    
    def _demote_current_production(self, model_name: str) -> None:
        """Demote current production version"""
        current_prod = self.get_production_version(model_name)
        if current_prod:
            current_prod.is_production = False
            self._save_model_version(current_prod)
    
    def _save_model_version(self, version: ModelVersion) -> None:
        """Save model version to Redis"""
        try:
            if self.redis:
                version_data = {
                    'version_id': version.version_id,
                    'model_name': version.model_name,
                    'version_number': version.version_number,
                    'status': version.status.value,
                    'model_path': version.model_path,
                    'model_size_mb': version.model_size_mb,
                    'created_at': version.created_at.isoformat(),
                    'created_by': version.created_by,
                    'description': version.description,
                    'performance_metrics': version.performance_metrics,
                    'metadata': version.metadata,
                    'parent_version_id': version.parent_version_id,
                    'is_production': version.is_production,
                    'deployment_config': version.deployment_config
                }
                
                self.redis.setex(f"model_version:{version.version_id}", 
                               86400 * 365, json.dumps(version_data))  # 1 year TTL
                
                logger.info(f"Saved model version {version.version_id}")
        except Exception as e:
            logger.error(f"Failed to save model version: {e}")
    
    def _save_model_versions_list(self, model_name: str) -> None:
        """Save model versions list to Redis"""
        try:
            if self.redis:
                versions_list = self.models.get(model_name, [])
                self.redis.setex(f"model_versions:{model_name}", 
                               86400 * 365, json.dumps(versions_list))
        except Exception as e:
            logger.error(f"Failed to save model versions list: {e}")


class ABTestingService:
    """A/B testing service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.experiments = {}
        self.traffic_splitters = {}
        self.results = {}
        
    def create_experiment(self, name: str, description: str, experiment_type: ExperimentType,
                         variants: List[str], traffic_split: Dict[str, float],
                         primary_metric: MetricType, secondary_metrics: List[MetricType],
                         sample_size: int, confidence_level: float = 0.95,
                         statistical_power: float = 0.8, min_detectable_effect: float = 0.05,
                         created_by: str = "") -> Experiment:
        """Create A/B testing experiment"""
        experiment_id = f"exp_{secrets.token_hex(8)}"
        
        try:
            # Validate traffic split
            if not self._validate_traffic_split(traffic_split):
                raise ValueError("Invalid traffic split - must sum to 1.0")
            
            # Create experiment
            experiment = Experiment(
                experiment_id=experiment_id,
                name=name,
                description=description,
                experiment_type=experiment_type,
                status="created",
                start_time=datetime.utcnow(),
                end_time=None,
                traffic_split=traffic_split,
                variants=variants,
                primary_metric=primary_metric,
                secondary_metrics=secondary_metrics,
                sample_size=sample_size,
                confidence_level=confidence_level,
                statistical_power=statistical_power,
                min_detectable_effect=min_detectable_effect,
                created_by=created_by
            )
            
            # Store experiment
            self.experiments[experiment_id] = experiment
            
            # Create traffic splitter
            splitter = TrafficSplitter(
                split_type=TrafficSplitType.PERCENTAGE,
                split_ratios=traffic_split
            )
            self.traffic_splitters[experiment_id] = splitter
            
            # Save to Redis
            self._save_experiment(experiment)
            
            logger.info(f"Created experiment {experiment_id}")
            return experiment
            
        except Exception as e:
            logger.error(f"Error creating experiment: {e}")
            raise
    
    def start_experiment(self, experiment_id: str) -> Experiment:
        """Start experiment"""
        if experiment_id not in self.experiments:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        experiment = self.experiments[experiment_id]
        experiment.status = "running"
        experiment.start_time = datetime.utcnow()
        
        self._save_experiment(experiment)
        
        logger.info(f"Started experiment {experiment_id}")
        return experiment
    
    def assign_variant(self, experiment_id: str, user_id: str, 
                     user_attributes: Optional[Dict[str, Any]] = None) -> str:
        """Assign user to experiment variant"""
        if experiment_id not in self.experiments:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        experiment = self.experiments[experiment_id]
        splitter = self.traffic_splitters[experiment_id]
        
        if experiment.status != "running":
            raise ValueError(f"Experiment {experiment_id} is not running")
        
        # Generate consistent assignment
        hash_input = f"{experiment_id}:{user_id}"
        hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
        
        # Assign based on traffic split
        cumulative = 0.0
        for variant, ratio in experiment.traffic_split.items():
            cumulative += ratio
            if (hash_value % 100) / 100 < cumulative:
                return variant
        
        # Fallback to first variant
        return list(experiment.traffic_split.keys())[0]
    
    def record_metric(self, experiment_id: str, variant_id: str, user_id: str,
                    metrics: Dict[str, float]) -> None:
        """Record metrics for experiment"""
        try:
            # Create metric record
            metric_record = {
                'experiment_id': experiment_id,
                'variant_id': variant_id,
                'user_id': user_id,
                'metrics': metrics,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # Store in Redis
            if self.redis:
                metric_key = f"experiment_metrics:{experiment_id}:{variant_id}"
                self.redis.lpush(metric_key, json.dumps(metric_record))
                
                # Set TTL
                self.redis.expire(metric_key, 86400 * 30)  # 30 days
                
                logger.debug(f"Recorded metrics for {experiment_id}:{variant_id}")
            
        except Exception as e:
            logger.error(f"Error recording metrics: {e}")
    
    def analyze_experiment(self, experiment_id: str) -> ExperimentResult:
        """Analyze experiment results"""
        if experiment_id not in self.experiments:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        experiment = self.experiments[experiment_id]
        
        try:
            # Collect metrics for all variants
            variant_results = {}
            
            for variant_id in experiment.variants:
                metrics_data = self._get_variant_metrics(experiment_id, variant_id)
                variant_results[variant_id] = self._calculate_variant_statistics(
                    metrics_data, experiment.primary_metric, experiment.secondary_metrics
                )
            
            # Determine winner
            winner = self._determine_winner(variant_results, experiment.primary_metric)
            
            # Create experiment result
            result = ExperimentResult(
                experiment_id=experiment_id,
                variant_id=winner['variant_id'],
                sample_size=winner['sample_size'],
                metrics=winner['metrics'],
                confidence_intervals=winner['confidence_intervals'],
                p_values=winner['p_values'],
                is_winner=winner['is_winner'],
                statistical_significance=winner['statistical_significance'],
                effect_size=winner['effect_size']
            )
            
            # Update experiment
            experiment.results = {
                'analysis_date': datetime.utcnow().isoformat(),
                'winner': winner['variant_id'],
                'statistical_significance': winner['statistical_significance'],
                'effect_size': winner['effect_size'],
                'variant_results': variant_results
            }
            
            self._save_experiment(experiment)
            self._save_experiment_result(experiment_id, result)
            
            logger.info(f"Analyzed experiment {experiment_id}, winner: {winner['variant_id']}")
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing experiment: {e}")
            raise
    
    def _validate_traffic_split(self, traffic_split: Dict[str, float]) -> bool:
        """Validate traffic split configuration"""
        total = sum(traffic_split.values())
        return abs(total - 1.0) < 0.001
    
    def _get_variant_metrics(self, experiment_id: str, variant_id: str) -> List[Dict[str, Any]]:
        """Get metrics for a variant"""
        metrics = []
        
        if self.redis:
            metric_key = f"experiment_metrics:{experiment_id}:{variant_id}"
            metric_data = self.redis.lrange(metric_key, 0, -1)
            
            for data in metric_data:
                try:
                    metrics.append(json.loads(data))
                except json.JSONDecodeError:
                    continue
        
        return metrics
    
    def _calculate_variant_statistics(self, metrics_data: List[Dict[str, Any]],
                                   primary_metric: MetricType, 
                                   secondary_metrics: List[MetricType]) -> Dict[str, Any]:
        """Calculate statistics for a variant"""
        if not metrics_data:
            return {
                'sample_size': 0,
                'metrics': {},
                'confidence_intervals': {},
                'p_values': {}
            }
        
        # Extract metric values
        metric_values = {}
        for metric in [primary_metric] + secondary_metrics:
            values = [m['metrics'].get(metric.value, 0) for m in metrics_data]
            metric_values[metric.value] = values
        
        # Calculate statistics
        statistics = {
            'sample_size': len(metrics_data),
            'metrics': {},
            'confidence_intervals': {},
            'p_values': {}
        }
        
        for metric_name, values in metric_values.items():
            if values:
                mean_val = np.mean(values)
                std_val = np.std(values)
                
                statistics['metrics'][metric_name] = mean_val
                
                # Calculate confidence interval
                n = len(values)
                if n > 1:
                    margin_of_error = 1.96 * (std_val / np.sqrt(n))
                    statistics['confidence_intervals'][metric_name] = (
                        mean_val - margin_of_error,
                        mean_val + margin_of_error
                    )
                else:
                    statistics['confidence_intervals'][metric_name] = (mean_val, mean_val)
        
        return statistics
    
    def _determine_winner(self, variant_results: Dict[str, Any], 
                         primary_metric: MetricType) -> Dict[str, Any]:
        """Determine winning variant"""
        best_variant = None
        best_score = float('-inf')
        
        for variant_id, stats in variant_results.items():
            score = stats['metrics'].get(primary_metric.value, 0)
            
            # For metrics where lower is better (like MSE)
            if primary_metric in [MetricType.MSE, MetricType.MAE, MetricType.LATENCY]:
                if score < best_score:
                    best_score = score
                    best_variant = variant_id
            else:
                if score > best_score:
                    best_score = score
                    best_variant = variant_id
        
        if best_variant:
            # Calculate effect size and statistical significance
            best_stats = variant_results[best_variant]
            control_stats = variant_results.get(list(variant_results.keys())[0], {})
            
            effect_size = 0.0
            statistical_significance = False
            
            if primary_metric.value in best_stats['metrics'] and primary_metric.value in control_stats['metrics']:
                best_mean = best_stats['metrics'][primary_metric.value]
                control_mean = control_stats['metrics'][primary_metric.value]
                control_std = control_stats['confidence_intervals'].get(primary_metric.value, (0, 0))[1] - control_mean
                
                if control_std > 0:
                    effect_size = (best_mean - control_mean) / control_std
                    
                    # Simple significance test (would need proper statistical test)
                    if abs(effect_size) > 0.2:  # Cohen's d threshold
                        statistical_significance = True
            
            return {
                'variant_id': best_variant,
                'sample_size': best_stats['sample_size'],
                'metrics': best_stats['metrics'],
                'confidence_intervals': best_stats['confidence_intervals'],
                'p_values': best_stats['p_values'],
                'is_winner': True,
                'statistical_significance': statistical_significance,
                'effect_size': effect_size
            }
        
        return {
            'variant_id': '',
            'sample_size': 0,
            'metrics': {},
            'confidence_intervals': {},
            'p_values': {},
            'is_winner': False,
            'statistical_significance': False,
            'effect_size': 0.0
        }
    
    def _save_experiment(self, experiment: Experiment) -> None:
        """Save experiment to Redis"""
        try:
            if self.redis:
                experiment_data = {
                    'experiment_id': experiment.experiment_id,
                    'name': experiment.name,
                    'description': experiment.description,
                    'experiment_type': experiment.experiment_type.value,
                    'status': experiment.status,
                    'start_time': experiment.start_time.isoformat(),
                    'end_time': experiment.end_time.isoformat() if experiment.end_time else None,
                    'traffic_split': experiment.traffic_split,
                    'variants': experiment.variants,
                    'primary_metric': experiment.primary_metric.value,
                    'secondary_metrics': [m.value for m in experiment.secondary_metrics],
                    'sample_size': experiment.sample_size,
                    'confidence_level': experiment.confidence_level,
                    'statistical_power': experiment.statistical_power,
                    'min_detectable_effect': experiment.min_detectable_effect,
                    'results': experiment.results,
                    'created_at': experiment.created_at.isoformat(),
                    'created_by': experiment.created_by
                }
                
                self.redis.setex(f"experiment:{experiment.experiment_id}", 
                               86400 * 90, json.dumps(experiment_data))  # 90 days TTL
                
                logger.info(f"Saved experiment {experiment.experiment_id}")
        except Exception as e:
            logger.error(f"Failed to save experiment: {e}")
    
    def _save_experiment_result(self, experiment_id: str, result: ExperimentResult) -> None:
        """Save experiment result to Redis"""
        try:
            if self.redis:
                result_data = {
                    'experiment_id': result.experiment_id,
                    'variant_id': result.variant_id,
                    'sample_size': result.sample_size,
                    'metrics': result.metrics,
                    'confidence_intervals': result.confidence_intervals,
                    'p_values': result.p_values,
                    'is_winner': result.is_winner,
                    'statistical_significance': result.statistical_significance,
                    'effect_size': result.effect_size,
                    'created_at': result.created_at.isoformat()
                }
                
                self.redis.setex(f"experiment_result:{experiment_id}", 
                               86400 * 365, json.dumps(result_data))  # 1 year TTL
                
                logger.info(f"Saved experiment result for {experiment_id}")
        except Exception as e:
            logger.error(f"Failed to save experiment result: {e}")


class ModelVersioningService:
    """Main model versioning and A/B testing service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.version_manager = ModelVersionManager(redis_client)
        self.ab_testing = ABTestingService(redis_client)
        
    def create_model_version_with_ab_test(self, model_name: str, model_path: str,
                                        version_number: str, created_by: str,
                                        test_variants: List[str], traffic_split: Dict[str, float],
                                        primary_metric: MetricType, sample_size: int,
                                        description: str = "") -> Dict[str, Any]:
        """Create model version with A/B test"""
        try:
            # Create model version
            version = self.version_manager.create_model_version(
                model_name=model_name,
                model_path=model_path,
                version_number=version_number,
                created_by=created_by,
                description=description
            )
            
            # Create A/B test
            experiment = self.ab_testing.create_experiment(
                name=f"Model Test - {model_name} v{version_number}",
                description=f"A/B test for {model_name} version {version_number}",
                experiment_type=ExperimentType.A_B_TEST,
                variants=test_variants,
                traffic_split=traffic_split,
                primary_metric=primary_metric,
                secondary_metrics=[],
                sample_size=sample_size,
                created_by=created_by
            )
            
            return {
                'version_id': version.version_id,
                'experiment_id': experiment.experiment_id,
                'model_name': model_name,
                'version_number': version_number,
                'status': 'created',
                'created_at': version.created_at.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error creating model version with A/B test: {e}")
            raise
    
    def promote_winning_variant(self, experiment_id: str, promoted_by: str) -> Dict[str, Any]:
        """Analyze experiment and promote winning variant"""
        try:
            # Analyze experiment
            result = self.ab_testing.analyze_experiment(experiment_id)
            
            if result.statistical_significance:
                # Get experiment details
                experiment = self.ab_testing.experiments[experiment_id]
                
                # Promote winning variant (simplified - would need actual model promotion)
                promotion_result = {
                    'experiment_id': experiment_id,
                    'winning_variant': result.variant_id,
                    'statistical_significance': result.statistical_significance,
                    'effect_size': result.effect_size,
                    'promoted_by': promoted_by,
                    'promotion_date': datetime.utcnow().isoformat(),
                    'status': 'promoted'
                }
                
                logger.info(f"Promoted winning variant {result.variant_id} from experiment {experiment_id}")
                return promotion_result
            else:
                return {
                    'experiment_id': experiment_id,
                    'status': 'no_significant_result',
                    'message': 'No statistically significant winner found'
                }
                
        except Exception as e:
            logger.error(f"Error promoting winning variant: {e}")
            raise
    
    def get_model_deployment_status(self, model_name: str) -> Dict[str, Any]:
        """Get deployment status for a model"""
        try:
            versions = self.version_manager.get_model_versions(model_name)
            production_version = self.version_manager.get_production_version(model_name)
            
            # Get active experiments
            active_experiments = []
            for exp_id, exp in self.ab_testing.experiments.items():
                if exp.status == "running" and any(variant in [v.version_id for v in versions] for variant in exp.variants):
                    active_experiments.append({
                        'experiment_id': exp_id,
                        'name': exp.name,
                        'variants': exp.variants,
                        'traffic_split': exp.traffic_split
                    })
            
            return {
                'model_name': model_name,
                'total_versions': len(versions),
                'production_version': {
                    'version_id': production_version.version_id if production_version else None,
                    'version_number': production_version.version_number if production_version else None,
                    'created_at': production_version.created_at.isoformat() if production_version else None
                },
                'version_statuses': [
                    {
                        'version_id': v.version_id,
                        'version_number': v.version_number,
                        'status': v.status.value,
                        'is_production': v.is_production,
                        'created_at': v.created_at.isoformat()
                    }
                    for v in versions
                ],
                'active_experiments': active_experiments,
                'last_updated': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting deployment status: {e}")
            raise


# Global model versioning service instance
model_versioning_service = ModelVersioningService()

# Export functions
def create_model_version(model_name: str, model_path: str, version_number: str,
                      created_by: str, description: str = "", 
                      parent_version_id: Optional[str] = None) -> ModelVersion:
    """Create new model version"""
    return model_versioning_service.version_manager.create_model_version(
        model_name, model_path, version_number, created_by, description, parent_version_id
    )

def promote_model_version(version_id: str, target_status: ModelStatus, 
                       promoted_by: str) -> ModelVersion:
    """Promote model version"""
    return model_versioning_service.version_manager.promote_model(version_id, target_status, promoted_by)

def create_ab_experiment(name: str, description: str, variants: List[str],
                       traffic_split: Dict[str, float], primary_metric: MetricType,
                       sample_size: int, created_by: str = "") -> Experiment:
    """Create A/B testing experiment"""
    return model_versioning_service.ab_testing.create_experiment(
        name, description, ExperimentType.A_B_TEST, variants, traffic_split,
        primary_metric, [], sample_size, created_by=created_by
    )

def assign_experiment_variant(experiment_id: str, user_id: str,
                           user_attributes: Optional[Dict[str, Any]] = None) -> str:
    """Assign user to experiment variant"""
    return model_versioning_service.ab_testing.assign_variant(experiment_id, user_id, user_attributes)

def record_experiment_metrics(experiment_id: str, variant_id: str, user_id: str,
                           metrics: Dict[str, float]) -> None:
    """Record experiment metrics"""
    model_versioning_service.ab_testing.record_metric(experiment_id, variant_id, user_id, metrics)

def analyze_experiment(experiment_id: str) -> ExperimentResult:
    """Analyze experiment results"""
    return model_versioning_service.ab_testing.analyze_experiment(experiment_id)

def get_model_deployment_status(model_name: str) -> Dict[str, Any]:
    """Get model deployment status"""
    return model_versioning_service.get_model_deployment_status(model_name)

# Export all components
__all__ = [
    'ModelStatus',
    'ExperimentType',
    'MetricType',
    'TrafficSplitType',
    'ModelVersion',
    'Experiment',
    'ExperimentResult',
    'TrafficSplitter',
    'ModelVersionManager',
    'ABTestingService',
    'ModelVersioningService',
    'create_model_version',
    'promote_model_version',
    'create_ab_experiment',
    'assign_experiment_variant',
    'record_experiment_metrics',
    'analyze_experiment',
    'get_model_deployment_status',
    'model_versioning_service',
]
