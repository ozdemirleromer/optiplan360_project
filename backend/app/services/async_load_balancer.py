"""
OptiPlan 360 - Async Load Balancing Service
Async işlemler, rate limiting ve task queue yönetimi

Bu modül:
- Async task queue
- Rate limiting
- Load balancing
- Circuit breaker pattern
- Retry mechanisms
"""

import asyncio
import time
import logging
from typing import Dict, List, Optional, Callable, Any, Set
from dataclasses import dataclass, field
from collections import deque
from enum import Enum
from contextlib import asynccontextmanager
import functools

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"      # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if recovered


@dataclass
class TaskInfo:
    """Async task bilgisi"""
    task_id: str
    coro: asyncio.Coroutine
    priority: int
    created_at: float
    max_retries: int
    current_retry: int = 0
    timeout: float = 30.0
    result: Any = None
    error: Optional[str] = None
    completed: bool = False


@dataclass
class RateLimitConfig:
    """Rate limiting konfigürasyonu"""
    max_requests: int = 100
    window_seconds: float = 60.0
    burst_size: int = 10


class AsyncTaskQueue:
    """
    Priority-based async task queue.
    """
    
    def __init__(self, max_concurrent: int = 10, max_size: int = 1000):
        self.max_concurrent = max_concurrent
        self.max_size = max_size
        
        self.queue: asyncio.PriorityQueue = asyncio.PriorityQueue(maxsize=max_size)
        self.running_tasks: Dict[str, asyncio.Task] = {}
        self.completed_tasks: Dict[str, TaskInfo] = {}
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self._shutdown = False
        
    async def submit(
        self,
        task_id: str,
        coro: asyncio.Coroutine,
        priority: int = 5,
        max_retries: int = 3,
        timeout: float = 30.0
    ) -> str:
        """
        Task submit et.
        
        Lower priority number = higher priority (1 is highest)
        """
        if self._shutdown:
            raise RuntimeError("Queue is shutting down")
        
        task_info = TaskInfo(
            task_id=task_id,
            coro=coro,
            priority=priority,
            created_at=time.time(),
            max_retries=max_retries,
            timeout=timeout
        )
        
        # PriorityQueue uses (priority, item) tuples
        # Lower number = higher priority, so we use priority directly
        await self.queue.put((priority, task_info))
        
        return task_id
    
    async def process_queue(self) -> None:
        """Queue'yu işle"""
        while not self._shutdown:
            try:
                # Get next task
                priority, task_info = await self.queue.get()
                
                # Process with semaphore (limits concurrency)
                async with self.semaphore:
                    if self._shutdown:
                        break
                    
                    await self._execute_task(task_info)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Queue processing error: {e}")
    
    async def _execute_task(self, task_info: TaskInfo) -> None:
        """Task'i çalıştır"""
        task_id = task_info.task_id
        
        try:
            # Create asyncio task with timeout
            task = asyncio.create_task(
                asyncio.wait_for(task_info.coro, timeout=task_info.timeout)
            )
            self.running_tasks[task_id] = task
            
            # Wait for completion
            result = await task
            
            task_info.result = result
            task_info.completed = True
            
            logger.debug(f"Task {task_id} completed successfully")
            
        except asyncio.TimeoutError:
            task_info.error = "Timeout"
            logger.warning(f"Task {task_id} timed out")
            
            # Retry logic
            if task_info.current_retry < task_info.max_retries:
                task_info.current_retry += 1
                logger.info(f"Retrying task {task_id} (attempt {task_info.current_retry})")
                await self.submit(
                    task_id=f"{task_id}_retry_{task_info.current_retry}",
                    coro=task_info.coro,
                    priority=task_info.priority,
                    max_retries=0  # Don't retry retries
                )
                
        except Exception as e:
            task_info.error = str(e)
            logger.error(f"Task {task_id} failed: {e}")
            
            # Retry logic
            if task_info.current_retry < task_info.max_retries:
                task_info.current_retry += 1
                await asyncio.sleep(2 ** task_info.current_retry)  # Exponential backoff
                await self.submit(
                    task_id=f"{task_id}_retry_{task_info.current_retry}",
                    coro=task_info.coro,
                    priority=task_info.priority,
                    max_retries=task_info.max_retries - 1
                )
        
        finally:
            # Cleanup
            if task_id in self.running_tasks:
                del self.running_tasks[task_id]
            
            self.completed_tasks[task_id] = task_info
            
            # Keep only last 1000 completed tasks
            if len(self.completed_tasks) > 1000:
                oldest = next(iter(self.completed_tasks))
                del self.completed_tasks[oldest]
    
    async def get_task_status(self, task_id: str) -> Optional[TaskInfo]:
        """Task durumunu al"""
        # Check running tasks
        if task_id in self.running_tasks:
            task = self.running_tasks[task_id]
            return TaskInfo(
                task_id=task_id,
                coro=None,
                priority=0,
                created_at=0,
                max_retries=0,
                completed=task.done()
            )
        
        # Check completed tasks
        if task_id in self.completed_tasks:
            return self.completed_tasks[task_id]
        
        return None
    
    async def shutdown(self, wait: bool = True, timeout: float = 30.0) -> None:
        """Queue'yu kapat"""
        self._shutdown = True
        
        if wait and self.running_tasks:
            # Wait for running tasks
            pending = list(self.running_tasks.values())
            try:
                await asyncio.wait_for(
                    asyncio.gather(*pending, return_exceptions=True),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                logger.warning("Shutdown timeout, cancelling remaining tasks")
                for task in pending:
                    task.cancel()


class RateLimiter:
    """
    Token bucket rate limiter.
    """
    
    def __init__(self, config: RateLimitConfig):
        self.config = config
        self.tokens: Dict[str, float] = {}
        self.last_update: Dict[str, float] = {}
        self.lock = asyncio.Lock()
        
    async def acquire(self, key: str = "default") -> bool:
        """
        Rate limit token al.
        
        Returns:
            True if allowed, False if rate limited
        """
        async with self.lock:
            now = time.time()
            
            # Initialize if new key
            if key not in self.tokens:
                self.tokens[key] = self.config.burst_size
                self.last_update[key] = now
            
            # Calculate token replenishment
            time_passed = now - self.last_update[key]
            tokens_to_add = time_passed * (self.config.max_requests / self.config.window_seconds)
            
            self.tokens[key] = min(
                self.config.burst_size,
                self.tokens[key] + tokens_to_add
            )
            self.last_update[key] = now
            
            # Check if we can consume a token
            if self.tokens[key] >= 1:
                self.tokens[key] -= 1
                return True
            else:
                return False
    
    async def get_remaining(self, key: str = "default") -> float:
        """Kalan token sayısını al"""
        async with self.lock:
            if key not in self.tokens:
                return self.config.burst_size
            
            now = time.time()
            time_passed = now - self.last_update[key]
            tokens_to_add = time_passed * (self.config.max_requests / self.config.window_seconds)
            
            return min(self.config.burst_size, self.tokens[key] + tokens_to_add)
    
    def get_wait_time(self, key: str = "default") -> float:
        """Bir sonraki token için bekleme süresi"""
        if key not in self.tokens or self.tokens[key] >= 1:
            return 0
        
        # Time to generate 1 token
        return self.config.window_seconds / self.config.max_requests


class CircuitBreaker:
    """
    Circuit breaker pattern implementation.
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        half_open_max_calls: int = 3
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[float] = None
        self.half_open_calls = 0
        self.lock = asyncio.Lock()
        
    async def call(self, coro: asyncio.Coroutine, fallback: Optional[Callable] = None) -> Any:
        """
        Circuit breaker ile async call yap.
        
        Args:
            coro: Coroutine to execute
            fallback: Fallback function if circuit is open
            
        Returns:
            Result from coro or fallback
        """
        async with self.lock:
            if self.state == CircuitState.OPEN:
                # Check if recovery timeout passed
                if self.last_failure_time and (time.time() - self.last_failure_time) > self.recovery_timeout:
                    self.state = CircuitState.HALF_OPEN
                    self.half_open_calls = 0
                    logger.info("Circuit breaker entering half-open state")
                else:
                    # Circuit is open, use fallback
                    if fallback:
                        return await fallback()
                    raise CircuitBreakerOpen("Circuit breaker is open")
            
            if self.state == CircuitState.HALF_OPEN:
                if self.half_open_calls >= self.half_open_max_calls:
                    if fallback:
                        return await fallback()
                    raise CircuitBreakerOpen("Circuit breaker half-open limit reached")
                self.half_open_calls += 1
        
        # Execute the call
        try:
            result = await coro
            await self._on_success()
            return result
        except Exception as e:
            await self._on_failure()
            raise
    
    async def _on_success(self) -> None:
        """Başarılı call handler"""
        async with self.lock:
            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                if self.success_count >= self.half_open_max_calls:
                    # Recovery successful, close circuit
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
                    self.success_count = 0
                    self.half_open_calls = 0
                    logger.info("Circuit breaker closed (recovered)")
            elif self.state == CircuitState.CLOSED:
                # Reset failure count on success
                self.failure_count = 0
    
    async def _on_failure(self) -> None:
        """Başarısız call handler"""
        async with self.lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            
            if self.state == CircuitState.HALF_OPEN:
                # Recovery failed, open circuit again
                self.state = CircuitState.OPEN
                self.half_open_calls = 0
                logger.warning("Circuit breaker opened (recovery failed)")
            elif self.state == CircuitState.CLOSED and self.failure_count >= self.failure_threshold:
                # Too many failures, open circuit
                self.state = CircuitState.OPEN
                logger.warning(f"Circuit breaker opened after {self.failure_count} failures")
    
    def get_state(self) -> CircuitState:
        """Circuit state al"""
        return self.state


class CircuitBreakerOpen(Exception):
    """Circuit breaker açık durumda exception"""
    pass


class LoadBalancer:
    """
    Simple round-robin load balancer.
    """
    
    def __init__(self, endpoints: List[str]):
        self.endpoints = endpoints
        self.current_index = 0
        self.healthy_endpoints: Set[str] = set(endpoints)
        self.lock = asyncio.Lock()
        
    async def get_next_endpoint(self) -> Optional[str]:
        """Sonraki endpoint'i al"""
        async with self.lock:
            if not self.healthy_endpoints:
                return None
            
            # Round-robin selection
            healthy_list = list(self.healthy_endpoints)
            endpoint = healthy_list[self.current_index % len(healthy_list)]
            self.current_index += 1
            
            return endpoint
    
    async def mark_unhealthy(self, endpoint: str) -> None:
        """Endpoint'i unhealthy olarak işaretle"""
        async with self.lock:
            self.healthy_endpoints.discard(endpoint)
            logger.warning(f"Endpoint {endpoint} marked as unhealthy")
    
    async def mark_healthy(self, endpoint: str) -> None:
        """Endpoint'i healthy olarak işaretle"""
        async with self.lock:
            self.healthy_endpoints.add(endpoint)
            logger.info(f"Endpoint {endpoint} marked as healthy")
    
    def get_stats(self) -> Dict:
        """Load balancer istatistikleri"""
        return {
            'total_endpoints': len(self.endpoints),
            'healthy_endpoints': len(self.healthy_endpoints),
            'unhealthy_endpoints': len(self.endpoints) - len(self.healthy_endpoints),
            'healthy_list': list(self.healthy_endpoints)
        }


class AsyncWorkerPool:
    """
    Async worker pool for CPU-bound tasks.
    """
    
    def __init__(self, max_workers: int = 4):
        self.max_workers = max_workers
        self.queue: asyncio.Queue = asyncio.Queue()
        self.workers: List[asyncio.Task] = []
        self._shutdown = False
        
    async def start(self) -> None:
        """Worker'ları başlat"""
        for i in range(self.max_workers):
            worker = asyncio.create_task(self._worker_loop(f"worker-{i}"))
            self.workers.append(worker)
        
        logger.info(f"Started {self.max_workers} workers")
    
    async def _worker_loop(self, worker_id: str) -> None:
        """Worker ana döngüsü"""
        while not self._shutdown:
            try:
                # Get task from queue
                task_fn, args, kwargs, future = await asyncio.wait_for(
                    self.queue.get(),
                    timeout=1.0
                )
                
                try:
                    # Execute task
                    result = await task_fn(*args, **kwargs)
                    future.set_result(result)
                except Exception as e:
                    future.set_exception(e)
                
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}")
    
    async def submit(self, task_fn: Callable, *args, **kwargs) -> asyncio.Future:
        """Task submit et"""
        future = asyncio.get_event_loop().create_future()
        await self.queue.put((task_fn, args, kwargs, future))
        return future
    
    async def shutdown(self) -> None:
        """Worker pool'u kapat"""
        self._shutdown = True
        
        # Cancel all workers
        for worker in self.workers:
            worker.cancel()
        
        # Wait for workers to finish
        await asyncio.gather(*self.workers, return_exceptions=True)
        
        logger.info("Worker pool shutdown complete")


