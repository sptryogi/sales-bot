import os
import shutil
from supabase import create_client
from app.config import settings

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
BUCKET_NAME = "pharmasales-data"

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def download_raw_files():
    """Download semua PDF/Word dari folder 'raw/' di Supabase"""
    local_raw_path = os.path.join(settings.TEMP_DIR, "raw")
    ensure_dir(local_raw_path)
    
    # List file di bucket folder raw
    files = supabase.storage.from_(BUCKET_NAME).list("raw")
    
    downloaded_files = []
    for file in files:
        file_name = file['name']
        if file_name.endswith(('.pdf', '.docx', '.doc')):
            # Download byte data
            data = supabase.storage.from_(BUCKET_NAME).download(f"raw/{file_name}")
            save_path = os.path.join(local_raw_path, file_name)
            with open(save_path, "wb") as f:
                f.write(data)
            downloaded_files.append(save_path)
            
    return downloaded_files

def upload_file(local_path, storage_path):
    with open(local_path, "rb") as f:
        supabase.storage.from_(BUCKET_NAME).upload(storage_path, f, file_options={"upsert": "true"})

def download_file(storage_path, local_path):
    try:
        data = supabase.storage.from_(BUCKET_NAME).download(storage_path)
        with open(local_path, "wb") as f:
            f.write(data)
        return True
    except Exception:
        return False # File mungkin belum ada

def zip_folder(folder_path, output_path):
    shutil.make_archive(output_path.replace('.zip', ''), 'zip', folder_path)

def unzip_folder(zip_path, extract_to):
    shutil.unpack_archive(zip_path, extract_to)
