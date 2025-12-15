from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from app.models import ChatRequest, ChatResponse, ProcessRequest
from app.config import settings
from app.services import rag_service
from app.security import verify_user

app = FastAPI(title=settings.PROJECT_NAME)

# --- CORS (Agar React bisa akses) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Ganti dengan domain Vercel kamu nanti demi keamanan
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Client AI DeepSeek
client = OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")

@app.get("/")
def health_check():
    return {"status": "running", "service": "PharmaSales Backend"}

# --- ENDPOINT 1: UPDATE DATA (ADMIN) ---
# Endpoint ini berat, digunakan untuk memproses file.
@app.post("/api/process", dependencies=[Depends(verify_user)])
async def process_data(req: ProcessRequest):
    try:
        # Hapus cache lama agar nanti reload yang baru
        if req.mode == "JSON":
            rag_service.global_json_context = None
        else:
            rag_service.global_vector_store = None
            
        status = rag_service.build_index(req.mode)
        return {"message": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINT 2: CHAT (USER) ---
@app.post("/api/chat", response_model=ChatResponse, dependencies=[Depends(verify_user)])
async def chat(req: ChatRequest):
    context_text = ""
    
    # 1. Ambil Context
    if req.mode == "JSON":
        data = rag_service.load_resources_if_needed("JSON")
        if data:
            context_text = f"REFERENSI LENGKAP:\n{json.dumps(data)}"
        else:
            context_text = "Belum ada data referensi."
            
    elif req.mode == "RAG":
        vs = rag_service.load_resources_if_needed("RAG")
        if vs:
            docs = vs.similarity_search(req.message, k=4)
            context_text = "POTONGAN DOKUMEN RELEVAN:\n" + "\n".join([d.page_content for d in docs])
        else:
            context_text = "Belum ada index data."

    # 2. Prompt Engineering
    system_prompt = f"""
    Kamu adalah MediSales AI, asisten sales obat.
    Jawab HANYA berdasarkan konteks di bawah.
    Gunakan Bahasa Sales yang sopan. Jika perlu perbandingan, buat TABEL Markdown.
    
    KONTEKS:
    {context_text}
    """

    # 3. Call AI
    try:
        completion = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.message}
            ],
            stream=False # Untuk demo API biasa (Non-streaming)
        )
        response_text = completion.choices[0].message.content
        return ChatResponse(response=response_text, context_used=context_text[:200]+"...")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")
