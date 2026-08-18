import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Auto-register service worker immediately for offline capability & PWA installability
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('SkillForge PWA content updated, ready to refresh.');
  },
  onOfflineReady() {
    console.log('SkillForge is ready for offline use.');
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)