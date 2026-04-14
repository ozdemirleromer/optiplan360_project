"""
Natural Language Processing (NLP) Integration
Advanced NLP services for text analysis, sentiment analysis, and language understanding
"""

import logging
import re
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple, Union
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import redis
import pickle
import json
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from sklearn.preprocessing import LabelEncoder
import joblib
import nltk
from nltk.sentiment import SentimentIntensityAnalyzer
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from textblob import TextBlob
import spacy

logger = logging.getLogger(__name__)


class NLPTaskType(Enum):
    """NLP task types"""
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    TEXT_CLASSIFICATION = "text_classification"
    ENTITY_EXTRACTION = "entity_extraction"
    TOPIC_MODELING = "topic_modeling"
    LANGUAGE_DETECTION = "language_detection"
    KEYWORD_EXTRACTION = "keyword_extraction"
    TEXT_SUMMARIZATION = "text_summarization"
    SIMILARITY_MATCHING = "similarity_matching"


class SentimentClass(Enum):
    """Sentiment classes"""
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    VERY_POSITIVE = "very_positive"
    VERY_NEGATIVE = "very_negative"


@dataclass
class NLPResult:
    """NLP processing result"""
    task_id: str
    task_type: NLPTaskType
    input_text: str
    result: Any
    confidence: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    processing_time_ms: float = 0.0
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Entity:
    """Named entity"""
    text: str
    label: str
    start_pos: int
    end_pos: int
    confidence: float


@dataclass
class Topic:
    """Topic modeling result"""
    topic_id: int
    words: List[str]
    weight: float
    coherence_score: float


class TextPreprocessor:
    """Text preprocessing utilities"""
    
    def __init__(self):
        self.lemmatizer = WordNetLemmatizer()
        self.stop_words = set(stopwords.words('english'))
        self.turkish_stop_words = self._get_turkish_stopwords()
        
    def _get_turkish_stopwords(self) -> set:
        """Get Turkish stop words"""
        turkish_stops = {
            've', 'ile', 'ama', 'için', 'bu', 'şu', 'o', 'bir', 'daha', 'en', 'gibi',
            'kadar', 'olarak', 'veya', 'veya', 'veya', 'veya', 'ile', 'ile', 'ile',
            'çok', 'az', 'tüm', 'her', 'hiçbir', 'bazı', 'diğer', 'belki',
            'ancak', 'fakat', 'lakin', 'madem', 'çünkü', 'zaten', 'hala',
            'henüz', 'artık', 'gelecekte', 'geçmişte', 'şimdiye', 'daha',
            'en', 'iyi', 'kötü', 'güzel', 'çirkin', 'büyük', 'küçük', 'uzun',
            'kısa', 'yeni', 'eski', 'ilk', 'son', 'başka', 'farklı'
        }
        return turkish_stops
    
    def clean_text(self, text: str, language: str = 'english') -> str:
        """Clean and normalize text"""
        # Convert to lowercase
        text = text.lower()
        
        # Remove URLs
        text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
        
        # Remove email addresses
        text = re.sub(r'\S+@\S+', '', text)
        
        # Remove numbers
        text = re.sub(r'\d+', '', text)
        
        # Remove special characters and extra whitespace
        text = re.sub(r'[^\w\s]', '', text)
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    def tokenize(self, text: str, language: str = 'english') -> List[str]:
        """Tokenize text"""
        if language == 'turkish':
            # Simple tokenization for Turkish
            tokens = text.split()
        else:
            tokens = word_tokenize(text)
        
        # Remove stop words and lemmatize
        stop_words = self.turkish_stop_words if language == 'turkish' else self.stop_words
        
        filtered_tokens = []
        for token in tokens:
            if token not in stop_words and len(token) > 2:
                try:
                    lemmatized = self.lemmatizer.lemmatize(token)
                    filtered_tokens.append(lemmatized)
                except:
                    filtered_tokens.append(token)
        
        return filtered_tokens


