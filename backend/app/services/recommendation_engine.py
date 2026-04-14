"""
Machine Learning Based Recommendation System
Advanced recommendation engine with collaborative filtering, content-based filtering, and hybrid approaches
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import redis
import pickle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error
import joblib
import json

logger = logging.getLogger(__name__)


class RecommendationType(Enum):
    """Recommendation types"""
    COLLABORATIVE = "collaborative"
    CONTENT_BASED = "content_based"
    HYBRID = "hybrid"
    TRENDING = "trending"
    SIMILAR_PRODUCTS = "similar_products"
    FREQUENTLY_BOUGHT = "frequently_bought"


@dataclass
class Recommendation:
    """Recommendation item"""
    item_id: str
    item_type: str
    title: str
    score: float
    reason: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.0
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class UserInteraction:
    """User interaction data"""
    user_id: str
    item_id: str
    item_type: str
    interaction_type: str  # view, like, purchase, add_to_cart
    rating: Optional[float] = None
    timestamp: datetime
    session_id: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MLModelConfig:
    """ML model configuration"""
    collaborative_model_path: str = "models/collaborative_model.pkl"
    content_model_path: str = "models/content_model.pkl"
    hybrid_model_path: str = "models/hybrid_model.pkl"
    min_interactions: int = 5
    max_recommendations: int = 10
    similarity_threshold: float = 0.1
    update_frequency_hours: int = 6
    feature_dim: int = 50


class CollaborativeFiltering:
    """Collaborative filtering recommendation engine"""
    
    def __init__(self, config: MLModelConfig):
        self.config = config
        self.user_item_matrix = None
        self.item_features = None
        self.user_features = None
        self.svd_model = None
        self.interaction_weights = {
            'view': 1.0,
            'like': 2.0,
            'add_to_cart': 3.0,
            'purchase': 5.0
        }
    
    def train(self, interactions: List[UserInteraction]) -> None:
        """Train collaborative filtering model"""
        logger.info("Training collaborative filtering model...")
        
        # Create user-item interaction matrix
        df = pd.DataFrame([{
            'user_id': i.user_id,
            'item_id': i.item_id,
            'rating': self.interaction_weights.get(i.interaction_type, 1.0),
            'timestamp': i.timestamp
        } for i in interactions])
        
        # Create user-item matrix
        user_item_pivot = df.pivot_table(
            index='user_id',
            columns='item_id',
            values='rating',
            fill_value=0
        )
        
        self.user_item_matrix = user_item_pivot.values
        self.user_ids = user_item_pivot.index.tolist()
        self.item_ids = user_item_pivot.columns.tolist()
        
        # Apply SVD for dimensionality reduction
        self.svd_model = TruncatedSVD(n_components=self.config.feature_dim)
        self.user_features = self.svd_model.fit_transform(self.user_item_matrix)
        self.item_features = self.svd_model.components_.T
        
        logger.info(f"Collaborative model trained with {len(self.user_ids)} users and {len(self.item_ids)} items")
    
    def predict(self, user_id: str, item_ids: List[str]) -> List[float]:
        """Predict ratings for user-item pairs"""
        if user_id not in self.user_ids or self.svd_model is None:
            return [0.0] * len(item_ids)
        
        user_idx = self.user_ids.index(user_id)
        user_vector = self.user_features[user_idx]
        
        predictions = []
        for item_id in item_ids:
            if item_id in self.item_ids:
                item_idx = self.item_ids.index(item_id)
                item_vector = self.item_features[item_idx]
                
                # Calculate predicted rating
                predicted_rating = np.dot(user_vector, item_vector)
                predictions.append(predicted_rating)
            else:
                predictions.append(0.0)
        
        return predictions
    
    def get_similar_users(self, user_id: str, n: int = 10) -> List[Tuple[str, float]]:
        """Get similar users based on interaction patterns"""
        if user_id not in self.user_ids:
            return []
        
        user_idx = self.user_ids.index(user_id)
        user_vector = self.user_features[user_idx]
        
        # Calculate cosine similarity
        similarities = cosine_similarity([user_vector], self.user_features)[0]
        
        # Get top similar users (excluding the user themselves)
        similar_indices = np.argsort(similarities)[::-1][1:n+1]
        
        return [(self.user_ids[i], similarities[i]) for i in similar_indices]


class ContentBasedFiltering:
    """Content-based filtering recommendation engine"""
    
    def __init__(self, config: MLModelConfig):
        self.config = config
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=5000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        self.item_features = None
        self.item_metadata = {}
    
    def train(self, items: List[Dict[str, Any]]) -> None:
        """Train content-based model"""
        logger.info("Training content-based model...")
        
        # Extract text features from items
        item_texts = []
        self.item_metadata = {}
        
        for item in items:
            item_id = item['id']
            self.item_metadata[item_id] = item
            
            # Combine text features
            text_features = []
            if 'name' in item:
                text_features.append(item['name'])
            if 'description' in item:
                text_features.append(item['description'])
            if 'category' in item:
                text_features.append(item['category'])
            if 'tags' in item:
                text_features.extend(item['tags'])
            
            item_texts.append(' '.join(text_features))
        
        # Create TF-IDF matrix
        self.item_features = self.tfidf_vectorizer.fit_transform(item_texts)
        self.item_ids = [item['id'] for item in items]
        
        logger.info(f"Content-based model trained with {len(self.item_ids)} items")
    
    def get_similar_items(self, item_id: str, n: int = 10) -> List[Tuple[str, float]]:
        """Get similar items based on content"""
        if item_id not in self.item_ids:
            return []
        
        item_idx = self.item_ids.index(item_id)
        item_vector = self.item_features[item_idx]
        
        # Calculate cosine similarity
        similarities = cosine_similarity(item_vector, self.item_features)[0]
        
        # Get top similar items (excluding the item itself)
        similar_indices = np.argsort(similarities)[::-1][1:n+1]
        
        return [(self.item_ids[i], similarities[i]) for i in similar_indices]
    
    def recommend_for_user_profile(self, user_profile: Dict[str, Any], n: int = 10) -> List[Recommendation]:
        """Recommend items based on user profile"""
        # Create user profile vector
        profile_text = ' '.join([
            user_profile.get('preferences', ''),
            user_profile.get('categories', ''),
            user_profile.get('previous_searches', '')
        ])
        
        profile_vector = self.tfidf_vectorizer.transform([profile_text])
        
        # Calculate similarities with all items
        similarities = cosine_similarity(profile_vector, self.item_features)[0]
        
        # Get top recommendations
        top_indices = np.argsort(similarities)[::-1][:n]
        
        recommendations = []
        for idx in top_indices:
            item_id = self.item_ids[idx]
            item_metadata = self.item_metadata[item_id]
            
            recommendations.append(Recommendation(
                item_id=item_id,
                item_type=item_metadata.get('type', 'product'),
                title=item_metadata.get('name', ''),
                score=float(similarities[idx]),
                reason='Content-based similarity',
                metadata=item_metadata,
                confidence=min(similarities[idx], 1.0)
            ))
        
        return recommendations


class HybridRecommender:
    """Hybrid recommendation engine combining multiple approaches"""
    
    def __init__(self, config: MLModelConfig):
        self.config = config
        self.collaborative = CollaborativeFiltering(config)
        self.content_based = ContentBasedFiltering(config)
        self.trending_weights = {
            'collaborative': 0.4,
            'content_based': 0.3,
            'trending': 0.2,
            'popularity': 0.1
        }
    
    def train(self, interactions: List[UserInteraction], items: List[Dict[str, Any]]) -> None:
        """Train all recommendation models"""
        logger.info("Training hybrid recommendation model...")
        
        # Train collaborative filtering
        self.collaborative.train(interactions)
        
        # Train content-based filtering
        self.content_based.train(items)
        
        logger.info("Hybrid recommendation model training completed")
    
    def recommend(self, 
                 user_id: str, 
                 user_profile: Optional[Dict[str, Any]] = None,
                 context: Optional[Dict[str, Any]] = None,
                 n: int = 10) -> List[Recommendation]:
        """Generate hybrid recommendations"""
        recommendations = []
        
        # Get collaborative filtering recommendations
        try:
            # Get items user hasn't interacted with
            all_items = self.content_based.item_ids if self.content_based.item_ids else []
            collaborative_scores = self.collaborative.predict(user_id, all_items)
            
            collaborative_recs = []
            for item_id, score in zip(all_items, collaborative_scores):
                if score > self.config.similarity_threshold:
                    item_metadata = self.content_based.item_metadata.get(item_id, {})
                    collaborative_recs.append(Recommendation(
                        item_id=item_id,
                        item_type=item_metadata.get('type', 'product'),
                        title=item_metadata.get('name', ''),
                        score=score * self.trending_weights['collaborative'],
                        reason='Collaborative filtering',
                        metadata=item_metadata,
                        confidence=min(score, 1.0)
                    ))
            
            recommendations.extend(collaborative_recs)
        except Exception as e:
            logger.error(f"Collaborative filtering error: {e}")
        
        # Get content-based recommendations
        try:
            if user_profile:
                content_recs = self.content_based.recommend_for_user_profile(user_profile, n)
                for rec in content_recs:
                    rec.score *= self.trending_weights['content_based']
                recommendations.extend(content_recs)
        except Exception as e:
            logger.error(f"Content-based filtering error: {e}")
        
        # Get trending items
        try:
            trending_recs = self._get_trending_items(n)
            for rec in trending_recs:
                rec.score *= self.trending_weights['trending']
            recommendations.extend(trending_recs)
        except Exception as e:
            logger.error(f"Trending items error: {e}")
        
        # Sort and return top recommendations
        recommendations.sort(key=lambda x: x.score, reverse=True)
        
        # Remove duplicates
        seen_items = set()
        unique_recommendations = []
        for rec in recommendations:
            if rec.item_id not in seen_items:
                seen_items.add(rec.item_id)
                unique_recommendations.append(rec)
        
        return unique_recommendations[:n]
    
    def _get_trending_items(self, n: int = 10) -> List[Recommendation]:
        """Get trending items based on recent interactions"""
        # This would typically query recent interaction data
        # For now, return empty list
        return []


class RecommendationEngine:
    """Main recommendation engine service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None, config: MLModelConfig = None):
        self.redis = redis_client
        self.config = config or MLModelConfig()
        self.hybrid_recommender = HybridRecommender(self.config)
        self.interaction_buffer: List[UserInteraction] = []
        self.max_buffer_size = 1000
        
        # Load models if available
        self._load_models()
    
    def _load_models(self) -> None:
        """Load pre-trained models"""
        try:
            # Load collaborative model
            if self.redis:
                collaborative_data = self.redis.get('ml_models:collaborative')
                if collaborative_data:
                    self.hybrid_recommender.collaborative = pickle.loads(collaborative_data)
                    logger.info("Loaded collaborative model from Redis")
            
            # Load content model
            if self.redis:
                content_data = self.redis.get('ml_models:content')
                if content_data:
                    self.hybrid_recommender.content_based = pickle.loads(content_data)
                    logger.info("Loaded content model from Redis")
                    
        except Exception as e:
            logger.error(f"Model loading error: {e}")
    
    def _save_models(self) -> None:
        """Save trained models to Redis"""
        try:
            if self.redis:
                # Save collaborative model
                if self.hybrid_recommender.collaborative:
                    collaborative_data = pickle.dumps(self.hybrid_recommender.collaborative)
                    self.redis.setex('ml_models:collaborative', 86400, collaborative_data)
                
                # Save content model
                if self.hybrid_recommender.content_based:
                    content_data = pickle.dumps(self.hybrid_recommender.content_based)
                    self.redis.setex('ml_models:content', 86400, content_data)
                    
                logger.info("Models saved to Redis")
                
        except Exception as e:
            logger.error(f"Model saving error: {e}")
    
    def add_interaction(self, interaction: UserInteraction) -> None:
        """Add user interaction to buffer"""
        self.interaction_buffer.append(interaction)
        
        # Flush buffer if needed
        if len(self.interaction_buffer) >= self.max_buffer_size:
            self.flush_interactions()
    
    def flush_interactions(self) -> None:
        """Flush interaction buffer to storage"""
        if not self.interaction_buffer:
            return
        
        try:
            # Store interactions in Redis
            if self.redis:
                for interaction in self.interaction_buffer:
                    interaction_data = {
                        'user_id': interaction.user_id,
                        'item_id': interaction.item_id,
                        'item_type': interaction.item_type,
                        'interaction_type': interaction.interaction_type,
                        'rating': interaction.rating,
                        'timestamp': interaction.timestamp.isoformat(),
                        'session_id': interaction.session_id,
                        'context': interaction.context
                    }
                    
                    key = f"interactions:{interaction.user_id}"
                    self.redis.lpush(key, json.dumps(interaction_data))
                    self.redis.expire(key, 86400 * 30)  # 30 days TTL
            
            logger.info(f"Flushed {len(self.interaction_buffer)} interactions")
            self.interaction_buffer.clear()
            
        except Exception as e:
            logger.error(f"Interaction flush error: {e}")
    
    def train_models(self, force: bool = False) -> None:
        """Train recommendation models"""
        # Check if training is needed
        if not force and self.redis:
            last_training = self.redis.get('ml_models:last_training')
            if last_training:
                last_training_time = datetime.fromisoformat(last_training.decode())
                if datetime.utcnow() - last_training_time < timedelta(hours=self.config.update_frequency_hours):
                    logger.info("Model training not needed yet")
                    return
        
        logger.info("Starting model training...")
        
        # Collect training data
        interactions = self._get_training_interactions()
        items = self._get_training_items()
        
        if len(interactions) < self.config.min_interactions:
            logger.warning(f"Insufficient interactions for training: {len(interactions)}")
            return
        
        # Train models
        self.hybrid_recommender.train(interactions, items)
        
        # Save models
        self._save_models()
        
        # Update training timestamp
        if self.redis:
            self.redis.set('ml_models:last_training', datetime.utcnow().isoformat())
        
        logger.info("Model training completed")
    
    def _get_training_interactions(self) -> List[UserInteraction]:
        """Get training interactions from storage"""
        interactions = []
        
        if self.redis:
            try:
                # Get all user interaction keys
                keys = self.redis.keys('interactions:*')
                
                for key in keys:
                    interaction_data = self.redis.lrange(key, 0, -1)
                    for data in interaction_data:
                        try:
                            interaction_dict = json.loads(data)
                            interactions.append(UserInteraction(
                                user_id=interaction_dict['user_id'],
                                item_id=interaction_dict['item_id'],
                                item_type=interaction_dict['item_type'],
                                interaction_type=interaction_dict['interaction_type'],
                                rating=interaction_dict.get('rating'),
                                timestamp=datetime.fromisoformat(interaction_dict['timestamp']),
                                session_id=interaction_dict.get('session_id'),
                                context=interaction_dict.get('context', {})
                            ))
                        except (json.JSONDecodeError, KeyError):
                            continue
                            
            except Exception as e:
                logger.error(f"Training data collection error: {e}")
        
        return interactions
    
    def _get_training_items(self) -> List[Dict[str, Any]]:
        """Get training items from database"""
        # This would typically query the database for items
        # For now, return empty list
        return []
    
    def get_recommendations(self, 
                         user_id: str, 
                         user_profile: Optional[Dict[str, Any]] = None,
                         context: Optional[Dict[str, Any]] = None,
                         recommendation_type: RecommendationType = RecommendationType.HYBRID,
                         n: int = 10) -> List[Recommendation]:
        """Get recommendations for user"""
        
        # Check if models are trained
        if not self.hybrid_recommender.collaborative.user_item_matrix is None:
            logger.warning("Models not trained, returning empty recommendations")
            return []
        
        # Get recommendations based on type
        if recommendation_type == RecommendationType.HYBRID:
            return self.hybrid_recommender.recommend(user_id, user_profile, context, n)
        elif recommendation_type == RecommendationType.CONTENT_BASED:
            if user_profile:
                return self.hybrid_recommender.content_based.recommend_for_user_profile(user_profile, n)
        elif recommendation_type == RecommendationType.COLLABORATIVE:
            # Get collaborative filtering recommendations
            all_items = self.hybrid_recommender.content_based.item_ids or []
            scores = self.hybrid_recommender.collaborative.predict(user_id, all_items)
            
            recommendations = []
            for item_id, score in zip(all_items, scores):
                if score > self.config.similarity_threshold:
                    item_metadata = self.hybrid_recommender.content_based.item_metadata.get(item_id, {})
                    recommendations.append(Recommendation(
                        item_id=item_id,
                        item_type=item_metadata.get('type', 'product'),
                        title=item_metadata.get('name', ''),
                        score=score,
                        reason='Collaborative filtering',
                        metadata=item_metadata,
                        confidence=min(score, 1.0)
                    ))
            
            recommendations.sort(key=lambda x: x.score, reverse=True)
            return recommendations[:n]
        
        return []
    
    def get_similar_items(self, item_id: str, n: int = 10) -> List[Recommendation]:
        """Get similar items"""
        if not self.hybrid_recommender.content_based.item_features is not None:
            similar_items = self.hybrid_recommender.content_based.get_similar_items(item_id, n)
            
            recommendations = []
            for similar_item_id, similarity in similar_items:
                item_metadata = self.hybrid_recommender.content_based.item_metadata.get(similar_item_id, {})
                recommendations.append(Recommendation(
                    item_id=similar_item_id,
                    item_type=item_metadata.get('type', 'product'),
                    title=item_metadata.get('name', ''),
                    score=similarity,
                    reason='Similar items',
                    metadata=item_metadata,
                    confidence=min(similarity, 1.0)
                ))
            
            return recommendations
        
        return []
    
    def get_user_insights(self, user_id: str) -> Dict[str, Any]:
        """Get user insights and analytics"""
        insights = {
            'user_id': user_id,
            'total_interactions': 0,
            'interaction_types': {},
            'favorite_categories': [],
            'interaction_frequency': 0,
            'last_interaction': None
        }
        
        if self.redis:
            try:
                # Get user interactions
                key = f"interactions:{user_id}"
                interaction_data = self.redis.lrange(key, 0, -1)
                
                insights['total_interactions'] = len(interaction_data)
                
                # Analyze interaction types
                type_counts = {}
                categories = []
                last_timestamp = None
                
                for data in interaction_data:
                    try:
                        interaction_dict = json.loads(data)
                        interaction_type = interaction_dict.get('interaction_type', 'unknown')
                        type_counts[interaction_type] = type_counts.get(interaction_type, 0) + 1
                        
                        # Extract categories from context
                        context = interaction_dict.get('context', {})
                        if 'category' in context:
                            categories.append(context['category'])
                        
                        # Track last interaction
                        timestamp = datetime.fromisoformat(interaction_dict['timestamp'])
                        if last_timestamp is None or timestamp > last_timestamp:
                            last_timestamp = timestamp
                            
                    except (json.JSONDecodeError, KeyError):
                        continue
                
                insights['interaction_types'] = type_counts
                insights['favorite_categories'] = list(set(categories))[:5]
                insights['last_interaction'] = last_timestamp.isoformat() if last_timestamp else None
                
                # Calculate interaction frequency
                if interaction_data:
                    first_timestamp = datetime.fromisoformat(json.loads(interaction_data[-1])['timestamp'])
                    days_active = (datetime.utcnow() - first_timestamp).days
                    insights['interaction_frequency'] = len(interaction_data) / max(days_active, 1)
                
            except Exception as e:
                logger.error(f"User insights error: {e}")
        
        return insights


