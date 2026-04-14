"""Pytest configuration for backend tests.

Ensures that the 'app' module can be imported from the backend directory.
"""

import sys
from pathlib import Path

# Add backend root to Python path so tests can import 'app' module
backend_root = Path(__file__).parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))
