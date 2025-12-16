from supabase import create_client
import os

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

def save_chat(user_id, role, content):
    supabase.table("chat_history").insert({
        "user_id": user_id,
        "role": role,
        "content": content
    }).execute()

def load_chat(user_id):
    res = supabase.table("chat_history")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("created_at")\
        .execute()
    return res.data
