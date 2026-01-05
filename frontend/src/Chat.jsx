import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './ThinkingDots.module.css'
import { MoreVertical, Loader2, Trash2, Edit3, X, FileIcon, ImageIcon, Send, Paperclip, LogOut, Bot, Database, FileText, PanelLeftClose, PanelLeftOpen, Plus, Sun, Moon, MessageSquare, MapPin, Award } from 'lucide-react'

const API_URL = import.meta.env.VITE_BACKEND_URL;

export default function Chat({ session, darkMode, setDarkMode }) {
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
  
  const [geoLocation, setGeoLocation] = useState(false);
  const [locationInfo, setLocationInfo] = useState(null);

  const [evaluation, setEvaluation] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);

  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState('rag') 
  const [showSidebar, setShowSidebar] = useState(true)
  
  const messagesEndRef = useRef(null)
  const scrollAreaRef = useRef(null) // Ref untuk div yang bisa di-scroll

  // --- LOGIC SCROLL ---
  // const scrollToBottom = () => {
  //   // Timeout kecil memastikan DOM sudah render bubble baru sebelum scroll
  //   setTimeout(() => {
  //       messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  //   }, 100)
  // }
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
        console.error("Gagal load history", e)
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
      const confirmGPS = window.confirm("Izinkan MediSales mengakses lokasi GPS Anda untuk memberikan rekomendasi yang lebih relevan?");
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
              alert("Gagal mendapatkan detail alamat.");
            }
          }, (error) => {
            alert("Akses GPS ditolak atau error.");
          });
        } else {
          alert("Browser Anda tidak mendukung Geolocation.");
        }
      }
    } else {
      setGeoLocation(false);
      setLocationInfo(null);
    }
  };


  // 4. Handle Send (Logic Diperbaiki agar tidak hilang)
  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input
    setInput('')
    const currentFile = attachedFile; // Simpan file ke variabel lokal

    setAttachedFile(null)    // INI KUNCINYA: Menghilangkan preview file di atas input
    setShowUploadMenu(false) // Pastikan menu upload tertutup
    
    // UI Optimistic Update (Tampilkan pesan user duluan)
    const tempMessages = [...messages, { role: 'user', content: userMessage, file_metadata: currentFile }]
    setMessages(tempMessages)
    setIsLoading(true)

    try {
      const { access_token } = session
      
      const response = await axios.post(`${API_URL}/chat`, {
        mode: mode,
        message: userMessage,
        session_id: currentSessionId, // Kirim ID (null jika new chat)
        file_metadata: currentFile,
        web_search: webSearch,
        location_data: locationInfo
      }, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });

      const fullAnswer = response.data.answer
      const returnedSessionId = response.data.session_id

      setIsLoading(false)

      // PENTING: Jika tadinya New Chat (null), sekarang kita punya ID dari backend
      // Kita harus simpan ID ini agar chat berikutnya masuk ke room yang sama
      if (!currentSessionId) {
          setCurrentSessionId(returnedSessionId)
          // Refresh list sidebar agar judul chat baru muncul
          fetchSessions() 
      }

      // Tambahkan bubble assistant kosong untuk persiapan streaming
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      
      // Efek Streaming
      let currentText = ''
      const words = fullAnswer.split(' ') 
      
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 30)) 
        currentText += (i === 0 ? '' : ' ') + words[i]
        
        setMessages(prev => {
          const updated = [...prev]
          const lastIndex = updated.length - 1
          if (updated[lastIndex]) {
              updated[lastIndex] = { ...updated[lastIndex], content: currentText }
          }
          return updated
        })
      }
    
    } catch (error) {
      console.error("Error:", error)
      setMessages(prev => [...prev, { role: 'assistant', content: "Maaf, terjadi kesalahan koneksi." }])
    } finally {
    }
  }

  // --- FUNGSI FILE ---
  const handleFileChange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
  
      setIsUploading(true);
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
  
          // INI PENTING: Pastikan semua property ini ada
          setAttachedFile({
              name: file.name,
              url: publicUrl,
              type: file.type,
              size: file.size
          });
          
          setShowUploadMenu(false); // Tutup menu setelah pilih file
      } catch (err) {
          alert("Gagal upload file ke storage");
      } finally {
          setIsUploading(false);
      }
  };
  
  // --- FUNGSI ROOM ACTIONS ---
  const handleDeleteSession = async (id) => {
      if (!confirm("Hapus room ini?")) return;
      await axios.delete(`${API_URL}/sessions/${id}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSessionId === id) handleNewChat();
  };
  
  const handleRenameSession = async (id) => {
      const newTitle = prompt("Masukkan nama baru:");
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
          alert("Gagal mengambil laporan evaluasi.");
      } finally {
          setIsEvaluating(false);
      }
  };

  // Helper Membersihkan Judul di Sidebar
  const cleanTitle = (title) => {
      if(!title) return "New Chat"
      return title.replace(/[*#_]/g, '').trim()
  }
  

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans overflow-hidden transition-colors duration-300">
      
      {/* --- SIDEBAR --- */}
      <div 
        className={`${showSidebar ? 'w-64 translate-x-0' : 'w-0 -translate-x-full opacity-0 overflow-hidden'} 
        bg-gray-50 dark:bg-black flex flex-col transition-all duration-300 ease-in-out border-r border-gray-200 dark:border-gray-800 absolute md:relative z-20 h-full`}
      >
        <div className="p-3 flex items-center justify-between">
            <button 
                onClick={handleNewChat}
                className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-700 transition-colors shadow-sm"
            >
                <Plus size={16} /> New Chat
            </button>
            <button onClick={() => setShowSidebar(false)} className="md:hidden ml-2 text-gray-500">
                <PanelLeftClose size={20}/>
            </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className="text-xs font-semibold text-gray-500 mb-2 px-2">History</div>
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
                          <Edit3 size={12} /> Rename
                      </button>
                      <button onClick={() => { handleDeleteSession(sess.id); setActiveMenu(null); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                          <Trash2 size={12} /> Delete
                      </button>
                  </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-800 p-3 bg-gray-50 dark:bg-black">
          <button 
             onClick={() => setDarkMode(!darkMode)}
             className="flex items-center gap-2 w-full px-2 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md mb-1"
          >
             {darkMode ? <Sun size={16}/> : <Moon size={16}/>} 
             {darkMode ? "Light Mode" : "Dark Mode"}
          </button>

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
            <LogOut size={16} /> Log out
          </button>
        </div>
      </div>

      {/* --- MAIN AREA --- */}
      <div className="flex-1 flex flex-col relative h-full w-full bg-white dark:bg-gray-800 transition-colors duration-300">
        
        {/* Header Toggle */}
        <div className="absolute top-0 left-0 p-4 z-10 flex gap-2">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
              title={showSidebar ? "Sembunyikan Sidebar" : "Tampilkan Sidebar"}
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
                <p className="text-gray-500 dark:text-gray-400">Siap membantu penjualan Anda.</p>
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
                                  Preview
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
                                    th: ({node, ...props}) => <th className="bg-gray-100 dark:bg-gray-800 px-4 py-2 font-semibold border-b border-gray-300 dark:border-gray-700" {...props} />,
                                    td: ({node, ...props}) => <td className="px-4 py-2 border-b border-gray-200 dark:border-gray-800" {...props} />,
                                    strong: ({node, ...props}) => <strong className="font-bold text-gray-900 dark:text-white" {...props} />
                                }}
                            >
                                {msg.content}
                                {msg.content.replace(/<br\s*\/?>/gi, '\n')}
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
        <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 pb-6 transition-colors duration-300">
           <div className="max-w-3xl mx-auto">
              {/* --- PINDAHKAN PREVIEW KE SINI (DI DALAM MAX-W-3XL) --- */}
              {attachedFile && (
                <div className="flex items-center gap-3 p-2 bg-gray-100 dark:bg-gray-700 rounded-xl mb-3 w-fit border border-gray-300 dark:border-gray-600 relative animate-in fade-in slide-in-from-bottom-2 shadow-sm">
                  <div className="p-2 bg-indigo-600 text-white rounded-lg">
                    {attachedFile.type?.includes('image') ? <ImageIcon size={20} /> : <FileIcon size={20} />}
                  </div>
                  <div className="flex flex-col pr-6">
                    <span className="text-xs font-semibold truncate max-w-[150px] dark:text-white">
                      {attachedFile.name}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 italic">File siap dikirim</span>
                  </div>
                  <button 
                    onClick={() => setAttachedFile(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-md border-2 border-white dark:border-gray-800"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="relative flex flex-col gap-2 bg-gray-50 dark:bg-[#2f2f2f] p-3 rounded-xl border border-gray-200 dark:border-gray-600 focus-within:border-gray-400 dark:focus-within:border-gray-500 shadow-lg transition-colors">
                 <textarea
                    rows={1}
                    className="w-full bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-0 resize-none py-2 px-2 max-h-40 overflow-y-auto"
                    placeholder={`Kirim pesan ke MediSales...`}
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
              {/* <div className="relative flex flex-col gap-2 bg-gray-50 dark:bg-[#2f2f2f] p-3 rounded-xl border border-gray-200 dark:border-gray-600 focus-within:border-gray-400 dark:focus-within:border-gray-500 shadow-lg transition-colors">
                 
                 <textarea
                    rows={1}
                    className="w-full bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-0 resize-none py-2 px-2 max-h-40 overflow-y-auto"
                    placeholder={`Kirim pesan ke MediSales...`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if(e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend(e)
                      }
                    }}
                    style={{ minHeight: '44px' }}
                 /> */}

                 <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                        {/* Panel Pop-up Upload File */}
                        {showUploadMenu && (
                            <div className="absolute bottom-12 left-0 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-2 z-50">
                                <button 
                                    onClick={() => { fileInputRef.current.click(); setShowUploadMenu(false); }}
                                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <Plus size={14} /> Upload File
                                </button>
                            </div>
                        )}
                    
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileChange}
                            accept=".pdf,.doc,.docx,image/*"
                        />
                        
                        {/* Tombol Paperclip dengan Hover Gray Background */}
                        <button 
                            onClick={() => setShowUploadMenu(!showUploadMenu)}
                            className={`p-2 rounded-lg transition-all hover:bg-gray-200 dark:hover:bg-gray-700 ${isUploading ? 'animate-pulse text-indigo-500' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            <Paperclip size={18} />
                        </button>
                    </div>    
                            <div className="h-4 w-[1px] bg-gray-300 dark:bg-gray-600 mx-1"></div>
    
                            <button 
                                onClick={() => setMode(mode === 'rag' ? 'json' : 'rag')}
                                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                            >
                                {mode === 'rag' ? <Database size={14}/> : <FileText size={14}/>}
                                <span>{mode === 'rag' ? 'RAG Mode' : 'Full Context'}</span>
                            </button>

                            {/* --- TAMBAHKAN TOMBOL WEB SEARCH DI SINI --- */}
                            <button 
                                onClick={() => setWebSearch(!webSearch)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                                    webSearch 
                                    ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)] ring-2 ring-indigo-400' 
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${webSearch ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                                <span>Web Search</span>
                            </button>

                            <button 
                                onClick={toggleGeoLocation}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                                    geoLocation 
                                    ? 'bg-teal-600 text-white shadow-[0_0_15px_rgba(20,184,166,0.5)] ring-2 ring-teal-400' 
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${geoLocation ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                                <MapPin size={14} />
                                <span>{geoLocation && locationInfo ? locationInfo : "Location"}</span>
                            </button>

                            {/* TAMBAHKAN TOMBOL SALES REPORT INI */}
                            <button 
                                onClick={handleEvaluate}
                                disabled={isEvaluating}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all border border-indigo-100 dark:border-indigo-800"
                            >
                                {isEvaluating ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />}
                                <span>{isEvaluating ? "Analyzing..." : "Sales Report"}</span>
                            </button>
                        </div>
    
                        <button 
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className={`p-2 rounded-lg transition-all ${
                            input.trim() 
                            ? 'bg-indigo-600 dark:bg-white text-white dark:text-black hover:opacity-90' 
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {isLoading ? (
                                <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Send size={18} />
                            )}
                        </button>
                    
                 </div>
              </div>
              
              <div className="text-center text-[11px] text-gray-400 dark:text-gray-500 mt-2">
                 MediSales AI dapat membuat kesalahan. Cek informasi penting.
              </div>
           </div>
        </div>

      </div>
      {showEvalModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-white dark:bg-gray-800 w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700">
                  {/* Header Modal */}
                  <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-indigo-600">
                      <div className="flex items-center gap-2 text-white">
                          <Award size={20} />
                          <h3 className="font-bold">AI Sales Performance Coach</h3>
                      </div>
                      <button onClick={() => setShowEvalModal(false)} className="text-white/80 hover:text-white transition-colors">
                          <X size={24} />
                      </button>
                  </div>
      
                  {/* Content Modal */}
                  <div className="p-6 overflow-y-auto custom-scrollbar">
                      <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {evaluation?.replace(/<br\s*\/?>/gi, '\n')}
                          </ReactMarkdown>
                      </div>
                  </div>
      
                  {/* Footer Modal */}
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 text-right">
                      <button 
                          onClick={() => setShowEvalModal(false)}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 dark:shadow-none"
                      >
                          Tutup Laporan
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}
