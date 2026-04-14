"""
OptiPlan 360 - RLHF (Reinforcement Learning from Human Feedback) Service
AI-035: Human feedback ile model fine-tuning

Bu modül:
- Reward model training
- PPO (Proximal Policy Optimization)
- DPO (Direct Preference Optimization)
- Human preference data collection
- KL divergence regularization
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from typing import List, Dict, Tuple, Optional, Callable
from dataclasses import dataclass
import numpy as np
import logging
from copy import deepcopy

logger = logging.getLogger(__name__)


@dataclass
class RLHFConfig:
    """RLHF konfigürasyonu"""
    # Reward model
    reward_model_lr: float = 1e-5
    reward_model_epochs: int = 1
    
    # PPO
    ppo_lr: float = 1e-6
    ppo_epochs: int = 4
    ppo_batch_size: int = 64
    ppo_clip_epsilon: float = 0.2
    ppo_value_clip: float = 0.2
    
    # KL divergence
    kl_coef: float = 0.2
    target_kl: float = 6.0
    
    # DPO
    dpo_beta: float = 0.1
    
    # Generation
    max_length: int = 512
    temperature: float = 0.7
    top_p: float = 0.9


class PreferenceDataset(Dataset):
    """
    Human preference verisi.
    
    Her örnek: (prompt, chosen, rejected)
    """
    
    def __init__(self, data: List[Dict]):
        self.data = data
        
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, idx):
        item = self.data[idx]
        return {
            'prompt': item['prompt'],
            'chosen': item['chosen'],
            'rejected': item['rejected']
        }


class RewardModel(nn.Module):
    """
    Reward model.
    
    Metin girişlerine skor (0-1) atar.
    Bradley-Terry model tabanlı.
    """
    
    def __init__(self, base_model: nn.Module, dropout: float = 0.1):
        super().__init__()
        
        self.base_model = base_model
        self.dropout = nn.Dropout(dropout)
        
        # Reward head (scalar output)
        hidden_size = getattr(base_model.config, 'hidden_size', 768)
        self.reward_head = nn.Linear(hidden_size, 1)
        
    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.
        
        Returns:
            rewards: (batch_size,)
        """
        # Get last hidden state
        outputs = self.base_model(input_ids, attention_mask=attention_mask)
        
        # Use last token representation
        # Get the last non-padding token for each sequence
        last_hidden = outputs.last_hidden_state
        
        # Find last real token position
        sequence_lengths = attention_mask.sum(dim=1) - 1
        batch_size = input_ids.size(0)
        
        # Gather last token hidden states
        last_token_hidden = last_hidden[torch.arange(batch_size), sequence_lengths]
        
        # Apply dropout
        last_token_hidden = self.dropout(last_token_hidden)
        
        # Reward prediction
        reward = self.reward_head(last_token_hidden).squeeze(-1)
        
        return reward
    
    def compute_loss(
        self,
        chosen_input_ids: torch.Tensor,
        chosen_attention_mask: torch.Tensor,
        rejected_input_ids: torch.Tensor,
        rejected_attention_mask: torch.Tensor
    ) -> torch.Tensor:
        """
        Preference learning loss.
        
        Loss = -log(sigmoid(r(chosen) - r(rejected)))
        """
        # Get rewards
        chosen_rewards = self.forward(chosen_input_ids, chosen_attention_mask)
        rejected_rewards = self.forward(rejected_input_ids, rejected_attention_mask)
        
        # Bradley-Terry loss
        loss = -F.logsigmoid(chosen_rewards - rejected_rewards).mean()
        
        # Accuracy
        with torch.no_grad():
            accuracy = (chosen_rewards > rejected_rewards).float().mean()
        
        return loss, accuracy


