import logging
from typing import Optional

import dashscope
from dashscope.audio.tts_v2 import AudioFormat, SpeechSynthesizer

from config import settings

logger = logging.getLogger(__name__)

dashscope.api_key = settings.bailian_api_key

DEFAULT_VOICES = {
    "male": "longanyang",
    "female": "longanhuan",
}


def synthesize(text: str, voice_id: Optional[str] = None) -> bytes:
    """
    Synthesize text to speech using CosyVoice.

    Args:
        text: Text to synthesize (max 1000 chars).
        voice_id: Custom cloned voice ID or None for default voice.

    Returns:
        MP3 audio bytes.

    Raises:
        ValueError: If text is empty or too long.
        RuntimeError: If synthesis fails.
    """
    if not text or not text.strip():
        raise ValueError("Text is required")
    if len(text) > 1000:
        raise ValueError("Text exceeds 1000 character limit")

    voice = voice_id or DEFAULT_VOICES["female"]

    try:
        synthesizer = SpeechSynthesizer(
            model=settings.tts_model,
            voice=voice,
            format=AudioFormat.MP3_22050HZ_MONO_256KBPS,
            volume=50,
            speech_rate=1.0,
            pitch_rate=1.0,
            seed=0,
        )
        audio = synthesizer.call(text)
        if not audio:
            raise RuntimeError("TTS returned empty audio")
        return audio
    except Exception as e:
        logger.error(f"TTS synthesis failed: {e}")
        raise RuntimeError(f"TTS synthesis failed: {e}") from e
