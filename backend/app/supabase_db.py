from supabase import create_client
import os
from datetime import datetime


def get_supabase():
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_KEY")
    )

# --- FUNGSI BARU UNTUK SESSION ---
def create_session(user_id, title="New Chat"):
    sb = get_supabase()
    res = sb.table("sessions").insert({
        "user_id": user_id,
        "title": title
    }).execute()
    return res.data[0] # Mengembalikan object session baru

def get_user_sessions(user_id):
    sb = get_supabase()
    # Ambil daftar chat room milik user, urutkan dari yang terbaru
    res = sb.table("sessions") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .execute()
    return res.data

def update_session_title(session_id, new_title):
    sb = get_supabase()
    sb.table("sessions").update({"title": new_title}).eq("id", session_id).execute()

def get_user_sessions(user_id):
    sb = get_supabase()
    res = sb.table("sessions").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return res.data
    
def save_feedback(user_id, name, email, message):
    sb = get_supabase()
    data = {
        "user_id": user_id,
        "name": name,
        "email": email,
        "message": message
    }
    return sb.table("feedbacks").insert(data).execute()

def save_chat(user_id, role, content, session_id=None, file_metadata=None):
    sb = get_supabase()
    data = {
        "user_id": user_id,
        "role": role,
        "content": content,
        "session_id": session_id,
        "file_metadata": file_metadata # Pastikan kolom ini sudah ada di tabel chat_history (JSONB)
    }
    sb.table("chat_history").insert(data).execute()

def load_chat(user_id, session_id): # <--- Tambah parameter session_id
    sb = get_supabase()
    res = sb.table("chat_history") \
        .select("*") \
        .eq("session_id", session_id) \
        .order("created_at") \
        .execute()
    return res.data

def delete_session(session_id, user_id):
    sb = get_supabase()
    # Hapus history dulu karena ada relasi foreign key
    sb.table("chat_history").delete().eq("session_id", session_id).execute()
    sb.table("sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()

def rename_session(session_id, user_id, new_title):
    sb = get_supabase()
    sb.table("sessions").update({"title": new_title}).eq("id", session_id).eq("user_id", user_id).execute()

def get_user_performance_history(user_id, limit=50):
    sb = get_supabase()
    res = sb.table("chat_history") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()
    # Kita balik lagi urutannya agar kronologis (lama ke baru)
    return sorted(res.data, key=lambda x: x['created_at'])

def get_user_role(user_id):
    sb = get_supabase()
    # Ambil role langsung dari tabel account
    res = sb.table("account").select("role").eq("id", user_id).single().execute()
    return res.data.get("role") if res.data else None

def get_admin_stats_db():
    sb = get_supabase()
    # 1. Total Chat
    total_chats = sb.table("chat_history").select("*", count="exact").execute().count
    
    # 2. Chat Hari Ini
    today = datetime.now().strftime("%Y-%m-%d")
    chats_today = sb.table("chat_history").select("*", count="exact").gte("created_at", today).execute().count
    
    # 3. Total Users
    total_users = sb.table("account").select("*", count="exact").execute().count

    active_res = sb.table("chat_sessions") \
        .select("user_id") \
        .execute()
    
    from collections import Counter
    user_counts = Counter([item['user_id'] for item in active_res.data])
    most_active_id = user_counts.most_common(1)[0][0] if user_counts else None
    
    most_active_name = "-"
    if most_active_id:
        u_res = sb.table("account").select("full_name").eq("id", most_active_id).single().execute()
        if u_res.data:
            most_active_name = u_res.data['full_name']
    
    return {
        "total_chats": total_chats,
        "chats_today": chats_today,
        "total_users": total_users,
        "most_active_user": most_active_name,
        "avg_performance": 4.5 # Jika ada tabel feedback, hitung rata-rata di sini
    }

def get_all_users_db():
    sb = get_supabase()
    res = sb.table("account").select("*").order("created_at", desc=True).execute()
    return res.data

def update_user_role_db(user_id, new_role):
    sb = get_supabase()
    res = sb.table("account").update({"role": new_role}).eq("id", user_id).execute()
    return len(res.data) > 0

def get_user_chat_history_admin(user_id):
    sb = get_supabase()
    # Mengambil semua chat history berdasarkan user_id target
    res = sb.table("chat_history").select("*").eq("user_id", user_id).order("created_at").execute()
    return res.data
