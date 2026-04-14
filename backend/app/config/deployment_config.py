"""
OptiPlan 360 - Environment Configuration Manager
Centralized configuration management for different environments
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field, asdict
from enum import Enum
import yaml
from pathlib import Path

logger = logging.getLogger(__name__)


class Environment(Enum):
    """Deployment environments"""
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"


@dataclass
class DatabaseConfig:
    """Database configuration"""
    host: str = "localhost"
    port: int = 5432
    name: str = "optiplan360"
    user: str = "optiplan"
    password: str = ""
    ssl_mode: str = "prefer"
    pool_size: int = 20
    max_overflow: int = 10
    pool_timeout: int = 30
    
    @property
    def url(self) -> str:
        """SQLAlchemy database URL"""
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}?sslmode={self.ssl_mode}"


@dataclass
class RedisConfig:
    """Redis configuration"""
    host: str = "localhost"
    port: int = 6379
    db: int = 0
    password: Optional[str] = None
    ssl: bool = False
    
    @property
    def url(self) -> str:
        """Redis URL"""
        auth = f":{self.password}@" if self.password else ""
        protocol = "rediss" if self.ssl else "redis"
        return f"{protocol}://{auth}{self.host}:{self.port}/{self.db}"


@dataclass
class SecurityConfig:
    """Security configuration"""
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    api_key: str = ""
    encryption_key: str = ""
    cors_origins: List[str] = field(default_factory=list)
    allowed_hosts: List[str] = field(default_factory=list)
    enable_https_redirect: bool = True


@dataclass
class PerformanceConfig:
    """Performance configuration"""
    max_workers: int = 4
    worker_timeout: int = 30
    request_timeout: int = 60
    max_request_size_mb: int = 100
    enable_compression: bool = True
    compression_level: int = 6
    cache_ttl: int = 300


@dataclass
class AIConfig:
    """AI/ML configuration"""
    model_cache_dir: str = "./models"
    batch_size: int = 32
    device: str = "cuda"  # cuda or cpu
    enable_gpu: bool = True
    max_gpu_memory_mb: int = 8192
    inference_timeout: int = 60
    max_concurrent_inference: int = 4


@dataclass
class LoggingConfig:
    """Logging configuration"""
    level: str = "INFO"
    format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    file_path: Optional[str] = "./logs/optiplan360.log"
    max_file_size_mb: int = 100
    backup_count: int = 10
    enable_console: bool = True
    enable_file: bool = True


@dataclass
class MonitoringConfig:
    """Monitoring configuration"""
    enable_metrics: bool = True
    metrics_port: int = 9090
    enable_tracing: bool = False
    jaeger_endpoint: Optional[str] = None
    sentry_dsn: Optional[str] = None
    health_check_interval: int = 30


@dataclass
class ExportConfig:
    """Export configuration"""
    export_dir: str = "./exports"
    max_file_size_mb: int = 100
    max_records_per_export: int = 10000
    cleanup_interval_hours: int = 24
    temp_dir: str = "./temp"
    checkpoint_dir: str = "./checkpoints"


@dataclass
class AppConfig:
    """Main application configuration"""
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False
    testing: bool = False
    
    app_name: str = "OptiPlan 360"
    app_version: str = "1.0.0"
    api_prefix: str = "/api/v1"
    
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    redis: RedisConfig = field(default_factory=RedisConfig)
    security: SecurityConfig = field(default_factory=SecurityConfig)
    performance: PerformanceConfig = field(default_factory=PerformanceConfig)
    ai: AIConfig = field(default_factory=AIConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    monitoring: MonitoringConfig = field(default_factory=MonitoringConfig)
    export_settings: ExportConfig = field(default_factory=ExportConfig)
    
    # Additional settings
    timezone: str = "Europe/Istanbul"
    language: str = "tr"
    
    @classmethod
    def from_environment(cls, env: Optional[Environment] = None) -> "AppConfig":
        """
        Load configuration from environment variables.
        
        Args:
            env: Environment type (auto-detected if not provided)
            
        Returns:
            AppConfig instance
        """
        if env is None:
            env_str = os.getenv("ENVIRONMENT", "development").lower()
            env = Environment(env_str)
        
        config = cls(environment=env)
        
        # Override with environment variables
        config._load_from_env()
        
        # Load from secrets if available
        config._load_from_secrets()
        
        return config
    
    def _load_from_env(self) -> None:
        """Load configuration from environment variables"""
        # Environment
        self.debug = os.getenv("DEBUG", "false").lower() == "true"
        self.testing = os.getenv("TESTING", "false").lower() == "true"
        
        # Database
        self.database.host = os.getenv("DATABASE_HOST", self.database.host)
        self.database.port = int(os.getenv("DATABASE_PORT", self.database.port))
        self.database.name = os.getenv("DATABASE_NAME", self.database.name)
        self.database.user = os.getenv("DATABASE_USER", self.database.user)
        self.database.password = os.getenv("DATABASE_PASSWORD", self.database.password)
        self.database.pool_size = int(os.getenv("DATABASE_POOL_SIZE", self.database.pool_size))
        
        # Redis
        self.redis.host = os.getenv("REDIS_HOST", self.redis.host)
        self.redis.port = int(os.getenv("REDIS_PORT", self.redis.port))
        self.redis.password = os.getenv("REDIS_PASSWORD", self.redis.password)
        
        # Security
        self.security.jwt_secret_key = os.getenv("JWT_SECRET_KEY", self.security.jwt_secret_key)
        self.security.api_key = os.getenv("API_KEY", self.security.api_key)
        self.security.encryption_key = os.getenv("ENCRYPTION_KEY", self.security.encryption_key)
        
        cors_origins = os.getenv("CORS_ORIGINS", "")
        if cors_origins:
            self.security.cors_origins = cors_origins.split(",")
        
        # Performance
        self.performance.max_workers = int(os.getenv("MAX_WORKERS", self.performance.max_workers))
        
        # AI/ML
        self.ai.device = os.getenv("AI_DEVICE", self.ai.device)
        self.ai.model_cache_dir = os.getenv("AI_MODEL_CACHE_DIR", self.ai.model_cache_dir)
        
        # Logging
        self.logging.level = os.getenv("LOG_LEVEL", self.logging.level)
        
        # Monitoring
        self.monitoring.enable_metrics = os.getenv("ENABLE_METRICS", "true").lower() == "true"
        self.monitoring.sentry_dsn = os.getenv("SENTRY_DSN", self.monitoring.sentry_dsn)
    
    def _load_from_secrets(self) -> None:
        """Load configuration from secrets files (Kubernetes/Docker secrets)"""
        secrets_dir = Path("/run/secrets")
        
        if not secrets_dir.exists():
            return
        
        # Try to load secrets
        secret_files = {
            "database_password": ("database", "password"),
            "jwt_secret_key": ("security", "jwt_secret_key"),
            "api_key": ("security", "api_key"),
            "encryption_key": ("security", "encryption_key"),
            "redis_password": ("redis", "password"),
        }
        
        for filename, (section, field) in secret_files.items():
            secret_path = secrets_dir / filename
            if secret_path.exists():
                value = secret_path.read_text().strip()
                if section == "database":
                    setattr(self.database, field, value)
                elif section == "security":
                    setattr(self.security, field, value)
                elif section == "redis":
                    setattr(self.redis, field, value)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary (excluding sensitive data)"""
        data = asdict(self)
        
        # Mask sensitive fields
        if "database" in data:
            data["database"]["password"] = "***"
        if "security" in data:
            data["security"]["jwt_secret_key"] = "***"
            data["security"]["api_key"] = "***"
            data["security"]["encryption_key"] = "***"
        if "redis" in data and data["redis"].get("password"):
            data["redis"]["password"] = "***"
        
        return data
    
    def to_json(self) -> str:
        """Convert configuration to JSON string"""
        return json.dumps(self.to_dict(), indent=2, default=str)
    
    def to_yaml(self) -> str:
        """Convert configuration to YAML string"""
        return yaml.dump(self.to_dict(), default_flow_style=False)
    
    def validate(self) -> List[str]:
        """Validate configuration and return list of errors"""
        errors = []
        
        # Check required fields for production
        if self.environment == Environment.PRODUCTION:
            if not self.security.jwt_secret_key:
                errors.append("JWT_SECRET_KEY is required in production")
            if not self.security.api_key:
                errors.append("API_KEY is required in production")
            if not self.security.encryption_key:
                errors.append("ENCRYPTION_KEY is required in production")
            if not self.database.password:
                errors.append("DATABASE_PASSWORD is required in production")
            if not self.security.cors_origins:
                errors.append("CORS_ORIGINS is required in production")
        
        # Validate numeric ranges
        if self.database.pool_size < 1:
            errors.append("DATABASE_POOL_SIZE must be at least 1")
        
        if self.performance.max_workers < 1:
            errors.append("MAX_WORKERS must be at least 1")
        
        return errors
    
    def is_valid(self) -> bool:
        """Check if configuration is valid"""
        return len(self.validate()) == 0


