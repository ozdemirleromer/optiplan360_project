"""
Time Series Analysis and Trend Detection
Advanced time series analysis with trend detection, seasonality, and forecasting
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
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.stattools import adfuller, acf, pacf
from statsmodels.tsa.x13_arima import x13_arima_select_order
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class TrendType(Enum):
    """Trend types"""
    INCREASING = "increasing"
    DECREASING = "decreasing"
    STABLE = "stable"
    VOLATILE = "volatile"
    SEASONAL = "seasonal"
    CYCLICAL = "cyclical"


class SeasonalityType(Enum):
    """Seasonality types"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    NO_SEASONALITY = "no_seasonality"


class ForecastMethod(Enum):
    """Forecasting methods"""
    ARIMA = "arima"
    EXPONENTIAL_SMOOTHING = "exponential_smoothing"
    LINEAR_REGRESSION = "linear_regression"
    RANDOM_FOREST = "random_forest"
    PROPHET = "prophet"
    ENSEMBLE = "ensemble"


@dataclass
class TimeSeriesPoint:
    """Time series data point"""
    timestamp: datetime
    value: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TrendAnalysis:
    """Trend analysis result"""
    trend_type: TrendType
    trend_strength: float
    slope: float
    intercept: float
    r_squared: float
    p_value: float
    confidence_interval: Tuple[float, float]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SeasonalityAnalysis:
    """Seasonality analysis result"""
    seasonality_type: SeasonalityType
    seasonal_strength: float
    seasonal_period: int
    seasonal_components: List[float]
    trend_components: List[float]
    residual_components: List[float]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ForecastResult:
    """Forecast result"""
    forecast_id: str
    method: ForecastMethod
    forecast_values: List[float]
    confidence_intervals: List[Tuple[float, float]]
    timestamps: List[datetime]
    model_metrics: Dict[str, float]
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class TimeSeriesConfig:
    """Time series analysis configuration"""
    min_data_points: int = 30
    forecast_horizon: int = 30
    confidence_level: float = 0.95
    trend_detection_method: str = "linear_regression"
    seasonality_detection_method: str = "auto"
    outlier_detection: bool = True
    outlier_threshold: float = 3.0


class TrendDetector:
    """Trend detection and analysis"""
    
    def __init__(self, config: TimeSeriesConfig):
        self.config = config
        
    def detect_trend(self, data: List[TimeSeriesPoint]) -> TrendAnalysis:
        """Detect trend in time series"""
        if len(data) < self.config.min_data_points:
            return TrendAnalysis(
                trend_type=TrendType.STABLE,
                trend_strength=0.0,
                slope=0.0,
                intercept=0.0,
                r_squared=0.0,
                p_value=1.0,
                confidence_interval=(0.0, 0.0)
            )
        
        # Extract values and timestamps
        values = np.array([point.value for point in data])
        timestamps = np.array([point.timestamp.timestamp() for point in data])
        
        # Normalize timestamps
        timestamps_norm = (timestamps - timestamps[0]) / (timestamps[-1] - timestamps[0])
        
        # Linear regression
        slope, intercept, r_value, p_value, std_err = stats.linregress(timestamps_norm, values)
        r_squared = r_value ** 2
        
        # Determine trend type
        if abs(slope) < 0.01:
            trend_type = TrendType.STABLE
        elif slope > 0:
            trend_type = TrendType.INCREASING
        else:
            trend_type = TrendType.DECREASING
        
        # Calculate trend strength
        trend_strength = abs(r_squared)
        
        # Calculate confidence interval
        n = len(values)
        t_critical = stats.t.ppf(1 - (1 - self.config.confidence_level) / 2, n - 2)
        margin_error = t_critical * std_err * np.sqrt(1/n + (timestamps_norm.mean() ** 2) / np.sum((timestamps_norm - timestamps_norm.mean()) ** 2))
        
        confidence_interval = (slope - margin_error, slope + margin_error)
        
        return TrendAnalysis(
            trend_type=trend_type,
            trend_strength=trend_strength,
            slope=slope,
            intercept=intercept,
            r_squared=r_squared,
            p_value=p_value,
            confidence_interval=confidence_interval,
            metadata={
                'data_points': len(data),
                'time_span_days': (data[-1].timestamp - data[0].timestamp).days
            }
        )
    
    def detect_volatility(self, data: List[TimeSeriesPoint], window_size: int = 30) -> Dict[str, Any]:
        """Detect volatility patterns"""
        if len(data) < window_size:
            return {'volatility': 0.0, 'volatility_trend': 'stable'}
        
        values = np.array([point.value for point in data])
        
        # Calculate rolling volatility
        rolling_volatility = []
        for i in range(window_size, len(values)):
            window_data = values[i-window_size:i]
            volatility = np.std(window_data)
            rolling_volatility.append(volatility)
        
        if not rolling_volatility:
            return {'volatility': 0.0, 'volatility_trend': 'stable'}
        
        # Overall volatility
        overall_volatility = np.std(values)
        
        # Volatility trend
        if len(rolling_volatility) > 1:
            volatility_trend = np.polyfit(range(len(rolling_volatility)), rolling_volatility, 1)[0]
            if volatility_trend > 0.01:
                volatility_trend = 'increasing'
            elif volatility_trend < -0.01:
                volatility_trend = 'decreasing'
            else:
                volatility_trend = 'stable'
        else:
            volatility_trend = 'stable'
        
        return {
            'volatility': float(overall_volatility),
            'volatility_trend': volatility_trend,
            'rolling_volatility': rolling_volatility,
            'metadata': {
                'window_size': window_size,
                'data_points': len(values)
            }
        }


