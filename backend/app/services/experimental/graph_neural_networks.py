"""
Graph Neural Networks and Network Analysis System
Advanced GNNs with graph neural networks, network analysis, and graph learning
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
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch_geometric.nn import GCNConv, GATConv, GraphSAGE, GINConv, global_mean_pool, global_max_pool
from torch_geometric.data import Data, Batch
from torch_geometric.loader import DataLoader
import networkx as nx
from sklearn.metrics import accuracy_score, mean_squared_error, f1_score
from sklearn.preprocessing import StandardScaler
import joblib
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class GNNType(Enum):
    """GNN types"""
    GCN = "gcn"
    GAT = "gat"
    GRAPHSAGE = "graphsage"
    GIN = "gin"
    GRAPH_TRANSFORMER = "graph_transformer"
    MPNN = "mpnn"
    DGN = "dgn"
    SE_GNN = "se_gnn"
    HETEROGENEOUS_GNN = "heterogeneous_gnn"


class TaskType(Enum):
    """Task types"""
    NODE_CLASSIFICATION = "node_classification"
    GRAPH_CLASSIFICATION = "graph_classification"
    LINK_PREDICTION = "link_prediction"
    NODE_REGRESSION = "node_regression"
    GRAPH_REGRESSION = "graph_regression"
    COMMUNITY_DETECTION = "community_detection"
    ANOMALY_DETECTION = "anomaly_detection"


class AggregationType(Enum):
    """Aggregation types"""
    MEAN = "mean"
    MAX = "max"
    SUM = "sum"
    ATTENTION = "attention"
    SET2SET = "set2set"
    SORTPOOL = "sortpool"


@dataclass
class GNNConfig:
    """GNN configuration"""
    gnn_type: GNNType
    task_type: TaskType
    input_dim: int
    hidden_dim: int = 64
    output_dim: int
    num_layers: int = 3
    dropout: float = 0.1
    activation: str = "relu"
    aggregation_type: AggregationType = AggregationType.MEAN
    num_heads: int = 8
    edge_dim: int = 0
    use_batch_norm: bool = True
    use_residual: bool = True
    learning_rate: float = 0.001
    weight_decay: float = 1e-5
    max_epochs: int = 100
    early_stopping_patience: int = 10


@dataclass
class GraphData:
    """Graph data representation"""
    graph_id: str
    num_nodes: int
    num_edges: int
    node_features: torch.Tensor
    edge_index: torch.Tensor
    edge_features: Optional[torch.Tensor] = None
    node_labels: Optional[torch.Tensor] = None
    edge_labels: Optional[torch.Tensor] = None
    graph_labels: Optional[torch.Tensor] = None
    node_names: Optional[List[str]] = None
    edge_names: Optional[List[Tuple[str, str]]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class GNNResult:
    """GNN training/evaluation result"""
    experiment_id: str
    gnn_type: GNNType
    task_type: TaskType
    trained_model: nn.Module
    training_history: Dict[str, List[float]]
    test_metrics: Dict[str, float]
    best_epoch: int
    training_time_seconds: float
    model_parameters: int
    model_size_mb: float
    graph_statistics: Dict[str, Any]
    created_at: datetime = field(default_factory=datetime.utcnow)


class GCNLayer(nn.Module):
    """Graph Convolutional Network Layer"""
    
    def __init__(self, in_channels: int, out_channels: int, dropout: float = 0.1, 
                 activation: str = "relu", use_batch_norm: bool = True):
        super().__init__()
        self.conv = GCNConv(in_channels, out_channels)
        self.dropout = nn.Dropout(dropout)
        self.activation = getattr(F, activation)
        self.batch_norm = nn.BatchNorm1d(out_channels) if use_batch_norm else nn.Identity()
    
    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """Forward pass"""
        x = self.conv(x, edge_index)
        x = self.batch_norm(x)
        x = self.activation(x)
        x = self.dropout(x)
        return x


class GATLayer(nn.Module):
    """Graph Attention Network Layer"""
    
    def __init__(self, in_channels: int, out_channels: int, heads: int = 8, 
                 dropout: float = 0.1, activation: str = "relu", use_batch_norm: bool = True):
        super().__init__()
        self.attention = GATConv(in_channels, out_channels, heads=heads, dropout=dropout, concat=False)
        self.dropout = nn.Dropout(dropout)
        self.activation = getattr(F, activation)
        self.batch_norm = nn.BatchNorm1d(out_channels) if use_batch_norm else nn.Identity()
    
    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """Forward pass"""
        x = self.attention(x, edge_index)
        x = self.batch_norm(x)
        x = self.activation(x)
        x = self.dropout(x)
        return x


class GraphSAGELayer(nn.Module):
    """GraphSAGE Layer"""
    
    def __init__(self, in_channels: int, out_channels: int, dropout: float = 0.1,
                 activation: str = "relu", use_batch_norm: bool = True):
        super().__init__()
        self.conv = GraphSAGE(in_channels, out_channels)
        self.dropout = nn.Dropout(dropout)
        self.activation = getattr(F, activation)
        self.batch_norm = nn.BatchNorm1d(out_channels) if use_batch_norm else nn.Identity()
    
    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """Forward pass"""
        x = self.conv(x, edge_index)
        x = self.batch_norm(x)
        x = self.activation(x)
        x = self.dropout(x)
        return x


class GINLayer(nn.Module):
    """Graph Isomorphism Network Layer"""
    
    def __init__(self, in_channels: int, out_channels: int, dropout: float = 0.1,
                 activation: str = "relu", use_batch_norm: bool = True):
        super().__init__()
        self.mlp = nn.Sequential(
            nn.Linear(in_channels, out_channels),
            nn.BatchNorm1d(out_channels) if use_batch_norm else nn.Identity(),
            nn.ReLU() if activation == "relu" else getattr(F, activation),
            nn.Linear(out_channels, out_channels)
        )
        self.dropout = nn.Dropout(dropout)
        self.activation = getattr(F, activation)
        self.batch_norm = nn.BatchNorm1d(out_channels) if use_batch_norm else nn.Identity()
    
    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """Forward pass"""
        x = self.mlp(x)
        x = self.batch_norm(x)
        x = self.activation(x)
        x = self.dropout(x)
        return x


class GraphTransformerLayer(nn.Module):
    """Graph Transformer Layer"""
    
    def __init__(self, in_channels: int, out_channels: int, heads: int = 8,
                 dropout: float = 0.1, activation: str = "relu"):
        super().__init__()
        self.in_channels = in_channels
        self.out_channels = out_channels
        self.heads = heads
        self.head_dim = out_channels // heads
        
        # Linear projections
        self.q_linear = nn.Linear(in_channels, out_channels)
        self.k_linear = nn.Linear(in_channels, out_channels)
        self.v_linear = nn.Linear(in_channels, out_channels)
        self.out_linear = nn.Linear(out_channels, out_channels)
        
        self.dropout = nn.Dropout(dropout)
        self.activation = getattr(F, activation)
        self.layer_norm = nn.LayerNorm(out_channels)
        
    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """Forward pass"""
        batch_size, num_nodes, _ = x.size()
        
        # Linear projections
        Q = self.q_linear(x).view(batch_size, num_nodes, self.heads, self.head_dim)
        K = self.k_linear(x).view(batch_size, num_nodes, self.heads, self.head_dim)
        V = self.v_linear(x).view(batch_size, num_nodes, self.heads, self.head_dim)
        
        # Scaled dot-product attention
        scores = torch.matmul(Q, K.transpose(-2, -1)) / (self.head_dim ** 0.5)
        
        # Create attention mask (simplified)
        mask = torch.zeros(num_nodes, num_nodes, device=x.device)
        for i in range(edge_index.size(1)):
            mask[edge_index[0, i], edge_index[1, i]] = 1
            mask[edge_index[1, i], edge_index[0, i]] = 1
        
        mask = mask.unsqueeze(0).unsqueeze(0).unsqueeze(0)
        scores = scores.masked_fill(mask == 0, -1e9)
        
        # Attention weights
        attention_weights = F.softmax(scores, dim=-1)
        attention_weights = self.dropout(attention_weights)
        
        # Attention output
        attended = torch.matmul(attention_weights, V)
        attended = attended.view(batch_size, num_nodes, self.out_channels)
        
        # Output projection and residual
        output = self.out_linear(attended)
        output = self.layer_norm(output + x)
        output = self.activation(output)
        
        return output


class GNNModel(nn.Module):
    """Complete GNN Model"""
    
    def __init__(self, config: GNNConfig):
        super().__init__()
        self.config = config
        self.layers = nn.ModuleList()
        
        # Build layers
        for i in range(config.num_layers):
            if i == 0:
                in_dim = config.input_dim
            else:
                in_dim = config.hidden_dim
            
            if i == config.num_layers - 1:
                out_dim = config.output_dim
            else:
                out_dim = config.hidden_dim
            
            if config.gnn_type == GNNType.GCN:
                layer = GCNLayer(in_dim, out_dim, config.dropout, config.activation, config.use_batch_norm)
            elif config.gnn_type == GNNType.GAT:
                layer = GATLayer(in_dim, out_dim, config.num_heads, config.dropout, config.activation, config.use_batch_norm)
            elif config.gnn_type == GNNType.GRAPHSAGE:
                layer = GraphSAGELayer(in_dim, out_dim, config.dropout, config.activation, config.use_batch_norm)
            elif config.gnn_type == GNNType.GIN:
                layer = GINLayer(in_dim, out_dim, config.dropout, config.activation, config.use_batch_norm)
            elif config.gnn_type == GNNType.GRAPH_TRANSFORMER:
                layer = GraphTransformerLayer(in_dim, out_dim, config.num_heads, config.dropout, config.activation)
            else:
                layer = GCNLayer(in_dim, out_dim, config.dropout, config.activation, config.use_batch_norm)
            
            self.layers.append(layer)
    
    def forward(self, x: torch.Tensor, edge_index: torch.Tensor, 
                batch: Optional[torch.Tensor] = None) -> torch.Tensor:
        """Forward pass"""
        for i, layer in enumerate(self.layers):
            x = layer(x, edge_index)
            
            # Residual connection
            if self.config.use_residual and i > 0:
                if x.size(-1) == self.layers[i-1].output_dim if hasattr(self.layers[i-1], 'output_dim') else x.size(-1):
                    x = x + x
        
        return x


class GraphAnalyzer:
    """Graph analysis utilities"""
    
    def __init__(self):
        pass
    
    def calculate_graph_statistics(self, graph_data: GraphData) -> Dict[str, Any]:
        """Calculate comprehensive graph statistics"""
        try:
            # Create NetworkX graph
            G = nx.Graph()
            
            # Add nodes
            if graph_data.node_names:
                for i, name in enumerate(graph_data.node_names):
                    G.add_node(i, name=name)
            else:
                G.add_nodes_from(range(graph_data.num_nodes))
            
            # Add edges
            if graph_data.edge_names:
                for i, (src, dst) in enumerate(graph_data.edge_names):
                    G.add_edge(src, dst, name=f"edge_{i}")
            else:
                edge_list = graph_data.edge_index.t().tolist()
                G.add_edges_from(edge_list)
            
            # Calculate basic statistics
            stats = {
                'num_nodes': G.number_of_nodes(),
                'num_edges': G.number_of_edges(),
                'density': nx.density(G),
                'is_connected': nx.is_connected(G),
                'num_components': nx.number_connected_components(G),
                'average_clustering': nx.average_clustering(G),
                'transitivity': nx.transitivity(G),
            }
            
            # Degree statistics
            degrees = dict(G.degree())
            degree_values = list(degrees.values())
            if degree_values:
                stats.update({
                    'avg_degree': np.mean(degree_values),
                    'max_degree': max(degree_values),
                    'min_degree': min(degree_values),
                    'degree_std': np.std(degree_values),
                    'degree_distribution': degree_values
                })
            
            # Path statistics
            if nx.is_connected(G):
                stats.update({
                    'diameter': nx.diameter(G),
                    'average_path_length': nx.average_shortest_path_length(G),
                    'radius': nx.radius(G),
                })
            
            # Centrality measures
            centrality_measures = {
                'degree_centrality': nx.degree_centrality(G),
                'betweenness_centrality': nx.betweenness_centrality(G),
                'closeness_centrality': nx.closeness_centrality(G),
                'eigenvector_centrality': nx.eigenvector_centrality(G),
                'pagerank': nx.pagerank(G),
            }
            
            # Aggregate centrality statistics
            for measure_name, values in centrality_measures.items():
                centrality_values = list(values.values())
                if centrality_values:
                    stats[f'{measure_name}_mean'] = np.mean(centrality_values)
                    stats[f'{measure_name}_max'] = max(centrality_values)
                    stats[f'{measure_name}_std'] = np.std(centrality_values)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error calculating graph statistics: {e}")
            return {}
    
    def detect_communities(self, graph_data: GraphData, method: str = "louvain") -> Dict[str, Any]:
        """Detect communities in graph"""
        try:
            # Create NetworkX graph
            G = nx.Graph()
            edge_list = graph_data.edge_index.t().tolist()
            G.add_edges_from(edge_list)
            
            # Community detection
            if method == "louvain":
                try:
                    import community as community_louvain
                    communities = community_louvain.best_partition(G)
                except ImportError:
                    # Fallback to modularity
                    communities = nx.algorithms.community.modularity_max.greedy_modularity_communities(G)
                    communities = {node: i for i, comm in enumerate(communities) for node in comm}
            elif method == "label_propagation":
                communities = nx.algorithms.community.label_propagation.label_propagation_communities(G)
                communities = {node: i for i, comm in enumerate(communities) for node in comm}
            else:
                # Default to greedy modularity
                communities = nx.algorithms.community.modularity_max.greedy_modularity_communities(G)
                communities = {node: i for i, comm in enumerate(communities) for node in comm}
            
            # Calculate community statistics
            community_stats = {
                'num_communities': len(set(communities.values())),
                'modularity': nx.algorithms.community.modularity(G, list(communities.values())),
                'communities': communities
            }
            
            return community_stats
            
        except Exception as e:
            logger.error(f"Error detecting communities: {e}")
            return {}
    
    def find_anomalies(self, graph_data: GraphData, method: str = "degree") -> List[int]:
        """Find anomalous nodes in graph"""
        try:
            # Create NetworkX graph
            G = nx.Graph()
            edge_list = graph_data.edge_index.t().tolist()
            G.add_edges_from(edge_list)
            
            anomalies = []
            
            if method == "degree":
                # Degree-based anomaly detection
                degrees = dict(G.degree())
                degree_values = list(degrees.values())
                
                if degree_values:
                    mean_degree = np.mean(degree_values)
                    std_degree = np.std(degree_values)
                    threshold = mean_degree + 2 * std_degree
                    
                    anomalies = [node for node, degree in degrees.items() 
                               if degree > threshold]
            
            elif method == "centrality":
                # Centrality-based anomaly detection
                centrality = nx.betweenness_centrality(G)
                centrality_values = list(centrality.values())
                
                if centrality_values:
                    mean_centrality = np.mean(centrality_values)
                    std_centrality = np.std(centrality_values)
                    threshold = mean_centrality + 2 * std_centrality
                    
                    anomalies = [node for node, cent in centrality.items() 
                               if cent > threshold]
            
            return anomalies
            
        except Exception as e:
            logger.error(f"Error finding anomalies: {e}")
            return []


class GNNTrainer:
    """GNN training engine"""
    
    def __init__(self, config: GNNConfig):
        self.config = config
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = GNNModel(config)
        self.model.to(self.device)
        
        # Setup optimizer and criterion
        self.optimizer = optim.Adam(
            self.model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay
        )
        
        if config.task_type in [TaskType.NODE_CLASSIFICATION, TaskType.GRAPH_CLASSIFICATION]:
            self.criterion = nn.CrossEntropyLoss()
        else:
            self.criterion = nn.MSELoss()
    
    def train(self, train_data: List[GraphData], val_data: Optional[List[GraphData]] = None) -> GNNResult:
        """Train GNN model"""
        experiment_id = f"gnn_exp_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        training_start = time.time()
        
        try:
            # Prepare data loaders
            train_loader = self._prepare_data_loader(train_data)
            val_loader = self._prepare_data_loader(val_data) if val_data else None
            
            # Training loop
            training_history = {
                'train_loss': [],
                'train_accuracy': [],
                'val_loss': [],
                'val_accuracy': []
            }
            
            best_val_loss = float('inf')
            patience_counter = 0
            
            for epoch in range(self.config.max_epochs):
                # Training phase
                self.model.train()
                train_loss = 0.0
                train_correct = 0
                train_total = 0
                
                for batch in train_loader:
                    batch = batch.to(self.device)
                    
                    self.optimizer.zero_grad()
                    output = self.model(batch.x, batch.edge_index, batch.batch)
                    
                    # Calculate loss based on task type
                    if self.config.task_type == TaskType.NODE_CLASSIFICATION:
                        loss = self.criterion(output, batch.y)
                        pred = output.argmax(dim=1)
                        train_correct += (pred == batch.y).sum().item()
                    elif self.config.task_type == TaskType.NODE_REGRESSION:
                        loss = self.criterion(output, batch.y)
                        # For regression, accuracy is not applicable
                        train_correct += 0
                    else:
                        # Graph-level task
                        if hasattr(batch, 'y'):
                            loss = self.criterion(output, batch.y)
                            pred = output.argmax(dim=1) if output.size(1) > 1 else output
                            train_correct += (pred == batch.y).sum().item()
                        else:
                            loss = torch.tensor(0.0, device=self.device)
                            train_correct += 0
                    
                    loss.backward()
                    self.optimizer.step()
                    
                    train_loss += loss.item()
                    train_total += batch.y.size(0)
                
                # Calculate training metrics
                train_accuracy = 100.0 * train_correct / train_total if train_total > 0 else 0.0
                avg_train_loss = train_loss / len(train_loader)
                
                training_history['train_loss'].append(avg_train_loss)
                training_history['train_accuracy'].append(train_accuracy)
                
                # Validation phase
                if val_loader:
                    val_loss, val_accuracy = self._evaluate(val_loader)
                    training_history['val_loss'].append(val_loss)
                    training_history['val_accuracy'].append(val_accuracy)
                    
                    # Early stopping
                    if val_loss < best_val_loss:
                        best_val_loss = val_loss
                        patience_counter = 0
                    else:
                        patience_counter += 1
                        
                        if patience_counter >= self.config.early_stopping_patience:
                            logger.info(f"Early stopping at epoch {epoch}")
                            break
                
                # Log progress
                if epoch % 10 == 0:
                    logger.info(f"Epoch {epoch}, Train Loss: {avg_train_loss:.4f}, Train Acc: {train_accuracy:.2f}%, "
                               f"Val Loss: {val_loss:.4f if val_loader else 'N/A'}, Val Acc: {val_accuracy:.2f}%")
            
            # Calculate final metrics
            test_metrics = self._calculate_test_metrics(train_loader)
            
            # Calculate model statistics
            model_params = sum(p.numel() for p in self.model.parameters())
            model_size = model_params * 4 / (1024 * 1024)  # Convert to MB
            
            # Calculate graph statistics
            graph_stats = self._calculate_overall_graph_stats(train_data)
            
            training_time = time.time() - training_start
            
            # Create result
            result = GNNResult(
                experiment_id=experiment_id,
                gnn_type=self.config.gnn_type,
                task_type=self.config.task_type,
                trained_model=self.model,
                training_history=training_history,
                test_metrics=test_metrics,
                best_epoch=self._get_best_epoch(training_history),
                training_time_seconds=training_time,
                model_parameters=model_params,
                model_size_mb=model_size,
                graph_statistics=graph_stats
            )
            
            logger.info(f"GNN training completed: {experiment_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error in GNN training: {e}")
            raise
    
    def _prepare_data_loader(self, graph_data_list: List[GraphData]) -> DataLoader:
        """Prepare data loader from graph data"""
        data_list = []
        
        for graph_data in graph_data_list:
            # Create PyG Data object
            data = Data(
                x=graph_data.node_features,
                edge_index=graph_data.edge_index,
                y=graph_data.node_labels if graph_data.node_labels is not None else 
                   graph_data.graph_labels if graph_data.graph_labels is not None else 
                   torch.zeros(graph_data.num_nodes, dtype=torch.long)
            )
            data_list.append(data)
        
        return DataLoader(data_list, batch_size=1, shuffle=True)
    
    def _evaluate(self, data_loader: DataLoader) -> Tuple[float, float]:
        """Evaluate model"""
        self.model.eval()
        total_loss = 0.0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for batch in data_loader:
                batch = batch.to(self.device)
                output = self.model(batch.x, batch.edge_index, batch.batch)
                
                if self.config.task_type == TaskType.NODE_CLASSIFICATION:
                    loss = self.criterion(output, batch.y)
                    pred = output.argmax(dim=1)
                    correct += (pred == batch.y).sum().item()
                elif self.config.task_type == TaskType.NODE_REGRESSION:
                    loss = self.criterion(output, batch.y)
                    # For regression, accuracy is not applicable
                    correct += 0
                else:
                    # Graph-level task
                    if hasattr(batch, 'y'):
                        loss = self.criterion(output, batch.y)
                        pred = output.argmax(dim=1) if output.size(1) > 1 else output
                        correct += (pred == batch.y).sum().item()
                    else:
                        loss = torch.tensor(0.0, device=self.device)
                        correct += 0
                
                total_loss += loss.item()
                total += batch.y.size(0)
        
        avg_loss = total_loss / len(data_loader)
        accuracy = 100.0 * correct / total if total > 0 else 0.0
        
        return avg_loss, accuracy
    
    def _calculate_test_metrics(self, data_loader: DataLoader) -> Dict[str, float]:
        """Calculate test metrics"""
        loss, accuracy = self._evaluate(data_loader)
        
        metrics = {
            'loss': loss,
            'accuracy': accuracy
        }
        
        # Add task-specific metrics
        if self.config.task_type == TaskType.NODE_CLASSIFICATION:
            # Calculate F1 score
            all_preds = []
            all_labels = []
            
            self.model.eval()
            with torch.no_grad():
                for batch in data_loader:
                    batch = batch.to(self.device)
                    output = self.model(batch.x, batch.edge_index, batch.batch)
                    pred = output.argmax(dim=1)
                    all_preds.extend(pred.cpu().numpy())
                    all_labels.extend(batch.y.cpu().numpy())
            
            if all_preds and all_labels:
                metrics['f1_score'] = f1_score(all_labels, all_preds, average='weighted')
        
        return metrics
    
    def _get_best_epoch(self, training_history: Dict[str, List[float]]) -> int:
        """Get best epoch from training history"""
        if 'val_loss' in training_history and training_history['val_loss']:
            best_val_loss = min(training_history['val_loss'])
            return training_history['val_loss'].index(best_val_loss)
        else:
            return len(training_history['train_loss']) - 1
    
    def _calculate_overall_graph_stats(self, graph_data_list: List[GraphData]) -> Dict[str, Any]:
        """Calculate overall graph statistics"""
        total_nodes = sum(g.num_nodes for g in graph_data_list)
        total_edges = sum(g.num_edges for g in graph_data_list)
        
        return {
            'total_graphs': len(graph_data_list),
            'total_nodes': total_nodes,
            'total_edges': total_edges,
            'avg_nodes_per_graph': total_nodes / len(graph_data_list),
            'avg_edges_per_graph': total_edges / len(graph_data_list),
            'avg_density': total_edges / (total_nodes * (total_nodes - 1)) if total_nodes > 1 else 0
        }


class GNNService:
    """Main GNN service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.models = {}
        self.graph_analyzer = GraphAnalyzer()
        
    def create_gnn_model(self, model_id: str, config: GNNConfig) -> str:
        """Create GNN model"""
        try:
            trainer = GNNTrainer(config)
            self.models[model_id] = {
                'trainer': trainer,
                'config': config,
                'created_at': datetime.utcnow()
            }
            
            # Save to Redis
            if self.redis:
                self._save_model(model_id, config)
            
            logger.info(f"Created GNN model {model_id}")
            return model_id
            
        except Exception as e:
            logger.error(f"Error creating GNN model: {e}")
            raise
    
    def train_gnn_model(self, model_id: str, train_data: List[GraphData], 
                      val_data: Optional[List[GraphData]] = None) -> GNNResult:
        """Train GNN model"""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not found")
        
        trainer = self.models[model_id]['trainer']
        result = trainer.train(train_data, val_data)
        
        # Store result
        self.models[model_id]['result'] = result
        
        # Save to Redis
        if self.redis:
            self._save_result(model_id, result)
        
        return result
    
    def analyze_graph(self, graph_data: GraphData, analysis_type: str = "statistics") -> Dict[str, Any]:
        """Analyze graph data"""
        try:
            if analysis_type == "statistics":
                return self.graph_analyzer.calculate_graph_statistics(graph_data)
            elif analysis_type == "communities":
                return self.graph_analyzer.detect_communities(graph_data)
            elif analysis_type == "anomalies":
                anomalies = self.graph_analyzer.find_anomalies(graph_data)
                return {'anomalous_nodes': anomalies}
            else:
                return {'error': f'Unsupported analysis type: {analysis_type}'}
                
        except Exception as e:
            logger.error(f"Error in graph analysis: {e}")
            return {'error': str(e)}
    
    def get_model_info(self, model_id: str) -> Dict[str, Any]:
        """Get GNN model information"""
        if model_id not in self.models:
            return {'error': f'Model {model_id} not found'}
        
        model_data = self.models[model_id]
        config = model_data['config']
        
        return {
            'model_id': model_id,
            'gnn_type': config.gnn_type.value,
            'task_type': config.task_type.value,
            'input_dim': config.input_dim,
            'hidden_dim': config.hidden_dim,
            'output_dim': config.output_dim,
            'num_layers': config.num_layers,
            'dropout': config.dropout,
            'activation': config.activation,
            'aggregation_type': config.aggregation_type.value,
            'num_heads': config.num_heads,
            'learning_rate': config.learning_rate,
            'max_epochs': config.max_epochs,
            'created_at': model_data['created_at'].isoformat()
        }
    
    def _save_model(self, model_id: str, config: GNNConfig) -> None:
        """Save GNN model to Redis"""
        try:
            model_data = {
                'model_id': model_id,
                'gnn_type': config.gnn_type.value,
                'task_type': config.task_type.value,
                'input_dim': config.input_dim,
                'hidden_dim': config.hidden_dim,
                'output_dim': config.output_dim,
                'num_layers': config.num_layers,
                'dropout': config.dropout,
                'activation': config.activation,
                'aggregation_type': config.aggregation_type.value,
                'num_heads': config.num_heads,
                'learning_rate': config.learning_rate,
                'max_epochs': config.max_epochs,
                'created_at': datetime.utcnow().isoformat()
            }
            
            self.redis.setex(f"gnn_model:{model_id}", 
                           86400 * 30, json.dumps(model_data))  # 30 days TTL
            
            logger.info(f"Saved GNN model {model_id}")
            
        except Exception as e:
            logger.error(f"Failed to save GNN model: {e}")
    
    def _save_result(self, model_id: str, result: GNNResult) -> None:
        """Save GNN result to Redis"""
        try:
            result_data = {
                'experiment_id': result.experiment_id,
                'gnn_type': result.gnn_type.value,
                'task_type': result.task_type.value,
                'test_metrics': result.test_metrics,
                'best_epoch': result.best_epoch,
                'training_time_seconds': result.training_time_seconds,
                'model_parameters': result.model_parameters,
                'model_size_mb': result.model_size_mb,
                'graph_statistics': result.graph_statistics,
                'created_at': result.created_at.isoformat()
            }
            
            self.redis.setex(f"gnn_result:{model_id}", 
                           86400 * 30, json.dumps(result_data))  # 30 days TTL
            
            logger.info(f"Saved GNN result {model_id}")
            
        except Exception as e:
            logger.error(f"Failed to save GNN result: {e}")


