from fastapi import APIRouter, Depends
from openai import OpenAI
import json, os
from .auth import get_current_user
from .supabase_db import save_chat, load_chat
from .rag import load_rag

router = APIRouter()
client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)

@router.post("/chat")
def chat(payload: dict, user=Depends(get_current_user)):
    mode = payload["mode"]
    message = payload["message"]

    history = load_chat(user.id)

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
    - Jawab jangan terlalu panjang ya, lebih ringkas atau singkat saja.
    - Jika user bertanya perbandingan, BUATLAH TABEL Markdown agar jelas.
    - Jika informasi tidak ada di konteks, katakan jujur bahwa kamu tidak memiliki data tersebut, jangan mengarang.
    - Akhiri dengan kalimat penutup sales yang mengajak (Call to Action) jika relevan.
    
    Jawab hanya berdasarkan konteks berikut:
    {context}
    """

    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-6:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    res = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        stream=True
    )

    answer = res.choices[0].message.content

    save_chat(user.id, "user", message)
    save_chat(user.id, "assistant", answer)

    return {"answer": answer}
