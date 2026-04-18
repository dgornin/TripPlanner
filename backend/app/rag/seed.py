from __future__ import annotations

import asyncio
import json
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db.models import KbChunk
from app.db.session import engine

DATA_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "kb_russia.jsonl"

BATCH_SIZE = 10  # 40 chunks × 384-dim vectors in one INSERT hits asyncpg's
# parameter limit — commit in small batches instead.


async def seed_if_empty() -> int:
    from app.rag.embedder import embed  # lazy: only import if we will seed

    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    # 1) Quick probe: is the table empty? Open+close a session so no
    # connection is held while we do the slow embedding step (embedding
    # can take 30 s on first call — an idle asyncpg connection was being
    # closed under us on the prod VM).
    async with SessionLocal() as db:
        count = (
            await db.execute(select(func.count()).select_from(KbChunk))
        ).scalar() or 0
    if count > 0:
        return 0
    if not DATA_FILE.exists():
        return 0

    records = [
        json.loads(line)
        for line in DATA_FILE.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if not records:
        return 0

    # 2) Slow step — no DB connection held during this.
    vectors = embed([r["content"] for r in records])

    # 3) Insert in small batches on a fresh connection each time; this
    # sidesteps both the asyncpg parameter limit and any idle-timeout.
    inserted = 0
    for i in range(0, len(records), BATCH_SIZE):
        chunk_records = records[i : i + BATCH_SIZE]
        chunk_vectors = vectors[i : i + BATCH_SIZE]
        async with SessionLocal() as db:
            for rec, vec in zip(chunk_records, chunk_vectors, strict=True):
                db.add(
                    KbChunk(
                        source_title=rec.get("title"),
                        source_url=rec.get("url"),
                        city=rec.get("city"),
                        content=rec["content"],
                        embedding=vec,
                    )
                )
            await db.commit()
        inserted += len(chunk_records)
    return inserted


def main():
    n = asyncio.run(seed_if_empty())
    print(f"Seeded {n} KB chunks")


if __name__ == "__main__":
    main()
