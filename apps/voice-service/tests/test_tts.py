import os
import pytest
from unittest.mock import MagicMock, patch

from services import bailian_tts
from services.audio_storage import generate_audio_path, get_audio_url


@pytest.fixture
def mock_settings(tmp_path, monkeypatch):
    audio_path = tmp_path / "audio"
    monkeypatch.setattr("config.settings.audio_storage_path", str(audio_path))
    os.makedirs(audio_path / "tts", exist_ok=True)
    return audio_path


def test_synthesize_with_default_voice(mock_settings):
    """Test TTS with default voice when no voice_id provided."""
    mock_audio = b"fake_mp3_data"

    with patch("services.bailian_tts.SpeechSynthesizer") as MockSynth:
        instance = MagicMock()
        instance.call.return_value = mock_audio
        MockSynth.return_value = instance

        result = bailian_tts.synthesize("你好小暖")
        assert result == mock_audio

        MockSynth.assert_called_once()
        call_kwargs = MockSynth.call_args.kwargs
        assert call_kwargs["voice"] == "longanhuan"  # default female


def test_synthesize_with_custom_voice(mock_settings):
    """Test TTS with custom cloned voice_id."""
    mock_audio = b"fake_mp3_data"

    with patch("services.bailian_tts.SpeechSynthesizer") as MockSynth:
        instance = MagicMock()
        instance.call.return_value = mock_audio
        MockSynth.return_value = instance

        result = bailian_tts.synthesize("你好小暖", voice_id="custom-voice-123")
        assert result == mock_audio

        call_kwargs = MockSynth.call_args.kwargs
        assert call_kwargs["voice"] == "custom-voice-123"


def test_synthesize_empty_text():
    """Test TTS rejects empty text."""
    with pytest.raises(ValueError, match="Text is required"):
        bailian_tts.synthesize("")


def test_synthesize_text_too_long():
    """Test TTS rejects text over 1000 chars."""
    with pytest.raises(ValueError, match="exceeds 1000"):
        bailian_tts.synthesize("哈" * 1001)


def test_audio_storage_path(mock_settings):
    """Test audio file path generation."""
    path = generate_audio_path("tts", "mp3")
    assert path.endswith(".mp3")
    assert "tts" in path

    url = get_audio_url(path)
    assert url.startswith("/audio/")
