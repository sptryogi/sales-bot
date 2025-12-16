from fastapi import FastAPI
from .chat import router as chat_router
from .rag import build_rag
from .utils import build_json_context

app = FastAPI()
app.include_router(chat_router)

@app.post("/admin/build-json")
def build_json():
    build_json_context("data", "storage/context.json")
    return {"status": "JSON built"}

@app.post("/admin/build-rag")
def build_rag_index():
    build_rag()
    return {"status": "RAG built"}
