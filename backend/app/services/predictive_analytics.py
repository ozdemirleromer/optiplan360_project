"""
Predictive Analytics and Forecasting Engine
Advanced predictive analytics with time series forecasting, demand prediction, and business intelligence
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
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split, cross_val_score
import joblib
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.holtwinters import ExponentialSmoothing
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class PredictionType(Enum):
    """Prediction types"""
    DEMAND_FORECAST = "demand_forecast"
    SALES_FORECAST = "sales_forecast"
    INVENTORY_PREDICTION = "inventory_prediction"
    CUSTOMER_CHURN = "customer_churn"
    PRICE_OPTIMIZATION = "price_optimization"
    PRODUCTION_PLANNING = "production_planning"
    RESOURCE_ALLOCATION = "resource_allocation"


class ForecastingMethod(Enum):
    """Forecasting methods"""
    ARIMA = "arima"
    EXPONENTIAL_SMOOTHING = "exponential_smoothing"
    LINEAR_REGRESSION = "linear_regression"
    RANDOM_FOREST = "random_forest"
    GRADIENT_BOOSTING = "gradient_boosting"
    ENSEMBLE = "ensemble"


@dataclass
class PredictionResult:
    """Prediction result"""
    prediction_id: str
    prediction_type: PredictionType
    target_variable: str
    predicted_values: List[float]
    confidence_intervals: List[Tuple[float, float]]
    timestamps: List[datetime]
    model_name: str
    accuracy_metrics: Dict[str, float]
    feature_importance: Optional[Dict[str, float]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class TimeSeriesData:
    """Time series data structure"""
    timestamps: List[datetime]
    values: List[float]
    features: Optional[Dict[str, List[float]]] = None
    frequency: str = "daily"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ModelConfig:
    """Model configuration"""
    model_type: ForecastingMethod
    parameters: Dict[str, Any] = field(default_factory=dict)
    training_window_days: int = 365
    forecast_horizon_days: int = 30
    validation_split: float = 0.2
    cross_validation_folds: int = 5
    retrain_frequency_hours: int = 24
    min_training_samples: int = 50


class TimeSeriesForecaster:
    """Time series forecasting engine"""
    
    def __init__(self, config: ModelConfig):
        self.config = config
        self.models = {}
        self.scalers = {}
        self.encoders = {}
        
    def prepare_data(self, data: TimeSeriesData) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare time series data for modeling"""
        # Convert to pandas DataFrame
        df = pd.DataFrame({
            'timestamp': data.timestamps,
            'value': data.values
        })
        
        if data.features:
            for feature_name, feature_values in data.features.items():
                df[feature_name] = feature_values
        
        # Create time-based features
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df['year'] = df['timestamp'].dt.year
        df['month'] = df['timestamp'].dt.month
        df['day'] = df['timestamp'].dt.day
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['day_of_year'] = df['timestamp'].dt.dayofyear
        df['quarter'] = df['timestamp'].dt.quarter
        
        # Create lag features
        for lag in [1, 7, 30]:
            df[f'lag_{lag}'] = df['value'].shift(lag)
        
        # Create rolling features
        for window in [7, 30]:
            df[f'rolling_mean_{window}'] = df['value'].rolling(window=window).mean()
            df[f'rolling_std_{window}'] = df['value'].rolling(window=window).std()
        
        # Drop NaN values
        df = df.dropna()
        
        # Prepare features and target
        feature_columns = [col for col in df.columns if col not in ['timestamp', 'value']]
        X = df[feature_columns].values
        y = df['value'].values
        
        return X, y
    
    def train_arima_model(self, data: TimeSeriesData) -> Dict[str, Any]:
        """Train ARIMA model"""
        try:
            # Convert to pandas Series
            ts_data = pd.Series(data.values, index=pd.to_datetime(data.timestamps))
            
            # Fit ARIMA model
            model = ARIMA(ts_data, order=(1, 1, 1))
            fitted_model = model.fit()
            
            # Make predictions
            forecast_steps = self.config.forecast_horizon_days
            forecast = fitted_model.forecast(steps=forecast_steps)
            
            # Get confidence intervals
            forecast_result = fitted_model.get_forecast(steps=forecast_steps)
            confidence_intervals = forecast_result.conf_int()
            
            return {
                'model': fitted_model,
                'predictions': forecast.tolist(),
                'confidence_intervals': confidence_intervals.values.tolist(),
                'aic': fitted_model.aic,
                'bic': fitted_model.bic
            }
            
        except Exception as e:
            logger.error(f"ARIMA model training error: {e}")
            return {}
    
    def train_exponential_smoothing(self, data: TimeSeriesData) -> Dict[str, Any]:
        """Train exponential smoothing model"""
        try:
            # Convert to pandas Series
            ts_data = pd.Series(data.values, index=pd.to_datetime(data.timestamps))
            
            # Fit exponential smoothing model
            model = ExponentialSmoothing(ts_data, trend='add', seasonal='add', seasonal_periods=7)
            fitted_model = model.fit()
            
            # Make predictions
            forecast_steps = self.config.forecast_horizon_days
            forecast = fitted_model.forecast(steps=forecast_steps)
            
            return {
                'model': fitted_model,
                'predictions': forecast.tolist(),
                'confidence_intervals': [],  # Exponential smoothing doesn't provide CI easily
                'sse': fitted_model.sse
            }
            
        except Exception as e:
            logger.error(f"Exponential smoothing model training error: {e}")
            return {}
    
    def train_machine_learning_model(self, data: TimeSeriesData, model_type: str = 'random_forest') -> Dict[str, Any]:
        """Train machine learning model"""
        try:
            # Prepare data
            X, y = self.prepare_data(data)
            
            if len(X) < self.config.min_training_samples:
                logger.warning(f"Insufficient training samples: {len(X)}")
                return {}
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=self.config.validation_split, random_state=42
            )
            
            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # Train model
            if model_type == 'random_forest':
                model = RandomForestRegressor(
                    n_estimators=100,
                    random_state=42,
                    n_jobs=-1
                )
            elif model_type == 'gradient_boosting':
                model = GradientBoostingRegressor(
                    n_estimators=100,
                    random_state=42
                )
            else:  # linear_regression
                model = LinearRegression()
            
            model.fit(X_train_scaled, y_train)
            
            # Make predictions
            y_pred = model.predict(X_test_scaled)
            
            # Calculate metrics
            mae = mean_absolute_error(y_test, y_pred)
            mse = mean_squared_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            
            # Get feature importance
            feature_importance = None
            if hasattr(model, 'feature_importances_'):
                feature_names = [f'feature_{i}' for i in range(X.shape[1])]
                feature_importance = dict(zip(feature_names, model.feature_importances_))
            
            return {
                'model': model,
                'scaler': scaler,
                'predictions': y_pred.tolist(),
                'actual': y_test.tolist(),
                'metrics': {
                    'mae': mae,
                    'mse': mse,
                    'rmse': np.sqrt(mse),
                    'r2': r2
                },
                'feature_importance': feature_importance
            }
            
        except Exception as e:
            logger.error(f"ML model training error: {e}")
            return {}
    
    def forecast(self, data: TimeSeriesData, method: ForecastingMethod = ForecastingMethod.ENSEMBLE) -> Dict[str, Any]:
        """Generate forecast using specified method"""
        results = {}
        
        if method in [ForecastingMethod.ARIMA, ForecastingMethod.ENSEMBLE]:
            results['arima'] = self.train_arima_model(data)
        
        if method in [ForecastingMethod.EXPONENTIAL_SMOOTHING, ForecastingMethod.ENSEMBLE]:
            results['exponential_smoothing'] = self.train_exponential_smoothing(data)
        
        if method in [ForecastingMethod.RANDOM_FOREST, ForecastingMethod.ENSEMBLE]:
            results['random_forest'] = self.train_machine_learning_model(data, 'random_forest')
        
        if method in [ForecastingMethod.GRADIENT_BOOSTING, ForecastingMethod.ENSEMBLE]:
            results['gradient_boosting'] = self.train_machine_learning_model(data, 'gradient_boosting')
        
        if method in [ForecastingMethod.LINEAR_REGRESSION, ForecastingMethod.ENSEMBLE]:
            results['linear_regression'] = self.train_machine_learning_model(data, 'linear_regression')
        
        return results


