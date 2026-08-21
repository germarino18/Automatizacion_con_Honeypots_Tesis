"""Session JWT authentication (design D3, spec api-soc).

Credentials are compared in constant time with hmac.compare_digest and
neither credentials nor tokens are ever logged. JWT is signed with
SOC_JWT_SECRET; if the secret is missing the service fails closed.
"""

import hmac
import time

import jwt
from fastapi import HTTPException, Request
from fastapi.security import APIKeyCookie

from .. import config

ALGORITHM = "HS256"
SESSION_COOKIE = "session"

cookie_scheme = APIKeyCookie(
    name=SESSION_COOKIE,
    scheme_name="SessionCookieAuth",
    description="Sesión JWT establecida en /auth/login",
    auto_error=False,
)

AUTH_ERROR_RESPONSES = {401: {"description": "No autenticado"}}


class InvalidTokenError(Exception):
    pass


def verify_credentials(username: str | None, password: str | None) -> bool:
    cfg = config.settings
    if not cfg.soc_admin_user or not cfg.soc_admin_password:
        return False
    user_ok = hmac.compare_digest(
        username or "", cfg.soc_admin_user
    )
    pass_ok = hmac.compare_digest(
        password or "", cfg.soc_admin_password
    )
    return user_ok and pass_ok


def create_token(sub: str, expires_minutes: int | None = None) -> str:
    cfg = config.settings
    if not cfg.soc_jwt_secret:
        raise RuntimeError("SOC_JWT_SECRET is not configured")
    now = int(time.time())
    minutes = expires_minutes if expires_minutes is not None else cfg.jwt_expires_minutes
    payload = {"sub": sub, "iat": now, "exp": now + minutes * 60}
    return jwt.encode(payload, cfg.soc_jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    cfg = config.settings
    if not cfg.soc_jwt_secret:
        raise InvalidTokenError("SOC_JWT_SECRET is not configured")
    try:
        return jwt.decode(token, cfg.soc_jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise InvalidTokenError("token invalid or expired") from exc


def token_from_request(request: Request) -> str | None:
    """Read the session cookie first, then the Authorization: Bearer header."""
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        return token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return None


def require_auth(request: Request) -> str:
    """FastAPI dependency: reject requests without a valid token with 401."""
    token = token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = decode_token(token)
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    return payload.get("sub", "unknown")