class ConfigManager:
    """Configuration manager singleton"""
    
    _instance: Optional[AppConfig] = None
    
    @classmethod
    def get_config(cls, env: Optional[Environment] = None) -> AppConfig:
        """Get or create configuration instance"""
        if cls._instance is None:
            cls._instance = AppConfig.from_environment(env)
        return cls._instance
    
    @classmethod
    def reload_config(cls, env: Optional[Environment] = None) -> AppConfig:
        """Reload configuration from environment"""
        cls._instance = AppConfig.from_environment(env)
        return cls._instance
    
    @classmethod
    def reset(cls) -> None:
        """Reset configuration (for testing)"""
        cls._instance = None


# Convenience function to get config
def get_config() -> AppConfig:
    """Get global configuration instance"""
    return ConfigManager.get_config()


# Example environment files
ENVIRONMENT_EXAMPLES = {
    "development": {
        "ENVIRONMENT": "development",
        "DEBUG": "true",
        "LOG_LEVEL": "DEBUG",
        "DATABASE_HOST": "localhost",
        "DATABASE_PORT": "5432",
        "DATABASE_NAME": "optiplan360_dev",
        "DATABASE_USER": "optiplan",
        "DATABASE_PASSWORD": "dev_password",
        "DATABASE_POOL_SIZE": "5",
        "REDIS_HOST": "localhost",
        "REDIS_PORT": "6379",
        "JWT_SECRET_KEY": "dev_secret_key",
        "API_KEY": "dev_api_key",
        "CORS_ORIGINS": "http://localhost:3000,http://localhost:5173",
        "MAX_WORKERS": "2",
        "AI_DEVICE": "cpu",
        "ENABLE_METRICS": "false"
    },
    
    "staging": {
        "ENVIRONMENT": "staging",
        "DEBUG": "false",
        "LOG_LEVEL": "INFO",
        "DATABASE_HOST": "postgres-service",
        "DATABASE_PORT": "5432",
        "DATABASE_NAME": "optiplan360_staging",
        "DATABASE_USER": "optiplan",
        "DATABASE_PASSWORD": "${DATABASE_PASSWORD}",  # From secret
        "DATABASE_POOL_SIZE": "10",
        "REDIS_HOST": "redis-service",
        "REDIS_PORT": "6379",
        "REDIS_PASSWORD": "${REDIS_PASSWORD}",  # From secret
        "JWT_SECRET_KEY": "${JWT_SECRET_KEY}",  # From secret
        "API_KEY": "${API_KEY}",  # From secret
        "ENCRYPTION_KEY": "${ENCRYPTION_KEY}",  # From secret
        "CORS_ORIGINS": "https://staging.optiplan360.com",
        "MAX_WORKERS": "4",
        "AI_DEVICE": "cuda",
        "AI_MODEL_CACHE_DIR": "/app/models",
        "ENABLE_METRICS": "true",
        "METRICS_PORT": "9090"
    },
    
    "production": {
        "ENVIRONMENT": "production",
        "DEBUG": "false",
        "LOG_LEVEL": "INFO",
        "DATABASE_HOST": "postgres-service",
        "DATABASE_PORT": "5432",
        "DATABASE_NAME": "optiplan360_prod",
        "DATABASE_USER": "optiplan",
        "DATABASE_PASSWORD": "${DATABASE_PASSWORD}",  # From secret
        "DATABASE_POOL_SIZE": "20",
        "REDIS_HOST": "redis-service",
        "REDIS_PORT": "6379",
        "REDIS_PASSWORD": "${REDIS_PASSWORD}",  # From secret
        "JWT_SECRET_KEY": "${JWT_SECRET_KEY}",  # From secret
        "API_KEY": "${API_KEY}",  # From secret
        "ENCRYPTION_KEY": "${ENCRYPTION_KEY}",  # From secret
        "CORS_ORIGINS": "https://optiplan360.com,https://www.optiplan360.com",
        "MAX_WORKERS": "4",
        "AI_DEVICE": "cuda",
        "AI_MODEL_CACHE_DIR": "/app/models",
        "ENABLE_METRICS": "true",
        "METRICS_PORT": "9090",
        "SENTRY_DSN": "${SENTRY_DSN}"  # From secret
    }
}


# Global configuration instance (initialized on first use)
config: Optional[AppConfig] = None

def init_config(env: Optional[Environment] = None) -> AppConfig:
    """Initialize global configuration"""
    global config
    config = AppConfig.from_environment(env)
    
    # Validate configuration
    errors = config.validate()
    if errors:
        for error in errors:
            logger.error(f"Configuration error: {error}")
        raise ValueError(f"Invalid configuration: {', '.join(errors)}")
    
    logger.info(f"Configuration loaded for environment: {config.environment.value}")
    return config
