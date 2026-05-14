import logging
import os
import shutil
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services import bailian_asr
from services.audio_storage import generate_audio_path

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/asr", tags=["ASR"])


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(..., description="Audio file to transcribe"),
    format: str = Form("wav", description="Audio format"),
    sample_rate: int = Form(16000, description="Sample rate in Hz"),
):
    """Transcribe audio file to text."""
    temp_path = None
    try:
        # Save uploaded file to temp location
        suffix = f".{format}" if format else ""
        with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(audio.file, tmp)
            temp_path = tmp.name

        text = bailian_asr.transcribe(temp_path)

        if not text or not text.strip():
            return {"success": False, "message": "未能识别到语音内容"}

        return {"success": True, "text": text}
    except Exception as e:
        logger.error(f"ASR endpoint error: {e}")
        raise HTTPException(status_code=500, detail="语音识别失败")
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
