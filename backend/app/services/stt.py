from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings

settings = get_settings()


@lru_cache
def _load_model():
    if not settings.USE_WHISPER:
        return None
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "faster-whisper is not installed (install with `.venv/bin/pip install faster-whisper`)"
        ) from exc
    return WhisperModel(settings.STT_MODEL, device="cpu", compute_type="int8")


async def transcribe(path: Path, language: str = "ru") -> str:
    model = _load_model()
    if model is None:
        raise RuntimeError("Whisper disabled (USE_WHISPER=false)")
    segments, _info = model.transcribe(str(path), language=language, vad_filter=True)
    return " ".join(s.text.strip() for s in segments).strip()
