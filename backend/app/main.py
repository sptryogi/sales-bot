from fastapi import FastAPI
from .chat import router as chat_router
from .rag import build_rag
from .utils import build_json_context
import os

print("🚀 STARTING FASTAPI APP")
print("ENV VAR CHECK:")
print("SUPABASE_URL:", os.getenv("SUPABASE_URL"))
print("DEEPSEEK_API_KEY:", "SET" if os.getenv("DEEPSEEK_API_KEY") else "MISSING")

app = FastAPI()
app.include_router(chat_router)

@app.get("/")
def health():
    return {"status": "ok"}

@app.post("/admin/build-json")
def build_json():
    build_json_context("data", "storage/context.json")
    return {"status": "JSON built"}

@app.post("/admin/build-rag")
def build_rag_index():
    build_rag()
    return {"status": "RAG built"}
