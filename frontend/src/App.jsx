import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import Chat from './Chat'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // 1. Tambahkan state role di bawah state session
  const [role, setRole] = useState('sales');
  
  // 2. Tambahkan useEffect untuk ambil role saat session tersedia
  useEffect(() => {
    const fetchRole = async () => {
      if (session?.user?.id) {
        const { data, error } = await supabase
          .from('account') // Nama tabel Anda
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (data && !error) {
          setRole(data.role);
        }
      }
    };
  
    fetchRole();
  }, [session]);
  
  // Default Dark Mode
  // --- PERBAIKAN: BACA DARI LOCAL STORAGE ---

  const [language, setLanguage] = useState(() => {
    const savedLang = localStorage.getItem('mediSalesLang');
    return savedLang || 'ID'; // Default Indonesia
  });
  
  // Tambahkan efek untuk simpan ke localStorage
  useEffect(() => {
    localStorage.setItem('mediSalesLang', language);
  }, [language]);
  
  const [darkMode, setDarkMode] = useState(() => {
    // Cek apakah ada setting tersimpan? Jika tidak, default true (Dark)
    const savedTheme = localStorage.getItem('mediSalesTheme')
    return savedTheme ? savedTheme === 'dark' : false
  })

  useEffect(() => {
    // Cek session saat ini
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listener perubahan auth (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Efek ganti class HTML untuk Tailwind
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('mediSalesTheme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('mediSalesTheme', 'light')
    }
  }, [darkMode])

  // if (loading) {
  //   return (
  //     <div className="flex h-screen items-center justify-center bg-gray-900">
  //       <div className="text-white">Loading...</div>
  //     </div>
  //   )
  // }
  if (loading) return <div className="dark:bg-gray-900 h-screen flex items-center justify-center text-gray-500">Loading...</div>
  
  // Jika tidak ada session, tampilkan Auth. Jika ada, tampilkan Chat.
  // return (
  //   <>
  //     {!session ? <Auth /> : <Chat session={session} />}
  //   </>
  // )
  // Pass darkMode prop ke child components
  return (
    <>
      {!session ? (
        <Auth 
          darkMode={darkMode} 
          setDarkMode={setDarkMode}
          language={language}
          setLanguage={setLanguage}
        />
      ) : (
        <Chat 
          session={session} 
          darkMode={darkMode} 
          setDarkMode={setDarkMode} 
          language={language} 
          setLanguage={setLanguage} 
        />
      )}
    </>
  )
}

export default App
