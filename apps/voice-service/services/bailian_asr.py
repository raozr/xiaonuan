import logging
import os
import time
from typing import Optional

import dashscope
import httpx
from dashscope import Files
from dashscope.audio.asr import Transcription

from config import settings

logger = logging.getLogger(__name__)

dashscope.api_key = settings.bailian_api_key


def _upload_file_to_bailian(file_path: str) -> str:
    """Upload local audio file to Bailian and return file_id."""
    url = "https://dashscope.aliyuncs.com/api/v1/files"
    headers = {"Authorization": f"Bearer {settings.bailian_api_key}"}

    # Determine MIME type based on actual file extension
    ext = os.path.splitext(file_path)[1].lower()
    mime_type = "audio/wav" if ext == ".wav" else "audio/mpeg"

    with open(file_path, "rb") as f:
        files = {"file": (os.path.basename(file_path), f, mime_type)}
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


def _fetch_transcription_result(transcription_url: str) -> str:
    """Download and parse ASR result JSON."""
    response = httpx.get(transcription_url, timeout=30.0)
    response.raise_for_status()
    data = response.json()
    transcripts = data.get("transcripts", [])
    if not transcripts:
        return ""
    return transcripts[0].get("text", "")


def transcribe(file_path: str) -> str:
    """
    Transcribe audio file to text using Paraformer.

    Args:
        file_path: Path to local audio file.

    Returns:
        Recognized text.

    Raises:
        RuntimeError: If transcription fails.
    """
    logger.info(f"ASR: uploading file {file_path}")
    file_id = _upload_file_to_bailian(file_path)
    real_url = _get_real_file_url(file_id)
    logger.info(f"ASR: file uploaded, id={file_id}")

    try:
        result = Transcription.call(
            model=settings.asr_model,
            file_urls=[real_url],
            api_key=settings.bailian_api_key,
        )

        output = result.output if hasattr(result, "output") else {}
        task_status = output.get("task_status") if isinstance(output, dict) else None

        if task_status != "SUCCEEDED":
            raise RuntimeError(f"ASR task failed: {output}")

        results = output.get("results", [])
        if not results:
            raise RuntimeError("ASR returned no results")

        transcription_url = results[0].get("transcription_url")
        if not transcription_url:
            raise RuntimeError("ASR result missing transcription_url")

        text = _fetch_transcription_result(transcription_url)
        logger.info(f"ASR: recognized text='{text}'")
        return text
    except Exception as e:
        logger.error(f"ASR failed: {e}")
        raise RuntimeError(f"ASR failed: {e}") from e
