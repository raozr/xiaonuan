import logging
import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services import bailian_tts
from services.audio_storage import generate_audio_path, get_audio_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tts", tags=["TTS"])


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000, description="Text to synthesize")
    voice_id: Optional[str] = Field(None, description="Custom voice ID (cloned voice)")


class SynthesizeResponse(BaseModel):
    success: bool
    audioUrl: str


@router.post("/synthesize")
async def synthesize(request: SynthesizeRequest):
    """Synthesize text to speech and return audio URL."""
    try:
        audio = bailian_tts.synthesize(request.text, request.voice_id)
        file_path = generate_audio_path("tts", "mp3")
        with open(file_path, "wb") as f:
            f.write(audio)
        return SynthesizeResponse(success=True, audioUrl=get_audio_url(file_path))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"TTS endpoint error: {e}")
        raise HTTPException(status_code=500, detail="语音合成失败")
