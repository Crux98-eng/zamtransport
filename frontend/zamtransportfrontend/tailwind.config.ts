import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 50: '#1c1c1f', 100: '#2b2b30', 500: '#9c9ba2', 700: '#d8d7dc', 900: '#f7f7f8', 950: '#101012' },
        brand: { 50: '#2c1b15', 100: '#4a261a', 400: '#ff825b', 500: '#ff5a2b', 600: '#df421c' },
        success: { 50: '#15271f', 500: '#76d89b', 600: '#98e8b5' },
        warning: { 50: '#332714', 400: '#ffc350', 500: '#f5ad28' },
        danger: { 50: '#35191b', 500: '#ff7478', 600: '#ff9b9d' },
      },
      boxShadow: {
        panel: '0 18px 45px rgba(0, 0, 0, .22), inset 0 1px 0 rgba(255, 255, 255, .025)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
