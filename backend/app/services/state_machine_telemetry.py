"""
State Machine Telemetry and Dashboard Service
Real-time monitoring and visualization of state machine transitions
"""

import logging
import asyncio
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import json
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


class StateMachineType(Enum):
    """State machine types"""
    OCR_PROCESSING = "ocr_processing"
    ORDER_VALIDATION = "order_validation"
    EXPORT_PROCESSING = "export_processing"
    CUSTOMER_WORKFLOW = "customer_workflow"
    STOCK_MANAGEMENT = "stock_management"


class StateTransitionType(Enum):
    """State transition types"""
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    RETRY = "retry"
    MANUAL_INTERVENTION = "manual_intervention"


@dataclass
class StateTransition:
    """State transition event"""
    machine_id: str
    machine_type: StateMachineType
    from_state: str
    to_state: str
    transition_type: StateTransitionType
    timestamp: datetime
    duration_ms: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    user_id: Optional[str] = None
    session_id: Optional[str] = None


@dataclass
class StateMachineMetrics:
    """State machine performance metrics"""
    machine_id: str
    machine_type: StateMachineType
    current_state: str
    total_transitions: int = 0
    success_transitions: int = 0
    error_transitions: int = 0
    timeout_transitions: int = 0
    avg_transition_time_ms: float = 0.0
    last_transition: Optional[datetime] = None
    active_duration_ms: float = 0.0
    error_rate: float = 0.0
    throughput_per_hour: float = 0.0


@dataclass
class TelemetryConfig:
    """Telemetry configuration"""
    retention_days: int = 30
    max_transitions_per_machine: int = 10000
    aggregation_interval_seconds: int = 60
    alert_thresholds: Dict[str, float] = field(default_factory=lambda: {
        'error_rate': 0.1,  # 10%
        'avg_transition_time': 5000,  # 5 seconds
        'timeout_rate': 0.05,  # 5%
        'throughput_drop': 0.5,  # 50% drop
    })


