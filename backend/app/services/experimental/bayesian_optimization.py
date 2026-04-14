"""
OptiPlan 360 - Bayesian Optimization Service
AI-029: Hyperparameter optimization ve automated model tuning

Bu modül:
- Gaussian Process surrogate models
- Acquisition functions (EI, PI, UCB)
- Multi-fidelity optimization
- Parallel optimization
- Hyperparameter space definition
"""

import numpy as np
import torch
from typing import Dict, List, Callable, Optional, Tuple, Any
from dataclasses import dataclass, field
from scipy.stats import norm
from scipy.optimize import minimize
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)


@dataclass
class BayesOptConfig:
    """Bayesian Optimization konfigürasyonu"""
    # Gaussian Process
    kernel_type: str = "rbf"  # rbf, matern, rational_quadratic
    length_scale: float = 1.0
    noise_level: float = 1e-5
    
    # Acquisition
    acquisition_type: str = "ei"  # ei, pi, ucb
    xi: float = 0.01  # Exploration parameter for EI
    kappa: float = 2.0  # Exploration parameter for UCB
    
    # Optimization
    n_initial_points: int = 5
    n_iterations: int = 50
    batch_size: int = 1  # Parallel evaluations
    
    # Multi-fidelity
    use_multi_fidelity: bool = False
    max_fidelity: float = 1.0
    min_fidelity: float = 0.1


class GaussianProcess:
    """
    Gaussian Process surrogate model.
    
    objective function'ı modellemek için kullanılır.
    """
    
    def __init__(
        self,
        kernel_type: str = "rbf",
        length_scale: float = 1.0,
        noise_level: float = 1e-5
    ):
        self.kernel_type = kernel_type
        self.length_scale = length_scale
        self.noise_level = noise_level
        
        self.X_train = None
        self.y_train = None
        self.K_inv = None
        
    def kernel(self, X1: np.ndarray, X2: np.ndarray) -> np.ndarray:
        """
        Kernel function (RBF by default).
        
        k(x, x') = exp(-||x - x'||^2 / (2 * l^2))
        """
        # Pairwise squared distances
        sq_dists = (
            np.sum(X1**2, axis=1).reshape(-1, 1) +
            np.sum(X2**2, axis=1) -
            2 * np.dot(X1, X2.T)
        )
        
        if self.kernel_type == "rbf":
            return np.exp(-0.5 * sq_dists / self.length_scale**2)
        elif self.kernel_type == "matern":
            # Matern 5/2
            dists = np.sqrt(sq_dists + 1e-10)
            sqrt_5 = np.sqrt(5)
            return (1 + sqrt_5 * dists / self.length_scale +
                   5 * sq_dists / (3 * self.length_scale**2)) * \
                   np.exp(-sqrt_5 * dists / self.length_scale)
        else:
            # Rational quadratic
            return (1 + sq_dists / (2 * self.length_scale**2)) ** -1
    
    def fit(self, X: np.ndarray, y: np.ndarray):
        """
        GP'yi eğit.
        
        Args:
            X: (n_samples, n_features) gözlemler
            y: (n_samples,) hedef değerler
        """
        self.X_train = X
        self.y_train = y
        
        # Kernel matrix
        K = self.kernel(X, X)
        K += self.noise_level * np.eye(len(X))
        
        # Invert using Cholesky decomposition
        try:
            L = np.linalg.cholesky(K)
            self.K_inv = np.linalg.solve(L.T, np.linalg.solve(L, np.eye(len(X))))
        except np.linalg.LinAlgError:
            # Fallback to regular inversion
            self.K_inv = np.linalg.inv(K)
    
    def predict(
        self,
        X_test: np.ndarray,
        return_std: bool = True
    ) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """
        Yeni noktalarda tahmin yap.
        
        Returns:
            mean: (n_test,) tahmin ortalamaları
            std: (n_test,) tahmin standart sapmaları
        """
        if self.X_train is None:
            raise RuntimeError("Model not fitted yet")
        
        # Kernel computations
        K_s = self.kernel(self.X_train, X_test)
        K_ss = self.kernel(X_test, X_test)
        
        # Mean
        mu = K_s.T @ self.K_inv @ self.y_train
        
        if return_std:
            # Variance
            var = np.diag(K_ss) - np.sum(K_s.T @ self.K_inv * K_s.T, axis=1)
            var = np.maximum(var, 0)  # Numerical stability
            std = np.sqrt(var)
            return mu, std
        
        return mu, None


