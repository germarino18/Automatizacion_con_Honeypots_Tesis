"""Responses (automation history) DTOs."""

from datetime import datetime

from pydantic import BaseModel, Field


class ResponseItem(BaseModel):
    id: int
    event_id: int | None = None
    timestamp: datetime | None = None
    action_type: str
    actor: str | None = None
    status: str | None = None
    evidence_uri: str | None = None
    details: dict | None = None
    created_at: datetime | None = None


class ResponseFilterParams(BaseModel):
    action_type: str | None = None
    status: str | None = None
    event_id: int | None = None
    from_: datetime | None = Field(default=None, alias="from")
    to: datetime | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)

    model_config = {"populate_by_name": True}


class ResponsePage(BaseModel):
    items: list[ResponseItem]
    total: int
    page: int
    page_size: int