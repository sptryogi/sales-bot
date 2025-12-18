from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
import json, os
from .auth import get_current_user
from .supabase_db import save_chat, load_chat, create_session, get_user_sessions, update_session_title
from .rag import load_rag

router = APIRouter()
client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)

# Endpoint baru: Ambil daftar room chat
@router.get("/sessions")
def get_sessions(user=Depends(get_current_user)):
    return get_user_sessions(user.id)

# Endpoint baru: Buat room chat baru
@router.post("/sessions")
def new_session(user=Depends(get_current_user)):
    session = create_session(user.id, "New Chat")
    return session

@router.get("/history/{session_id}")
def get_chat_history(session_id: str, user=Depends(get_current_user)):
    # Panggil fungsi load_chat yang sudah kita buat di database
    history = load_chat(user.id, session_id)
    return history
    
@router.post("/chat")
def chat(payload: dict, user=Depends(get_current_user)):
    mode = payload.get("mode", "rag")
    message = payload.get("message")
    session_id = payload.get("session_id") # <--- Wajib ada session_id

    # Jika tidak ada session_id, buat baru otomatis (safety net)
    if not session_id:
        new_sess = create_session(user.id, message[:30])
        session_id = new_sess['id']

    history = load_chat(user.id, session_id)

    context = ""
    if mode == "json":
        context = open("storage/context.json").read()
    else:
        vs = load_rag()
        docs = vs.similarity_search(message, k=3)
        context = "\n".join([d.page_content for d in docs])

    system_prompt = f"""
    Kamu adalah 'MediSales AI', asisten penjualan obat yang profesional, persuasif, tapi tetap akurat secara medis.
    Tugasmu menjawab pertanyaan user HANYA berdasarkan konteks yang diberikan di bawah.
    
    Gaya Bahasa:
    - Gunakan bahasa Indonesia yang sopan, ramah, dan meyakinkan (Sales Persona).
    - Jangan menjawab terlalu panjang (lebih ringkas).
    - Walaupun menjawab berdasarkan konteks yang diberikan, jangan beritahu sumbernya.
    - Jika user bertanya perbandingan, BUATLAH TABEL Markdown agar jelas.
    - Jika informasi tidak ada di konteks, katakan jujur bahwa kamu tidak memiliki data tersebut, jangan mengarang.
    - Akhiri dengan kalimat penutup sales yang mengajak (Call to Action) jika relevan.
    
    Jawab hanya berdasarkan konteks berikut:
    {context}
    """

    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-10:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    # res = client.chat.completions.create(
    #     model="deepseek-chat",
    #     messages=messages
    # )

    # answer = res.choices[0].message.content
    stream = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        stream=True
    )

    full_answer = ""

    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            full_answer += delta.content

    # save_chat(user.id, "user", message)
    # save_chat(user.id, "assistant", answer)

    # return {"answer": answer}
    save_chat(user.id, "user", message, session_id)
    save_chat(user.id, "assistant", full_answer, session_id)

    # Update judul session jika ini chat pertama (logic sederhana)
    if len(history) == 0:
         # Bersihkan judul dari markdown asing di backend sekalian
         clean_title = full_answer[:50].replace("*", "").replace("#", "").strip()
         update_session_title(session_id, clean_title)

    return {"answer": full_answer, "session_id": session_id}
