"""
Generative AI and Content Creation System
Advanced generative AI with text, image, and multimodal generation capabilities
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
import torchvision.transforms as transforms
from PIL import Image
import transformers
from transformers import (
    AutoTokenizer, AutoModelForCausalLM, AutoModelForSeq2SeqLM,
    AutoModelForImageGeneration, AutoModelForVision2Seq,
    AutoProcessor, BlipProcessor, StableDiffusionPipeline
)
from diffusers import StableDiffusionPipeline, DDIMScheduler
import cv2
from sklearn.metrics import accuracy_score, mean_squared_error
import joblib
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class GenerationType(Enum):
    """Generation types"""
    TEXT_GENERATION = "text_generation"
    IMAGE_GENERATION = "image_generation"
    CODE_GENERATION = "code_generation"
    MUSIC_GENERATION = "music_generation"
    VIDEO_GENERATION = "video_generation"
    MULTIMODAL_GENERATION = "multimodal_generation"
    CONVERSATION_GENERATION = "conversation_generation"
    SUMMARIZATION_GENERATION = "summarization_generation"


class ModelType(Enum):
    """Model types"""
    GPT = "gpt"
    BERT = "bert"
    T5 = "t5"
    STABLE_DIFFUSION = "stable_diffusion"
    DALL_E = "dall_e"
    MIDJOURNEY = "midjourney"
    CUSTOM_GENERATIVE = "custom_generative"


class GenerationMethod(Enum):
    """Generation methods"""
    AUTOREGRESSIVE = "autoregressive"
    DENOISING_DIFFUSION = "denoising_diffusion"
    VAE = "vae"
    GAN = "gan"
    FLOW = "flow"
    ENCODER_DECODER = "encoder_decoder"
    DIFFUSION_MODEL = "diffusion_model"


@dataclass
class GenerationConfig:
    """Generation configuration"""
    model_type: ModelType
    generation_type: GenerationType
    model_name: str
    max_length: int = 512
    temperature: float = 0.7
    top_k: int = 50
    top_p: float = 0.9
    num_beams: int = 1
    do_sample: bool = True
    repetition_penalty: float = 1.1
    length_penalty: float = 1.0
    early_stopping: bool = True
    num_return_sequences: int = 1
    guidance_scale: float = 7.5
    num_inference_steps: int = 50
    height: int = 512
    width: int = 512
    negative_prompt: str = ""
    seed: Optional[int] = None


@dataclass
class GenerationResult:
    """Generation result"""
    generation_id: str
    model_type: ModelType
    generation_type: GenerationType
    input_prompt: str
    generated_content: Union[str, np.ndarray, Image.Image]
    generation_metadata: Dict[str, Any]
    generation_time_seconds: float
    model_name: str
    parameters_used: Dict[str, Any]
    quality_score: float
    created_at: datetime = field(default_factory=datetime.utcnow)


class TextGenerator:
    """Text generation engine"""
    
    def __init__(self, config: GenerationConfig):
        self.config = config
        self.model = None
        self.tokenizer = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._load_model()
    
    def _load_model(self) -> None:
        """Load text generation model"""
        try:
            if self.config.model_type == ModelType.GPT:
                self.model = AutoModelForCausalLM.from_pretrained(self.config.model_name)
                self.tokenizer = AutoTokenizer.from_pretrained(self.config.model_name)
            elif self.config.model_type == ModelType.T5:
                self.model = AutoModelForSeq2SeqLM.from_pretrained(self.config.model_name)
                self.tokenizer = AutoTokenizer.from_pretrained(self.config.model_name)
            else:
                # Default to GPT-style
                self.model = AutoModelForCausalLM.from_pretrained(self.config.model_name)
                self.tokenizer = AutoTokenizer.from_pretrained(self.config.model_name)
            
            # Add padding token if not present
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            self.model.to(self.device)
            logger.info(f"Loaded text generation model: {self.config.model_name}")
            
        except Exception as e:
            logger.error(f"Error loading text generation model: {e}")
            raise
    
    def generate_text(self, prompt: str, **kwargs) -> GenerationResult:
        """Generate text from prompt"""
        generation_start = time.time()
        generation_id = f"text_gen_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        try:
            # Tokenize input
            inputs = self.tokenizer(prompt, return_tensors="pt", padding=True, truncation=True)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Override config with kwargs
            generation_params = {
                'max_length': kwargs.get('max_length', self.config.max_length),
                'temperature': kwargs.get('temperature', self.config.temperature),
                'top_k': kwargs.get('top_k', self.config.top_k),
                'top_p': kwargs.get('top_p', self.config.top_p),
                'num_beams': kwargs.get('num_beams', self.config.num_beams),
                'do_sample': kwargs.get('do_sample', self.config.do_sample),
                'repetition_penalty': kwargs.get('repetition_penalty', self.config.repetition_penalty),
                'length_penalty': kwargs.get('length_penalty', self.config.length_penalty),
                'early_stopping': kwargs.get('early_stopping', self.config.early_stopping),
                'num_return_sequences': kwargs.get('num_return_sequences', self.config.num_return_sequences),
                'pad_token_id': self.tokenizer.pad_token_id,
                'eos_token_id': self.tokenizer.eos_token_id,
            }
            
            # Generate text
            with torch.no_grad():
                if self.config.model_type == ModelType.T5:
                    outputs = self.model.generate(
                        input_ids=inputs['input_ids'],
                        attention_mask=inputs['attention_mask'],
                        **generation_params
                    )
                else:
                    outputs = self.model.generate(
                        input_ids=inputs['input_ids'],
                        attention_mask=inputs['attention_mask'],
                        **generation_params
                    )
            
            # Decode generated text
            generated_texts = []
            for output in outputs:
                if self.config.model_type == ModelType.T5:
                    # For seq2seq models, decode the full output
                    generated_text = self.tokenizer.decode(output, skip_special_tokens=True)
                else:
                    # For causal models, decode only the generated part
                    generated_text = self.tokenizer.decode(output[inputs['input_ids'].shape[1]:], skip_special_tokens=True)
                
                generated_texts.append(generated_text)
            
            generation_time = time.time() - generation_start
            
            # Calculate quality score (simplified)
            quality_score = self._calculate_text_quality(generated_texts[0] if generated_texts else "")
            
            result = GenerationResult(
                generation_id=generation_id,
                model_type=self.config.model_type,
                generation_type=GenerationType.TEXT_GENERATION,
                input_prompt=prompt,
                generated_content=generated_texts[0] if generated_texts else "",
                generation_metadata={
                    'num_generated_texts': len(generated_texts),
                    'all_generated_texts': generated_texts,
                    'input_length': len(prompt.split()),
                    'output_length': len(generated_texts[0].split()) if generated_texts else 0
                },
                generation_time_seconds=generation_time,
                model_name=self.config.model_name,
                parameters_used=generation_params,
                quality_score=quality_score
            )
            
            logger.info(f"Generated text: {generation_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error in text generation: {e}")
            raise
    
    def _calculate_text_quality(self, text: str) -> float:
        """Calculate text quality score"""
        try:
            # Simple quality metrics
            if not text:
                return 0.0
            
            # Length score (prefer reasonable length)
            length_score = min(len(text) / 100, 1.0)
            
            # Diversity score (avoid repetition)
            words = text.lower().split()
            unique_words = set(words)
            diversity_score = len(unique_words) / len(words) if words else 0.0
            
            # Coherence score (simplified - check for common patterns)
            coherence_score = 1.0  # Would need more sophisticated analysis
            
            # Combine scores
            quality_score = (length_score * 0.3 + diversity_score * 0.4 + coherence_score * 0.3)
            
            return min(quality_score, 1.0)
            
        except Exception as e:
            logger.error(f"Error calculating text quality: {e}")
            return 0.0


class ImageGenerator:
    """Image generation engine"""
    
    def __init__(self, config: GenerationConfig):
        self.config = config
        self.pipeline = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._load_model()
    
    def _load_model(self) -> None:
        """Load image generation model"""
        try:
            if self.config.model_type == ModelType.STABLE_DIFFUSION:
                self.pipeline = StableDiffusionPipeline.from_pretrained(
                    self.config.model_name,
                    torch_dtype=torch.float16 if self.device.type == "cuda" else torch.float32
                )
                self.pipeline = self.pipeline.to(self.device)
                
                # Use more efficient scheduler
                self.pipeline.scheduler = DDIMScheduler.from_config(self.pipeline.scheduler.config)
                
            elif self.config.model_type == ModelType.DALL_E:
                # DALL-E would require OpenAI API
                logger.warning("DALL-E requires API access, using Stable Diffusion instead")
                self.pipeline = StableDiffusionPipeline.from_pretrained(
                    "runwayml/stable-diffusion-v1-5",
                    torch_dtype=torch.float16 if self.device.type == "cuda" else torch.float32
                )
                self.pipeline = self.pipeline.to(self.device)
            
            logger.info(f"Loaded image generation model: {self.config.model_name}")
            
        except Exception as e:
            logger.error(f"Error loading image generation model: {e}")
            raise
    
    def generate_image(self, prompt: str, **kwargs) -> GenerationResult:
        """Generate image from prompt"""
        generation_start = time.time()
        generation_id = f"img_gen_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        try:
            # Override config with kwargs
            generation_params = {
                'prompt': prompt,
                'negative_prompt': kwargs.get('negative_prompt', self.config.negative_prompt),
                'height': kwargs.get('height', self.config.height),
                'width': kwargs.get('width', self.config.width),
                'num_inference_steps': kwargs.get('num_inference_steps', self.config.num_inference_steps),
                'guidance_scale': kwargs.get('guidance_scale', self.config.guidance_scale),
                'num_images_per_prompt': kwargs.get('num_images_per_prompt', 1),
                'eta': 0.0,
                'generator': torch.Generator(device=self.device).manual_seed(
                    kwargs.get('seed', self.config.seed) or torch.seed()
                ) if kwargs.get('seed') or self.config.seed else None,
                'latents': None,
                'output_type': 'pil'
            }
            
            # Generate image
            with torch.no_grad():
                if self.device.type == "cuda":
                    with torch.autocast("cuda"):
                        images = self.pipeline(**generation_params).images
                else:
                    images = self.pipeline(**generation_params).images
            
            generation_time = time.time() - generation_start
            
            # Calculate quality score (simplified)
            quality_score = self._calculate_image_quality(images[0] if images else None)
            
            result = GenerationResult(
                generation_id=generation_id,
                model_type=self.config.model_type,
                generation_type=GenerationType.IMAGE_GENERATION,
                input_prompt=prompt,
                generated_content=images[0] if images else None,
                generation_metadata={
                    'num_images': len(images),
                    'image_size': (self.config.height, self.config.width),
                    'num_inference_steps': self.config.num_inference_steps,
                    'guidance_scale': self.config.guidance_scale,
                    'seed': generation_params['generator'].initial_seed() if generation_params['generator'] else None
                },
                generation_time_seconds=generation_time,
                model_name=self.config.model_name,
                parameters_used=generation_params,
                quality_score=quality_score
            )
            
            logger.info(f"Generated image: {generation_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error in image generation: {e}")
            raise
    
    def _calculate_image_quality(self, image: Optional[Image.Image]) -> float:
        """Calculate image quality score"""
        try:
            if image is None:
                return 0.0
            
            # Convert to numpy array
            img_array = np.array(image)
            
            # Basic quality metrics
            # 1. Resolution score (prefer higher resolution)
            resolution_score = min((img_array.shape[0] * img_array.shape[1]) / (512 * 512), 1.0)
            
            # 2. Color distribution score (check for reasonable color distribution)
            if len(img_array.shape) == 3:  # RGB
                color_std = np.std(img_array, axis=(0, 1))
                color_score = min(np.mean(color_std) / 128, 1.0)
            else:
                color_score = 0.5
            
            # 3. Contrast score
            if len(img_array.shape) == 3:
                gray = np.mean(img_array, axis=2)
            else:
                gray = img_array
            
            contrast = np.std(gray)
            contrast_score = min(contrast / 64, 1.0)
            
            # 4. Sharpness score (simplified edge detection)
            if len(img_array.shape) == 3:
                gray = np.mean(img_array, axis=2)
            else:
                gray = img_array
            
            # Simple gradient-based sharpness
            grad_x = np.abs(np.diff(gray, axis=0))
            grad_y = np.abs(np.diff(gray, axis=1))
            sharpness = (np.mean(grad_x) + np.mean(grad_y)) / 2
            sharpness_score = min(sharpness / 32, 1.0)
            
            # Combine scores
            quality_score = (
                resolution_score * 0.2 +
                color_score * 0.2 +
                contrast_score * 0.3 +
                sharpness_score * 0.3
            )
            
            return min(quality_score, 1.0)
            
        except Exception as e:
            logger.error(f"Error calculating image quality: {e}")
            return 0.0


class MultimodalGenerator:
    """Multimodal generation engine"""
    
    def __init__(self, config: GenerationConfig):
        self.config = config
        self.model = None
        self.processor = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._load_model()
    
    def _load_model(self) -> None:
        """Load multimodal model"""
        try:
            if "blip" in self.config.model_name.lower():
                self.processor = BlipProcessor.from_pretrained(self.config.model_name)
                self.model = AutoModelForVision2Seq.from_pretrained(self.config.model_name)
            else:
                # Default to BLIP
                self.processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
                self.model = AutoModelForVision2Seq.from_pretrained("Salesforce/blip-image-captioning-base")
            
            self.model.to(self.device)
            logger.info(f"Loaded multimodal model: {self.config.model_name}")
            
        except Exception as e:
            logger.error(f"Error loading multimodal model: {e}")
            raise
    
    def generate_caption(self, image: Union[str, np.ndarray, Image.Image], **kwargs) -> GenerationResult:
        """Generate caption from image"""
        generation_start = time.time()
        generation_id = f"caption_gen_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        try:
            # Process image
            if isinstance(image, str):
                image = Image.open(image)
            elif isinstance(image, np.ndarray):
                image = Image.fromarray(image)
            
            # Preprocess image
            inputs = self.processor(image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Generate caption
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_length=kwargs.get('max_length', 50),
                    num_beams=kwargs.get('num_beams', 5),
                    early_stopping=kwargs.get('early_stopping', True),
                    temperature=kwargs.get('temperature', 0.7)
                )
            
            # Decode caption
            caption = self.processor.decode(outputs[0], skip_special_tokens=True)
            
            generation_time = time.time() - generation_start
            
            # Calculate quality score
            quality_score = self._calculate_caption_quality(caption)
            
            result = GenerationResult(
                generation_id=generation_id,
                model_type=self.config.model_type,
                generation_type=GenerationType.MULTIMODAL_GENERATION,
                input_prompt="",
                generated_content=caption,
                generation_metadata={
                    'input_image_size': image.size,
                    'caption_length': len(caption.split()),
                    'generation_method': 'image_to_text'
                },
                generation_time_seconds=generation_time,
                model_name=self.config.model_name,
                parameters_used=kwargs,
                quality_score=quality_score
            )
            
            logger.info(f"Generated caption: {generation_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error in caption generation: {e}")
            raise
    
    def _calculate_caption_quality(self, caption: str) -> float:
        """Calculate caption quality score"""
        try:
            if not caption:
                return 0.0
            
            # Simple quality metrics
            # 1. Length score (prefer reasonable caption length)
            length_score = min(len(caption.split()) / 15, 1.0)
            
            # 2. Vocabulary diversity
            words = caption.lower().split()
            unique_words = set(words)
            diversity_score = len(unique_words) / len(words) if words else 0.0
            
            # 3. Grammar score (simplified - check for basic patterns)
            grammar_score = 1.0  # Would need more sophisticated analysis
            
            # 4. Descriptiveness score (check for descriptive words)
            descriptive_words = ['beautiful', 'colorful', 'detailed', 'clear', 'vibrant', 'sharp']
            descriptiveness_score = sum(1 for word in words if word in descriptive_words) / len(words)
            
            # Combine scores
            quality_score = (
                length_score * 0.3 +
                diversity_score * 0.3 +
                grammar_score * 0.2 +
                descriptiveness_score * 0.2
            )
            
            return min(quality_score, 1.0)
            
        except Exception as e:
            logger.error(f"Error calculating caption quality: {e}")
            return 0.0


class GenerativeAIService:
    """Main generative AI service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.generators = {}
        self.generation_results = {}
        
    def create_generator(self, generator_id: str, config: GenerationConfig) -> str:
        """Create generative AI generator"""
        try:
            if config.generation_type == GenerationType.TEXT_GENERATION:
                generator = TextGenerator(config)
            elif config.generation_type == GenerationType.IMAGE_GENERATION:
                generator = ImageGenerator(config)
            elif config.generation_type == GenerationType.MULTIMODAL_GENERATION:
                generator = MultimodalGenerator(config)
            else:
                raise ValueError(f"Unsupported generation type: {config.generation_type}")
            
            self.generators[generator_id] = {
                'generator': generator,
                'config': config,
                'created_at': datetime.utcnow()
            }
            
            # Save to Redis
            if self.redis:
                self._save_generator(generator_id, config)
            
            logger.info(f"Created generator {generator_id}")
            return generator_id
            
        except Exception as e:
            logger.error(f"Error creating generator: {e}")
            raise
    
    def generate_content(self, generator_id: str, input_data: Any, 
                      generation_type: Optional[GenerationType] = None, **kwargs) -> GenerationResult:
        """Generate content using specified generator"""
        if generator_id not in self.generators:
            raise ValueError(f"Generator {generator_id} not found")
        
        generator_data = self.generators[generator_id]
        generator = generator_data['generator']
        
        try:
            if isinstance(generator, TextGenerator):
                result = generator.generate_text(input_data, **kwargs)
            elif isinstance(generator, ImageGenerator):
                result = generator.generate_image(input_data, **kwargs)
            elif isinstance(generator, MultimodalGenerator):
                if generation_type == GenerationType.MULTIMODAL_GENERATION:
                    result = generator.generate_caption(input_data, **kwargs)
                else:
                    raise ValueError(f"Unsupported generation type for multimodal generator: {generation_type}")
            else:
                raise ValueError(f"Unknown generator type")
            
            # Store result
            self.generation_results[result.generation_id] = result
            
            # Save to Redis
            if self.redis:
                self._save_generation_result(result)
            
            return result
            
        except Exception as e:
            logger.error(f"Error in content generation: {e}")
            raise
    
    def get_generation_result(self, generation_id: str) -> Dict[str, Any]:
        """Get generation result"""
        if generation_id not in self.generation_results:
            return {'error': f'Generation result {generation_id} not found'}
        
        result = self.generation_results[generation_id]
        
        return {
            'generation_id': generation_id,
            'model_type': result.model_type.value,
            'generation_type': result.generation_type.value,
            'input_prompt': result.input_prompt,
            'generated_content': result.generated_content,
            'generation_metadata': result.generation_metadata,
            'generation_time_seconds': result.generation_time_seconds,
            'model_name': result.model_name,
            'parameters_used': result.parameters_used,
            'quality_score': result.quality_score,
            'created_at': result.created_at.isoformat()
        }
    
    def list_generators(self) -> List[Dict[str, Any]]:
        """List all generators"""
        generators = []
        
        for gen_id, gen_data in self.generators.items():
            config = gen_data['config']
            generators.append({
                'generator_id': gen_id,
                'model_type': config.model_type.value,
                'generation_type': config.generation_type.value,
                'model_name': config.model_name,
                'max_length': config.max_length,
                'temperature': config.temperature,
                'created_at': gen_data['created_at'].isoformat()
            })
        
        return generators
    
    def _save_generator(self, generator_id: str, config: GenerationConfig) -> None:
        """Save generator to Redis"""
        try:
            generator_data = {
                'generator_id': generator_id,
                'model_type': config.model_type.value,
                'generation_type': config.generation_type.value,
                'model_name': config.model_name,
                'max_length': config.max_length,
                'temperature': config.temperature,
                'top_k': config.top_k,
                'top_p': config.top_p,
                'num_beams': config.num_beams,
                'repetition_penalty': config.repetition_penalty,
                'guidance_scale': config.guidance_scale,
                'num_inference_steps': config.num_inference_steps,
                'height': config.height,
                'width': config.width,
                'created_at': datetime.utcnow().isoformat()
            }
            
            self.redis.setex(f"genai_generator:{generator_id}", 
                           86400 * 30, json.dumps(generator_data))  # 30 days TTL
            
            logger.info(f"Saved generator {generator_id}")
            
        except Exception as e:
            logger.error(f"Failed to save generator: {e}")
    
    def _save_generation_result(self, result: GenerationResult) -> None:
        """Save generation result to Redis"""
        try:
            # Handle different content types
            content_data = None
            if isinstance(result.generated_content, str):
                content_data = result.generated_content
            elif isinstance(result.generated_content, Image.Image):
                # Convert image to base64 or save path
                content_data = f"Image generated: {result.generated_content.size}"
            elif isinstance(result.generated_content, np.ndarray):
                content_data = f"Array generated: {result.generated_content.shape}"
            
            generation_data = {
                'generation_id': result.generation_id,
                'model_type': result.model_type.value,
                'generation_type': result.generation_type.value,
                'input_prompt': result.input_prompt,
                'generated_content': content_data,
                'generation_metadata': result.generation_metadata,
                'generation_time_seconds': result.generation_time_seconds,
                'model_name': result.model_name,
                'parameters_used': result.parameters_used,
                'quality_score': result.quality_score,
                'created_at': result.created_at.isoformat()
            }
            
            self.redis.setex(f"genai_result:{result.generation_id}", 
                           86400 * 7, json.dumps(generation_data))  # 7 days TTL
            
            logger.info(f"Saved generation result {result.generation_id}")
            
        except Exception as e:
            logger.error(f"Failed to save generation result: {e}")


# Global generative AI service instance
generative_ai_service = GenerativeAIService()

# Export functions
def create_generative_ai_generator(generator_id: str, config: GenerationConfig) -> str:
    """Create generative AI generator"""
    return generative_ai_service.create_generator(generator_id, config)

def generate_ai_content(generator_id: str, input_data: Any, 
                      generation_type: Optional[GenerationType] = None, **kwargs) -> GenerationResult:
    """Generate AI content"""
    return generative_ai_service.generate_content(generator_id, input_data, generation_type, **kwargs)

def get_generation_result(generation_id: str) -> Dict[str, Any]:
    """Get generation result"""
    return generative_ai_service.get_generation_result(generation_id)

def list_generative_ai_generators() -> List[Dict[str, Any]]:
    """List generative AI generators"""
    return generative_ai_service.list_generators()

# Export all components
__all__ = [
    'GenerationType',
    'ModelType',
    'GenerationMethod',
    'GenerationConfig',
    'GenerationResult',
    'TextGenerator',
    'ImageGenerator',
    'MultimodalGenerator',
    'GenerativeAIService',
    'create_generative_ai_generator',
    'generate_ai_content',
    'get_generation_result',
    'list_generative_ai_generators',
    'generative_ai_service',
]
