import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'

const root = createRoot(document.getElementById('root')!)
// У Telegram WebView подвійний mount (Strict Mode) часто конфліктує з getSession;
// у production залишаємо один mount.
root.render(
  import.meta.env.DEV ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  ),
)
