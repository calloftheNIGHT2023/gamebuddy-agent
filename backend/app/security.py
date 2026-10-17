"""Small, fail-closed access boundary for the single-operator public demo.

Anonymous visitors can use stateless analysis. A server-held bearer token unlocks
the existing private developer features; this is not multi-user authentication.
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from secrets import compare_digest

from fastapi import HTTPException, Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import settings
from app.models.schemas import UserProfile
from app.services.runtime import public_request


@dataclass(frozen=True)
class RequestAccess:
    is_public: bool


def _admin_token() -> str:
    token = settings.admin_token
    return token.get_secret_value() if token is not None else ""


def private_access_status() -> str:
    if not settings.is_production:
        return "local"
    return "configured" if _admin_token() else "disabled"


def _is_admin(request: Request) -> bool:
    if not settings.is_production:
        return True
    header = request.headers.get("authorization", "")
    if not header:
        return False
    scheme, separator, supplied = header.partition(" ")
    configured = _admin_token()
    if not separator or scheme.casefold() != "bearer" or not supplied or not configured or not compare_digest(
        supplied.encode("utf-8"), configured.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Invalid administrator credentials.", headers={"WWW-Authenticate": "Bearer"})
    return True


async def request_access(request: Request) -> AsyncIterator[RequestAccess]:
    # An async dependency runs in the parent task; sync route handlers inherit
    # its ContextVar state when FastAPI dispatches them into the thread pool.
    access = RequestAccess(is_public=not _is_admin(request))
    token = public_request.set(access.is_public)
    try:
        yield access
    finally:
        public_request.reset(token)


async def require_private_access(request: Request) -> None:
    if settings.is_production and not _admin_token():
        raise HTTPException(status_code=503, detail="Private access is disabled: administrator token is not configured.")
    if not _is_admin(request):
        raise HTTPException(status_code=401, detail="Administrator authentication is required.", headers={"WWW-Authenticate": "Bearer"})


def public_profile(profile: UserProfile | None) -> UserProfile | None:
    # Identifiers are not proof of ownership. Public preferences last one request.
    return profile.model_copy(update={"user_id": None}, deep=True) if profile else None


def public_policy_id(requested: str | None) -> str:
    if requested not in (None, "builtin-v1"):
        raise HTTPException(status_code=403, detail="Anonymous requests can only use the built-in public policy.")
    return "builtin-v1"


class RequestBodyLimitMiddleware:
    """Bound received bytes, including chunked requests and multipart overhead.

    Content-Length is only an early check. The stream is independently counted
    before parsing, then replayed intact so JSON and multipart behave normally.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        maximum = settings.max_request_bytes
        declared = next((value for key, value in scope.get("headers", []) if key.lower() == b"content-length"), None)
        if declared is not None:
            try:
                length = int(declared)
            except ValueError:
                length = -1
            if length < 0:
                await JSONResponse({"detail": "Invalid Content-Length header."}, status_code=400)(scope, receive, send)
                return
            if length > maximum:
                await self._too_large(scope, receive, send)
                return
        chunks: list[bytes] = []
        total = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            total += len(chunk)
            if total > maximum:
                await self._too_large(scope, receive, send)
                return
            chunks.append(chunk)
            if not message.get("more_body", False):
                break
        body = b"".join(chunks)
        replayed = False

        async def replay() -> Message:
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)

    @staticmethod
    async def _too_large(scope: Scope, receive: Receive, send: Send) -> None:
        await JSONResponse({"detail": "Request body exceeds the allowed size limit."}, status_code=413)(scope, receive, send)
