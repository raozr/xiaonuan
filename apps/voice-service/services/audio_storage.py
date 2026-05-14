import os
import uuid
from datetime import datetime

from config import settings


def generate_audio_path(category: str, ext: str = "mp3") -> str:
    """Generate a local file path for storing audio."""
    today = datetime.now().strftime("%Y-%m-%d")
    filename = f"{uuid.uuid4()}.{ext}"
    dir_path = os.path.join(settings.audio_storage_path, category, today)
    os.makedirs(dir_path, exist_ok=True)
    return os.path.join(dir_path, filename)


def get_audio_url(local_path: str) -> str:
    """Convert local storage path to public URL path."""
    rel = os.path.relpath(local_path, settings.audio_storage_path)
    return f"/audio/{rel}"
