"""
OptiPlan 360 - Causal Inference Service
AI-034: Causal discovery ve counterfactual analysis

Bu modül:
- Causal graph discovery (PC algorithm, GES)
- Do-calculus
- Counterfactual reasoning
- Propensity score matching
- Instrumental variables
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass
from collections import defaultdict
import logging
from itertools import combinations

logger = logging.getLogger(__name__)


@dataclass
class CausalEdge:
    """Causal graph edge"""
    source: str
    target: str
    weight: float = 1.0
    is_directed: bool = True


@dataclass
class CounterfactualResult:
    """Counterfactual analiz sonucu"""
    factual_outcome: float
    counterfactual_outcome: float
    treatment_effect: float
    confidence_interval: Tuple[float, float]


class CausalGraph:
    """
    Causal Directed Acyclic Graph (DAG).
    """
    
    def __init__(self):
        self.nodes: Set[str] = set()
        self.edges: List[CausalEdge] = []
        self.adjacency: Dict[str, Set[str]] = defaultdict(set)
        self.parents: Dict[str, Set[str]] = defaultdict(set)
        
    def add_edge(self, source: str, target: str, weight: float = 1.0):
        """Edge ekle"""
        self.nodes.add(source)
        self.nodes.add(target)
        
        edge = CausalEdge(source, target, weight, True)
        self.edges.append(edge)
        self.adjacency[source].add(target)
        self.parents[target].add(source)
    
    def remove_edge(self, source: str, target: str):
        """Edge kaldır"""
        self.edges = [e for e in self.edges if not (e.source == source and e.target == target)]
        self.adjacency[source].discard(target)
        self.parents[target].discard(source)
    
    def is_d_separated(self, x: str, y: str, conditioning_set: Set[str]) -> bool:
        """
        D-separation test.
        
        X ve Y d-separated mı given Z?
        """
        # Simple path-based test (not complete)
        all_paths = self._find_all_paths(x, y)
        
        for path in all_paths:
            if not self._is_blocked(path, conditioning_set):
                return False
        
        return True
    
    def _find_all_paths(self, start: str, end: str) -> List[List[str]]:
        """İki node arasındaki tüm path'leri bul"""
        paths = []
        visited = set()
        
        def dfs(current, path):
            if current == end:
                paths.append(path[:])
                return
            
            visited.add(current)
            for neighbor in self.adjacency[current]:
                if neighbor not in visited:
                    path.append(neighbor)
                    dfs(neighbor, path)
                    path.pop()
            visited.remove(current)
        
        dfs(start, [start])
        return paths
    
    def _is_blocked(self, path: List[str], conditioning_set: Set[str]) -> bool:
        """Path blocked mı?"""
        for i in range(1, len(path) - 1):
            node = path[i]
            prev_node = path[i - 1]
            next_node = path[i + 1]
            
            # Collider: A -> B <- C
            is_collider = node in self.parents[prev_node] and node in self.parents[next_node]
            
            if is_collider:
                # Collider veya descendant'ı conditioning set'te değilse path blocked
                if node not in conditioning_set:
                    return True
            else:
                # Chain veya fork, node conditioning set'te ise blocked
                if node in conditioning_set:
                    return True
        
        return False
    
    def topological_sort(self) -> List[str]:
        """Topological sort (causal ordering)"""
        in_degree = {node: 0 for node in self.nodes}
        
        for node in self.nodes:
            for child in self.adjacency[node]:
                in_degree[child] += 1
        
        queue = [node for node in self.nodes if in_degree[node] == 0]
        result = []
        
        while queue:
            node = queue.pop(0)
            result.append(node)
            
            for child in self.adjacency[node]:
                in_degree[child] -= 1
                if in_degree[child] == 0:
                    queue.append(child)
        
        return result
    
    def to_pydot(self):
        """Pydot graph'e çevir (visualization için)"""
        try:
            import pydot
            graph = pydot.Dot(graph_type='digraph')
            
            for node in self.nodes:
                graph.add_node(pydot.Node(node))
            
            for edge in self.edges:
                graph.add_edge(pydot.Edge(edge.source, edge.target, label=f"{edge.weight:.2f}"))
            
            return graph
        except ImportError:
            logger.warning("pydot bulunamadı, graph oluşturulamadı")
            return None


