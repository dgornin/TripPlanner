from __future__ import annotations

import httpx

from app.core.config import get_settings

settings = get_settings()


async def search_places(
    query: str, near_city: str | None = None, limit: int = 5
) -> list[dict]:
    q = f"{query}, {near_city}" if near_city else query
    async with httpx.AsyncClient(timeout=10.0) as http:
        resp = await http.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": q,
                "format": "jsonv2",
                "limit": limit,
                "addressdetails": 1,
                "accept-language": "ru",
            },
            headers={"User-Agent": settings.NOMINATIM_USER_AGENT},
        )
        resp.raise_for_status()
        data = resp.json()
    results = []
    for item in data:
        try:
            lat = float(item["lat"])
            lon = float(item["lon"])
        except (KeyError, ValueError, TypeError):
            continue
        name = item.get("display_name", "") or query
        results.append(
            {
                "name": name.split(",")[0] or query,
                "lat": lat,
                "lon": lon,
                "address": item.get("display_name"),
                "category": item.get("category") or item.get("type"),
            }
        )
    return results