# Global GNN service instance
gnn_service = GNNService()

# Export functions
def create_gnn_model(model_id: str, config: GNNConfig) -> str:
    """Create GNN model"""
    return gnn_service.create_gnn_model(model_id, config)

def train_gnn_model(model_id: str, train_data: List[GraphData], 
                   val_data: Optional[List[GraphData]] = None) -> GNNResult:
    """Train GNN model"""
    return gnn_service.train_gnn_model(model_id, train_data, val_data)

def analyze_graph_data(graph_data: GraphData, analysis_type: str = "statistics") -> Dict[str, Any]:
    """Analyze graph data"""
    return gnn_service.analyze_graph(graph_data, analysis_type)

def get_gnn_model_info(model_id: str) -> Dict[str, Any]:
    """Get GNN model info"""
    return gnn_service.get_model_info(model_id)

# Export all components
__all__ = [
    'GNNType',
    'TaskType',
    'AggregationType',
    'GNNConfig',
    'GraphData',
    'GNNResult',
    'GCNLayer',
    'GATLayer',
    'GraphSAGELayer',
    'GINLayer',
    'GraphTransformerLayer',
    'GNNModel',
    'GraphAnalyzer',
    'GNNTrainer',
    'GNNService',
    'create_gnn_model',
    'train_gnn_model',
    'analyze_graph_data',
    'get_gnn_model_info',
    'gnn_service',
]
