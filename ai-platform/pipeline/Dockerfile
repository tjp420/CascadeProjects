FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Create non-root user early and set ownership
RUN useradd -m -u 1000 sbuser && mkdir -p /app && chown -R sbuser:sbuser /app

# Install tini for proper PID 1 signal handling
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*

# Install dependencies first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code as non-root
COPY --chown=sbuser:sbuser main.py .

USER sbuser

# FastAPI port
EXPOSE 8000

# Health check — uses Python urllib (no curl in slim image)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Entrypoint uses tini to reap zombies and forward signals
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