class SeasonalityDetector:
    """Seasonality detection and analysis"""
    
    def __init__(self, config: TimeSeriesConfig):
        self.config = config
        
    def detect_seasonality(self, data: List[TimeSeriesPoint]) -> SeasonalityAnalysis:
        """Detect seasonality in time series"""
        if len(data) < self.config.min_data_points * 2:
            return SeasonalityAnalysis(
                seasonality_type=SeasonalityType.NO_SEASONALITY,
                seasonal_strength=0.0,
                seasonal_period=0,
                seasonal_components=[],
                trend_components=[],
                residual_components=[]
            )
        
        # Create pandas Series
        values = [point.value for point in data]
        timestamps = [point.timestamp for point in data]
        ts = pd.Series(values, index=timestamps)
        
        # Decompose time series
        try:
            # Try different seasonal periods
            best_period = self._find_best_period(ts)
            
            if best_period > 0:
                decomposition = seasonal_decompose(ts, model='additive', period=best_period)
                
                seasonal_components = decomposition.seasonal.tolist()
                trend_components = decomposition.trend.tolist()
                residual_components = decomposition.resid.tolist()
                
                # Calculate seasonal strength
                seasonal_strength = self._calculate_seasonal_strength(seasonal_components, residual_components)
                
                # Determine seasonality type
                seasonality_type = self._determine_seasonality_type(best_period)
                
                return SeasonalityAnalysis(
                    seasonality_type=seasonality_type,
                    seasonal_strength=seasonal_strength,
                    seasonal_period=best_period,
                    seasonal_components=seasonal_components,
                    trend_components=trend_components,
                    residual_components=residual_components,
                    metadata={
                        'decomposition_method': 'additive',
                        'period': best_period
                    }
                )
            else:
                return SeasonalityAnalysis(
                    seasonality_type=SeasonalityType.NO_SEASONALITY,
                    seasonal_strength=0.0,
                    seasonal_period=0,
                    seasonal_components=[],
                    trend_components=[],
                    residual_components=[]
                )
                
        except Exception as e:
            logger.error(f"Seasonality detection error: {e}")
            return SeasonalityAnalysis(
                seasonality_type=SeasonalityType.NO_SEASONALITY,
                seasonal_strength=0.0,
                seasonal_period=0,
                seasonal_components=[],
                trend_components=[],
                residual_components=[]
            )
    
    def _find_best_period(self, ts: pd.Series) -> int:
        """Find best seasonal period"""
        if len(ts) < 24:
            return 0
        
        # Test common periods
        periods = [7, 12, 24, 30, 52, 365]  # Weekly, monthly, etc.
        best_period = 0
        best_strength = 0
        
        for period in periods:
            if len(ts) >= 2 * period:
                try:
                    decomposition = seasonal_decompose(ts, period=period)
                    seasonal_strength = self._calculate_seasonal_strength(
                        decomposition.seasonal.tolist(), 
                        decomposition.resid.tolist()
                    )
                    
                    if seasonal_strength > best_strength:
                        best_strength = seasonal_strength
                        best_period = period
                        
                except Exception:
                    continue
        
        return best_period
    
    def _calculate_seasonal_strength(self, seasonal: List[float], residual: List[float]) -> float:
        """Calculate seasonal strength"""
        if not seasonal or not residual:
            return 0.0
        
        seasonal_var = np.var(seasonal)
        residual_var = np.var(residual)
        
        if residual_var == 0:
            return 0.0
        
        return seasonal_var / (seasonal_var + residual_var)
    
    def _determine_seasonality_type(self, period: int) -> SeasonalityType:
        """Determine seasonality type based on period"""
        if period == 7:
            return SeasonalityType.WEEKLY
        elif period == 30:
            return SeasonalityType.MONTHLY
        elif period == 90:
            return SeasonalityType.QUARTERLY
        elif period == 365:
            return SeasonalityType.YEARLY
        else:
            return SeasonalityType.NO_SEASONALITY


