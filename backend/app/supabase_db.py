from supabase import create_client
import os

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

# --- UPDATE FUNGSI LAMA ---
# def save_chat(user_id, role, content, session_id): # <--- Tambah parameter session_id
#     sb = get_supabase()
#     sb.table("chat_history").insert({
#         "user_id": user_id,
#         "role": role,
#         "content": content,
#         "session_id": session_id, # <--- Simpan ID sesi
#     }).execute()
def save_chat(user_id, role, content, session_id, file_metadata=None): 
    sb = get_supabase()
    data = {
        "user_id": user_id,
        "role": role,
        "content": content,
        "session_id": session_id,
        "file_metadata": file_metadata # Simpan metadata file jika ada
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
    # Hapus history dulu (karena foreign key)
    sb.table("chat_history").delete().eq("session_id", session_id).execute()
    # Hapus session
    return sb.table("sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()

def rename_session(session_id, user_id, new_title):
    sb = get_supabase()
    return sb.table("sessions").update({"title": new_title}).eq("id", session_id).eq("user_id", user_id).execute()