class StateMachineTelemetry:
    """State machine telemetry service"""
    
    def __init__(self, config: TelemetryConfig = None):
        self.config = config or TelemetryConfig()
        self.transitions: List[StateTransition] = []
        self.metrics: Dict[str, StateMachineMetrics] = {}
        self.active_sessions: Dict[str, datetime] = {}
        self.alert_handlers: List[Callable] = []
        self.dashboard_data: Dict[str, Any] = defaultdict(dict)
        
        # Performance tracking
        self.transition_times = defaultdict(list)
        self.state_durations = defaultdict(list)
        self.error_counts = defaultdict(int)
        
        # Real-time metrics
        self.realtime_metrics = {
            'transitions_per_second': deque(maxlen=300),  # 5 minutes
            'active_machines': 0,
            'error_rate_5min': 0.0,
            'avg_response_time_5min': 0.0,
        }
    
    def record_transition(self, transition: StateTransition) -> None:
        """Record a state transition"""
        # Store transition
        self.transitions.append(transition)
        
        # Update metrics
        if transition.machine_id not in self.metrics:
            self.metrics[transition.machine_id] = StateMachineMetrics(
                machine_id=transition.machine_id,
                machine_type=transition.machine_type,
                current_state=transition.to_state
            )
        
        metrics = self.metrics[transition.machine_id]
        metrics.total_transitions += 1
        metrics.last_transition = transition.timestamp
        
        # Update transition counts
        if transition.transition_type == StateTransitionType.SUCCESS:
            metrics.success_transitions += 1
        elif transition.transition_type == StateTransitionType.ERROR:
            metrics.error_transitions += 1
        elif transition.transition_type == StateTransitionType.TIMEOUT:
            metrics.timeout_transitions += 1
        
        # Update transition time
        self.transition_times[transition.machine_id].append(transition.duration_ms)
        metrics.avg_transition_time_ms = sum(self.transition_times[transition.machine_id]) / len(self.transition_times[transition.machine_id])
        
        # Update error rate
        total = metrics.total_transitions
        errors = metrics.error_transitions + metrics.timeout_transitions
        metrics.error_rate = errors / total if total > 0 else 0.0
        
        # Update throughput
        if metrics.last_transition:
            time_window = datetime.utcnow() - metrics.last_transition.replace(tzinfo=None)
            hours = max(time_window.total_seconds() / 3600, 0.1)  # Avoid division by zero
            metrics.throughput_per_hour = metrics.total_transitions / hours
        
        # Update real-time metrics
        self._update_realtime_metrics(transition)
        
        # Check for alerts
        self._check_alerts(metrics)
        
        # Update dashboard data
        self._update_dashboard_data(transition)
        
        # Cleanup old data
        self._cleanup_old_data()
        
        logger.info(f"State transition recorded: {transition.machine_id} {transition.from_state} -> {transition.to_state}")
    
    def _update_realtime_metrics(self, transition: StateTransition) -> None:
        """Update real-time metrics"""
        now = datetime.utcnow()
        
        # Add to transitions per second
        self.realtime_metrics['transitions_per_second'].append(now)
        
        # Calculate metrics for last 5 minutes
        five_minutes_ago = now - timedelta(minutes=5)
        recent_transitions = [t for t in self.realtime_metrics['transitions_per_second'] if t > five_minutes_ago]
        
        if recent_transitions:
            self.realtime_metrics['transitions_per_second'] = len(recent_transitions) / 300  # 5 minutes = 300 seconds
        
        # Update active machines count
        self.realtime_metrics['active_machines'] = len(self.active_sessions)
    
    def _check_alerts(self, metrics: StateMachineMetrics) -> None:
        """Check for alert conditions"""
        alerts = []
        
        # Error rate alert
        if metrics.error_rate > self.config.alert_thresholds['error_rate']:
            alerts.append({
                'type': 'error_rate',
                'machine_id': metrics.machine_id,
                'value': metrics.error_rate,
                'threshold': self.config.alert_thresholds['error_rate'],
                'message': f"Error rate ({metrics.error_rate:.2%}) exceeds threshold ({self.config.alert_thresholds['error_rate']:.2%})"
            })
        
        # Performance alert
        if metrics.avg_transition_time_ms > self.config.alert_thresholds['avg_transition_time']:
            alerts.append({
                'type': 'performance',
                'machine_id': metrics.machine_id,
                'value': metrics.avg_transition_time_ms,
                'threshold': self.config.alert_thresholds['avg_transition_time'],
                'message': f"Average transition time ({metrics.avg_transition_time_ms:.0f}ms) exceeds threshold ({self.config.alert_thresholds['avg_transition_time']}ms)"
            })
        
        # Throughput alert
        expected_throughput = self._get_expected_throughput(metrics.machine_type)
        if metrics.throughput_per_hour < expected_throughput * self.config.alert_thresholds['throughput_drop']:
            alerts.append({
                'type': 'throughput',
                'machine_id': metrics.machine_id,
                'value': metrics.throughput_per_hour,
                'threshold': expected_throughput * self.config.alert_thresholds['throughput_drop'],
                'message': f"Throughput ({metrics.throughput_per_hour:.1f}/hr) below expected ({expected_throughput * self.config.alert_thresholds['throughput_drop']:.1f}/hr)"
            })
        
        # Trigger alert handlers
        for alert in alerts:
            for handler in self.alert_handlers:
                try:
                    handler(alert)
                except Exception as e:
                    logger.error(f"Alert handler error: {e}")
    
    def _get_expected_throughput(self, machine_type: StateMachineType) -> float:
        """Get expected throughput for machine type"""
        throughput_expectations = {
            StateMachineType.OCR_PROCESSING: 100,  # 100 transitions per hour
            StateMachineType.ORDER_VALIDATION: 200,
            StateMachineType.EXPORT_PROCESSING: 50,
            StateMachineType.CUSTOMER_WORKFLOW: 150,
            StateMachineType.STOCK_MANAGEMENT: 300,
        }
        return throughput_expectations.get(machine_type, 100)
    
    def _update_dashboard_data(self, transition: StateTransition) -> None:
        """Update dashboard data"""
        machine_id = transition.machine_id
        
        # Update state counts
        if transition.to_state not in self.dashboard_data[machine_id]['state_counts']:
            self.dashboard_data[machine_id]['state_counts'][transition.to_state] = 0
        self.dashboard_data[machine_id]['state_counts'][transition.to_state] += 1
        
        # Update transition timeline
        if 'timeline' not in self.dashboard_data[machine_id]:
            self.dashboard_data[machine_id]['timeline'] = []
        
        self.dashboard_data[machine_id]['timeline'].append({
            'timestamp': transition.timestamp.isoformat(),
            'from_state': transition.from_state,
            'to_state': transition.to_state,
            'type': transition.transition_type.value,
            'duration_ms': transition.duration_ms
        })
        
        # Keep only last 100 transitions in timeline
        self.dashboard_data[machine_id]['timeline'] = self.dashboard_data[machine_id]['timeline'][-100:]
        
        # Update performance metrics
        self.dashboard_data[machine_id]['performance'] = {
            'avg_transition_time_ms': self.metrics[machine_id].avg_transition_time_ms,
            'error_rate': self.metrics[machine_id].error_rate,
            'throughput_per_hour': self.metrics[machine_id].throughput_per_hour,
            'total_transitions': self.metrics[machine_id].total_transitions,
            'success_rate': self.metrics[machine_id].success_transitions / self.metrics[machine_id].total_transitions if self.metrics[machine_id].total_transitions > 0 else 0
        }
    
    def start_session(self, machine_id: str, session_id: str, user_id: Optional[str] = None) -> None:
        """Start a state machine session"""
        self.active_sessions[f"{machine_id}:{session_id}"] = datetime.utcnow()
        
        # Update metrics
        if machine_id not in self.metrics:
            self.metrics[machine_id] = StateMachineMetrics(
                machine_id=machine_id,
                machine_type=StateMachineType.OCR_PROCESSING  # Default
            )
        
        logger.info(f"Session started: {machine_id}:{session_id}")
    
    def end_session(self, machine_id: str, session_id: str) -> Optional[float]:
        """End a state machine session and return duration"""
        session_key = f"{machine_id}:{session_id}"
        
        if session_key in self.active_sessions:
            start_time = self.active_sessions[session_key]
            duration = (datetime.utcnow() - start_time).total_seconds() * 1000  # Convert to milliseconds
            
            # Update metrics
            if machine_id in self.metrics:
                self.metrics[machine_id].active_duration_ms += duration
            
            del self.active_sessions[session_key]
            
            logger.info(f"Session ended: {machine_id}:{session_id}, duration: {duration:.0f}ms")
            return duration
        
        return None
    
    def add_alert_handler(self, handler: Callable) -> None:
        """Add alert handler function"""
        self.alert_handlers.append(handler)
    
    def get_metrics(self, machine_id: Optional[str] = None) -> Dict[str, Any]:
        """Get telemetry metrics"""
        if machine_id:
            if machine_id in self.metrics:
                return {
                    'machine_id': machine_id,
                    'metrics': self.metrics[machine_id],
                    'dashboard_data': self.dashboard_data.get(machine_id, {})
                }
            else:
                return {'error': f'Machine {machine_id} not found'}
        else:
            return {
                'all_metrics': self.metrics,
                'realtime_metrics': self.realtime_metrics,
                'total_transitions': len(self.transitions),
                'active_sessions': len(self.active_sessions)
            }
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get dashboard data for frontend"""
        dashboard = {
            'overview': {
                'total_machines': len(self.metrics),
                'active_sessions': len(self.active_sessions),
                'total_transitions': len(self.transitions),
                'error_rate': self._calculate_global_error_rate(),
                'avg_transition_time': self._calculate_global_avg_time(),
            },
            'machines': {}
        }
        
        for machine_id, metrics in self.metrics.items():
            dashboard['machines'][machine_id] = {
                'type': metrics.machine_type.value,
                'current_state': metrics.current_state,
                'performance': self.dashboard_data.get(machine_id, {}).get('performance', {}),
                'timeline': self.dashboard_data.get(machine_id, {}).get('timeline', [])[-20:],  # Last 20 transitions
                'state_distribution': self.dashboard_data.get(machine_id, {}).get('state_counts', {}),
            }
        
        return dashboard
    
    def get_performance_report(self, hours: int = 24) -> Dict[str, Any]:
        """Generate performance report for specified time period"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        recent_transitions = [t for t in self.transitions if t.timestamp > cutoff_time]
        
        if not recent_transitions:
            return {'error': 'No transitions found in specified period'}
        
        # Calculate metrics
        machine_performance = defaultdict(lambda: {
            'total_transitions': 0,
            'success_transitions': 0,
            'error_transitions': 0,
            'total_duration_ms': 0,
            'states_visited': set(),
            'most_common_state': None,
            'avg_duration_ms': 0
        })
        
        for transition in recent_transitions:
            perf = machine_performance[transition.machine_id]
            perf['total_transitions'] += 1
            perf['total_duration_ms'] += transition.duration_ms
            perf['states_visited'].add(transition.to_state)
            
            if transition.transition_type == StateTransitionType.SUCCESS:
                perf['success_transitions'] += 1
            elif transition.transition_type in [StateTransitionType.ERROR, StateTransitionType.TIMEOUT]:
                perf['error_transitions'] += 1
        
        # Calculate derived metrics
        for machine_id, perf in machine_performance.items():
            if perf['total_transitions'] > 0:
                perf['avg_duration_ms'] = perf['total_duration_ms'] / perf['total_transitions']
                perf['success_rate'] = perf['success_transitions'] / perf['total_transitions']
                perf['error_rate'] = perf['error_transitions'] / perf['total_transitions']
                
                # Find most common state
                state_counts = defaultdict(int)
                for transition in recent_transitions:
                    if transition.machine_id == machine_id:
                        state_counts[transition.to_state] += 1
                
                if state_counts:
                    perf['most_common_state'] = max(state_counts, key=state_counts.get)
        
        return {
            'period_hours': hours,
            'total_transitions': len(recent_transitions),
            'machine_performance': dict(machine_performance),
            'generated_at': datetime.utcnow().isoformat()
        }
    
    def _calculate_global_error_rate(self) -> float:
        """Calculate global error rate"""
        total_transitions = sum(m.total_transitions for m in self.metrics.values())
        total_errors = sum(m.error_transitions + m.timeout_transitions for m in self.metrics.values())
        
        return total_errors / total_transitions if total_transitions > 0 else 0.0
    
    def _calculate_global_avg_time(self) -> float:
        """Calculate global average transition time"""
        all_times = []
        for times in self.transition_times.values():
            all_times.extend(times)
        
        return sum(all_times) / len(all_times) if all_times else 0.0
    
    def _cleanup_old_data(self) -> None:
        """Clean up old data based on retention policy"""
        cutoff_date = datetime.utcnow() - timedelta(days=self.config.retention_days)
        
        # Clean up old transitions
        self.transitions = [t for t in self.transitions if t.timestamp > cutoff_date]
        
        # Clean up old transition times
        for machine_id in list(self.transition_times.keys()):
            self.transition_times[machine_id] = [
                t for t in self.transition_times[machine_id] 
                if datetime.fromtimestamp(t / 1000) > cutoff_date
            ]
            
            if not self.transition_times[machine_id]:
                del self.transition_times[machine_id]
        
        # Clean up old active sessions
        expired_sessions = [
            key for key, start_time in self.active_sessions.items()
            if start_time < cutoff_date
        ]
        
        for session_key in expired_sessions:
            del self.active_sessions[session_key]
        
        # Limit transitions per machine
        for machine_id in list(self.metrics.keys()):
            machine_transitions = [t for t in self.transitions if t.machine_id == machine_id]
            if len(machine_transitions) > self.config.max_transitions_per_machine:
                # Keep only recent transitions
                self.transitions = [t for t in self.transitions if t.machine_id != machine_id] + machine_transitions[-self.config.max_transitions_per_machine:]


