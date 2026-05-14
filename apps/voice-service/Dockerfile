FROM python:3.11-slim

WORKDIR /app

# Use China mirror for faster apt (Aliyun)
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true \
    && sed -i 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true \
    && sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list 2>/dev/null || true \
    && sed -i 's|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list 2>/dev/null || true

# Install ffmpeg for audio conversion
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create audio storage directory
RUN mkdir -p /app/data/audio

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
