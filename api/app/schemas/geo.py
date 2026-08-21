"""Geolocation DTOs."""

from pydantic import BaseModel


class CountryCount(BaseModel):
    country: str
    count: int


class GeoResponse(BaseModel):
    countries: list[CountryCount] = []
    total: int = 0
    fallback_used: bool = False