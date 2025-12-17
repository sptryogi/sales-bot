/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // <--- PENTING: Tambahkan ini
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}