class AcquisitionFunction:
    """
    Acquisition functions for Bayesian Optimization.
    
    Determines where to sample next.
    """
    
    def __init__(self, config: BayesOptConfig):
        self.config = config
        self.y_best = -np.inf
        
    def update_best(self, y_best: float):
        """En iyi gözlemi güncelle"""
        self.y_best = y_best
    
    def expected_improvement(
        self,
        mu: np.ndarray,
        std: np.ndarray,
        xi: float = None
    ) -> np.ndarray:
        """
        Expected Improvement (EI).
        
        EI(x) = E[max(0, f(x) - f_best)]
        """
        xi = xi or self.config.xi
        
        with np.errstate(divide='warn'):
            imp = mu - self.y_best - xi
            Z = imp / (std + 1e-9)
            ei = imp * norm.cdf(Z) + std * norm.pdf(Z)
            
        return ei
    
    def probability_of_improvement(
        self,
        mu: np.ndarray,
        std: np.ndarray,
        xi: float = None
    ) -> np.ndarray:
        """
        Probability of Improvement (PI).
        
        PI(x) = P(f(x) > f_best + xi)
        """
        xi = xi or self.config.xi
        
        with np.errstate(divide='warn'):
            Z = (mu - self.y_best - xi) / (std + 1e-9)
            pi = norm.cdf(Z)
            
        return pi
    
    def upper_confidence_bound(
        self,
        mu: np.ndarray,
        std: np.ndarray,
        kappa: float = None
    ) -> np.ndarray:
        """
        Upper Confidence Bound (UCB).
        
        UCB(x) = mu(x) + kappa * std(x)
        """
        kappa = kappa or self.config.kappa
        return mu + kappa * std
    
    def get_acquisition(
        self,
        mu: np.ndarray,
        std: np.ndarray
    ) -> np.ndarray:
        """Seçili acquisition function'ı uygula"""
        if self.config.acquisition_type == "ei":
            return self.expected_improvement(mu, std)
        elif self.config.acquisition_type == "pi":
            return self.probability_of_improvement(mu, std)
        elif self.config.acquisition_type == "ucb":
            return self.upper_confidence_bound(mu, std)
        else:
            raise ValueError(f"Unknown acquisition: {self.config.acquisition_type}")


class HyperparameterSpace:
    """
    Hyperparameter space definition.
    
    Supports:
    - Continuous parameters
    - Integer parameters
    - Categorical parameters
    - Log-scale parameters
    """
    
    def __init__(self):
        self.params: Dict[str, Dict] = {}
        
    def add_continuous(
        self,
        name: str,
        low: float,
        high: float,
        log_scale: bool = False
    ):
        """Sürekli parametre ekle"""
        self.params[name] = {
            'type': 'continuous',
            'low': low,
            'high': high,
            'log_scale': log_scale
        }
    
    def add_integer(
        self,
        name: str,
        low: int,
        high: int
    ):
        """Integer parametre ekle"""
        self.params[name] = {
            'type': 'integer',
            'low': low,
            'high': high
        }
    
    def add_categorical(
        self,
        name: str,
        choices: List[Any]
    ):
        """Kategorik parametre ekle"""
        self.params[name] = {
            'type': 'categorical',
            'choices': choices
        }
    
    def sample(self, n_samples: int = 1) -> List[Dict]:
        """Rastgele örnek çek"""
        samples = []
        
        for _ in range(n_samples):
            sample = {}
            for name, spec in self.params.items():
                if spec['type'] == 'continuous':
                    if spec['log_scale']:
                        log_low, log_high = np.log(spec['low']), np.log(spec['high'])
                        value = np.exp(np.random.uniform(log_low, log_high))
                    else:
                        value = np.random.uniform(spec['low'], spec['high'])
                    
                elif spec['type'] == 'integer':
                    value = np.random.randint(spec['low'], spec['high'] + 1)
                    
                elif spec['type'] == 'categorical':
                    value = np.random.choice(spec['choices'])
                
                sample[name] = value
            
            samples.append(sample)
        
        return samples[0] if n_samples == 1 else samples
    
    def to_array(self, sample: Dict) -> np.ndarray:
        """Sample'ı numpy array'e çevir"""
        values = []
        for name, spec in self.params.items():
            if spec['type'] == 'categorical':
                # One-hot encoding
                for choice in spec['choices']:
                    values.append(1.0 if sample[name] == choice else 0.0)
            else:
                # Normalize continuous/integer to [0, 1]
                value = sample[name]
                if spec['type'] == 'continuous' and spec['log_scale']:
                    value = np.log(value)
                    low, high = np.log(spec['low']), np.log(spec['high'])
                else:
                    low, high = spec['low'], spec['high']
                
                normalized = (value - low) / (high - low)
                values.append(normalized)
        
        return np.array(values)
    
    def from_array(self, array: np.ndarray) -> Dict:
        """Array'den sample oluştur"""
        sample = {}
        idx = 0
        
        for name, spec in self.params.items():
            if spec['type'] == 'categorical':
                # Decode one-hot
                n_choices = len(spec['choices'])
                choice_idx = np.argmax(array[idx:idx+n_choices])
                sample[name] = spec['choices'][choice_idx]
                idx += n_choices
            else:
                # Denormalize
                normalized = array[idx]
                
                if spec['type'] == 'continuous' and spec['log_scale']:
                    low, high = np.log(spec['low']), np.log(spec['high'])
                    value = np.exp(low + normalized * (high - low))
                else:
                    low, high = spec['low'], spec['high']
                    value = low + normalized * (high - low)
                    
                    if spec['type'] == 'integer':
                        value = int(round(value))
                
                sample[name] = value
                idx += 1
        
        return sample


