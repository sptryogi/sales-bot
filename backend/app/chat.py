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
    Kamu adalah MediSales AI.
    Jawab hanya berdasarkan konteks berikut:
    {context}
    """

    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-6:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    res = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages
    )

    answer = res.choices[0].message.content

    save_chat(user.id, "user", message)
    save_chat(user.id, "assistant", answer)

    return {"answer": answer}
