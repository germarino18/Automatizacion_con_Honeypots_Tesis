"""Overview (SOC dashboard) DTOs."""

from datetime import datetime

from pydantic import BaseModel


class HoneypotCount(BaseModel):
    source_honeypot: str
    count: int


class TopIp(BaseModel):
    src_ip: str
    total_ataques: int
    tecnicas_usadas: int = 0
    max_riesgo: float | None = None
    riesgo_promedio: float | None = None
    primer_ataque: datetime | None = None
    ultimo_ataque: datetime | None = None


class CriticalAlert(BaseModel):
    id: int
    timestamp: datetime
    source_honeypot: str
    src_ip: str
    att_ck_technique: str | None = None
    risk_score: float | None = None
    severity: str


class Overview(BaseModel):
    total_eventos: int = 0
    ips_unicas: int = 0
    eventos_por_honeypot: list[HoneypotCount] = []
    top_ips: list[TopIp] = []
    alertas_criticas: list[CriticalAlert] = []
    total_malware: int = 0
    mttd_seconds: float | None = None
    mttr_seconds: float | None = None