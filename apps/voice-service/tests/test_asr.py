import pytest
from unittest.mock import MagicMock, patch

from services import bailian_asr


def test_transcribe_success():
    """Test ASR transcription flow."""
    mock_result = MagicMock()
    mock_result.output = {
        "task_status": "SUCCEEDED",
        "results": [
            {
                "transcription_url": "https://example.com/result.json"
            }
        ]
    }

    mock_json = {
        "transcripts": [
            {
                "text": "你好小暖"
            }
        ]
    }

    with patch("services.bailian_asr._upload_file_to_bailian") as mock_upload, \
         patch("services.bailian_asr._get_real_file_url") as mock_get_url, \
         patch("services.bailian_asr.Transcription.call") as mock_transcription, \
         patch("services.bailian_asr.httpx.get") as mock_http_get:

        mock_upload.return_value = "test-file-id"
        mock_get_url.return_value = "https://oss.example.com/test.mp3"
        mock_transcription.return_value = mock_result
        mock_http_get.return_value.json.return_value = mock_json
        mock_http_get.return_value.raise_for_status = MagicMock()

        text = bailian_asr.transcribe("/fake/path/test.wav")
        assert text == "你好小暖"


def test_transcribe_empty_result():
    """Test ASR with empty transcription result."""
    mock_result = MagicMock()
    mock_result.output = {
        "task_status": "SUCCEEDED",
        "results": [
            {"transcription_url": "https://example.com/result.json"}
        ]
    }

    mock_json = {"transcripts": []}

    with patch("services.bailian_asr._upload_file_to_bailian") as mock_upload, \
         patch("services.bailian_asr._get_real_file_url") as mock_get_url, \
         patch("services.bailian_asr.Transcription.call") as mock_transcription, \
         patch("services.bailian_asr.httpx.get") as mock_http_get:

        mock_upload.return_value = "test-file-id"
        mock_get_url.return_value = "https://oss.example.com/test.mp3"
        mock_transcription.return_value = mock_result
        mock_http_get.return_value.json.return_value = mock_json
        mock_http_get.return_value.raise_for_status = MagicMock()

        text = bailian_asr.transcribe("/fake/path/test.wav")
        assert text == ""


def test_transcribe_task_failed():
    """Test ASR when task fails."""
    mock_result = MagicMock()
    mock_result.output = {
        "task_status": "FAILED",
        "code": "FILE_DOWNLOAD_FAILED"
    }

    with patch("services.bailian_asr._upload_file_to_bailian") as mock_upload, \
         patch("services.bailian_asr._get_real_file_url") as mock_get_url, \
         patch("services.bailian_asr.Transcription.call") as mock_transcription:

        mock_upload.return_value = "test-file-id"
        mock_get_url.return_value = "https://oss.example.com/test.mp3"
        mock_transcription.return_value = mock_result

        with pytest.raises(RuntimeError, match="ASR task failed"):
            bailian_asr.transcribe("/fake/path/test.wav")
