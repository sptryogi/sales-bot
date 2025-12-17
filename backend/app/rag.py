import os
import json
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from .utils import load_data

DATA_FOLDER = "data"
STORAGE = "storage"

def build_rag():
    from langchain_huggingface import HuggingFaceEmbeddings
    raw = load_data(DATA_FOLDER)
    corpus = ""

    for k, v in raw.items():
        corpus += f"\n--- {k} ---\n{v}"

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_text(corpus)

    embed = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L12-v2"
    )

    vs = FAISS.from_texts(chunks, embed)
    vs.save_local(os.path.join(STORAGE, "faiss_index"))

def load_rag():
    from langchain_huggingface import HuggingFaceEmbeddings
    embed = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L12-v2"
    )
    return FAISS.load_local(
        os.path.join(STORAGE, "faiss_index"),
        embed,
        allow_dangerous_deserialization=True
    )