class PPOTrainer:
    """
    PPO (Proximal Policy Optimization) trainer.
    
    Reward model'i kullanarak policy'yi optimize et.
    """
    
    def __init__(
        self,
        policy_model: nn.Module,
        ref_model: nn.Module,
        reward_model: RewardModel,
        value_model: nn.Module,
        config: RLHFConfig,
        device: str = "cuda"
    ):
        self.policy = policy_model
        self.ref_model = ref_model
        self.reward_model = reward_model
        self.value_model = value_model
        self.config = config
        self.device = device
        
        # Optimizers
        self.policy_optimizer = torch.optim.Adam(
            self.policy.parameters(),
            lr=config.ppo_lr
        )
        self.value_optimizer = torch.optim.Adam(
            self.value_model.parameters(),
            lr=config.ppo_lr
        )
        
        # Reference model frozen
        for param in self.ref_model.parameters():
            param.requires_grad = False
        
        for param in self.reward_model.parameters():
            param.requires_grad = False
        
        self.iteration = 0
        
    def generate_responses(
        self,
        prompts: torch.Tensor,
        prompt_mask: torch.Tensor,
        max_length: int = None
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Prompt'lara yanıt üret.
        
        Returns:
            sequences: (batch, seq_len)
            log_probs: (batch, seq_len - prompt_len)
            masks: (batch, seq_len - prompt_len)
        """
        max_length = max_length or self.config.max_length
        batch_size = prompts.size(0)
        
        sequences = prompts.clone()
        log_probs_list = []
        
        for step in range(max_length - prompts.size(1)):
            # Forward
            with torch.no_grad():
                outputs = self.policy(sequences)
                logits = outputs.logits[:, -1, :]  # Last token logits
                probs = F.softmax(logits / self.config.temperature, dim=-1)
                
                # Top-p sampling
                sorted_probs, sorted_indices = torch.sort(probs, descending=True)
                cumsum_probs = torch.cumsum(sorted_probs, dim=-1)
                
                # Remove tokens with cumulative probability above threshold
                sorted_indices_to_remove = cumsum_probs > self.config.top_p
                sorted_indices_to_remove[:, 1:] = sorted_indices_to_remove[:, :-1].clone()
                sorted_indices_to_remove[:, 0] = False
                
                indices_to_remove = sorted_indices_to_remove.scatter(
                    1, sorted_indices, sorted_indices_to_remove
                )
                logits[indices_to_remove] = float('-inf')
                
                probs = F.softmax(logits, dim=-1)
            
            # Sample
            next_token = torch.multinomial(probs, num_samples=1)
            
            # Log probability
            log_prob = F.log_softmax(logits, dim=-1)
            token_log_prob = log_prob.gather(1, next_token).squeeze(-1)
            log_probs_list.append(token_log_prob)
            
            # Append
            sequences = torch.cat([sequences, next_token], dim=-1)
            
            # Check for EOS
            # if (next_token == eos_token_id).all():
            #     break
        
        # Convert to tensors
        log_probs = torch.stack(log_probs_list, dim=1)  # (batch, gen_len)
        
        # Create mask for generated tokens only
        gen_mask = torch.ones_like(log_probs)
        
        return sequences, log_probs, gen_mask
    
    def compute_advantages(
        self,
        rewards: torch.Tensor,
        values: torch.Tensor,
        masks: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        GAE (Generalized Advantage Estimation) hesapla.
        """
        batch_size, seq_len = values.shape
        
        advantages = torch.zeros_like(values)
        last_advantage = 0
        
        # Backward pass for advantage computation
        for t in reversed(range(seq_len)):
            if t == seq_len - 1:
                next_value = 0
            else:
                next_value = values[:, t + 1]
            
            delta = rewards[:, t] + 0.99 * next_value * masks[:, t] - values[:, t]
            advantages[:, t] = delta + 0.95 * last_advantage * masks[:, t]
            last_advantage = advantages[:, t]
        
        # Returns
        returns = advantages + values
        
        return advantages, returns
    
    def train_step(
        self,
        prompts: torch.Tensor,
        prompt_mask: torch.Tensor,
        old_sequences: torch.Tensor,
        old_log_probs: torch.Tensor,
        old_values: torch.Tensor,
        rewards: torch.Tensor,
        masks: torch.Tensor
    ) -> Dict[str, float]:
        """
        PPO training step.
        """
        self.policy.train()
        self.value_model.train()
        
        total_policy_loss = 0
        total_value_loss = 0
        total_kl_div = 0
        
        for _ in range(self.config.ppo_epochs):
            # Policy forward
            outputs = self.policy(old_sequences)
            logits = outputs.logits[:, :-1, :]  # Exclude last token
            
            # New log probs
            new_log_probs = F.log_softmax(logits, dim=-1)
            new_log_probs = torch.gather(
                new_log_probs,
                2,
                old_sequences[:, 1:].unsqueeze(-1)
            ).squeeze(-1)
            
            # Ratio
            ratio = torch.exp(new_log_probs - old_log_probs)
            
            # Advantages
            advantages, returns = self.compute_advantages(rewards, old_values, masks)
            advantages = advantages.detach()
            
            # PPO loss
            surr1 = ratio * advantages
            surr2 = torch.clamp(
                ratio,
                1 - self.config.ppo_clip_epsilon,
                1 + self.config.ppo_clip_epsilon
            ) * advantages
            
            policy_loss = -torch.min(surr1, surr2).mean()
            
            # Value loss
            value_outputs = self.value_model(old_sequences)
            value_preds = value_outputs.logits.squeeze(-1)[:, :-1]
            
            value_loss = F.mse_loss(value_preds, returns)
            
            # KL divergence with reference model
            with torch.no_grad():
                ref_outputs = self.ref_model(old_sequences)
                ref_logits = ref_outputs.logits[:, :-1, :]
                ref_log_probs = F.log_softmax(ref_logits, dim=-1)
                ref_log_probs = torch.gather(
                    ref_log_probs,
                    2,
                    old_sequences[:, 1:].unsqueeze(-1)
                ).squeeze(-1)
            
            kl_div = (new_log_probs - ref_log_probs).mean()
            
            # Total loss
            loss = (
                policy_loss +
                0.5 * value_loss +
                self.config.kl_coef * kl_div
            )
            
            # Backward
            self.policy_optimizer.zero_grad()
            self.value_optimizer.zero_grad()
            loss.backward()
            
            torch.nn.utils.clip_grad_norm_(self.policy.parameters(), 1.0)
            torch.nn.utils.clip_grad_norm_(self.value_model.parameters(), 1.0)
            
            self.policy_optimizer.step()
            self.value_optimizer.step()
            
            total_policy_loss += policy_loss.item()
            total_value_loss += value_loss.item()
            total_kl_div += kl_div.item()
        
        self.iteration += 1
        
        return {
            'policy_loss': total_policy_loss / self.config.ppo_epochs,
            'value_loss': total_value_loss / self.config.ppo_epochs,
            'kl_div': total_kl_div / self.config.ppo_epochs
        }


class DPOTrainer:
    """
    DPO (Direct Preference Optimization) trainer.
    
    Reward model olmadan doğrudan preference'leri optimize et.
    """
    
    def __init__(
        self,
        policy_model: nn.Module,
        ref_model: nn.Module,
        config: RLHFConfig,
        device: str = "cuda"
    ):
        self.policy = policy_model
        self.ref_model = ref_model
        self.config = config
        self.device = device
        
        self.optimizer = torch.optim.Adam(
            self.policy.parameters(),
            lr=config.ppo_lr
        )
        
        # Reference model frozen
        for param in self.ref_model.parameters():
            param.requires_grad = False
        
    def compute_log_probs(
        self,
        model: nn.Module,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor
    ) -> torch.Tensor:
        """
        Sequence için log probability hesapla.
        """
        outputs = model(input_ids, attention_mask=attention_mask)
        logits = outputs.logits
        
        # Shift for next token prediction
        logits = logits[:, :-1, :]
        labels = input_ids[:, 1:]
        
        # Log probs
        log_probs = F.log_softmax(logits, dim=-1)
        
        # Gather
        token_log_probs = torch.gather(
            log_probs,
            2,
            labels.unsqueeze(-1)
        ).squeeze(-1)
        
        # Mask padding
        mask = attention_mask[:, 1:].float()
        token_log_probs = token_log_probs * mask
        
        # Sum over sequence
        sequence_log_probs = token_log_probs.sum(dim=-1)
        
        return sequence_log_probs
    
    def train_step(
        self,
        chosen_input_ids: torch.Tensor,
        chosen_attention_mask: torch.Tensor,
        rejected_input_ids: torch.Tensor,
        rejected_attention_mask: torch.Tensor
    ) -> Dict[str, float]:
        """
        DPO training step.
        
        Loss = -log(sigmoid(beta * (log_pi(y_w|x) - log_pi_ref(y_w|x) - log_pi(y_l|x) + log_pi_ref(y_l|x))))
        """
        self.policy.train()
        
        # Policy log probs
        policy_chosen_logps = self.compute_log_probs(
            self.policy, chosen_input_ids, chosen_attention_mask
        )
        policy_rejected_logps = self.compute_log_probs(
            self.policy, rejected_input_ids, rejected_attention_mask
        )
        
        # Reference log probs
        with torch.no_grad():
            ref_chosen_logps = self.compute_log_probs(
                self.ref_model, chosen_input_ids, chosen_attention_mask
            )
            ref_rejected_logps = self.compute_log_probs(
                self.ref_model, rejected_input_ids, rejected_attention_mask
            )
        
        # DPO loss
        beta = self.config.dpo_beta
        
        policy_logratios = policy_chosen_logps - policy_rejected_logps
        ref_logratios = ref_chosen_logps - ref_rejected_logps
        
        logits = beta * (policy_logratios - ref_logratios)
        loss = -F.logsigmoid(logits).mean()
        
        # Accuracy
        with torch.no_grad():
            accuracy = (logits > 0).float().mean()
            chosen_rewards = beta * (policy_chosen_logps - ref_chosen_logps)
            rejected_rewards = beta * (policy_rejected_logps - ref_rejected_logps)
            reward_margin = chosen_rewards - rejected_rewards
        
        # Backward
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.policy.parameters(), 1.0)
        self.optimizer.step()
        
        return {
            'loss': loss.item(),
            'accuracy': accuracy.item(),
            'reward_margin': reward_margin.mean().item()
        }


