"""
Hyperparameter Tuning and Model Optimization System
Advanced hyperparameter tuning with multiple optimization algorithms and model optimization
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
import time
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV, cross_val_score, train_test_split
from sklearn.metrics import accuracy_score, mean_squared_error, f1_score, r2_score
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.naive_bayes import GaussianNB, MultinomialNB
from sklearn.preprocessing import StandardScaler
import optuna
import joblib
from scipy.optimize import differential_evolution
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class OptimizationType(Enum):
    """Optimization types"""
    GRID_SEARCH = "grid_search"
    RANDOM_SEARCH = "random_search"
    BAYESIAN_OPTIMIZATION = "bayesian_optimization"
    GENETIC_ALGORITHM = "genetic_algorithm"
    DIFFERENTIAL_EVOLUTION = "differential_evolution"
    PARTICLE_SWARM = "particle_swarm"
    SIMULATED_ANNEALING = "simulated_annealing"
    HYPERBAND = "hyperband"
    SUCCESSIVE_HALVING = "successive_halving"


class OptimizationObjective(Enum):
    """Optimization objectives"""
    MAXIMIZE_ACCURACY = "maximize_accuracy"
    MINIMIZE_ERROR = "minimize_error"
    MAXIMIZE_F1_SCORE = "maximize_f1_score"
    MINIMIZE_MSE = "minimize_mse"
    MINIMIZE_NEGATIVE_LOG_LOSS = "minimize_negative_log_loss"
    CUSTOM = "custom"


class SearchSpaceType(Enum):
    """Search space types"""
    CONTINUOUS = "continuous"
    DISCRETE = "discrete"
    CATEGORICAL = "categorical"
    INTEGER = "integer"


@dataclass
class Hyperparameter:
    """Hyperparameter definition"""
    name: str
    param_type: SearchSpaceType
    low: Optional[float] = None
    high: Optional[float] = None
    choices: Optional[List[Any]] = None
    default: Any = None
    log_scale: bool = False
    description: str = ""


@dataclass
class OptimizationResult:
    """Optimization result"""
    optimization_id: str
    model_type: str
    objective: OptimizationObjective
    best_params: Dict[str, Any]
    best_score: float
    best_model: Any
    optimization_history: List[Dict[str, Any]]
    optimization_time_seconds: float
    num_trials: int
    convergence_info: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class OptimizationConfig:
    """Optimization configuration"""
    model_type: str
    objective: OptimizationObjective
    optimization_type: OptimizationType
    max_trials: int = 100
    timeout_seconds: int = 3600
    cv_folds: int = 5
    scoring_metric: str = "accuracy"
    n_jobs: int = -1
    random_state: int = 42
    early_stopping: bool = True
    enable_pruning: bool = False
    refit_best_model: bool = True


class HyperparameterSpace:
    """Hyperparameter search space definition"""
    
    def __init__(self):
        self.search_spaces = {}
        
    def define_search_space(self, model_type: str) -> List[Hyperparameter]:
        """Define search space for different model types"""
        if model_type == "random_forest_classifier":
            return [
                Hyperparameter(
                    name="n_estimators",
                    param_type=SearchSpaceType.INTEGER,
                    low=10,
                    high=500,
                    default=100,
                    description="Number of trees in the forest"
                ),
                Hyperparameter(
                    name="max_depth",
                    param_type=SearchSpaceType.INTEGER,
                    low=1,
                    high=50,
                    default=None,
                    description="Maximum depth of the tree"
                ),
                Hyperparameter(
                    name="min_samples_split",
                    param_type=SearchSpaceType.INTEGER,
                    low=2,
                    high=20,
                    default=2,
                    description="Minimum number of samples required to split an internal node"
                ),
                Hyperparameter(
                    name="min_samples_leaf",
                    param_type=SearchSpaceType.INTEGER,
                    low=1,
                    high=20,
                    default=1,
                    description="Minimum number of samples required to be at a leaf node"
                ),
                Hyperparameter(
                    name="max_features",
                    param_type=SearchSpaceType.CATEGORICAL,
                    choices=["sqrt", "log2", None],
                    default="sqrt",
                    description="Number of features to consider at each split"
                ),
                Hyperparameter(
                    name="bootstrap",
                    param_type=SearchSpaceType.CATEGORICAL,
                    choices=[True, False],
                    default=True,
                    description="Whether bootstrap samples are used when building trees"
                )
            ]
        
        elif model_type == "random_forest_regressor":
            return [
                Hyperparameter(
                    name="n_estimators",
                    param_type=SearchSpaceType.INTEGER,
                    low=10,
                    high=500,
                    default=100,
                    description="Number of trees in the forest"
                ),
                Hyperparameter(
                    name="max_depth",
                    param_type=SearchSpaceType.INTEGER,
                    low=1,
                    high=50,
                    default=None,
                    description="Maximum depth of the tree"
                ),
                Hyperparameter(
                    name="min_samples_split",
                    param_type=SearchSpaceType.INTEGER,
                    low=2,
                    high=20,
                    default=2,
                    description="Minimum number of samples required to split an internal node"
                ),
                Hyperparameter(
                    name="min_samples_leaf",
                    param_type=SearchSpaceType.INTEGER,
                    low=1,
                    high=20,
                    default=1,
                    description="Minimum number of samples required to be at a leaf node"
                ),
                Hyperparameter(
                    name="max_features",
                    param_type=SearchSpaceType.CATEGORICAL,
                    choices=["sqrt", "log2", None],
                    default="sqrt",
                    description="Number of features to consider at each split"
                ),
                Hyperparameter(
                    name="bootstrap",
                    param_type=SearchSpaceType.CATEGORICAL,
                    choices=[True, False],
                    default=True,
                    description="Whether bootstrap samples are used when building trees"
                )
            ]
        
        elif model_type == "gradient_boosting_classifier":
            return [
                Hyperparameter(
                    name="n_estimators",
                    param_type=SearchSpaceType.INTEGER,
                    low=10,
                    high=500,
                    default=100,
                    description="Number of boosting stages to perform"
                ),
                Hyperparameter(
                    name="learning_rate",
                    param_type=SearchSpaceType.CONTINUOUS,
                    low=0.01,
                    high=0.3,
                    default=0.1,
                    log_scale=True,
                    description="Learning rate shrinks the contribution of each classifier"
                ),
                Hyperparameter(
                    name="max_depth",
                    param_type=SearchSpaceType.INTEGER,
                    low=1,
                    high=50,
                    default=3,
                    description="Maximum depth of the individual regression estimators"
                ),
                Hyperparameter(
                    name="subsample",
                    param_type=SearchSpaceType.CONTINUOUS,
                    low=0.5,
                    high=1.0,
                    default=1.0,
                    description="Fraction of samples to be used for fitting the individual base learners"
                ),
                Hyperparameter(
                    name="min_samples_split",
                    param_type=SearchSpaceType.INTEGER,
                    low=2,
                    high=20,
                    default=2,
                    description="Minimum number of samples required to split an internal node"
                ),
                Hyperparameter(
                    name="max_features",
                    param_type=SearchSpaceType.CATEGORICAL,
                    choices=["sqrt", "log2", None],
                    default=None,
                    description="Number of features to consider when looking for the best split"
                )
            ]
        
        elif model_type == "svm_classifier":
            return [
                Hyperparameter(
                    name="C",
                    param_type=SearchSpaceType.CONTINUOUS,
                    low=0.1,
                    high=100.0,
                    default=1.0,
                    log_scale=True,
                    description="Regularization parameter"
                ),
                Hyperparameter(
                    name="kernel",
                    param_type=SearchSpaceType.CATEGORICAL,
                    choices=["linear", "poly", "rbf", "sigmoid"],
                    default="rbf",
                    description="Specifies the kernel type to be used in the algorithm"
                ),
                Hyperparameter(
                    name="gamma",
                    param_type=SearchSpaceType.CONTINUOUS,
                    low=1e-4,
                    high=1e-1,
                    default="scale",
                    log_scale=True,
                    description="Kernel coefficient"
                ),
                Hyperparameter(
                    name="degree",
                    param_type=SearchSpaceType.INTEGER,
                    low=1,
                    high=5,
                    default=3,
                    description="Degree of the polynomial kernel function"
                )
            ]
        
        elif model_type == "logistic_regression":
            return [
                Hyperparameter(
                    name="C",
                    param_type=SearchSpaceType.CONTINUOUS,
                    low=0.001,
                    high=100.0,
                    default=1.0,
                    log_scale=True,
                    description="Inverse of regularization strength"
                ),
                Hyperparameter(
                    name="penalty",
                    param_type=SearchSpaceType.CATEGORICAL,
                    choices=["l1", "l2", "elasticnet", "none"],
                    default="l2",
                    description="Norm used in the penalization"
                ),
                Hyperparameter(
                    name="solver",
                    param_type=SearchSpaceType.CATEGORICAL,
                    choices=["liblinear", "lbfgs", "newton-cg", "sag", "saga"],
                    default="lbfgs",
                    description="Algorithm to use in the optimization problem"
                )
            ]
        
        elif model_type == "mlp_classifier":
            return [
                Hyperparameter(
                    name="hidden_layer_sizes",
                    param_type=SearchSpaceType.CATEGORICAL,
                    choices=[
                        (50,), (100,), (50, 50), (100, 50), (100, 100),
                        (50, 25), (100, 50), (150, 75), (200, 100)
                    ],
                    default=(100,),
                    description="The ith element represents the number of neurons in the ith hidden layer"
                ),
                Hyperparameter(
                    name="activation",
                    param_type=SearchSpaceType.CATEGORICAL,
                    choices=["identity", "logistic", "tanh", "relu"],
                    default="relu",
                    description="Activation function for the hidden layer"
                ),
                Hyperparameter(
                    name="solver",
                    param_type=SearchSpaceType.CATEGORICAL,
                    choices=["lbfgs", "sgd", "adam"],
                    default="adam",
                    description="The solver for weight optimization"
                ),
                Hyperparameter(
                    name="alpha",
                    param_type=SearchSpaceType.CONTINUOUS,
                    low=1e-5,
                    high=1e-1,
                    default=1e-3,
                    log_scale=True,
                    description="L2 penalty (regularization term) parameter"
                ),
                Hyperparameter(
                    name="learning_rate_init",
                    param_type=SearchSpaceType.CONTINUOUS,
                    low=1e-4,
                    high=1e-2,
                    default=1e-3,
                    log_scale=True,
                    description="The initial learning rate used"
                ),
                Hyperparameter(
                    name="batch_size",
                    param_type=SearchSpaceType.CATEGORICAL,
                    choices=[16, 32, 64, 128, 256],
                    default=32,
                    description="Size of minibatches for stochastic optimizers"
                )
            ]
        
        else:
            return []
    
    def get_search_space_dict(self, model_type: str) -> Dict[str, Any]:
        """Get search space dictionary for Optuna"""
        hyperparams = self.define_search_space(model_type)
        search_space = {}
        
        for param in hyperparams:
            if param.param_type == SearchSpaceType.CONTINUOUS:
                if param.log_scale:
                    search_space[param.name] = optuna.distributions.FloatDistribution(
                        low=param.low,
                        high=param.high,
                        log=True
                    )
                else:
                    search_space[param.name] = optuna.distributions.FloatDistribution(
                        low=param.low,
                        high=param.high
                    )
            elif param.param_type == SearchSpaceType.INTEGER:
                if param.log_scale:
                    search_space[param.name] = optuna.distributions.IntDistribution(
                        low=int(param.low),
                        high=int(param.high),
                        log=True
                    )
                else:
                    search_space[param.name] = optuna.distributions.IntDistribution(
                        low=int(param.low),
                        high=int(param.high)
                    )
            elif param.param_type == SearchSpaceType.CATEGORICAL:
                search_space[param.name] = optuna.distributions.CategoricalDistribution(param.choices)
        
        return search_space


class HyperparameterOptimizer:
    """Hyperparameter optimization engine"""
    
    def __init__(self, config: OptimizationConfig):
        self.config = config
        self.search_space = HyperparameterSpace()
        self.optimization_history = []
        
    def optimize(self, X: pd.DataFrame, y: pd.Series, 
                 validation_data: Optional[Tuple[pd.DataFrame, pd.Series]] = None) -> OptimizationResult:
        """Run hyperparameter optimization"""
        optimization_start = time.time()
        optimization_id = f"opt_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        try:
            # Split data if validation data not provided
            if validation_data is None:
                X_train, X_val, y_train, y_val = train_test_split(
                    X, y, test_size=0.2, random_state=self.config.random_state
                )
            else:
                X_train, y_train = X, y
                X_val, y_val = validation_data
            
            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_val_scaled = scaler.transform(X_val)
            
            # Run optimization based on type
            if self.config.optimization_type == OptimizationType.GRID_SEARCH:
                result = self._grid_search(X_train_scaled, y_train, X_val_scaled, y_val)
            elif self.config.optimization_type == OptimizationType.RANDOM_SEARCH:
                result = self._random_search(X_train_scaled, y_train, X_val_scaled, y_val)
            elif self.config.optimization_type == OptimizationType.BAYESIAN_OPTIMIZATION:
                result = self._bayesian_optimization(X_train_scaled, y_train, X_val_scaled, y_val)
            elif self.config.optimization_type == OptimizationType.GENETIC_ALGORITHM:
                result = self._genetic_algorithm(X_train_scaled, y_train, X_val_scaled, y_val)
            elif self.config.optimization_type == OptimizationType.DIFFERENTIAL_EVOLUTION:
                result = self._differential_evolution(X_train_scaled, y_train, X_val_scaled, y_val)
            else:
                raise ValueError(f"Unsupported optimization type: {self.config.optimization_type}")
            
            # Create optimization result
            optimization_time = time.time() - optimization_start
            
            optimization_result = OptimizationResult(
                optimization_id=optimization_id,
                model_type=self.config.model_type,
                objective=self.config.objective,
                best_params=result['best_params'],
                best_score=result['best_score'],
                best_model=result['best_model'],
                optimization_history=result['history'],
                optimization_time_seconds=optimization_time,
                num_trials=result['num_trials'],
                convergence_info=result['convergence_info'],
                metadata={
                    'scaler': scaler,
                    'validation_split': 'provided' if validation_data else 'auto',
                    'optimization_type': self.config.optimization_type.value
                }
            )
            
            logger.info(f"Optimization completed: {optimization_result.best_score:.4f} in {optimization_time:.2f}s")
            return optimization_result
            
        except Exception as e:
            logger.error(f"Error in hyperparameter optimization: {e}")
            raise
    
    def _grid_search(self, X_train: np.ndarray, y_train: np.ndarray, 
                     X_val: np.ndarray, y_val: np.ndarray) -> Dict[str, Any]:
        """Grid search optimization"""
        # Get model and parameter grid
        model, param_grid = self._get_model_and_params()
        
        # Create grid search
        grid_search = GridSearchCV(
            estimator=model,
            param_grid=param_grid,
            cv=self.config.cv_folds,
            scoring=self.config.scoring_metric,
            n_jobs=self.config.n_jobs,
            verbose=0
        )
        
        # Fit grid search
        grid_search.fit(X_train, y_train)
        
        # Evaluate on validation set
        y_pred = grid_search.best_estimator_.predict(X_val)
        val_score = self._calculate_objective(y_val, y_pred)
        
        return {
            'best_params': grid_search.best_params_,
            'best_score': val_score,
            'best_model': grid_search.best_estimator_,
            'history': [],
            'num_trials': len(grid_search.cv_results_),
            'convergence_info': {
                'method': 'grid_search',
                'total_combinations': len(grid_search.cv_results_)
            }
        }
    
    def _random_search(self, X_train: np.ndarray, y_train: np.ndarray,
                       X_val: np.ndarray, y_val: np.ndarray) -> Dict[str, Any]:
        """Random search optimization"""
        # Get model and parameter distributions
        model, param_distributions = self._get_model_and_distributions()
        
        # Create random search
        random_search = RandomizedSearchCV(
            estimator=model,
            param_distributions=param_distributions,
            n_iter=self.config.max_trials,
            cv=self.config.cv_folds,
            scoring=self.config.scoring_metric,
            n_jobs=self.config.n_jobs,
            random_state=self.config.random_state,
            verbose=0
        )
        
        # Fit random search
        random_search.fit(X_train, y_train)
        
        # Evaluate on validation set
        y_pred = random_search.best_estimator_.predict(X_val)
        val_score = self._calculate_objective(y_val, y_pred)
        
        return {
            'best_params': random_search.best_params_,
            'best_score': val_score,
            'best_model': random_search.best_estimator_,
            'history': [],
            'num_trials': self.config.max_trials,
            'convergence_info': {
                'method': 'random_search',
                'iterations': self.config.max_trials
            }
        }
    
    def _bayesian_optimization(self, X_train: np.ndarray, y_train: np.ndarray,
                             X_val: np.ndarray, y_val: np.ndarray) -> Dict[str, Any]:
        """Bayesian optimization using Optuna"""
        # Get search space
        search_space = self.search_space.get_search_space_dict(self.config.model_type)
        
        # Create Optuna study
        study = optuna.create_study(
            direction="maximize" if self.config.objective in [OptimizationObjective.MAXIMIZE_ACCURACY, OptimizationObjective.MAXIMIZE_F1_SCORE] else "minimize",
            sampler=optuna.samplers.TPESampler()
        )
        
        # Define objective function
        def objective(trial):
            # Get model class
            model_class = self._get_model_class()
            
            # Get hyperparameters
            params = {}
            for param_name in search_space:
                if param_name in trial.params:
                    params[param_name] = trial.params[param_name]
            
            # Create and train model
            model = model_class(**params)
            
            # Cross-validation
            scores = cross_val_score(
                model, X_train, y_train,
                cv=self.config.cv_folds,
                scoring=self.config.scoring_metric,
                n_jobs=self.config.n_jobs
            )
            
            return scores.mean()
        
        # Optimize
        study.optimize(objective, n_trials=self.config.max_trials, timeout=self.config.timeout_seconds)
        
        # Train best model
        best_params = study.best_params
        model_class = self._get_model_class()
        best_model = model_class(**best_params)
        best_model.fit(X_train, y_train)
        
        # Evaluate on validation set
        y_pred = best_model.predict(X_val)
        val_score = self._calculate_objective(y_val, y_pred)
        
        return {
            'best_params': best_params,
            'best_score': val_score,
            'best_model': best_model,
            'history': [{'trial': i, 'score': trial.value, 'params': trial.params} for i, trial in enumerate(study.trials)],
            'num_trials': len(study.trials),
            'convergence_info': {
                'method': 'bayesian_optimization',
                'best_trial': study.best_trial.number,
                'n_trials': len(study.trials)
            }
        }
    
    def _genetic_algorithm(self, X_train: np.ndarray, y_train: np.ndarray,
                         X_val: np.ndarray, y_val: np.ndarray) -> Dict[str, Any]:
        """Genetic algorithm optimization"""
        # Get parameter bounds
        bounds, param_types = self._get_genetic_algorithm_bounds()
        
        # Define fitness function
        def fitness_function(params):
            # Convert params to dict
            param_dict = {}
            for i, param_name in enumerate(param_types):
                if param_types[i] == 'integer':
                    param_dict[param_name] = int(params[i])
                else:
                    param_dict[param_name] = params[i]
            
            # Create and train model
            model_class = self._get_model_class()
            model = model_class(**param_dict)
            
            # Cross-validation
            scores = cross_val_score(
                model, X_train, y_train,
                cv=self.config.cv_folds,
                scoring=self.config.scoring_metric,
                n_jobs=self.config.n_jobs
            )
            
            return scores.mean()
        
        # Run differential evolution
        result = differential_evolution(
            fitness_function,
            bounds,
            maxiter=self.config.max_trials,
            popsize=15,
            seed=self.config.random_state
        )
        
        # Train best model
        best_params = {}
        for i, param_name in enumerate(param_types):
            if param_types[i] == 'integer':
                best_params[param_name] = int(result.x[i])
            else:
                best_params[param_name] = result.x[i]
        
        model_class = self._get_model_class()
        best_model = model_class(**best_params)
        best_model.fit(X_train, y_train)
        
        # Evaluate on validation set
        y_pred = best_model.predict(X_val)
        val_score = self._calculate_objective(y_val, y_pred)
        
        return {
            'best_params': best_params,
            'best_score': val_score,
            'best_model': best_model,
            'history': [{'generation': i, 'score': fitness} for i, fitness in enumerate(result.fun)],
            'num_trials': self.config.max_trials,
            'convergence_info': {
                'method': 'genetic_algorithm',
                'best_fitness': result.fun,
                'n_generations': self.config.max_trials
            }
        }
    
    def _differential_evolution(self, X_train: np.ndarray, y_train: np.ndarray,
                              X_val: np.ndarray, y_val: np.ndarray) -> Dict[str, Any]:
        """Differential evolution optimization"""
        # Get parameter bounds
        bounds, param_types = self._get_genetic_algorithm_bounds()
        
        # Define fitness function
        def fitness_function(params):
            # Convert params to dict
            param_dict = {}
            for i, param_name in enumerate(param_types):
                if param_types[i] == 'integer':
                    param_dict[param_name] = int(params[i])
                else:
                    param_dict[param_name] = params[i]
            
            # Create and train model
            model_class = self._get_model_class()
            model = model_class(**param_dict)
            
            # Cross-validation
            scores = cross_val_score(
                model, X_train, y_train,
                cv=self.config.cv_folds,
                scoring=self.config.scoring_metric,
                n_jobs=self.config.n_jobs
            )
            
            return scores.mean()
        
        # Run differential evolution
        result = differential_evolution(
            fitness_function,
            bounds,
            maxiter=self.config.max_trials,
            popsize=15,
            seed=self.config.random_state
        )
        
        # Train best model
        best_params = {}
        for i, param_name in enumerate(param_types):
            if param_types[i] == 'integer':
                best_params[param_name] = int(result.x[i])
            else:
                best_params[param_name] = result.x[i]
        
        model_class = self._get_model_class()
        best_model = model_class(**best_params)
        best_model.fit(X_train, y_train)
        
        # Evaluate on validation set
        y_pred = best_model.predict(X_val)
        val_score = self._calculate_objective(y_val, y_pred)
        
        return {
            'best_params': best_params,
            'best_score': val_score,
            'best_model': best_model,
            'history': [{'generation': i, 'score': fitness} for i, fitness in enumerate(result.fun)],
            'num_trials': self.config.max_trials,
            'convergence_info': {
                'method': 'differential_evolution',
                'best_fitness': result.fun,
                'n_generations': self.config.max_trials
            }
        }
    
    def _get_model_and_params(self) -> Tuple[Any, Dict[str, List[Any]]]:
        """Get model class and parameter grid"""
        hyperparams = self.search_space.define_search_space(self.config.model_type)
        model_class = self._get_model_class()
        
        param_grid = {}
        for param in hyperparams:
            if param.param_type == SearchSpaceType.CATEGORICAL:
                param_grid[param.name] = param.choices
            elif param.param_type in [SearchSpaceType.INTEGER, SearchSpaceType.CONTINUOUS]:
                param_grid[param.name] = list(range(int(param.low), int(param.high) + 1))
        
        return model_class(), param_grid
    
    def _get_model_and_distributions(self) -> Tuple[Any, Dict[str, Any]]:
        """Get model class and parameter distributions"""
        hyperparams = self.search_space.define_search_space(self.config.model_type)
        model_class = self._get_model_class()
        
        param_distributions = {}
        for param in hyperparams:
            if param.param_type == SearchSpaceType.CATEGORICAL:
                param_distributions[param.name] = param.choices
            elif param.param_type == SearchSpaceType.INTEGER:
                param_distributions[param.name] = optuna.distributions.IntDistribution(
                    low=int(param.low), high=int(param.high)
                )
            elif param.param_type == SearchSpaceType.CONTINUOUS:
                if param.log_scale:
                    param_distributions[param.name] = optuna.distributions.FloatDistribution(
                        low=param.low, high=param.high, log=True
                    )
                else:
                    param_distributions[param.name] = optuna.distributions.FloatDistribution(
                        low=param.low, high=param.high
                    )
        
        return model_class(), param_distributions
    
    def _get_model_class(self):
        """Get model class based on configuration"""
        if self.config.model_type == "random_forest_classifier":
            return RandomForestClassifier
        elif self.config.model_type == "random_forest_regressor":
            return RandomForestRegressor
        elif self.config.model_type == "gradient_boosting_classifier":
            return GradientBoostingClassifier
        elif self.config.model_type == "gradient_boosting_regressor":
            return GradientBoostingRegressor
        elif self.config.model_type == "svm_classifier":
            return SVC
        elif self.config.model_type == "svm_regressor":
            return SVR
        elif self.config.model_type == "logistic_regression":
            return LogisticRegression
        elif self.config.model_type == "mlp_classifier":
            return MLPClassifier
        elif self.config.model_type == "mlp_regressor":
            return MLPRegressor
        else:
            raise ValueError(f"Unsupported model type: {self.config.model_type}")
    
    def _get_genetic_algorithm_bounds(self) -> Tuple[List[Tuple[float, float]], List[str]]:
        """Get bounds for genetic algorithms"""
        hyperparams = self.search_space.define_search_space(self.config.model_type)
        
        bounds = []
        param_types = []
        
        for param in hyperparams:
            if param.param_type in [SearchSpaceType.INTEGER, SearchSpaceType.CONTINUOUS]:
                bounds.append((param.low, param.high))
                param_types.append('continuous' if param.param_type == SearchSpaceType.CONTINUOUS else 'integer')
        
        return bounds, param_types
    
    def _calculate_objective(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        """Calculate objective value based on configuration"""
        if self.config.objective == OptimizationObjective.MAXIMIZE_ACCURACY:
            return accuracy_score(y_true, y_pred)
        elif self.config.objective == OptimizationObjective.MAXIMIZE_F1_SCORE:
            return f1_score(y_true, y_pred, average='weighted')
        elif self.config.objective == OptimizationObjective.MINIMIZE_MSE:
            return -mean_squared_error(y_true, y_pred)  # Negative for minimization
        elif self.config.objective == OptimizationObjective.MINIMIZE_ERROR:
            return -accuracy_score(y_true, y_pred)  # Negative for minimization
        else:
            return accuracy_score(y_true, y_pred)  # Default to accuracy


class HyperparameterTuningService:
    """Main hyperparameter tuning service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.optimizations = {}
        
    def run_hyperparameter_optimization(self, config: OptimizationConfig,
                                        X: pd.DataFrame, y: pd.Series,
                                        validation_data: Optional[Tuple[pd.DataFrame, pd.Series]] = None) -> OptimizationResult:
        """Run hyperparameter optimization"""
        optimizer = HyperparameterOptimizer(config)
        result = optimizer.optimize(X, y, validation_data)
        
        # Store result
        self.optimizations[result.optimization_id] = result
        
        # Save to Redis
        if self.redis:
            self._save_optimization_result(result)
        
        return result
    
    def get_optimization_result(self, optimization_id: str) -> Dict[str, Any]:
        """Get optimization result"""
        if optimization_id not in self.optimizations:
            return {'error': f'Optimization {optimization_id} not found'}
        
        result = self.optimizations[optimization_id]
        
        return {
            'optimization_id': optimization_id,
            'model_type': result.model_type,
            'objective': result.objective.value,
            'best_params': result.best_params,
            'best_score': result.best_score,
            'optimization_time_seconds': result.optimization_time_seconds,
            'num_trials': result.num_trials,
            'convergence_info': result.convergence_info,
            'created_at': result.created_at.isoformat()
        }
    
    def list_optimizations(self, model_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """List optimization results"""
        results = []
        
        for opt_id, result in self.optimizations.items():
            if model_type is None or result.model_type == model_type:
                results.append({
                    'optimization_id': opt_id,
                    'model_type': result.model_type,
                    'objective': result.objective.value,
                    'best_score': result.best_score,
                    'num_trials': result.num_trials,
                    'optimization_time_seconds': result.optimization_time_seconds,
                    'created_at': result.created_at.isoformat()
                })
        
        # Sort by score (descending for maximization, ascending for minimization)
        results.sort(key=lambda x: x['best_score'], reverse=True)
        
        return results
    
    def _save_optimization_result(self, result: OptimizationResult) -> None:
        """Save optimization result to Redis"""
        try:
            result_data = {
                'optimization_id': result.optimization_id,
                'model_type': result.model_type,
                'objective': result.objective.value,
                'best_params': result.best_params,
                'best_score': result.best_score,
                'optimization_time_seconds': result.optimization_time_seconds,
                'num_trials': result.num_trials,
                'convergence_info': result.convergence_info,
                'metadata': result.metadata,
                'created_at': result.created_at.isoformat()
            }
            
            self.redis.setex(f"hyperopt_result:{result.optimization_id}", 
                           86400 * 30, json.dumps(result_data))  # 30 days TTL
            
            logger.info(f"Saved optimization result {result.optimization_id}")
            
        except Exception as e:
            logger.error(f"Failed to save optimization result: {e}")


# Global hyperparameter tuning service instance
hyperparameter_tuning_service = HyperparameterTuningService()

# Export functions
def run_hyperparameter_tuning(config: OptimizationConfig, X: pd.DataFrame, y: pd.Series,
                            validation_data: Optional[Tuple[pd.DataFrame, pd.Series]] = None) -> OptimizationResult:
    """Run hyperparameter tuning"""
    return hyperparameter_tuning_service.run_hyperparameter_optimization(config, X, y, validation_data)

def get_optimization_result(optimization_id: str) -> Dict[str, Any]:
    """Get optimization result"""
    return hyperparameter_tuning_service.get_optimization_result(optimization_id)

def list_hyperparameter_optimizations(model_type: Optional[str] = None) -> List[Dict[str, Any]]:
    """List hyperparameter optimizations"""
    return hyperparameter_tuning_service.list_optimizations(model_type)

# Export all components
__all__ = [
    'OptimizationType',
    'OptimizationObjective',
    'SearchSpaceType',
    'Hyperparameter',
    'OptimizationResult',
    'OptimizationConfig',
    'HyperparameterSpace',
    'HyperparameterOptimizer',
    'HyperparameterTuningService',
    'run_hyperparameter_tuning',
    'get_optimization_result',
    'list_hyperparameter_optimizations',
    'hyperparameter_tuning_service',
]
