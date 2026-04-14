"""
Transformer Models and Attention Mechanisms System
Advanced transformer architectures with custom attention mechanisms and model implementations
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
import torch.optim as optim
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset
import math
import transformers
from transformers import AutoTokenizer, AutoModel, AutoConfig
from sklearn.metrics import accuracy_score, mean_squared_error, f1_score
import joblib
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class AttentionType(Enum):
    """Attention mechanism types"""
    SCALED_DOT_PRODUCT = "scaled_dot_product"
    MULTI_HEAD = "multi_head"
    SELF_ATTENTION = "self_attention"
    CROSS_ATTENTION = "cross_attention"
    SPARSE_ATTENTION = "sparse_attention"
    LOCAL_ATTENTION = "local_attention"
    GLOBAL_ATTENTION = "global_attention"
    RELATIVE_POSITION = "relative_position"
    LINEAR_ATTENTION = "linear_attention"
    PERFORMER_ATTENTION = "performer_attention"
    LINFORMER_ATTENTION = "linformer_attention"


class TransformerType(Enum):
    """Transformer model types"""
    VANILLA_TRANSFORMER = "vanilla_transformer"
    BERT = "bert"
    GPT = "gpt"
    T5 = "t5"
    DISTILBERT = "distilbert"
    ROBERTA = "roberta"
    ELECTRA = "electra"
    DEBERTA = "deberta"
    CUSTOM_TRANSFORMER = "custom_transformer"


class PositionEncodingType(Enum):
    """Position encoding types"""
    SINUSOIDAL = "sinusoidal"
    LEARNED = "learned"
    RELATIVE = "relative"
    ALIBI = "alibi"
    ROTARY = "rotary"
    T5_BIAS = "t5_bias"


@dataclass
class TransformerConfig:
    """Transformer configuration"""
    model_type: TransformerType
    vocab_size: int
    d_model: int = 512
    nhead: int = 8
    num_layers: int = 6
    dim_feedforward: int = 2048
    dropout: float = 0.1
    attention_type: AttentionType = AttentionType.MULTI_HEAD
    position_encoding: PositionEncodingType = PositionEncodingType.SINUSOIDAL
    max_seq_length: int = 512
    activation: str = "relu"
    layer_norm_eps: float = 1e-6
    use_bias: bool = True
    output_dim: Optional[int] = None
    gradient_checkpointing: bool = False
    use_flash_attention: bool = False


@dataclass
class AttentionResult:
    """Attention computation result"""
    attention_weights: torch.Tensor
    output: torch.Tensor
    attention_type: AttentionType
    num_heads: int
    sequence_length: int
    head_dim: int
    metadata: Dict[str, Any] = field(default_factory=dict)


class MultiHeadAttention(nn.Module):
    """Multi-head attention mechanism"""
    
    def __init__(self, d_model: int, nhead: int, dropout: float = 0.1, 
                 attention_type: AttentionType = AttentionType.MULTI_HEAD):
        super().__init__()
        self.d_model = d_model
        self.nhead = nhead
        self.attention_type = attention_type
        self.d_k = d_model // nhead
        
        # Linear projections
        self.q_linear = nn.Linear(d_model, d_model)
        self.k_linear = nn.Linear(d_model, d_model)
        self.v_linear = nn.Linear(d_model, d_model)
        self.out_linear = nn.Linear(d_model, d_model)
        
        self.dropout = nn.Dropout(dropout)
        
        # Initialize weights
        self._init_weights()
    
    def _init_weights(self) -> None:
        """Initialize weights"""
        for module in [self.q_linear, self.k_linear, self.v_linear, self.out_linear]:
            nn.init.xavier_uniform_(module.weight)
            if module.bias is not None:
                nn.init.constant_(module.bias, 0)
    
    def forward(self, query: torch.Tensor, key: torch.Tensor, value: torch.Tensor,
                mask: Optional[torch.Tensor] = None) -> Tuple[torch.Tensor, torch.Tensor]:
        """Forward pass"""
        batch_size, seq_len, _ = query.size()
        
        # Linear projections
        Q = self.q_linear(query)
        K = self.k_linear(key)
        V = self.v_linear(value)
        
        # Reshape for multi-head attention
        Q = Q.view(batch_size, seq_len, self.nhead, self.d_k).transpose(1, 2)
        K = K.view(batch_size, -1, self.nhead, self.d_k).transpose(1, 2)
        V = V.view(batch_size, -1, self.nhead, self.d_k).transpose(1, 2)
        
        # Compute attention
        if self.attention_type == AttentionType.MULTI_HEAD:
            attention_output, attention_weights = self._scaled_dot_product_attention(Q, K, V, mask)
        elif self.attention_type == AttentionType.SPARCE_ATTENTION:
            attention_output, attention_weights = self._sparse_attention(Q, K, V, mask)
        elif self.attention_type == AttentionType.LINEAR_ATTENTION:
            attention_output, attention_weights = self._linear_attention(Q, K, V, mask)
        else:
            attention_output, attention_weights = self._scaled_dot_product_attention(Q, K, V, mask)
        
        # Concatenate heads
        attention_output = attention_output.transpose(1, 2).contiguous().view(
            batch_size, seq_len, self.d_model
        )
        
        # Final linear projection
        output = self.out_linear(attention_output)
        output = self.dropout(output)
        
        return output, attention_weights
    
    def _scaled_dot_product_attention(self, Q: torch.Tensor, K: torch.Tensor, V: torch.Tensor,
                                   mask: Optional[torch.Tensor] = None) -> Tuple[torch.Tensor, torch.Tensor]:
        """Scaled dot-product attention"""
        d_k = Q.size(-1)
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)
        
        if mask is not None:
            scores = scores.masked_fill(mask == 0, -1e9)
        
        attention_weights = F.softmax(scores, dim=-1)
        attention_weights = self.dropout(attention_weights)
        
        output = torch.matmul(attention_weights, V)
        return output, attention_weights
    
    def _sparse_attention(self, Q: torch.Tensor, K: torch.Tensor, V: torch.Tensor,
                         mask: Optional[torch.Tensor] = None) -> Tuple[torch.Tensor, torch.Tensor]:
        """Sparse attention (simplified Longformer-style)"""
        batch_size, nhead, seq_len, d_k = Q.size()
        
        # Local attention window
        window_size = min(128, seq_len // 4)
        
        # Create local attention mask
        local_mask = torch.zeros(seq_len, seq_len, device=Q.device)
        for i in range(seq_len):
            start = max(0, i - window_size // 2)
            end = min(seq_len, i + window_size // 2 + 1)
            local_mask[i, start:end] = 1
        
        if mask is not None:
            local_mask = local_mask * mask.unsqueeze(0)
        
        # Compute attention scores
        d_k = Q.size(-1)
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)
        scores = scores * local_mask.unsqueeze(0).unsqueeze(0)
        
        # Apply mask
        scores = scores.masked_fill(local_mask.unsqueeze(0).unsqueeze(0) == 0, -1e9)
        
        attention_weights = F.softmax(scores, dim=-1)
        output = torch.matmul(attention_weights, V)
        
        return output, attention_weights
    
    def _linear_attention(self, Q: torch.Tensor, K: torch.Tensor, V: torch.Tensor,
                        mask: Optional[torch.Tensor] = None) -> Tuple[torch.Tensor, torch.Tensor]:
        """Linear attention (simplified Performer-style)"""
        batch_size, nhead, seq_len, d_k = Q.size()
        
        # Feature maps for linear attention
        phi_k = F.elu(K) + 1
        phi_v = F.elu(V) + 1
        
        # Global query
        Q_sum = torch.sum(Q, dim=2, keepdim=True)  # [batch, nhead, 1, d_k]
        KV_sum = torch.sum(phi_k * phi_v, dim=2)  # [batch, nhead, d_k]
        
        # Linear attention
        output = torch.matmul(Q_sum, KV_sum.unsqueeze(-1)) / seq_len
        
        # Simplified attention weights (for visualization)
        attention_weights = torch.ones(batch_size, nhead, 1, seq_len, device=Q.device) / seq_len
        
        return output, attention_weights


class TransformerEncoderLayer(nn.Module):
    """Transformer encoder layer"""
    
    def __init__(self, config: TransformerConfig):
        super().__init__()
        self.config = config
        
        # Multi-head attention
        self.self_attention = MultiHeadAttention(
            config.d_model, config.nhead, config.dropout, config.attention_type
        )
        
        # Feed-forward network
        self.feed_forward = nn.Sequential(
            nn.Linear(config.d_model, config.dim_feedforward),
            nn.ReLU() if config.activation == "relu" else nn.GELU(),
            nn.Dropout(config.dropout),
            nn.Linear(config.dim_feedforward, config.d_model),
            nn.Dropout(config.dropout)
        )
        
        # Layer normalization
        self.norm1 = nn.LayerNorm(config.d_model, eps=config.layer_norm_eps)
        self.norm2 = nn.LayerNorm(config.d_model, eps=config.layer_norm_eps)
        
        # Dropout
        self.dropout = nn.Dropout(config.dropout)
    
    def forward(self, x: torch.Tensor, mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        """Forward pass"""
        # Self-attention with residual connection
        attn_output, attention_weights = self.self_attention(x, x, x, mask)
        x = self.norm1(x + self.dropout(attn_output))
        
        # Feed-forward with residual connection
        ff_output = self.feed_forward(x)
        x = self.norm2(x + ff_output)
        
        return x


class PositionalEncoding(nn.Module):
    """Positional encoding"""
    
    def __init__(self, d_model: int, max_seq_length: int = 512, 
                 encoding_type: PositionEncodingType = PositionEncodingType.SINUSOIDAL):
        super().__init__()
        self.d_model = d_model
        self.max_seq_length = max_seq_length
        self.encoding_type = encoding_type
        
        if encoding_type == PositionEncodingType.SINUSOIDAL:
            self.encoding = self._sinusoidal_encoding()
        elif encoding_type == PositionEncodingType.LEARNED:
            self.encoding = nn.Embedding(max_seq_length, d_model)
        elif encoding_type == PositionEncodingType.RELATIVE:
            self.encoding = self._relative_position_encoding()
        else:
            self.encoding = self._sinusoidal_encoding()
    
    def _sinusoidal_encoding(self) -> torch.Tensor:
        """Sinusoidal positional encoding"""
        pe = torch.zeros(self.max_seq_length, self.d_model)
        position = torch.arange(0, self.max_seq_length, dtype=torch.float).unsqueeze(1)
        
        div_term = torch.exp(torch.arange(0, self.d_model, 2).float() * 
                           -(math.log(10000.0) / self.d_model))
        
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        
        return pe.unsqueeze(0)
    
    def _relative_position_encoding(self) -> torch.Tensor:
        """Relative positional encoding"""
        # Simplified relative position encoding
        pe = torch.zeros(self.max_seq_length, self.d_model)
        position = torch.arange(0, self.max_seq_length, dtype=torch.float).unsqueeze(1)
        
        # Learn relative position embeddings
        for i in range(self.d_model):
            pe[:, i] = position.squeeze(1) * (i + 1) / self.d_model
        
        return pe.unsqueeze(0)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Add positional encoding"""
        seq_len = x.size(1)
        
        if self.encoding_type == PositionEncodingType.LEARNED:
            positions = torch.arange(0, seq_len, dtype=torch.long, device=x.device)
            pos_encoding = self.encoding(positions)
        else:
            pos_encoding = self.encoding[:, :seq_len, :]
        
        return x + pos_encoding


