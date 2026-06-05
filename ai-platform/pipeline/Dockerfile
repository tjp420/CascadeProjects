FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Non-root user for security
RUN useradd -m -u 1000 sbuser && chown -R sbuser:sbuser /app
USER sbuser

# FastAPI port
EXPOSE 8000

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
