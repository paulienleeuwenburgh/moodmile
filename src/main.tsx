import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { CampaignPage } from './pages/CampaignPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/c/:campaignId" element={<CampaignPage />} />
        <Route path="/" element={<Navigate to="/c/ninja-naming" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
