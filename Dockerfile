# ── Stage 1: slim runtime image ───────────────────────────────────────────────
FROM python:3.12-slim

# Don't write .pyc files, don't buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first (layer-cached when code changes but deps don't)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY main.py .
COPY static/ ./static/

# SQLite database lives in a dedicated directory so it can be mounted as a volume
ENV DB_DIR=/app/data
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["python", "main.py"]
