"""
Phase 1 Intake Security: Password Change Service
Default password zorunlu değişim sistemi
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, hash_password
from app.database import get_db
from app.exceptions import AuthenticationError, ValidationError
from app.models.core import User

logger = logging.getLogger(__name__)


class PasswordChangeService:
    """Phase 1 Intake için password değişim servisi"""
    
    def __init__(self, db: Session = Depends(get_db)):
        self.db = db
    
    def change_password(
        self,
        current_user: User,
        current_password: str,
        new_password: str,
        confirm_password: str
    ) -> dict:
        """
        Kullanıcı password değişimi
        
        Args:
            current_user: Mevcut kullanıcı
            current_password: Mevcut password
            new_password: Yeni password
            confirm_password: Password onayı
            
        Returns:
            dict: İşlem sonucu
            
        Raises:
            ValidationError: Validasyon hataları
            AuthenticationError: Authentication hataları
        """
        
        # Validasyonlar
        self._validate_password_change(
            current_password, new_password, confirm_password
        )
        
        # Mevcut password kontrolü
        if not self._verify_current_password(current_user, current_password):
            raise AuthenticationError("Mevcut şifre hatalı")
        
        # Password güncelleme
        self._update_user_password(current_user, new_password)
        
        logger.info(f"User {current_user.username} password changed successfully")
        
        return {
            "success": True,
            "message": "Şifre başarıyla değiştirildi",
            "changed_at": datetime.now(timezone.utc).isoformat()
        }
    
    def force_password_change_if_default(self, user: User) -> bool:
        """
        Eğer kullanıcı default password kullanıyorsa değişim zorla
        
        Args:
            user: Kullanıcı nesnesi
            
        Returns:
            bool: Password değişimi gerekli mi?
        """
        return user.is_default_password
    
    def _validate_password_change(
        self, 
        current_password: str, 
        new_password: str, 
        confirm_password: str
    ) -> None:
        """Password değişim validasyonları"""
        
        if not current_password:
            raise ValidationError("Mevcut şifre boş bırakılamaz")
        
        if not new_password:
            raise ValidationError("Yeni şifre boş bırakılamaz")
        
        if new_password != confirm_password:
            raise ValidationError("Yeni şifreler eşleşmiyor")
        
        if len(new_password) < 8:
            raise ValidationError("Yeni şifre en az 8 karakter olmalıdır")
        
        if new_password == current_password:
            raise ValidationError("Yeni şifre mevcut şifreden farklı olmalıdır")
    
    def _verify_current_password(self, user: User, current_password: str) -> bool:
        """Mevcut password doğrulaması"""
        # Hash fonksiyonu auth.py'den import edildi
        return hash_password(current_password) == user.password_hash
    
    def _update_user_password(self, user: User, new_password: str) -> None:
        """Kullanıcı password güncelleme"""
        user.password_hash = hash_password(new_password)
        user.password_changed_at = datetime.now(timezone.utc)
        user.is_default_password = False
        
        self.db.commit()
        self.db.refresh(user)


# Dependency injection
def get_password_service(db: Session = Depends(get_db)) -> PasswordChangeService:
    """Password servisi dependency"""
    return PasswordChangeService(db)
