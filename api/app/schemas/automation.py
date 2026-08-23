"""Automation (n8n integration) DTOs.

Validation rules per spec automatizacion-web:
* simulate    - ``honeypot`` must be cowrie|dionaea (422 otherwise)
* block-ip    - ``src_ip`` must be a valid IP (422 otherwise)
* create-ticket - ``name``/``content`` must be non-blank (422 otherwise)
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, IPvAnyAddress, field_validator


class WorkflowItem(BaseModel):
    id: int | str
    name: str
    active: bool
    updated_at: datetime | None = None


class WorkflowsResponse(BaseModel):
    degraded: bool = False
    message: str | None = None
    items: list[WorkflowItem] = []


class ExecutionItem(BaseModel):
    id: int | str
    workflowId: int | str | None = None
    status: str | None = None
    startedAt: datetime | None = None


class ExecutionsResponse(BaseModel):
    degraded: bool = False
    message: str | None = None
    items: list[ExecutionItem] = []


class SimulateRequest(BaseModel):
    honeypot: Literal["cowrie", "dionaea"]
    payload: dict


class SimulateResponse(BaseModel):
    success: bool
    honeypot: str
    result: dict


class BlockIpRequest(BaseModel):
    src_ip: IPvAnyAddress
    event_id: int | None = None
    reason: str = Field(min_length=1)
    duration: int | None = Field(default=None, ge=0)


class BlockIpResponse(BaseModel):
    success: bool
    src_ip: str
    result: dict


class CreateTicketRequest(BaseModel):
    event_id: int | None = None
    name: str
    content: str
    urgency: str = "medium"

    @field_validator("name", "content")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("no puede estar vacío")
        return value


class CreateTicketResponse(BaseModel):
    success: bool
    result: dict