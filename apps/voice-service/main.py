import logging
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from config import settings
from routers import asr, tts, voice_clone

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app = FastAPI(title=settings.app_name, version="1.0.0")

# Mount audio static files
audio_dir = os.path.join(settings.audio_storage_path)
os.makedirs(audio_dir, exist_ok=True)
app.mount("/audio", StaticFiles(directory=audio_dir), name="audio")

# Include routers
app.include_router(asr.router)
app.include_router(tts.router)
app.include_router(voice_clone.router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
