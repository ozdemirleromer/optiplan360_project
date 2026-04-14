"""
Phase 2 OCR: Duplicate Detection ve Dosya Hash Kontrolü
OCR belgelerinde duplicate detection ve hash-based deduplication
"""

import hashlib
import logging
from typing import Dict, Any, Optional, Set
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class FileHash:
    """Dosya hash bilgisi"""
    md5: str
    sha256: str
    file_size: int
    file_name: str
    created_at: datetime = field(default_factory=datetime.utcnow)


class DuplicateDetectionService:
    """Duplicate detection servisi"""
    
    def __init__(self):
        # Hash -> Document ID mapping
        self._hash_index: Dict[str, str] = {}
        # Document ID -> FileHash mapping
        self._document_hashes: Dict[str, FileHash] = {}
        # Force duplicate izni verilen hash'ler
        self._force_allowed: Set[str] = set()
    
    def calculate_file_hash(self, file_path: str) -> FileHash:
        """
        Dosya hash'lerini hesapla
        
        Args:
            file_path: Dosya yolu
            
        Returns:
            FileHash: Hash bilgileri
        """
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # MD5 hash
        md5_hash = hashlib.md5()
        # SHA256 hash
        sha256_hash = hashlib.sha256()
        
        # Dosyayı chunk'lar halinde oku (büyük dosyalar için)
        with open(path, 'rb') as f:
            while chunk := f.read(8192):
                md5_hash.update(chunk)
                sha256_hash.update(chunk)
        
        return FileHash(
            md5=md5_hash.hexdigest(),
            sha256=sha256_hash.hexdigest(),
            file_size=path.stat().st_size,
            file_name=path.name
        )
    
    def calculate_bytes_hash(self, data: bytes) -> FileHash:
        """
        Bytes verisi için hash hesapla
        
        Args:
            data: Bytes verisi
            
        Returns:
            FileHash: Hash bilgileri
        """
        return FileHash(
            md5=hashlib.md5(data).hexdigest(),
            sha256=hashlib.sha256(data).hexdigest(),
            file_size=len(data),
            file_name="memory_buffer"
        )
    
    def check_duplicate(self, file_hash: FileHash, force_duplicate: bool = False) -> Dict[str, Any]:
        """
        Dosyanın duplicate olup olmadığını kontrol et
        
        Args:
            file_hash: Dosya hash bilgisi
            force_duplicate: Force duplicate flag
            
        Returns:
            Dict: Kontrol sonucu
        """
        primary_hash = file_hash.sha256
        
        # Force duplicate kontrolü
        if force_duplicate and primary_hash in self._force_allowed:
            return {
                "is_duplicate": False,
                "action": "force_duplicate_allowed",
                "hash": primary_hash,
                "audit_note_required": True
            }
        
        # Hash index kontrolü
        if primary_hash in self._hash_index:
            existing_doc_id = self._hash_index[primary_hash]
            
            return {
                "is_duplicate": True,
                "action": "reject",
                "hash": primary_hash,
                "existing_document_id": existing_doc_id,
                "message": "Duplicate document detected"
            }
        
        # Duplicate değil
        return {
            "is_duplicate": False,
            "action": "accept",
            "hash": primary_hash
        }
    
    def register_document(self, document_id: str, file_hash: FileHash) -> bool:
        """
        Yeni dokümanı hash index'e kaydet
        
        Args:
            document_id: Doküman ID
            file_hash: Dosya hash bilgisi
            
        Returns:
            bool: Başarılı mı
        """
        primary_hash = file_hash.sha256
        
        if primary_hash in self._hash_index:
            logger.warning(f"[DEDUP] Hash already exists: {primary_hash}")
            return False
        
        self._hash_index[primary_hash] = document_id
        self._document_hashes[document_id] = file_hash
        
        logger.info(f"[DEDUP] Document registered: {document_id}, hash: {primary_hash[:16]}...")
        return True
    
    def allow_force_duplicate(self, file_hash: str, reason: str, operator_id: str) -> bool:
        """
        Force duplicate izni ver
        
        Args:
            file_hash: Dosya hash'i
            reason: İzin nedeni
            operator_id: Operator ID
            
        Returns:
            bool: Başarılı mı
        """
        self._force_allowed.add(file_hash)
        
        # Audit log
        logger.info(f"[DEDUP] Force duplicate allowed for hash: {file_hash[:16]}... by {operator_id}, reason: {reason}")
        
        return True
    
    def get_duplicate_stats(self) -> Dict[str, Any]:
        """Duplicate istatistiklerini döndür"""
        return {
            "total_unique_hashes": len(self._hash_index),
            "total_documents": len(self._document_hashes),
            "force_allowed_count": len(self._force_allowed),
            "duplicate_detection_active": True
        }
    
    def find_similar_documents(self, file_hash: FileHash, similarity_threshold: float = 0.9) -> list:
        """
        Benzer dokümanları bul (ileri seviye: perceptual hashing)
        
        Args:
            file_hash: Dosya hash bilgisi
            similarity_threshold: Benzerlik eşiği
            
        Returns:
            list: Benzer dokümanlar listesi
        """
        # Şu an için exact match only
        # İleri seviye: perceptual hashing, image fingerprinting
        similar = []
        
        for doc_id, stored_hash in self._document_hashes.items():
            # Aynı hash
            if stored_hash.sha256 == file_hash.sha256:
                similar.append({
                    "document_id": doc_id,
                    "similarity": 1.0,
                    "match_type": "exact"
                })
        
        return similar


