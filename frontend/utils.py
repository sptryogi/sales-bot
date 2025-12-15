import os
import json
from PyPDF2 import PdfReader
import docx2txt
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
# from langchain_openai import OpenAIEmbeddings

# --- FUNGSI PEMBACA DOKUMEN ---
def get_pdf_text(pdf_path):
    text = ""
    pdf_reader = PdfReader(pdf_path)
    for page in pdf_reader.pages:
        text += page.extract_text() or ""
    return text

def get_docx_text(docx_path):
    return docx2txt.process(docx_path)

def load_data_from_folder(folder_path):
    """Membaca semua file di folder data"""
    docs_content = {} # Format JSON: {'filename': 'isi teks'}
    
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        return docs_content

    for filename in os.listdir(folder_path):
        file_path = os.path.join(folder_path, filename)
        if filename.endswith('.pdf'):
            docs_content[filename] = get_pdf_text(file_path)
        elif filename.endswith('.docx') or filename.endswith('.doc'):
            docs_content[filename] = get_docx_text(file_path)
            
    return docs_content

# --- LOGIKA MODE BIASA (CONVERT TO JSON CONTEXT) ---
def get_context_json(folder_path):
    data = load_data_from_folder(folder_path)
    # Convert dictionary ke JSON string agar mudah dibaca AI
    return json.dumps(data, indent=2)

# --- LOGIKA MODE RAG (VECTOR SEARCH) ---
# def get_rag_chain(folder_path):
#     # 1. Load Data
#     raw_data = load_data_from_folder(folder_path)
#     text_corpus = ""
#     for filename, text in raw_data.items():
#         text_corpus += f"\n--- Sumber: {filename} ---\n{text}"

#     if not text_corpus.strip():
#         return None

#     # 2. Split Text (Agar muat diproses embedding)
#     text_splitter = RecursiveCharacterTextSplitter(
#         chunk_size=1000,
#         chunk_overlap=200
#     )
#     chunks = text_splitter.split_text(text_corpus)

#     # 3. Create Embeddings & Vector Store
#     # Kita pakai model lokal ringan 'all-MiniLM-L6-v2' agar cepat di Streamlit Cloud
#     # Ini alternatif fallback yang bagus daripada bergantung embedding API berbayar
#     embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    
#     # 4. Simpan ke FAISS (RAM Vector Store)
#     vector_store = FAISS.from_texts(chunks, embeddings)
    
#     return vector_store
def get_rag_chain(folder_path, api_key_deepseek=None): # Terima API Key disini
    # 1. Load Data
    raw_data = load_data_from_folder(folder_path)
    text_corpus = ""
    for filename, text in raw_data.items():
        text_corpus += f"\n--- Sumber: {filename} ---\n{text}"

    if not text_corpus.strip():
        return None

    # 2. Split Text
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    chunks = text_splitter.split_text(text_corpus)

    # 3. Create Embeddings (GANTI BAGIAN INI)
    
    # OPSI A: Pakai DeepSeek Embedding (Berbayar/API)
    # Catatan: DeepSeek API Embeddings biasanya support model 'deepseek-embedding' (cek dokumentasi terbaru mereka jika nama berubah)
    # Jika API DeepSeek error, otomatis fallback ke lokal pakai try-except
    
    try:
        if not api_key_deepseek:
            raise ValueError("API Key kosong")
            
        embeddings = OpenAIEmbeddings(
            model="deepseek-embedding-v1", # Pastikan nama model valid di DeepSeek docs (kadang mereka pakai nama lain)
            openai_api_key=api_key_deepseek,
            openai_api_base="https://api.deepseek.com" # Base URL DeepSeek
        )
        print("Menggunakan DeepSeek Embedding API...")
        
    except Exception as e:
        print(f"Gagal pakai DeepSeek Embedding ({e}), beralih ke Model Lokal Ringan...")
        # OPSI B: Fallback ke Model Lokal (Gratis & Ringan)
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L12-v2")
    
    # 4. Simpan ke FAISS
    vector_store = FAISS.from_texts(chunks, embeddings)
    
    return vector_store
