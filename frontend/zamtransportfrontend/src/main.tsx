// This is the browser entry point: it finds the <div id="root"> element,
// wraps the app with global providers, and starts React rendering.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { AppProviders } from '@/app/providers'
import '@/styles/globals.css'

createRoot(document.getElementById('root')!).render(<StrictMode><AppProviders><App /></AppProviders></StrictMode>)
