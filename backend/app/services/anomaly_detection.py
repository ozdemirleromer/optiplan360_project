"""
Anomaly Detection and Fraud Detection System
Advanced anomaly detection using statistical methods, machine learning, and rule-based systems
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple, Set
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field
from enum import Enum
import redis
import pickle
import json
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN
from sklearn.metrics import classification_report, confusion_matrix
import joblib
from scipy import stats
import hashlib

logger = logging.getLogger(__name__)


class AnomalyType(Enum):
    """Anomaly types"""
    STATISTICAL = "statistical"
    MACHINE_LEARNING = "machine_learning"
    RULE_BASED = "rule_based"
    BEHAVIORAL = "behavioral"
    TEMPORAL = "temporal"
    NETWORK = "network"


class FraudType(Enum):
    """Fraud types"""
    ACCOUNT_TAKEOVER = "account_takeover"
    ORDER_MANIPULATION = "order_manipulation"
    PAYMENT_FRAUD = "payment_fraud"
    IDENTITY_THEFT = "identity_theft"
    COLLUSION = "collusion"
    REPLAY_ATTACK = "replay_attack"
    UNUSUAL_PATTERN = "unusual_pattern"


class AnomalySeverity(Enum):
    """Anomaly severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class AnomalyAlert:
    """Anomaly alert structure"""
    alert_id: str
    anomaly_type: AnomalyType
    fraud_type: Optional[FraudType]
    severity: AnomalySeverity
    title: str
    description: str
    entity_id: str
    entity_type: str
    detected_at: datetime
    confidence_score: float
    features: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_resolved: bool = False
    resolved_at: Optional[datetime] = None


@dataclass
class DetectionConfig:
    """Detection configuration"""
    statistical_threshold: float = 3.0  # Z-score threshold
    isolation_forest_contamination: float = 0.1
    dbscan_eps: float = 0.5
    dbscan_min_samples: int = 5
    time_window_hours: int = 24
    min_samples_for_detection: int = 10
    alert_cooldown_minutes: int = 30
    fraud_confidence_threshold: float = 0.7
    enable_real_time: bool = True