class BayesianOptimizer:
    """
    Bayesian Optimization ana servisi.
    """
    
    def __init__(
        self,
        objective_fn: Callable[[Dict], float],
        space: HyperparameterSpace,
        config: BayesOptConfig
    ):
        self.objective_fn = objective_fn
        self.space = space
        self.config = config
        
        self.gp = GaussianProcess(
            kernel_type=config.kernel_type,
            length_scale=config.length_scale,
            noise_level=config.noise_level
        )
        self.acquisition = AcquisitionFunction(config)
        
        self.X_observed = []
        self.y_observed = []
        self.best_value = -np.inf
        self.best_params = None
        
    def optimize(self) -> Dict:
        """
        Bayesian Optimization çalıştır.
        
        Returns:
            En iyi parametreler ve değer
        """
        logger.info("Bayesian Optimization başlatıldı")
        
        # Initial random sampling
        logger.info(f"Initial sampling: {self.config.n_initial_points} points")
        for _ in range(self.config.n_initial_points):
            sample = self.space.sample()
            value = self._evaluate(sample)
            self._update_observations(sample, value)
        
        # Update acquisition with best value
        self.acquisition.update_best(self.best_value)
        
        # Sequential optimization
        for iteration in range(self.config.n_iterations):
            logger.info(f"Iteration {iteration + 1}/{self.config.n_iterations}")
            
            # Fit GP
            X_array = np.array(self.X_observed)
            y_array = np.array(self.y_observed)
            self.gp.fit(X_array, y_array)
            
            # Optimize acquisition function
            next_point = self._optimize_acquisition()
            
            # Evaluate
            value = self._evaluate(next_point)
            
            # Update
            self._update_observations(next_point, value)
            self.acquisition.update_best(self.best_value)
            
            logger.info(
                f"Best value: {self.best_value:.4f} "
                f"at params: {self.best_params}"
            )
        
        return {
            'best_params': self.best_params,
            'best_value': self.best_value,
            'n_observations': len(self.X_observed)
        }
    
    def _evaluate(self, params: Dict) -> float:
        """Objective function'ı değerlendir"""
        try:
            value = self.objective_fn(params)
            return value
        except Exception as e:
            logger.error(f"Evaluation error: {e}")
            return -np.inf
    
    def _update_observations(self, params: Dict, value: float):
        """Gözlemleri güncelle"""
        param_array = self.space.to_array(params)
        
        self.X_observed.append(param_array)
        self.y_observed.append(value)
        
        if value > self.best_value:
            self.best_value = value
            self.best_params = params
    
    def _optimize_acquisition(self) -> Dict:
        """Acquisition function'ı optimize et"""
        # Random sampling + local optimization
        n_random = 100
        best_acq = -np.inf
        best_point = None
        
        # Random sampling
        random_arrays = np.random.uniform(0, 1, (n_random, len(self.X_observed[0])))
        
        mu, std = self.gp.predict(random_arrays)
        acq_values = self.acquisition.get_acquisition(mu, std)
        
        best_idx = np.argmax(acq_values)
        best_point = random_arrays[best_idx]
        
        # Local optimization (L-BFGS-B)
        def neg_acquisition(x):
            x = x.reshape(1, -1)
            mu, std = self.gp.predict(x)
            acq = self.acquisition.get_acquisition(mu, std)[0]
            return -acq
        
        bounds = [(0, 1)] * len(self.X_observed[0])
        result = minimize(
            neg_acquisition,
            best_point,
            method='L-BFGS-B',
            bounds=bounds,
            options={'maxiter': 100}
        )
        
        # Convert back to parameter space
        return self.space.from_array(result.x)
    
    def parallel_optimize(self, n_workers: int = 4) -> Dict:
        """
        Paralel Bayesian Optimization.
        """
        logger.info(f"Parallel optimization with {n_workers} workers")
        
        # Initial sampling
        for _ in range(self.config.n_initial_points):
            sample = self.space.sample()
            value = self._evaluate(sample)
            self._update_observations(sample, value)
        
        self.acquisition.update_best(self.best_value)
        
        # Parallel iterations
        with ThreadPoolExecutor(max_workers=n_workers) as executor:
            for iteration in range(self.config.n_iterations // self.config.batch_size):
                # Fit GP
                X_array = np.array(self.X_observed)
                y_array = np.array(self.y_observed)
                self.gp.fit(X_array, y_array)
                
                # Get batch of points
                batch_points = []
                for _ in range(self.config.batch_size):
                    point = self._optimize_acquisition()
                    batch_points.append(point)
                
                # Parallel evaluation
                futures = {
                    executor.submit(self._evaluate, point): point
                    for point in batch_points
                }
                
                for future in as_completed(futures):
                    point = futures[future]
                    value = future.result()
                    self._update_observations(point, value)
        
        return {
            'best_params': self.best_params,
            'best_value': self.best_value
        }


class MultiFidelityOptimizer:
    """
    Multi-fidelity Bayesian Optimization.
    
    Düşük maliyetli approximations kullanarak hızlı optimizasyon.
    """
    
    def __init__(
        self,
        objective_fn: Callable[[Dict, float], float],
        space: HyperparameterSpace,
        config: BayesOptConfig
    ):
        self.objective_fn = objective_fn
        self.space = space
        self.config = config
        
    def optimize(self) -> Dict:
        """
        Multi-fidelity optimization.
        
        Başlangıçta düşük fidelity ile hızlı keşif,
        sonra yüksek fidelity ile refine.
        """
        logger.info("Multi-fidelity optimization başlatıldı")
        
        # Phase 1: Low-fidelity optimization
        logger.info("Phase 1: Low-fidelity optimization")
        
        def low_fidelity_objective(params):
            return self.objective_fn(params, self.config.min_fidelity)
        
        low_fidelity_opt = BayesianOptimizer(
            low_fidelity_objective,
            self.space,
            self.config
        )
        
        low_result = low_fidelity_opt.optimize()
        
        # Phase 2: High-fidelity refinement around best regions
        logger.info("Phase 2: High-fidelity refinement")
        
        # Narrow search space around best params
        narrow_space = HyperparameterSpace()
        
        for name, spec in self.space.params.items():
            best_val = low_result['best_params'][name]
            
            if spec['type'] == 'continuous':
                # ±20% around best value
                range_size = spec['high'] - spec['low']
                new_low = max(spec['low'], best_val - 0.2 * range_size)
                new_high = min(spec['high'], best_val + 0.2 * range_size)
                narrow_space.add_continuous(name, new_low, new_high, spec.get('log_scale', False))
            elif spec['type'] == 'integer':
                narrow_space.add_integer(name, spec['low'], spec['high'])
            else:
                narrow_space.add_categorical(name, spec['choices'])
        
        def high_fidelity_objective(params):
            return self.objective_fn(params, self.config.max_fidelity)
        
        high_fidelity_opt = BayesianOptimizer(
            high_fidelity_objective,
            narrow_space,
            self.config
        )
        
        # Initialize with low-fidelity best
        high_fidelity_opt._update_observations(
            low_result['best_params'],
            self.objective_fn(low_result['best_params'], self.config.max_fidelity)
        )
        
        high_result = high_fidelity_opt.optimize()
        
        return {
            'best_params': high_result['best_params'],
            'best_value': high_result['best_value'],
            'low_fidelity_best': low_result['best_params'],
            'total_evaluations': len(low_fidelity_opt.X_observed) + len(high_fidelity_opt.X_observed)
        }


# Global Bayesian optimization servisi
def example_objective(params: Dict) -> float:
    """Örnek objective function (Himmelblau function)"""
    x = params.get('x', 0)
    y = params.get('y', 0)
    
    # Himmelblau function
    value = -((x**2 + y - 11)**2 + (x + y**2 - 7)**2)
    
    return value

# bayes_config = BayesOptConfig(n_iterations=20)
# space = HyperparameterSpace()
# space.add_continuous('x', -5, 5)
# space.add_continuous('y', -5, 5)
# optimizer = BayesianOptimizer(example_objective, space, bayes_config)
# result = optimizer.optimize()
