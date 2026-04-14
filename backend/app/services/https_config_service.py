"""
Production HTTPS/TLS Configuration Service
SSL/TLS sertifika yönetimi ve HTTPS kurulumu
"""

import os
import ssl
import logging
from typing import Optional, Dict, Any, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)


class HTTPSConfigService:
    """Production HTTPS/TLS configuration service"""
    
    def __init__(self):
        self.cert_dir = Path("certs")
        self.cert_file = self.cert_dir / "certificate.pem"
        self.key_file = self.cert_dir / "private-key.pem"
        self._ssl_context: Optional[ssl.SSLContext] = None
    
    def setup_https(self, app, host: str = "0.0.0.0", port: int = 8443):
        """
        HTTPS server kurulumu
        
        Args:
            app: FastAPI uygulaması
            host: Host adresi
            port: HTTPS portu
        """
        import uvicorn
        
        ssl_context = self.get_ssl_context()
        
        if ssl_context:
            logger.info(f"[HTTPS] Starting HTTPS server on {host}:{port}")
            uvicorn.run(
                app,
                host=host,
                port=port,
                ssl_keyfile=str(self.key_file) if self.key_file.exists() else None,
                ssl_certfile=str(self.cert_file) if self.cert_file.exists() else None,
            )
        else:
            logger.warning("[HTTPS] SSL context not available, starting HTTP server")
            uvicorn.run(app, host=host, port=port)
    
    def get_ssl_context(self) -> Optional[ssl.SSLContext]:
        """SSL context oluştur veya mevcut olanı döndür"""
        if self._ssl_context:
            return self._ssl_context
        
        if not self.cert_file.exists() or not self.key_file.exists():
            logger.warning("[HTTPS] SSL certificates not found. Generate with: make certs")
            return None
        
        try:
            context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
            context.load_cert_chain(
                certfile=str(self.cert_file),
                keyfile=str(self.key_file)
            )
            
            # Güvenlik ayarları
            context.minimum_version = ssl.TLSVersion.TLSv1_2
            context.set_ciphers('ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS')
            
            self._ssl_context = context
            logger.info("[HTTPS] SSL context initialized successfully")
            return context
            
        except Exception as e:
            logger.error(f"[HTTPS] SSL context creation failed: {e}")
            return None
    
    def generate_self_signed_cert(self, hostname: str = "localhost", days: int = 365) -> Dict[str, Any]:
        """
        Self-signed sertifika üret
        
        Args:
            hostname: Sertifika hostname
            days: Geçerlilik süresi (gün)
            
        Returns:
            Dict: Sertifika bilgileri
        """
        try:
            from cryptography import x509
            from cryptography.x509.oid import NameOID
            from cryptography.hazmat.primitives import hashes, serialization
            from cryptography.hazmat.primitives.asymmetric import rsa
            from datetime import datetime, timedelta
            
            # Private key üret
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=4096,
            )
            
            # Sertifika oluştur
            subject = issuer = x509.Name([
                x509.NameAttribute(NameOID.COUNTRY_NAME, "TR"),
                x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Istanbul"),
                x509.NameAttribute(NameOID.LOCALITY_NAME, "Istanbul"),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, "OptiPlan360"),
                x509.NameAttribute(NameOID.COMMON_NAME, hostname),
            ])
            
            cert = x509.CertificateBuilder().subject_name(
                subject
            ).issuer_name(
                issuer
            ).public_key(
                private_key.public_key()
            ).serial_number(
                x509.random_serial_number()
            ).not_valid_before(
                datetime.utcnow()
            ).not_valid_after(
                datetime.utcnow() + timedelta(days=days)
            ).add_extension(
                x509.SubjectAlternativeName([
                    x509.DNSName(hostname),
                    x509.DNSName("*." + hostname),
                    x509.IPAddress(ip_address("127.0.0.1")),
                ]),
                critical=False,
            ).sign(private_key, hashes.SHA256())
            
            # Sertifika dizini oluştur
            self.cert_dir.mkdir(exist_ok=True)
            
            # Sertifikaları kaydet
            with open(self.cert_file, "wb") as f:
                f.write(cert.public_bytes(serialization.Encoding.PEM))
            
            with open(self.key_file, "wb") as f:
                f.write(private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption()
                ))
            
            logger.info(f"[HTTPS] Self-signed certificate generated for {hostname}")
            
            return {
                "success": True,
                "hostname": hostname,
                "valid_days": days,
                "cert_file": str(self.cert_file),
                "key_file": str(self.key_file),
                "fingerprint": cert.fingerprint(hashes.SHA256()).hex()[:16] + "..."
            }
            
        except Exception as e:
            logger.error(f"[HTTPS] Certificate generation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def check_cert_expiry(self) -> Dict[str, Any]:
        """Sertifika geçerlilik durumunu kontrol et"""
        try:
            from cryptography import x509
            from cryptography.hazmat.backends import default_backend
            from datetime import datetime
            
            if not self.cert_file.exists():
                return {
                    "exists": False,
                    "valid": False,
                    "message": "Certificate file not found"
                }
            
            with open(self.cert_file, "rb") as f:
                cert = x509.load_pem_x509_certificate(f.read(), default_backend())
            
            not_after = cert.not_valid_after
            days_remaining = (not_after - datetime.utcnow()).days
            
            return {
                "exists": True,
                "valid": days_remaining > 0,
                "days_remaining": days_remaining,
                "expiry_date": not_after.isoformat(),
                "subject": str(cert.subject),
                "issuer": str(cert.issuer),
                "needs_renewal": days_remaining < 30
            }
            
        except Exception as e:
            logger.error(f"[HTTPS] Certificate check failed: {e}")
            return {
                "exists": False,
                "valid": False,
                "error": str(e)
            }


# Global instance
_https_service = None


def get_https_service() -> HTTPSConfigService:
    """HTTPS servisi singleton"""
    global _https_service
    
    if _https_service is None:
        _https_service = HTTPSConfigService()
    
    return _https_service
