"""
Application Monitoring ve Logging Sistemi
Production monitoring, metrics ve alerting
"""

import time
import logging
import psutil
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import deque

logger = logging.getLogger(__name__)


@dataclass
class MetricPoint:
    """Metric veri noktası"""
    timestamp: float
    value: float
    labels: Dict[str, str] = field(default_factory=dict)


class MetricsCollector:
    """Metrics toplama ve saklama"""
    
    def __init__(self, max_points: int = 1000):
        self.metrics: Dict[str, deque] = {}
        self.max_points = max_points
    
    def record(self, name: str, value: float, labels: Optional[Dict[str, str]] = None):
        """Metric kaydet"""
        if name not in self.metrics:
            self.metrics[name] = deque(maxlen=self.max_points)
        
        self.metrics[name].append(MetricPoint(
            timestamp=time.time(),
            value=value,
            labels=labels or {}
        ))
    
    def get_metric_summary(self, name: str, duration_seconds: int = 300) -> Dict[str, Any]:
        """Metric özetini al"""
        if name not in self.metrics:
            return {"exists": False}
        
        cutoff = time.time() - duration_seconds
        points = [p for p in self.metrics[name] if p.timestamp > cutoff]
        
        if not points:
            return {"exists": True, "count": 0}
        
        values = [p.value for p in points]
        
        return {
            "exists": True,
            "count": len(values),
            "min": min(values),
            "max": max(values),
            "avg": sum(values) / len(values),
            "latest": values[-1]
        }


class SystemMonitor:
    """Sistem kaynak monitoring"""
    
    def __init__(self):
        self.metrics = MetricsCollector()
        self.start_time = time.time()
    
    def collect_system_metrics(self) -> Dict[str, Any]:
        """Sistem metriklerini topla"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            metrics = {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_available_mb": memory.available / (1024 * 1024),
                "memory_used_mb": memory.used / (1024 * 1024),
                "disk_percent": disk.percent,
                "disk_free_gb": disk.free / (1024 * 1024 * 1024),
                "uptime_seconds": time.time() - self.start_time
            }
            
            # Metric kaydet
            for key, value in metrics.items():
                if isinstance(value, (int, float)):
                    self.metrics.record(f"system_{key}", value)
            
            return metrics
            
        except Exception as e:
            logger.error(f"[MONITOR] System metrics collection failed: {e}")
            return {"error": str(e)}
    
    def get_health_status(self) -> Dict[str, Any]:
        """Sağlık durumunu kontrol et"""
        metrics = self.collect_system_metrics()
        
        checks = {
            "cpu_ok": metrics.get("cpu_percent", 0) < 80,
            "memory_ok": metrics.get("memory_percent", 0) < 85,
            "disk_ok": metrics.get("disk_percent", 0) < 90,
        }
        
        all_ok = all(checks.values())
        
        return {
            "healthy": all_ok,
            "checks": checks,
            "metrics": metrics,
            "timestamp": datetime.utcnow().isoformat()
        }


class ApplicationMonitor:
    """Uygulama monitoring servisi"""
    
    def __init__(self):
        self.system_monitor = SystemMonitor()
        self.request_metrics = MetricsCollector()
        self.error_counts: Dict[str, int] = {}
        self.alert_thresholds = {
            "cpu_percent": 80,
            "memory_percent": 85,
            "disk_percent": 90,
            "error_rate": 10  # %10'dan fazla hata
        }
    
    def record_request(self, endpoint: str, duration_ms: float, status_code: int):
        """API isteği kaydet"""
        self.request_metrics.record(
            "request_duration_ms",
            duration_ms,
            {"endpoint": endpoint, "status": str(status_code)}
        )
        
        if status_code >= 400:
            self.record_error(f"http_{status_code}", endpoint)
    
    def record_error(self, error_type: str, context: str = ""):
        """Hata kaydet"""
        key = f"{error_type}:{context}"
        self.error_counts[key] = self.error_counts.get(key, 0) + 1
        
        self.request_metrics.record("errors", 1, {"type": error_type, "context": context})
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Monitoring dashboard verisi"""
        system_health = self.system_monitor.get_health_status()
        
        # Request metrics
        request_summary = self.request_metrics.get_metric_summary("request_duration_ms", 300)
        error_summary = self.request_metrics.get_metric_summary("errors", 300)
        
        # Alert kontrolü
        alerts = []
        
        if not system_health["checks"].get("cpu_ok", True):
            alerts.append({"level": "warning", "message": "CPU kullanımı yüksek"})
        
        if not system_health["checks"].get("memory_ok", True):
            alerts.append({"level": "warning", "message": "Bellek kullanımı yüksek"})
        
        if not system_health["checks"].get("disk_ok", True):
            alerts.append({"level": "critical", "message": "Disk kullanımı yüksek"})
        
        return {
            "system_health": system_health,
            "requests": request_summary,
            "errors": error_summary,
            "alerts": alerts,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def check_alerts(self) -> List[Dict[str, Any]]:
        """Alert kontrolü yap"""
        alerts = []
        health = self.system_monitor.get_health_status()
        metrics = health.get("metrics", {})
        
        for metric, threshold in self.alert_thresholds.items():
            current_value = metrics.get(metric, 0)
            if current_value > threshold:
                alerts.append({
                    "level": "warning" if metric != "disk_percent" else "critical",
                    "metric": metric,
                    "current_value": current_value,
                    "threshold": threshold,
                    "message": f"{metric} eşiği aşıldı: {current_value:.1f}% > {threshold}%"
                })
        
        return alerts


# Global instance
_monitor = None


def get_monitor() -> ApplicationMonitor:
    """Monitoring servisi singleton"""
    global _monitor
    
    if _monitor is None:
        _monitor = ApplicationMonitor()
    
    return _monitor
