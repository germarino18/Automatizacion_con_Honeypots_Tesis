"""Auth DTOs."""

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    user: str
    expires_in: int
    token: str | None = None


class LogoutResponse(BaseModel):
    message: str