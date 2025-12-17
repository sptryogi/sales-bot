import os
import json
from PyPDF2 import PdfReader
import docx2txt

def get_pdf_text(path):
    reader = PdfReader(path)
    return "\n".join([p.extract_text() or "" for p in reader.pages])

def get_docx_text(path):
    return docx2txt.process(path)

def load_data(folder):
    data = {}
    for f in os.listdir(folder):
        p = os.path.join(folder, f)
        if f.endswith(".pdf"):
            data[f] = get_pdf_text(p)
        elif f.endswith(".docx") or f.endswith(".doc"):
            data[f] = get_docx_text(p)
    return data

def build_json_context(data_folder, output_path):
    data = load_data(data_folder)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