class AsyncLoadBalancingService:
    """
    Async load balancing ana servisi.
    """
    
    def __init__(
        self,
        max_concurrent_tasks: int = 50,
        max_workers: int = 4,
        rate_limit_config: Optional[RateLimitConfig] = None
    ):
        self.task_queue = AsyncTaskQueue(
            max_concurrent=max_concurrent_tasks,
            max_size=10000
        )
        self.worker_pool = AsyncWorkerPool(max_workers=max_workers)
        self.rate_limiter = RateLimiter(rate_limit_config or RateLimitConfig())
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.load_balancers: Dict[str, LoadBalancer] = {}
        
    async def start(self) -> None:
        """Servisi başlat"""
        await self.worker_pool.start()
        
        # Start queue processor
        self.queue_processor = asyncio.create_task(self.task_queue.process_queue())
        
        logger.info("Async load balancing service started")
    
    async def submit_task(
        self,
        task_id: str,
        coro: asyncio.Coroutine,
        priority: int = 5,
        max_retries: int = 3,
        rate_limit_key: Optional[str] = None
    ) -> str:
        """Task submit et (rate limiting ile)"""
        # Check rate limit
        if rate_limit_key:
            allowed = await self.rate_limiter.acquire(rate_limit_key)
            if not allowed:
                raise RateLimitExceeded("Rate limit exceeded")
        
        # Submit to queue
        return await self.task_queue.submit(task_id, coro, priority, max_retries)
    
    def get_circuit_breaker(
        self,
        service_name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0
    ) -> CircuitBreaker:
        """Service için circuit breaker al (veya oluştur)"""
        if service_name not in self.circuit_breakers:
            self.circuit_breakers[service_name] = CircuitBreaker(
                failure_threshold=failure_threshold,
                recovery_timeout=recovery_timeout
            )
        return self.circuit_breakers[service_name]
    
    def get_load_balancer(self, service_name: str, endpoints: List[str]) -> LoadBalancer:
        """Service için load balancer al (veya oluştur)"""
        if service_name not in self.load_balancers:
            self.load_balancers[service_name] = LoadBalancer(endpoints)
        return self.load_balancers[service_name]
    
    async def execute_with_circuit_breaker(
        self,
        service_name: str,
        coro: asyncio.Coroutine,
        fallback: Optional[Callable] = None
    ) -> Any:
        """Circuit breaker ile execute et"""
        circuit_breaker = self.get_circuit_breaker(service_name)
        return await circuit_breaker.call(coro, fallback)
    
    async def get_stats(self) -> Dict:
        """Servis istatistikleri"""
        return {
            'queue': {
                'running_tasks': len(self.task_queue.running_tasks),
                'completed_tasks': len(self.task_queue.completed_tasks),
                'max_concurrent': self.task_queue.max_concurrent
            },
            'rate_limiter': {
                'tokens_remaining': await self.rate_limiter.get_remaining()
            },
            'circuit_breakers': {
                name: {
                    'state': cb.get_state().value,
                    'failure_count': cb.failure_count
                }
                for name, cb in self.circuit_breakers.items()
            },
            'load_balancers': {
                name: lb.get_stats()
                for name, lb in self.load_balancers.items()
            }
        }
    
    async def shutdown(self) -> None:
        """Servisi kapat"""
        # Stop queue processor
        if hasattr(self, 'queue_processor'):
            self.queue_processor.cancel()
            try:
                await self.queue_processor
            except asyncio.CancelledError:
                pass
        
        # Shutdown queue
        await self.task_queue.shutdown(wait=True)
        
        # Shutdown worker pool
        await self.worker_pool.shutdown()
        
        logger.info("Async load balancing service shutdown complete")


