"""
Model Explainability and Interpretability System
Advanced model explainability with SHAP, LIME, and interpretability techniques
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
import shap
import lime
import lime.lime_tabular
from sklearn.inspection import permutation_importance, partial_dependence
from sklearn.tree import export_text, plot_tree
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class ExplainabilityMethod(Enum):
    """Explainability methods"""
    SHAP = "shap"
    LIME = "lime"
    PERMUTATION_IMPORTANCE = "permutation_importance"
    PARTIAL_DEPENDENCE = "partial_dependence"
    FEATURE_IMPORTANCE = "feature_importance"
    DECISION_TREE_RULES = "decision_tree_rules"
    COUNTERFACTUAL_EXPLANATIONS = "counterfactual_explanations"
    ANCHOR_EXPLANATIONS = "anchor_explanations"


class ExplanationType(Enum):
    """Explanation types"""
    GLOBAL = "global"
    LOCAL = "local"
    GLOBAL_LOCAL = "global_local"
    MODEL_AGNOSTIC = "model_agnostic"
    MODEL_SPECIFIC = "model_specific"


@dataclass
class FeatureImportance:
    """Feature importance result"""
    feature_name: str
    importance_score: float
    importance_type: str
    confidence_interval: Tuple[float, float]
    rank: int
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LocalExplanation:
    """Local explanation result"""
    instance_id: str
    prediction: float
    actual_value: Optional[float]
    feature_contributions: Dict[str, float]
    feature_values: Dict[str, Any]
    explanation_method: str
    confidence: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GlobalExplanation:
    """Global explanation result"""
    model_id: str
    explanation_method: str
    feature_importance: List[FeatureImportance]
    model_performance: Dict[str, float]
    explanation_summary: str
    visualizations: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ExplainabilityConfig:
    """Explainability configuration"""
    explanation_method: ExplainabilityMethod
    explanation_type: ExplanationType
    sample_size: int = 1000
    background_data_size: int = 100
    confidence_level: float = 0.95
    max_features: int = 50
    include_interactions: bool = True
    visualizations: bool = True


class SHAPExplainer:
    """SHAP-based explanations"""
    
    def __init__(self, config: ExplainabilityConfig):
        self.config = config
        self.explainer = None
        self.background_data = None
        
    def fit(self, model, X: pd.DataFrame, y: Optional[pd.Series] = None) -> None:
        """Fit SHAP explainer"""
        try:
            # Sample background data
            if len(X) > self.config.background_data_size:
                background_indices = np.random.choice(len(X), self.config.background_data_size, replace=False)
                self.background_data = X.iloc[background_indices]
            else:
                self.background_data = X
            
            # Choose appropriate explainer based on model type
            model_type = str(type(model).__name__).lower()
            
            if 'tree' in model_type or 'forest' in model_type or 'gradient' in model_type:
                self.explainer = shap.TreeExplainer(model, data=self.background_data)
            elif 'linear' in model_type:
                self.explainer = shap.LinearExplainer(model, self.background_data)
            elif 'neural' in model_type or 'mlp' in model_type:
                self.explainer = shap.DeepExplainer(model, self.background_data)
            else:
                # Default to KernelExplainer for model-agnostic explanations
                self.explainer = shap.KernelExplainer(model, self.background_data)
            
            logger.info(f"SHAP explainer fitted: {type(self.explainer).__name__}")
            
        except Exception as e:
            logger.error(f"Error fitting SHAP explainer: {e}")
            raise
    
    def explain_instance(self, X_instance: pd.Series, model_prediction: float) -> LocalExplanation:
        """Explain single instance using SHAP"""
        if self.explainer is None:
            raise ValueError("Explainer not fitted")
        
        try:
            # Calculate SHAP values
            shap_values = self.explainer.shap_values(X_instance.values.reshape(1, -1))
            
            if isinstance(shap_values, list):
                shap_values = shap_values[0]  # For multi-class, take first class
            
            # Create feature contributions
            feature_contributions = {}
            feature_values = {}
            
            for i, (feature_name, value) in enumerate(X_instance.items()):
                feature_contributions[feature_name] = float(shap_values[0][i])
                feature_values[feature_name] = value
            
            # Calculate confidence
            base_value = self.explainer.expected_value if hasattr(self.explainer, 'expected_value') else 0
            if isinstance(base_value, list):
                base_value = base_value[0]
            
            prediction_from_shap = base_value + sum(shap_values[0])
            confidence = 1.0 - abs(prediction_from_shap - model_prediction) / (abs(model_prediction) + 1e-8)
            
            return LocalExplanation(
                instance_id=f"instance_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                prediction=model_prediction,
                actual_value=None,
                feature_contributions=feature_contributions,
                feature_values=feature_values,
                explanation_method="SHAP",
                confidence=min(max(confidence, 0.0), 1.0),
                metadata={
                    'base_value': float(base_value),
                    'shap_values': shap_values[0].tolist(),
                    'explainer_type': type(self.explainer).__name__
                }
            )
            
        except Exception as e:
            logger.error(f"Error in SHAP local explanation: {e}")
            raise
    
    def explain_global(self, X: pd.DataFrame, y: pd.Series) -> GlobalExplanation:
        """Generate global SHAP explanations"""
        if self.explainer is None:
            raise ValueError("Explainer not fitted")
        
        try:
            # Calculate SHAP values for sample
            sample_size = min(self.config.sample_size, len(X))
            sample_indices = np.random.choice(len(X), sample_size, replace=False)
            X_sample = X.iloc[sample_indices]
            
            shap_values = self.explainer.shap_values(X_sample)
            
            if isinstance(shap_values, list):
                shap_values = shap_values[0]  # For multi-class, take first class
            
            # Calculate feature importance
            feature_importance = []
            mean_shap_values = np.abs(shap_values).mean(axis=0)
            
            for i, feature_name in enumerate(X.columns):
                importance_score = float(mean_shap_values[i])
                
                # Calculate confidence interval using bootstrap
                bootstrap_scores = []
                for _ in range(100):
                    bootstrap_indices = np.random.choice(len(shap_values), len(shap_values), replace=True)
                    bootstrap_mean = np.abs(shap_values[bootstrap_indices]).mean(axis=0)
                    bootstrap_scores.append(bootstrap_mean[i])
                
                confidence_interval = (
                    np.percentile(bootstrap_scores, 2.5),
                    np.percentile(bootstrap_scores, 97.5)
                )
                
                feature_importance.append(FeatureImportance(
                    feature_name=feature_name,
                    importance_score=importance_score,
                    importance_type="SHAP_mean_abs",
                    confidence_interval=confidence_interval,
                    rank=0,  # Will be set after sorting
                    metadata={
                        'mean_shap_value': importance_score,
                        'std_shap_value': np.std(shap_values[:, i])
                    }
                ))
            
            # Sort by importance
            feature_importance.sort(key=lambda x: x.importance_score, reverse=True)
            for i, feature in enumerate(feature_importance):
                feature.rank = i + 1
            
            # Generate explanation summary
            top_features = feature_importance[:10]
            summary = f"Top {len(top_features)} features by SHAP importance: " + \
                     ", ".join([f"{f.feature_name} ({f.importance_score:.3f})" for f in top_features])
            
            # Create visualizations
            visualizations = {}
            if self.config.visualizations:
                # Summary plot
                shap.summary_plot(shap_values, X_sample, plot_type="bar", show=False)
                visualizations['summary_plot'] = "shap_summary_plot.png"
                
                # Feature importance plot
                shap.summary_plot(shap_values, X_sample, show=False)
                visualizations['feature_importance_plot'] = "shap_feature_importance.png"
            
            return GlobalExplanation(
                model_id="shap_model",
                explanation_method="SHAP",
                feature_importance=feature_importance,
                model_performance={},
                explanation_summary=summary,
                visualizations=visualizations,
                metadata={
                    'sample_size': sample_size,
                    'background_size': len(self.background_data),
                    'explainer_type': type(self.explainer).__name__
                }
            )
            
        except Exception as e:
            logger.error(f"Error in SHAP global explanation: {e}")
            raise


class LIMEExplainer:
    """LIME-based explanations"""
    
    def __init__(self, config: ExplainabilityConfig):
        self.config = config
        self.explainer = None
        
    def fit(self, model, X: pd.DataFrame, y: Optional[pd.Series] = None) -> None:
        """Fit LIME explainer"""
        try:
            # Determine if classification or regression
            if y is not None:
                unique_values = y.nunique()
                is_classification = unique_values < 20  # Heuristic
            else:
                is_classification = True  # Default to classification
            
            # Create LIME explainer
            self.explainer = lime.lime_tabular.LimeTabularExplainer(
                training_data=X.values,
                feature_names=X.columns,
                mode='classification' if is_classification else 'regression',
                discretize_continuous=True,
                random_state=self.config.sample_size
            )
            
            self.model = model
            self.is_classification = is_classification
            
            logger.info(f"LIME explainer fitted for {'classification' if is_classification else 'regression'}")
            
        except Exception as e:
            logger.error(f"Error fitting LIME explainer: {e}")
            raise
    
    def explain_instance(self, X_instance: pd.Series, model_prediction: float) -> LocalExplanation:
        """Explain single instance using LIME"""
        if self.explainer is None:
            raise ValueError("Explainer not fitted")
        
        try:
            # Generate explanation
            explanation = self.explainer.explain_instance(
                data_row=X_instance.values,
                predict_fn=self.model.predict if self.is_classification else self.model.predict,
                num_features=self.config.max_features,
                num_samples=5000
            )
            
            # Extract feature contributions
            feature_contributions = {}
            feature_values = {}
            
            for feature, contribution in explanation.as_list():
                feature_contributions[feature] = contribution
                feature_values[feature] = X_instance[feature]
            
            # Calculate confidence
            confidence = explanation.score if hasattr(explanation, 'score') else 0.5
            
            return LocalExplanation(
                instance_id=f"instance_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                prediction=model_prediction,
                actual_value=None,
                feature_contributions=feature_contributions,
                feature_values=feature_values,
                explanation_method="LIME",
                confidence=confidence,
                metadata={
                    'local_pred': explanation.local_pred if hasattr(explanation, 'local_pred') else None,
                    'intercept': explanation.intercept if hasattr(explanation, 'intercept') else None,
                    'num_features': len(explanation.as_list())
                }
            )
            
        except Exception as e:
            logger.error(f"Error in LIME local explanation: {e}")
            raise


class PermutationImportanceExplainer:
    """Permutation importance explanations"""
    
    def __init__(self, config: ExplainabilityConfig):
        self.config = config
        
    def explain_global(self, model, X: pd.DataFrame, y: pd.Series) -> GlobalExplanation:
        """Generate global permutation importance explanations"""
        try:
            # Calculate permutation importance
            scoring = 'accuracy' if len(y.unique()) < 20 else 'neg_mean_squared_error'
            
            perm_importance = permutation_importance(
                model, X, y,
                scoring=scoring,
                n_repeats=10,
                random_state=42,
                n_jobs=-1
            )
            
            # Create feature importance list
            feature_importance = []
            
            for i, feature_name in enumerate(X.columns):
                importance_score = perm_importance.importances_mean[i]
                std_score = perm_importance.importances_std[i]
                
                # Calculate confidence interval
                confidence_interval = (
                    importance_score - 1.96 * std_score,
                    importance_score + 1.96 * std_score
                )
                
                feature_importance.append(FeatureImportance(
                    feature_name=feature_name,
                    importance_score=importance_score,
                    importance_type="permutation_importance",
                    confidence_interval=confidence_interval,
                    rank=0,  # Will be set after sorting
                    metadata={
                        'std_importance': std_score,
                        'importances': perm_importance.importances[i].tolist()
                    }
                ))
            
            # Sort by importance
            feature_importance.sort(key=lambda x: x.importance_score, reverse=True)
            for i, feature in enumerate(feature_importance):
                feature.rank = i + 1
            
            # Generate explanation summary
            top_features = feature_importance[:10]
            summary = f"Top {len(top_features)} features by permutation importance: " + \
                     ", ".join([f"{f.feature_name} ({f.importance_score:.3f})" for f in top_features])
            
            return GlobalExplanation(
                model_id="permutation_importance_model",
                explanation_method="Permutation Importance",
                feature_importance=feature_importance,
                model_performance={'scoring': scoring},
                explanation_summary=summary,
                metadata={
                    'n_repeats': 10,
                    'scoring_metric': scoring
                }
            )
            
        except Exception as e:
            logger.error(f"Error in permutation importance explanation: {e}")
            raise


class ModelExplainabilityService:
    """Main model explainability service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.explainers = {}
        self.explanations = {}
        
    def create_explainer(self, model, X: pd.DataFrame, y: pd.Series, 
                        config: ExplainabilityConfig) -> str:
        """Create explainer for model"""
        explainer_id = f"explainer_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        try:
            if config.explanation_method == ExplainabilityMethod.SHAP:
                explainer = SHAPExplainer(config)
            elif config.explanation_method == ExplainabilityMethod.LIME:
                explainer = LIMEExplainer(config)
            elif config.explanation_method == ExplainabilityMethod.PERMUTATION_IMPORTANCE:
                explainer = PermutationImportanceExplainer(config)
            else:
                raise ValueError(f"Unsupported explanation method: {config.explanation_method}")
            
            # Fit explainer
            explainer.fit(model, X, y)
            
            # Store explainer
            self.explainers[explainer_id] = {
                'explainer': explainer,
                'config': config,
                'model_type': str(type(model).__name__),
                'feature_names': X.columns.tolist(),
                'created_at': datetime.utcnow()
            }
            
            # Save to Redis
            self._save_explainer(explainer_id)
            
            logger.info(f"Created explainer {explainer_id} with method {config.explanation_method.value}")
            return explainer_id
            
        except Exception as e:
            logger.error(f"Error creating explainer: {e}")
            raise
    
    def explain_instance(self, explainer_id: str, X_instance: pd.Series, 
                      model_prediction: float) -> LocalExplanation:
        """Explain single instance"""
        if explainer_id not in self.explainers:
            raise ValueError(f"Explainer {explainer_id} not found")
        
        explainer_data = self.explainers[explainer_id]
        explainer = explainer_data['explainer']
        
        if hasattr(explainer, 'explain_instance'):
            return explainer.explain_instance(X_instance, model_prediction)
        else:
            raise ValueError("Explainer does not support local explanations")
    
    def explain_global(self, explainer_id: str, X: pd.DataFrame, 
                    y: pd.Series) -> GlobalExplanation:
        """Generate global explanations"""
        if explainer_id not in self.explainers:
            raise ValueError(f"Explainer {explainer_id} not found")
        
        explainer_data = self.explainers[explainer_id]
        explainer = explainer_data['explainer']
        
        if hasattr(explainer, 'explain_global'):
            explanation = explainer.explain_global(X, y)
            explanation.model_id = explainer_id
            return explanation
        else:
            raise ValueError("Explainer does not support global explanations")
    
    def compare_models(self, model_explanations: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """Compare explanations across multiple models"""
        comparison_results = {}
        
        for model_id, explanation_data in model_explanations.items():
            if 'global_explanation' in explanation_data:
                global_exp = explanation_data['global_explanation']
                
                comparison_results[model_id] = {
                    'top_features': global_exp.feature_importance[:10],
                    'feature_importance_distribution': [
                        f.importance_score for f in global_exp.feature_importance
                    ],
                    'explanation_method': global_exp.explanation_method,
                    'model_performance': global_exp.model_performance
                }
        
        return {
            'model_comparisons': comparison_results,
            'feature_consensus': self._calculate_feature_consensus(comparison_results),
            'comparison_timestamp': datetime.utcnow().isoformat()
        }
    
    def _calculate_feature_consensus(self, comparisons: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate feature consensus across models"""
        feature_scores = defaultdict(list)
        
        for model_id, comparison in comparisons.items():
            for feature in comparison['top_features']:
                feature_scores[feature.feature_name].append(feature.importance_score)
        
        # Calculate consensus scores
        consensus_features = []
        for feature_name, scores in feature_scores.items():
            if len(scores) >= 2:  # Only consider features explained by multiple models
                consensus_score = np.mean(scores)
                consensus_std = np.std(scores)
                
                consensus_features.append({
                    'feature_name': feature_name,
                    'consensus_score': consensus_score,
                    'consensus_std': consensus_std,
                    'num_models': len(scores)
                })
        
        # Sort by consensus score
        consensus_features.sort(key=lambda x: x['consensus_score'], reverse=True)
        
        return {
            'top_consensus_features': consensus_features[:10],
            'feature_agreement': len(consensus_features) / len(feature_scores) if feature_scores else 0
        }
    
    def generate_explanation_report(self, explainer_id: str, X: pd.DataFrame, 
                                 y: pd.Series, instances: Optional[List[pd.Series]] = None) -> Dict[str, Any]:
        """Generate comprehensive explanation report"""
        try:
            # Generate global explanation
            global_explanation = self.explain_global(explainer_id, X, y)
            
            # Generate local explanations for instances
            local_explanations = []
            if instances:
                for i, instance in enumerate(instances[:10]):  # Limit to 10 instances
                    # Get model prediction (would need actual model)
                    model_prediction = np.random.random()  # Placeholder
                    local_exp = self.explain_instance(explainer_id, instance, model_prediction)
                    local_explanations.append(local_exp)
            
            # Generate feature analysis
            feature_analysis = self._analyze_features(global_explanation, X)
            
            report = {
                'explainer_id': explainer_id,
                'global_explanation': global_explanation,
                'local_explanations': local_explanations,
                'feature_analysis': feature_analysis,
                'summary': self._generate_summary(global_explanation, local_explanations),
                'generated_at': datetime.utcnow().isoformat()
            }
            
            # Save report
            self.explanations[explainer_id] = report
            self._save_explanation(explainer_id, report)
            
            return report
            
        except Exception as e:
            logger.error(f"Error generating explanation report: {e}")
            raise
    
    def _analyze_features(self, explanation: GlobalExplanation, X: pd.DataFrame) -> Dict[str, Any]:
        """Analyze features in explanation"""
        top_features = explanation.feature_importance[:10]
        
        analysis = {
            'top_features': [f.feature_name for f in top_features],
            'importance_scores': [f.importance_score for f in top_features],
            'confidence_intervals': [f.confidence_interval for f in top_features],
            'feature_types': {},
            'correlation_analysis': {}
        }
        
        # Analyze feature types
        for feature_name in analysis['top_features']:
            if feature_name in X.columns:
                dtype = X[feature_name].dtype
                if dtype in ['int64', 'float64']:
                    analysis['feature_types'][feature_name] = 'numerical'
                elif dtype == 'object':
                    analysis['feature_types'][feature_name] = 'categorical'
                elif dtype == 'bool':
                    analysis['feature_types'][feature_name] = 'boolean'
                else:
                    analysis['feature_types'][feature_name] = 'other'
        
        return analysis
    
    def _generate_summary(self, global_exp: GlobalExplanation, 
                         local_exps: List[LocalExplanation]) -> str:
        """Generate explanation summary"""
        summary_parts = []
        
        # Global explanation summary
        summary_parts.append(f"Global explanation using {global_exp.explanation_method}")
        summary_parts.append(f"Top feature: {global_exp.feature_importance[0].feature_name}")
        summary_parts.append(f"Method: {global_exp.explanation_method}")
        
        # Local explanations summary
        if local_exps:
            avg_confidence = np.mean([exp.confidence for exp in local_exps])
            summary_parts.append(f"Average local explanation confidence: {avg_confidence:.3f}")
            summary_parts.append(f"Number of local explanations: {len(local_exps)}")
        
        return " | ".join(summary_parts)
    
    def _save_explainer(self, explainer_id: str) -> None:
        """Save explainer to Redis"""
        try:
            if self.redis:
                explainer_data = self.explainers[explainer_id]
                serialized_data = {
                    'config': explainer_data['config'].__dict__,
                    'model_type': explainer_data['model_type'],
                    'feature_names': explainer_data['feature_names'],
                    'created_at': explainer_data['created_at'].isoformat()
                }
                
                self.redis.setex(f"explainer:{explainer_id}", 
                               86400 * 7, json.dumps(serialized_data))
                logger.info(f"Saved explainer {explainer_id}")
        except Exception as e:
            logger.error(f"Failed to save explainer: {e}")
    
    def _save_explanation(self, explainer_id: str, explanation: Dict[str, Any]) -> None:
        """Save explanation to Redis"""
        try:
            if self.redis:
                self.redis.setex(f"explanation:{explainer_id}", 
                               86400 * 7, json.dumps(explanation))
                logger.info(f"Saved explanation for {explainer_id}")
        except Exception as e:
            logger.error(f"Failed to save explanation: {e}")
    
    def load_explainer(self, explainer_id: str) -> Dict[str, Any]:
        """Load explainer from Redis"""
        try:
            if self.redis:
                explainer_data = self.redis.get(f"explainer:{explainer_id}")
                if explainer_data:
                    return json.loads(explainer_data)
        except Exception as e:
            logger.error(f"Failed to load explainer: {e}")
        return {'error': f'Explainer {explainer_id} not found'}
    
    def load_explanation(self, explainer_id: str) -> Dict[str, Any]:
        """Load explanation from Redis"""
        try:
            if self.redis:
                explanation_data = self.redis.get(f"explanation:{explainer_id}")
                if explanation_data:
                    return json.loads(explanation_data)
        except Exception as e:
            logger.error(f"Failed to load explanation: {e}")
        return {'error': f'Explanation for {explainer_id} not found'}


# Global explainability service instance
explainability_service = ModelExplainabilityService()

# Export functions
def create_model_explainer(model, X: pd.DataFrame, y: pd.Series, 
                        config: ExplainabilityConfig) -> str:
    """Create model explainer"""
    return explainability_service.create_explainer(model, X, y, config)

def explain_model_instance(explainer_id: str, X_instance: pd.Series, 
                        model_prediction: float) -> LocalExplanation:
    """Explain model instance"""
    return explainability_service.explain_instance(explainer_id, X_instance, model_prediction)

def explain_model_global(explainer_id: str, X: pd.DataFrame, 
                      y: pd.Series) -> GlobalExplanation:
    """Generate global model explanations"""
    return explainability_service.explain_global(explainer_id, X, y)

def generate_explanation_report(explainer_id: str, X: pd.DataFrame, 
                           y: pd.Series, instances: Optional[List[pd.Series]] = None) -> Dict[str, Any]:
    """Generate explanation report"""
    return explainability_service.generate_explanation_report(explainer_id, X, y, instances)

def compare_model_explanations(model_explanations: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Compare explanations across models"""
    return explainability_service.compare_models(model_explanations)

# Export all components
__all__ = [
    'ExplainabilityMethod',
    'ExplanationType',
    'FeatureImportance',
    'LocalExplanation',
    'GlobalExplanation',
    'ExplainabilityConfig',
    'SHAPExplainer',
    'LIMEExplainer',
    'PermutationImportanceExplainer',
    'ModelExplainabilityService',
    'create_model_explainer',
    'explain_model_instance',
    'explain_model_global',
    'generate_explanation_report',
    'compare_model_explanations',
    'explainability_service',
]
