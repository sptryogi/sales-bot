from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
import json, os
from .auth import get_current_user
from .supabase_db import save_chat, load_chat, create_session, get_user_sessions, update_session_title, rename_session, delete_session 
from .rag import load_rag
import tempfile
import requests
from .utils import get_pdf_text, get_docx_text
from ddgs import DDGS # Import di paling atas

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

@router.delete("/sessions/{session_id}")
def remove_session(session_id: str, user=Depends(get_current_user)):
    delete_session(session_id, user.id)
    return {"status": "deleted"}

@router.patch("/sessions/{session_id}")
def edit_session(session_id: str, payload: dict, user=Depends(get_current_user)):
    new_title = payload.get("title")
    rename_session(session_id, user.id, new_title)
    return {"status": "renamed"}

def get_web_context(query):
    # TIER 1: SerpApi
    serp_key = os.getenv("SERPAPI_API_KEY")
    if serp_key:
        try:
            url = f"https://serpapi.com/search?q={query}&api_key={serp_key}&num=3"
            res = requests.get(url, timeout=5).json()
            if "organic_results" in res:
                return "[SERPAPI SOURCE]: " + json.dumps(res["organic_results"], indent=2)
        except Exception as e:
            print(f"SerpApi Gagal: {e}")

    # TIER 2: NewsData.io (Fallback)
    news_key = os.getenv("NEWSDATA_API_KEY")
    if news_key:
        try:
            url = f"https://newsdata.io/api/1/news?apikey={news_key}&q={query}&language=id"
            res = requests.get(url, timeout=5).json()
            if res.get("status") == "success":
                return "[NEWSDATA SOURCE]: " + json.dumps(res["results"][:3], indent=2)
        except Exception as e:
            print(f"NewsData Gagal: {e}")

    # TIER 3: DuckDuckGo (Last Resort)
    try:
        with DDGS() as ddgs:
            results = [r for r in ddgs.text(query, max_results=3)]
            return "[DDGS SOURCE]: " + json.dumps(results, indent=2)
    except Exception as e:
        print(f"DDGS Gagal: {e}")
        return ""
    
@router.post("/chat")
def chat(payload: dict, user=Depends(get_current_user)):
    mode = payload.get("mode", "rag")
    message = payload.get("message")
    session_id = payload.get("session_id") # <--- Wajib ada session_id
    file_metadata = payload.get("file_metadata") # Ambil metadata dari frontend
    web_search_enabled = payload.get("web_search", False) # Ambil flag web_search
    location_data = payload.get("location_data")

    # Jika tidak ada session_id, buat baru otomatis (safety net)
    if not session_id:
        new_sess = create_session(user.id, message[:30])
        session_id = new_sess['id']

    history = load_chat(user.id, session_id)

    context_web = ""
    if web_search_enabled:
        context_web = get_web_context(message)

    file_context = ""
    if file_metadata and file_metadata.get("url"):
        try:
            r = requests.get(file_metadata["url"])
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                tmp.write(r.content)
                tmp_path = tmp.name
            
            if "pdf" in file_metadata["type"]:
                file_context = f"\nISI FILE USER ({file_metadata['name']}):\n" + get_pdf_text(tmp_path)
            elif "officedocument" in file_metadata["type"]:
                file_context = f"\nISI FILE USER ({file_metadata['name']}):\n" + get_docx_text(tmp_path)
            os.remove(tmp_path)
        except Exception as e:
            print(f"Gagal membaca file: {e}")

    context = ""
    if mode == "json":
        context = open("storage/context.json").read()
    else:
        vs = load_rag()
        docs = vs.similarity_search(message, k=3)
        context = "\n".join([d.page_content for d in docs])

    loc_context = f"\nLOKASI USER SAAT INI: {location_data}" if location_data else ""

    system_prompt = f"""
    Kamu adalah 'MediSales Assistant', AI pendamping untuk tim sales obat.

    Tugasmu adalah MEMBANTU SALES dengan:
    - Menyusun argumen penjualan berdasarkan konteks produk
    - Memberikan angle komunikasi yang efektif
    - Menyarankan cara menjawab pertanyaan atau keberatan calon pembeli
    - Memberikan contoh kalimat yang bisa digunakan sales

    Aturan Penting:
    - Jawaban ditujukan untuk SALES, bukan langsung ke customer
    - Gunakan bahasa Indonesia yang profesional, jelas, dan praktis
    - Jawaban ringkas, berbentuk poin atau tabel jika perlu
    - Jangan mengarang informasi di luar konteks
    - Jika data tidak ada, katakan bahwa informasi belum tersedia
    - Boleh menyertakan contoh script / kalimat bantu untuk sales
    - Jangan menyebutkan sumber atau kata (ex: berdasarkan konteks..) 
    - Jika lokasi user tersedia, gunakan informasi tersebut untuk menyesuaikan strategi pemasaran, 
      misalnya menyebutkan tren lokal, ketersediaan produk di wilayah tersebut, atau budaya setempat agar argumenmu lebih persuasif.

    Jawab hanya berdasarkan konteks berikut:
    {context}
    {file_context}
    {context_web}
    Lokasi User: {loc_context}
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
    save_chat(user.id, "user", message, session_id, file_metadata)
    save_chat(user.id, "assistant", full_answer, session_id)

    # Update judul session jika ini chat pertama (logic sederhana)
    if len(history) == 0:
         # Bersihkan judul dari markdown asing di backend sekalian
         clean_title = full_answer[:50].replace("*", "").replace("#", "").strip()
         update_session_title(session_id, clean_title)

    return {"answer": full_answer, "session_id": session_id}
