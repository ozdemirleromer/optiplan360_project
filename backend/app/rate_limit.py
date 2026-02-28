"""
OptiPlan 360 — Rate Limiter Singleton
Circular import önlemek için main.py'den bağımsız tutulur.
Router'lar buradan import eder.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
