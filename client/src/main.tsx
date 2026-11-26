import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  return (
    <main className="grid min-h-svh place-items-center bg-stone-50 p-6 text-stone-900">
      <h1 className="border-l-4 border-teal-700 pl-5 text-3xl font-semibold tracking-tight sm:text-5xl">
        ContactHub - Wix Contacts Manager
      </h1>
    </main>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing React root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
