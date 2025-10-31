console.log('[MAIN] Starting application...');

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/global.css'

console.log('[MAIN] Imports loaded, about to render');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

console.log('[MAIN] Render called');