class StatisticalAnomalyDetector:
    """Statistical anomaly detection using Z-score and IQR methods"""
    
    def __init__(self, config: DetectionConfig):
        self.config = config
        self.baseline_stats = {}
        
    def calculate_baseline(self, data: List[float]) -> Dict[str, float]:
        """Calculate statistical baseline"""
        if len(data) < self.config.min_samples_for_detection:
            return {}
        
        data_array = np.array(data)
        
        baseline = {
            'mean': np.mean(data_array),
            'std': np.std(data_array),
            'median': np.median(data_array),
            'q1': np.percentile(data_array, 25),
            'q3': np.percentile(data_array, 75),
            'iqr': np.percentile(data_array, 75) - np.percentile(data_array, 25),
            'min': np.min(data_array),
            'max': np.max(data_array)
        }
        
        return baseline
    
    def detect_zscore_anomalies(self, values: List[float], baseline: Dict[str, float]) -> List[bool]:
        """Detect anomalies using Z-score method"""
        if not baseline or 'mean' not in baseline or 'std' not in baseline:
            return [False] * len(values)
        
        mean = baseline['mean']
        std = baseline['std']
        
        if std == 0:
            return [False] * len(values)
        
        z_scores = [(value - mean) / std for value in values]
        anomalies = [abs(z) > self.config.statistical_threshold for z in z_scores]
        
        return anomalies
    
    def detect_iqr_anomalies(self, values: List[float], baseline: Dict[str, float]) -> List[bool]:
        """Detect anomalies using IQR method"""
        if not baseline or 'q1' not in baseline or 'q3' not in baseline:
            return [False] * len(values)
        
        q1 = baseline['q1']
        q3 = baseline['q3']
        iqr = baseline['iqr']
        
        if iqr == 0:
            return [False] * len(values)
        
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        anomalies = [(value < lower_bound) or (value > upper_bound) for value in values]
        
        return anomalies
    
    def detect_anomalies(self, data: List[Dict[str, Any]], value_field: str) -> List[AnomalyAlert]:
        """Detect statistical anomalies"""
        alerts = []
        
        # Extract values
        values = [item[value_field] for item in data]
        
        if len(values) < self.config.min_samples_for_detection:
            return alerts
        
        # Calculate baseline
        baseline = self.calculate_baseline(values)
        
        # Detect anomalies using multiple methods
        zscore_anomalies = self.detect_zscore_anomalies(values, baseline)
        iqr_anomalies = self.detect_iqr_anomalies(values, baseline)
        
        # Combine results
        for i, (item, zscore_anomaly, iqr_anomaly) in enumerate(zip(data, zscore_anomalies, iqr_anomalies)):
            if zscore_anomaly or iqr_anomaly:
                severity = AnomalySeverity.HIGH if zscore_anomaly else AnomalySeverity.MEDIUM
                
                alert = AnomalyAlert(
                    alert_id=f"stat_anomaly_{hashlib.md5(f'{item}_{i}'.encode()).hexdigest()[:8]}",
                    anomaly_type=AnomalyType.STATISTICAL,
                    fraud_type=None,
                    severity=severity,
                    title=f"Statistical Anomaly Detected",
                    description=f"Value {item[value_field]} deviates from normal pattern",
                    entity_id=str(item.get('id', i)),
                    entity_type=item.get('type', 'unknown'),
                    detected_at=datetime.now(timezone.utc),
                    confidence_score=0.8 if zscore_anomaly else 0.6,
                    features={
                        'value': item[value_field],
                        'z_score': (item[value_field] - baseline['mean']) / baseline['std'] if baseline['std'] > 0 else 0,
                        'iqr_violation': iqr_anomaly,
                        'baseline': baseline
                    }
                )
                alerts.append(alert)
        
        return alerts


