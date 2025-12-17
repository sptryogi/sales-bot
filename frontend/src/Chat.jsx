import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Paperclip, LogOut, Bot, Database, FileText, PanelLeftClose, PanelLeftOpen, Plus, Sun, Moon, MessageSquare } from 'lucide-react'

const API_URL = import.meta.env.VITE_BACKEND_URL;

export default function Chat({ session, darkMode, setDarkMode }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([]) 
  const [sessions, setSessions] = useState([]) // Daftar Room
  const [currentSessionId, setCurrentSessionId] = useState(null) // Room Aktif

  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState('rag') 
  const [showSidebar, setShowSidebar] = useState(true)
  
  const messagesEndRef = useRef(null)

  // --- LOGIC SCROLL ---
  const scrollToBottom = () => {
    // Timeout kecil memastikan DOM sudah render bubble baru sebelum scroll
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }, 100)
  }
  useEffect(scrollToBottom, [messages])

  // --- LOGIC LOAD SESSIONS & HISTORY ---
  
  // 1. Ambil daftar room saat pertama load
  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
        const res = await axios.get(`${API_URL}/sessions`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
        setSessions(res.data)
        
        // LOGIC OTOMATIS LOAD:
        // Jika ada session di list, dan kita belum pilih session (currentSessionId null),
        // Maka load session yang PALING ATAS (terbaru)
        if (res.data.length > 0 && !currentSessionId) {
            loadChatHistory(res.data[0].id)
        }
    } catch (e) {
        console.error("Gagal load session", e)
    }
  }

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


  // 4. Handle Send (Logic Diperbaiki agar tidak hilang)
  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input
    setInput('')
    
    // UI Optimistic Update (Tampilkan pesan user duluan)
    const tempMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(tempMessages)
    setIsLoading(true)

    try {
      const { access_token } = session
      
      const response = await axios.post(`${API_URL}/chat`, {
        mode: mode,
        message: userMessage,
        session_id: currentSessionId // Kirim ID (null jika new chat)
      }, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      })

      const fullAnswer = response.data.answer
      const returnedSessionId = response.data.session_id

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
      setIsLoading(false)
    }
  }

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
              <button 
                key={sess.id}
                onClick={() => loadChatHistory(sess.id)}
                className={`w-full text-left px-3 py-2 text-sm rounded-md truncate mb-1 flex items-center gap-2
                    ${currentSessionId === sess.id 
                        ? 'bg-gray-200 dark:bg-gray-800 font-medium' 
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-900'}`}
              >
                <MessageSquare size={14} className="flex-shrink-0 opacity-70"/>
                <span className="truncate">{cleanTitle(sess.title)}</span>
              </button>
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
            {!showSidebar && (
                <button 
                    onClick={() => setShowSidebar(true)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    <PanelLeftOpen size={24} />
                </button>
            )}
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:pt-12 pb-40"> 
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
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
                </div>
            ))}
            {/* Dummy element untuk scroll anchor dengan margin bawah agar tidak kepotong */}
            <div ref={messagesEndRef} className="h-4" /> 
          </div>
        </div>

        {/* --- INPUT AREA --- */}
        <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 pb-6 transition-colors duration-300">
           <div className="max-w-3xl mx-auto">
              
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

                 <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                            <Paperclip size={18} />
                        </button>
                        
                        <div className="h-4 w-[1px] bg-gray-300 dark:bg-gray-600 mx-1"></div>

                        <button 
                            onClick={() => setMode(mode === 'rag' ? 'json' : 'rag')}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                            {mode === 'rag' ? <Database size={14}/> : <FileText size={14}/>}
                            <span>{mode === 'rag' ? 'RAG Mode' : 'Full Context'}</span>
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
    </div>
  )
}