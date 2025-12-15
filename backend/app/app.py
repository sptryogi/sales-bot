import streamlit as st
import os
from openai import OpenAI
import utils

# --- KONFIGURASI HALAMAN ---
st.set_page_config(page_title="PharmaSales Bot", page_icon="💊", layout="centered")

# --- CUSTOM CSS (WHATSAPP STYLE) ---
st.markdown("""
<style>
    /* Background Chat seperti WA */
    .stApp {
        background-color: #E5DDD5;
    }
    
    /* Bubble Chat User (Hijau Khas WA) */
    .stChatMessage[data-testid="stChatMessage"]:nth-child(odd) {
        background-color: #dcf8c6;
        border-radius: 10px;
        padding: 10px;
        box-shadow: 0 1px 0.5px rgba(0,0,0,0.13);
        color: black;
    }
    
    /* Bubble Chat Bot (Putih) */
    .stChatMessage[data-testid="stChatMessage"]:nth-child(even) {
        background-color: #ffffff;
        border-radius: 10px;
        padding: 10px;
        box-shadow: 0 1px 0.5px rgba(0,0,0,0.13);
        color: black;
    }
    
    /* Hapus avatar default biar lebih bersih atau ganti nanti */
    .stChatMessage .stChatMessageAvatar {
        display: none;
    }

    /* Bubble User (kanan, hijau WA) */
    .stChatMessage[data-testid="stChatMessage"][data-chat-message-kind="user"] {
        background-color: #dcf8c6 !important;
        margin-left: auto !important;
        margin-right: 5px !important;
        border-radius: 10px 0px 10px 10px !important;
        max-width: 75% !important;
    }
    
    /* Bubble Bot (kiri, abu-abu) */
    .stChatMessage[data-testid="stChatMessage"][data-chat-message-kind="assistant"] {
        background-color: #f0f0f0 !important;
        margin-right: auto !important;
        margin-left: 5px !important;
        border-radius: 0px 10px 10px 10px !important;
        max-width: 75% !important;
    }
</style>
""", unsafe_allow_html=True)

# --- SIDEBAR CONFIGURATION ---
with st.sidebar:
    st.header("⚙️ Pengaturan")
    
    # Input API Key DeepSeek
    # api_key = st.text_input("DeepSeek API Key", type="password", placeholder="sk-...")
    # if not api_key:
    #     st.warning("Masukkan API Key DeepSeek untuk memulai.")
    api_key = st.secrets["DEEPSEEK_API_KEY"]
    
    st.markdown("---")
    
    # Pilihan Mode
    mode = st.radio(
        "Pilih Mode AI:",
        ("Mode Biasa (Full Context JSON)", "Mode RAG (Retrieval Search)"),
        help="Mode Biasa membaca semua file sekaligus. Mode RAG mencari bagian spesifik (cocok untuk data banyak)."
    )
    
    st.markdown("---")
    
    if st.button("🔄 Muat Ulang Data Obat"):
        st.session_state.pop('vector_store', None)
        st.session_state.pop('json_context', None)
        st.rerun()

    st.info("Pastikan file PDF/Word ada di folder 'data'.")

# --- INISIALISASI SESSION STATE ---
if "messages" not in st.session_state:
    st.session_state.messages = []

# --- LOAD DATA (CACHED) ---
DATA_FOLDER = 'data'

if mode == "Mode Biasa (Full Context JSON)" and "json_context" not in st.session_state:
    with st.spinner("Mengonversi dokumen ke JSON..."):
        st.session_state.json_context = utils.get_context_json(DATA_FOLDER)
        
# elif mode == "Mode RAG (Retrieval Search)" and "vector_store" not in st.session_state:
#     with st.spinner("Membangun index RAG (Embedding)..."):
#         st.session_state.vector_store = utils.get_rag_chain(DATA_FOLDER)
elif mode == "Mode RAG (Retrieval Search)" and "vector_store" not in st.session_state:
    if not api_key:
        st.warning("Masukkan API Key dulu untuk Embedding DeepSeek!")
    else:
        with st.spinner("Membangun index RAG..."):
            # Kirim api_key ke utils
            st.session_state.vector_store = utils.get_rag_chain(DATA_FOLDER, api_key_deepseek=api_key)

# --- HEADER APLIKASI ---
st.title("💊 Asisten Sales Obat")
st.markdown("*Tanyakan tentang produk, dosis, atau perbandingan obat.*")

# --- TAMPILKAN CHAT HISTORY ---
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# --- LOGIKA CHAT UTAMA ---
if prompt := st.chat_input("Ketik pertanyaan Anda di sini..."):
    
    if not api_key:
        # st.error("Mohon masukkan API Key di sidebar kiri.")
        st.error("Mohon masukkan API Key Anda.")
        st.stop()

    # 1. Tampilkan pesan user
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # 2. Siapkan Context berdasarkan Mode
    final_context = ""
    system_instruction = ""
    
    if mode == "Mode Biasa (Full Context JSON)":
        raw_json = st.session_state.get('json_context', "{}")
        final_context = f"DATA REFERENSI (JSON):\n{raw_json}"
    else: # Mode RAG
        vs = st.session_state.get('vector_store')
        if vs:
            docs = vs.similarity_search(prompt, k=3) # Ambil 3 potongan teratas
            content_found = "\n".join([d.page_content for d in docs])
            final_context = f"POTONGAN DOKUMEN RELEVAN:\n{content_found}"
        else:
            final_context = "Tidak ada dokumen ditemukan di folder data."

    # 3. Definisikan Persona Sales
    system_prompt = f"""
    Kamu adalah 'MediSales AI', asisten penjualan obat yang profesional, persuasif, tapi tetap akurat secara medis.
    Tugasmu menjawab pertanyaan user HANYA berdasarkan konteks yang diberikan di bawah.
    
    Gaya Bahasa:
    - Gunakan bahasa Indonesia yang sopan, ramah, dan meyakinkan (Sales Persona).
    - Jawab jangan terlalu panjang ya, lebih ringkas atau singkat saja.
    - Jika user bertanya perbandingan, BUATLAH TABEL Markdown agar jelas.
    - Jika informasi tidak ada di konteks, katakan jujur bahwa kamu tidak memiliki data tersebut, jangan mengarang.
    - Akhiri dengan kalimat penutup sales yang mengajak (Call to Action) jika relevan.

    KONTEKS:
    {final_context}
    """

    # 4. Panggil DeepSeek API
    client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        full_response = ""
        
        try:
            stream = client.chat.completions.create(
                model="deepseek-chat", # Atau deepseek-coder, sesuaikan
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                stream=True
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    full_response += chunk.choices[0].delta.content
                    message_placeholder.markdown(full_response + "▌")
            
            message_placeholder.markdown(full_response)
            
        except Exception as e:
            st.error(f"Terjadi kesalahan koneksi AI: {e}")
            full_response = "Maaf, terjadi gangguan pada server. Silakan coba lagi."

    # 5. Simpan respon ke history
    st.session_state.messages.append({"role": "assistant", "content": full_response})

# --- AUTO-SCROLL JAVASCRIPT ---
# Kode ini akan dijalankan setiap kali ada interaksi untuk memaksa scroll ke bawah
st.components.v1.html("""
<script>
const chatContainer = window.parent.document.querySelector('[data-testid="stChatMessageContainer"]');

function scrollToBottom() {
    if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

setTimeout(scrollToBottom, 300);
</script>
""", height=0, width=0)
