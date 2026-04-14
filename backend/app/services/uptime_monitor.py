"""
OptiPlan 360 - Uptime Monitoring Service
Service availability monitoring and alerting

Bu modül:
- Service uptime checks
- Endpoint monitoring
- Alert thresholds
- Status page generation
- Historical uptime tracking
"""

import asyncio
import time
import logging
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import aiohttp
import json

logger = logging.getLogger(__name__)


class ServiceStatus(Enum):
    """Service status enumeration"""
    UP = "up"
    DOWN = "down"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"


@dataclass
class UptimeCheck:
    """Uptime check configuration"""
    name: str
    url: str
    method: str = "GET"
    headers: Dict[str, str] = field(default_factory=dict)
    expected_status_codes: List[int] = field(default_factory=lambda: [200])
    timeout_seconds: float = 10.0
    check_interval_seconds: int = 60
    retry_count: int = 3
    retry_delay_seconds: float = 5.0
    alert_threshold_failures: int = 2


@dataclass
class UptimeResult:
    """Uptime check result"""
    check_name: str
    url: str
    status: ServiceStatus
    response_time_ms: float
    status_code: Optional[int]
    timestamp: datetime
    error_message: Optional[str] = None
    consecutive_failures: int = 0
    total_checks: int = 0
    successful_checks: int = 0


@dataclass
class AlertConfig:
    """Alert configuration"""
    name: str
    condition: str  # "status_change", "consecutive_failures", "high_latency"
    threshold: int
    channels: List[str]  # ["email", "slack", "pagerduty"]
    severity: str = "warning"  # "info", "warning", "critical"
    cooldown_minutes: int = 15


@dataclass
class MaintenanceWindow:
    """Maintenance window"""
    start: datetime
    end: datetime
    description: str
    affected_services: List[str]


