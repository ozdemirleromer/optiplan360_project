"""
Knowledge Graph and Semantic Search System
Advanced knowledge graph construction with semantic search and reasoning capabilities
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple, Union, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import redis
import pickle
import json
import hashlib
import networkx as nx
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import PCA
from sentence_transformers import SentenceTransformer
import gensim
from gensim.models import Word2Vec, KeyedVectors
import spacy
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
import re

logger = logging.getLogger(__name__)


class EntityType(Enum):
    """Entity types"""
    PERSON = "person"
    ORGANIZATION = "organization"
    LOCATION = "location"
    PRODUCT = "product"
    SERVICE = "service"
    CONCEPT = "concept"
    EVENT = "event"
    DATE = "date"
    NUMBER = "number"
    CUSTOM = "custom"


class RelationType(Enum):
    """Relation types"""
    IS_A = "is_a"
    PART_OF = "part_of"
    RELATED_TO = "related_to"
    CAUSES = "causes"
    ENABLES = "enables"
    REQUIRES = "requires"
    LOCATED_IN = "located_in"
    WORKS_FOR = "works_for"
    OWNS = "owns"
    SIMILAR_TO = "similar_to"
    OPPOSITE_OF = "opposite_of"
    INSTANCE_OF = "instance_of"
    SUBCLASS_OF = "subclass_of"


class SearchType(Enum):
    """Search types"""
    SEMANTIC_SEARCH = "semantic_search"
    GRAPH_TRAVERSAL = "graph_traversal"
    HYBRID_SEARCH = "hybrid_search"
    ENTITY_SEARCH = "entity_search"
    RELATION_SEARCH = "relation_search"


@dataclass
class Entity:
    """Knowledge graph entity"""
    entity_id: str
    entity_type: EntityType
    name: str
    description: str
    properties: Dict[str, Any] = field(default_factory=dict)
    embeddings: Optional[np.ndarray] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Relation:
    """Knowledge graph relation"""
    relation_id: str
    subject_id: str
    object_id: str
    relation_type: RelationType
    properties: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 1.0
    source: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SearchResult:
    """Search result"""
    entity_id: str
    entity_type: EntityType
    name: str
    description: str
    score: float
    relevance_score: float
    path: Optional[List[str]] = None
    explanation: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class KnowledgeGraphConfig:
    """Knowledge graph configuration"""
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dim: int = 384
    similarity_threshold: float = 0.7
    max_neighbors: int = 10
    enable_reasoning: bool = True
    enable_temporal_reasoning: bool = False
    cache_embeddings: bool = True
    update_frequency_hours: int = 24


class EntityExtractor:
    """Entity extraction from text"""
    
    def __init__(self):
        self.nlp = None
        self.lemmatizer = WordNetLemmatizer()
        self.stop_words = set(stopwords.words('english'))
        
    def load_nlp_model(self, model_name: str = "en_core_web_sm") -> None:
        """Load spaCy NLP model"""
        try:
            self.nlp = spacy.load(model_name)
            logger.info(f"Loaded spaCy model: {model_name}")
        except OSError:
            logger.warning(f"spaCy model {model_name} not found, using basic extraction")
            self.nlp = None
    
    def extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract entities from text"""
        entities = []
        
        try:
            if self.nlp:
                # Use spaCy for entity extraction
                doc = self.nlp(text)
                
                for ent in doc.ents:
                    entity = {
                        'text': ent.text,
                        'label': ent.label_,
                        'start': ent.start_char,
                        'end': ent.end_char,
                        'confidence': 1.0
                    }
                    entities.append(entity)
            else:
                # Basic entity extraction using patterns
                entities = self._basic_entity_extraction(text)
            
            # Normalize entities
            normalized_entities = self._normalize_entities(entities)
            
            return normalized_entities
            
        except Exception as e:
            logger.error(f"Error in entity extraction: {e}")
            return []
    
    def _basic_entity_extraction(self, text: str) -> List[Dict[str, Any]]:
        """Basic entity extraction using patterns"""
        entities = []
        
        # Email pattern
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        for match in re.finditer(email_pattern, text):
            entities.append({
                'text': match.group(),
                'label': 'EMAIL',
                'start': match.start(),
                'end': match.end(),
                'confidence': 0.9
            })
        
        # Phone pattern
        phone_pattern = r'\b\d{3}-\d{3}-\d{4}\b|\b\d{10}\b'
        for match in re.finditer(phone_pattern, text):
            entities.append({
                'text': match.group(),
                'label': 'PHONE',
                'start': match.start(),
                'end': match.end(),
                'confidence': 0.8
            })
        
        # Date pattern
        date_pattern = r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b'
        for match in re.finditer(date_pattern, text):
            entities.append({
                'text': match.group(),
                'label': 'DATE',
                'start': match.start(),
                'end': match.end(),
                'confidence': 0.7
            })
        
        # Money pattern
        money_pattern = r'\$\d+(?:,\d{3})*(?:\.\d{2})?'
        for match in re.finditer(money_pattern, text):
            entities.append({
                'text': match.group(),
                'label': 'MONEY',
                'start': match.start(),
                'end': match.end(),
                'confidence': 0.8
            })
        
        return entities
    
    def _normalize_entities(self, entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize extracted entities"""
        normalized = []
        
        for entity in entities:
            # Map spaCy labels to our entity types
            label_mapping = {
                'PERSON': EntityType.PERSON,
                'ORG': EntityType.ORGANIZATION,
                'GPE': EntityType.LOCATION,
                'LOC': EntityType.LOCATION,
                'PRODUCT': EntityType.PRODUCT,
                'EVENT': EntityType.EVENT,
                'DATE': EntityType.DATE,
                'TIME': EntityType.DATE,
                'MONEY': EntityType.NUMBER,
                'QUANTITY': EntityType.NUMBER,
                'CARDINAL': EntityType.NUMBER,
                'ORDINAL': EntityType.NUMBER,
                'EMAIL': EntityType.CUSTOM,
                'PHONE': EntityType.CUSTOM
            }
            
            entity_type = label_mapping.get(entity['label'], EntityType.CUSTOM)
            
            # Clean entity text
            clean_text = entity['text'].strip()
            
            normalized_entity = {
                'text': clean_text,
                'entity_type': entity_type.value,
                'start': entity['start'],
                'end': entity['end'],
                'confidence': entity['confidence']
            }
            
            normalized.append(normalized_entity)
        
        return normalized


class RelationExtractor:
    """Relation extraction from text"""
    
    def __init__(self):
        self.nlp = None
        
    def load_nlp_model(self, model_name: str = "en_core_web_sm") -> None:
        """Load spaCy NLP model"""
        try:
            self.nlp = spacy.load(model_name)
            logger.info(f"Loaded spaCy model for relation extraction: {model_name}")
        except OSError:
            logger.warning(f"spaCy model {model_name} not found")
            self.nlp = None
    
    def extract_relations(self, text: str, entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract relations from text"""
        relations = []
        
        try:
            if self.nlp:
                # Use spaCy for dependency parsing
                doc = self.nlp(text)
                
                # Extract subject-verb-object triples
                for sent in doc.sents:
                    sent_relations = self._extract_svo_relations(sent, entities)
                    relations.extend(sent_relations)
            
            # Pattern-based relation extraction
            pattern_relations = self._pattern_based_extraction(text, entities)
            relations.extend(pattern_relations)
            
            return relations
            
        except Exception as e:
            logger.error(f"Error in relation extraction: {e}")
            return []
    
    def _extract_svo_relations(self, sent, entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract subject-verb-object relations"""
        relations = []
        
        try:
            # Find subject, verb, object
            subject = None
            verb = None
            obj = None
            
            for token in sent:
                if token.dep_ == "nsubj":
                    subject = token.text
                elif token.pos_ == "VERB":
                    verb = token.text
                elif token.dep_ == "dobj":
                    obj = token.text
            
            if subject and verb and obj:
                # Map to relation types
                relation_type = self._map_verb_to_relation(verb)
                
                relation = {
                    'subject': subject,
                    'relation': relation_type.value,
                    'object': obj,
                    'confidence': 0.7,
                    'source': 'dependency_parsing'
                }
                
                relations.append(relation)
        
        except Exception as e:
            logger.error(f"Error in SVO extraction: {e}")
        
        return relations
    
    def _pattern_based_extraction(self, text: str, entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Pattern-based relation extraction"""
        relations = []
        
        # Work for patterns
        work_patterns = [
            r'(\w+)\s+works?\s+for\s+(\w+)',
            r'(\w+)\s+is\s+a\s+(\w+)\s+at\s+(\w+)',
            r'(\w+)\s+employment\s+(\w+)'
        ]
        
        for pattern in work_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                if len(match.groups()) >= 2:
                    relations.append({
                        'subject': match.group(1),
                        'relation': RelationType.WORKS_FOR.value,
                        'object': match.group(2),
                        'confidence': 0.8,
                        'source': 'pattern_matching'
                    })
        
        # Located in patterns
        location_patterns = [
            r'(\w+)\s+is\s+located\s+in\s+(\w+)',
            r'(\w+)\s+lives?\s+in\s+(\w+)',
            r'(\w+)\s+based\s+in\s+(\w+)'
        ]
        
        for pattern in location_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                if len(match.groups()) >= 2:
                    relations.append({
                        'subject': match.group(1),
                        'relation': RelationType.LOCATED_IN.value,
                        'object': match.group(2),
                        'confidence': 0.8,
                        'source': 'pattern_matching'
                    })
        
        # Ownership patterns
        ownership_patterns = [
            r'(\w+)\s+owns?\s+(\w+)',
            r'(\w+)'s?\s+(\w+)',
            r'(\w+)\s+possesses?\s+(\w+)'
        ]
        
        for pattern in ownership_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                if len(match.groups()) >= 2:
                    relations.append({
                        'subject': match.group(1),
                        'relation': RelationType.OWNS.value,
                        'object': match.group(2),
                        'confidence': 0.7,
                        'source': 'pattern_matching'
                    })
        
        return relations
    
    def _map_verb_to_relation(self, verb: str) -> RelationType:
        """Map verb to relation type"""
        verb_mapping = {
            'is': RelationType.IS_A,
            'are': RelationType.IS_A,
            'was': RelationType.IS_A,
            'were': RelationType.IS_A,
            'has': RelationType.HAS,
            'have': RelationType.HAS,
            'works': RelationType.WORKS_FOR,
            'causes': RelationType.CAUSES,
            'enables': RelationType.ENABLES,
            'requires': RelationType.REQUIRES,
            'similar': RelationType.SIMILAR_TO,
            'opposite': RelationType.OPPOSITE_OF
        }
        
        return verb_mapping.get(verb.lower(), RelationType.RELATED_TO)


class EmbeddingGenerator:
    """Embedding generation for entities and text"""
    
    def __init__(self, config: KnowledgeGraphConfig):
        self.config = config
        self.model = None
        self.word2vec_model = None
        
    def load_embedding_model(self) -> None:
        """Load embedding model"""
        try:
            # Load sentence transformer model
            self.model = SentenceTransformer(self.config.embedding_model)
            logger.info(f"Loaded sentence transformer model: {self.config.embedding_model}")
        except Exception as e:
            logger.error(f"Error loading embedding model: {e}")
            raise
    
    def load_word2vec_model(self, model_path: str) -> None:
        """Load Word2Vec model"""
        try:
            self.word2vec_model = KeyedVectors.load_word2vec_format(model_path, binary=True)
            logger.info(f"Loaded Word2Vec model from {model_path}")
        except Exception as e:
            logger.error(f"Error loading Word2Vec model: {e}")
    
    def generate_embeddings(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for texts"""
        if self.model is None:
            self.load_embedding_model()
        
        try:
            embeddings = self.model.encode(texts)
            return embeddings
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            # Fallback to random embeddings
            return np.random.rand(len(texts), self.config.embedding_dim)
    
    def generate_entity_embedding(self, entity: Entity) -> np.ndarray:
        """Generate embedding for entity"""
        # Combine name and description
        text = f"{entity.name} {entity.description}"
        
        # Add properties to text
        if entity.properties:
            prop_text = " ".join([f"{k} {v}" for k, v in entity.properties.items()])
            text += f" {prop_text}"
        
        # Generate embedding
        embedding = self.generate_embeddings([text])[0]
        
        return embedding
    
    def calculate_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Calculate cosine similarity between embeddings"""
        try:
            similarity = cosine_similarity([embedding1], [embedding2])[0][0]
            return float(similarity)
        except Exception as e:
            logger.error(f"Error calculating similarity: {e}")
            return 0.0


class KnowledgeGraph:
    """Knowledge graph construction and management"""
    
    def __init__(self, config: KnowledgeGraphConfig, redis_client: Optional[redis.Redis] = None):
        self.config = config
        self.redis = redis_client
        self.graph = nx.DiGraph()
        self.entities = {}
        self.relations = {}
        self.entity_extractor = EntityExtractor()
        self.relation_extractor = RelationExtractor()
        self.embedding_generator = EmbeddingGenerator(config)
        
        # Load models
        self.entity_extractor.load_nlp_model()
        self.relation_extractor.load_nlp_model()
        self.embedding_generator.load_embedding_model()
        
        # Load existing graph
        self._load_graph()
    
    def add_entity(self, entity: Entity) -> str:
        """Add entity to knowledge graph"""
        try:
            # Generate embedding if not provided
            if entity.embeddings is None:
                entity.embeddings = self.embedding_generator.generate_entity_embedding(entity)
            
            # Add to graph
            self.graph.add_node(entity.entity_id, **{
                'entity_type': entity.entity_type.value,
                'name': entity.name,
                'description': entity.description,
                'properties': entity.properties,
                'embeddings': entity.embeddings.tolist() if entity.embeddings is not None else None,
                'created_at': entity.created_at.isoformat()
            })
            
            # Store entity
            self.entities[entity.entity_id] = entity
            
            # Save to Redis
            self._save_entity(entity)
            
            logger.info(f"Added entity {entity.entity_id}: {entity.name}")
            return entity.entity_id
            
        except Exception as e:
            logger.error(f"Error adding entity: {e}")
            raise
    
    def add_relation(self, relation: Relation) -> str:
        """Add relation to knowledge graph"""
        try:
            # Add to graph
            self.graph.add_edge(
                relation.subject_id,
                relation.object_id,
                **{
                    'relation_id': relation.relation_id,
                    'relation_type': relation.relation_type.value,
                    'properties': relation.properties,
                    'confidence': relation.confidence,
                    'source': relation.source,
                    'created_at': relation.created_at.isoformat()
                }
            )
            
            # Store relation
            self.relations[relation.relation_id] = relation
            
            # Save to Redis
            self._save_relation(relation)
            
            logger.info(f"Added relation {relation.relation_id}: {relation.subject_id} -> {relation.object_id}")
            return relation.relation_id
            
        except Exception as e:
            logger.error(f"Error adding relation: {e}")
            raise
    
    def extract_and_add_from_text(self, text: str, source: str = "") -> Dict[str, Any]:
        """Extract entities and relations from text and add to graph"""
        try:
            # Extract entities
            entities_data = self.entity_extractor.extract_entities(text)
            
            # Extract relations
            relations_data = self.relation_extractor.extract_relations(text, entities_data)
            
            # Create entities
            entity_ids = {}
            for i, entity_data in enumerate(entities_data):
                entity = Entity(
                    entity_id=f"entity_{hashlib.md5(entity_data['text'].encode()).hexdigest()[:8]}_{i}",
                    entity_type=EntityType(entity_data['entity_type']),
                    name=entity_data['text'],
                    description=f"Extracted from text: {entity_data['text'][:100]}...",
                    properties={
                        'source': source,
                        'confidence': entity_data['confidence'],
                        'start_pos': entity_data['start'],
                        'end_pos': entity_data['end']
                    }
                )
                
                entity_id = self.add_entity(entity)
                entity_ids[entity_data['text']] = entity_id
            
            # Create relations
            relation_ids = []
            for relation_data in relations_data:
                # Find subject and object entities
                subject_id = entity_ids.get(relation_data['subject'])
                object_id = entity_ids.get(relation_data['object'])
                
                if subject_id and object_id:
                    relation = Relation(
                        relation_id=f"relation_{hashlib.md5(f'{relation_data["subject"]}_{relation_data["relation"]}_{relation_data["object"]}'.encode()).hexdigest()[:8]}",
                        subject_id=subject_id,
                        object_id=object_id,
                        relation_type=RelationType(relation_data['relation']),
                        properties={
                            'source': source,
                            'confidence': relation_data['confidence']
                        },
                        confidence=relation_data['confidence'],
                        source=relation_data['source']
                    )
                    
                    relation_id = self.add_relation(relation)
                    relation_ids.append(relation_id)
            
            return {
                'entities_extracted': len(entities_data),
                'relations_extracted': len(relations_data),
                'entity_ids': list(entity_ids.values()),
                'relation_ids': relation_ids,
                'source': source
            }
            
        except Exception as e:
            logger.error(f"Error extracting from text: {e}")
            raise
    
    def semantic_search(self, query: str, top_k: int = 10, 
                        entity_types: Optional[List[EntityType]] = None) -> List[SearchResult]:
        """Perform semantic search"""
        try:
            # Generate query embedding
            query_embedding = self.embedding_generator.generate_embeddings([query])[0]
            
            # Calculate similarities with all entities
            similarities = []
            
            for entity_id, entity in self.entities.items():
                # Filter by entity type if specified
                if entity_types and entity.entity_type not in entity_types:
                    continue
                
                if entity.embeddings is not None:
                    similarity = self.embedding_generator.calculate_similarity(
                        query_embedding, entity.embeddings
                    )
                    
                    if similarity >= self.config.similarity_threshold:
                        similarities.append({
                            'entity_id': entity_id,
                            'entity': entity,
                            'similarity': similarity
                        })
            
            # Sort by similarity
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            
            # Create search results
            results = []
            for i, sim in enumerate(similarities[:top_k]):
                entity = sim['entity']
                result = SearchResult(
                    entity_id=entity.entity_id,
                    entity_type=entity.entity_type,
                    name=entity.name,
                    description=entity.description,
                    score=sim['similarity'],
                    relevance_score=sim['similarity'],
                    explanation=f"Semantic similarity: {sim['similarity']:.3f}",
                    metadata={
                        'similarity_type': 'semantic',
                        'query_embedding': query_embedding.tolist()
                    }
                )
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Error in semantic search: {e}")
            return []
    
    def graph_traversal_search(self, start_entity_id: str, relation_types: Optional[List[RelationType]] = None,
                             max_depth: int = 3, top_k: int = 10) -> List[SearchResult]:
        """Perform graph traversal search"""
        try:
            if start_entity_id not in self.entities:
                return []
            
            # Perform BFS/DFS traversal
            visited = set()
            queue = [(start_entity_id, 0, [start_entity_id])]
            results = []
            
            while queue and len(results) < top_k:
                current_id, depth, path = queue.pop(0)
                
                if current_id in visited or depth > max_depth:
                    continue
                
                visited.add(current_id)
                
                # Get current entity
                entity = self.entities.get(current_id)
                if not entity:
                    continue
                
                # Add to results if not the start entity
                if current_id != start_entity_id:
                    result = SearchResult(
                        entity_id=entity.entity_id,
                        entity_type=entity.entity_type,
                        name=entity.name,
                        description=entity.description,
                        score=1.0 / (depth + 1),  # Higher score for closer entities
                        relevance_score=1.0 / (depth + 1),
                        path=path,
                        explanation=f"Graph traversal at depth {depth}",
                        metadata={
                            'traversal_type': 'graph',
                            'depth': depth
                        }
                    )
                    results.append(result)
                
                # Add neighbors to queue
                for neighbor_id, edge_data in self.graph[current_id].items():
                    if neighbor_id not in visited:
                        # Filter by relation type if specified
                        if relation_types:
                            edge_relation_type = edge_data.get('relation_type')
                            if edge_relation_type not in [rt.value for rt in relation_types]:
                                continue
                        
                        new_path = path + [neighbor_id]
                        queue.append((neighbor_id, depth + 1, new_path))
            
            # Sort by score
            results.sort(key=lambda x: x.score, reverse=True)
            
            return results[:top_k]
            
        except Exception as e:
            logger.error(f"Error in graph traversal search: {e}")
            return []
    
    def hybrid_search(self, query: str, top_k: int = 10,
                    entity_types: Optional[List[EntityType]] = None,
                    relation_types: Optional[List[RelationType]] = None,
                    max_depth: int = 2) -> List[SearchResult]:
        """Perform hybrid search combining semantic and graph traversal"""
        try:
            # Get semantic search results
            semantic_results = self.semantic_search(query, top_k * 2, entity_types)
            
            # Get graph traversal results from top semantic results
            graph_results = []
            for result in semantic_results[:5]:  # Use top 5 semantic results
                traversal_results = self.graph_traversal_search(
                    result.entity_id, relation_types, max_depth, top_k // 2
                )
                graph_results.extend(traversal_results)
            
            # Combine and deduplicate results
            all_results = semantic_results + graph_results
            
            # Deduplicate by entity_id
            seen_ids = set()
            deduplicated_results = []
            
            for result in all_results:
                if result.entity_id not in seen_ids:
                    seen_ids.add(result.entity_id)
                    deduplicated_results.append(result)
            
            # Re-rank combined results
            for result in deduplicated_results:
                # Combine semantic and traversal scores
                if result.path and len(result.path) > 1:
                    # Has traversal path
                    result.score = (result.relevance_score * 0.6) + (1.0 / len(result.path) * 0.4)
                    result.explanation = f"Hybrid: {result.explanation}"
                else:
                    # Semantic only
                    result.score = result.relevance_score
            
            # Sort by final score
            deduplicated_results.sort(key=lambda x: x.score, reverse=True)
            
            return deduplicated_results[:top_k]
            
        except Exception as e:
            logger.error(f"Error in hybrid search: {e}")
            return []
    
    def get_entity_neighbors(self, entity_id: str, relation_types: Optional[List[RelationType]] = None) -> List[Dict[str, Any]]:
        """Get neighbors of an entity"""
        try:
            if entity_id not in self.graph:
                return []
            
            neighbors = []
            
            for neighbor_id, edge_data in self.graph[entity_id].items():
                # Filter by relation type if specified
                if relation_types:
                    edge_relation_type = edge_data.get('relation_type')
                    if edge_relation_type not in [rt.value for rt in relation_types]:
                        continue
                
                neighbor_entity = self.entities.get(neighbor_id)
                if neighbor_entity:
                    neighbors.append({
                        'entity_id': neighbor_id,
                        'entity': neighbor_entity,
                        'relation_type': edge_data.get('relation_type'),
                        'confidence': edge_data.get('confidence', 1.0),
                        'properties': edge_data.get('properties', {})
                    })
            
            return neighbors
            
        except Exception as e:
            logger.error(f"Error getting entity neighbors: {e}")
            return []
    
    def _save_entity(self, entity: Entity) -> None:
        """Save entity to Redis"""
        try:
            if self.redis:
                entity_data = {
                    'entity_id': entity.entity_id,
                    'entity_type': entity.entity_type.value,
                    'name': entity.name,
                    'description': entity.description,
                    'properties': entity.properties,
                    'embeddings': entity.embeddings.tolist() if entity.embeddings is not None else None,
                    'created_at': entity.created_at.isoformat(),
                    'metadata': entity.metadata
                }
                
                self.redis.setex(f"kg_entity:{entity.entity_id}", 
                               86400 * 30, json.dumps(entity_data))  # 30 days TTL
                
                logger.info(f"Saved entity {entity.entity_id}")
        except Exception as e:
            logger.error(f"Failed to save entity: {e}")
    
    def _save_relation(self, relation: Relation) -> None:
        """Save relation to Redis"""
        try:
            if self.redis:
                relation_data = {
                    'relation_id': relation.relation_id,
                    'subject_id': relation.subject_id,
                    'object_id': relation.object_id,
                    'relation_type': relation.relation_type.value,
                    'properties': relation.properties,
                    'confidence': relation.confidence,
                    'source': relation.source,
                    'created_at': relation.created_at.isoformat(),
                    'metadata': relation.metadata
                }
                
                self.redis.setex(f"kg_relation:{relation.relation_id}", 
                               86400 * 30, json.dumps(relation_data))  # 30 days TTL
                
                logger.info(f"Saved relation {relation.relation_id}")
        except Exception as e:
            logger.error(f"Failed to save relation: {e}")
    
    def _load_graph(self) -> None:
        """Load existing graph from Redis"""
        try:
            if self.redis:
                # Load entities
                entity_keys = self.redis.keys("kg_entity:*")
                for key in entity_keys:
                    entity_data = self.redis.get(key)
                    if entity_data:
                        data = json.loads(entity_data)
                        entity = Entity(
                            entity_id=data['entity_id'],
                            entity_type=EntityType(data['entity_type']),
                            name=data['name'],
                            description=data['description'],
                            properties=data['properties'],
                            embeddings=np.array(data['embeddings']) if data['embeddings'] else None,
                            created_at=datetime.fromisoformat(data['created_at']),
                            metadata=data['metadata']
                        )
                        
                        self.entities[entity.entity_id] = entity
                        
                        # Add to graph
                        self.graph.add_node(entity.entity_id, **{
                            'entity_type': entity.entity_type.value,
                            'name': entity.name,
                            'description': entity.description,
                            'properties': entity.properties,
                            'embeddings': entity.embeddings.tolist() if entity.embeddings is not None else None
                        })
                
                # Load relations
                relation_keys = self.redis.keys("kg_relation:*")
                for key in relation_keys:
                    relation_data = self.redis.get(key)
                    if relation_data:
                        data = json.loads(relation_data)
                        relation = Relation(
                            relation_id=data['relation_id'],
                            subject_id=data['subject_id'],
                            object_id=data['object_id'],
                            relation_type=RelationType(data['relation_type']),
                            properties=data['properties'],
                            confidence=data['confidence'],
                            source=data['source'],
                            created_at=datetime.fromisoformat(data['created_at']),
                            metadata=data['metadata']
                        )
                        
                        self.relations[relation.relation_id] = relation
                        
                        # Add to graph
                        self.graph.add_edge(
                            relation.subject_id,
                            relation.object_id,
                            **{
                                'relation_id': relation.relation_id,
                                'relation_type': relation.relation_type.value,
                                'properties': relation.properties,
                                'confidence': relation.confidence,
                                'source': relation.source
                            }
                        )
                
                logger.info(f"Loaded {len(self.entities)} entities and {len(self.relations)} relations")
                
        except Exception as e:
            logger.error(f"Failed to load graph: {e}")


class KnowledgeGraphService:
    """Main knowledge graph service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.knowledge_graphs = {}
        
    def create_knowledge_graph(self, graph_id: str, config: Optional[KnowledgeGraphConfig] = None) -> KnowledgeGraph:
        """Create knowledge graph"""
        if config is None:
            config = KnowledgeGraphConfig()
        
        knowledge_graph = KnowledgeGraph(config, self.redis)
        self.knowledge_graphs[graph_id] = knowledge_graph
        
        logger.info(f"Created knowledge graph {graph_id}")
        return knowledge_graph
    
    def get_knowledge_graph(self, graph_id: str) -> Optional[KnowledgeGraph]:
        """Get knowledge graph by ID"""
        return self.knowledge_graphs.get(graph_id)
    
    def search_knowledge_graph(self, graph_id: str, query: str, search_type: SearchType = SearchType.HYBRID_SEARCH,
                              **kwargs) -> List[SearchResult]:
        """Search knowledge graph"""
        knowledge_graph = self.get_knowledge_graph(graph_id)
        if not knowledge_graph:
            return []
        
        if search_type == SearchType.SEMANTIC_SEARCH:
            return knowledge_graph.semantic_search(query, **kwargs)
        elif search_type == SearchType.GRAPH_TRAVERSAL:
            return knowledge_graph.graph_traversal_search(query, **kwargs)
        else:  # HYBRID_SEARCH
            return knowledge_graph.hybrid_search(query, **kwargs)


# Global knowledge graph service instance
knowledge_graph_service = KnowledgeGraphService()

# Export functions
def create_knowledge_graph(graph_id: str, config: Optional[KnowledgeGraphConfig] = None) -> KnowledgeGraph:
    """Create knowledge graph"""
    return knowledge_graph_service.create_knowledge_graph(graph_id, config)

def search_knowledge_graph(graph_id: str, query: str, search_type: SearchType = SearchType.HYBRID_SEARCH,
                        **kwargs) -> List[SearchResult]:
    """Search knowledge graph"""
    return knowledge_graph_service.search_knowledge_graph(graph_id, query, search_type, **kwargs)

def extract_and_add_entities(graph_id: str, text: str, source: str = "") -> Dict[str, Any]:
    """Extract entities and relations from text and add to graph"""
    knowledge_graph = knowledge_graph_service.get_knowledge_graph(graph_id)
    if knowledge_graph:
        return knowledge_graph.extract_and_add_from_text(text, source)
    return {'error': f'Knowledge graph {graph_id} not found'}

# Export all components
__all__ = [
    'EntityType',
    'RelationType',
    'SearchType',
    'Entity',
    'Relation',
    'SearchResult',
    'KnowledgeGraphConfig',
    'EntityExtractor',
    'RelationExtractor',
    'EmbeddingGenerator',
    'KnowledgeGraph',
    'KnowledgeGraphService',
    'create_knowledge_graph',
    'search_knowledge_graph',
    'extract_and_add_entities',
    'knowledge_graph_service',
]