class TransformerModel(nn.Module):
    """Complete transformer model"""
    
    def __init__(self, config: TransformerConfig):
        super().__init__()
        self.config = config
        
        # Embedding layer
        self.embedding = nn.Embedding(config.vocab_size, config.d_model)
        
        # Positional encoding
        self.pos_encoding = PositionalEncoding(
            config.d_model, config.max_seq_length, config.position_encoding
        )
        
        # Transformer encoder layers
        self.layers = nn.ModuleList([
            TransformerEncoderLayer(config) for _ in range(config.num_layers)
        ])
        
        # Output projection
        output_dim = config.output_dim or config.vocab_size
        self.output_projection = nn.Linear(config.d_model, output_dim)
        
        # Dropout
        self.dropout = nn.Dropout(config.dropout)
        
        # Initialize weights
        self._init_weights()
    
    def _init_weights(self) -> None:
        """Initialize weights"""
        nn.init.normal_(self.embedding.weight, mean=0, std=0.1)
        
        for layer in self.layers:
            for module in layer.modules():
                if isinstance(module, nn.Linear):
                    nn.init.xavier_uniform_(module.weight)
                    if module.bias is not None:
                        nn.init.constant_(module.bias, 0)
        
        nn.init.xavier_uniform_(self.output_projection.weight)
        if self.output_projection.bias is not None:
            nn.init.constant_(self.output_projection.bias, 0)
    
    def forward(self, input_ids: torch.Tensor, attention_mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        """Forward pass"""
        # Embedding
        x = self.embedding(input_ids)
        x = self.pos_encoding(x)
        x = self.dropout(x)
        
        # Transformer layers
        for layer in self.layers:
            x = layer(x, attention_mask)
        
        # Output projection
        output = self.output_projection(x)
        
        return output


class CustomTransformerModels:
    """Custom transformer model implementations"""
    
    @staticmethod
    def create_bert_model(config: TransformerConfig) -> nn.Module:
        """Create BERT-style model"""
        class BertTransformer(nn.Module):
            def __init__(self, config):
                super().__init__()
                self.config = config
                
                # Embeddings
                self.word_embeddings = nn.Embedding(config.vocab_size, config.d_model)
                self.position_embeddings = nn.Embedding(config.max_seq_length, config.d_model)
                self.token_type_embeddings = nn.Embedding(2, config.d_model)
                
                # Positional encoding
                self.pos_encoding = PositionalEncoding(config.d_model, config.max_seq_length)
                
                # Encoder layers
                self.layers = nn.ModuleList([
                    TransformerEncoderLayer(config) for _ in range(config.num_layers)
                ])
                
                # Pooling
                self.pooler = nn.Linear(config.d_model, config.d_model)
                
                # Output projections
                self.cls_projection = nn.Linear(config.d_model, 2)  # For classification
                self.seq_projection = nn.Linear(config.d_model, config.d_model)  # For MLM
                
            def forward(self, input_ids, token_type_ids=None, attention_mask=None):
                # Embeddings
                word_embeds = self.word_embeddings(input_ids)
                pos_embeds = self.position_embeddings(torch.arange(input_ids.size(1), device=input_ids.device))
                
                if token_type_ids is not None:
                    token_type_embeds = self.token_type_embeddings(token_type_ids)
                    embeddings = word_embeds + pos_embeds + token_type_embeds
                else:
                    embeddings = word_embeds + pos_embeds
                
                # Transformer layers
                hidden_states = []
                x = embeddings
                
                for layer in self.layers:
                    x = layer(x, attention_mask)
                    hidden_states.append(x)
                
                # Pooling
                cls_output = self.pooler(x[:, 0, :])
                cls_output = torch.tanh(cls_output)
                
                # Output projections
                cls_logits = self.cls_projection(cls_output)
                seq_logits = self.seq_projection(x)
                
                return {
                    'hidden_states': hidden_states,
                    'cls_logits': cls_logits,
                    'seq_logits': seq_logits,
                    'pooler_output': cls_output
                }
        
        return BertTransformer(config)
    
    @staticmethod
    def create_gpt_model(config: TransformerConfig) -> nn.Module:
        """Create GPT-style model"""
        class GptTransformer(nn.Module):
            def __init__(self, config):
                super().__init__()
                self.config = config
                
                # Embeddings
                self.word_embeddings = nn.Embedding(config.vocab_size, config.d_model)
                self.position_embeddings = nn.Embedding(config.max_seq_length, config.d_model)
                
                # Decoder layers
                self.layers = nn.ModuleList([
                    TransformerEncoderLayer(config) for _ in range(config.num_layers)
                ])
                
                # Output projection
                self.output_projection = nn.Linear(config.d_model, config.vocab_size)
                
                # Dropout
                self.dropout = nn.Dropout(config.dropout)
                
            def forward(self, input_ids, attention_mask=None, past_key_values=None):
                batch_size, seq_len = input_ids.size()
                
                # Embeddings
                word_embeds = self.word_embeddings(input_ids)
                pos_embeds = self.position_embeddings(torch.arange(seq_len, device=input_ids.device))
                x = self.dropout(word_embeds + pos_embeds)
                
                # Decoder layers
                hidden_states = []
                
                for layer in self.layers:
                    x = layer(x, attention_mask)
                    hidden_states.append(x)
                
                # Output projection
                logits = self.output_projection(x)
                
                return {
                    'hidden_states': hidden_states,
                    'logits': logits
                }
        
        return GptTransformer(config)
    
    @staticmethod
    def create_t5_model(config: TransformerConfig) -> nn.Module:
        """Create T5-style model"""
        class T5Transformer(nn.Module):
            def __init__(self, config):
                super().__init__()
                self.config = config
                
                # Embeddings
                self.shared_embeddings = nn.Embedding(config.vocab_size, config.d_model)
                
                # Encoder
                self.encoder_layers = nn.ModuleList([
                    TransformerEncoderLayer(config) for _ in range(config.num_layers)
                ])
                
                # Decoder
                self.decoder_layers = nn.ModuleList([
                    TransformerEncoderLayer(config) for _ in range(config.num_layers)
                ])
                
                # Output projection
                self.output_projection = nn.Linear(config.d_model, config.vocab_size)
                
            def forward(self, input_ids, decoder_input_ids=None, attention_mask=None):
                # Encoder
                encoder_embeds = self.shared_embeddings(input_ids)
                encoder_hidden = encoder_embeds
                
                for layer in self.encoder_layers:
                    encoder_hidden = layer(encoder_hidden, attention_mask)
                
                # Decoder (if provided)
                if decoder_input_ids is not None:
                    decoder_embeds = self.shared_embeddings(decoder_input_ids)
                    decoder_hidden = decoder_embeds
                    
                    for layer in self.decoder_layers:
                        decoder_hidden = layer(decoder_hidden, attention_mask)
                    
                    logits = self.output_projection(decoder_hidden)
                    return {'encoder_hidden': encoder_hidden, 'decoder_hidden': decoder_hidden, 'logits': logits}
                else:
                    return {'encoder_hidden': encoder_hidden}
        
        return T5Transformer(config)


class TransformerService:
    """Main transformer service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.models = {}
        self.attention_results = {}
        
    def create_transformer_model(self, model_id: str, config: TransformerConfig) -> str:
        """Create transformer model"""
        try:
            if config.model_type == TransformerType.VANILLA_TRANSFORMER:
                model = TransformerModel(config)
            elif config.model_type == TransformerType.BERT:
                model = CustomTransformerModels.create_bert_model(config)
            elif config.model_type == TransformerType.GPT:
                model = CustomTransformerModels.create_gpt_model(config)
            elif config.model_type == TransformerType.T5:
                model = CustomTransformerModels.create_t5_model(config)
            else:
                model = TransformerModel(config)
            
            self.models[model_id] = {
                'model': model,
                'config': config,
                'created_at': datetime.utcnow()
            }
            
            # Save to Redis
            if self.redis:
                self._save_model(model_id, config)
            
            logger.info(f"Created transformer model {model_id}")
            return model_id
            
        except Exception as e:
            logger.error(f"Error creating transformer model: {e}")
            raise
    
    def compute_attention(self, model_id: str, query: torch.Tensor, key: torch.Tensor, 
                       value: torch.Tensor, attention_type: AttentionType) -> AttentionResult:
        """Compute attention weights"""
        try:
            if model_id not in self.models:
                raise ValueError(f"Model {model_id} not found")
            
            # Create attention module
            d_model = query.size(-1)
            nhead = 8  # Default
            
            attention_module = MultiHeadAttention(d_model, nhead, attention_type=attention_type)
            
            # Compute attention
            output, attention_weights = attention_module(query, key, value)
            
            result = AttentionResult(
                attention_weights=attention_weights,
                output=output,
                attention_type=attention_type,
                num_heads=nhead,
                sequence_length=query.size(1),
                head_dim=d_model // nhead,
                metadata={
                    'model_id': model_id,
                    'computed_at': datetime.utcnow().isoformat()
                }
            )
            
            # Store result
            result_id = f"attention_{model_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            self.attention_results[result_id] = result
            
            # Save to Redis
            if self.redis:
                self._save_attention_result(result_id, result)
            
            return result
            
        except Exception as e:
            logger.error(f"Error computing attention: {e}")
            raise
    
    def visualize_attention(self, model_id: str, attention_result_id: str) -> Dict[str, Any]:
        """Generate attention visualization data"""
        try:
            if attention_result_id not in self.attention_results:
                return {'error': f'Attention result {attention_result_id} not found'}
            
            attention_result = self.attention_results[attention_result_id]
            attention_weights = attention_result.attention_weights
            
            # Convert to numpy for visualization
            if isinstance(attention_weights, torch.Tensor):
                attention_weights = attention_weights.cpu().numpy()
            
            # Average across heads for visualization
            if len(attention_weights.shape) == 4:  # [batch, heads, seq, seq]
                avg_attention = np.mean(attention_weights, axis=1)
            else:
                avg_attention = attention_weights
            
            # Create visualization data
            visualization_data = {
                'model_id': model_id,
                'attention_result_id': attention_result_id,
                'attention_type': attention_result.attention_type.value,
                'num_heads': attention_result.num_heads,
                'sequence_length': attention_result.sequence_length,
                'attention_weights': avg_attention.tolist(),
                'head_dim': attention_result.head_dim,
                'visualization_format': 'heatmap',
                'created_at': datetime.utcnow().isoformat()
            }
            
            return visualization_data
            
        except Exception as e:
            logger.error(f"Error creating attention visualization: {e}")
            return {'error': str(e)}
    
    def get_model_info(self, model_id: str) -> Dict[str, Any]:
        """Get model information"""
        if model_id not in self.models:
            return {'error': f'Model {model_id} not found'}
        
        model_data = self.models[model_id]
        config = model_data['config']
        
        return {
            'model_id': model_id,
            'model_type': config.model_type.value,
            'vocab_size': config.vocab_size,
            'd_model': config.d_model,
            'nhead': config.nhead,
            'num_layers': config.num_layers,
            'dim_feedforward': config.dim_feedforward,
            'dropout': config.dropout,
            'attention_type': config.attention_type.value,
            'position_encoding': config.position_encoding.value,
            'max_seq_length': config.max_seq_length,
            'activation': config.activation,
            'layer_norm_eps': config.layer_norm_eps,
            'use_bias': config.use_bias,
            'output_dim': config.output_dim,
            'gradient_checkpointing': config.gradient_checkpointing,
            'use_flash_attention': config.use_flash_attention,
            'created_at': model_data['created_at'].isoformat()
        }
    
    def list_models(self) -> List[Dict[str, Any]]:
        """List all transformer models"""
        models = []
        
        for model_id, model_data in self.models.items():
            config = model_data['config']
            models.append({
                'model_id': model_id,
                'model_type': config.model_type.value,
                'd_model': config.d_model,
                'nhead': config.nhead,
                'num_layers': config.num_layers,
                'attention_type': config.attention_type.value,
                'created_at': model_data['created_at'].isoformat()
            })
        
        return models
    
    def _save_model(self, model_id: str, config: TransformerConfig) -> None:
        """Save model to Redis"""
        try:
            model_data = {
                'model_id': model_id,
                'model_type': config.model_type.value,
                'vocab_size': config.vocab_size,
                'd_model': config.d_model,
                'nhead': config.nhead,
                'num_layers': config.num_layers,
                'dim_feedforward': config.dim_feedforward,
                'dropout': config.dropout,
                'attention_type': config.attention_type.value,
                'position_encoding': config.position_encoding.value,
                'max_seq_length': config.max_seq_length,
                'activation': config.activation,
                'layer_norm_eps': config.layer_norm_eps,
                'use_bias': config.use_bias,
                'output_dim': config.output_dim,
                'gradient_checkpointing': config.gradient_checkpointing,
                'use_flash_attention': config.use_flash_attention,
                'created_at': datetime.utcnow().isoformat()
            }
            
            self.redis.setex(f"transformer_model:{model_id}", 
                           86400 * 30, json.dumps(model_data))  # 30 days TTL
            
            logger.info(f"Saved transformer model {model_id}")
            
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
    
    def _save_attention_result(self, result_id: str, result: AttentionResult) -> None:
        """Save attention result to Redis"""
        try:
            attention_data = {
                'result_id': result_id,
                'attention_type': result.attention_type.value,
                'num_heads': result.num_heads,
                'sequence_length': result.sequence_length,
                'head_dim': result.head_dim,
                'attention_weights': result.attention_weights.cpu().numpy().tolist(),
                'output_shape': list(result.output.shape),
                'metadata': result.metadata,
                'created_at': result.created_at.isoformat()
            }
            
            self.redis.setex(f"attention_result:{result_id}", 
                           86400 * 7, json.dumps(attention_data))  # 7 days TTL
            
            logger.info(f"Saved attention result {result_id}")
            
        except Exception as e:
            logger.error(f"Failed to save attention result: {e}")


# Global transformer service instance
transformer_service = TransformerService()

# Export functions
def create_transformer_model(model_id: str, config: TransformerConfig) -> str:
    """Create transformer model"""
    return transformer_service.create_transformer_model(model_id, config)

def compute_transformer_attention(model_id: str, query: torch.Tensor, key: torch.Tensor, 
                             value: torch.Tensor, attention_type: AttentionType) -> AttentionResult:
    """Compute transformer attention"""
    return transformer_service.compute_attention(model_id, query, key, value, attention_type)

def visualize_transformer_attention(model_id: str, attention_result_id: str) -> Dict[str, Any]:
    """Visualize transformer attention"""
    return transformer_service.visualize_attention(model_id, attention_result_id)

def get_transformer_model_info(model_id: str) -> Dict[str, Any]:
    """Get transformer model info"""
    return transformer_service.get_model_info(model_id)

def list_transformer_models() -> List[Dict[str, Any]]:
    """List transformer models"""
    return transformer_service.list_models()

# Export all components
__all__ = [
    'AttentionType',
    'TransformerType',
    'PositionEncodingType',
    'TransformerConfig',
    'AttentionResult',
    'MultiHeadAttention',
    'TransformerEncoderLayer',
    'PositionalEncoding',
    'TransformerModel',
    'CustomTransformerModels',
    'TransformerService',
    'create_transformer_model',
    'compute_transformer_attention',
    'visualize_transformer_attention',
    'get_transformer_model_info',
    'list_transformer_models',
    'transformer_service',
]
