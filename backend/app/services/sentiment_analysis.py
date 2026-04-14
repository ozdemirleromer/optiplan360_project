"""
Sentiment Analysis and Customer Feedback System
Advanced sentiment analysis with emotion detection, feedback processing, and customer insights
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
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from sklearn.preprocessing import LabelEncoder
import joblib
from textblob import TextBlob
import nltk
from nltk.sentiment import SentimentIntensityAnalyzer
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.stem import WordNetLemmatizer
import re

logger = logging.getLogger(__name__)


class SentimentType(Enum):
    """Sentiment types"""
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    VERY_POSITIVE = "very_positive"
    VERY_NEGATIVE = "very_negative"
    MIXED = "mixed"


class EmotionType(Enum):
    """Emotion types"""
    JOY = "joy"
    SADNESS = "sadness"
    ANGER = "anger"
    FEAR = "fear"
    SURPRISE = "surprise"
    DISGUST = "disgust"
    TRUST = "trust"
    ANTICIPATION = "anticipation"


class FeedbackType(Enum):
    """Feedback types"""
    PRODUCT_REVIEW = "product_review"
    SERVICE_REVIEW = "service_review"
    CUSTOMER_SUPPORT = "customer_support"
    GENERAL_FEEDBACK = "general_feedback"
    COMPLAINT = "complaint"
    SUGGESTION = "suggestion"
    RATING = "rating"


@dataclass
class SentimentResult:
    """Sentiment analysis result"""
    feedback_id: str
    text: str
    sentiment: SentimentType
    confidence: float
    emotions: Dict[str, float]
    keywords: List[str]
    aspects: Dict[str, str]
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class FeedbackAnalysis:
    """Feedback analysis result"""
    feedback_id: str
    feedback_type: FeedbackType
    customer_id: Optional[str]
    rating: Optional[float]
    sentiment_result: SentimentResult
    priority: str
    action_required: bool
    insights: List[str]
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class SentimentModelConfig:
    """Sentiment model configuration"""
    model_type: str = "ensemble"
    feature_extraction: str = "tfidf"
    min_training_samples: int = 100
    cross_validation_folds: int = 5
    test_size: float = 0.2
    random_state: int = 42
    retrain_frequency_hours: int = 24
    emotion_detection: bool = True
    aspect_based_sentiment: bool = True


class SentimentAnalyzer:
    """Sentiment analysis service"""
    
    def __init__(self, config: SentimentModelConfig):
        self.config = config
        self.vader_analyzer = SentimentIntensityAnalyzer()
        self.lemmatizer = WordNetLemmatizer()
        self.stop_words = set(stopwords.words('english'))
        self.models = {}
        
        # Emotion keywords
        self.emotion_keywords = {
            EmotionType.JOY: ['happy', 'joyful', 'excited', 'delighted', 'pleased', 'satisfied', 'content', 'glad'],
            EmotionType.SADNESS: ['sad', 'unhappy', 'disappointed', 'depressed', 'miserable', 'gloomy', 'down'],
            EmotionType.ANGER: ['angry', 'furious', 'mad', 'irritated', 'annoyed', 'frustrated', 'outraged'],
            EmotionType.FEAR: ['afraid', 'scared', 'frightened', 'terrified', 'anxious', 'worried', 'nervous'],
            EmotionType.SURPRISE: ['surprised', 'amazed', 'astonished', 'shocked', 'unexpected', 'sudden'],
            EmotionType.DISGUST: ['disgusted', 'revolted', 'repulsed', 'sick', 'nauseated', 'appalled'],
            EmotionType.TRUST: ['trust', 'reliable', 'dependable', 'confident', 'secure', 'safe', 'assured'],
            EmotionType.ANTICIPATION: ['excited', 'eager', 'looking forward', 'anticipating', 'expecting', 'hoping']
        }
        
    def preprocess_text(self, text: str) -> List[str]:
        """Preprocess text for analysis"""
        # Convert to lowercase
        text = text.lower()
        
        # Remove special characters and numbers
        text = re.sub(r'[^a-zA-Z\s]', '', text)
        
        # Tokenize
        tokens = word_tokenize(text)
        
        # Remove stop words and lemmatize
        filtered_tokens = []
        for token in tokens:
            if token not in self.stop_words and len(token) > 2:
                lemmatized = self.lemmatizer.lemmatize(token)
                filtered_tokens.append(lemmatized)
        
        return filtered_tokens
    
    def analyze_sentiment_vader(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment using VADER"""
        scores = self.vader_analyzer.polarity_scores(text)
        
        compound_score = scores['compound']
        
        # Determine sentiment
        if compound_score >= 0.05:
            if compound_score >= 0.5:
                sentiment = SentimentType.VERY_POSITIVE
            else:
                sentiment = SentimentType.POSITIVE
        elif compound_score <= -0.05:
            if compound_score <= -0.5:
                sentiment = SentimentType.VERY_NEGATIVE
            else:
                sentiment = SentimentType.NEGATIVE
        else:
            sentiment = SentimentType.NEUTRAL
        
        return {
            'sentiment': sentiment.value,
            'compound_score': compound_score,
            'positive_score': scores['pos'],
            'negative_score': scores['neg'],
            'neutral_score': scores['neu'],
            'confidence': abs(compound_score)
        }
    
    def analyze_sentiment_textblob(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment using TextBlob"""
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity
        subjectivity = blob.sentiment.subjectivity
        
        # Determine sentiment
        if polarity > 0.1:
            if polarity > 0.5:
                sentiment = SentimentType.VERY_POSITIVE
            else:
                sentiment = SentimentType.POSITIVE
        elif polarity < -0.1:
            if polarity < -0.5:
                sentiment = SentimentType.VERY_NEGATIVE
            else:
                sentiment = SentimentType.NEGATIVE
        else:
            sentiment = SentimentType.NEUTRAL
        
        return {
            'sentiment': sentiment.value,
            'polarity': polarity,
            'subjectivity': subjectivity,
            'confidence': abs(polarity)
        }
    
    def detect_emotions(self, text: str) -> Dict[str, float]:
        """Detect emotions in text"""
        tokens = self.preprocess_text(text)
        emotions = {emotion.value: 0.0 for emotion in EmotionType}
        
        # Count emotion keywords
        for token in tokens:
            for emotion, keywords in self.emotion_keywords.items():
                if token in keywords:
                    emotions[emotion.value] += 1.0
        
        # Normalize scores
        total_emotions = sum(emotions.values())
        if total_emotions > 0:
            for emotion in emotions:
                emotions[emotion] = emotions[emotion] / total_emotions
        
        return emotions
    
    def extract_aspects(self, text: str) -> Dict[str, str]:
        """Extract aspects and their sentiments"""
        # Simple aspect extraction based on keywords
        aspects = {
            'product': [],
            'service': [],
            'price': [],
            'quality': [],
            'delivery': [],
            'support': []
        }
        
        aspect_keywords = {
            'product': ['product', 'item', 'goods', 'merchandise'],
            'service': ['service', 'help', 'assistance', 'support'],
            'price': ['price', 'cost', 'expensive', 'cheap', 'affordable'],
            'quality': ['quality', 'durability', 'reliability', 'performance'],
            'delivery': ['delivery', 'shipping', 'arrival', 'packaging'],
            'support': ['support', 'customer service', 'help desk', 'assistance']
        }
        
        sentences = sent_tokenize(text)
        
        for sentence in sentences:
            sentence_lower = sentence.lower()
            for aspect, keywords in aspect_keywords.items():
                if any(keyword in sentence_lower for keyword in keywords):
                    aspects[aspect].append(sentence)
        
        # Analyze sentiment for each aspect
        aspect_sentiments = {}
        for aspect, sentences in aspects.items():
            if sentences:
                aspect_text = ' '.join(sentences)
                vader_result = self.analyze_sentiment_vader(aspect_text)
                aspect_sentiments[aspect] = vader_result['sentiment']
        
        return aspect_sentiments
    
    def train_sentiment_model(self, training_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Train custom sentiment model"""
        logger.info("Training sentiment analysis model...")
        
        # Prepare data
        texts = [item['text'] for item in training_data]
        labels = [item['sentiment'] for item in training_data]
        
        if len(texts) < self.config.min_training_samples:
            return {'error': 'Insufficient training data'}
        
        # Extract features
        vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            stop_words='english'
        )
        X = vectorizer.fit_transform(texts)
        
        # Encode labels
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(labels)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=self.config.test_size, random_state=self.config.random_state
        )
        
        # Train ensemble model
        models = [
            ('rf', RandomForestClassifier(n_estimators=100, random_state=self.config.random_state)),
            ('gb', GradientBoostingClassifier(n_estimators=100, random_state=self.config.random_state)),
            ('lr', LogisticRegression(random_state=self.config.random_state, max_iter=1000)),
            ('nb', MultinomialNB())
        ]
        
        # Train each model and select best
        best_model = None
        best_score = 0
        best_model_name = ""
        
        for name, model in models:
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            score = accuracy_score(y_test, y_pred)
            
            if score > best_score:
                best_score = score
                best_model = model
                best_model_name = name
        
        # Cross validation
        cv_scores = cross_val_score(best_model, X_train, y_train, cv=self.config.cross_validation_folds)
        
        return {
            'model': best_model,
            'vectorizer': vectorizer,
            'label_encoder': label_encoder,
            'model_name': best_model_name,
            'accuracy': best_score,
            'cv_score': cv_scores.mean(),
            'trained_at': datetime.utcnow()
        }


