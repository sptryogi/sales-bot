import os
import json
import pickle
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import OpenAIEmbeddings
from PyPDF2 import PdfReader
import docx2txt
from app.config import settings
from app.services import storage_service

# --- GLOBAL CACHE ---
# Agar tidak load ulang setiap ada chat masuk
global_vector_store = None
global_json_context = None

# --- HELPER TEXT ---
def get_text_from_files(file_paths):
    full_text = ""
    docs_map = {}
    
    for path in file_paths:
        filename = os.path.basename(path)
        text = ""
        if path.endswith('.pdf'):
            reader = PdfReader(path)
            text = "".join([page.extract_text() or "" for page in reader.pages])
        elif path.endswith('.docx'):
            text = docx2txt.process(path)
        
        full_text += f"\n--- SUMBER: {filename} ---\n{text}"
        docs_map[filename] = text
        
    return full_text, docs_map

def get_embeddings_model():
    """Prioritas DeepSeek API, fallback ke Lokal"""
    try:
        if settings.DEEPSEEK_API_KEY:
             return OpenAIEmbeddings(
                model="deepseek-embedding", # Sesuaikan nama model di DeepSeek
                openai_api_key=settings.DEEPSEEK_API_KEY,
                openai_api_base="https://api.deepseek.com"
            )
    except:
        pass
    
    print("Fallback to Local Embeddings...")
    return HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

# --- CORE FUNCTIONS ---

def build_index(mode="RAG"):
    """
    Dipanggil saat Admin klik 'Update Data'.
    1. Download Raw files.
    2. Proses jadi Index/JSON.
    3. Upload hasil proses ke Supabase.
    """
    raw_files = storage_service.download_raw_files()
    full_text, docs_map = get_text_from_files(raw_files)
    
    if mode == "JSON":
        # Simpan JSON
        json_path = os.path.join(settings.TEMP_DIR, "context.json")
        with open(json_path, "w") as f:
            json.dump(docs_map, f)
        
        # Upload
        storage_service.upload_file(json_path, "index/context.json")
        return "JSON Context Berhasil Diupdate ke Cloud"

    elif mode == "RAG":
        # Split Text
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = splitter.split_text(full_text)
        
        # Embed & Vector Store
        embeddings = get_embeddings_model()
        vector_store = FAISS.from_texts(chunks, embeddings)
        
        # Save Local
        faiss_path = os.path.join(settings.TEMP_DIR, "faiss_index")
        vector_store.save_local(faiss_path)
        
        # Zip folder FAISS
        zip_path = os.path.join(settings.TEMP_DIR, "faiss_index.zip")
        storage_service.zip_folder(faiss_path, zip_path)
        
        # Upload Zip
        storage_service.upload_file(zip_path, "index/faiss_index.zip")
        return "RAG Index Berhasil Diupdate ke Cloud"

def load_resources_if_needed(mode):
    """
    Dipanggil saat Chat. Cek apakah resources sudah ada di memori.
    Jika belum, download dari Supabase.
    """
    global global_vector_store, global_json_context
    
    if mode == "JSON":
        if global_json_context is None:
            print("Downloading JSON Context...")
            local_path = os.path.join(settings.TEMP_DIR, "context.json")
            if storage_service.download_file("index/context.json", local_path):
                with open(local_path, "r") as f:
                    global_json_context = json.load(f)
            else:
                return None
        return global_json_context

    elif mode == "RAG":
        if global_vector_store is None:
            print("Downloading RAG Index...")
            zip_path = os.path.join(settings.TEMP_DIR, "faiss_index.zip")
            extract_path = os.path.join(settings.TEMP_DIR, "faiss_index")
            
            if storage_service.download_file("index/faiss_index.zip", zip_path):
                storage_service.unzip_folder(zip_path, extract_path)
                
                embeddings = get_embeddings_model()
                # Allow dangerous deserialization karena kita percaya file kita sendiri
                global_vector_store = FAISS.load_local(extract_path, embeddings, allow_dangerous_deserialization=True)
            else:
                return None
        return global_vector_store