class DemandForecaster:
    """Demand forecasting for inventory and production planning"""
    
    def __init__(self, config: ModelConfig):
        self.config = config
        self.forecaster = TimeSeriesForecaster(config)
        self.product_models = {}
        
    def train_product_demand_model(self, product_id: str, historical_data: TimeSeriesData) -> Dict[str, Any]:
        """Train demand model for specific product"""
        logger.info(f"Training demand model for product {product_id}")
        
        # Train multiple models
        results = self.forecaster.forecast(historical_data, ForecastingMethod.ENSEMBLE)
        
        # Select best model based on metrics
        best_model = None
        best_score = float('inf')
        
        for model_name, model_result in results.items():
            if 'metrics' in model_result:
                mae = model_result['metrics'].get('mae', float('inf'))
                if mae < best_score:
                    best_score = mae
                    best_model = model_name
        
        # Store model
        self.product_models[product_id] = {
            'best_model': best_model,
            'results': results,
            'trained_at': datetime.utcnow()
        }
        
        return self.product_models[product_id]
    
    def forecast_demand(self, product_id: str, days_ahead: int = 30) -> Dict[str, Any]:
        """Forecast demand for product"""
        if product_id not in self.product_models:
            return {'error': f'No model found for product {product_id}'}
        
        model_data = self.product_models[product_id]
        best_model_name = model_data['best_model']
        best_model_result = model_data['results'][best_model_name]
        
        if not best_model_result:
            return {'error': 'Model training failed'}
        
        # Generate forecast
        forecast_values = best_model_result.get('predictions', [])
        confidence_intervals = best_model_result.get('confidence_intervals', [])
        
        # Adjust for requested horizon
        if len(forecast_values) < days_ahead:
            # Pad with last known value if needed
            last_value = forecast_values[-1] if forecast_values else 0
            forecast_values.extend([last_value] * (days_ahead - len(forecast_values)))
        
        return {
            'product_id': product_id,
            'forecast_days': days_ahead,
            'predicted_demand': forecast_values[:days_ahead],
            'confidence_intervals': confidence_intervals[:days_ahead] if confidence_intervals else [],
            'model_used': best_model_name,
            'model_accuracy': best_model_result.get('metrics', {}),
            'forecast_date': datetime.utcnow()
        }


