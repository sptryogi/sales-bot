import { useState } from 'react'
import { supabase } from './supabaseClient'
import { Loader2, Sun, Moon } from 'lucide-react'

export default function Auth({ darkMode, setDarkMode }) {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')
    
    let error;
    if (isLogin) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      error = signInError
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      error = signUpError
    }

    if (error) {
      setErrorMessage(error.message === "Invalid login credentials" ? "Email atau password salah." : error.message)
    } else if (!isLogin) {
      alert('Registrasi berhasil! Silakan login.')
      setIsLogin(true)
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

      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white dark:bg-gray-800 p-10 shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            MediSales AI Assistant
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="space-y-4">
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
            {isLogin ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
          </button>
        </div>
      </div>
    </div>
  )
}