class MLAnomalyDetector:
    """Machine learning based anomaly detection"""
    
    def __init__(self, config: DetectionConfig):
        self.config = config
        self.models = {}
        self.scalers = {}
        
    def train_isolation_forest(self, data: List[Dict[str, Any]], feature_fields: List[str]) -> Dict[str, Any]:
        """Train Isolation Forest model"""
        # Extract features
        features = []
        for item in data:
            feature_vector = [item.get(field, 0) for field in feature_fields]
            features.append(feature_vector)
        
        if len(features) < self.config.min_samples_for_detection:
            return {'error': 'Insufficient data for training'}
        
        X = np.array(features)
        
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Train model
        model = IsolationForest(
            contamination=self.config.isolation_forest_contamination,
            random_state=42,
            n_jobs=-1
        )
        model.fit(X_scaled)
        
        return {
            'model': model,
            'scaler': scaler,
            'feature_fields': feature_fields,
            'trained_at': datetime.now(timezone.utc)
        }
    
    def train_dbscan_clustering(self, data: List[Dict[str, Any]], feature_fields: List[str]) -> Dict[str, Any]:
        """Train DBSCAN clustering model"""
        # Extract features
        features = []
        for item in data:
            feature_vector = [item.get(field, 0) for field in feature_fields]
            features.append(feature_vector)
        
        if len(features) < self.config.min_samples_for_detection:
            return {'error': 'Insufficient data for training'}
        
        X = np.array(features)
        
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Train model
        model = DBSCAN(eps=self.config.dbscan_eps, min_samples=self.config.dbscan_min_samples)
        clusters = model.fit_predict(X_scaled)
        
        return {
            'model': model,
            'scaler': scaler,
            'feature_fields': feature_fields,
            'clusters': clusters.tolist(),
            'trained_at': datetime.now(timezone.utc)
        }
    
    def detect_anomalies(self, data: List[Dict[str, Any]], model_info: Dict[str, Any]) -> List[AnomalyAlert]:
        """Detect anomalies using trained ML models"""
        alerts = []
        
        if 'model' not in model_info or 'scaler' not in model_info:
            return alerts
        
        model = model_info['model']
        scaler = model_info['scaler']
        feature_fields = model_info['feature_fields']
        
        # Extract features
        features = []
        for item in data:
            feature_vector = [item.get(field, 0) for field in feature_fields]
            features.append(feature_vector)
        
        if len(features) == 0:
            return alerts
        
        X = np.array(features)
        X_scaled = scaler.transform(X)
        
        # Detect anomalies
        if hasattr(model, 'predict'):
            # Isolation Forest
            predictions = model.predict(X_scaled)
            anomaly_scores = model.decision_function(X_scaled)
            
            for i, (item, prediction, score) in enumerate(zip(data, predictions, anomaly_scores)):
                if prediction == -1:  # Anomaly
                    alert = AnomalyAlert(
                        alert_id=f"ml_anomaly_{hashlib.md5(f'{item}_{i}'.encode()).hexdigest()[:8]}",
                        anomaly_type=AnomalyType.MACHINE_LEARNING,
                        fraud_type=None,
                        severity=AnomalySeverity.HIGH,
                        title="ML Anomaly Detected",
                        description="Machine learning model detected anomalous pattern",
                        entity_id=str(item.get('id', i)),
                        entity_type=item.get('type', 'unknown'),
                        detected_at=datetime.now(timezone.utc),
                        confidence_score=min(abs(score) / 2, 1.0),
                        features={
                            'anomaly_score': float(score),
                            'feature_values': dict(zip(feature_fields, features[i])),
                            'model_type': 'isolation_forest'
                        }
                    )
                    alerts.append(alert)
        
        elif hasattr(model, 'labels_'):
            # DBSCAN
            clusters = model.labels_
            
            for i, (item, cluster) in enumerate(zip(data, clusters)):
                if cluster == -1:  # Noise point (anomaly)
                    alert = AnomalyAlert(
                        alert_id=f"ml_anomaly_{hashlib.md5(f'{item}_{i}'.encode()).hexdigest()[:8]}",
                        anomaly_type=AnomalyType.MACHINE_LEARNING,
                        fraud_type=None,
                        severity=AnomalySeverity.MEDIUM,
                        title="ML Anomaly Detected",
                        description="Clustering model detected anomalous pattern",
                        entity_id=str(item.get('id', i)),
                        entity_type=item.get('type', 'unknown'),
                        detected_at=datetime.now(timezone.utc),
                        confidence_score=0.7,
                        features={
                            'cluster': cluster,
                            'feature_values': dict(zip(feature_fields, features[i])),
                            'model_type': 'dbscan'
                        }
                    )
                    alerts.append(alert)
        
        return alerts


