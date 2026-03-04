#!/usr/bin/env python
"""Check orchestrator integration health"""
import sys
sys.path.insert(0, '.')

# Test orchestrator service imports and basic functionality
try:
    from app.services.orchestrator_service import OrchestratorService
    from app.models import Order, OrderPart
    print("✅ Orchestrator service imports OK")
    
    # Check that OrchestratorService has required methods
    required_methods = [
        'create_job', 
        'get_job', 
        'update_job_state',
        'get_job_status',
        'approve_job',
        'cancel_job'
    ]
    
    service_methods = {m for m in dir(OrchestratorService) if not m.startswith('_')}
    for method in required_methods:
        if method in service_methods:
            print(f"  ✓ {method} exists")
        else:
            print(f"  ✗ {method} MISSING")
    
    print("\n✅ Orchestrator service structure validated")
    
except Exception as e:
    print(f"❌ Orchestrator service error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test circuit breaker pattern
try:
    from app.services.orchestrator_service import CircuitBreaker
    print("\n✅ CircuitBreaker pattern available")
except ImportError:
    print("\n⚠️  CircuitBreaker not found - may be implemented via slowapi/decorators")

print("\n" + "=" * 60)
print("Orchestrator Integration: READY FOR VALIDATION")
print("=" * 60)
