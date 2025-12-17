from fastapi import Header, HTTPException
import os

def get_current_user(authorization: str = Header(...)):
    from supabase import create_client

    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_KEY")
    )

    token = authorization.replace("Bearer ", "")
    user = supabase.auth.get_user(token)

    if not user:
        raise HTTPException(401, "Unauthorized")

    return user.user
