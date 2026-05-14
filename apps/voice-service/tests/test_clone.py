import pytest
from unittest.mock import MagicMock, patch

from services import bailian_clone


def test_create_clone_success():
    """Test voice cloning creation flow."""
    with patch("services.bailian_clone._upload_file_to_bailian") as mock_upload, \
         patch("services.bailian_clone._get_real_file_url") as mock_get_url, \
         patch("services.bailian_clone.VoiceEnrollmentService") as MockService:

        mock_upload.return_value = "test-file-id"
        mock_get_url.return_value = "https://oss.example.com/test.mp3"

        instance = MagicMock()
        instance.create_voice.return_value = "cosyvoice-v3-flash-xiaonuan-abc123"
        MockService.return_value = instance

        voice_id = bailian_clone.create_clone(["/fake/sample.mp3"])
        assert voice_id == "cosyvoice-v3-flash-xiaonuan-abc123"

        instance.create_voice.assert_called_once()
        call_kwargs = instance.create_voice.call_args.kwargs
        assert call_kwargs["target_model"] == "cosyvoice-v3-flash"
        assert call_kwargs["prefix"] == "xiaonuan"


def test_create_clone_no_samples():
    """Test cloning rejects empty samples."""
    with pytest.raises(ValueError, match="At least one"):
        bailian_clone.create_clone([])


def test_list_clones():
    """Test listing cloned voices."""
    with patch("services.bailian_clone.VoiceEnrollmentService") as MockService:
        instance = MagicMock()
        instance.list_voices.return_value = [
            {"voice_id": "voice-1", "status": "OK"}
        ]
        MockService.return_value = instance

        voices = bailian_clone.list_clones()
        assert len(voices) == 1
        assert voices[0]["voice_id"] == "voice-1"


def test_delete_clone():
    """Test deleting a cloned voice."""
    with patch("services.bailian_clone.VoiceEnrollmentService") as MockService:
        instance = MagicMock()
        MockService.return_value = instance

        bailian_clone.delete_clone("voice-123")
        instance.delete_voice.assert_called_once_with("voice-123")