class RuleBasedFraudDetector:
    """Rule-based fraud detection system"""
    
    def __init__(self, config: DetectionConfig):
        self.config = config
        self.fraud_rules = self._initialize_rules()
        
    def _initialize_rules(self) -> Dict[str, Dict[str, Any]]:
        """Initialize fraud detection rules"""
        return {
            'multiple_accounts_same_ip': {
                'description': 'Multiple accounts from same IP',
                'window_minutes': 60,
                'max_accounts': 3,
                'severity': AnomalySeverity.HIGH
            },
            'rapid_order_creation': {
                'description': 'Too many orders created quickly',
                'window_minutes': 5,
                'max_orders': 10,
                'severity': AnomalySeverity.HIGH
            },
            'unusual_order_amount': {
                'description': 'Order amount deviates from user average',
                'deviation_threshold': 5.0,  # Standard deviations
                'min_order_count': 5,
                'severity': AnomalySeverity.MEDIUM
            },
            'suspicious_payment_method': {
                'description': 'Use of suspicious payment methods',
                'suspicious_methods': ['prepaid_card', 'crypto', 'gift_card'],
                'severity': AnomalySeverity.HIGH
            },
            'impossible_shipping': {
                'description': 'Impossible shipping scenarios',
                'rules': [
                    {'field': 'shipping_country', 'value': 'US', 'billing_country': 'US', 'shipping_time': '< 1h'},
                    {'field': 'order_amount', 'value': '> 10000', 'new_customer': True, 'no_verification': True}
                ],
                'severity': AnomalySeverity.CRITICAL
            },
            'velocity_check': {
                'description': 'High velocity transactions',
                'max_amount_per_hour': 5000,
                'max_transactions_per_hour': 20,
                'severity': AnomalySeverity.HIGH
            }
        }
    
    def detect_fraud(self, data: List[Dict[str, Any]]) -> List[AnomalyAlert]:
        """Detect fraud using rule-based system"""
        alerts = []
        
        for item in data:
            # Check each rule
            for rule_name, rule_config in self.fraud_rules.items():
                fraud_detected = self._check_rule(item, rule_name, rule_config)
                
                if fraud_detected:
                    # Determine fraud type
                    fraud_type = self._classify_fraud_type(rule_name, item)
                    
                    alert = AnomalyAlert(
                        alert_id=f"fraud_{hashlib.md5(f'{item}_{rule_name}'.encode()).hexdigest()[:8]}",
                        anomaly_type=AnomalyType.RULE_BASED,
                        fraud_type=fraud_type,
                        severity=rule_config['severity'],
                        title=f"Fraud Alert: {rule_config['description']}",
                        description=f"Rule '{rule_name}' triggered for entity {item.get('id', 'unknown')}",
                        entity_id=str(item.get('id', 'unknown')),
                        entity_type=item.get('type', 'unknown'),
                        detected_at=datetime.now(timezone.utc),
                        confidence_score=0.9,
                        features={
                            'rule_name': rule_name,
                            'rule_description': rule_config['description'],
                            'triggered_fields': self._get_triggered_fields(item, rule_config),
                            'item_data': item
                        }
                    )
                    alerts.append(alert)
        
        return alerts
    
    def _check_rule(self, item: Dict[str, Any], rule_name: str, rule_config: Dict[str, Any]) -> bool:
        """Check if a specific rule is triggered"""
        if rule_name == 'multiple_accounts_same_ip':
            return self._check_multiple_accounts_rule(item, rule_config)
        elif rule_name == 'rapid_order_creation':
            return self._check_rapid_order_rule(item, rule_config)
        elif rule_name == 'unusual_order_amount':
            return self._check_unusual_amount_rule(item, rule_config)
        elif rule_name == 'suspicious_payment_method':
            return self._check_payment_method_rule(item, rule_config)
        elif rule_name == 'impossible_shipping':
            return self._check_impossible_shipping_rule(item, rule_config)
        elif rule_name == 'velocity_check':
            return self._check_velocity_rule(item, rule_config)
        
        return False
    
    def _check_multiple_accounts_rule(self, item: Dict[str, Any], rule_config: Dict[str, Any]) -> bool:
        """Check multiple accounts from same IP"""
        # This would require checking against other recent activities
        # For now, return False (would need database access)
        return False
    
    def _check_rapid_order_rule(self, item: Dict[str, Any], rule_config: Dict[str, Any]) -> bool:
        """Check rapid order creation"""
        # This would require checking against other recent orders
        # For now, return False (would need database access)
        return False
    
    def _check_unusual_amount_rule(self, item: Dict[str, Any], rule_config: Dict[str, Any]) -> bool:
        """Check unusual order amount"""
        order_amount = item.get('order_amount', 0)
        user_avg_amount = item.get('user_avg_order_amount', 0)
        user_order_count = item.get('user_order_count', 0)
        
        if user_order_count < rule_config['min_order_count']:
            return False
        
        if user_avg_amount == 0:
            return False
        
        deviation = abs(order_amount - user_avg_amount) / user_avg_amount
        return deviation > rule_config['deviation_threshold']
    
    def _check_payment_method_rule(self, item: Dict[str, Any], rule_config: Dict[str, Any]) -> bool:
        """Check suspicious payment method"""
        payment_method = item.get('payment_method', '').lower()
        return payment_method in rule_config['suspicious_methods']
    
    def _check_impossible_shipping_rule(self, item: Dict[str, Any], rule_config: Dict[str, Any]) -> bool:
        """Check impossible shipping scenarios"""
        for rule in rule_config['rules']:
            if all(item.get(field) == value for field, value in rule.items() if field != 'shipping_time'):
                # For time-based rules, this would need more complex logic
                return True
        return False
    
    def _check_velocity_rule(self, item: Dict[str, Any], rule_config: Dict[str, Any]) -> bool:
        """Check transaction velocity"""
        # This would require checking against other recent transactions
        # For now, return False (would need database access)
        return False
    
    def _classify_fraud_type(self, rule_name: str, item: Dict[str, Any]) -> FraudType:
        """Classify fraud type based on rule"""
        fraud_type_mapping = {
            'multiple_accounts_same_ip': FraudType.ACCOUNT_TAKEOVER,
            'rapid_order_creation': FraudType.ORDER_MANIPULATION,
            'unusual_order_amount': FraudType.ORDER_MANIPULATION,
            'suspicious_payment_method': FraudType.PAYMENT_FRAUD,
            'impossible_shipping': FraudType.IDENTITY_THEFT,
            'velocity_check': FraudType.COLLUSION
        }
        
        return fraud_type_mapping.get(rule_name, FraudType.UNUSUAL_PATTERN)
    
    def _get_triggered_fields(self, item: Dict[str, Any], rule_config: Dict[str, Any]) -> List[str]:
        """Get fields that triggered the rule"""
        triggered_fields = []
        
        for field, value in rule_config.items():
            if field in item and item[field] == value:
                triggered_fields.append(field)
        
        return triggered_fields


