# Gunakan image Python ringan
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies (penting untuk FAISS & OpenCV jika dibutuhkan library lain)
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements dan install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh kode
COPY . .

# Expose port (Cloud Run default 8080)
EXPOSE 8080

# Perintah menjalankan aplikasi dengan Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
