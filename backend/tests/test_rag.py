from app.db.models import KbChunk
from app.rag.embedder import embed
from app.rag.retriever import search_kb


async def test_embed_and_retrieve(db_session):
    vecs = embed(["Казанский Кремль — сердце города и объект ЮНЕСКО"])
    db_session.add(
        KbChunk(
            source_title="test",
            city="Казань",
            content="Казанский Кремль — древнейшая часть Казани, объект ЮНЕСКО.",
            embedding=vecs[0],
        )
    )
    await db_session.commit()

    out = await search_kb(db_session, "Что посмотреть в Казанском Кремле?", city="Казань", k=1)
    assert len(out) == 1
    assert "Кремль" in out[0]["snippet"]
