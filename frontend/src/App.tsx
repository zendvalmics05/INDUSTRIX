import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage.tsx'
import DashboardPage from './pages/DashboardPage.jsx'
import EventCountdownPage from './pages/EventCountdownPage.jsx'
import AdminLoginPage from './pages/AdminLoginPage.tsx'
import OrganiserPage from './pages/OrganiserPage.tsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.tsx'
import AdminRoute from './components/AdminRoute.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/event"
        element={
          <ProtectedRoute>
            <EventCountdownPage />
          </ProtectedRoute>
        }
      />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin/dashboard"
        element={
          <AdminRoute>
            <OrganiserPage />
          </AdminRoute>
        }
      />

      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