class PCAlgorithm:
    """
    PC Algorithm for causal discovery.
    
    Conditional independence test'leri kullanarak causal skeleton bul,
    sonra orientation rules uygula.
    """
    
    def __init__(self, alpha: float = 0.05):
        self.alpha = alpha
        self.sepset: Dict[Tuple[str, str], Set[str]] = {}
        
    def fit(self, data: pd.DataFrame) -> CausalGraph:
        """
        PC algorithm çalıştır.
        
        Args:
            data: DataFrame with columns as variables
            
        Returns:
            CausalGraph
        """
        variables = list(data.columns)
        n = len(variables)
        
        # Step 1: Initialize fully connected graph
        graph = CausalGraph()
        for var in variables:
            graph.nodes.add(var)
        
        # Step 2: Remove edges based on conditional independence
        depth = 0
        while depth < n - 1:
            for x, y in combinations(variables, 2):
                if y not in graph.adjacency[x]:
                    continue
                
                # Find conditioning sets
                adj_x = graph.adjacency[x] - {y}
                
                if len(adj_x) >= depth:
                    for z in combinations(adj_x, depth):
                        z_set = set(z)
                        
                        # Conditional independence test
                        if self._conditional_independence_test(data, x, y, z_set):
                            graph.remove_edge(x, y)
                            graph.remove_edge(y, x)
                            self.sepset[(x, y)] = z_set
                            self.sepset[(y, x)] = z_set
                            break
            
            depth += 1
        
        # Step 3: Orient edges
        self._orient_edges(graph)
        
        return graph
    
    def _conditional_independence_test(
        self,
        data: pd.DataFrame,
        x: str,
        y: str,
        z: Set[str]
    ) -> bool:
        """
        Conditional independence test (partial correlation).
        
        Returns True if X ⟂ Y | Z
        """
        from scipy.stats import pearsonr
        
        if len(z) == 0:
            # Unconditional test
            corr, p_value = pearsonr(data[x], data[y])
        else:
            # Conditional test using partial correlation
            # Residualize X and Y on Z
            z_list = list(z)
            
            if len(z_list) == 1:
                # Simple partial correlation
                z_var = data[z_list[0]]
                
                # Residualize X
                beta_x = np.polyfit(z_var, data[x], 1)
                resid_x = data[x] - np.polyval(beta_x, z_var)
                
                # Residualize Y
                beta_y = np.polyfit(z_var, data[y], 1)
                resid_y = data[y] - np.polyval(beta_y, z_var)
                
                corr, p_value = pearsonr(resid_x, resid_y)
            else:
                # Multiple regression residualization
                from sklearn.linear_model import LinearRegression
                
                Z = data[z_list].values
                
                reg_x = LinearRegression().fit(Z, data[x])
                resid_x = data[x] - reg_x.predict(Z)
                
                reg_y = LinearRegression().fit(Z, data[y])
                resid_y = data[y] - reg_y.predict(Z)
                
                corr, p_value = pearsonr(resid_x, resid_y)
        
        return p_value > self.alpha
    
    def _orient_edges(self, graph: CausalGraph):
        """Orient edges using PC orientation rules"""
        # Rule 1: Orient v-structures (colliders)
        for x, y, z in combinations(graph.nodes, 3):
            if (y in graph.adjacency[x] and y in graph.adjacency[z] and
                x not in graph.adjacency[z] and z not in graph.adjacency[x]):
                
                # Check if y not in sepset of x, z
                if y not in self.sepset.get((x, z), set()):
                    # Orient: x -> y <- z
                    graph.remove_edge(y, x)
                    graph.remove_edge(y, z)