class AnomalyDetectionEngine:
    """Main anomaly detection and fraud detection engine"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.config = DetectionConfig()
        self.statistical_detector = StatisticalAnomalyDetector(self.config)
        self.ml_detector = MLAnomalyDetector(self.config)
        self.rule_detector = RuleBasedFraudDetector(self.config)
        self.models = {}
        
        # Load models if available
        self._load_models()
    
    def _load_models(self) -> None:
        """Load pre-trained models"""
        try:
            if self.redis:
                models_data = self.redis.get('anomaly_models:ml_models')
                if models_data:
                    self.models = pickle.loads(models_data)
                    logger.info("Loaded anomaly detection models from Redis")
                    
        except Exception as e:
            logger.error(f"Model loading error: {e}")
    
    def _save_models(self) -> None:
        """Save trained models to Redis"""
        try:
            if self.redis:
                models_data = pickle.dumps(self.models)
                self.redis.setex('anomaly_models:ml_models', 86400, models_data)
                logger.info("Saved anomaly detection models to Redis")
                
        except Exception as e:
            logger.error(f"Model saving error: {e}")
    
    def train_ml_models(self, data: List[Dict[str, Any]], feature_fields: List[str]) -> Dict[str, Any]:
        """Train ML models for anomaly detection"""
        logger.info("Training ML anomaly detection models...")
        
        results = {}
        
        # Train Isolation Forest
        isolation_result = self.ml_detector.train_isolation_forest(data, feature_fields)
        results['isolation_forest'] = isolation_result
        
        # Train DBSCAN
        dbscan_result = self.ml_detector.train_dbscan_clustering(data, feature_fields)
        results['dbscan'] = dbscan_result
        
        # Store models
        self.models = results
        self._save_models()
        
        return results
    
    def detect_anomalies(self, data: List[Dict[str, Any]], detection_types: List[AnomalyType] = None) -> List[AnomalyAlert]:
        """Detect anomalies using multiple methods"""
        if detection_types is None:
            detection_types = [AnomalyType.STATISTICAL, AnomalyType.MACHINE_LEARNING, AnomalyType.RULE_BASED]
        
        all_alerts = []
        
        # Statistical detection
        if AnomalyType.STATISTICAL in detection_types:
            # Detect anomalies for numeric fields
            numeric_fields = ['order_amount', 'quantity', 'price', 'rating']
            for field in numeric_fields:
                try:
                    alerts = self.statistical_detector.detect_anomalies(data, field)
                    all_alerts.extend(alerts)
                except Exception as e:
                    logger.error(f"Statistical anomaly detection error for {field}: {e}")
        
        # Machine learning detection
        if AnomalyType.MACHINE_LEARNING in detection_types:
            if self.models:
                for model_name, model_info in self.models.items():
                    if 'error' not in model_info:
                        try:
                            alerts = self.ml_detector.detect_anomalies(data, model_info)
                            all_alerts.extend(alerts)
                        except Exception as e:
                            logger.error(f"ML anomaly detection error for {model_name}: {e}")
        
        # Rule-based fraud detection
        if AnomalyType.RULE_BASED in detection_types:
            try:
                alerts = self.rule_detector.detect_fraud(data)
                all_alerts.extend(alerts)
            except Exception as e:
                logger.error(f"Rule-based fraud detection error: {e}")
        
        # Remove duplicates and sort by confidence
        unique_alerts = {}
        for alert in all_alerts:
            key = f"{alert.entity_id}_{alert.anomaly_type}_{alert.fraud_type}"
            if key not in unique_alerts or alert.confidence_score > unique_alerts[key].confidence_score:
                unique_alerts[key] = alert
        
        return sorted(unique_alerts.values(), key=lambda x: x.confidence_score, reverse=True)
    
    def create_alert(self, alert: AnomalyAlert) -> bool:
        """Create and store anomaly alert"""
        try:
            # Store in Redis
            if self.redis:
                alert_data = {
                    'alert_id': alert.alert_id,
                    'anomaly_type': alert.anomaly_type.value,
                    'fraud_type': alert.fraud_type.value if alert.fraud_type else None,
                    'severity': alert.severity.value,
                    'title': alert.title,
                    'description': alert.description,
                    'entity_id': alert.entity_id,
                    'entity_type': alert.entity_type,
                    'detected_at': alert.detected_at.isoformat(),
                    'confidence_score': alert.confidence_score,
                    'features': alert.features,
                    'metadata': alert.metadata,
                    'is_resolved': alert.is_resolved,
                    'resolved_at': alert.resolved_at.isoformat() if alert.resolved_at else None
                }
                
                # Store alert
                alert_key = f"anomaly_alerts:{alert.detected_at.strftime('%Y%m%d')}"
                self.redis.lpush(alert_key, json.dumps(alert_data))
                self.redis.expire(alert_key, 86400 * 30)  # 30 days TTL
                
                # Store by entity for quick lookup
                entity_key = f"entity_alerts:{alert.entity_type}:{alert.entity_id}"
                self.redis.setex(entity_key, 86400 * 7, json.dumps(alert_data))  # 7 days TTL
                
                logger.info(f"Created anomaly alert: {alert.alert_id}")
                return True
                
        except Exception as e:
            logger.error(f"Alert creation error: {e}")
            return False
    
    def get_alerts(self, 
                   entity_type: Optional[str] = None,
                   entity_id: Optional[str] = None,
                   severity: Optional[AnomalySeverity] = None,
                   days_back: int = 7) -> List[Dict[str, Any]]:
        """Get anomaly alerts with filters"""
        alerts = []
        
        if self.redis:
            try:
                # Get recent alerts
                current_date = datetime.now(timezone.utc)
                
                for days_ago in range(days_back):
                    search_date = current_date - timedelta(days=days_ago)
                    alert_key = f"anomaly_alerts:{search_date.strftime('%Y%m%d')}"
                    
                    if self.redis.exists(alert_key):
                        alert_data = self.redis.lrange(alert_key, 0, -1)
                        
                        for data in alert_data:
                            try:
                                alert = json.loads(data)
                                
                                # Apply filters
                                if entity_type and alert.get('entity_type') != entity_type:
                                    continue
                                
                                if entity_id and alert.get('entity_id') != entity_id:
                                    continue
                                
                                if severity and alert.get('severity') != severity.value:
                                    continue
                                
                                alerts.append(alert)
                                
                            except (json.JSONDecodeError, KeyError):
                                continue
                
            except Exception as e:
                logger.error(f"Alert retrieval error: {e}")
        
        # Sort by detection date
        alerts.sort(key=lambda x: x.get('detected_at', ''), reverse=True)
        
        return alerts
    
    def resolve_alert(self, alert_id: str, resolution_notes: str = "") -> bool:
        """Resolve an anomaly alert"""
        try:
            if self.redis:
                # Find and update alert
                current_date = datetime.now(timezone.utc)
                
                for days_ago in range(30):  # Search last 30 days
                    search_date = current_date - timedelta(days=days_ago)
                    alert_key = f"anomaly_alerts:{search_date.strftime('%Y%m%d')}"
                    
                    if self.redis.exists(alert_key):
                        alert_data = self.redis.lrange(alert_key, 0, -1)
                        
                        for i, data in enumerate(alert_data):
                            try:
                                alert = json.loads(data)
                                
                                if alert.get('alert_id') == alert_id:
                                    # Update alert
                                    alert['is_resolved'] = True
                                    alert['resolved_at'] = datetime.now(timezone.utc).isoformat()
                                    alert['resolution_notes'] = resolution_notes
                                    
                                    # Update in Redis
                                    self.redis.lset(alert_key, i, json.dumps(alert))
                                    
                                    # Update entity alert
                                    entity_key = f"entity_alerts:{alert.get('entity_type')}:{alert.get('entity_id')}"
                                    self.redis.setex(entity_key, 86400 * 7, json.dumps(alert))
                                    
                                    logger.info(f"Resolved anomaly alert: {alert_id}")
                                    return True
                                    
                            except (json.JSONDecodeError, KeyError):
                                continue
                
            logger.warning(f"Alert {alert_id} not found")
            return False
                
        except Exception as e:
            logger.error(f"Alert resolution error: {e}")
            return False


# Global anomaly detection engine instance
anomaly_detection_engine = AnomalyDetectionEngine()

# Export functions
def train_anomaly_models(data: List[Dict[str, Any]], feature_fields: List[str]) -> Dict[str, Any]:
    """Train anomaly detection models"""
    return anomaly_detection_engine.train_ml_models(data, feature_fields)

def detect_anomalies(data: List[Dict[str, Any]], detection_types: List[AnomalyType] = None) -> List[AnomalyAlert]:
    """Detect anomalies"""
    return anomaly_detection_engine.detect_anomalies(data, detection_types)

def create_anomaly_alert(alert: AnomalyAlert) -> bool:
    """Create anomaly alert"""
    return anomaly_detection_engine.create_alert(alert)

def get_anomaly_alerts(entity_type: Optional[str] = None, entity_id: Optional[str] = None,
                       severity: Optional[AnomalySeverity] = None, days_back: int = 7) -> List[Dict[str, Any]]:
    """Get anomaly alerts"""
    return anomaly_detection_engine.get_alerts(entity_type, entity_id, severity, days_back)

def resolve_anomaly_alert(alert_id: str, resolution_notes: str = "") -> bool:
    """Resolve anomaly alert"""
    return anomaly_detection_engine.resolve_alert(alert_id, resolution_notes)

# Export all components
__all__ = [
    'AnomalyType',
    'FraudType',
    'AnomalySeverity',
    'AnomalyAlert',
    'DetectionConfig',
    'StatisticalAnomalyDetector',
    'MLAnomalyDetector',
    'RuleBasedFraudDetector',
    'AnomalyDetectionEngine',
    'train_anomaly_models',
    'detect_anomalies',
    'create_anomaly_alert',
    'get_anomaly_alerts',
    'resolve_anomaly_alert',
    'anomaly_detection_engine',
]
