"""Event-related DTOs (explorer + detail)."""

from datetime import datetime

from pydantic import BaseModel, Field

from .responses import ResponseItem

SEVERITY_VALUES = ("low", "medium", "high", "critical")


class EventFilterParams(BaseModel):
    from_: datetime | None = Field(default=None, alias="from")
    to: datetime | None = None
    source_honeypot: str | None = None
    protocol: str | None = None
    src_ip: str | None = None
    severity: str | None = None
    technique: str | None = None
    username: str | None = None
    search: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=100)

    model_config = {"populate_by_name": True}


class EventItem(BaseModel):
    id: int
    timestamp: datetime
    source_honeypot: str
    src_ip: str
    dst_port: int | None = None
    protocol: str | None = None
    username: str | None = None
    commands: str | None = None
    malware_hash: str | None = None
    malware_filename: str | None = None
    playbook_id: str | None = None
    risk_score: float | None = None
    att_ck_technique: str | None = None
    severity: str
    enrichment_data: dict | None = None
    raw_data: dict | None = None
    created_at: datetime | None = None


class EventPage(BaseModel):
    items: list[EventItem]
    total: int
    page: int
    page_size: int


class EventDetail(EventItem):
    responses: list[ResponseItem] = []