import respx
from httpx import Response

from app.services.geocoding import search_places


@respx.mock
async def test_geocoding_parses_nominatim():
    respx.get("https://nominatim.openstreetmap.org/search").respond(
        200,
        json=[
            {
                "display_name": "Казанский Кремль, Казань",
                "lat": "55.7989",
                "lon": "49.1057",
                "category": "historic",
                "type": "fort",
            }
        ],
    )
    out = await search_places("кремль", "Казань")
    assert out[0]["lat"] == 55.7989
    assert out[0]["category"] == "historic"


@respx.mock
async def test_geocoding_empty():
    respx.get("https://nominatim.openstreetmap.org/search").respond(200, json=[])
    out = await search_places("несуществующее", "Марс")
    assert out == []
