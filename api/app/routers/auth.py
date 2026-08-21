"""Session auth endpoints (design D3, spec api-soc).

POST /api/v1/auth/login  - validate credentials, set HttpOnly SameSite=Lax
                           cookie `session` with the JWT, return 200.
POST /api/v1/auth/logout - clear the session cookie, return 200.

NEVER log credentials or tokens in this module.
"""

from fastapi import APIRouter, HTTPException, Response

from .. import config
from ..schemas.auth import LoginRequest, LoginResponse, LogoutResponse
from ..services.auth import SESSION_COOKIE, create_token, verify_credentials

router = APIRouter()


@router.post("/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest, response: Response):
    if not verify_credentials(body.username, body.password):
        raise HTTPException(
            status_code=401, detail="Credenciales inválidas"
        )
    token = create_token(body.username)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=config.settings.jwt_expires_minutes * 60,
        path="/",
    )
    return LoginResponse(
        user=body.username,
        expires_in=config.settings.jwt_expires_minutes * 60,
        token=token,
    )


@router.post("/auth/logout", response_model=LogoutResponse)
async def logout(response: Response):
    response.delete_cookie(key=SESSION_COOKIE, path="/")
    return LogoutResponse(message="Sesión cerrada")