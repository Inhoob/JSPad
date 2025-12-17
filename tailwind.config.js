/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1e1e1e',
          text: '#d4d4d4',
          border: '#3e3e42',
          hover: '#2a2d2e',
        }
      }
    },
  },
  plugins: [],
}
