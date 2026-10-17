"""Request-scoped configuration; concurrent requests never share active overrides."""

from contextvars import ContextVar
from typing import Any

current_policy: ContextVar[dict[str, Any] | None] = ContextVar("gamebuddy_policy", default=None)
offline_mode: ContextVar[bool] = ContextVar("gamebuddy_offline", default=False)
public_request: ContextVar[bool] = ContextVar("gamebuddy_public_request", default=False)