# Global telemetry instance
telemetry = StateMachineTelemetry()

# Telemetry API endpoints
def get_telemetry_overview() -> Dict[str, Any]:
    """Get telemetry overview for dashboard"""
    return telemetry.get_dashboard_data()

def get_machine_metrics(machine_id: str) -> Dict[str, Any]:
    """Get metrics for specific machine"""
    return telemetry.get_metrics(machine_id)

def get_performance_report(hours: int = 24) -> Dict[str, Any]:
    """Get performance report"""
    return telemetry.get_performance_report(hours)

def start_machine_session(machine_id: str, session_id: str, user_id: Optional[str] = None) -> None:
    """Start machine session"""
    telemetry.start_session(machine_id, session_id, user_id)

def end_machine_session(machine_id: str, session_id: str) -> Optional[float]:
    """End machine session"""
    return telemetry.end_session(machine_id, session_id)

def record_state_transition(
    machine_id: str,
    machine_type: StateMachineType,
    from_state: str,
    to_state: str,
    transition_type: StateTransitionType,
    duration_ms: float,
    metadata: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None
) -> None:
    """Record state transition"""
    transition = StateTransition(
        machine_id=machine_id,
        machine_type=machine_type,
        from_state=from_state,
        to_state=to_state,
        transition_type=transition_type,
        timestamp=datetime.utcnow(),
        duration_ms=duration_ms,
        metadata=metadata or {},
        user_id=user_id,
        session_id=session_id
    )
    
    telemetry.record_transition(transition)

def add_telemetry_alert_handler(handler: Callable) -> None:
    """Add telemetry alert handler"""
    telemetry.add_alert_handler(handler)

# Export telemetry instance
__all__ = [
    'telemetry',
    'get_telemetry_overview',
    'get_machine_metrics', 
    'get_performance_report',
    'start_machine_session',
    'end_machine_session',
    'record_state_transition',
    'add_telemetry_alert_handler',
    'StateMachineType',
    'StateTransitionType',
    'StateTransition',
    'StateMachineMetrics',
    'TelemetryConfig',
    'StateMachineTelemetry',
]
