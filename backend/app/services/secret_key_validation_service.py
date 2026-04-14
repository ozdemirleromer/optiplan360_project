"""
Phase 1 Intake Security: Secret Key Validation Service
OPTIPLAN_SECRET_KEY minimum 32 karakter validation
"""

import os
import sys
import secrets
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class SecretKeyValidationService:
    """Phase 1 Intake için secret key validation servisi"""
    
    MIN_KEY_LENGTH = 32
    
    def validate_secret_key(self) -> Dict[str, Any]:
        """
        OPTIPLAN_SECRET_KEY validation
        
        Returns:
            Dict: Validation sonucu
            
        Raises:
            SystemExit: Production ortamında invalid key
        """
        raw_key = os.environ.get("OPTIPLAN_SECRET_KEY", "").strip()
        env = os.environ.get("OPTIPLAN_ENV", "development").lower()
        
        validation_result = {
            "valid": False,
            "key_length": len(raw_key),
            "environment": env,
            "is_production": env == "production",
            "issues": [],
            "recommendations": []
        }
        
        # Production ortamı kontrolü
        if env == "production":
            if not raw_key:
                validation_result["issues"].append("OPTIPLAN_SECRET_KEY environment variable is required in production")
                logger.error("SECURITY: OPTIPLAN_SECRET_KEY required in production")
                sys.exit("[FATAL] OPTIPLAN_SECRET_KEY environment variable is required in production. Application stopped.")
            
            if len(raw_key) < self.MIN_KEY_LENGTH:
                validation_result["issues"].append(f"OPTIPLAN_SECRET_KEY must be at least {self.MIN_KEY_LENGTH} characters in production")
                logger.error(f"SECURITY: OPTIPLAN_SECRET_KEY too short ({len(raw_key)} < {self.MIN_KEY_LENGTH})")
                sys.exit(f"[FATAL] OPTIPLAN_SECRET_KEY too short ({len(raw_key)} < {self.MIN_KEY_LENGTH} characters). Application stopped.")
        
        # Development ortamı kontrolü
        if not raw_key:
            validation_result["issues"].append("OPTIPLAN_SECRET_KEY not set, using temporary key")
            validation_result["recommendations"].append("Set OPTIPLAN_SECRET_KEY in production")
            logger.warning("SECURITY: OPTIPLAN_SECRET_KEY not set, using temporary key")
            validation_result["valid"] = False
            return validation_result
        
        if len(raw_key) < self.MIN_KEY_LENGTH:
            validation_result["issues"].append(f"Secret key too short ({len(raw_key)} < {self.MIN_KEY_LENGTH})")
            validation_result["recommendations"].append(f"Use at least {self.MIN_KEY_LENGTH} characters")
            logger.warning(f"SECURITY: Secret key too short ({len(raw_key)} < {self.MIN_KEY_LENGTH})")
            validation_result["valid"] = False
            return validation_result
        
        # Key quality check
        quality_issues = self._check_key_quality(raw_key)
        if quality_issues:
            validation_result["issues"].extend(quality_issues)
            validation_result["recommendations"].append("Use more complex key with mixed characters")
        
        # Eğer production'da ve tüm kontroller geçtiyse
        if env == "production" and len(raw_key) >= self.MIN_KEY_LENGTH:
            validation_result["valid"] = True
            logger.info("SECURITY: OPTIPLAN_SECRET_KEY validation passed for production")
        # Eğer development'da ve minimum uzunlukta ise
        elif env != "production" and len(raw_key) >= self.MIN_KEY_LENGTH:
            validation_result["valid"] = True
            logger.info("SECURITY: OPTIPLAN_SECRET_KEY validation passed for development")
        
        return validation_result
    
    def _check_key_quality(self, key: str) -> list:
        """Secret key quality kontrolü"""
        issues = []
        
        # Character variety check
        has_upper = any(c.isupper() for c in key)
        has_lower = any(c.islower() for c in key)
        has_digit = any(c.isdigit() for c in key)
        has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in key)
        
        if not has_upper:
            issues.append("No uppercase characters")
        if not has_lower:
            issues.append("No lowercase characters")
        if not has_digit:
            issues.append("No numeric characters")
        if not has_special:
            issues.append("No special characters")
        
        # Common patterns check
        common_patterns = ["password", "secret", "key", "admin", "test", "demo"]
        key_lower = key.lower()
        for pattern in common_patterns:
            if pattern in key_lower:
                issues.append(f"Contains common pattern: {pattern}")
                break
        
        return issues
    
    def generate_secure_key(self, length: int = 64) -> str:
        """
        Güvenli secret key üretimi
        
        Args:
            length: Key uzunluğu (default 64)
            
        Returns:
            str: Hex formatında güvenli key
        """
        return secrets.token_hex(length)
    
    def get_security_status(self) -> Dict[str, Any]:
        """
        Complete security status
        
        Returns:
            Dict: Security durumu
        """
        validation = self.validate_secret_key()
        
        return {
            "secret_key_status": validation,
            "security_level": "HIGH" if validation["valid"] and not validation["issues"] else "MEDIUM" if validation["valid"] else "LOW",
            "phase_1_intake_ready": validation["valid"],
            "production_safe": validation["valid"] and validation["is_production"]
        }


# Global instance
secret_key_validator = SecretKeyValidationService()
