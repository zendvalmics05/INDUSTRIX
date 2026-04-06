import { create } from 'zustand'

interface AdminState {
  secret: string | null
  setSecret: (secret: string | null) => void
  logout: () => void
}

export const useAdminStore = create<AdminState>((set) => ({
  secret: localStorage.getItem('industrix_admin_secret'),
  setSecret: (secret) => {
    if (secret) {
      localStorage.setItem('industrix_admin_secret', secret)
    } else {
      localStorage.removeItem('industrix_admin_secret')
    }
    set({ secret })
  },
  logout: () => {
    localStorage.removeItem('industrix_admin_secret')
    set({ secret: null })
  },
}))
