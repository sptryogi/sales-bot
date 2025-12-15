from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from app.config import settings

security = HTTPBearer()

# Client Supabase untuk validasi
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

async def verify_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Fungsi ini akan dijalankan sebelum masuk ke endpoint chat/process.
    Tugasnya memvalidasi Token JWT yang dikirim dari Frontend.
    """
    token = credentials.credentials
    try:
        # Cek user berdasarkan token
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Token tidak valid atau kadaluarsa")
        return user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication Failed: {str(e)}")