class TimeSeriesForecaster:
    """Time series forecasting service"""
    
    def __init__(self, config: TimeSeriesConfig):
        self.config = config
        self.models = {}
        
    def train_arima_model(self, data: List[TimeSeriesPoint]) -> Dict[str, Any]:
        """Train ARIMA model"""
        try:
            values = [point.value for point in data]
            
            # Check stationarity
            adf_result = adfuller(values)
            is_stationary = adf_result[1] <= 0.05
            
            # Determine ARIMA order
            if not is_stationary:
                # Difference the series
                diff_values = np.diff(values)
                adf_result = adfuller(diff_values)
            
            # Auto ARIMA order selection
            try:
                order = x13_arima_select_order(values)
                p, d, q = order.order
            except:
                # Fallback to simple order
                p, d, q = 1, 1, 1
            
            # Fit ARIMA model
            model = ARIMA(values, order=(p, d, q))
            fitted_model = model.fit()
            
            # Make predictions
            forecast = fitted_model.forecast(steps=self.config.forecast_horizon)
            
            # Get confidence intervals
            forecast_result = fitted_model.get_forecast(steps=self.config.forecast_horizon)
            confidence_intervals = forecast_result.conf_int()
            
            return {
                'model': fitted_model,
                'order': (p, d, q),
                'forecast': forecast.tolist(),
                'confidence_intervals': confidence_intervals.tolist(),
                'aic': fitted_model.aic,
                'bic': fitted_model.bic,
                'is_stationary': is_stationary
            }
            
        except Exception as e:
            logger.error(f"ARIMA model training error: {e}")
            return {}
    
    def train_exponential_smoothing(self, data: List[TimeSeriesPoint]) -> Dict[str, Any]:
        """Train exponential smoothing model"""
        try:
            values = [point.value for point in data]
            
            # Fit model
            model = ExponentialSmoothing(values, trend='add', seasonal='add')
            fitted_model = model.fit()
            
            # Make predictions
            forecast = fitted_model.forecast(steps=self.config.forecast_horizon)
            
            return {
                'model': fitted_model,
                'forecast': forecast.tolist(),
                'confidence_intervals': [],  # Not easily available
                'sse': fitted_model.sse
            }
            
        except Exception as e:
            logger.error(f"Exponential smoothing error: {e}")
            return {}
    
    def train_linear_regression(self, data: List[TimeSeriesPoint]) -> Dict[str, Any]:
        """Train linear regression model"""
        try:
            # Prepare features
            X = []
            y = []
            
            for i, point in enumerate(data):
                features = [
                    i,  # Time index
                    point.value if i > 0 else 0,  # Previous value
                    np.mean([p.value for p in data[max(0, i-7):i]]) if i > 7 else point.value,  # 7-day moving average
                    np.mean([p.value for p in data[max(0, i-30):i]]) if i > 30 else point.value  # 30-day moving average
                ]
                X.append(features)
                y.append(point.value)
            
            X = np.array(X)
            y = np.array(y)
            
            # Train model
            model = LinearRegression()
            model.fit(X, y)
            
            # Make predictions
            last_features = [len(data), data[-1].value, 
                             np.mean([p.value for p in data[-7:]]),
                             np.mean([p.value for p in data[-30:]])]
            
            X_pred = np.array([last_features])
            forecast = model.predict(X_pred)
            
            # Generate future forecasts
            forecasts = [forecast[0]]
            for i in range(1, self.config.forecast_horizon):
                next_features = [len(data) + i, forecasts[-1],
                                 np.mean(forecasts[-7:]) if len(forecasts) >= 7 else forecasts[-1],
                                 np.mean(forecasts[-30:]) if len(forecasts) >= 30 else forecasts[-1]]
                next_pred = model.predict(np.array([next_features]))
                forecasts.append(next_pred[0])
            
            return {
                'model': model,
                'forecast': forecasts,
                'confidence_intervals': [],
                'r_squared': model.score(X, y)
            }
            
        except Exception as e:
            logger.error(f"Linear regression error: {e}")
            return {}
    
    def train_random_forest(self, data: List[TimeSeriesPoint]) -> Dict[str, Any]:
        """Train Random Forest model"""
        try:
            # Prepare features
            X = []
            y = []
            
            for i, point in enumerate(data):
                features = [
                    i,  # Time index
                    point.value if i > 0 else 0,  # Previous value
                    np.mean([p.value for p in data[max(0, i-7):i]]) if i > 7 else point.value,  # 7-day moving average
                    np.mean([p.value for p in data[max(0, i-30):i]]) if i > 30 else point.value, # 30-day moving average
                    self._get_seasonal_features(i, len(data))  # Seasonal features
                ]
                X.append(features)
                y.append(point.value)
            
            X = np.array(X)
            y = np.array(y)
            
            # Train model
            model = RandomForestRegressor(n_estimators=100, random_state=42)
            model.fit(X, y)
            
            # Make predictions
            last_features = [len(data), data[-1].value,
                             np.mean([p.value for p in data[-7:]]),
                             np.mean([p.value for p in data[-30:]]),
                             self._get_seasonal_features(len(data), len(data))]
            
            X_pred = np.array([last_features])
            forecast = model.predict(X_pred)
            
            # Generate future forecasts
            forecasts = [forecast[0]]
            for i in range(1, self.config.forecast_horizon):
                next_features = [len(data) + i, forecasts[-1],
                                 np.mean(forecasts[-7:]) if len(forecasts) >= 7 else forecasts[-1],
                                 np.mean(forecasts[-30:]) if len(forecasts) >= 30 else forecasts[-1],
                                 self._get_seasonal_features(len(data) + i, len(data))]
                next_pred = model.predict(np.array([next_features]))
                forecasts.append(next_pred[0])
            
            return {
                'model': model,
                'forecast': forecasts,
                'confidence_intervals': [],
                'feature_importance': model.feature_importances_.tolist()
            }
            
        except Exception as e:
            logger.error(f"Random Forest error: {e}")
            return {}
    
    def _get_seasonal_features(self, index: int, total_length: int) -> List[float]:
        """Get seasonal features"""
        # Simple seasonal features (day of week, month, etc.)
        features = []
        
        # Day of week (0-6)
        features.append((index % 7) / 7.0)
        
        # Month (0-11)
        features.append((index % 365) / 30.0)
        
        # Quarter (0-3)
        features.append((index % 365) / 91.0)
        
        return features
    
    def ensemble_forecast(self, data: List[TimeSeriesPoint]) -> Dict[str, Any]:
        """Ensemble forecasting combining multiple methods"""
        forecasts = {}
        
        # Train individual models
        arima_result = self.train_arima_model(data)
        exp_smooth_result = self.train_exponential_smoothing(data)
        linear_result = self.train_linear_regression(data)
        rf_result = self.train_random_forest(data)
        
        # Collect forecasts
        if arima_result:
            forecasts['arima'] = arima_result['forecast']
        if exp_smooth_result:
            forecasts['exponential_smoothing'] = exp_smooth_result['forecast']
        if linear_result:
            forecasts['linear_regression'] = linear_result['forecast']
        if rf_result:
            forecasts['random_forest'] = rf_result['forecast']
        
        if not forecasts:
            return {}
        
        # Simple ensemble (average)
        min_length = min(len(f) for f in forecasts.values())
        ensemble_forecast = []
        
        for i in range(min(min_length, self.config.forecast_horizon)):
            values = [f[i] for f in forecasts.values() if i < len(f)]
            ensemble_forecast.append(np.mean(values))
        
        return {
            'forecast': ensemble_forecast,
            'individual_forecasts': forecasts,
            'ensemble_method': 'simple_average'
        }


