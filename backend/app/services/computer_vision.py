"""
Computer Vision and Image Processing Enhancements
Advanced computer vision services for OCR improvement, image analysis, and visual data processing
"""

import logging
import numpy as np
import cv2
from typing import Dict, Any, List, Optional, Tuple, Union
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import redis
import pickle
import json
from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
import easyocr
import torch
import torchvision.transforms as transforms
from sklearn.cluster import KMeans
import joblib

logger = logging.getLogger(__name__)


class ImageProcessingType(Enum):
    """Image processing types"""
    PREPROCESSING = "preprocessing"
    ENHANCEMENT = "enhancement"
    SEGMENTATION = "segmentation"
    OBJECT_DETECTION = "object_detection"
    TEXT_DETECTION = "text_detection"
    QUALITY_ASSESSMENT = "quality_assessment"
    DOCUMENT_ANALYSIS = "document_analysis"


class ImageFormat(Enum):
    """Supported image formats"""
    JPEG = "jpeg"
    PNG = "png"
    TIFF = "tiff"
    BMP = "bmp"
    PDF = "pdf"


@dataclass
class ImageProcessingResult:
    """Image processing result"""
    task_id: str
    processing_type: ImageProcessingType
    input_image_path: str
    output_data: Any
    confidence_score: float
    processing_time_ms: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class TextRegion:
    """Text region in image"""
    bbox: Tuple[int, int, int, int]  # (x, y, width, height)
    text: str
    confidence: float
    language: Optional[str] = None
    angle: float = 0.0


@dataclass
class ImageQualityMetrics:
    """Image quality metrics"""
    sharpness: float
    contrast: float
    brightness: float
    noise_level: float
    resolution: Tuple[int, int]
    file_size_bytes: int
    overall_quality: float


