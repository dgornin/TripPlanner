from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import KbChunk
from app.rag.embedder import embed


async def search_kb(
    db: AsyncSession, query: str, city: str | None = None, k: int = 5
) -> list[dict]:
    [qvec] = embed([query])
    stmt = select(KbChunk)
    if city:
        stmt = stmt.where(KbChunk.city == city)
    stmt = stmt.order_by(KbChunk.embedding.cosine_distance(qvec)).limit(k)
    rows = (await db.execute(stmt)).scalars().all()
    return [
        {
            "title": r.source_title,
            "url": r.source_url,
            "city": r.city,
            "snippet": r.content[:500],
        }
        for r in rows
    ]
