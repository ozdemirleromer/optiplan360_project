"""
Phase 1 Intake Security: Environment Variable Encryption Service
Hassas veriler için encryption/decryption servisi
"""

import os
import base64
import logging
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)


class EnvironmentEncryptionService:
    """Phase 1 Intake Security: Environment variable encryption/decryption"""
    
    def __init__(self):
        self._master_key = self._get_master_key()
        self._fernet = Fernet(self._master_key) if self._master_key else None
    
    def _get_master_key(self) -> Optional[bytes]:
        """Master encryption key al veya üret"""
        key_str = os.getenv("OPTIPLAN_MASTER_KEY", "").strip()
        
        if not key_str:
            logger.warning("[SECURITY] OPTIPLAN_MASTER_KEY not set. Using development key.")
            # Development için geçici key üret
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b"optiplan360_dev_salt",
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(b"development_key_2026"))
            return key
        
        try:
            # 32 byte key üret (Fernet 32 byte base64-encoded key gerektirir)
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b"optiplan360_prod_salt_v1",
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(key_str.encode()))
            return key
        except Exception as e:
            logger.error(f"[SECURITY] Master key generation failed: {e}")
            return None
    
    def encrypt_value(self, value: str) -> str:
        """
        Hassas değeri şifrele
        
        Args:
            value: Şifrelenecek değer
            
        Returns:
            str: Şifrelenmiş değer (base64)
        """
        if not self._fernet:
            raise RuntimeError("Encryption service not initialized")
        
        try:
            encrypted = self._fernet.encrypt(value.encode())
            return base64.urlsafe_b64encode(encrypted).decode()
        except Exception as e:
            logger.error(f"[SECURITY] Encryption failed: {e}")
            raise
    
    def decrypt_value(self, encrypted_value: str) -> str:
        """
        Şifrelenmiş değeri çöz
        
        Args:
            encrypted_value: Şifrelenmiş değer (base64)
            
        Returns:
            str: Çözülmüş değer
        """
        if not self._fernet:
            raise RuntimeError("Encryption service not initialized")
        
        try:
            # Base64 decode
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_value.encode())
            decrypted = self._fernet.decrypt(encrypted_bytes)
            return decrypted.decode()
        except Exception as e:
            logger.error(f"[SECURITY] Decryption failed: {e}")
            raise
    
    def get_encrypted_env(self, key: str, default: Optional[str] = None) -> str:
        """
        Şifrelenmiş environment variable al
        
        Args:
            key: Environment variable adı
            default: Varsayılan değer
            
        Returns:
            str: Çözülmüş değer
        """
        encrypted_value = os.getenv(key, "").strip()
        
        if not encrypted_value:
            if default is not None:
                return default
            raise KeyError(f"Environment variable {key} not set")
        
        # Eğer değer şifrelenmemişse direkt döndür
        if not encrypted_value.startswith("ENC:"):
            return encrypted_value
        
        # Şifrelenmiş değeri çöz (ENC: prefix'ini kaldır)
        return self.decrypt_value(encrypted_value[4:])
    
    def rotate_key(self, new_master_key: str) -> Dict[str, Any]:
        """
        Master key rotation
        
        Args:
            new_master_key: Yeni master key
            
        Returns:
            Dict: Rotation sonucu
        """
        try:
            # Yeni key üret
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b"optiplan360_prod_salt_v1",
                iterations=100000,
            )
            new_key = base64.urlsafe_b64encode(kdf.derive(new_master_key.encode()))
            
            return {
                "success": True,
                "new_key_fingerprint": new_key[:16].decode() + "...",
                "message": "Key rotation completed. Update OPTIPLAN_MASTER_KEY env var."
            }
        except Exception as e:
            logger.error(f"[SECURITY] Key rotation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def is_encrypted(self, value: str) -> bool:
        """Değerin şifrelenip şifrelenmediğini kontrol et"""
        return value.startswith("ENC:")


# Global instance
_env_encryption_service = None


def get_env_encryption_service() -> EnvironmentEncryptionService:
    """Environment encryption servisi singleton"""
    global _env_encryption_service
    
    if _env_encryption_service is None:
        _env_encryption_service = EnvironmentEncryptionService()
    
    return _env_encryption_service


# Kullanım için kolay fonksiyonlar
def get_encrypted_env(key: str, default: Optional[str] = None) -> str:
    """Şifrelenmiş environment variable al"""
    service = get_env_encryption_service()
    return service.get_encrypted_env(key, default)


def encrypt_env_value(value: str) -> str:
    """Environment variable değerini şifrele"""
    service = get_env_encryption_service()
    encrypted = service.encrypt_value(value)
    return f"ENC:{encrypted}"