class RLHFService:
    """
    RLHF unified service.
    """
    
    def __init__(self, config: RLHFConfig, device: str = "cuda"):
        self.config = config
        self.device = device
        
        self.policy_model = None
        self.reward_model = None
        self.ref_model = None
        self.ppo_trainer = None
        self.dpo_trainer = None
        
    def setup_models(
        self,
        policy_model: nn.Module,
        value_model: nn.Module,
        tokenizer
    ):
        """Model'leri ayarla"""
        self.policy_model = policy_model.to(self.device)
        self.ref_model = deepcopy(policy_model).to(self.device)
        self.tokenizer = tokenizer
        
        # Value model shares architecture with policy
        self.value_model = value_model.to(self.device)
        
    def train_reward_model(
        self,
        preference_data: List[Dict],
        num_epochs: int = None
    ) -> Dict:
        """
        Reward model'i eğit.
        """
        num_epochs = num_epochs or self.config.reward_model_epochs
        
        # Create reward model
        self.reward_model = RewardModel(self.policy_model).to(self.device)
        
        optimizer = torch.optim.Adam(
            self.reward_model.parameters(),
            lr=self.config.reward_model_lr
        )
        
        dataset = PreferenceDataset(preference_data)
        dataloader = DataLoader(dataset, batch_size=4, shuffle=True)
        
        history = {'loss': [], 'accuracy': []}
        
        for epoch in range(num_epochs):
            total_loss = 0
            total_acc = 0
            
            for batch in dataloader:
                # Tokenize
                chosen = self.tokenizer(
                    [b['prompt'] + b['chosen'] for b in batch],
                    return_tensors='pt',
                    padding=True,
                    truncation=True
                ).to(self.device)
                
                rejected = self.tokenizer(
                    [b['prompt'] + b['rejected'] for b in batch],
                    return_tensors='pt',
                    padding=True,
                    truncation=True
                ).to(self.device)
                
                # Forward
                loss, acc = self.reward_model.compute_loss(
                    chosen['input_ids'],
                    chosen['attention_mask'],
                    rejected['input_ids'],
                    rejected['attention_mask']
                )
                
                # Backward
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
                total_acc += acc.item()
            
            avg_loss = total_loss / len(dataloader)
            avg_acc = total_acc / len(dataloader)
            
            history['loss'].append(avg_loss)
            history['accuracy'].append(avg_acc)
            
            logger.info(f"Reward model epoch {epoch+1}: loss={avg_loss:.4f}, acc={avg_acc:.4f}")
        
        return history
    
    def train_with_ppo(
        self,
        prompts: List[str],
        num_iterations: int = 100
    ) -> Dict:
        """
        PPO ile policy'yi optimize et.
        """
        if self.reward_model is None:
            raise RuntimeError("Train reward model first")
        
        # Setup PPO trainer
        self.ppo_trainer = PPOTrainer(
            self.policy_model,
            self.ref_model,
            self.reward_model,
            self.value_model,
            self.config,
            self.device
        )
        
        history = {'policy_loss': [], 'value_loss': [], 'kl_div': []}
        
        for iteration in range(num_iterations):
            # Generate responses
            prompt_batch = prompts[:self.config.ppo_batch_size]
            
            prompt_tokens = self.tokenizer(
                prompt_batch,
                return_tensors='pt',
                padding=True,
                truncation=True
            ).to(self.device)
            
            with torch.no_grad():
                sequences, log_probs, masks = self.ppo_trainer.generate_responses(
                    prompt_tokens['input_ids'],
                    prompt_tokens['attention_mask']
                )
                
                # Get rewards
                rewards = self.reward_model(
                    sequences,
                    torch.ones_like(sequences)
                ).unsqueeze(-1).expand(-1, masks.size(1))
                
                # Get values
                value_outputs = self.value_model(sequences)
                values = value_outputs.logits.squeeze(-1)[:, :-1]
            
            # Train
            metrics = self.ppo_trainer.train_step(
                prompt_tokens['input_ids'],
                prompt_tokens['attention_mask'],
                sequences,
                log_probs,
                values,
                rewards,
                masks
            )
            
            history['policy_loss'].append(metrics['policy_loss'])
            history['value_loss'].append(metrics['value_loss'])
            history['kl_div'].append(metrics['kl_div'])
            
            if iteration % 10 == 0:
                logger.info(
                    f"PPO iter {iteration}: "
                    f"policy_loss={metrics['policy_loss']:.4f}, "
                    f"kl_div={metrics['kl_div']:.4f}"
                )
        
        return history
    
    def train_with_dpo(
        self,
        preference_data: List[Dict],
        num_epochs: int = 3
    ) -> Dict:
        """
        DPO ile doğrudan preference optimization.
        """
        # Setup DPO trainer
        self.dpo_trainer = DPOTrainer(
            self.policy_model,
            self.ref_model,
            self.config,
            self.device
        )
        
        dataset = PreferenceDataset(preference_data)
        dataloader = DataLoader(dataset, batch_size=4, shuffle=True)
        
        history = {'loss': [], 'accuracy': [], 'reward_margin': []}
        
        for epoch in range(num_epochs):
            total_loss = 0
            
            for batch in dataloader:
                # Tokenize
                chosen = self.tokenizer(
                    [b['prompt'] + b['chosen'] for b in batch],
                    return_tensors='pt',
                    padding=True,
                    truncation=True
                ).to(self.device)
                
                rejected = self.tokenizer(
                    [b['prompt'] + b['rejected'] for b in batch],
                    return_tensors='pt',
                    padding=True,
                    truncation=True
                ).to(self.device)
                
                # Train
                metrics = self.dpo_trainer.train_step(
                    chosen['input_ids'],
                    chosen['attention_mask'],
                    rejected['input_ids'],
                    rejected['attention_mask']
                )
                
                total_loss += metrics['loss']
                history['accuracy'].append(metrics['accuracy'])
                history['reward_margin'].append(metrics['reward_margin'])
            
            avg_loss = total_loss / len(dataloader)
            history['loss'].append(avg_loss)
            
            logger.info(f"DPO epoch {epoch+1}: loss={avg_loss:.4f}")
        
        return history


# Global RLHF servisi
rlhf_config = RLHFConfig()
rlhf_service = RLHFService(rlhf_config)
