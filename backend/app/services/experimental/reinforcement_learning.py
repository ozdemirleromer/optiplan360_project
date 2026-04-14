"""
Reinforcement Learning Optimization System
Advanced RL algorithms for process optimization, resource allocation, and decision making
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
import gym
from gym import spaces
import torch
import torch.nn as nn
import torch.optim as optim
from collections import deque, defaultdict
import random
import joblib

logger = logging.getLogger(__name__)


class RLAlgorithm(Enum):
    """Reinforcement learning algorithms"""
    Q_LEARNING = "q_learning"
    DEEP_Q_NETWORK = "deep_q_network"
    DOUBLE_DQN = "double_dqn"
    DUELING_DQN = "dueling_dqn"
    POLICY_GRADIENT = "policy_gradient"
    ACTOR_CRITIC = "actor_critic"
    PPO = "ppo"
    A3C = "a3c"
    DDPG = "ddpg"
    SAC = "sac"


class EnvironmentType(Enum):
    """Environment types"""
    INVENTORY_MANAGEMENT = "inventory_management"
    PRODUCTION_SCHEDULING = "production_scheduling"
    RESOURCE_ALLOCATION = "resource_allocation"
    PRICING_OPTIMIZATION = "pricing_optimization"
    DEMAND_FORECASTING = "demand_forecasting"
    SUPPLY_CHAIN = "supply_chain"
    QUALITY_CONTROL = "quality_control"


@dataclass
class RLState:
    """RL state representation"""
    state_vector: np.ndarray
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RLAction:
    """RL action representation"""
    action_id: int
    action_vector: np.ndarray
    action_name: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RLReward:
    """RL reward signal"""
    reward: float
    done: bool
    info: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RLExperience:
    """RL experience tuple"""
    state: RLState
    action: RLAction
    reward: float
    next_state: RLState
    done: bool
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RLTrainingConfig:
    """RL training configuration"""
    algorithm: RLAlgorithm
    learning_rate: float = 0.001
    gamma: float = 0.95
    epsilon: float = 1.0
    epsilon_decay: float = 0.995
    epsilon_min: float = 0.01
    batch_size: int = 32
    memory_size: int = 10000
    target_update_frequency: int = 1000
    max_episodes: int = 1000
    max_steps_per_episode: int = 1000
    save_frequency: int = 100
    evaluation_frequency: int = 50


class QLearningAgent:
    """Q-Learning agent"""
    
    def __init__(self, state_size: int, action_size: int, config: RLTrainingConfig):
        self.state_size = state_size
        self.action_size = action_size
        self.config = config
        
        # Q-table
        self.q_table = np.zeros((state_size, action_size))
        
        # Training parameters
        self.learning_rate = config.learning_rate
        self.gamma = config.gamma
        self.epsilon = config.epsilon
        self.epsilon_decay = config.epsilon_decay
        self.epsilon_min = config.epsilon_min
        
        # Experience replay
        self.memory = deque(maxlen=config.memory_size)
        
        # Metrics
        self.episode_rewards = []
        self.training_history = []
        
    def choose_action(self, state: np.ndarray, training: bool = True) -> int:
        """Choose action using epsilon-greedy policy"""
        if training and random.random() < self.epsilon:
            return random.randint(0, self.action_size - 1)
        else:
            state_index = self._state_to_index(state)
            return np.argmax(self.q_table[state_index])
    
    def _state_to_index(self, state: np.ndarray) -> int:
        """Convert state to index for Q-table"""
        # Simple hash function for state indexing
        state_hash = hash(state.tobytes())
        return abs(state_hash) % self.state_size
    
    def learn(self, experience: RLExperience) -> None:
        """Learn from experience"""
        state_index = self._state_to_index(experience.state.state_vector)
        next_state_index = self._state_to_index(experience.next_state.state_vector)
        
        # Q-learning update rule
        best_next_action = np.argmax(self.q_table[next_state_index])
        td_target = experience.reward + self.gamma * best_next_action * (1 - experience.done)
        
        # Update Q-table
        self.q_table[state_index, experience.action.action_id] = \
            self.q_table[state_index, experience.action.action_id] + \
            self.learning_rate * (td_target - self.q_table[state_index, experience.action.action_id])
        
        # Store experience
        self.memory.append(experience)
        
        # Decay epsilon
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)
    
    def train(self, env, episodes: int) -> Dict[str, Any]:
        """Train the agent"""
        episode_rewards = []
        
        for episode in range(episodes):
            state = env.reset()
            total_reward = 0
            steps = 0
            
            while not env.done and steps < self.config.max_steps_per_episode:
                action_id = self.choose_action(state, training=True)
                next_state, reward, done, info = env.step(action_id)
                
                # Create experience
                experience = RLExperience(
                    state=RLState(state_vector=state),
                    action=RLAction(action_id=action_id, action_vector=np.array([action_id])),
                    reward=reward,
                    next_state=RLState(state_vector=next_state),
                    done=done,
                    metadata={'episode': episode, 'step': steps}
                )
                
                self.learn(experience)
                
                state = next_state
                total_reward += reward
                steps += 1
            
            episode_rewards.append(total_reward)
            
            # Log progress
            if episode % 100 == 0:
                avg_reward = np.mean(episode_rewards[-100:])
                logger.info(f"Episode {episode}, Average Reward: {avg_reward:.2f}, Epsilon: {self.epsilon:.3f}")
        
        return {
            'episodes': episodes,
            'average_reward': np.mean(episode_rewards),
            'final_epsilon': self.epsilon,
            'training_history': episode_rewards
        }


class DQNetwork(nn.Module):
    """Deep Q-Network"""
    
    def __init__(self, state_size: int, action_size: int, hidden_size: int = 256):
        super(DQNetwork, self).__init__()
        
        self.fc1 = nn.Linear(state_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, hidden_size)
        self.fc3 = nn.Linear(hidden_size, action_size)
        
        self.relu = nn.ReLU()
        
    def forward(self, x):
        x = self.relu(self.fc1(x))
        x = self.relu(self.fc2(x))
        x = self.fc3(x)
        return x


class DeepQAgent:
    """Deep Q-Network agent"""
    
    def __init__(self, state_size: int, action_size: int, config: RLTrainingConfig):
        self.state_size = state_size
        self.action_size = action_size
        self.config = config
        
        # Neural network
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.q_network = DQNetwork(state_size, action_size).to(self.device)
        self.target_network = DQNetwork(state_size, action_size).to(self.device)
        
        # Optimizer
        self.optimizer = optim.Adam(self.q_network.parameters(), lr=config.learning_rate)
        
        # Training parameters
        self.gamma = config.gamma
        self.epsilon = config.epsilon
        self.epsilon_decay = config.epsilon_decay
        self.epsilon_min = config.epsilon_min
        self.batch_size = config.batch_size
        self.target_update_frequency = config.target_update_frequency
        
        # Experience replay
        self.memory = deque(maxlen=config.memory_size)
        self.steps_done = 0
        
        # Metrics
        self.episode_rewards = []
        self.training_history = []
        
    def choose_action(self, state: np.ndarray, training: bool = True) -> int:
        """Choose action using epsilon-greedy policy"""
        if training and random.random() < self.epsilon:
            return random.randint(0, self.action_size - 1)
        else:
            with torch.no_grad():
                state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
                q_values = self.q_network(state_tensor)
                return q_values.argmax().item()
    
    def store_experience(self, experience: RLExperience) -> None:
        """Store experience in replay memory"""
        self.memory.append(experience)
    
    def learn(self) -> None:
        """Learn from experience replay"""
        if len(self.memory) < self.batch_size:
            return
        
        # Sample batch
        batch = random.sample(self.memory, self.batch_size)
        
        # Prepare batch
        states = torch.FloatTensor([exp.state.state_vector for exp in batch]).to(self.device)
        actions = torch.LongTensor([exp.action.action_id for exp in batch]).to(self.device)
        rewards = torch.FloatTensor([exp.reward for exp in batch]).to(self.device)
        next_states = torch.FloatTensor([exp.next_state.state_vector for exp in batch]).to(self.device)
        dones = torch.BoolTensor([exp.done for exp in batch]).to(self.device)
        
        # Get current Q values
        current_q_values = self.q_network(states).gather(1, actions.unsqueeze(1))
        
        # Get next Q values from target network
        next_q_values = self.target_network(next_states).max(1)[0].detach()
        
        # Compute target Q values
        target_q_values = rewards + (self.gamma * next_q_values * ~dones)
        
        # Compute loss
        loss = nn.functional.mse_loss(current_q_values, target_q_values.unsqueeze(1))
        
        # Optimize
        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()
        
        # Decay epsilon
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)
        
        # Update target network
        self.steps_done += 1
        if self.steps_done % self.target_update_frequency == 0:
            self.target_network.load_state_dict(self.q_network.state_dict())
    
    def train(self, env, episodes: int) -> Dict[str, Any]:
        """Train the agent"""
        episode_rewards = []
        
        for episode in range(episodes):
            state = env.reset()
            total_reward = 0
            steps = 0
            
            while not env.done and steps < self.config.max_steps_per_episode:
                action_id = self.choose_action(state, training=True)
                next_state, reward, done, info = env.step(action_id)
                
                # Create experience
                experience = RLExperience(
                    state=RLState(state_vector=state),
                    action=RLAction(action_id=action_id, action_vector=np.array([action_id])),
                    reward=reward,
                    next_state=RLState(state_vector=next_state),
                    done=done,
                    metadata={'episode': episode, 'step': steps}
                )
                
                self.store_experience(experience)
                self.learn()
                
                state = next_state
                total_reward += reward
                steps += 1
            
            episode_rewards.append(total_reward)
            
            # Log progress
            if episode % 100 == 0:
                avg_reward = np.mean(episode_rewards[-100:])
                logger.info(f"Episode {episode}, Average Reward: {avg_reward:.2f}, Epsilon: {self.epsilon:.3f}")
        
        return {
            'episodes': episodes,
            'average_reward': np.mean(episode_rewards),
            'final_epsilon': self.epsilon,
            'training_history': episode_rewards
        }


class InventoryOptimizationEnv:
    """Inventory management environment for RL"""
    
    def __init__(self, initial_inventory: Dict[str, float], demand_history: List[float], 
                 holding_cost: float = 0.1, stockout_cost: float = 10.0, ordering_cost: float = 5.0):
        self.initial_inventory = initial_inventory.copy()
        self.inventory = initial_inventory.copy()
        self.demand_history = demand_history
        self.holding_cost = holding_cost
        self.stockout_cost = stockout_cost
        self.ordering_cost = ordering_cost
        
        self.current_step = 0
        self.max_steps = len(demand_history)
        self.done = False
        
        # Action space: order quantities for each product
        self.action_space = spaces.Box(low=0, high=10, shape=(len(initial_inventory),), dtype=np.float32)
        self.observation_space = spaces.Box(low=0, high=100, shape=(len(initial_inventory) * 2,), dtype=np.float32)
        
    def reset(self) -> np.ndarray:
        """Reset environment"""
        self.inventory = self.initial_inventory.copy()
        self.current_step = 0
        self.done = False
        return self._get_state()
    
    def step(self, action: np.ndarray) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        """Execute action in environment"""
        # Apply action (order quantities)
        for i, (product, quantity) in enumerate(self.inventory.items()):
            self.inventory[product] += action[i]
        
        # Simulate demand
        demand = self.demand_history[self.current_step] if self.current_step < len(self.demand_history) else 0
        
        # Calculate reward
        reward = 0
        
        # Holding cost
        for product, quantity in self.inventory.items():
            reward -= self.holding_cost * quantity
        
        # Stockout cost
        if demand > self.inventory.get('product1', 0):
            reward -= self.stockout_cost * (demand - self.inventory.get('product1', 0))
        
        # Ordering cost
        for i, quantity in enumerate(action):
            if quantity > 0:
                reward -= self.ordering_cost
        
        # Update inventory after demand
        for product, quantity in self.inventory.items():
            self.inventory[product] = max(0, quantity - demand)
        
        # Move to next step
        self.current_step += 1
        if self.current_step >= self.max_steps:
            self.done = True
        
        return self._get_state(), reward, self.done, {'step': self.current_step}
    
    def _get_state(self) -> np.ndarray:
        """Get current state"""
        state = []
        for product, quantity in self.inventory.items():
            state.extend([quantity, self.demand_history[self.current_step] if self.current_step < len(self.demand_history) else 0])
        return np.array(state)


class ProductionSchedulingEnv:
    """Production scheduling environment for RL"""
    
    def __init__(self, jobs: List[Dict[str, Any]], machines: List[Dict[str, Any]], 
                 processing_times: Dict[str, float]):
        self.jobs = jobs.copy()
        self.machines = machines.copy()
        self.processing_times = processing_times.copy()
        
        self.current_time = 0
        self.max_time = 1000
        self.done = False
        
        # Action space: assign jobs to machines
        self.action_space = spaces.Discrete(len(jobs) * len(machines))
        self.observation_space = spaces.Box(low=0, high=1, shape=(len(jobs) + len(machines),), dtype=np.float32)
        
    def reset(self) -> np.ndarray:
        """Reset environment"""
        self.current_time = 0
        self.done = False
        return self._get_state()
    
    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        """Execute action in environment"""
        # Decode action
        job_idx = action // len(self.machines)
        machine_idx = action % len(self.machines)
        
        reward = 0
        
        # Check if job can be processed
        job = self.jobs[job_idx]
        machine = self.machines[machine_idx]
        
        if not job.get('completed', False) and machine['available']:
            # Process job
            processing_time = self.processing_times.get(job['id'], 10)
            reward += job['priority'] * processing_time  # Reward based on priority and time
            job['completed'] = True
            machine['available'] = False
            
            # Machine becomes available after processing time
            # (simplified - would need proper scheduling)
        
        # Update time
        self.current_time += 1
        if self.current_time >= self.max_time:
            self.done = True
        
        return self._get_state(), reward, self.done, {'time': self.current_time}
    
    def _get_state(self) -> np.ndarray:
        """Get current state"""
        state = []
        
        # Job states
        for job in self.jobs:
            state.append(1.0 if job.get('completed', False) else 0.0)
        
        # Machine states
        for machine in self.machines:
            state.append(1.0 if machine['available'] else 0.0)
        
        return np.array(state)


class RLOptimizationService:
    """Main RL optimization service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.agents = {}
        self.environments = {}
        self.training_results = {}
        
    def create_inventory_optimization_agent(self, initial_inventory: Dict[str, float], 
                                         demand_history: List[float]) -> Dict[str, Any]:
        """Create inventory optimization agent"""
        env = InventoryOptimizationEnv(initial_inventory, demand_history)
        config = RLTrainingConfig(
            algorithm=RLAlgorithm.DEEP_Q_NETWORK,
            learning_rate=0.001,
            gamma=0.95,
            memory_size=5000
        )
        
        agent = DeepQAgent(
            state_size=len(initial_inventory) * 2,
            action_size=len(initial_inventory),
            config=config
        )
        
        agent_id = f"inventory_opt_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        self.agents[agent_id] = {
            'agent': agent,
            'environment': env,
            'config': config,
            'created_at': datetime.utcnow()
        }
        
        self.environments[agent_id] = env
        
        return {
            'agent_id': agent_id,
            'environment_type': EnvironmentType.INVENTORY_MANAGEMENT,
            'state_size': len(initial_inventory) * 2,
            'action_size': len(initial_inventory),
            'config': config
        }
    
    def create_production_scheduling_agent(self, jobs: List[Dict[str, Any]], 
                                          machines: List[Dict[str, Any]], 
                                          processing_times: Dict[str, float]) -> Dict[str, Any]:
        """Create production scheduling agent"""
        env = ProductionSchedulingEnv(jobs, machines, processing_times)
        config = RLTrainingConfig(
            algorithm=RLAlgorithm.DEEP_Q_NETWORK,
            learning_rate=0.001,
            gamma=0.95,
            memory_size=10000
        )
        
        agent = DeepQAgent(
            state_size=len(jobs) + len(machines),
            action_size=len(jobs) * len(machines),
            config=config
        )
        
        agent_id = f"production_sched_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        self.agents[agent_id] = {
            'agent': agent,
            'environment': env,
            'config': config,
            'created_at': datetime.utcnow()
        }
        
        self.environments[agent_id] = env
        
        return {
            'agent_id': agent_id,
            'environment_type': EnvironmentType.PRODUCTION_SCHEDULING,
            'state_size': len(jobs) + len(machines),
            'action_size': len(jobs) * len(machines),
            'config': config
        }
    
    def train_agent(self, agent_id: str, episodes: int = 1000) -> Dict[str, Any]:
        """Train RL agent"""
        if agent_id not in self.agents:
            return {'error': f'Agent {agent_id} not found'}
        
        agent_data = self.agents[agent_id]
        agent = agent_data['agent']
        env = agent_data['environment']
        
        # Train agent
        training_result = agent.train(env, episodes)
        
        # Store training result
        self.training_results[agent_id] = {
            'training_result': training_result,
            'trained_at': datetime.utcnow(),
            'episodes': episodes
        }
        
        # Save to Redis
        if self.redis:
            try:
                save_data = {
                    'agent_data': agent_data,
                    'training_result': training_result,
                    'saved_at': datetime.utcnow().isoformat()
                }
                self.redis.setex(f"rl_agent:{agent_id}", 86400 * 7, json.dumps(save_data))
                logger.info(f"Saved RL agent {agent_id} to Redis")
            except Exception as e:
                logger.error(f"Failed to save RL agent: {e}")
        
        return {
            'agent_id': agent_id,
            'training_result': training_result,
            'episodes_trained': episodes,
            'trained_at': training_result['trained_at']
        }
    
    def get_policy(self, agent_id: str, state: np.ndarray) -> Dict[str, Any]:
        """Get policy action for given state"""
        if agent_id not in self.agents:
            return {'error': f'Agent {agent_id} not found'}
        
        agent = self.agents[agent_id]['agent']
        
        # Get action (no training mode)
        action_id = agent.choose_action(state, training=False)
        
        return {
            'agent_id': agent_id,
            'action_id': action_id,
            'action_vector': np.array([action_id]),
            'confidence': 1.0,  # Would need softmax for probabilities
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def evaluate_agent(self, agent_id: str, episodes: int = 100) -> Dict[str, Any]:
        """Evaluate trained agent"""
        if agent_id not in self.agents:
            return {'error': f'Agent {agent_id} not found'}
        
        agent_data = self.agents[agent_id]
        agent = agent_data['agent']
        env = agent_data['environment']
        
        evaluation_rewards = []
        
        for episode in range(episodes):
            state = env.reset()
            total_reward = 0
            steps = 0
            
            while not env.done and steps < 1000:  # Limit evaluation steps
                action_id = agent.choose_action(state, training=False)
                next_state, reward, done, info = env.step(action_id)
                
                total_reward += reward
                state = next_state
                steps += 1
            
            evaluation_rewards.append(total_reward)
        
        return {
            'agent_id': agent_id,
            'evaluation_episodes': episodes,
            'average_reward': np.mean(evaluation_rewards),
            'min_reward': np.min(evaluation_rewards),
            'max_reward': np.max(evaluation_rewards),
            'std_reward': np.std(evaluation_rewards),
            'evaluated_at': datetime.utcnow().isoformat()
        }
    
    def list_agents(self) -> List[Dict[str, Any]]:
        """List all RL agents"""
        agents = []
        
        for agent_id, agent_data in self.agents.items():
            agents.append({
                'agent_id': agent_id,
                'environment_type': agent_data['environment_type'].value,
                'state_size': agent_data['config'].memory_size,
                'action_size': agent_data['config'].memory_size,
                'algorithm': agent_data['config'].algorithm.value,
                'created_at': agent_data['created_at'].isoformat(),
                'training_results': self.training_results.get(agent_id, {})
            })
        
        return agents


# Global RL service instance
rl_optimization_service = RLOptimizationService()

# Export functions
def create_inventory_optimization_agent(initial_inventory: Dict[str, float], demand_history: List[float]) -> Dict[str, Any]:
    """Create inventory optimization agent"""
    return rl_optimization_service.create_inventory_optimization_agent(initial_inventory, demand_history)

def create_production_scheduling_agent(jobs: List[Dict[str, Any]], machines: List[Dict[str, Any]], 
                                     processing_times: Dict[str, float]) -> Dict[str, Any]:
    """Create production scheduling agent"""
    return rl_optimization_service.create_production_scheduling_agent(jobs, machines, processing_times)

def train_rl_agent(agent_id: str, episodes: int = 1000) -> Dict[str, Any]:
    """Train RL agent"""
    return rl_optimization_service.train_agent(agent_id, episodes)

def get_rl_policy(agent_id: str, state: np.ndarray) -> Dict[str, Any]:
    """Get policy action for given state"""
    return rl_optimization_service.get_policy(agent_id, state)

def evaluate_rl_agent(agent_id: str, episodes: int = 100) -> Dict[str, Any]:
    """Evaluate trained agent"""
    return rl_optimization_service.evaluate_agent(agent_id, episodes)

def list_rl_agents() -> List[Dict[str, Any]]:
    """List all RL agents"""
    return rl_optimization_service.list_agents()

# Export all components
__all__ = [
    'RLAlgorithm',
    'EnvironmentType',
    'RLState',
    'RLAction',
    'RLReward',
    'RLExperience',
    'RLTrainingConfig',
    'QLearningAgent',
    'DQNetwork',
    'DeepQAgent',
    'InventoryOptimizationEnv',
    'ProductionSchedulingEnv',
    'RLOptimizationService',
    'create_inventory_optimization_agent',
    'create_production_scheduling_agent',
    'train_rl_agent',
    'get_rl_policy',
    'evaluate_rl_agent',
    'list_rl_agents',
    'rl_optimization_service',
]
