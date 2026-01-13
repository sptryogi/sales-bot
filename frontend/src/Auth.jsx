import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Loader2, Sun, Moon, Languages } from 'lucide-react'

export default function Auth({ darkMode, setDarkMode, language, setLanguage }) {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  // Tambahkan di dalam fungsi Auth, di bawah state lainnya
  const [isReturningUser, setIsReturningUser] = useState(false);

  useEffect(() => {
    const visited = localStorage.getItem('hasVisitedBefore') === 'true';
    setIsReturningUser(visited);
  }, []);
  
  // Tambahkan useEffect untuk menandai user sudah pernah berkunjung setelah login pertama kali
  useEffect(() => {
    if (isLogin) { // Kita set true jika dia berada di mode login
      localStorage.setItem('hasVisitedBefore', 'true');
    }
  }, [isLogin]);

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')
    
    let error;
    if (isLogin) {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      error = signInError
    } else {
      // Saat SignUp, Supabase akan otomatis mengirim email konfirmasi jika setting Confirm Email aktif
      const { data, error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              full_name: fullName, // Simpan Nama
              phone: phone,
              phone_number: phone  // Simpan No. HP
            },
              // URL ini adalah tujuan user setelah klik link di email
              emailRedirectTo: window.location.origin 
          }
      })
      error = signUpError
    }
  
    if (error) {
      // Tambahkan pengecekan khusus untuk email yang belum dikonfirmasi
      if (error.message === "Invalid login credentials") {
          setErrorMessage(language === 'ID' ? "Email atau password salah." : "Email or password is incorrect.")
      } else if (error.message.includes("Email not confirmed")) {
          setErrorMessage(language === 'ID' ? "Email Anda belum dikonfirmasi. Silakan cek kotak masuk email Anda." : "Your email has not been confirmed. Please check your email inbox.")
      } else {
          setErrorMessage(error.message)
      }
    } else if (!isLogin) {
      // Ubah pesan sukses registrasi
      alert(language === 'ID' ? "Registrasi berhasil! Link konfirmasi telah dikirim ke email Anda (cek email Spam bila tidak ditemukan). Silakan klik link tersebut sebelum mencoba login." : "Registration successful! A confirmation link has been sent to your email (check your Spam folder if you can't find it). Please click the link before attempting to log in.")
      setIsLogin(true)
      setEmail('')
      setPassword('')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
      
      {/* Tombol Toggle Tema Pojok Kanan Atas */}
      <button 
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-5 right-5 p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-yellow-400 shadow-sm"
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <button
        onClick={() => setLanguage(language === 'ID' ? 'EN' : 'ID')}
        className="absolute top-5 left-5 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors flex items-center gap-2 text-xs font-bold shadow-sm"
      >
        <Languages size={20} />
        <span>{language}</span>
      </button>

      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white dark:bg-gray-800 p-10 shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {isLogin ? (isReturningUser ? "Welcome Back" : "Welcome") : 'Create Account'}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            MediSales AI Assistant
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="space-y-4 rounded-md shadow-sm">
            {!isLogin && (
              <>
                <div>
                  <input
                    type="text"
                    required
                    className="block w-full rounded-md border-0 bg-gray-50 dark:bg-gray-700 py-2.5 px-3 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                    placeholder={language === 'ID' ? 'Nama Lengkap' : 'Full Name'}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="tel"
                    required
                    className="block w-full rounded-md border-0 bg-gray-50 dark:bg-gray-700 py-2.5 px-3 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                    placeholder={language === 'ID' ? 'Nomor HP (Contoh: 0812...)' : 'Mobile Number (Example: 0812...)'}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </>
            )}
            
            <div>
              <input
                type="email"
                required
                className="block w-full rounded-md border-0 bg-gray-50 dark:bg-gray-700 py-2.5 px-3 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="block w-full rounded-md border-0 bg-gray-50 dark:bg-gray-700 py-2.5 px-3 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {errorMessage && (
            <div className="text-red-600 dark:text-red-400 text-sm text-center font-medium bg-red-100 dark:bg-red-900/20 py-2 rounded">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-all"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLogin ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <div className="text-center text-sm">
          <button 
            onClick={() => { setIsLogin(!isLogin); setErrorMessage(''); }}
            className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
          >
            {isLogin 
              ? (language === 'ID' 
                  ? 'Belum punya akun? Daftar' 
                  : "Don't have an account? Sign Up")
              : (language === 'ID' 
                  ? 'Sudah punya akun? Masuk' 
                  : "Already have an account? Sign in")
            }
          </button>
        </div>
      </div>
    </div>
  )
}
