import { Navigate, Route, Routes } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { HomePage } from './pages/HomePage'
import { WorkPage } from './pages/WorkPage'
import { ReaderPage } from './pages/ReaderPage'
import { SettingsPage } from './pages/SettingsPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/library" element={<HomePage />} />
      <Route path="/work/:workId" element={<WorkPage />} />
      <Route path="/read/:workId/:level/:chapterId" element={<ReaderPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
