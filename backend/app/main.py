from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .chat import router as chat_router
from .rag import build_rag
from .utils import build_json_context
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)

os.makedirs("storage", exist_ok=True)

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
