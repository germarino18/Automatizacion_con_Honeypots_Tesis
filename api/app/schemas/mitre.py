"""MITRE ATT&CK DTOs."""

from pydantic import BaseModel


class TechniqueCount(BaseModel):
    technique: str
    tactic: str | None = None
    name: str | None = None
    count: int


class MitreResponse(BaseModel):
    techniques: list[TechniqueCount] = []
    total: int = 0