class PropensityScoreMatching:
    """
    Propensity Score Matching.
    
    Observational data'da causal effect estimation için.
    """
    
    def __init__(self, estimator: str = "logistic"):
        self.estimator = estimator
        self.propensity_model = None
        
    def fit(self, X: np.ndarray, T: np.ndarray):
        """
        Propensity scores tahmin et.
        
        Args:
            X: Covariates (n, d)
            T: Treatment assignment (n,)
        """
        from sklearn.linear_model import LogisticRegression
        from sklearn.ensemble import RandomForestClassifier
        
        if self.estimator == "logistic":
            self.propensity_model = LogisticRegression(max_iter=1000)
        elif self.estimator == "random_forest":
            self.propensity_model = RandomForestClassifier(n_estimators=100)
        
        self.propensity_model.fit(X, T)
        
    def get_propensity_scores(self, X: np.ndarray) -> np.ndarray:
        """Propensity scores döndür"""
        if self.propensity_model is None:
            raise RuntimeError("Model not fitted yet")
        
        return self.propensity_model.predict_proba(X)[:, 1]
    
    def estimate_ate(
        self,
        X: np.ndarray,
        T: np.ndarray,
        Y: np.ndarray,
        method: str = "matching"
    ) -> float:
        """
        Average Treatment Effect (ATE) tahmin et.
        
        Args:
            X: Covariates
            T: Treatment (binary)
            Y: Outcome
            method: "matching", "weighting", or "stratification"
            
        Returns:
            ATE estimate
        """
        # Fit propensity model
        self.fit(X, T)
        
        # Get propensity scores
        ps = self.get_propensity_scores(X)
        
        if method == "matching":
            return self._matching_estimator(X, T, Y, ps)
        elif method == "weighting":
            return self._weighting_estimator(T, Y, ps)
        elif method == "stratification":
            return self._stratification_estimator(T, Y, ps)
        else:
            raise ValueError(f"Unknown method: {method}")
    
    def _matching_estimator(
        self,
        X: np.ndarray,
        T: np.ndarray,
        Y: np.ndarray,
        ps: np.ndarray
    ) -> float:
        """Nearest neighbor matching estimator"""
        from sklearn.neighbors import NearestNeighbors
        
        treated_idx = np.where(T == 1)[0]
        control_idx = np.where(T == 0)[0]
        
        # Match treated to control
        nn = NearestNeighbors(n_neighbors=1)
        nn.fit(ps[control_idx].reshape(-1, 1))
        
        distances, indices = nn.kneighbors(ps[treated_idx].reshape(-1, 1))
        matched_control_idx = control_idx[indices.flatten()]
        
        # Calculate ATE
        ate = np.mean(Y[treated_idx] - Y[matched_control_idx])
        
        return ate
    
    def _weighting_estimator(self, T: np.ndarray, Y: np.ndarray, ps: np.ndarray) -> float:
        """Inverse probability weighting (IPW) estimator"""
        # IPW weights
        weights_treated = T / (ps + 1e-10)
        weights_control = (1 - T) / (1 - ps + 1e-10)
        
        # Weighted means
        mean_treated = np.sum(weights_treated * Y) / np.sum(weights_treated)
        mean_control = np.sum(weights_control * Y) / np.sum(weights_control)
        
        return mean_treated - mean_control
    
    def _stratification_estimator(self, T: np.ndarray, Y: np.ndarray, ps: np.ndarray) -> float:
        """Stratification (subclassification) estimator"""
        # Create strata based on propensity score quintiles
        strata = pd.qcut(ps, q=5, labels=False)
        
        ates = []
        weights = []
        
        for s in range(5):
            mask = strata == s
            
            treated = mask & (T == 1)
            control = mask & (T == 0)
            
            if treated.sum() > 0 and control.sum() > 0:
                mean_treated = Y[treated].mean()
                mean_control = Y[control].mean()
                
                ates.append(mean_treated - mean_control)
                weights.append(mask.sum())
        
        # Weighted average
        ate = np.average(ates, weights=weights)
        
        return ate


class CounterfactualEstimator:
    """
    Counterfactual outcome estimation.
    
    "What would have happened if...?"
    """
    
    def __init__(self, causal_graph: CausalGraph):
        self.graph = causal_graph
        
    def estimate_counterfactual(
        self,
        data: pd.DataFrame,
        intervention: Dict[str, any],
        outcome_var: str,
        evidence: Dict[str, any]
    ) -> CounterfactualResult:
        """
        Counterfactual outcome tahmin et.
        
        Args:
            data: Observational data
            intervention: {var: value} - intervention (do-operator)
            outcome_var: Target outcome variable
            evidence: Observed evidence
            
        Returns:
            CounterfactualResult
        """
        # Step 1: Abduction - infer exogenous variables
        exogenous = self._abduction(data, evidence)
        
        # Step 2: Action - apply intervention
        modified_exogenous = self._apply_intervention(exogenous, intervention)
        
        # Step 3: Prediction - predict outcome
        counterfactual_outcome = self._predict_outcome(
            modified_exogenous,
            outcome_var
        )
        
        # Factual outcome
        factual_outcome = evidence.get(outcome_var, 0)
        
        # Treatment effect
        treatment_effect = counterfactual_outcome - factual_outcome
        
        # Confidence interval (simplified)
        ci = (treatment_effect - 0.1, treatment_effect + 0.1)
        
        return CounterfactualResult(
            factual_outcome=factual_outcome,
            counterfactual_outcome=counterfactual_outcome,
            treatment_effect=treatment_effect,
            confidence_interval=ci
        )
    
    def _abduction(self, data: pd.DataFrame, evidence: Dict[str, any]) -> Dict[str, float]:
        """Infer exogenous variables from evidence"""
        # Simplified: use residuals from regression
        exogenous = {}
        
        for var in self.graph.nodes:
            parents = self.graph.parents[var]
            
            if len(parents) > 0:
                # Regression on parents
                parent_vars = list(parents)
                if all(p in evidence for p in parent_vars) and var in evidence:
                    # Simple linear regression
                    y = evidence[var]
                    x_vals = [evidence[p] for p in parent_vars]
                    
                    # Residual as exogenous
                    predicted = np.mean(x_vals)  # Simplified
                    exogenous[var] = y - predicted
            else:
                # Root node
                exogenous[var] = evidence.get(var, 0)
        
        return exogenous
    
    def _apply_intervention(
        self,
        exogenous: Dict[str, float],
        intervention: Dict[str, any]
    ) -> Dict[str, float]:
        """Apply do-operator intervention"""
        modified = exogenous.copy()
        
        for var, value in intervention.items():
            # Intervention overrides exogenous
            modified[var] = value
        
        return modified
    
    def _predict_outcome(
        self,
        exogenous: Dict[str, float],
        outcome_var: str
    ) -> float:
        """Predict outcome from modified exogenous"""
        # Simplified: just return the value
        # In practice, this would propagate through the causal graph
        return exogenous.get(outcome_var, 0)


