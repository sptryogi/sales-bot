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
    lang = payload.get("language", "ID") # Ambil bahasa, default ID
    web_search_enabled = payload.get("web_search", False) # Ambil flag web_search
    location_data = payload.get("location_data")
    prof_level = payload.get("professionalism", "Pemula") # Default ke Pemula

    # Jika tidak ada session_id, buat baru otomatis (safety net)
    if not session_id:
        new_sess = create_session(user.id, message[:30])
        session_id = new_sess['id']

    history = load_chat(user.id, session_id)

    # Logika instruksi berdasarkan level
    prof_instructions = {
        "Pemula": "Gunakan bahasa yang sangat sederhana, berikan penjelasan dasar tentang teknik sales, dan jangan terlalu teknis. Berikan motivasi ekstra.",
        "Menengah": "Gunakan bahasa profesional yang lugas. Fokus pada teknik negosiasi taktis dan argumen yang efisien namun kuat.",
        "Expert": "Gunakan bahasa level eksekutif dan teknis. Berikan data yang mendalam, argumen yang sangat persuasif, dan strategi tingkat lanjut untuk closing cepat."
    }
    
    selected_inst = prof_instructions.get(prof_level, prof_instructions["Pemula"])

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

    lang_instruction = "Bahasa Indonesia" if lang == "ID" else "English Language"
    
    system_prompt = f"""
    Kamu adalah 'MediSales Assistant', AI pendamping untuk tim sales atau marketing.
    LEVEL SALES USER: {prof_level}. 
    INSTRUKSI KHUSUS: {selected_inst}

    Tugasmu adalah MEMBANTU SALES dengan:
    - Menyusun argumen penjualan berdasarkan konteks produk
    - Memberikan angle komunikasi yang efektif
    - Menyarankan cara menjawab pertanyaan atau keberatan calon pembeli
    - Memberikan contoh kalimat yang bisa digunakan sales

    Aturan Penting:
    - Jawaban ditujukan untuk SALES, bukan langsung ke customer
    - Jawablah dengan singkat, padat, dan to-the-point.
    - Gunakan {lang_instruction} yang profesional, singkat, jelas, dan praktis
    - Jawaban boleh berbentuk poin atau tabel hanya jika diperlukan oleh user
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

    res = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        stream=False # Matikan stream di backend
    )

    full_answer = res.choices[0].message.content

    save_chat(user.id, "user", message, session_id, file_metadata)
    save_chat(user.id, "assistant", full_answer, session_id)

    # Update judul session jika ini chat pertama (logic sederhana)
    if len(history) == 0:
         # Bersihkan judul dari markdown asing di backend sekalian
         clean_title = full_answer[:50].replace("*", "").replace("#", "").strip()
         update_session_title(session_id, clean_title)

    return {"answer": full_answer, "session_id": session_id}

@router.get("/evaluate-sales")
def evaluate_sales(user=Depends(get_current_user)):
    from .supabase_db import get_user_performance_history
    history = get_user_performance_history(user.id)
    
    if not history:
        return {"evaluation": "Belum ada history untuk dievaluasi."}

    formatted_history = "\n".join([f"{h['role']}: {h['content']}" for h in history])

    # 3. Prompt Khusus Evaluasi
    eval_prompt = f"""
    Kamu adalah Manajer Penjualan Senior. Tugasmu adalah mengevaluasi kinerja Sales berdasarkan percakapan berikut:
    
    PERCAKAPAN:
    {formatted_history}
    
    Berikan laporan evaluasi singkat yang berisi:
    1. Skor Persuasi (1-10)
    2. Skor Pengetahuan Produk (1-10)
    3. Analisis Kekuatan & Kelemahan
    4. Analisis kesimpulan singkat apa yang kurang (apakah kurang persuasif, kurang data, dll)
    5. Saran Perbaikan spesifik untuk chat berikutnya agar closing lebih cepat.
    
    Gunakan gaya bahasa profesional namun memotivasi.
    """

    res = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "system", "content": eval_prompt}]
    )
    
    return {"evaluation": res.choices[0].message.content}

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Gunakan payload: dict agar konsisten dengan endpoint /chat Anda
@router.post("/feedback")
async def send_feedback(payload: dict, user=Depends(get_current_user)):
    name = payload.get("name")
    email = payload.get("email")
    message = payload.get("message")
    user_id = user.id

    try:
        # 1. SIMPAN KE SUPABASE
        from .supabase_db import save_feedback
        save_feedback(user_id, name, email, message)

        # 2. KIRIM KE EMAIL (SMTP)
        # Ambil kredensial dari environment variable (.env)
        SENDER_EMAIL = os.getenv("EMAIL_USER") # Email pengirim (bisa email Anda)
        SENDER_PASSWORD = os.getenv("EMAIL_PASSWORD") # App Password dari Google
        RECEIVER_EMAIL = "dianrakyat5@gmail.com"

        # Setup Pesan
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
        msg['To'] = RECEIVER_EMAIL
        msg['Subject'] = f"Feedback MedisalesAI: {name}"

        body = f"""
        Halo Admin,
        Ada feedback baru yang masuk:

        Nama: {name}
        Email User: {email}
        Isi Kritik/Saran:
        {message}
        """
        msg.attach(MIMEText(body, 'plain'))

        # Proses Pengiriman
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)

        return {"status": "success", "message": "Feedback saved and email sent"}
    
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan saat memproses feedback")