class FeedbackProcessor:
    """Feedback processing and analysis service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.sentiment_analyzer = SentimentAnalyzer(SentimentModelConfig())
        self.feedback_buffer = []
        
    def process_feedback(self, feedback_data: Dict[str, Any]) -> FeedbackAnalysis:
        """Process customer feedback"""
        start_time = datetime.utcnow()
        
        # Extract text
        text = feedback_data.get('text', '')
        
        # Analyze sentiment
        vader_result = self.sentiment_analyzer.analyze_sentiment_vader(text)
        textblob_result = self.sentiment_analyzer.analyze_sentiment_textblob(text)
        
        # Detect emotions
        emotions = self.sentiment_analyzer.detect_emotions(text) if self.sentiment_analyzer.config.emotion_detection else {}
        
        # Extract aspects
        aspects = self.sentiment_analyzer.extract_aspects(text) if self.sentiment_analyzer.config.aspect_based_sentiment else {}
        
        # Determine sentiment (ensemble approach)
        if vader_result['sentiment'] == textblob_result['sentiment']:
            final_sentiment = vader_result['sentiment']
            final_confidence = (vader_result['confidence'] + textblob_result['confidence']) / 2
        else:
            # Use higher confidence
            if vader_result['confidence'] > textblob_result['confidence']:
                final_sentiment = vader_result['sentiment']
                final_confidence = vader_result['confidence']
            else:
                final_sentiment = textblob_result['sentiment']
                final_confidence = textblob_result['confidence']
        
        # Create sentiment result
        sentiment_result = SentimentResult(
            feedback_id=feedback_data.get('id', ''),
            text=text,
            sentiment=SentimentType(final_sentiment),
            confidence=final_confidence,
            emotions=emotions,
            keywords=self.sentiment_analyzer.preprocess_text(text),
            aspects=aspects,
            metadata={
                'vader_scores': vader_result,
                'textblob_scores': textblob_result
            }
        )
        
        # Determine priority and action required
        priority = self._determine_priority(sentiment_result, feedback_data)
        action_required = self._requires_action(sentiment_result, feedback_data)
        
        # Generate insights
        insights = self._generate_insights(sentiment_result, feedback_data)
        
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return FeedbackAnalysis(
            feedback_id=feedback_data.get('id', ''),
            feedback_type=FeedbackType(feedback_data.get('type', 'general_feedback')),
            customer_id=feedback_data.get('customer_id'),
            rating=feedback_data.get('rating'),
            sentiment_result=sentiment_result,
            priority=priority,
            action_required=action_required,
            insights=insights,
            created_at=datetime.utcnow()
        )
    
    def _determine_priority(self, sentiment_result: SentimentResult, feedback_data: Dict[str, Any]) -> str:
        """Determine feedback priority"""
        sentiment = sentiment_result.sentiment
        confidence = sentiment_result.confidence
        rating = feedback_data.get('rating')
        
        # High priority for very negative sentiment
        if sentiment in [SentimentType.VERY_NEGATIVE, SentimentType.NEGATIVE] and confidence > 0.7:
            return 'high'
        
        # High priority for low ratings
        if rating and rating <= 2.0:
            return 'high'
        
        # Medium priority for negative sentiment
        if sentiment == SentimentType.NEGATIVE:
            return 'medium'
        
        # Low priority for positive sentiment
        if sentiment in [SentimentType.POSITIVE, SentimentType.VERY_POSITIVE]:
            return 'low'
        
        return 'normal'
    
    def _requires_action(self, sentiment_result: SentimentResult, feedback_data: Dict[str, Any]) -> bool:
        """Determine if action is required"""
        sentiment = sentiment_result.sentiment
        confidence = sentiment_result.confidence
        feedback_type = feedback_data.get('type', '')
        
        # Action required for very negative sentiment
        if sentiment in [SentimentType.VERY_NEGATIVE, SentimentType.NEGATIVE] and confidence > 0.8:
            return True
        
        # Action required for complaints
        if feedback_type == 'complaint':
            return True
        
        # Action required for customer support issues
        if feedback_type == 'customer_support' and sentiment == SentimentType.NEGATIVE:
            return True
        
        return False
    
    def _generate_insights(self, sentiment_result: SentimentResult, feedback_data: Dict[str, Any]) -> List[str]:
        """Generate insights from feedback"""
        insights = []
        
        sentiment = sentiment_result.sentiment
        emotions = sentiment_result.emotions
        aspects = sentiment_result.aspects
        
        # Sentiment-based insights
        if sentiment == SentimentType.VERY_NEGATIVE:
            insights.append("Customer is extremely dissatisfied - immediate attention required")
        elif sentiment == SentimentType.NEGATIVE:
            insights.append("Customer is dissatisfied - follow-up recommended")
        elif sentiment == SentimentType.VERY_POSITIVE:
            insights.append("Customer is very satisfied - potential for positive review")
        
        # Emotion-based insights
        if emotions:
            dominant_emotion = max(emotions, key=emotions.get)
            if dominant_emotion == EmotionType.ANGER.value:
                insights.append("Customer shows signs of anger - de-escalation needed")
            elif dominant_emotion == EmotionType.FEAR.value:
                insights.append("Customer appears concerned - reassurance needed")
            elif dominant_emotion == EmotionType.JOY.value:
                insights.append("Customer appears happy - good opportunity for upselling")
        
        # Aspect-based insights
        if aspects:
            negative_aspects = [aspect for aspect, sent in aspects.items() 
                            if sent in ['negative', 'very_negative']]
            if negative_aspects:
                insights.append(f"Issues identified with: {', '.join(negative_aspects)}")
        
        # Rating-based insights
        rating = feedback_data.get('rating')
        if rating:
            if rating <= 2.0:
                insights.append("Very low rating indicates serious issues")
            elif rating >= 4.5:
                insights.append("High rating indicates excellent service")
        
        return insights
    
    def batch_process_feedback(self, feedback_list: List[Dict[str, Any]]) -> List[FeedbackAnalysis]:
        """Process multiple feedback items"""
        results = []
        
        for feedback in feedback_list:
            try:
                result = self.process_feedback(feedback)
                results.append(result)
            except Exception as e:
                logger.error(f"Feedback processing error: {e}")
                results.append(None)
        
        return results
    
    def get_sentiment_summary(self, customer_id: str, days_back: int = 30) -> Dict[str, Any]:
        """Get sentiment summary for customer"""
        if not self.redis:
            return {'error': 'Redis not available'}
        
        try:
            # Get customer feedback
            feedback_key = f"customer_feedback:{customer_id}"
            feedback_data = self.redis.lrange(feedback_key, 0, -1)
            
            if not feedback_data:
                return {'error': 'No feedback found'}
            
            # Parse and analyze feedback
            feedback_list = []
            cutoff_date = datetime.utcnow() - timedelta(days=days_back)
            
            for data in feedback_data:
                try:
                    feedback = json.loads(data)
                    feedback_date = datetime.fromisoformat(feedback.get('created_at', ''))
                    
                    if feedback_date > cutoff_date:
                        feedback_list.append(feedback)
                except (json.JSONDecodeError, KeyError):
                    continue
            
            if not feedback_list:
                return {'error': 'No recent feedback found'}
            
            # Calculate sentiment distribution
            sentiment_counts = {}
            total_confidence = 0
            emotions_total = {}
            
            for feedback in feedback_list:
                sentiment = feedback.get('sentiment_result', {}).get('sentiment', 'neutral')
                confidence = feedback.get('sentiment_result', {}).get('confidence', 0)
                emotions = feedback.get('sentiment_result', {}).get('emotions', {})
                
                sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1
                total_confidence += confidence
                
                for emotion, score in emotions.items():
                    emotions_total[emotion] = emotions_total.get(emotion, 0) + score
            
            # Calculate averages
            total_feedback = len(feedback_list)
            avg_confidence = total_confidence / total_feedback if total_feedback > 0 else 0
            
            # Normalize emotions
            if emotions_total:
                total_emotion_score = sum(emotions_total.values())
                emotions_avg = {emotion: score / total_emotion_score 
                               for emotion, score in emotions_total.items()}
            else:
                emotions_avg = {}
            
            return {
                'customer_id': customer_id,
                'period_days': days_back,
                'total_feedback': total_feedback,
                'sentiment_distribution': sentiment_counts,
                'average_confidence': avg_confidence,
                'emotion_distribution': emotions_avg,
                'feedback_list': feedback_list,
                'generated_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Sentiment summary error: {e}")
            return {'error': str(e)}


class CustomerInsightsService:
    """Customer insights and analytics service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.feedback_processor = FeedbackProcessor(redis_client)
        
    def generate_customer_profile(self, customer_id: str) -> Dict[str, Any]:
        """Generate comprehensive customer profile"""
        # Get sentiment summary
        sentiment_summary = self.feedback_processor.get_sentiment_summary(customer_id)
        
        if 'error' in sentiment_summary:
            return sentiment_summary
        
        # Calculate customer metrics
        total_feedback = sentiment_summary['total_feedback']
        sentiment_dist = sentiment_summary['sentiment_distribution']
        
        positive_count = sentiment_dist.get('positive', 0) + sentiment_dist.get('very_positive', 0)
        negative_count = sentiment_dist.get('negative', 0) + sentiment_dist.get('very_negative', 0)
        neutral_count = sentiment_dist.get('neutral', 0)
        
        # Calculate satisfaction score
        if total_feedback > 0:
            satisfaction_score = (positive_count * 2 + neutral_count) / (total_feedback * 2)
        else:
            satisfaction_score = 0.5  # Neutral default
        
        # Determine customer segment
        if satisfaction_score >= 0.8:
            segment = 'champion'
        elif satisfaction_score >= 0.6:
            segment = 'satisfied'
        elif satisfaction_score >= 0.4:
            segment = 'neutral'
        elif satisfaction_score >= 0.2:
            segment = 'at_risk'
        else:
            segment = 'critical'
        
        # Generate recommendations
        recommendations = []
        if segment == 'critical':
            recommendations.append("Immediate intervention required")
            recommendations.append("Personal outreach recommended")
        elif segment == 'at_risk':
            recommendations.append("Proactive support recommended")
            recommendations.append("Service recovery plan needed")
        elif segment == 'champion':
            recommendations.append("Loyalty program opportunity")
            recommendations.append("Referral program candidate")
        
        return {
            'customer_id': customer_id,
            'satisfaction_score': satisfaction_score,
            'customer_segment': segment,
            'total_feedback': total_feedback,
            'sentiment_distribution': sentiment_dist,
            'emotion_distribution': sentiment_summary['emotion_distribution'],
            'recommendations': recommendations,
            'generated_at': datetime.utcnow().isoformat()
        }
    
    def get_trending_topics(self, days_back: int = 7) -> Dict[str, Any]:
        """Get trending topics from feedback"""
        if not self.redis:
            return {'error': 'Redis not available'}
        
        try:
            # Get recent feedback
            cutoff_date = datetime.utcnow() - timedelta(days=days_back)
            
            # This would typically query database for recent feedback
            # For now, return empty results
            return {
                'period_days': days_back,
                'trending_topics': [],
                'sentiment_trends': {},
                'generated_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Trending topics error: {e}")
            return {'error': str(e)}


# Global services
sentiment_analyzer = SentimentAnalyzer(SentimentModelConfig())
feedback_processor = FeedbackProcessor()
customer_insights = CustomerInsightsService()

# Export functions
def analyze_sentiment(text: str, method: str = 'ensemble') -> Dict[str, Any]:
    """Analyze sentiment of text"""
    if method == 'vader':
        return sentiment_analyzer.analyze_sentiment_vader(text)
    elif method == 'textblob':
        return sentiment_analyzer.analyze_sentiment_textblob(text)
    else:
        # Ensemble approach
        vader_result = sentiment_analyzer.analyze_sentiment_vader(text)
        textblob_result = sentiment_analyzer.analyze_sentiment_textblob(text)
        
        if vader_result['sentiment'] == textblob_result['sentiment']:
            return vader_result
        else:
            # Use higher confidence
            return vader_result if vader_result['confidence'] > textblob_result['confidence'] else textblob_result

def process_feedback(feedback_data: Dict[str, Any]) -> FeedbackAnalysis:
    """Process customer feedback"""
    return feedback_processor.process_feedback(feedback_data)

def batch_process_feedback(feedback_list: List[Dict[str, Any]]) -> List[FeedbackAnalysis]:
    """Process multiple feedback items"""
    return feedback_processor.batch_process_feedback(feedback_list)

def get_customer_sentiment_summary(customer_id: str, days_back: int = 30) -> Dict[str, Any]:
    """Get sentiment summary for customer"""
    return feedback_processor.get_sentiment_summary(customer_id, days_back)

def generate_customer_profile(customer_id: str) -> Dict[str, Any]:
    """Generate comprehensive customer profile"""
    return customer_insights.generate_customer_profile(customer_id)

def get_trending_topics(days_back: int = 7) -> Dict[str, Any]:
    """Get trending topics from feedback"""
    return customer_insights.get_trending_topics(days_back)

# Export all components
__all__ = [
    'SentimentType',
    'EmotionType',
    'FeedbackType',
    'SentimentResult',
    'FeedbackAnalysis',
    'SentimentModelConfig',
    'SentimentAnalyzer',
    'FeedbackProcessor',
    'CustomerInsightsService',
    'analyze_sentiment',
    'process_feedback',
    'batch_process_feedback',
    'get_customer_sentiment_summary',
    'generate_customer_profile',
    'get_trending_topics',
    'sentiment_analyzer',
    'feedback_processor',
    'customer_insights',
]