class OCRDeduplicationPipeline:
    """OCR Deduplication pipeline servisi"""
    
    def __init__(self):
        self.dedup_service = DuplicateDetectionService()
    
    def process_ocr_ingest(self, 
                          document_id: str,
                          file_path: str,
                          force_duplicate: bool = False,
                          operator_id: Optional[str] = None) -> Dict[str, Any]:
        """
        OCR ingest işlemini deduplication ile işle
        
        Args:
            document_id: Doküman ID
            file_path: Dosya yolu
            force_duplicate: Force duplicate flag
            operator_id: Operator ID (force duplicate için)
            
        Returns:
            Dict: İşlem sonucu
        """
        # Hash hesapla
        file_hash = self.dedup_service.calculate_file_hash(file_path)
        
        # Duplicate kontrolü
        dup_check = self.dedup_service.check_duplicate(file_hash, force_duplicate)
        
        if dup_check["is_duplicate"]:
            logger.warning(f"[OCR_DEDUP] Duplicate blocked: {document_id}, existing: {dup_check.get('existing_document_id')}")
            
            # KPI için duplicate raporla
            return {
                "success": False,
                "blocked": True,
                "reason": "duplicate",
                "document_id": document_id,
                "hash": file_hash.sha256,
                "duplicate_of": dup_check.get("existing_document_id"),
                "kpi_record": {
                    "event": "duplicate_blocked",
                    "file_hash": file_hash.sha256,
                    "file_size": file_hash.file_size
                }
            }
        
        # Force duplicate izni varsa audit notu oluştur
        if dup_check.get("audit_note_required"):
            logger.info(f"[OCR_DEDUP] Force duplicate with audit note: {document_id}")
        
        # Dokümanı kaydet
        registered = self.dedup_service.register_document(document_id, file_hash)
        
        if registered:
            return {
                "success": True,
                "document_id": document_id,
                "hash": file_hash.sha256,
                "file_size": file_hash.file_size,
                "action": "ingested"
            }
        else:
            return {
                "success": False,
                "error": "Failed to register document"
            }
    
    def process_ocr_ingest_bytes(self,
                                 document_id: str,
                                 file_data: bytes,
                                 file_name: str,
                                 force_duplicate: bool = False) -> Dict[str, Any]:
        """
        Bytes verisi için OCR ingest (memory'den)
        
        Args:
            document_id: Doküman ID
            file_data: Dosya bytes
            file_name: Dosya adı
            force_duplicate: Force duplicate flag
            
        Returns:
            Dict: İşlem sonucu
        """
        # Hash hesapla
        file_hash = self.dedup_service.calculate_bytes_hash(file_data)
        file_hash.file_name = file_name
        
        # Duplicate kontrolü
        dup_check = self.dedup_service.check_duplicate(file_hash, force_duplicate)
        
        if dup_check["is_duplicate"]:
            return {
                "success": False,
                "blocked": True,
                "reason": "duplicate",
                "document_id": document_id,
                "hash": file_hash.sha256,
                "kpi_record": {
                    "event": "duplicate_blocked",
                    "file_hash": file_hash.sha256,
                    "file_size": file_hash.file_size
                }
            }
        
        # Dokümanı kaydet
        registered = self.dedup_service.register_document(document_id, file_hash)
        
        return {
            "success": registered,
            "document_id": document_id,
            "hash": file_hash.sha256,
            "file_size": file_hash.file_size,
            "action": "ingested" if registered else "failed"
        }


# Global instance
_dedup_pipeline = None


def get_ocr_deduplication_pipeline() -> OCRDeduplicationPipeline:
    """OCR deduplication pipeline singleton"""
    global _dedup_pipeline
    if _dedup_pipeline is None:
        _dedup_pipeline = OCRDeduplicationPipeline()
    return _dedup_pipeline