class TimeSeriesAnalysisService:
    """Main time series analysis service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.config = TimeSeriesConfig()
        self.trend_detector = TrendDetector(self.config)
        self.seasonality_detector = SeasonalityDetector(self.config)
        self.forecaster = TimeSeriesForecaster(self.config)
        self.models = {}
        
        # Load models if available
        self._load_models()
    
    def _load_models(self) -> None:
        """Load pre-trained models"""
        try:
            if self.redis:
                models_data = self.redis.get('timeseries_models:all_models')
                if models_data:
                    self.models = pickle.loads(models_data)
                    logger.info("Loaded time series models from Redis")
                    
        except Exception as e:
            logger.error(f"Model loading error: {e}")
    
    def _save_models(self) -> None:
        """Save trained models to Redis"""
        try:
            if self.redis:
                models_data = pickle.dumps(self.models)
                self.redis.setex('timeseries_models:all_models', 86400, models_data)
                logger.info("Saved time series models to Redis")
                
        except Exception as e:
            logger.error(f"Model saving error: {e}")
    
    def analyze_time_series(self, data: List[TimeSeriesPoint], analysis_type: str = 'full') -> Dict[str, Any]:
        """Perform comprehensive time series analysis"""
        results = {}
        
        if analysis_type in ['full', 'trend']:
            results['trend'] = self.trend_detector.detect_trend(data)
            results['volatility'] = self.trend_detector.detect_volatility(data)
        
        if analysis_type in ['full', 'seasonality']:
            results['seasonality'] = self.seasonality_detector.detect_seasonality(data)
        
        if analysis_type == 'full':
            # Combine results
            if 'trend' in results and 'seasonality' in results:
                results['summary'] = {
                    'trend_direction': results['trend'].trend_type.value,
                    'trend_strength': results['trend'].trend_strength,
                    'seasonality_present': results['seasonality'].seasonality_type != SeasonalityType.NO_SEASONALITY,
                    'seasonality_type': results['seasonality'].seasonality_type.value if results['seasonality'].seasonality_type != SeasonalityType.NO_SEASONALITY else None,
                    'data_points': len(data),
                    'time_span_days': (data[-1].timestamp - data[0].timestamp).days if len(data) > 1 else 0
                }
        
        return results
    
    def forecast_time_series(self, data: List[TimeSeriesPoint], method: ForecastMethod = ForecastMethod.ENSEMBLE, horizon: int = None) -> Dict[str, Any]:
        """Forecast time series"""
        if horizon:
            self.config.forecast_horizon = horizon
        
        if len(data) < self.config.min_data_points:
            return {'error': 'Insufficient data for forecasting'}
        
        # Generate future timestamps
        last_timestamp = data[-1].timestamp
        if method == ForecastMethod.DAILY:
            future_timestamps = [last_timestamp + timedelta(days=i+1) for i in range(self.config.forecast_horizon)]
        elif method == ForecastMethod.WEEKLY:
            future_timestamps = [last_timestamp + timedelta(weeks=i+1) for i in range(self.config.forecast_horizon)]
        elif method == ForecastMethod.MONTHLY:
            future_timestamps = [last_timestamp + timedelta(days=30*(i+1)) for i in range(self.config.forecast_horizon)]
        else:
            future_timestamps = [last_timestamp + timedelta(days=i+1) for i in range(self.config.forecast_horizon)]
        
        # Perform forecasting
        if method == ForecastMethod.ARIMA:
            result = self.forecaster.train_arima_model(data)
        elif method == ForecastMethod.EXPONENTIAL_SMOOTHING:
            result = self.forecaster.train_exponential_smoothing(data)
        elif method == ForecastMethod.LINEAR_REGRESSION:
            result = self.forecaster.train_linear_regression(data)
        elif method == ForecastMethod.RANDOM_FOREST:
            result = self.forecaster.train_random_forest(data)
        elif method == ForecastMethod.ENSEMBLE:
            result = self.forecaster.ensemble_forecast(data)
        else:
            return {'error': f'Unknown forecasting method: {method}'}
        
        if not result:
            return {'error': 'Forecasting failed'}
        
        # Create forecast result
        forecast_result = ForecastResult(
            forecast_id=f"forecast_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            method=method,
            forecast_values=result['forecast'],
            confidence_intervals=result.get('confidence_intervals', []),
            timestamps=future_timestamps,
            model_metrics={
                'method': method.value,
                'data_points': len(data),
                'horizon': self.config.forecast_horizon
            },
            metadata={
                'model_details': result
            }
        )
        
        return {
            'forecast_id': forecast_result.forecast_id,
            'method': forecast_result.method.value,
            'forecast_values': forecast_result.forecast_values,
            'confidence_intervals': forecast_result.confidence_intervals,
            'timestamps': [ts.isoformat() for ts in forecast_result.timestamps],
            'model_metrics': forecast_result.model_metrics,
            'created_at': forecast_result.created_at.isoformat()
        }
    
    def detect_anomalies(self, data: List[TimeSeriesPoint], method: str = 'statistical') -> List[Dict[str, Any]]:
        """Detect anomalies in time series"""
        if len(data) < self.config.min_data_points:
            return []
        
        values = np.array([point.value for point in data])
        anomalies = []
        
        if method == 'statistical':
            # Z-score based anomaly detection
            mean = np.mean(values)
            std = np.std(values)
            
            for i, point in enumerate(data):
                z_score = abs((point.value - mean) / std) if std > 0 else 0
                
                if z_score > self.config.outlier_threshold:
                    anomalies.append({
                        'index': i,
                        'timestamp': point.timestamp.isoformat(),
                        'value': point.value,
                        'z_score': z_score,
                        'anomaly_type': 'statistical_outlier'
                    })
        
        elif method == 'rolling':
            # Rolling window based anomaly detection
            window_size = min(30, len(data) // 3)
            
            for i in range(window_size, len(data)):
                window_values = values[i-window_size:i]
                window_mean = np.mean(window_values)
                window_std = np.std(window_values)
                
                current_value = values[i]
                z_score = abs((current_value - window_mean) / window_std) if window_std > 0 else 0
                
                if z_score > self.config.outlier_threshold:
                    anomalies.append({
                        'index': i,
                        'timestamp': data[i].timestamp.isoformat(),
                        'value': current_value,
                        'z_score': z_score,
                        'anomaly_type': 'rolling_outlier',
                        'window_size': window_size
                    })
        
        return anomalies
    
    def generate_insights(self, data: List[TimeSeriesPoint], analysis_results: Dict[str, Any]) -> List[str]:
        """Generate insights from time series analysis"""
        insights = []
        
        # Trend insights
        if 'trend' in analysis_results:
            trend = analysis_results['trend']
            if trend.trend_type == TrendType.INCREASING:
                insights.append(f"Series shows increasing trend with strength {trend.trend_strength:.2f}")
            elif trend.trend_type == TrendType.DECREASING:
                insights.append(f"Series shows decreasing trend with strength {trend.trend_strength:.2f}")
            elif trend.trend_type == TrendType.VOLATILE:
                insights.append("Series shows high volatility - consider risk management")
        
        # Seasonality insights
        if 'seasonality' in analysis_results:
            seasonality = analysis_results['seasonality']
            if seasonality.seasonality_type != SeasonalityType.NO_SEASONALITY:
                insights.append(f"Strong {seasonality.seasonality_type.value} seasonality detected with period {seasonality.seasonal_period}")
                insights.append(f"Seasonal strength: {seasonality.seasonal_strength:.2f}")
        
        # Volatility insights
        if 'volatility' in analysis_results:
            volatility = analysis_results['volatility']
            if volatility['volatility_trend'] == 'increasing':
                insights.append("Volatility is increasing - potential instability ahead")
            elif volatility['volatility'] > 0.2:
                insights.append("High volatility detected - risk management recommended")
        
        # Data quality insights
        if len(data) > 0:
            values = [point.value for point in data]
            missing_data_ratio = 0  # Would need to check for null values
            
            if missing_data_ratio > 0.1:
                insights.append(f"High missing data ratio: {missing_data_ratio:.1%}")
            
            # Check for data gaps
            if len(data) > 1:
                time_diffs = [(data[i+1].timestamp - data[i].timestamp).total_seconds() 
                             for i in range(len(data)-1)]
                avg_diff = np.mean(time_diffs)
                max_diff = max(time_diffs)
                
                if max_diff > 2 * avg_diff:
                    insights.append("Data gaps detected - consider data collection improvements")
        
        return insights


# Global time series analysis service instance
timeseries_analysis_service = TimeSeriesAnalysisService()

# Export functions
def analyze_time_series(data: List[TimeSeriesPoint], analysis_type: str = 'full') -> Dict[str, Any]:
    """Perform comprehensive time series analysis"""
    return timeseries_analysis_service.analyze_time_series(data, analysis_type)

def forecast_time_series(data: List[TimeSeriesPoint], method: ForecastMethod = ForecastMethod.ENSEMBLE, horizon: int = None) -> Dict[str, Any]:
    """Forecast time series"""
    return timeseries_analysis_service.forecast_time_series(data, method, horizon)

def detect_timeseries_anomalies(data: List[TimeSeriesPoint], method: str = 'statistical') -> List[Dict[str, Any]]:
    """Detect anomalies in time series"""
    return timeseries_analysis_service.detect_anomalies(data, method)

def generate_timeseries_insights(data: List[TimeSeriesPoint], analysis_results: Dict[str, Any]) -> List[str]:
    """Generate insights from time series analysis"""
    return timeseries_analysis_service.generate_insights(data, analysis_results)

# Export all components
__all__ = [
    'TrendType',
    'SeasonalityType',
    'ForecastMethod',
    'TimeSeriesPoint',
    'TrendAnalysis',
    'SeasonalityAnalysis',
    'ForecastResult',
    'TimeSeriesConfig',
    'TrendDetector',
    'SeasonalityDetector',
    'TimeSeriesForecaster',
    'TimeSeriesAnalysisService',
    'analyze_time_series',
    'forecast_time_series',
    'detect_timeseries_anomalies',
    'generate_timeseries_insights',
    'timeseries_analysis_service',
]
