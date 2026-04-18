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
    async with SessionLocal() as db:
        count = (await db.execute(select(func.count()).select_from(KbChunk))).scalar() or 0
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
        vectors = embed([r["content"] for r in records])

        inserted = 0
        for i in range(0, len(records), BATCH_SIZE):
            batch = list(zip(records[i : i + BATCH_SIZE], vectors[i : i + BATCH_SIZE], strict=True))
            for rec, vec in batch:
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
            inserted += len(batch)
        return inserted


def main():
    n = asyncio.run(seed_if_empty())
    print(f"Seeded {n} KB chunks")


if __name__ == "__main__":
    main()
