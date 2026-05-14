import logging
import os
from typing import List, Optional

import dashscope
import httpx
from dashscope import Files
from dashscope.audio.tts_v2.enrollment import VoiceEnrollmentService

from config import settings

logger = logging.getLogger(__name__)

dashscope.api_key = settings.bailian_api_key


def _upload_file_to_bailian(file_path: str) -> str:
    """Upload local audio file to Bailian and return file_id."""
    url = "https://dashscope.aliyuncs.com/api/v1/files"
    headers = {"Authorization": f"Bearer {settings.bailian_api_key}"}

    with open(file_path, "rb") as f:
        files = {"file": (os.path.basename(file_path), f, "audio/mpeg")}
        response = httpx.post(url, headers=headers, files=files, timeout=30.0)

    response.raise_for_status()
    data = response.json()
    uploaded = data.get("data", {}).get("uploaded_files", [])
    if not uploaded:
        raise RuntimeError("Bailian file upload returned no file_id")
    return uploaded[0]["file_id"]


def _get_real_file_url(file_id: str) -> str:
    """Get signed OSS URL for uploaded file."""
    file_info = Files.get(file_id=file_id, api_key=settings.bailian_api_key)
    if not file_info or not file_info.output:
        raise RuntimeError("Failed to get file info from Bailian")
    return file_info.output["url"]


def create_clone(file_paths: List[str], prefix: str = "xiaonuan") -> str:
    """
    Create a cloned voice from audio samples.

    Args:
        file_paths: List of local audio sample file paths.
        prefix: Voice prefix (lowercase alphanumeric, <10 chars).

    Returns:
        voice_id from Bailian.

    Raises:
        RuntimeError: If cloning fails.
    """
    if not file_paths:
        raise ValueError("At least one audio sample is required")

    # Upload the first sample for cloning (Bailian currently supports one URL)
    # TODO: support multiple samples if Bailian API allows
    logger.info(f"Clone: uploading sample {file_paths[0]}")
    file_id = _upload_file_to_bailian(file_paths[0])
    real_url = _get_real_file_url(file_id)
    logger.info(f"Clone: file uploaded, id={file_id}")

    service = VoiceEnrollmentService(api_key=settings.bailian_api_key)
    try:
        voice_id = service.create_voice(
            target_model=settings.tts_model,
            prefix=prefix,
            url=real_url,
            max_prompt_audio_length=10,
        )
        logger.info(f"Clone: created voice_id={voice_id}")
        return voice_id
    except Exception as e:
        logger.error(f"Clone creation failed: {e}")
        raise RuntimeError(f"Clone creation failed: {e}") from e


def list_clones() -> List[dict]:
    """List all cloned voices."""
    service = VoiceEnrollmentService(api_key=settings.bailian_api_key)
    try:
        return service.list_voices()
    except Exception as e:
        logger.error(f"List clones failed: {e}")
        raise RuntimeError(f"List clones failed: {e}") from e


def query_clone(voice_id: str) -> dict:
    """Query a cloned voice by ID."""
    service = VoiceEnrollmentService(api_key=settings.bailian_api_key)
    try:
        return service.query_voice(voice_id)
    except Exception as e:
        logger.error(f"Query clone failed: {e}")
        raise RuntimeError(f"Query clone failed: {e}") from e


def delete_clone(voice_id: str) -> None:
    """Delete a cloned voice."""
    service = VoiceEnrollmentService(api_key=settings.bailian_api_key)
    try:
        service.delete_voice(voice_id)
        logger.info(f"Clone: deleted voice_id={voice_id}")
    except Exception as e:
        logger.error(f"Delete clone failed: {e}")
        raise RuntimeError(f"Delete clone failed: {e}") from e