class UptimeMonitor:
    """
    Uptime monitoring service.
    
    Servislerin availability'sini izler ve alert üretir.
    """
    
    def __init__(
        self,
        checks: Optional[List[UptimeCheck]] = None,
        alert_configs: Optional[List[AlertConfig]] = None
    ):
        self.checks: Dict[str, UptimeCheck] = {}
        self.results: Dict[str, List[UptimeResult]] = {}
        self.alert_configs: Dict[str, AlertConfig] = {}
        self.maintenance_windows: List[MaintenanceWindow] = []
        self._running = False
        self._tasks: List[asyncio.Task] = []
        
        # Alert callbacks
        self.alert_handlers: Dict[str, Callable] = {}
        
        # Initialize
        if checks:
            for check in checks:
                self.add_check(check)
        
        if alert_configs:
            for config in alert_configs:
                self.add_alert_config(config)
    
    def add_check(self, check: UptimeCheck) -> None:
        """Add uptime check"""
        self.checks[check.name] = check
        self.results[check.name] = []
        logger.info(f"Added uptime check: {check.name} ({check.url})")
    
    def remove_check(self, name: str) -> None:
        """Remove uptime check"""
        if name in self.checks:
            del self.checks[name]
            del self.results[name]
            logger.info(f"Removed uptime check: {name}")
    
    def add_alert_config(self, config: AlertConfig) -> None:
        """Add alert configuration"""
        self.alert_configs[config.name] = config
    
    def register_alert_handler(self, channel: str, handler: Callable) -> None:
        """Register alert handler for channel"""
        self.alert_handlers[channel] = handler
    
    async def perform_check(self, check: UptimeCheck) -> UptimeResult:
        """
        Perform single uptime check.
        
        Args:
            check: UptimeCheck configuration
            
        Returns:
            UptimeResult with check details
        """
        start_time = time.time()
        last_error = None
        
        # Try multiple times
        for attempt in range(check.retry_count):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.request(
                        method=check.method,
                        url=check.url,
                        headers=check.headers,
                        timeout=aiohttp.ClientTimeout(total=check.timeout_seconds)
                    ) as response:
                        
                        response_time = (time.time() - start_time) * 1000
                        
                        # Check status code
                        if response.status in check.expected_status_codes:
                            return UptimeResult(
                                check_name=check.name,
                                url=check.url,
                                status=ServiceStatus.UP,
                                response_time_ms=response_time,
                                status_code=response.status,
                                timestamp=datetime.utcnow()
                            )
                        else:
                            last_error = f"Unexpected status code: {response.status}"
                            
            except asyncio.TimeoutError:
                last_error = f"Timeout after {check.timeout_seconds}s"
            except aiohttp.ClientError as e:
                last_error = f"Connection error: {str(e)}"
            except Exception as e:
                last_error = f"Error: {str(e)}"
            
            # Wait before retry
            if attempt < check.retry_count - 1:
                await asyncio.sleep(check.retry_delay_seconds)
        
        # All retries failed
        response_time = (time.time() - start_time) * 1000
        
        return UptimeResult(
            check_name=check.name,
            url=check.url,
            status=ServiceStatus.DOWN,
            response_time_ms=response_time,
            status_code=None,
            timestamp=datetime.utcnow(),
            error_message=last_error
        )
    
    async def _check_loop(self, check: UptimeCheck) -> None:
        """Background check loop for a single check"""
        consecutive_failures = 0
        last_status = ServiceStatus.UNKNOWN
        
        while self._running:
            try:
                # Check if in maintenance window
                if self._is_in_maintenance(check.name):
                    logger.debug(f"Skipping check {check.name} - in maintenance window")
                    await asyncio.sleep(check.check_interval_seconds)
                    continue
                
                # Perform check
                result = await self.perform_check(check)
                
                # Track consecutive failures
                if result.status == ServiceStatus.DOWN:
                    consecutive_failures += 1
                    result.consecutive_failures = consecutive_failures
                else:
                    if last_status == ServiceStatus.DOWN and result.status == ServiceStatus.UP:
                        # Service recovered
                        await self._send_recovery_alert(check.name)
                    consecutive_failures = 0
                    result.consecutive_failures = 0
                
                # Store result
                self.results[check.name].append(result)
                
                # Trim history (keep last 10000 results)
                if len(self.results[check.name]) > 10000:
                    self.results[check.name] = self.results[check.name][-5000:]
                
                # Update statistics
                result.total_checks = len(self.results[check.name])
                result.successful_checks = sum(
                    1 for r in self.results[check.name]
                    if r.status == ServiceStatus.UP
                )
                
                # Check alert conditions
                await self._evaluate_alerts(check, result)
                
                last_status = result.status
                
            except Exception as e:
                logger.error(f"Error in check loop for {check.name}: {e}")
            
            # Wait before next check
            await asyncio.sleep(check.check_interval_seconds)
    
    async def _evaluate_alerts(self, check: UptimeCheck, result: UptimeResult) -> None:
        """Evaluate and send alerts"""
        for alert_name, config in self.alert_configs.items():
            should_alert = False
            
            if config.condition == "consecutive_failures":
                if result.consecutive_failures >= config.threshold:
                    should_alert = True
            
            elif config.condition == "status_change":
                # Check if status changed from UP to DOWN
                if len(self.results[check.name]) > 1:
                    prev_result = self.results[check.name][-2]
                    if prev_result.status == ServiceStatus.UP and result.status == ServiceStatus.DOWN:
                        should_alert = True
            
            elif config.condition == "high_latency":
                if result.response_time_ms > config.threshold:
                    should_alert = True
            
            if should_alert:
                await self._send_alert(config, check, result)
    
    async def _send_alert(
        self,
        config: AlertConfig,
        check: UptimeCheck,
        result: UptimeResult
    ) -> None:
        """Send alert through configured channels"""
        alert_data = {
            "alert_name": config.name,
            "severity": config.severity,
            "service": check.name,
            "url": check.url,
            "status": result.status.value,
            "response_time_ms": result.response_time_ms,
            "error": result.error_message,
            "timestamp": result.timestamp.isoformat(),
            "consecutive_failures": result.consecutive_failures
        }
        
        for channel in config.channels:
            if channel in self.alert_handlers:
                try:
                    await self.alert_handlers[channel](alert_data)
                except Exception as e:
                    logger.error(f"Failed to send alert to {channel}: {e}")
    
    async def _send_recovery_alert(self, check_name: str) -> None:
        """Send recovery notification"""
        alert_data = {
            "type": "recovery",
            "service": check_name,
            "message": f"Service {check_name} has recovered",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to all handlers
        for channel, handler in self.alert_handlers.items():
            try:
                await handler(alert_data)
            except Exception as e:
                logger.error(f"Failed to send recovery alert to {channel}: {e}")
    
    def _is_in_maintenance(self, check_name: str) -> bool:
        """Check if service is in maintenance window"""
        now = datetime.utcnow()
        
        for window in self.maintenance_windows:
            if check_name in window.affected_services:
                if window.start <= now <= window.end:
                    return True
        
        return False
    
    async def start(self) -> None:
        """Start monitoring"""
        self._running = True
        
        # Start check loops
        for check in self.checks.values():
            task = asyncio.create_task(self._check_loop(check))
            self._tasks.append(task)
        
        logger.info(f"Uptime monitor started with {len(self.checks)} checks")
    
    async def stop(self) -> None:
        """Stop monitoring"""
        self._running = False
        
        # Cancel all tasks
        for task in self._tasks:
            task.cancel()
        
        # Wait for tasks to complete
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        
        self._tasks.clear()
        logger.info("Uptime monitor stopped")
    
    def get_status(self, check_name: Optional[str] = None) -> Dict:
        """Get current status"""
        if check_name:
            if check_name not in self.results or not self.results[check_name]:
                return {"status": "unknown"}
            
            latest = self.results[check_name][-1]
            return {
                "name": check_name,
                "status": latest.status.value,
                "response_time_ms": latest.response_time_ms,
                "last_check": latest.timestamp.isoformat(),
                "consecutive_failures": latest.consecutive_failures,
                "uptime_percentage": self._calculate_uptime(check_name, hours=24)
            }
        
        # Return all statuses
        return {
            name: self.get_status(name)
            for name in self.checks.keys()
        }
    
    def _calculate_uptime(self, check_name: str, hours: int = 24) -> float:
        """Calculate uptime percentage for given period"""
        if check_name not in self.results:
            return 0.0
        
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        recent_results = [
            r for r in self.results[check_name]
            if r.timestamp > cutoff
        ]
        
        if not recent_results:
            return 100.0
        
        up_count = sum(1 for r in recent_results if r.status == ServiceStatus.UP)
        return (up_count / len(recent_results)) * 100.0
    
    def get_history(
        self,
        check_name: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None
    ) -> List[UptimeResult]:
        """Get check history"""
        if check_name not in self.results:
            return []
        
        results = self.results[check_name]
        
        if start:
            results = [r for r in results if r.timestamp >= start]
        
        if end:
            results = [r for r in results if r.timestamp <= end]
        
        return results
    
    def generate_status_page(self) -> Dict:
        """Generate status page data"""
        now = datetime.utcnow()
        
        # Calculate overall status
        statuses = []
        for name in self.checks.keys():
            status = self.get_status(name)
            if isinstance(status, dict) and "status" in status:
                statuses.append(status["status"])
        
        overall_status = ServiceStatus.UP.value
        if any(s == ServiceStatus.DOWN.value for s in statuses):
            overall_status = ServiceStatus.DOWN.value
        elif any(s == ServiceStatus.DEGRADED.value for s in statuses):
            overall_status = ServiceStatus.DEGRADED.value
        
        return {
            "page_title": "OptiPlan 360 Status",
            "last_updated": now.isoformat(),
            "overall_status": overall_status,
            "services": [
                {
                    "name": name,
                    **self.get_status(name)
                }
                for name in self.checks.keys()
            ],
            "maintenance_windows": [
                {
                    "start": w.start.isoformat(),
                    "end": w.end.isoformat(),
                    "description": w.description,
                    "affected_services": w.affected_services
                }
                for w in self.maintenance_windows
                if w.end > now
            ]
        }


# Default checks for OptiPlan 360
DEFAULT_CHECKS = [
    UptimeCheck(
        name="API",
        url="https://api.optiplan360.com/api/v1/health",
        check_interval_seconds=30,
        alert_threshold_failures=2
    ),
    UptimeCheck(
        name="Frontend",
        url="https://optiplan360.com",
        check_interval_seconds=60,
        alert_threshold_failures=3
    ),
    UptimeCheck(
        name="Database",
        url="postgresql://healthcheck:check@postgres-service:5432/optiplan360",
        check_interval_seconds=30,
        alert_threshold_failures=2
    ),
    UptimeCheck(
        name="Redis",
        url="redis://redis-service:6379",
        check_interval_seconds=60,
        alert_threshold_failures=3
    ),
    UptimeCheck(
        name="AI Worker",
        url="http://ai-worker:8000/health",
        check_interval_seconds=60,
        alert_threshold_failures=5
    )
]


# Alert handlers

async def slack_alert_handler(alert_data: Dict) -> None:
    """Send alert to Slack"""
    import aiohttp
    
    webhook_url = "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
    
    color = "good" if alert_data.get("type") == "recovery" else "danger"
    if alert_data.get("severity") == "warning":
        color = "warning"
    
    message = {
        "attachments": [
            {
                "color": color,
                "title": f"OptiPlan 360 Alert: {alert_data.get('service', 'Unknown')}",
                "text": alert_data.get("error") or alert_data.get("message", "Alert triggered"),
                "fields": [
                    {
                        "title": "Status",
                        "value": alert_data.get("status", "unknown"),
                        "short": True
                    },
                    {
                        "title": "Response Time",
                        "value": f"{alert_data.get('response_time_ms', 0):.0f}ms",
                        "short": True
                    }
                ],
                "footer": "OptiPlan 360 Monitoring",
                "ts": int(time.time())
            }
        ]
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(webhook_url, json=message) as response:
            if response.status != 200:
                logger.error(f"Failed to send Slack alert: {response.status}")


async def email_alert_handler(alert_data: Dict) -> None:
    """Send alert via email"""
    # Implement email sending logic
    logger.info(f"Email alert would be sent: {alert_data}")


async def pagerduty_alert_handler(alert_data: Dict) -> None:
    """Send alert to PagerDuty"""
    # Implement PagerDuty integration
    logger.info(f"PagerDuty alert would be sent: {alert_data}")


# Global uptime monitor
uptime_monitor: Optional[UptimeMonitor] = None

def init_uptime_monitor(
    checks: Optional[List[UptimeCheck]] = None,
    alert_configs: Optional[List[AlertConfig]] = None
) -> UptimeMonitor:
    """Initialize global uptime monitor"""
    global uptime_monitor
    
    uptime_monitor = UptimeMonitor(checks or DEFAULT_CHECKS, alert_configs)
    
    # Register default handlers
    uptime_monitor.register_alert_handler("slack", slack_alert_handler)
    uptime_monitor.register_alert_handler("email", email_alert_handler)
    uptime_monitor.register_alert_handler("pagerduty", pagerduty_alert_handler)
    
    return uptime_monitor

def get_uptime_monitor() -> UptimeMonitor:
    """Get global uptime monitor"""
    if uptime_monitor is None:
        raise RuntimeError("Uptime monitor not initialized")
    return uptime_monitor
