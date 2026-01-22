/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          primary: '#000000',
          secondary: '#0a0a0a',
          tertiary: '#141414',
        },
        border: {
          primary: '#1a1a1a',
          secondary: '#2a2a2a',
        },
        text: {
          primary: '#ffffff',
          secondary: '#a1a1a1',
          tertiary: '#6b6b6b',
        },
        success: '#10b981',
        danger: '#ef4444',
        'success-muted': 'rgba(16, 185, 129, 0.1)',
        'danger-muted': 'rgba(239, 68, 68, 0.1)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
