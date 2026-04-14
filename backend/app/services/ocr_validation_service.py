"""
Phase 2 OCR: Confidence Validation ve Operator Onay Sistemi
OCR sonuçlarının confidence skorlarına göre validasyon ve operator müdahalesi
"""

import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ConfidenceLevel(Enum):
    """Confidence seviyeleri"""
    HIGH = "high"      # >= 80%
    MEDIUM = "medium"  # 60-79%
    LOW = "low"        # < 60%


class OCRStatus(Enum):
    """OCR işlem durumları"""
    AUTO_APPROVED = "auto_approved"
    PENDING_REVIEW = "pending_review"
    REJECTED = "rejected"
    REQUIRES_MANUAL_ENTRY = "requires_manual_entry"


@dataclass
class OCRLineResult:
    """OCR satır sonucu"""
    line_id: str
    text: str
    confidence: float
    bounding_box: Dict[str, int]
    extracted_fields: Dict[str, Any]


@dataclass
class OCRDocumentResult:
    """OCR doküman sonucu"""
    document_id: str
    filename: str
    lines: List[OCRLineResult]
    overall_confidence: float
    status: OCRStatus
    requires_operator: bool


class OCRConfidenceValidator:
    """OCR confidence validasyon servisi"""
    
    # Phase 2 OCR Politikası
    THRESHOLDS = {
        "auto_approve": 80.0,      # >= 80: otomatik onay
        "operator_review": 60.0,    # 60-79: operator onayı zorunlu
        "reject": 0.0              # < 60: varsayılan review_required
    }
    
    def validate_document(self, lines: List[Dict[str, Any]]) -> OCRDocumentResult:
        """
        OCR dokümanını validasyon kurallarına göre işle
        
        Args:
            lines: OCR satırları (dict listesi)
            
        Returns:
            OCRDocumentResult: Validasyon sonucu
        """
        ocr_lines = []
        total_confidence = 0.0
        
        for idx, line in enumerate(lines):
            confidence = line.get("confidence", 0.0)
            ocr_line = OCRLineResult(
                line_id=f"line_{idx}",
                text=line.get("text", ""),
                confidence=confidence,
                bounding_box=line.get("bbox", {}),
                extracted_fields=line.get("fields", {})
            )
            ocr_lines.append(ocr_line)
            total_confidence += confidence
        
        # Ortalama confidence hesapla
        avg_confidence = total_confidence / len(lines) if lines else 0.0
        
        # Durum belirle
        status, requires_operator = self._determine_status(avg_confidence)
        
        return OCRDocumentResult(
            document_id="",
            filename="",
            lines=ocr_lines,
            overall_confidence=avg_confidence,
            status=status,
            requires_operator=requires_operator
        )
    
    def _determine_status(self, confidence: float) -> tuple:
        """Confidence skoruna göre durum belirle"""
        if confidence >= self.THRESHOLDS["auto_approve"]:
            return OCRStatus.AUTO_APPROVED, False
        elif confidence >= self.THRESHOLDS["operator_review"]:
            return OCRStatus.PENDING_REVIEW, True
        else:
            return OCRStatus.REQUIRES_MANUAL_ENTRY, True
    
    def get_confidence_level(self, confidence: float) -> ConfidenceLevel:
        """Confidence skorundan seviye belirle"""
        if confidence >= 80.0:
            return ConfidenceLevel.HIGH
        elif confidence >= 60.0:
            return ConfidenceLevel.MEDIUM
        else:
            return ConfidenceLevel.LOW
    
    def validate_line_fields(self, line: OCRLineResult, expected_fields: List[str]) -> Dict[str, Any]:
        """
        Satır içindeki alanları validasyon kurallarına göre kontrol et
        
        Args:
            line: OCR satır sonucu
            expected_fields: Beklenen alan isimleri
            
        Returns:
            Dict: Validasyon sonuçları
        """
        field_results = {}
        
        for field_name in expected_fields:
            field_value = line.extracted_fields.get(field_name)
            field_confidence = line.extracted_fields.get(f"{field_name}_confidence", 0.0)
            
            if field_value is None:
                field_results[field_name] = {
                    "valid": False,
                    "error": "Field not found",
                    "requires_manual": True
                }
            elif field_confidence < self.THRESHOLDS["operator_review"]:
                field_results[field_name] = {
                    "valid": False,
                    "value": field_value,
                    "confidence": field_confidence,
                    "error": "Low confidence",
                    "requires_manual": True
                }
            else:
                field_results[field_name] = {
                    "valid": True,
                    "value": field_value,
                    "confidence": field_confidence
                }
        
        return field_results


