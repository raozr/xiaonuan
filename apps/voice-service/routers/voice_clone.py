import logging
import os
import shutil
from tempfile import NamedTemporaryFile
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from services import bailian_clone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Voice Clone"])


class CloneResponse(BaseModel):
    voiceId: str
    status: str


class CloneStatusResponse(BaseModel):
    voiceId: str
    status: str


@router.post("/clone")
async def create_clone(
    samples: List[UploadFile] = File(..., description="Audio sample files for cloning"),
    pairing_id: str = Form(..., description="Pairing ID"),
):
    """Create a cloned voice from audio samples."""
    if len(samples) < 1:
        raise HTTPException(status_code=400, detail="至少上传 1 条语音样本")
    if len(samples) > 5:
        raise HTTPException(status_code=400, detail="最多上传 5 条语音样本")

    temp_paths = []
    try:
        for sample in samples:
            suffix = os.path.splitext(sample.filename or "")[1] or ".mp3"
            with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                shutil.copyfileobj(sample.file, tmp)
                temp_paths.append(tmp.name)

        voice_id = bailian_clone.create_clone(temp_paths)
        return CloneResponse(voiceId=voice_id, status="READY")
    except Exception as e:
        logger.error(f"Clone endpoint error: {e}")
        raise HTTPException(status_code=500, detail="语音复刻失败")
    finally:
        for p in temp_paths:
            if os.path.exists(p):
                os.remove(p)


@router.get("/clone/{voice_id}")
async def get_clone(voice_id: str):
    """Query clone status by voice_id."""
    try:
        result = bailian_clone.query_clone(voice_id)
        status = "READY" if result else "FAILED"
        return CloneStatusResponse(voiceId=voice_id, status=status)
    except Exception as e:
        logger.error(f"Query clone error: {e}")
        raise HTTPException(status_code=500, detail="查询复刻状态失败")


@router.delete("/clone/{voice_id}")
async def delete_clone(voice_id: str):
    """Delete a cloned voice."""
    try:
        bailian_clone.delete_clone(voice_id)
        return {"success": True}
    except Exception as e:
        logger.error(f"Delete clone error: {e}")
        raise HTTPException(status_code=500, detail="删除复刻音色失败")


@router.get("/clones")
async def list_clones():
    """List all cloned voices."""
    try:
        voices = bailian_clone.list_clones()
        return {"success": True, "voices": voices}
    except Exception as e:
        logger.error(f"List clones error: {e}")
        raise HTTPException(status_code=500, detail="查询音色列表失败")
