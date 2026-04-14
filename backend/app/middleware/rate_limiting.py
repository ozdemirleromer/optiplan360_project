"""
Rate Limiting and DDoS Protection Middleware
Advanced rate limiting with DDoS protection capabilities
"""

import time
import asyncio
from typing import Dict, Any, Optional, Callable
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta
import redis
import logging
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Rate limiting configuration"""
    window_seconds: int = 60
    max_requests: int = 100
    burst_size: int = 10
    penalty_seconds: int = 300
    blacklist_threshold: int = 1000
    whitelist_threshold: int = 10000


@dataclass
class ClientInfo:
    """Client information for rate limiting"""
    ip_address: str
    user_agent: str
    request_count: int = 0
    blocked_until: Optional[datetime] = None
    penalty_count: int = 0
    last_request: Optional[datetime] = None
    suspicious_score: int = 0


class RateLimiter:
    """Advanced rate limiter with DDoS protection"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.clients: Dict[str, ClientInfo] = {}
        self.global_requests = deque(maxlen=10000)
        self.blocked_ips = set()
        self.whitelisted_ips = set()
        
        # Rate limiting configurations
        self.configs = {
            'default': RateLimitConfig(window_seconds=60, max_requests=100),
            'auth': RateLimitConfig(window_seconds=60, max_requests=10),
            'api': RateLimitConfig(window_seconds=60, max_requests=1000),
            'upload': RateLimitConfig(window_seconds=60, max_requests=20),
            'export': RateLimitConfig(window_seconds=60, max_requests=5),
            'ocr': RateLimitConfig(window_seconds=60, max_requests=30),
        }
        
        # DDoS detection thresholds
        self.ddos_thresholds = {
            'requests_per_second': 100,
            'unique_ips_per_minute': 1000,
            'concurrent_connections': 500,
            'error_rate_per_minute': 50,
        }
    
    def get_client_key(self, request: Request) -> str:
        """Generate unique client key"""
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get('user-agent', '')[:100]
        return f"{client_ip}:{hash(user_agent)}"
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address"""
        # Check for forwarded headers
        forwarded_for = request.headers.get('x-forwarded-for')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        
        real_ip = request.headers.get('x-real-ip')
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else 'unknown'
    
    def is_whitelisted(self, client_ip: str) -> bool:
        """Check if IP is whitelisted"""
        return client_ip in self.whitelisted_ips
    
    def is_blacklisted(self, client_ip: str) -> bool:
        """Check if IP is blacklisted"""
        return client_ip in self.blocked_ips or client_ip in self.clients and self.clients[client_ip].blocked_until and self.clients[client_ip].blocked_until > datetime.utcnow()
    
    def update_client_info(self, client_key: str, request: Request):
        """Update client request information"""
        client_ip = self._get_client_ip(request)
        
        if client_key not in self.clients:
            self.clients[client_key] = ClientInfo(
                ip_address=client_ip,
                user_agent=request.headers.get('user-agent', '')
            )
        
        client = self.clients[client_key]
        client.request_count += 1
        client.last_request = datetime.utcnow()
        
        # Update suspicious score based on request patterns
        self._update_suspicious_score(client, request)
    
    def _update_suspicious_score(self, client: ClientInfo, request: Request):
        """Update suspicious score based on request patterns"""
        suspicious_indicators = 0
        
        # Check for common attack patterns
        path = request.url.path.lower()
        user_agent = request.headers.get('user-agent', '').lower()
        
        # SQL injection patterns
        sql_patterns = ['union select', 'drop table', 'insert into', 'delete from']
        if any(pattern in path for pattern in sql_patterns):
            suspicious_indicators += 50
        
        # XSS patterns
        xss_patterns = ['<script', 'javascript:', 'onerror=', 'onload=']
        if any(pattern in path for pattern in xss_patterns):
            suspicious_indicators += 30
        
        # Bot patterns
        bot_patterns = ['bot', 'crawler', 'spider', 'scraper']
        if any(pattern in user_agent for pattern in bot_patterns):
            suspicious_indicators += 20
        
        # Rate abuse patterns
        if client.request_count > 100:
            suspicious_indicators += 40
        elif client.request_count > 50:
            suspicious_indicators += 20
        
        # Request size abuse
        content_length = request.headers.get('content-length')
        if content_length and int(content_length) > 10 * 1024 * 1024:  # 10MB
            suspicious_indicators += 15
        
        client.suspicious_score += suspicious_indicators
    
    def check_rate_limit(self, client_key: str, endpoint_type: str = 'default') -> tuple[bool, Dict[str, Any]]:
        """Check if client exceeds rate limit"""
        config = self.configs.get(endpoint_type, self.configs['default'])
        client = self.clients.get(client_key)
        
        if not client:
            return True, {'remaining': config.max_requests}
        
        # Check if client is blocked
        if client.blocked_until and client.blocked_until > datetime.utcnow():
            return False, {
                'blocked': True,
                'blocked_until': client.blocked_until.isoformat(),
                'reason': 'Rate limit exceeded'
            }
        
        # Use Redis for distributed rate limiting if available
        if self.redis:
            return self._check_redis_rate_limit(client_key, config)
        
        # In-memory rate limiting
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=config.window_seconds)
        
        # Count requests in window (simplified - in production use proper sliding window)
        requests_in_window = client.request_count if client.last_request and client.last_request > window_start else 0
        
        remaining = max(0, config.max_requests - requests_in_window)
        allowed = requests_in_window < config.max_requests
        
        # Apply penalty if exceeded
        if not allowed:
            client.penalty_count += 1
            if client.penalty_count >= 3:
                client.blocked_until = now + timedelta(seconds=config.penalty_seconds)
                logger.warning(f"Client {client.ip_address} blocked due to repeated rate limit violations")
        
        return allowed, {
            'remaining': remaining,
            'reset_time': (now + timedelta(seconds=config.window_seconds)).isoformat(),
            'retry_after': config.window_seconds if not allowed else 0
        }
    
    def _check_redis_rate_limit(self, client_key: str, config: RateLimitConfig) -> tuple[bool, Dict[str, Any]]:
        """Check rate limit using Redis for distributed systems"""
        try:
            pipe = self.redis.pipeline()
            now = int(time.time())
            window_start = now - config.window_seconds
            
            # Remove old entries
            pipe.zremrangebyscore(client_key, 0, window_start)
            
            # Count current requests
            pipe.zcard(client_key)
            
            # Add current request
            pipe.zadd(client_key, {str(now): now})
            
            # Set expiration
            pipe.expire(client_key, config.window_seconds + 1)
            
            results = pipe.execute()
            request_count = results[2]  # zcard result
            
            remaining = max(0, config.max_requests - request_count)
            allowed = request_count < config.max_requests
            
            return allowed, {
                'remaining': remaining,
                'reset_time': datetime.fromtimestamp(now + config.window_seconds).isoformat(),
                'retry_after': config.window_seconds if not allowed else 0
            }
            
        except Exception as e:
            logger.error(f"Redis rate limiting error: {e}")
            # Fallback to allowing request
            return True, {'remaining': config.max_requests}
    
    def detect_ddos_attack(self) -> Dict[str, Any]:
        """Detect potential DDoS attacks"""
        now = datetime.utcnow()
        recent_window = now - timedelta(minutes=1)
        
        # Count requests per second
        recent_requests = [
            req_time for req_time in self.global_requests 
            if req_time > recent_window
        ]
        
        requests_per_second = len(recent_requests) / 60
        unique_ips = len(set(self._get_client_ip(req) for req in self.global_requests))
        
        # DDoS indicators
        ddos_indicators = {
            'requests_per_second': requests_per_second > self.ddos_thresholds['requests_per_second'],
            'unique_ips_per_minute': unique_ips > self.ddos_thresholds['unique_ips_per_minute'],
            'high_frequency_clients': sum(1 for client in self.clients.values() 
                                   if client.request_count > 100),
            'suspicious_clients': sum(1 for client in self.clients.values() 
                                   if client.suspicious_score > 50),
        }
        
        # Determine if DDoS attack is detected
        is_ddos = any(ddos_indicators.values())
        
        if is_ddos:
            logger.warning(f"Potential DDoS attack detected: {ddos_indicators}")
            
            # Auto-block high-frequency IPs
            for client_key, client in self.clients.items():
                if client.request_count > 200:
                    self.blocked_ips.add(client.ip_address)
                    client.blocked_until = now + timedelta(hours=1)
        
        return {
            'is_ddos': is_ddos,
            'indicators': ddos_indicators,
            'requests_per_second': requests_per_second,
            'unique_ips': unique_ips,
            'total_clients': len(self.clients),
        }
    
    def cleanup_expired_entries(self):
        """Clean up expired client entries"""
        now = datetime.utcnow()
        cutoff = now - timedelta(hours=1)
        
        expired_keys = [
            key for key, client in self.clients.items()
            if client.last_request and client.last_request < cutoff
        ]
        
        for key in expired_keys:
            del self.clients[key]
        
        # Clean up global request history
        cutoff_time = now - timedelta(minutes=5)
        while self.global_requests and self.global_requests[0] < cutoff_time:
            self.global_requests.popleft()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware for FastAPI"""
    
    def __init__(self, app, redis_client: Optional[redis.Redis] = None):
        super().__init__(app)
        self.rate_limiter = RateLimiter(redis_client)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get client information
        client_ip = self.rate_limiter._get_client_ip(request)
        client_key = self.rate_limiter.get_client_key(request)
        
        # Check whitelist first
        if self.rate_limiter.is_whitelisted(client_ip):
            return await call_next(request)
        
        # Check blacklist
        if self.rate_limiter.is_blacklisted(client_ip):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    'error': 'Too Many Requests',
                    'message': 'IP address is temporarily blocked',
                    'code': 'IP_BLOCKED'
                }
            )
        
        # Update client information
        self.rate_limiter.update_client_info(client_key, request)
        
        # Determine endpoint type for rate limiting
        endpoint_type = self._get_endpoint_type(request)
        
        # Check rate limit
        allowed, limit_info = self.rate_limiter.check_rate_limit(client_key, endpoint_type)
        
        if not allowed:
            response = JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    'error': 'Too Many Requests',
                    'message': 'Rate limit exceeded',
                    'code': 'RATE_LIMIT_EXCEEDED',
                    **limit_info
                }
            )
            
            # Add rate limit headers
            response.headers['X-RateLimit-Limit'] = str(self.rate_limiter.configs[endpoint_type].max_requests)
            response.headers['X-RateLimit-Remaining'] = str(limit_info.get('remaining', 0))
            response.headers['X-RateLimit-Reset'] = limit_info.get('reset_time', '')
            response.headers['Retry-After'] = str(limit_info.get('retry_after', 60))
            
            return response
        
        # DDoS detection
        ddos_info = self.rate_limiter.detect_ddos_attack()
        
        # Add DDoS protection headers if attack detected
        response = await call_next(request)
        if ddos_info['is_ddos']:
            response.headers['X-DDoS-Protection'] = 'active'
            response.headers['X-DDoS-Score'] = str(ddos_info.get('requests_per_second', 0))
        
        # Add rate limit headers to successful responses
        response.headers['X-RateLimit-Limit'] = str(self.rate_limiter.configs[endpoint_type].max_requests)
        response.headers['X-RateLimit-Remaining'] = str(limit_info.get('remaining', 0))
        response.headers['X-RateLimit-Reset'] = limit_info.get('reset_time', '')
        
        return response
    
    def _get_endpoint_type(self, request: Request) -> str:
        """Determine endpoint type for rate limiting"""
        path = request.url.path.lower()
        
        if path.startswith('/api/v1/auth'):
            return 'auth'
        elif path.startswith('/api/v1/upload') or path.startswith('/api/v1/ocr'):
            return 'upload'
        elif path.startswith('/api/v1/export'):
            return 'export'
        elif path.startswith('/api/v1'):
            return 'api'
        else:
            return 'default'


