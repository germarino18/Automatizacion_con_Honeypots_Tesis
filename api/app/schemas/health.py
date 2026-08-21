"""Health endpoints DTOs."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    api: str
    postgres: str


class ServiceHealth(BaseModel):
    status: str
    detail: str | None = None


class ServicesHealthResponse(BaseModel):
    status: str
    services: dict[str, ServiceHealth]