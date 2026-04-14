"""
Data Pipeline and Feature Engineering System
Advanced data processing pipeline with automated feature engineering and data quality management
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple, Union, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import redis
import pickle
import json
import hashlib
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, LabelEncoder, OneHotEncoder
from sklearn.feature_selection import SelectKBest, RFE, SelectFromModel, VarianceThreshold
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.decomposition import PCA, TruncatedSVD
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer, KNNImputer
import joblib
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class DataType(Enum):
    """Data types"""
    NUMERICAL = "numerical"
    CATEGORICAL = "categorical"
    TEXT = "text"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    ORDINAL = "ordinal"
    MIXED = "mixed"


class FeatureType(Enum):
    """Feature types"""
    NUMERICAL = "numerical"
    CATEGORICAL = "categorical"
    TEXT_DERIVED = "text_derived"
    TEMPORAL = "temporal"
    INTERACTION = "interaction"
    AGGREGATED = "aggregated"
    POLYNOMIAL = "polynomial"
    STATISTICAL = "statistical"


class PipelineStage(Enum):
    """Pipeline stages"""
    EXTRACTION = "extraction"
    CLEANING = "cleaning"
    TRANSFORMATION = "transformation"
    FEATURE_ENGINEERING = "feature_engineering"
    SELECTION = "selection"
    VALIDATION = "validation"
    OUTPUT = "output"


@dataclass
class DataQualityMetrics:
    """Data quality metrics"""
    total_rows: int
    total_columns: int
    missing_values: Dict[str, int]
    duplicate_rows: int
    data_types: Dict[str, str]
    outliers: Dict[str, int]
    completeness_score: float
    validity_score: float
    uniqueness_score: float
    overall_quality_score: float


@dataclass
class FeatureInfo:
    """Feature information"""
    name: str
    data_type: DataType
    feature_type: FeatureType
    missing_ratio: float
    unique_count: int
    cardinality: Optional[int] = None
    correlation_with_target: float = 0.0
    importance_score: float = 0.0
    is_selected: bool = True
    transformation_applied: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PipelineConfig:
    """Pipeline configuration"""
    input_source: str
    output_format: str
    target_column: Optional[str] = None
    feature_selection_method: str = "auto"
    max_features: int = 100
    handle_missing: str = "auto"
    handle_outliers: str = "auto"
    scale_features: bool = True
    create_interactions: bool = True
    create_polynomials: bool = True
    text_vectorization: str = "tfidf"
    dimensionality_reduction: Optional[str] = None
    validation_split: float = 0.2
    random_state: int = 42


class DataQualityAssessment:
    """Data quality assessment"""
    
    def __init__(self):
        self.metrics = None
        
    def assess_data_quality(self, df: pd.DataFrame) -> DataQualityMetrics:
        """Assess data quality"""
        try:
            total_rows, total_columns = df.shape
            
            # Missing values
            missing_values = df.isnull().sum().to_dict()
            missing_ratio = df.isnull().sum().sum() / (total_rows * total_columns)
            
            # Duplicate rows
            duplicate_rows = df.duplicated().sum()
            
            # Data types
            data_types = df.dtypes.astype(str).to_dict()
            
            # Outliers (IQR method)
            outliers = {}
            for column in df.select_dtypes(include=[np.number]).columns:
                Q1 = df[column].quantile(0.25)
                Q3 = df[column].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                outliers[column] = ((df[column] < lower_bound) | (df[column] > upper_bound)).sum()
            
            # Quality scores
            completeness_score = 1.0 - missing_ratio
            validity_score = 1.0 - (duplicate_rows / total_rows) if total_rows > 0 else 1.0
            uniqueness_score = 1.0 - (duplicate_rows / total_rows) if total_rows > 0 else 1.0
            overall_quality_score = (completeness_score + validity_score + uniqueness_score) / 3
            
            metrics = DataQualityMetrics(
                total_rows=total_rows,
                total_columns=total_columns,
                missing_values=missing_values,
                duplicate_rows=duplicate_rows,
                data_types=data_types,
                outliers=outliers,
                completeness_score=completeness_score,
                validity_score=validity_score,
                uniqueness_score=uniqueness_score,
                overall_quality_score=overall_quality_score
            )
            
            self.metrics = metrics
            return metrics
            
        except Exception as e:
            logger.error(f"Error in data quality assessment: {e}")
            raise


class DataCleaner:
    """Data cleaning utilities"""
    
    def __init__(self, config: PipelineConfig):
        self.config = config
        
    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean data based on configuration"""
        cleaned_df = df.copy()
        
        try:
            # Handle missing values
            cleaned_df = self._handle_missing_values(cleaned_df)
            
            # Handle outliers
            cleaned_df = self._handle_outliers(cleaned_df)
            
            # Handle duplicates
            cleaned_df = self._handle_duplicates(cleaned_df)
            
            # Handle data types
            cleaned_df = self._handle_data_types(cleaned_df)
            
            logger.info(f"Data cleaning completed. Shape: {cleaned_df.shape}")
            return cleaned_df
            
        except Exception as e:
            logger.error(f"Error in data cleaning: {e}")
            raise
    
    def _handle_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle missing values"""
        if self.config.handle_missing == "drop":
            return df.dropna()
        elif self.config.handle_missing == "auto":
            # Automatic imputation based on data type
            for column in df.columns:
                if df[column].isnull().any():
                    if df[column].dtype in ['object', 'category']:
                        # Categorical: mode imputation
                        mode_value = df[column].mode().iloc[0] if not df[column].mode().empty else 'unknown'
                        df[column].fillna(mode_value, inplace=True)
                    elif df[column].dtype in ['int64', 'float64']:
                        # Numerical: median imputation
                        median_value = df[column].median()
                        df[column].fillna(median_value, inplace=True)
                    elif df[column].dtype == 'bool':
                        # Boolean: False imputation
                        df[column].fillna(False, inplace=True)
                    elif 'datetime' in str(df[column].dtype):
                        # Datetime: forward fill
                        df[column].fillna(method='ffill', inplace=True)
        
        return df
    
    def _handle_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle outliers"""
        if self.config.handle_outliers == "auto":
            numeric_columns = df.select_dtypes(include=[np.number]).columns
            
            for column in numeric_columns:
                Q1 = df[column].quantile(0.25)
                Q3 = df[column].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                # Cap outliers
                df[column] = np.where(df[column] < lower_bound, lower_bound, df[column])
                df[column] = np.where(df[column] > upper_bound, upper_bound, df[column])
        
        return df
    
    def _handle_duplicates(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle duplicate rows"""
        return df.drop_duplicates()
    
    def _handle_data_types(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle data type conversions"""
        # Convert object columns to categorical if low cardinality
        for column in df.select_dtypes(include=['object']).columns:
            unique_ratio = df[column].nunique() / len(df)
            if unique_ratio < 0.5:  # Low cardinality
                df[column] = df[column].astype('category')
        
        return df


class FeatureEngineer:
    """Advanced feature engineering"""
    
    def __init__(self, config: PipelineConfig):
        self.config = config
        self.feature_info = {}
        
    def engineer_features(self, df: pd.DataFrame, target_column: Optional[str] = None) -> pd.DataFrame:
        """Engineer features from data"""
        engineered_df = df.copy()
        
        try:
            # Analyze features
            self.feature_info = self._analyze_features(engineered_df, target_column)
            
            # Numerical features
            engineered_df = self._engineer_numerical_features(engineered_df)
            
            # Categorical features
            engineered_df = self._engineer_categorical_features(engineered_df)
            
            # Temporal features
            engineered_df = self._engineer_temporal_features(engineered_df)
            
            # Text features
            engineered_df = self._engineer_text_features(engineered_df)
            
            # Interaction features
            if self.config.create_interactions:
                engineered_df = self._create_interaction_features(engineered_df)
            
            # Polynomial features
            if self.config.create_polynomials:
                engineered_df = self._create_polynomial_features(engineered_df)
            
            # Aggregated features
            engineered_df = self._create_aggregated_features(engineered_df)
            
            logger.info(f"Feature engineering completed. Shape: {engineered_df.shape}")
            return engineered_df
            
        except Exception as e:
            logger.error(f"Error in feature engineering: {e}")
            raise
    
    def _analyze_features(self, df: pd.DataFrame, target_column: Optional[str] = None) -> Dict[str, FeatureInfo]:
        """Analyze features and create feature info"""
        feature_info = {}
        
        for column in df.columns:
            # Determine data type
            if df[column].dtype in ['int64', 'float64']:
                data_type = DataType.NUMERICAL
            elif df[column].dtype == 'object':
                if df[column].nunique() < len(df) * 0.05:
                    data_type = DataType.CATEGORICAL
                else:
                    data_type = DataType.TEXT
            elif df[column].dtype == 'bool':
                data_type = DataType.BOOLEAN
            elif 'datetime' in str(df[column].dtype):
                data_type = DataType.DATETIME
            else:
                data_type = DataType.MIXED
            
            # Calculate basic statistics
            missing_ratio = df[column].isnull().sum() / len(df)
            unique_count = df[column].nunique()
            cardinality = unique_count if data_type == DataType.CATEGORICAL else None
            
            # Calculate correlation with target
            correlation = 0.0
            if target_column and target_column in df.columns:
                if data_type == DataType.NUMERICAL:
                    correlation = abs(df[column].corr(df[target_column]))
                elif data_type == DataType.CATEGORICAL:
                    # Point biserial correlation for categorical
                    try:
                        correlation = abs(stats.pointbiserialr(
                            df[column].astype('category').cat.codes,
                            df[target_column] if df[target_column].dtype in ['int64', 'float64'] else df[target_column].astype('category').cat.codes
                        )[0])
                    except:
                        correlation = 0.0
            
            feature_info[column] = FeatureInfo(
                name=column,
                data_type=data_type,
                feature_type=FeatureType.NUMERICAL if data_type == DataType.NUMERICAL else FeatureType.CATEGORICAL,
                missing_ratio=missing_ratio,
                unique_count=unique_count,
                cardinality=cardinality,
                correlation_with_target=correlation
            )
        
        return feature_info
    
    def _engineer_numerical_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Engineer numerical features"""
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        
        for column in numeric_columns:
            if column in self.feature_info:
                # Log transformation
                if (df[column] > 0).all():
                    df[f'{column}_log'] = np.log1p(df[column])
                    self.feature_info[column].transformation_applied = 'log'
                
                # Square root transformation
                if (df[column] >= 0).all():
                    df[f'{column}_sqrt'] = np.sqrt(df[column])
                
                # Binning
                df[f'{column}_binned'] = pd.cut(df[column], bins=5, labels=False)
                
                # Rolling statistics (simplified)
                if len(df) > 10:
                    df[f'{column}_rolling_mean'] = df[column].rolling(window=5, min_periods=1).mean()
                    df[f'{column}_rolling_std'] = df[column].rolling(window=5, min_periods=1).std()
        
        return df
    
    def _engineer_categorical_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Engineer categorical features"""
        categorical_columns = df.select_dtypes(include=['category', 'object']).columns
        
        for column in categorical_columns:
            if column in self.feature_info and df[column].nunique() < 50:  # Limit cardinality
                # Frequency encoding
                freq_map = df[column].value_counts().to_dict()
                df[f'{column}_freq'] = df[column].map(freq_map)
                
                # Target encoding (if target available)
                if self.config.target_column and self.config.target_column in df.columns:
                    target_map = df.groupby(column)[self.config.target_column].mean().to_dict()
                    df[f'{column}_target_enc'] = df[column].map(target_map)
                
                # Binary encoding for low cardinality
                if df[column].nunique() <= 10:
                    dummies = pd.get_dummies(df[column], prefix=column)
                    df = pd.concat([df, dummies], axis=1)
        
        return df
    
    def _engineer_temporal_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Engineer temporal features"""
        datetime_columns = df.select_dtypes(include=['datetime64']).columns
        
        for column in datetime_columns:
            if column in self.feature_info:
                # Extract components
                df[f'{column}_year'] = df[column].dt.year
                df[f'{column}_month'] = df[column].dt.month
                df[f'{column}_day'] = df[column].dt.day
                df[f'{column}_dayofweek'] = df[column].dt.dayofweek
                df[f'{column}_hour'] = df[column].dt.hour
                df[f'{column}_quarter'] = df[column].dt.quarter
                df[f'{column}_weekofyear'] = df[column].dt.isocalendar().week
                
                # Cyclical encoding
                df[f'{column}_month_sin'] = np.sin(2 * np.pi * df[column].dt.month / 12)
                df[f'{column}_month_cos'] = np.cos(2 * np.pi * df[column].dt.month / 12)
                df[f'{column}_day_sin'] = np.sin(2 * np.pi * df[column].dt.day / 31)
                df[f'{column}_day_cos'] = np.cos(2 * np.pi * df[column].dt.day / 31)
        
        return df
    
    def _engineer_text_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Engineer text features"""
        text_columns = df.select_dtypes(include=['object']).columns
        
        for column in text_columns:
            if column in self.feature_info and self.feature_info[column].data_type == DataType.TEXT:
                # Text length
                df[f'{column}_length'] = df[column].astype(str).str.len()
                
                # Word count
                df[f'{column}_word_count'] = df[column].astype(str).str.split().str.len()
                
                # Character count
                df[f'{column}_char_count'] = df[column].astype(str).str.len()
                
                # Uppercase ratio
                df[f'{column}_upper_ratio'] = df[column].astype(str).str.upper().str.len() / df[column].astype(str).str.len()
                
                # Digit count
                df[f'{column}_digit_count'] = df[column].astype(str).str.count(r'\d')
                
                # TF-IDF vectorization (for high cardinality text)
                if self.config.text_vectorization == "tfidf" and df[column].nunique() > 100:
                    vectorizer = TfidfVectorizer(max_features=100, stop_words='english')
                    tfidf_matrix = vectorizer.fit_transform(df[column].fillna('').astype(str))
                    
                    # Add TF-IDF features
                    for i, feature_name in enumerate(vectorizer.get_feature_names_out()[:10]):
                        df[f'{column}_tfidf_{i}'] = tfidf_matrix[:, i].toarray().flatten()
        
        return df
    
    def _create_interaction_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create interaction features"""
        numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
        
        # Limit to top correlated features
        top_features = sorted(
            [(col, self.feature_info[col].correlation_with_target) for col in numeric_columns if col in self.feature_info],
            key=lambda x: x[1], reverse=True
        )[:10]
        
        for i, (col1, _) in enumerate(top_features):
            for col2, _ in top_features[i+1:i+6]:  # Create interactions with next 5 features
                if col1 != col2 and col1 in df.columns and col2 in df.columns:
                    # Multiplication interaction
                    df[f'{col1}_{col2}_mult'] = df[col1] * df[col2]
                    
                    # Division interaction
                    df[f'{col1}_{col2}_div'] = df[col1] / (df[col2] + 1e-8)
                    
                    # Sum interaction
                    df[f'{col1}_{col2}_sum'] = df[col1] + df[col2]
        
        return df
    
    def _create_polynomial_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create polynomial features"""
        numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
        
        # Limit to top features
        top_features = [col for col in numeric_columns if col in self.feature_info][:5]
        
        for col in top_features:
            if col in df.columns:
                # Square
                df[f'{col}_squared'] = df[col] ** 2
                
                # Cube
                df[f'{col}_cubed'] = df[col] ** 3
                
                # Square root
                if (df[col] >= 0).all():
                    df[f'{col}_sqrt'] = np.sqrt(df[col])
        
        return df
    
    def _create_aggregated_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create aggregated features"""
        categorical_columns = df.select_dtypes(include=['category', 'object']).columns.tolist()
        numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
        
        if categorical_columns and numeric_columns:
            for cat_col in categorical_columns[:3]:  # Limit to first 3 categorical columns
                for num_col in numeric_columns[:5]:  # Limit to first 5 numeric columns
                    if cat_col in df.columns and num_col in df.columns:
                        # Group by categorical and aggregate numeric
                        agg_stats = df.groupby(cat_col)[num_col].agg(['mean', 'std', 'min', 'max'])
                        
                        # Map back to original dataframe
                        for stat_name, stat_values in agg_stats.items():
                            df[f'{cat_col}_{num_col}_{stat_name}'] = df[cat_col].map(stat_values)
        
        return df


class FeatureSelector:
    """Feature selection utilities"""
    
    def __init__(self, config: PipelineConfig):
        self.config = config
        
    def select_features(self, df: pd.DataFrame, target_column: str) -> Tuple[pd.DataFrame, List[str]]:
        """Select best features"""
        try:
            X = df.drop(columns=[target_column])
            y = df[target_column]
            
            # Remove constant features
            variance_selector = VarianceThreshold(threshold=0.01)
            X_var = variance_selector.fit_transform(X)
            selected_features = X.columns[variance_selector.get_support()]
            
            X = X[selected_features]
            
            # Statistical feature selection
            if self.config.feature_selection_method == "statistical":
                X, selected_features = self._statistical_selection(X, y)
            elif self.config.feature_selection_method == "model_based":
                X, selected_features = self._model_based_selection(X, y)
            else:  # auto
                X, selected_features = self._auto_selection(X, y)
            
            # Dimensionality reduction
            if self.config.dimensionality_reduction:
                X = self._dimensionality_reduction(X)
            
            # Limit features
            if len(X.columns) > self.config.max_features:
                X = X.iloc[:, :self.config.max_features]
                selected_features = selected_features[:self.config.max_features]
            
            logger.info(f"Feature selection completed. Selected {len(selected_features)} features")
            return X, selected_features
            
        except Exception as e:
            logger.error(f"Error in feature selection: {e}")
            raise
    
    def _statistical_selection(self, X: pd.DataFrame, y: pd.Series) -> Tuple[pd.DataFrame, List[str]]:
        """Statistical feature selection"""
        # Use SelectKBest with appropriate score function
        if len(y.unique()) < 20:  # Classification
            from sklearn.feature_selection import f_classif
            selector = SelectKBest(score_func=f_classif, k=min(50, X.shape[1]))
        else:  # Regression
            from sklearn.feature_selection import f_regression
            selector = SelectKBest(score_func=f_regression, k=min(50, X.shape[1]))
        
        X_selected = selector.fit_transform(X, y)
        selected_features = X.columns[selector.get_support()]
        
        return pd.DataFrame(X_selected, columns=selected_features), selected_features.tolist()
    
    def _model_based_selection(self, X: pd.DataFrame, y: pd.Series) -> Tuple[pd.DataFrame, List[str]]:
        """Model-based feature selection"""
        if len(y.unique()) < 20:  # Classification
            model = RandomForestClassifier(n_estimators=100, random_state=self.config.random_state)
        else:  # Regression
            model = RandomForestRegressor(n_estimators=100, random_state=self.config.random_state)
        
        selector = SelectFromModel(model, threshold='median')
        X_selected = selector.fit_transform(X, y)
        selected_features = X.columns[selector.get_support()]
        
        return pd.DataFrame(X_selected, columns=selected_features), selected_features.tolist()
    
    def _auto_selection(self, X: pd.DataFrame, y: pd.Series) -> Tuple[pd.DataFrame, List[str]]:
        """Automatic feature selection"""
        # Try multiple methods and select best
        methods = ['statistical', 'model_based']
        best_score = float('inf')
        best_features = []
        best_X = None
        
        for method in methods:
            try:
                if method == 'statistical':
                    X_method, features = self._statistical_selection(X, y)
                else:
                    X_method, features = self._model_based_selection(X, y)
                
                # Evaluate using cross-validation
                if len(y.unique()) < 20:  # Classification
                    from sklearn.model_selection import cross_val_score
                    from sklearn.ensemble import RandomForestClassifier
                    scores = cross_val_score(RandomForestClassifier(random_state=self.config.random_state), X_method, y, cv=3)
                    avg_score = 1 - np.mean(scores)  # Error rate
                else:  # Regression
                    from sklearn.model_selection import cross_val_score
                    from sklearn.ensemble import RandomForestRegressor
                    scores = cross_val_score(RandomForestRegressor(random_state=self.config.random_state), X_method, y, cv=3, scoring='neg_mean_squared_error')
                    avg_score = -np.mean(scores)  # MSE
                
                if avg_score < best_score:
                    best_score = avg_score
                    best_features = features
                    best_X = X_method
                    
            except Exception as e:
                logger.warning(f"Feature selection method {method} failed: {e}")
                continue
        
        return best_X if best_X is not None else X, best_features if best_features else X.columns.tolist()
    
    def _dimensionality_reduction(self, X: pd.DataFrame) -> pd.DataFrame:
        """Apply dimensionality reduction"""
        if self.config.dimensionality_reduction == "pca":
            pca = PCA(n_components=min(50, X.shape[1]), random_state=self.config.random_state)
            X_reduced = pca.fit_transform(X)
            return pd.DataFrame(X_reduced, columns=[f'pca_{i}' for i in range(X_reduced.shape[1])])
        elif self.config.dimensionality_reduction == "svd":
            svd = TruncatedSVD(n_components=min(50, X.shape[1]), random_state=self.config.random_state)
            X_reduced = svd.fit_transform(X)
            return pd.DataFrame(X_reduced, columns=[f'svd_{i}' for i in range(X_reduced.shape[1])])
        
        return X


class DataPipeline:
    """Main data pipeline"""
    
    def __init__(self, config: PipelineConfig, redis_client: Optional[redis.Redis] = None):
        self.config = config
        self.redis = redis_client
        self.quality_assessor = DataQualityAssessment()
        self.cleaner = DataCleaner(config)
        self.engineer = FeatureEngineer(config)
        self.selector = FeatureSelector(config)
        self.scaler = None
        
    def run_pipeline(self, input_data: pd.DataFrame) -> Dict[str, Any]:
        """Run complete data pipeline"""
        pipeline_start = datetime.utcnow()
        
        try:
            # Stage 1: Quality Assessment
            quality_metrics = self.quality_assessor.assess_data_quality(input_data)
            
            # Stage 2: Data Cleaning
            cleaned_data = self.cleaner.clean_data(input_data)
            
            # Stage 3: Feature Engineering
            engineered_data = self.engineer.engineer_features(cleaned_data, self.config.target_column)
            
            # Stage 4: Feature Selection (if target column specified)
            if self.config.target_column and self.config.target_column in engineered_data.columns:
                X, selected_features = self.selector.select_features(engineered_data, self.config.target_column)
                y = engineered_data[self.config.target_column]
                
                # Feature scaling
                if self.config.scale_features:
                    self.scaler = StandardScaler()
                    X_scaled = self.scaler.fit_transform(X)
                    X = pd.DataFrame(X_scaled, columns=X.columns)
                
                processed_data = pd.concat([X, y], axis=1)
            else:
                processed_data = engineered_data
                selected_features = engineered_data.columns.tolist()
            
            # Calculate final metrics
            pipeline_end = datetime.utcnow()
            pipeline_duration = (pipeline_end - pipeline_start).total_seconds()
            
            pipeline_result = {
                'pipeline_id': f"pipeline_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                'config': self.config,
                'input_shape': input_data.shape,
                'output_shape': processed_data.shape,
                'quality_metrics': {
                    'input_quality': quality_metrics.overall_quality_score,
                    'missing_values': quality_metrics.missing_values,
                    'duplicates': quality_metrics.duplicate_rows,
                    'outliers': quality_metrics.outliers
                },
                'selected_features': selected_features,
                'feature_count': len(selected_features),
                'pipeline_duration_seconds': pipeline_duration,
                'stages_completed': [
                    'quality_assessment',
                    'data_cleaning',
                    'feature_engineering',
                    'feature_selection' if self.config.target_column else 'skipped'
                ],
                'processed_data': processed_data,
                'created_at': pipeline_end.isoformat()
            }
            
            # Save pipeline result
            if self.redis:
                self._save_pipeline_result(pipeline_result)
            
            logger.info(f"Data pipeline completed in {pipeline_duration:.2f} seconds")
            return pipeline_result
            
        except Exception as e:
            logger.error(f"Error in data pipeline: {e}")
            raise
    
    def _save_pipeline_result(self, result: Dict[str, Any]) -> None:
        """Save pipeline result to Redis"""
        try:
            # Convert to JSON-serializable format
            serializable_result = {
                'pipeline_id': result['pipeline_id'],
                'config': {
                    'input_source': self.config.input_source,
                    'output_format': self.config.output_format,
                    'target_column': self.config.target_column,
                    'max_features': self.config.max_features,
                    'handle_missing': self.config.handle_missing,
                    'create_interactions': self.config.create_interactions,
                    'create_polynomials': self.config.create_polynomials
                },
                'input_shape': result['input_shape'],
                'output_shape': result['output_shape'],
                'quality_metrics': result['quality_metrics'],
                'selected_features': result['selected_features'],
                'feature_count': result['feature_count'],
                'pipeline_duration_seconds': result['pipeline_duration_seconds'],
                'stages_completed': result['stages_completed'],
                'created_at': result['created_at']
            }
            
            self.redis.setex(f"pipeline_result:{result['pipeline_id']}", 
                           86400 * 7, json.dumps(serializable_result))  # 7 days TTL
            
            logger.info(f"Saved pipeline result {result['pipeline_id']}")
            
        except Exception as e:
            logger.error(f"Failed to save pipeline result: {e}")


# Global data pipeline service instance
data_pipeline_service = DataPipeline

# Export functions
def run_data_pipeline(input_data: pd.DataFrame, config: PipelineConfig) -> Dict[str, Any]:
    """Run data pipeline"""
    pipeline = DataPipeline(config)
    return pipeline.run_pipeline(input_data)

def assess_data_quality(df: pd.DataFrame) -> DataQualityMetrics:
    """Assess data quality"""
    assessor = DataQualityAssessment()
    return assessor.assess_data_quality(df)

def engineer_features(df: pd.DataFrame, target_column: Optional[str] = None, 
                    config: Optional[PipelineConfig] = None) -> pd.DataFrame:
    """Engineer features"""
    if config is None:
        config = PipelineConfig(input_source="manual", output_format="dataframe")
    
    engineer = FeatureEngineer(config)
    return engineer.engineer_features(df, target_column)

def select_features(df: pd.DataFrame, target_column: str, 
                   config: Optional[PipelineConfig] = None) -> Tuple[pd.DataFrame, List[str]]:
    """Select features"""
    if config is None:
        config = PipelineConfig(input_source="manual", output_format="dataframe")
    
    selector = FeatureSelector(config)
    return selector.select_features(df, target_column)

# Export all components
__all__ = [
    'DataType',
    'FeatureType',
    'PipelineStage',
    'DataQualityMetrics',
    'FeatureInfo',
    'PipelineConfig',
    'DataQualityAssessment',
    'DataCleaner',
    'FeatureEngineer',
    'FeatureSelector',
    'DataPipeline',
    'run_data_pipeline',
    'assess_data_quality',
    'engineer_features',
    'select_features',
    'data_pipeline_service',
]
