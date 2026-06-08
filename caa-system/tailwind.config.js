/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: { mono: ['JetBrains Mono', 'monospace'] },
      colors: {
        caa: {
          bg: '#0a0a0b',
          surface: '#111113',
          border: '#1e1e22',
          accent: '#c9a96e',
          green: '#4ade80',
          red: '#f87171',
          amber: '#fbbf24',
          blue: '#60a5fa',
          muted: '#52525b',
          text: '#e4e4e7',
        },
      },
    },
  },
  plugins: [],
}