# Global recommendation engine instance
recommendation_engine = RecommendationEngine()

# Export functions
def add_user_interaction(user_id: str, item_id: str, item_type: str, interaction_type: str, 
                      rating: Optional[float] = None, session_id: Optional[str] = None,
                      context: Optional[Dict[str, Any]] = None) -> None:
    """Add user interaction"""
    interaction = UserInteraction(
        user_id=user_id,
        item_id=item_id,
        item_type=item_type,
        interaction_type=interaction_type,
        rating=rating,
        timestamp=datetime.utcnow(),
        session_id=session_id,
        context=context or {}
    )
    recommendation_engine.add_interaction(interaction)

def get_recommendations(user_id: str, user_profile: Optional[Dict[str, Any]] = None,
                      context: Optional[Dict[str, Any]] = None,
                      recommendation_type: RecommendationType = RecommendationType.HYBRID,
                      n: int = 10) -> List[Recommendation]:
    """Get recommendations for user"""
    return recommendation_engine.get_recommendations(user_id, user_profile, context, recommendation_type, n)

def get_similar_items(item_id: str, n: int = 10) -> List[Recommendation]:
    """Get similar items"""
    return recommendation_engine.get_similar_items(item_id, n)

def train_recommendation_models(force: bool = False) -> None:
    """Train recommendation models"""
    recommendation_engine.train_models(force)

def get_user_insights(user_id: str) -> Dict[str, Any]:
    """Get user insights"""
    return recommendation_engine.get_user_insights(user_id)

def flush_interactions() -> None:
    """Flush interaction buffer"""
    recommendation_engine.flush_interactions()

# Export all components
__all__ = [
    'RecommendationType',
    'Recommendation',
    'UserInteraction',
    'MLModelConfig',
    'RecommendationEngine',
    'add_user_interaction',
    'get_recommendations',
    'get_similar_items',
    'train_recommendation_models',
    'get_user_insights',
    'flush_interactions',
    'recommendation_engine',
]
