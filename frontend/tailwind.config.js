/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff7ed',   // Warm soft ivory-orange tint
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',  // Core JKLU Terracotta Accent
          700: '#c2410c',  // Deep terracotta hover
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        canvas: {
          DEFAULT: '#faf7f1', // Warm ivory canvas background
          muted: '#f4f1ea',
          dark: '#0b0f17',
          'dark-muted': '#1a2233',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8f6f0',
          elevated: '#ffffff',
          dark: '#121826',
          'dark-muted': '#1a2233',
        },
        line: {
          DEFAULT: '#ebe6dc', // Warm border line
          strong: '#d9d2c5',
          dark: '#232d42',
          'dark-strong': '#33405a',
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        'warm-sm': '0 1px 2px rgba(15, 23, 42, 0.05)',
        'warm': '0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.04)',
        'warm-lg': '0 10px 25px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)',
        'glow': '0 0 20px -3px rgba(234, 88, 12, 0.25)',
      },
    },
  },
  plugins: [],
}

