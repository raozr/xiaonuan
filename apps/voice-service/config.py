import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Voice Service"
    port: int = 8000
    host: str = "0.0.0.0"
    bailian_api_key: str = ""
    audio_storage_path: str = "./data/audio"
    tts_model: str = "cosyvoice-v3-plus"
    asr_model: str = "paraformer-v2"
    log_level: str = "INFO"

    class Config:
        env_prefix = ""
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Ensure audio storage dirs exist
for subdir in ["tts", "asr", "clone"]:
    os.makedirs(os.path.join(settings.audio_storage_path, subdir), exist_ok=True)