class RateLimitExceeded(Exception):
    """Rate limit aşıldığı exception"""
    pass


# Decorators

def with_circuit_breaker(
    service_name: str,
    failure_threshold: int = 5,
    recovery_timeout: float = 60.0,
    fallback: Optional[Callable] = None
):
    """
    Circuit breaker decorator.
    
    Usage:
        @with_circuit_breaker("my_service")
        async def my_function():
            pass
    """
    def decorator(func: Callable) -> Callable:
        circuit_breaker = CircuitBreaker(failure_threshold, recovery_timeout)
        
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            async def execute():
                return await func(*args, **kwargs)
            
            return await circuit_breaker.call(execute(), fallback)
        
        return wrapper
    return decorator


def with_rate_limit(
    max_requests: int = 100,
    window_seconds: float = 60.0,
    key_fn: Optional[Callable] = None
):
    """
    Rate limiting decorator.
    
    Usage:
        @with_rate_limit(max_requests=10, window_seconds=60)
        async def my_function():
            pass
    """
    def decorator(func: Callable) -> Callable:
        rate_limiter = RateLimiter(RateLimitConfig(max_requests, window_seconds))
        
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate key
            if key_fn:
                key = key_fn(*args, **kwargs)
            else:
                key = "default"
            
            # Check rate limit
            allowed = await rate_limiter.acquire(key)
            if not allowed:
                raise RateLimitExceeded(f"Rate limit exceeded for {func.__name__}")
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


# Global async load balancing service
async_load_balancer: Optional[AsyncLoadBalancingService] = None
