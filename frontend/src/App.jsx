import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import Chat from './Chat'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // Default Dark Mode
  // --- PERBAIKAN: BACA DARI LOCAL STORAGE ---

  // Tambahkan state language di App.jsx
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('mediSalesLang') || 'ID';
  });
  
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
        <Auth darkMode={darkMode} setDarkMode={setDarkMode} language={language} setLanguage={setLanguage} />
      ) : (
        <Chat session={session} darkMode={darkMode} setDarkMode={setDarkMode} language={language} setLanguage={setLanguage} />
      )}
    </>
  )
}

export default App