class SentimentAnalyzer:
    """Sentiment analysis service"""
    
    def __init__(self):
        self.preprocessor = TextPreprocessor()
        self.vader_analyzer = SentimentIntensityAnalyzer()
        self.models = {}
        
    def analyze_sentiment_vader(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment using VADER"""
        # Clean text
        cleaned_text = self.preprocessor.clean_text(text)
        
        # Get VADER scores
        scores = self.vader_analyzer.polarity_scores(cleaned_text)
        
        # Determine sentiment class
        compound_score = scores['compound']
        
        if compound_score >= 0.05:
            sentiment = SentimentClass.POSITIVE
        elif compound_score <= -0.05:
            sentiment = SentimentClass.NEGATIVE
        else:
            sentiment = SentimentClass.NEUTRAL
        
        # Add very positive/negative
        if compound_score >= 0.5:
            sentiment = SentimentClass.VERY_POSITIVE
        elif compound_score <= -0.5:
            sentiment = SentimentClass.VERY_NEGATIVE
        
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
        try:
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity
            subjectivity = blob.sentiment.subjectivity
            
            # Determine sentiment class
            if polarity > 0.1:
                sentiment = SentimentClass.POSITIVE
            elif polarity < -0.1:
                sentiment = SentimentClass.NEGATIVE
            else:
                sentiment = SentimentClass.NEUTRAL
            
            # Add very positive/negative
            if polarity >= 0.5:
                sentiment = SentimentClass.VERY_POSITIVE
            elif polarity <= -0.5:
                sentiment = SentimentClass.VERY_NEGATIVE
            
            return {
                'sentiment': sentiment.value,
                'polarity': polarity,
                'subjectivity': subjectivity,
                'confidence': abs(polarity)
            }
        except Exception as e:
            logger.error(f"TextBlob sentiment analysis error: {e}")
            return {'sentiment': 'neutral', 'confidence': 0.0}
    
    def train_sentiment_model(self, training_data: List[Dict[str, Any]], language: str = 'english') -> Dict[str, Any]:
        """Train custom sentiment classification model"""
        logger.info("Training sentiment classification model...")
        
        # Prepare data
        texts = []
        labels = []
        
        for item in training_data:
            text = self.preprocessor.clean_text(item['text'], language)
            tokens = self.preprocessor.tokenize(text, language)
            
            if tokens:
                texts.append(' '.join(tokens))
                labels.append(item['sentiment'])
        
        if len(texts) < 10:
            return {'error': 'Insufficient training data'}
        
        # Create TF-IDF features
        vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
        X = vectorizer.fit_transform(texts)
        
        # Encode labels
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(labels)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Train model
        model = MultinomialNB()
        model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        # Store model
        model_key = f"sentiment_model_{language}"
        self.models[model_key] = {
            'model': model,
            'vectorizer': vectorizer,
            'label_encoder': label_encoder,
            'accuracy': accuracy,
            'trained_at': datetime.utcnow()
        }
        
        return {
            'model_key': model_key,
            'accuracy': accuracy,
            'trained_at': datetime.utcnow().isoformat()
        }
    
    def predict_sentiment(self, text: str, model_key: str = None) -> Dict[str, Any]:
        """Predict sentiment using trained model"""
        if model_key and model_key in self.models:
            model_data = self.models[model_key]
            
            try:
                # Preprocess text
                cleaned_text = self.preprocessor.clean_text(text)
                tokens = self.preprocessor.tokenize(cleaned_text)
                
                if not tokens:
                    return {'sentiment': 'neutral', 'confidence': 0.0}
                
                # Vectorize
                text_vector = model_data['vectorizer'].transform([' '.join(tokens)])
                
                # Predict
                prediction = model_data['model'].predict(text_vector)[0]
                sentiment_label = model_data['label_encoder'].inverse_transform([prediction])[0]
                
                # Get probability
                probabilities = model_data['model'].predict_proba(text_vector)[0]
                confidence = max(probabilities)
                
                return {
                    'sentiment': sentiment_label,
                    'confidence': float(confidence),
                    'probabilities': dict(zip(model_data['label_encoder'].classes_, probabilities.tolist()))
                }
                
            except Exception as e:
                logger.error(f"Sentiment prediction error: {e}")
                return {'sentiment': 'neutral', 'confidence': 0.0}
        
        # Fallback to VADER
        return self.analyze_sentiment_vader(text)


class EntityExtractor:
    """Named entity extraction service"""
    
    def __init__(self):
        self.preprocessor = TextPreprocessor()
        try:
            self.nlp = spacy.load('en_core_web_sm')
        except OSError:
            logger.warning("Spacy English model not found, using basic extraction")
            self.nlp = None
    
    def extract_entities_spacy(self, text: str) -> List[Entity]:
        """Extract entities using spaCy"""
        if not self.nlp:
            return []
        
        doc = self.nlp(text)
        entities = []
        
        for ent in doc.ents:
            entity = Entity(
                text=ent.text,
                label=ent.label_,
                start_pos=ent.start_char,
                end_pos=ent.end_char,
                confidence=1.0  # spaCy doesn't provide confidence scores
            )
            entities.append(entity)
        
        return entities
    
    def extract_entities_pattern(self, text: str) -> List[Entity]:
        """Extract entities using regex patterns"""
        entities = []
        
        # Email addresses
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        for match in re.finditer(email_pattern, text):
            entity = Entity(
                text=match.group(),
                label='EMAIL',
                start_pos=match.start(),
                end_pos=match.end(),
                confidence=1.0
            )
            entities.append(entity)
        
        # Phone numbers
        phone_pattern = r'\b(?:\+?(\d{1,3})?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'
        for match in re.finditer(phone_pattern, text):
            entity = Entity(
                text=match.group(),
                label='PHONE',
                start_pos=match.start(),
                end_pos=match.end(),
                confidence=0.9
            )
            entities.append(entity)
        
        # URLs
        url_pattern = r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        for match in re.finditer(url_pattern, text):
            entity = Entity(
                text=match.group(),
                label='URL',
                start_pos=match.start(),
                end_pos=match.end(),
                confidence=0.95
            )
            entities.append(entity)
        
        # Money amounts
        money_pattern = r'\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?'
        for match in re.finditer(money_pattern, text):
            entity = Entity(
                text=match.group(),
                label='MONEY',
                start_pos=match.start(),
                end_pos=match.end(),
                confidence=0.8
            )
            entities.append(entity)
        
        return entities
    
    def extract_entities(self, text: str) -> List[Entity]:
        """Extract entities using available methods"""
        entities = []
        
        # Try spaCy first
        if self.nlp:
            spacy_entities = self.extract_entities_spacy(text)
            entities.extend(spacy_entities)
        
        # Add pattern-based entities
        pattern_entities = self.extract_entities_pattern(text)
        entities.extend(pattern_entities)
        
        # Remove duplicates
        seen = set()
        unique_entities = []
        for entity in entities:
            key = (entity.text, entity.start_pos, entity.end_pos)
            if key not in seen:
                seen.add(key)
                unique_entities.append(entity)
        
        return unique_entities


class TextClassifier:
    """Text classification service"""
    
    def __init__(self):
        self.preprocessor = TextPreprocessor()
        self.models = {}
        
    def train_classifier(self, training_data: List[Dict[str, Any]], language: str = 'english') -> Dict[str, Any]:
        """Train text classification model"""
        logger.info("Training text classification model...")
        
        # Prepare data
        texts = []
        labels = []
        
        for item in training_data:
            text = self.preprocessor.clean_text(item['text'], language)
            tokens = self.preprocessor.tokenize(text, language)
            
            if tokens:
                texts.append(' '.join(tokens))
                labels.append(item['category'])
        
        if len(texts) < 10:
            return {'error': 'Insufficient training data'}
        
        # Create TF-IDF features
        vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
        X = vectorizer.fit_transform(texts)
        
        # Encode labels
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(labels)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Train model
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        # Store model
        model_key = f"classification_model_{language}"
        self.models[model_key] = {
            'model': model,
            'vectorizer': vectorizer,
            'label_encoder': label_encoder,
            'accuracy': accuracy,
            'trained_at': datetime.utcnow(),
            'categories': label_encoder.classes_.tolist()
        }
        
        return {
            'model_key': model_key,
            'accuracy': accuracy,
            'categories': label_encoder.classes_.tolist(),
            'trained_at': datetime.utcnow().isoformat()
        }
    
    def classify_text(self, text: str, model_key: str = None) -> Dict[str, Any]:
        """Classify text using trained model"""
        if model_key and model_key in self.models:
            model_data = self.models[model_key]
            
            try:
                # Preprocess text
                cleaned_text = self.preprocessor.clean_text(text)
                tokens = self.preprocessor.tokenize(cleaned_text)
                
                if not tokens:
                    return {'category': 'unknown', 'confidence': 0.0}
                
                # Vectorize
                text_vector = model_data['vectorizer'].transform([' '.join(tokens)])
                
                # Predict
                prediction = model_data['model'].predict(text_vector)[0]
                category = model_data['label_encoder'].inverse_transform([prediction])[0]
                
                # Get probability
                probabilities = model_data['model'].predict_proba(text_vector)[0]
                confidence = max(probabilities)
                
                return {
                    'category': category,
                    'confidence': float(confidence),
                    'probabilities': dict(zip(model_data['label_encoder'].classes_, probabilities.tolist()))
                }
                
            except Exception as e:
                logger.error(f"Text classification error: {e}")
                return {'category': 'unknown', 'confidence': 0.0}
        
        return {'category': 'unknown', 'confidence': 0.0}


class NLPService:
    """Main NLP service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.sentiment_analyzer = SentimentAnalyzer()
        self.entity_extractor = EntityExtractor()
        self.text_classifier = TextClassifier()
        
        # Load models if available
        self._load_models()
    
    def _load_models(self) -> None:
        """Load pre-trained NLP models"""
        try:
            if self.redis:
                models_data = self.redis.get('nlp_models:trained_models')
                if models_data:
                    models = pickle.loads(models_data)
                    self.sentiment_analyzer.models.update(models.get('sentiment', {}))
                    self.text_classifier.models.update(models.get('classification', {}))
                    logger.info("Loaded NLP models from Redis")
                    
        except Exception as e:
            logger.error(f"NLP model loading error: {e}")
    
    def _save_models(self) -> None:
        """Save trained NLP models to Redis"""
        try:
            if self.redis:
                models = {
                    'sentiment': self.sentiment_analyzer.models,
                    'classification': self.text_classifier.models
                }
                models_data = pickle.dumps(models)
                self.redis.setex('nlp_models:trained_models', 86400, models_data)
                logger.info("Saved NLP models to Redis")
                
        except Exception as e:
            logger.error(f"NLP model saving error: {e}")
    
    def analyze_sentiment(self, text: str, method: str = 'vader') -> Dict[str, Any]:
        """Analyze sentiment of text"""
        start_time = datetime.utcnow()
        
        if method == 'vader':
            result = self.sentiment_analyzer.analyze_sentiment_vader(text)
        elif method == 'textblob':
            result = self.sentiment_analyzer.analyze_sentiment_textblob(text)
        elif method == 'model':
            result = self.sentiment_analyzer.predict_sentiment(text)
        else:
            # Use ensemble approach
            vader_result = self.sentiment_analyzer.analyze_sentiment_vader(text)
            textblob_result = self.sentiment_analyzer.analyze_sentiment_textblob(text)
            
            # Combine results
            if vader_result['sentiment'] == textblob_result['sentiment']:
                result = vader_result
            else:
                # Use higher confidence
                result = vader_result if vader_result['confidence'] > textblob_result['confidence'] else textblob_result
                result['method'] = 'ensemble'
        
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return {
            'text': text,
            'method': method,
            'result': result,
            'processing_time_ms': processing_time,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def extract_entities(self, text: str) -> Dict[str, Any]:
        """Extract entities from text"""
        start_time = datetime.utcnow()
        
        entities = self.entity_extractor.extract_entities(text)
        
        # Group entities by type
        entities_by_type = {}
        for entity in entities:
            if entity.label not in entities_by_type:
                entities_by_type[entity.label] = []
            entities_by_type[entity.label].append({
                'text': entity.text,
                'start_pos': entity.start_pos,
                'end_pos': entity.end_pos,
                'confidence': entity.confidence
            })
        
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return {
            'text': text,
            'entities': entities_by_type,
            'total_entities': len(entities),
            'processing_time_ms': processing_time,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def classify_text(self, text: str, model_key: str = None) -> Dict[str, Any]:
        """Classify text into categories"""
        start_time = datetime.utcnow()
        
        result = self.text_classifier.classify_text(text, model_key)
        
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return {
            'text': text,
            'result': result,
            'processing_time_ms': processing_time,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def train_sentiment_model(self, training_data: List[Dict[str, Any]], language: str = 'english') -> Dict[str, Any]:
        """Train sentiment analysis model"""
        result = self.sentiment_analyzer.train_sentiment_model(training_data, language)
        self._save_models()
        return result
    
    def train_classification_model(self, training_data: List[Dict[str, Any]], language: str = 'english') -> Dict[str, Any]:
        """Train text classification model"""
        result = self.text_classifier.train_classifier(training_data, language)
        self._save_models()
        return result
    
    def extract_keywords(self, text: str, num_keywords: int = 10) -> List[str]:
        """Extract keywords from text"""
        try:
            # Preprocess text
            cleaned_text = self.preprocessor.clean_text(text)
            tokens = self.preprocessor.tokenize(cleaned_text)
            
            # Use TF-IDF to extract important terms
            vectorizer = TfidfVectorizer(max_features=num_keywords, ngram_range=(1, 2))
            tfidf_matrix = vectorizer.fit_transform([' '.join(tokens)])
            feature_names = vectorizer.get_feature_names_out()
            
            # Get scores
            scores = tfidf_matrix.toarray()[0]
            
            # Create keyword list with scores
            keywords = []
            for i, score in enumerate(scores):
                if score > 0:
                    keywords.append((feature_names[i], score))
            
            # Sort by score and return top keywords
            keywords.sort(key=lambda x: x[1], reverse=True)
            return [keyword[0] for keyword in keywords[:num_keywords]]
            
        except Exception as e:
            logger.error(f"Keyword extraction error: {e}")
            return []
    
    def detect_language(self, text: str) -> Dict[str, Any]:
        """Detect language of text"""
        try:
            # Simple language detection based on character patterns
            turkish_chars = set('çğıöşüİı')
            english_chars = set('abcdefghijklmnopqrstuvwxyz')
            
            text_lower = text.lower()
            
            # Count characters
            turkish_count = sum(1 for char in text_lower if char in turkish_chars)
            english_count = sum(1 for char in text_lower if char in english_chars)
            
            total_chars = len([char for char in text_lower if char.isalpha()])
            
            if total_chars == 0:
                return {'language': 'unknown', 'confidence': 0.0}
            
            turkish_ratio = turkish_count / total_chars
            english_ratio = english_count / total_chars
            
            if turkish_ratio > 0.1:
                return {'language': 'turkish', 'confidence': turkish_ratio}
            elif english_ratio > 0.5:
                return {'language': 'english', 'confidence': english_ratio}
            else:
                return {'language': 'unknown', 'confidence': 0.0}
                
        except Exception as e:
            logger.error(f"Language detection error: {e}")
            return {'language': 'unknown', 'confidence': 0.0}


# Global NLP service instance
nlp_service = NLPService()

# Export functions
def analyze_sentiment(text: str, method: str = 'vader') -> Dict[str, Any]:
    """Analyze sentiment of text"""
    return nlp_service.analyze_sentiment(text, method)

def extract_entities(text: str) -> Dict[str, Any]:
    """Extract entities from text"""
    return nlp_service.extract_entities(text)

def classify_text(text: str, model_key: str = None) -> Dict[str, Any]:
    """Classify text into categories"""
    return nlp_service.classify_text(text, model_key)

def train_sentiment_model(training_data: List[Dict[str, Any]], language: str = 'english') -> Dict[str, Any]:
    """Train sentiment analysis model"""
    return nlp_service.train_sentiment_model(training_data, language)

def train_classification_model(training_data: List[Dict[str, Any]], language: str = 'english') -> Dict[str, Any]:
    """Train text classification model"""
    return nlp_service.train_classification_model(training_data, language)

def extract_keywords(text: str, num_keywords: int = 10) -> List[str]:
    """Extract keywords from text"""
    return nlp_service.extract_keywords(text, num_keywords)

def detect_language(text: str) -> Dict[str, Any]:
    """Detect language of text"""
    return nlp_service.detect_language(text)

# Export all components
__all__ = [
    'NLPTaskType',
    'SentimentClass',
    'NLPResult',
    'Entity',
    'Topic',
    'TextPreprocessor',
    'SentimentAnalyzer',
    'EntityExtractor',
    'TextClassifier',
    'NLPService',
    'analyze_sentiment',
    'extract_entities',
    'classify_text',
    'train_sentiment_model',
    'train_classification_model',
    'extract_keywords',
    'detect_language',
    'nlp_service',
]