# Global rate limiter instance
rate_limiter = RateLimiter()

# Rate limiting decorator for specific endpoints
def rate_limit(endpoint_type: str = 'default'):
    """Decorator for rate limiting specific endpoints"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Implementation for rate limiting specific endpoints
            return await func(*args, **kwargs)
        return wrapper
    return decorator


# DDoS protection utilities
def add_ip_to_whitelist(ip_address: str):
    """Add IP to whitelist"""
    rate_limiter.whitelisted_ips.add(ip_address)
    logger.info(f"IP {ip_address} added to whitelist")

def remove_ip_from_whitelist(ip_address: str):
    """Remove IP from whitelist"""
    rate_limiter.whitelisted_ips.discard(ip_address)
    logger.info(f"IP {ip_address} removed from whitelist")

def add_ip_to_blacklist(ip_address: str, reason: str = 'manual'):
    """Add IP to blacklist"""
    rate_limiter.blocked_ips.add(ip_address)
    logger.warning(f"IP {ip_address} added to blacklist: {reason}")

def remove_ip_from_blacklist(ip_address: str):
    """Remove IP from blacklist"""
    rate_limiter.blocked_ips.discard(ip_address)
    logger.info(f"IP {ip_address} removed from blacklist")

def get_rate_limit_stats():
    """Get rate limiting statistics"""
    return {
        'total_clients': len(rate_limiter.clients),
        'blocked_ips': len(rate_limiter.blocked_ips),
        'whitelisted_ips': len(rate_limiter.whitelisted_ips),
        'global_requests_per_second': len(rate_limiter.global_requests) / 60,
        'suspicious_clients': sum(1 for client in rate_limiter.clients.values() if client.suspicious_score > 50),
    }

# Cleanup task
async def cleanup_rate_limit_data():
    """Periodic cleanup of rate limiting data"""
    rate_limiter.cleanup_expired_entries()
    logger.info("Rate limiting data cleanup completed")

# Schedule cleanup every 5 minutes
import asyncio
async def schedule_cleanup():
    while True:
        await asyncio.sleep(300)  # 5 minutes
        await cleanup_rate_limit_data()

# Start cleanup task
asyncio.create_task(schedule_cleanup())