class InstrumentalVariableEstimator:
    """
    Instrumental Variable (IV) estimation.
    
    For causal inference with unobserved confounding.
    """
    
    def __init__(self):
        self.first_stage_model = None
        self.second_stage_model = None
        
    def estimate_late(
        self,
        Z: np.ndarray,  # Instrument
        T: np.ndarray,  # Treatment
        Y: np.ndarray,  # Outcome
        X: Optional[np.ndarray] = None  # Covariates
    ) -> Dict[str, float]:
        """
        Local Average Treatment Effect (LATE) tahmin et.
        
        Two-stage least squares (2SLS).
        
        Returns:
            {'late': float, 'first_stage_fstat': float, 'se': float}
        """
        from sklearn.linear_model import LinearRegression
        
        # Stage 1: T ~ Z + X
        if X is not None:
            Z_stage1 = np.column_stack([Z, X])
        else:
            Z_stage1 = Z.reshape(-1, 1)
        
        self.first_stage_model = LinearRegression()
        self.first_stage_model.fit(Z_stage1, T)
        
        # Predicted treatment
        T_hat = self.first_stage_model.predict(Z_stage1)
        
        # First stage F-statistic (simplified)
        first_stage_f = np.var(T_hat) / np.var(T - T_hat)
        
        # Stage 2: Y ~ T_hat + X
        if X is not None:
            X_stage2 = np.column_stack([T_hat, X])
        else:
            X_stage2 = T_hat.reshape(-1, 1)
        
        self.second_stage_model = LinearRegression()
        self.second_stage_model.fit(X_stage2, Y)
        
        # LATE is coefficient on T_hat
        late = self.second_stage_model.coef_[0]
        
        # Standard error (simplified)
        resid = Y - self.second_stage_model.predict(X_stage2)
        se = np.std(resid) / np.sqrt(len(Y))
        
        return {
            'late': late,
            'first_stage_fstat': first_stage_f,
            'se': se,
            'lower_ci': late - 1.96 * se,
            'upper_ci': late + 1.96 * se
        }


class CausalInferenceService:
    """
    Causal inference unified service.
    """
    
    def __init__(self):
        self.graph = None
        self.pc_algorithm = PCAlgorithm()
        self.psm = PropensityScoreMatching()
        self.iv_estimator = InstrumentalVariableEstimator()
        
    def discover_graph(self, data: pd.DataFrame, method: str = "pc") -> CausalGraph:
        """
        Causal graph discovery.
        
        Args:
            data: DataFrame
            method: "pc" or "ges"
            
        Returns:
            CausalGraph
        """
        if method == "pc":
            self.graph = self.pc_algorithm.fit(data)
        else:
            raise ValueError(f"Unknown method: {method}")
        
        return self.graph
    
    def estimate_ate(
        self,
        X: np.ndarray,
        T: np.ndarray,
        Y: np.ndarray,
        method: str = "psm"
    ) -> float:
        """Average Treatment Effect tahmin et"""
        if method == "psm":
            return self.psm.estimate_ate(X, T, Y)
        else:
            raise ValueError(f"Unknown method: {method}")
    
    def counterfactual_query(
        self,
        data: pd.DataFrame,
        intervention: Dict[str, any],
        outcome: str,
        evidence: Dict[str, any]
    ) -> CounterfactualResult:
        """Counterfactual query"""
        if self.graph is None:
            raise RuntimeError("Causal graph not discovered yet")
        
        estimator = CounterfactualEstimator(self.graph)
        return estimator.estimate_counterfactual(
            data, intervention, outcome, evidence
        )
    
    def iv_estimate(
        self,
        Z: np.ndarray,
        T: np.ndarray,
        Y: np.ndarray
    ) -> Dict:
        """Instrumental variable estimation"""
        return self.iv_estimator.estimate_late(Z, T, Y)


# Global causal inference servisi
causal_service = CausalInferenceService()