class OPROperatorApprovalService:
    """OCR Operator onay servisi"""
    
    def __init__(self):
        self.pending_reviews: Dict[str, OCRDocumentResult] = {}
        self.approval_history: List[Dict[str, Any]] = []
    
    def submit_for_review(self, document: OCRDocumentResult) -> str:
        """
        Dokümanı operator review kuyruğuna ekle
        
        Args:
            document: OCR doküman sonucu
            
        Returns:
            str: Review ID
        """
        import uuid
        review_id = str(uuid.uuid4())
        
        self.pending_reviews[review_id] = document
        
        logger.info(f"[OCR] Document submitted for operator review: {review_id}")
        
        return review_id
    
    def get_pending_reviews(self) -> List[Dict[str, Any]]:
        """Bekleyen review'ları listele"""
        return [
            {
                "review_id": rid,
                "document_id": doc.document_id,
                "filename": doc.filename,
                "overall_confidence": doc.overall_confidence,
                "line_count": len(doc.lines),
                "low_confidence_lines": len([
                    l for l in doc.lines 
                    if l.confidence < OCRConfidenceValidator.THRESHOLDS["auto_approve"]
                ])
            }
            for rid, doc in self.pending_reviews.items()
        ]
    
    def approve_document(self, review_id: str, operator_id: str, corrections: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Operator dokümanı onayla
        
        Args:
            review_id: Review ID
            operator_id: Operator ID
            corrections: Düzeltmeler (opsiyonel)
            
        Returns:
            Dict: Onay sonucu
        """
        if review_id not in self.pending_reviews:
            return {"success": False, "error": "Review not found"}
        
        document = self.pending_reviews.pop(review_id)
        
        # Audit log
        approval_record = {
            "review_id": review_id,
            "document_id": document.document_id,
            "operator_id": operator_id,
            "action": "approved",
            "original_confidence": document.overall_confidence,
            "corrections": corrections or {},
            "timestamp": None  # Will be set
        }
        self.approval_history.append(approval_record)
        
        logger.info(f"[OCR] Document approved by operator {operator_id}: {review_id}")
        
        return {
            "success": True,
            "document_id": document.document_id,
            "approved_by": operator_id
        }
    
    def reject_document(self, review_id: str, operator_id: str, reason: str) -> Dict[str, Any]:
        """
        Operator dokümanı reddet
        
        Args:
            review_id: Review ID
            operator_id: Operator ID
            reason: Reddetme nedeni
            
        Returns:
            Dict: Reddetme sonucu
        """
        if review_id not in self.pending_reviews:
            return {"success": False, "error": "Review not found"}
        
        document = self.pending_reviews.pop(review_id)
        
        # Audit log
        rejection_record = {
            "review_id": review_id,
            "document_id": document.document_id,
            "operator_id": operator_id,
            "action": "rejected",
            "reason": reason,
            "timestamp": None  # Will be set
        }
        self.approval_history.append(rejection_record)
        
        logger.info(f"[OCR] Document rejected by operator {operator_id}: {review_id}, reason: {reason}")
        
        return {
            "success": True,
            "document_id": document.document_id,
            "rejected_by": operator_id,
            "reason": reason
        }


class OCRPipelineService:
    """OCR Pipeline servisi - Phase 2 OCR akışı"""
    
    def __init__(self):
        self.validator = OCRConfidenceValidator()
        self.operator_service = OPROperatorApprovalService()
    
    def process_document(self, ocr_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        OCR dokümanını Phase 2 OCR kurallarına göre işle
        
        Args:
            ocr_data: OCR sonuç verisi
            
        Returns:
            Dict: İşlem sonucu
        """
        lines = ocr_data.get("lines", [])
        
        # Validasyon
        result = self.validator.validate_document(lines)
        result.document_id = ocr_data.get("document_id", "")
        result.filename = ocr_data.get("filename", "")
        
        # Duruma göre işlem
        if result.status == OCRStatus.AUTO_APPROVED:
            # Otomatik onay - Phase 3'e ilerle
            return {
                "success": True,
                "action": "auto_approved",
                "document_id": result.document_id,
                "confidence": result.overall_confidence,
                "next_phase": "phase_3_preparation"
            }
        
        elif result.status == OCRStatus.PENDING_REVIEW:
            # Operator onayı gerekiyor
            review_id = self.operator_service.submit_for_review(result)
            
            return {
                "success": True,
                "action": "pending_operator_review",
                "review_id": review_id,
                "document_id": result.document_id,
                "confidence": result.overall_confidence,
                "requires_operator": True
            }
        
        else:
            # Çok düşük confidence - manuel giriş
            return {
                "success": False,
                "action": "requires_manual_entry",
                "document_id": result.document_id,
                "confidence": result.overall_confidence,
                "reason": "Confidence too low for automatic processing",
                "requires_operator": True
            }


# Global instances
_ocr_validator = None
_ocr_operator_service = None
_ocr_pipeline = None


def get_ocr_validator() -> OCRConfidenceValidator:
    """OCR validator singleton"""
    global _ocr_validator
    if _ocr_validator is None:
        _ocr_validator = OCRConfidenceValidator()
    return _ocr_validator


def get_ocr_operator_service() -> OPROperatorApprovalService:
    """OCR operator service singleton"""
    global _ocr_operator_service
    if _ocr_operator_service is None:
        _ocr_operator_service = OPROperatorApprovalService()
    return _ocr_operator_service


def get_ocr_pipeline() -> OCRPipelineService:
    """OCR pipeline singleton"""
    global _ocr_pipeline
    if _ocr_pipeline is None:
        _ocr_pipeline = OCRPipelineService()
    return _ocr_pipeline