class ImagePreprocessor:
    """Image preprocessing utilities"""
    
    def __init__(self):
        self.supported_formats = ['.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.pdf']
        
    def load_image(self, image_path: str) -> Optional[np.ndarray]:
        """Load image from file"""
        try:
            if image_path.lower().endswith('.pdf'):
                # Handle PDF files (would need pdf2image)
                logger.warning("PDF files not yet supported")
                return None
            
            image = cv2.imread(image_path)
            if image is None:
                logger.error(f"Failed to load image: {image_path}")
                return None
            
            return image
        except Exception as e:
            logger.error(f"Image loading error: {e}")
            return None
    
    def convert_to_grayscale(self, image: np.ndarray) -> np.ndarray:
        """Convert image to grayscale"""
        if len(image.shape) == 3:
            return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return image
    
    def resize_image(self, image: np.ndarray, target_size: Tuple[int, int], maintain_aspect_ratio: bool = True) -> np.ndarray:
        """Resize image"""
        if maintain_aspect_ratio:
            h, w = image.shape[:2]
            target_w, target_h = target_size
            
            # Calculate aspect ratio
            aspect_ratio = w / h
            
            if target_w / target_h > aspect_ratio:
                new_h = target_h
                new_w = int(target_h * aspect_ratio)
            else:
                new_w = target_w
                new_h = int(target_w / aspect_ratio)
            
            return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
        else:
            return cv2.resize(image, target_size, interpolation=cv2.INTER_AREA)
    
    def enhance_contrast(self, image: np.ndarray, alpha: float = 1.5, beta: int = 0) -> np.ndarray:
        """Enhance image contrast"""
        return cv2.convertScaleAbs(image, alpha=alpha, beta=beta)
    
    def denoise_image(self, image: np.ndarray, method: str = 'gaussian') -> np.ndarray:
        """Denoise image"""
        if method == 'gaussian':
            return cv2.GaussianBlur(image, (5, 5), 0)
        elif method == 'median':
            return cv2.medianBlur(image, 5)
        elif method == 'bilateral':
            return cv2.bilateralFilter(image, 9, 75, 75)
        elif method == 'nlm':
            return cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)
        else:
            return image
    
    def sharpen_image(self, image: np.ndarray, method: str = 'unsharp_mask') -> np.ndarray:
        """Sharpen image"""
        if method == 'unsharp_mask':
            blurred = cv2.GaussianBlur(image, (0, 0), 2.0)
            sharpened = cv2.addWeighted(image, 1.5, blurred, -0.5, 0)
            return sharpened
        elif method == 'laplacian':
            gray = self.convert_to_grayscale(image)
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            sharpened = cv2.convertScaleAbs(laplacian)
            return sharpened
        else:
            return image
    
    def normalize_image(self, image: np.ndarray) -> np.ndarray:
        """Normalize image"""
        return cv2.normalize(image, None, 0, 255, cv2.NORM_MINMAX)
    
    def preprocess_for_ocr(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image specifically for OCR"""
        # Convert to grayscale
        gray = self.convert_to_grayscale(image)
        
        # Enhance contrast
        enhanced = self.enhance_contrast(gray)
        
        # Denoise
        denoised = self.denoise_image(enhanced, 'bilateral')
        
        # Threshold
        _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Morphological operations
        kernel = np.ones((2, 2), np.uint8)
        processed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        processed = cv2.morphologyEx(processed, cv2.MORPH_OPEN, kernel)
        
        return processed


class TextDetector:
    """Text detection and OCR service"""
    
    def __init__(self):
        self.easyocr_reader = easyocr.Reader(['en', 'tr'])
        self.tesseract_config = r'--oem 3 --psm 6'
        
    def detect_text_tesseract(self, image: np.ndarray, language: str = 'tur') -> List[TextRegion]:
        """Detect text using Tesseract OCR"""
        try:
            # Configure Tesseract
            config = f'--oem 3 --psm 6 -l {language}'
            
            # Extract text
            data = pytesseract.image_to_data(image, config=config, output_type=pytesseract.Output.DICT)
            
            text_regions = []
            n_boxes = len(data['text'])
            
            for i in range(n_boxes):
                text = data['text'][i].strip()
                confidence = int(data['conf'][i])
                
                if text and confidence > 30:
                    x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                    
                    region = TextRegion(
                        bbox=(x, y, w, h),
                        text=text,
                        confidence=confidence / 100.0,
                        language=language,
                        angle=0.0
                    )
                    text_regions.append(region)
            
            return text_regions
            
        except Exception as e:
            logger.error(f"Tesseract OCR error: {e}")
            return []
    
    def detect_text_easyocr(self, image: np.ndarray) -> List[TextRegion]:
        """Detect text using EasyOCR"""
        try:
            results = self.easyocr_reader.readtext(image)
            
            text_regions = []
            for (bbox, text, confidence) in results:
                if confidence > 0.5:
                    # Convert bbox format
                    x1, y1 = bbox[0]
                    x2, y2 = bbox[2]
                    x, y, w, h = int(x1), int(y1), int(x2 - x1), int(y2 - y1)
                    
                    region = TextRegion(
                        bbox=(x, y, w, h),
                        text=text,
                        confidence=confidence,
                        language=None,  # EasyOCR doesn't provide language per region
                        angle=0.0
                    )
                    text_regions.append(region)
            
            return text_regions
            
        except Exception as e:
            logger.error(f"EasyOCR error: {e}")
            return []
    
    def detect_text_ensemble(self, image: np.ndarray, language: str = 'tur') -> List[TextRegion]:
        """Detect text using ensemble of OCR engines"""
        # Get results from both engines
        tesseract_results = self.detect_text_tesseract(image, language)
        easyocr_results = self.detect_text_easyocr(image)
        
        # Combine and deduplicate results
        all_results = tesseract_results + easyocr_results
        
        # Simple deduplication based on text content
        seen_texts = set()
        unique_results = []
        
        for result in sorted(all_results, key=lambda x: x.confidence, reverse=True):
            if result.text not in seen_texts:
                seen_texts.add(result.text)
                unique_results.append(result)
        
        return unique_results
    
    def extract_structured_data(self, text_regions: List[TextRegion]) -> Dict[str, Any]:
        """Extract structured data from text regions"""
        structured_data = {
            'raw_text': ' '.join([region.text for region in text_regions]),
            'text_regions': [],
            'numbers': [],
            'dates': [],
            'emails': [],
            'phone_numbers': []
        }
        
        import re
        
        for region in text_regions:
            region_data = {
                'text': region.text,
                'bbox': region.bbox,
                'confidence': region.confidence,
                'language': region.language
            }
            structured_data['text_regions'].append(region_data)
            
            # Extract numbers
            numbers = re.findall(r'\d+\.?\d*', region.text)
            structured_data['numbers'].extend(numbers)
            
            # Extract dates
            dates = re.findall(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', region.text)
            structured_data['dates'].extend(dates)
            
            # Extract emails
            emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', region.text)
            structured_data['emails'].extend(emails)
            
            # Extract phone numbers
            phones = re.findall(r'\b(?:\+?(\d{1,3})?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b', region.text)
            structured_data['phone_numbers'].extend(phones)
        
        return structured_data


class DocumentAnalyzer:
    """Document analysis and classification"""
    
    def __init__(self):
        self.text_detector = TextDetector()
        
    def analyze_document_type(self, image: np.ndarray) -> Dict[str, Any]:
        """Analyze document type and structure"""
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Detect edges
        edges = cv2.Canny(gray, 50, 150)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Analyze contour properties
        document_info = {
            'contour_count': len(contours),
            'avg_contour_area': 0,
            'largest_contour_area': 0,
            'aspect_ratio': 0,
            'document_type': 'unknown'
        }
        
        if contours:
            areas = [cv2.contourArea(contour) for contour in contours]
            document_info['avg_contour_area'] = np.mean(areas)
            document_info['largest_contour_area'] = max(areas)
            
            # Get bounding rectangle of largest contour
            largest_contour = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest_contour)
            document_info['aspect_ratio'] = w / h if h > 0 else 0
            
            # Classify document type based on properties
            if document_info['aspect_ratio'] > 1.4:
                document_info['document_type'] = 'invoice'
            elif document_info['aspect_ratio'] < 0.8:
                document_info['document_type'] = 'receipt'
            else:
                document_info['document_type'] = 'document'
        
        return document_info
    
    def extract_table_structure(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Extract table structure from document"""
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Detect horizontal and vertical lines
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
        
        horizontal_lines = cv2.morphologyEx(gray, cv2.MORPH_OPEN, horizontal_kernel)
        vertical_lines = cv2.morphologyEx(gray, cv2.MORPH_OPEN, vertical_kernel)
        
        # Combine lines
        table_structure = cv2.addWeighted(horizontal_lines, 0.5, vertical_lines, 0.5, 0.0)
        
        # Find contours (table cells)
        contours, _ = cv2.findContours(table_structure, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        table_cells = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            
            # Filter small contours
            if w > 20 and h > 10:
                cell = {
                    'bbox': (x, y, w, h),
                    'area': cv2.contourArea(contour),
                    'aspect_ratio': w / h if h > 0 else 0
                }
                table_cells.append(cell)
        
        return table_cells
    
    def extract_form_fields(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Extract form fields from document"""
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Detect checkboxes
        checkbox_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        checkboxes = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, checkbox_kernel)
        
        # Detect text fields
        text_field_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (100, 20))
        text_fields = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, text_field_kernel)
        
        # Find contours for checkboxes
        checkbox_contours, _ = cv2.findContours(checkboxes, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        checkbox_fields = []
        
        for contour in checkbox_contours:
            x, y, w, h = cv2.boundingRect(contour)
            if 15 <= w <= 30 and 15 <= h <= 30:  # Typical checkbox size
                checkbox_fields.append({
                    'type': 'checkbox',
                    'bbox': (x, y, w, h),
                    'checked': False  # Would need more sophisticated detection
                })
        
        # Find contours for text fields
        text_field_contours, _ = cv2.findContours(text_fields, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        text_fields = []
        
        for contour in text_field_contours:
            x, y, w, h = cv2.boundingRect(contour)
            if w > 50 and h > 15:  # Minimum field size
                text_fields.append({
                    'type': 'text_field',
                    'bbox': (x, y, w, h),
                    'aspect_ratio': w / h if h > 0 else 0
                })
        
        return checkbox_fields + text_fields


class ImageQualityAssessment:
    """Image quality assessment service"""
    
    def __init__(self):
        pass
    
    def assess_sharpness(self, image: np.ndarray) -> float:
        """Assess image sharpness using Laplacian variance"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        sharpness = laplacian.var()
        return sharpness
    
    def assess_contrast(self, image: np.ndarray) -> float:
        """Assess image contrast"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        contrast = gray.std()
        return contrast
    
    def assess_brightness(self, image: np.ndarray) -> float:
        """Assess image brightness"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        brightness = gray.mean()
        return brightness
    
    def assess_noise(self, image: np.ndarray) -> float:
        """Assess image noise level"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Estimate noise using high-frequency content
        kernel = np.array([[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]])
        filtered = cv2.filter2D(gray, -1, kernel)
        noise = np.std(filtered)
        
        return noise
    
    def assess_overall_quality(self, image: np.ndarray) -> ImageQualityMetrics:
        """Assess overall image quality"""
        h, w = image.shape[:2]
        
        # Calculate individual metrics
        sharpness = self.assess_sharpness(image)
        contrast = self.assess_contrast(image)
        brightness = self.assess_brightness(image)
        noise = self.assess_noise(image)
        
        # Calculate overall quality score (0-100)
        # Normalize metrics and combine
        sharpness_score = min(sharpness / 100, 1.0) * 100
        contrast_score = min(contrast / 127, 1.0) * 100
        brightness_score = 100 - abs(brightness - 128) / 128 * 100
        noise_score = max(0, 100 - noise / 50 * 100)
        
        overall_quality = (sharpness_score + contrast_score + brightness_score + noise_score) / 4
        
        return ImageQualityMetrics(
            sharpness=sharpness,
            contrast=contrast,
            brightness=brightness,
            noise_level=noise,
            resolution=(w, h),
            file_size_bytes=0,  # Would need file info
            overall_quality=overall_quality
        )


class ComputerVisionService:
    """Main computer vision service"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.preprocessor = ImagePreprocessor()
        self.text_detector = TextDetector()
        self.document_analyzer = DocumentAnalyzer()
        self.quality_assessor = ImageQualityAssessment()
        
    def process_image_for_ocr(self, image_path: str, enhancement_level: str = 'medium') -> Dict[str, Any]:
        """Process image for optimal OCR results"""
        start_time = datetime.utcnow()
        
        # Load image
        image = self.preprocessor.load_image(image_path)
        if image is None:
            return {'error': 'Failed to load image'}
        
        # Apply preprocessing based on enhancement level
        if enhancement_level == 'low':
            processed = self.preprocessor.convert_to_grayscale(image)
        elif enhancement_level == 'medium':
            processed = self.preprocessor.preprocess_for_ocr(image)
        elif enhancement_level == 'high':
            # Apply additional enhancements
            processed = self.preprocessor.preprocess_for_ocr(image)
            processed = self.preprocessor.sharpen_image(processed)
            processed = self.preprocessor.enhance_contrast(processed, 1.2, 10)
        else:
            processed = image
        
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return {
            'original_image_path': image_path,
            'processed_image': processed,
            'enhancement_level': enhancement_level,
            'processing_time_ms': processing_time,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def extract_text_with_confidence(self, image_path: str, language: str = 'tur', method: str = 'ensemble') -> Dict[str, Any]:
        """Extract text with confidence scores"""
        start_time = datetime.utcnow()
        
        # Load and preprocess image
        image = self.preprocessor.load_image(image_path)
        if image is None:
            return {'error': 'Failed to load image'}
        
        processed_image = self.preprocessor.preprocess_for_ocr(image)
        
        # Extract text
        if method == 'tesseract':
            text_regions = self.text_detector.detect_text_tesseract(processed_image, language)
        elif method == 'easyocr':
            text_regions = self.text_detector.detect_text_easyocr(processed_image)
        else:
            text_regions = self.text_detector.detect_text_ensemble(processed_image, language)
        
        # Extract structured data
        structured_data = self.text_detector.extract_structured_data(text_regions)
        
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        # Calculate overall confidence
        if text_regions:
            overall_confidence = np.mean([region.confidence for region in text_regions])
        else:
            overall_confidence = 0.0
        
        return {
            'image_path': image_path,
            'language': language,
            'method': method,
            'text_regions': [
                {
                    'text': region.text,
                    'bbox': region.bbox,
                    'confidence': region.confidence,
                    'language': region.language,
                    'angle': region.angle
                }
                for region in text_regions
            ],
            'structured_data': structured_data,
            'overall_confidence': overall_confidence,
            'processing_time_ms': processing_time,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def analyze_document(self, image_path: str) -> Dict[str, Any]:
        """Analyze document structure and content"""
        start_time = datetime.utcnow()
        
        # Load image
        image = self.preprocessor.load_image(image_path)
        if image is None:
            return {'error': 'Failed to load image'}
        
        # Analyze document type
        document_info = self.document_analyzer.analyze_document_type(image)
        
        # Extract table structure
        table_structure = self.document_analyzer.extract_table_structure(image)
        
        # Extract form fields
        form_fields = self.document_analyzer.extract_form_fields(image)
        
        # Extract text
        text_result = self.extract_text_with_confidence(image_path)
        
        # Assess image quality
        quality_metrics = self.quality_assessor.assess_overall_quality(image)
        
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return {
            'image_path': image_path,
            'document_info': document_info,
            'table_structure': table_structure,
            'form_fields': form_fields,
            'text_extraction': text_result,
            'quality_metrics': {
                'sharpness': quality_metrics.sharpness,
                'contrast': quality_metrics.contrast,
                'brightness': quality_metrics.brightness,
                'noise_level': quality_metrics.noise_level,
                'resolution': quality_metrics.resolution,
                'overall_quality': quality_metrics.overall_quality
            },
            'processing_time_ms': processing_time,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def batch_process_images(self, image_paths: List[str], processing_type: str = 'ocr') -> List[Dict[str, Any]]:
        """Process multiple images in batch"""
        results = []
        
        for image_path in image_paths:
            try:
                if processing_type == 'ocr':
                    result = self.extract_text_with_confidence(image_path)
                elif processing_type == 'document_analysis':
                    result = self.analyze_document(image_path)
                elif processing_type == 'quality_assessment':
                    image = self.preprocessor.load_image(image_path)
                    if image:
                        quality_metrics = self.quality_assessor.assess_overall_quality(image)
                        result = {
                            'image_path': image_path,
                            'quality_metrics': {
                                'sharpness': quality_metrics.sharpness,
                                'contrast': quality_metrics.contrast,
                                'brightness': quality_metrics.brightness,
                                'noise_level': quality_metrics.noise_level,
                                'resolution': quality_metrics.resolution,
                                'overall_quality': quality_metrics.overall_quality
                            },
                            'timestamp': datetime.utcnow().isoformat()
                        }
                    else:
                        result = {'error': 'Failed to load image'}
                else:
                    result = {'error': f'Unknown processing type: {processing_type}'}
                
                results.append(result)
                
            except Exception as e:
                logger.error(f"Batch processing error for {image_path}: {e}")
                results.append({
                    'image_path': image_path,
                    'error': str(e),
                    'timestamp': datetime.utcnow().isoformat()
                })
        
        return results


# Global computer vision service instance
computer_vision_service = ComputerVisionService()

# Export functions
def process_image_for_ocr(image_path: str, enhancement_level: str = 'medium') -> Dict[str, Any]:
    """Process image for optimal OCR results"""
    return computer_vision_service.process_image_for_ocr(image_path, enhancement_level)

def extract_text_with_confidence(image_path: str, language: str = 'tur', method: str = 'ensemble') -> Dict[str, Any]:
    """Extract text with confidence scores"""
    return computer_vision_service.extract_text_with_confidence(image_path, language, method)

def analyze_document(image_path: str) -> Dict[str, Any]:
    """Analyze document structure and content"""
    return computer_vision_service.analyze_document(image_path)

def batch_process_images(image_paths: List[str], processing_type: str = 'ocr') -> List[Dict[str, Any]]:
    """Process multiple images in batch"""
    return computer_vision_service.batch_process_images(image_paths, processing_type)

# Export all components
__all__ = [
    'ImageProcessingType',
    'ImageFormat',
    'ImageProcessingResult',
    'TextRegion',
    'ImageQualityMetrics',
    'ImagePreprocessor',
    'TextDetector',
    'DocumentAnalyzer',
    'ImageQualityAssessment',
    'ComputerVisionService',
    'process_image_for_ocr',
    'extract_text_with_confidence',
    'analyze_document',
    'batch_process_images',
    'computer_vision_service',
]
