"""Compatibility wrapper: use feature-sliced admin router module."""

from app.features.admin.transport.http.router import *  # noqa: F401,F403
from app.features.admin.transport.http.router import _normalize_user_role, _to_user_out
