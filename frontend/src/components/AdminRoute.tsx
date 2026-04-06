import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAdminStore } from '../store/adminStore'

export default function AdminRoute({ children }: { children: ReactNode }) {
  const secret = useAdminStore((s) => s.secret)
  return secret ? <>{children}</> : <Navigate to="/admin/login" replace />
}
