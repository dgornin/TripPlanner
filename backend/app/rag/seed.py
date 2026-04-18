from __future__ import annotations

import asyncio
import json
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db.models import KbChunk
from app.db.session import engine

DATA_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "kb_russia.jsonl"


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
        for rec, vec in zip(records, vectors, strict=True):
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
        return len(records)


def main():
    n = asyncio.run(seed_if_empty())
    print(f"Seeded {n} KB chunks")


if __name__ == "__main__":
    main()
