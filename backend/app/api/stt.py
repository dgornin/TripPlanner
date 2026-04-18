from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.deps import current_user
from app.core.config import get_settings

router = APIRouter(prefix="/api/stt", tags=["stt"])
settings = get_settings()


@router.post("")
async def stt(
    audio: UploadFile = File(...),
    _user=Depends(current_user),
):
    if not settings.USE_WHISPER:
        raise HTTPException(503, "Whisper disabled on this deployment")
    from app.services.stt import transcribe

    suffix = Path(audio.filename or "audio.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        path = Path(tmp.name)
    try:
        text = await transcribe(path)
    finally:
        path.unlink(missing_ok=True)
    return {"text": text}
