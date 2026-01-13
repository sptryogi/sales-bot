import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './ThinkingDots.module.css'
import { MoreVertical, Loader2, Trash2, Edit3, X, FileIcon, ImageIcon, Send, Paperclip, LogOut, Bot, Database, FileText, PanelLeftClose, PanelLeftOpen, Plus, Sun, Moon, MessageSquare, MapPin, Award, Sparkles, Settings, ShieldCheck, MessageSquarePlus, Languages } from 'lucide-react'

const API_URL = import.meta.env.VITE_BACKEND_URL;

export default function Chat({ session, darkMode, setDarkMode, language, setLanguage }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([]) 
  const [sessions, setSessions] = useState([]) // Daftar Room
  const [currentSessionId, setCurrentSessionId] = useState(null) // Room Aktif

  const [activeMenu, setActiveMenu] = useState(null); // Untuk tracking titik tiga mana yang terbuka
  const [attachedFile, setAttachedFile] = useState(null); // File yang akan diupload
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [webSearch, setWebSearch] = useState(false); // State untuk Web Search
  const [isSidebarLoading, setIsSidebarLoading] = useState(false);

  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [profLevel, setProfLevel] = useState('Pemula'); // Default: Pemula
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  
  const [geoLocation, setGeoLocation] = useState(false);
  const [locationInfo, setLocationInfo] = useState(null);

  const [evaluation, setEvaluation] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);

  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState('rag') 
  const [showSidebar, setShowSidebar] = useState(window.innerWidth >= 768)
  
  const messagesEndRef = useRef(null)
  const scrollAreaRef = useRef(null) // Ref untuk div yang bisa di-scroll

  const [showToolsMenu, setShowToolsMenu] = useState(false);

  // --- LOGIC SCROLL ---
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current;
      // Gunakan scrollTo agar lebih presisi dan tuntas
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: "smooth" // Gunakan 'instant' jika ingin tanpa delay sama sekali
      });
    }
  }
  useEffect(scrollToBottom, [messages])

  // --- LOGIC LOAD SESSIONS & HISTORY ---
  
  // 1. Ambil daftar room saat pertama load
  // useEffect(() => {
  //   fetchSessions()
  // }, [])

  const fetchSessions = async () => {
    if (!session?.access_token) return; 

    setIsSidebarLoading(true);
    try {
        const res = await axios.get(`${API_URL}/sessions`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });

        const sessionData = Array.isArray(res.data) ? res.data : [];
        setSessions(sessionData);
        
        if (sessionData.length > 0 && !currentSessionId) {
            loadChatHistory(sessionData[0].id);
        }
      
        // setSessions(res.data)
    
        // if (res.data.length > 0 && !currentSessionId) {
        //     loadChatHistory(res.data[0].id)
        // }

    } catch (e) {
        console.error("Gagal load session", e)
        if (e.response?.status === 401) {
            supabase.auth.signOut();
        }
    } finally {
        setIsSidebarLoading(false);
    }
  }

  useEffect(() => {
      if (session) {
          fetchSessions();
      }
  }, [session]);

  
  // 2. Fungsi Load History Chat per Session
  const loadChatHistory = async (sessionId) => {
    setCurrentSessionId(sessionId)
    setIsLoading(true)
    
    try {
        // Panggil Endpoint Baru yang kita buat di Step 1
        const res = await axios.get(`${API_URL}/history/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
        
        // Format data dari database ke format state frontend
        // Database: { content: "...", role: "user" } -> Frontend butuh sama
        setMessages(res.data) 
    } catch (e) { 
        console.error(language === 'ID' ? "Gagal load history" : "Failed to load history", e)
        setMessages([]) 
    } finally {
        setIsLoading(false)
        // Scroll ke bawah setelah data masuk
        setTimeout(() => scrollToBottom(), 100) 
    }
  }

  // 3. Buat Room Baru
  const handleNewChat = () => {
    // Jangan create session di backend dulu biar gak nyampah data kosong.
    // Cukup reset state di frontend. Session dibuat saat user kirim pesan pertama.
    setCurrentSessionId(null)
    setMessages([])
    setInput('')
    if(window.innerWidth < 768) setShowSidebar(false) // Tutup sidebar di HP
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const toggleGeoLocation = () => {
    if (!geoLocation) {
      const confirmGPS = window.confirm(language === 'ID' ? "Izinkan MediSales mengakses lokasi GPS Anda untuk memberikan rekomendasi yang lebih relevan?" : "Allow MediSales to access your GPS location to provide more relevant recommendations?");
      if (confirmGPS) {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
              // Menggunakan Nominatim (Free) untuk Reverse Geocoding
              const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
              const address = res.data.address;
              const city = address.city || address.town || address.village || address.state;
              setLocationInfo(`${city}, ${address.country}`);
              setGeoLocation(true);
            } catch (err) {
              alert(language === 'ID' ? "Gagal mendapatkan detail alamat." : "Failed to get address details.", e);
            }
          }, (error) => {
            alert(language === 'ID' ? "Akses GPS ditolak atau error." : "GPS access denied or error.");
          });
        } else {
          alert(language === 'ID' ? "Browser Anda tidak mendukung Geolocation." : "Your browser does not support Geolocation.");
        }
      }
    } else {
      setGeoLocation(false);
      setLocationInfo(null);
    }
  };


  // 4. Handle Send (Logic Diperbaiki agar tidak hilang)
  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    const currentFile = attachedFile;
    const { access_token } = session;

    // Reset UI Input
    setInput('');
    setAttachedFile(null);
    setShowUploadMenu(false);
    
    // Optimistic Update
    setMessages(prev => [...prev, { role: 'user', content: userMessage, file_metadata: currentFile }]);
    setIsLoading(true);

    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mode: mode,
                message: userMessage,
                session_id: currentSessionId,
                file_metadata: currentFile,
                language: language,
                professionalism: profLevel,
                web_search: webSearch,
                location_data: locationInfo
            })
        });

        if (!response.ok) throw new Error('Network response was not ok');

        // --- LOGIKA SESSION ID ---
        // Ambil ID dari header yang dikirim backend tadi
        const returnedSessionId = response.headers.get('x-session-id');
        
        if (!currentSessionId && returnedSessionId) {
            setCurrentSessionId(returnedSessionId);
            fetchSessions(); // Refresh sidebar karena ini room baru
        }

        // --- LOGIKA STREAMING ASLI ---
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        // Tambahkan bubble assistant kosong
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        setIsLoading(false); // Matikan loading/thinking dots karena teks sudah mulai masuk

        let accumulatedText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            accumulatedText += chunk;

            // Update pesan assistant terakhir secara real-time
            setMessages(prev => {
                const updated = [...prev];
                const lastIndex = updated.length - 1;
                updated[lastIndex] = { ...updated[lastIndex], content: accumulatedText };
                return updated;
            });
        }

    } catch (error) {
        console.error("Error Streaming:", error);
        setMessages(prev => [...prev, { role: 'assistant', content: language === 'ID' ? "Maaf, terjadi kesalahan koneksi." : "Sorry, a connection error occurred."}]);
        setIsLoading(false);
    }
  };
  
  // --- FUNGSI FILE ---
  const handleFileChange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
  
      // 1. SET INSTAN (Langsung tampil di UI sebelum upload selesai)
      setAttachedFile({
          name: file.name,
          type: file.type,
          size: file.size,
          // Preview lokal sementara untuk gambar
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
          url: null // Belum ada URL asli karena belum selesai upload
      });
      
      setIsUploading(true);
      setShowUploadMenu(false);
  
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${session.user.id}/${fileName}`;
  
          const { data, error } = await supabase.storage
              .from('chat-attachments')
              .upload(filePath, file);
  
          if (error) throw error;
  
          const { data: { publicUrl } } = supabase.storage
              .from('chat-attachments')
              .getPublicUrl(filePath);
  
          // 2. UPDATE state dengan URL asli dari Supabase setelah sukses
          setAttachedFile(prev => ({
              ...prev,
              url: publicUrl
          }));
          
      } catch (err) {
          alert(language === 'ID' ? "Gagal upload file ke storage" : "Failed to upload file to storage");
          setAttachedFile(null); // Hapus preview jika gagal
      } finally {
          setIsUploading(false);
      }
  };
  
  // --- FUNGSI ROOM ACTIONS ---
  const handleDeleteSession = async (id) => {
      if (!confirm(language === 'ID' ? "Hapus room ini?" : "Delete this room?")) return;
      await axios.delete(`${API_URL}/sessions/${id}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSessionId === id) handleNewChat();
  };
  
  const handleRenameSession = async (id) => {
      const newTitle = prompt(language === 'ID' ? "Masukkan nama baru:" : "Enter new name:");
      if (!newTitle) return;
      await axios.patch(`${API_URL}/sessions/${id}`, { title: newTitle }, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const handleEvaluate = async () => {
      setIsEvaluating(true);
      try {
          const res = await axios.get(`${API_URL}/evaluate-sales`, {
              headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          setEvaluation(res.data.evaluation);
          setShowEvalModal(true); // Langsung buka modal saat hasil siap
      } catch (err) {
          alert(language === 'ID' ? "Gagal mengambil laporan evaluasi." : "Failed to retrieve evaluation report.");
      } finally {
          setIsEvaluating(false);
      }
  };

  // Helper Membersihkan Judul di Sidebar
  const cleanTitle = (title) => {
      if(!title) return "New Chat"
      return title.replace(/[*#_]/g, '').trim()
  }

  useEffect(() => {
    const handleResize = () => {
      // Jika layar di bawah 768px (mobile), otomatis sembunyikan sidebar
      if (window.innerWidth < 768) {
        setShowSidebar(false)
      } else {
        setShowSidebar(true)
      }
    }
    // Jalankan saat load
    handleResize()
  }, [])

  const levels = [
    { id: "Pemula", label: language === 'ID' ? "Pemula" : "Beginner" },
    { id: "Menengah", label: language === 'ID' ? "Menengah" : "Intermediate" },
    { id: "Expert", label: "Expert" }
  ];
  

  return (
    <div className="flex h-[100dvh] bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans overflow-hidden transition-colors duration-300">
      
      {/* --- OVERLAY MOBILE (Klik luar untuk tutup) --- */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/10 z-30 md:hidden animate-in fade-in duration-300"
          onClick={() => setShowSidebar(false)}
        />
      )}
      
      {/* --- SIDEBAR --- */}
      <div 
        className={`${showSidebar ? 'w-64 translate-x-0' : 'w-0 -translate-x-full opacity-0 overflow-hidden'} 
        bg-gray-50 dark:bg-black flex flex-col transition-all duration-300 ease-in-out border-r border-gray-200 dark:border-gray-800 absolute md:relative z-50 h-full`}
      >
        <div className="p-3 flex items-center justify-between">
            <button 
                onClick={handleNewChat}
                className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-700 transition-colors shadow-sm"
            >
                <Plus size={16} /> {language === 'ID' ? 'Chat Baru' : 'New Chat'}
            </button>
            <button onClick={() => setShowSidebar(false)} className="md:hidden ml-2 text-gray-500">
                <PanelLeftClose size={20}/>
            </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className="text-xs font-semibold text-gray-500 mb-2 px-2">{language === 'ID' ? 'Riwayat Percakapan' : 'Conversation History'}</div>
          {sessions.map((sess) => (
            <div key={sess.id} className="relative group px-2">
              <button 
                onClick={() => loadChatHistory(sess.id)}
                className={`w-full text-left px-3 py-2 text-sm rounded-md truncate flex items-center justify-between
                    ${currentSessionId === sess.id ? 'bg-gray-200 dark:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-900'}`}
              >
                <div className="flex items-center gap-2 truncate">
                    <MessageSquare size={14} className="flex-shrink-0 opacity-70"/>
                    <span className="truncate">{cleanTitle(sess.title)}</span>
                </div>
                
                {/* Tombol Titik Tiga (Muncul saat hover atau jika menu aktif) */}
                <div className="flex items-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === sess.id ? null : sess.id); }}
                      className="p-1 hover:bg-gray-300 dark:hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical size={14} />
                    </button>
                </div>
              </button>
          
              {/* Dropdown Menu */}
              {activeMenu === sess.id && (
                  <div className="absolute right-2 top-10 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-30 py-1">
                      <button onClick={() => { handleRenameSession(sess.id); setActiveMenu(null); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                          <Edit3 size={12} /> {language === 'ID' ? 'Ganti Nama' : 'Rename'}
                      </button>
                      <button onClick={() => { handleDeleteSession(sess.id); setActiveMenu(null); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                          <Trash2 size={12} /> {language === 'ID' ? 'Hapus' : 'Delete'}
                      </button>
                  </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-800 w-full my-2">
          {/* Tombol Setting & Feedback */}
          <div className="relative px-2 mb-2">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all group"
            >
              <Settings size={20} className="group-hover:rotate-45 transition-transform duration-500"/>
              <span className="text-sm font-medium">{language === 'ID' ? 'Pengaturan & Masukan' : 'Settings & Feedback'}</span>
            </button>
          
            {/* Dropdown Menu Setting */}
            {showSettingsMenu && (
              <div className="absolute bottom-full left-0 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-2 mb-2 z-[60] animate-in fade-in slide-in-from-bottom-4">
                {/* Header Panel dengan Tombol X */}
                <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'ID' ? 'Pengaturan' : 'Settings'}</span>
                  <button 
                    onClick={() => setShowSettingsMenu(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                
                {/* 1. Toggle Dark Mode */}
                <button onClick={() => setDarkMode(!darkMode)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-sm dark:text-gray-300">
                  <div className="flex items-center gap-3">
                    {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                    <span>Mode {darkMode ? (language === 'ID' ? 'Terang' : 'Light') : (language === 'ID' ? 'Gelap' : 'Dark')}</span>
                  </div>
                </button>

                <button
                  onClick={() => setLanguage(language === 'ID' ? 'EN' : 'ID')}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                      <Languages size={18} />
                    </div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {language === 'ID' ? 'Bahasa' : 'Language'}
                    </span>
                  </div>
                
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-600 text-white">
                    {language === 'ID' ? 'ID (Indonesia)' : 'EN (English)'}
                  </span>
                </button>
          
                {/* 2. Set Profesionalitas */}
                <div className="mt-1 p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 mb-2 px-1">
                    <ShieldCheck size={14} /> <span>{language === 'ID' ? 'LEVEL SALES' : 'SALES LEVEL'}: {profLevel}</span>
                  </div>
                  <div className="flex gap-1">
                    {levels.map((lvl) => (
                      <button
                        key={lvl.id}
                        onClick={() => setProfLevel(lvl.id)}
                        className={`flex-1 text-[10px] py-1.5 rounded-lg border transition-all font-medium ${
                          profLevel === lvl.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>
          
                {/* 3. Feedback */}
                <button 
                  onClick={() => { setShowFeedbackModal(true); setShowSettingsMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 mt-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 transition-all"
                >
                  <MessageSquarePlus size={18} />
                  <span>{language === 'ID' ? 'Kritik & Saran' : 'Feedback'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 px-2 mt-2 mb-2 pt-2 border-t border-gray-200 dark:border-gray-800">
             <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                {session.user.email[0].toUpperCase()}
             </div>
             <div className="text-sm font-medium truncate max-w-[120px]">
                {session.user.email}
             </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-2 py-2 text-sm text-red-500 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            <LogOut size={16} /> {language === 'ID' ? 'Keluar' : 'Logout'}
          </button>
        </div>
      </div>

      {/* --- MAIN AREA --- */}
      <div className="flex-1 flex flex-col relative h-full w-full bg-white dark:bg-gray-800 transition-colors duration-300">
        
        {/* Header Toggle */}
        <div className="absolute top-0 left-0 p-4 z-10 flex gap-2">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 active:scale-95 transition-all text-gray-500 dark:text-gray-400"
              title={showSidebar ? (language === 'ID' ? "Sembunyikan Sidebar" : "Hide Sidebar") : (language === 'ID' ? 'Tampilkan Sidebar' : 'Unhide Sidebar')}
            >
              {showSidebar ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
  
        </div>

        {/* Chat Messages */}
        <div
          ref={scrollAreaRef}
          className="flex-1 overflow-y-auto custom-scrollbar p-4 md:pt-12 pb-40"> 
          {messages.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-gray-800 dark:text-gray-100 transition-colors">
                <div className="bg-gray-100 dark:bg-white p-4 rounded-full mb-6 shadow-lg">
                    <Bot size={40} className="text-indigo-600 dark:text-black" />
                </div>
                <h2 className="text-2xl font-bold mb-2">MediSales AI</h2>
                <p className="text-gray-500 dark:text-gray-400">{language === 'ID' ? 'Siap membantu penjualan Anda.' : 'Ready to help your sales.'}</p>
             </div>
          )}

          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                
                <div 
                    className={`
                        px-5 py-3.5 max-w-[85%] md:max-w-[80%] text-[15px] leading-7 shadow-sm transition-colors
                        ${msg.role === 'user' 
                        ? 'bg-gray-200 dark:bg-[#3C3C3C] text-gray-900 dark:text-white rounded-3xl rounded-br-sm' 
                        : 'bg-transparent text-gray-800 dark:text-gray-100 rounded-3xl rounded-bl-sm'}
                    `}
                >
                  {msg.file_metadata && (
                      <a 
                          href={msg.file_metadata.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 mb-3 bg-black/5 dark:bg-white/10 rounded-2xl border border-black/5 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-all no-underline group/file"
                      >
                          {msg.file_metadata.type?.includes('image') ? (
                              <div className="relative w-12 h-12 flex-shrink-0">
                                  <img src={msg.file_metadata.url} className="w-full h-full object-cover rounded-lg shadow-sm" alt="preview" />
                              </div>
                          ) : (
                              <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-sm">
                                  <FileIcon size={20} />
                              </div>
                          )}
                          <div className="text-sm overflow-hidden">
                              <p className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px] mb-0.5">
                                  {msg.file_metadata.name}
                              </p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium group-hover/file:underline">
                                  {language === 'ID' ? 'Pratinjau' : 'Preview'}
                              </p>
                          </div>
                      </a>
                  )}
          
                    {msg.role === 'user' ? (
                        msg.content
                    ) : (
                        <div className="prose dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-table:border-collapse">
                            <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    table: ({node, ...props}) => <div className="overflow-x-auto my-4 rounded border border-gray-300 dark:border-gray-700"><table className="w-full text-left text-sm" {...props} /></div>,
                                    th: ({node, children, ...props}) => (
                                      <th className="bg-gray-100 dark:bg-gray-800 px-4 py-2 font-semibold border-b border-gray-300 dark:border-gray-700" {...props}>
                                        {typeof children === 'string' ? children.replace(/<br\s*\/?>|<\/br>/gi, ' ') : children}
                                      </th>
                                    ),
                                    td: ({node, children, ...props}) => {
                                      // Fungsi untuk membersihkan teks dari tag <br> yang nyangkut
                                      const cleanBR = (child) => {
                                        if (typeof child === 'string') {
                                          return child.replace(/<br\s*\/?>|<\/br>/gi, '\n');
                                        }
                                        return child;
                                      };
                                
                                      return (
                                        <td className="px-4 py-2 border-b border-gray-200 dark:border-gray-800" {...props}>
                                          <div className="whitespace-pre-line">
                                            {Array.isArray(children) ? children.map(c => cleanBR(c)) : cleanBR(children)}
                                          </div>
                                        </td>
                                      );
                                    },
                                    strong: ({node, ...props}) => <strong className="font-bold text-gray-900 dark:text-white" {...props} />
                                }}
                            >
                                {msg.content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
                </div>
            ))}
            {isLoading && (
              <div className="flex w-full justify-start mb-4 animate-in fade-in slide-in-from-left-2">
                <div className="flex items-start gap-3 max-w-[80%]">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                    <Bot size={18} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center">
                    <div className={styles['typing-dots']}>
                      <div className={styles.dot}></div>
                      <div className={styles.dot}></div>
                      <div className={styles.dot}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Dummy element untuk scroll anchor dengan margin bawah agar tidak kepotong */}
            <div ref={messagesEndRef} className="h-4" /> 
          </div>
        </div>

        {/* --- INPUT AREA --- */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white/95 to-transparent dark:from-gray-800 dark:via-gray-800/95 dark:to-transparent pt-10 p-4 pb-6 z-10 pointer-events-none">
           <div className="max-w-3xl mx-auto pointer-events-auto">
              {/* --- PINDAHKAN PREVIEW KE SINI (DI DALAM MAX-W-3XL) --- */}
              {attachedFile && (
                <div className={`flex items-center gap-3 p-2 rounded-xl mb-3 w-fit border relative animate-in fade-in slide-in-from-bottom-2 shadow-sm transition-all duration-300 ${
                  isUploading 
                  ? 'bg-gray-200 dark:bg-gray-700 opacity-60 grayscale border-gray-300 dark:border-gray-600' 
                  : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800'
                }`}>
                  
                  {/* Icon atau Preview Gambar */}
                  <div className={`p-2 rounded-lg transition-colors ${isUploading ? 'bg-gray-400' : 'bg-indigo-600 text-white'}`}>
                    {attachedFile.type?.includes('image') ? <ImageIcon size={20} /> : <FileIcon size={20} />}
                  </div>
              
                  <div className="flex flex-col pr-6">
                    <span className="text-xs font-semibold truncate max-w-[150px] dark:text-white">
                      {attachedFile.name}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 italic">
                      {isUploading ? (
                        <span className="flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" /> {language === 'ID' ? 'Sedang mengupload...' : 'Uploading...'}
                        </span>
                      ) : (language === 'ID' ? "File siap dikirim" : "Ready to send")}
                    </span>
                  </div>
              
                  {/* Tombol Hapus: Sembunyikan jika sedang upload untuk mencegah error data */}
                  {!isUploading && (
                    <button 
                      onClick={() => setAttachedFile(null)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-md border-2 border-white dark:border-gray-800"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}

              <div className="relative flex flex-col gap-2 bg-gray-50 dark:bg-[#2f2f2f] p-3 rounded-xl border border-gray-200 dark:border-gray-600 focus-within:border-gray-400 dark:focus-within:border-gray-500 shadow-lg transition-colors">
                 <textarea
                    rows={1}
                    className="w-full bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-0 resize-none py-2 px-2 max-h-40 overflow-y-auto"
                    placeholder={language === 'ID' ? "Kirim pesan ke MediSales..." : "Send a message to MediSales..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if(e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend(e)
                      }
                    }}
                    style={{ minHeight: '44px' }}
                 />
          

                 <div className="flex justify-between items-center mt-2 gap-2">
                    <div className="flex items-center gap-1">
                      {/* 1. TOMBOL UPLOAD (Sekarang Icon Plus) */}
                      <div className="relative">
                          {showUploadMenu && (
                              <div className="absolute bottom-12 left-0 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-2 z-50">
                                  <button 
                                      onClick={() => { fileInputRef.current.click(); setShowUploadMenu(false); }}
                                      className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white"
                                  >
                                      {/* Icon di dalam menu sekarang Paperclip */}
                                      <Paperclip size={14} /> {language === 'ID' ? 'Unggah Berkas' : 'Upload File'}
                                  </button>
                              </div>
                          )}
                          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx,image/*" />
                          <button 
                              onClick={() => { setShowUploadMenu(!showUploadMenu); setShowToolsMenu(false); }}
                              className={`p-2.5 rounded-xl transition-all ${showUploadMenu ? 'bg-gray-200 dark:bg-gray-700 text-indigo-600' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                          >
                              {/* Tombol luar sekarang Plus */}
                              <Plus size={22} className={`transition-transform duration-300 ${showUploadMenu ? 'rotate-45' : ''}`} />
                          </button>
                      </div>
                      
                  
                      {/* 2. TOMBOL ALAT (Sekarang Icon Sparkles + Teks 'Alat') */}
                      <div className="relative">
                          {showToolsMenu && (
                            <div className="absolute bottom-14 left-0 w-72 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-bottom-4">
                              <div className="px-1 mb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'ID' ? 'Fitur Tambahan' : 'Additional Features'}</div>
                              
                              <div className="grid grid-cols-2 gap-2">
                                {/* 1. RAG/Full Context Mode */}
                                <button 
                                  onClick={() => setMode(mode === 'rag' ? 'full' : 'rag')}
                                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${mode === 'rag' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-gray-50 border-transparent text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                                >
                                  {mode === 'rag' ? <Database size={20}/> : <FileText size={20}/>}
                                  <span className="text-[10px] font-bold uppercase tracking-tighter">Mode {mode === 'rag' ? 'RAG' : 'Full'}</span>
                                </button>
                          
                                {/* 2. Web Search */}
                                <button 
                                  onClick={() => setWebSearch(!webSearch)}
                                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${webSearch ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-gray-50 border-transparent text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                                >
                                  <Sparkles size={20} className={webSearch ? 'animate-pulse' : ''} />
                                  <span className="text-[10px] font-bold uppercase tracking-tighter">{language === 'ID' ? 'Pencarian Web' : 'Web Search'}</span>
                                </button>
                          
                                {/* 3. Geolocation */}
                                <button 
                                  onClick={toggleGeoLocation}
                                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${geoLocation ? 'bg-teal-50 border-teal-200 text-teal-600' : 'bg-gray-50 border-transparent text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                                >
                                  <MapPin size={20}/>
                                  <span className="text-[10px] font-bold uppercase tracking-tighter truncate w-full px-1">
                                    {geoLocation ? (language === 'ID' ? 'Aktif' : 'Active') : (language === 'ID' ? 'Lokasi' : 'Location')}
                                  </span>
                                </button>
                          
                                {/* 4. Sales Report */}
                                <button 
                                  onClick={handleEvaluate}
                                  disabled={isEvaluating}
                                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border border-transparent bg-gray-50 text-gray-500 hover:bg-indigo-600 hover:text-white transition-all dark:bg-gray-800 dark:text-gray-400 disabled:opacity-50"
                                >
                                  {isEvaluating ? <Loader2 size={20} className="animate-spin" /> : <Award size={20} />}
                                  <span className="text-[10px] font-bold uppercase tracking-tighter">{language === 'ID' ? 'Evaluasi Performa' : 'Evaluate Performance'}</span>
                                </button>
                              </div>
                            </div>
                          )}
                          
                          <button 
                              onClick={() => { setShowToolsMenu(!showToolsMenu); setShowUploadMenu(false); }}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${showToolsMenu ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                          >
                              {/* Icon Sparkles (Gemini-style) dan Teks Alat */}
                              <Sparkles size={20} className={showToolsMenu ? 'animate-pulse' : ''} />
                              <span className="text-sm font-medium">{language === 'ID' ? 'Alat' : 'Tools'}</span>
                          </button>
                      </div>
                    </div>
                
                    {/* --- TOMBOL KIRIM (DIPERBESAR & SEJAJAR) --- */}
                    <button 
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className={`flex items-center justify-center p-3 rounded-xl transition-all shadow-sm ${
                            input.trim() 
                            ? 'bg-indigo-600 text-white hover:scale-105 active:scale-95 shadow-indigo-200 dark:shadow-none' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {isLoading ? (
                            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Send size={22} />
                        )}
                    </button>
                 </div>
              </div>
              
              <div className="text-center text-[11px] text-gray-400 dark:text-gray-500 mt-2">
                 {language === 'ID' ? 'MediSales AI dapat membuat kesalahan. Cek informasi penting.' : 'MediSales AI can make mistakes. Check important information.'}
              </div>
           </div>
        </div>

      </div>
      {/* MODAL SALES REPORT */}
      {showEvalModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 w-full sm:max-w-2xl h-[90vh] sm:h-auto sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                  
                  {/* Header Modal - Perkecil padding di mobile */}
                  <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-indigo-600 shrink-0">
                      <div className="flex items-center gap-2 text-white text-sm sm:text-base">
                          <Award size={18} />
                          <h3 className="font-bold truncate">{language === 'ID' ? 'Laporan Performa Sales' : 'Sales Performance Report'}</h3>
                      </div>
                      <button onClick={() => setShowEvalModal(false)} className="text-white/80 hover:text-white">
                          <X size={20} />
                      </button>
                  </div>
      
                  {/* Content Modal - Tambahkan scrolling yang halus */}
                  <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar text-sm sm:text-base">
                      <div className="prose dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {(evaluation || '').replace(/<br\s*\/?>/gi, '\n')}
                          </ReactMarkdown>
                      </div>
                  </div>
      
                  {/* Footer Modal - Pastikan tombol penuh di mobile */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
                      <button 
                          onClick={() => setShowEvalModal(false)}
                          className="w-full sm:w-auto sm:float-right px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium"
                      >
                          {language === 'ID' ? 'Tutup' : 'Close'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL FEEDBACK */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                  <MessageSquarePlus className="text-indigo-600" /> Feedback
                </h2>
                <button onClick={() => setShowFeedbackModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X size={24} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{language === 'ID' ? 'Nama & Email' : 'Name & Email'}</label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm dark:text-gray-300 border border-gray-100 dark:border-gray-700">
                    <p className="font-bold">{session?.user?.user_metadata?.full_name || 'User'}</p>
                    <p className="opacity-60 text-xs">{session?.user?.email}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{language === 'ID' ? 'Kritik & Saran' : 'Feedback'}</label>
                  <textarea 
                    className="w-full p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 border-none text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    rows="4"
                    placeholder={language === 'ID' ? "Apa yang bisa kami tingkatkan?" : "What can we improve?"}
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                  />
                </div>
              </div>
              <button 
                disabled={isSendingFeedback || !feedbackMessage.trim()}
                onClick={async () => {
                  setIsSendingFeedback(true);
                  try {
                    await axios.post(`${API_URL}/feedback`, {
                      name: session?.user?.user_metadata?.full_name || 'User',
                      email: session?.user?.email,
                      message: feedbackMessage
                    });
                    alert("Feedback terkirim ke Kami. Terima kasih!");
                    setShowFeedbackModal(false);
                    setFeedbackMessage('');
                  } catch (err) { alert(language === 'ID' ? 'Gagal mengirim feedback.' : 'failed to send feedback'); }
                  finally { setIsSendingFeedback(false); }
                }}
                className="w-full mt-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                {isSendingFeedback ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                {language === 'ID' ? 'Kirim Feedback' : 'Send Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
