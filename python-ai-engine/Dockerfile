# ==========================================
# DOCKERFILE FOR PYTHON FASTAPI AI ENGINE
# ==========================================

FROM python:3.11-slim

WORKDIR /usr/src/app

# Install system utilities & compile dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency definition
COPY requirements.txt ./

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy AI engine source code files
COPY . .

# Expose Python FastAPI port
EXPOSE 8000

# Run FastAPI using Uvicorn server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
