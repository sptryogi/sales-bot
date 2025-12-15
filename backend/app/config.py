import os
from dotenv import load_dotenv

# Load .env file jika dijalankan di local
load_dotenv()

class Settings:
    PROJECT_NAME: str = "PharmaSales AI Backend"
    
    # Supabase Config
    SUPABASE_URL: str = os.getenv("SUPABASE_URL")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY") # Gunakan Service Role Key untuk akses penuh di backend
    
    # AI Config
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY")
    
    # Path Sementara (Serverless itu ephemeral, kita pakai /tmp)
    TEMP_DIR: str = "/tmp/pharmasales"

settings = Settings()