class PredictiveAnalytics:
    """Main predictive analytics service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.forecaster = TimeSeriesForecaster(ModelConfig())
        self.demand_forecaster = DemandForecaster(ModelConfig())
        self.models = {}
        
        # Load models if available
        self._load_models()
    
    def _load_models(self) -> None:
        """Load pre-trained models"""
        try:
            if self.redis:
                # Load time series models
                ts_models_data = self.redis.get('predictive_models:time_series')
                if ts_models_data:
                    self.models['time_series'] = pickle.loads(ts_models_data)
                    logger.info("Loaded time series models from Redis")
                
                # Load demand models
                demand_models_data = self.redis.get('predictive_models:demand')
                if demand_models_data:
                    self.demand_forecaster.product_models = pickle.loads(demand_models_data)
                    logger.info("Loaded demand models from Redis")
                    
        except Exception as e:
            logger.error(f"Model loading error: {e}")
    
    def _save_models(self) -> None:
        """Save trained models to Redis"""
        try:
            if self.redis:
                # Save time series models
                ts_models_data = pickle.dumps(self.models.get('time_series', {}))
                self.redis.setex('predictive_models:time_series', 86400, ts_models_data)
                
                # Save demand models
                demand_models_data = pickle.dumps(self.demand_forecaster.product_models)
                self.redis.setex('predictive_models:demand', 86400, demand_models_data)
                
                logger.info("Models saved to Redis")
                
        except Exception as e:
            logger.error(f"Model saving error: {e}")
    
    def train_sales_forecast_model(self, sales_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Train sales forecasting model"""
        logger.info("Training sales forecast model...")
        
        # Convert to time series data
        timestamps = [datetime.fromisoformat(item['date']) for item in sales_data]
        values = [item['sales_amount'] for item in sales_data]
        
        # Add features if available
        features = {}
        if sales_data and 'features' in sales_data[0]:
            for feature_name in sales_data[0]['features']:
                features[feature_name] = [item['features'][feature_name] for item in sales_data]
        
        ts_data = TimeSeriesData(
            timestamps=timestamps,
            values=values,
            features=features if features else None
        )
        
        # Train models
        results = self.forecaster.forecast(ts_data, ForecastingMethod.ENSEMBLE)
        
        # Store best model
        best_model = None
        best_score = float('inf')
        
        for model_name, model_result in results.items():
            if 'metrics' in model_result:
                mae = model_result['metrics'].get('mae', float('inf'))
                if mae < best_score:
                    best_score = mae
                    best_model = model_name
        
        self.models['sales_forecast'] = {
            'best_model': best_model,
            'results': results,
            'trained_at': datetime.utcnow()
        }
        
        # Save models
        self._save_models()
        
        return self.models['sales_forecast']
    
    def forecast_sales(self, days_ahead: int = 30) -> Dict[str, Any]:
        """Forecast sales for specified period"""
        if 'sales_forecast' not in self.models:
            return {'error': 'Sales forecast model not trained'}
        
        model_data = self.models['sales_forecast']
        best_model_name = model_data['best_model']
        best_model_result = model_data['results'][best_model_name]
        
        if not best_model_result:
            return {'error': 'Model training failed'}
        
        # Generate forecast
        forecast_values = best_model_result.get('predictions', [])
        confidence_intervals = best_model_result.get('confidence_intervals', [])
        
        # Generate future timestamps
        last_timestamp = datetime.utcnow()
        future_timestamps = [last_timestamp + timedelta(days=i) for i in range(1, days_ahead + 1)]
        
        return {
            'forecast_period_days': days_ahead,
            'predicted_sales': forecast_values[:days_ahead],
            'confidence_intervals': confidence_intervals[:days_ahead] if confidence_intervals else [],
            'timestamps': [ts.isoformat() for ts in future_timestamps],
            'model_used': best_model_name,
            'model_accuracy': best_model_result.get('metrics', {}),
            'forecast_date': datetime.utcnow().isoformat()
        }
    
    def train_demand_models(self, product_data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Train demand models for multiple products"""
        logger.info("Training demand models...")
        
        results = {}
        
        for product_id, historical_data in product_data.items():
            # Convert to time series data
            timestamps = [datetime.fromisoformat(item['date']) for item in historical_data]
            values = [item['demand'] for item in historical_data]
            
            ts_data = TimeSeriesData(timestamps=timestamps, values=values)
            
            # Train model
            model_result = self.demand_forecaster.train_product_demand_model(product_id, ts_data)
            results[product_id] = model_result
        
        # Save models
        self._save_models()
        
        return results
    
    def forecast_demand(self, product_id: str, days_ahead: int = 30) -> Dict[str, Any]:
        """Forecast demand for specific product"""
        return self.demand_forecaster.forecast_demand(product_id, days_ahead)
    
    def predict_customer_churn(self, customer_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Predict customer churn"""
        logger.info("Training customer churn model...")
        
        # Prepare data
        df = pd.DataFrame(customer_data)
        
        if len(df) < 50:
            return {'error': 'Insufficient data for churn prediction'}
        
        # Feature engineering
        features = []
        target = []
        
        for _, row in df.iterrows():
            feature_vector = [
                row.get('total_orders', 0),
                row.get('total_revenue', 0),
                row.get('avg_order_value', 0),
                row.get('days_since_last_order', 0),
                row.get('order_frequency', 0),
                row.get('customer_age_days', 0),
                row.get('support_tickets', 0),
                row.get('complaints', 0)
            ]
            features.append(feature_vector)
            target.append(row.get('churned', 0))
        
        X = np.array(features)
        y = np.array(target)
        
        # Train model
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        
        # Evaluate model
        y_pred = model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        # Feature importance
        feature_names = [
            'total_orders', 'total_revenue', 'avg_order_value', 'days_since_last_order',
            'order_frequency', 'customer_age_days', 'support_tickets', 'complaints'
        ]
        feature_importance = dict(zip(feature_names, model.feature_importances_))
        
        # Store model
        self.models['customer_churn'] = {
            'model': model,
            'accuracy': accuracy,
            'feature_importance': feature_importance,
            'trained_at': datetime.utcnow()
        }
        
        self._save_models()
        
        return {
            'model_accuracy': accuracy,
            'feature_importance': feature_importance,
            'trained_at': datetime.utcnow().isoformat()
        }
    
    def predict_churn_probability(self, customer_features: Dict[str, Any]) -> Dict[str, Any]:
        """Predict churn probability for specific customer"""
        if 'customer_churn' not in self.models:
            return {'error': 'Churn model not trained'}
        
        model = self.models['customer_churn']['model']
        
        # Prepare features
        feature_vector = [
            customer_features.get('total_orders', 0),
            customer_features.get('total_revenue', 0),
            customer_features.get('avg_order_value', 0),
            customer_features.get('days_since_last_order', 0),
            customer_features.get('order_frequency', 0),
            customer_features.get('customer_age_days', 0),
            customer_features.get('support_tickets', 0),
            customer_features.get('complaints', 0)
        ]
        
        # Predict
        churn_probability = model.predict_proba([feature_vector])[0][1]
        
        return {
            'churn_probability': float(churn_probability),
            'churn_risk': 'high' if churn_probability > 0.7 else 'medium' if churn_probability > 0.3 else 'low',
            'prediction_date': datetime.utcnow().isoformat()
        }
    
    def optimize_prices(self, product_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Optimize prices using predictive analytics"""
        logger.info("Training price optimization model...")
        
        # Prepare data
        df = pd.DataFrame(product_data)
        
        if len(df) < 30:
            return {'error': 'Insufficient data for price optimization'}
        
        features = []
        target = []
        
        for _, row in df.iterrows():
            feature_vector = [
                row.get('current_price', 0),
                row.get('cost', 0),
                row.get('demand', 0),
                row.get('competitor_price', 0),
                row.get('seasonality_factor', 1),
                row.get('product_quality_score', 1)
            ]
            features.append(feature_vector)
            target.append(row.get('optimal_price', row.get('current_price', 0)))
        
        X = np.array(features)
        y = np.array(target)
        
        # Train model
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        model = GradientBoostingRegressor(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        
        # Evaluate model
        y_pred = model.predict(X_test)
        mae = mean_absolute_error(y_test, y_pred)
        
        # Feature importance
        feature_names = [
            'current_price', 'cost', 'demand', 'competitor_price', 
            'seasonality_factor', 'product_quality_score'
        ]
        feature_importance = dict(zip(feature_names, model.feature_importances_))
        
        # Store model
        self.models['price_optimization'] = {
            'model': model,
            'mae': mae,
            'feature_importance': feature_importance,
            'trained_at': datetime.utcnow()
        }
        
        self._save_models()
        
        return {
            'model_mae': mae,
            'feature_importance': feature_importance,
            'trained_at': datetime.utcnow().isoformat()
        }
    
    def get_optimal_price(self, product_features: Dict[str, Any]) -> Dict[str, Any]:
        """Get optimal price for specific product"""
        if 'price_optimization' not in self.models:
            return {'error': 'Price optimization model not trained'}
        
        model = self.models['price_optimization']['model']
        
        # Prepare features
        feature_vector = [
            product_features.get('current_price', 0),
            product_features.get('cost', 0),
            product_features.get('demand', 0),
            product_features.get('competitor_price', 0),
            product_features.get('seasonality_factor', 1),
            product_features.get('product_quality_score', 1)
        ]
        
        # Predict optimal price
        optimal_price = model.predict([feature_vector])[0]
        
        # Calculate price range
        cost = product_features.get('cost', 0)
        min_price = cost * 1.1  # 10% margin minimum
        max_price = cost * 3.0  # 200% margin maximum
        
        optimal_price = max(min_price, min(optimal_price, max_price))
        
        return {
            'optimal_price': float(optimal_price),
            'price_range': {'min': min_price, 'max': max_price},
            'margin_percentage': ((optimal_price - cost) / cost * 100) if cost > 0 else 0,
            'prediction_date': datetime.utcnow().isoformat()
        }


# Global predictive analytics instance
predictive_analytics = PredictiveAnalytics()

# Export functions
def train_sales_forecast(sales_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Train sales forecasting model"""
    return predictive_analytics.train_sales_forecast_model(sales_data)

def forecast_sales(days_ahead: int = 30) -> Dict[str, Any]:
    """Forecast sales"""
    return predictive_analytics.forecast_sales(days_ahead)

def train_demand_models(product_data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    """Train demand models"""
    return predictive_analytics.train_demand_models(product_data)

def forecast_demand(product_id: str, days_ahead: int = 30) -> Dict[str, Any]:
    """Forecast demand for product"""
    return predictive_analytics.forecast_demand(product_id, days_ahead)

def train_churn_model(customer_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Train customer churn model"""
    return predictive_analytics.predict_customer_churn(customer_data)

def predict_churn_probability(customer_features: Dict[str, Any]) -> Dict[str, Any]:
    """Predict churn probability"""
    return predictive_analytics.predict_churn_probability(customer_features)

def train_price_optimization(product_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Train price optimization model"""
    return predictive_analytics.optimize_prices(product_data)

def get_optimal_price(product_features: Dict[str, Any]) -> Dict[str, Any]:
    """Get optimal price"""
    return predictive_analytics.get_optimal_price(product_features)

# Export all components
__all__ = [
    'PredictionType',
    'PredictionResult',
    'TimeSeriesData',
    'ModelConfig',
    'TimeSeriesForecaster',
    'DemandForecaster',
    'PredictiveAnalytics',
    'train_sales_forecast',
    'forecast_sales',
    'train_demand_models',
    'forecast_demand',
    'train_churn_model',
    'predict_churn_probability',
    'train_price_optimization',
    'get_optimal_price',
    'predictive_analytics',
]
