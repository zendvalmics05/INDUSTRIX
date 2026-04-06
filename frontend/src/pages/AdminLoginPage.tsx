import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminStore } from '../store/adminStore'

export default function AdminLoginPage() {
  const [pass, setPass] = useState('')
  const setSecret = useAdminStore((s) => s.setSecret)
  const navigate = useNavigate()

  const handleLogin = (e: FormEvent) => {
    e.preventDefault()
    if (pass) {
      setSecret(pass)
      navigate('/admin/dashboard')
    }
  }

  return (
    <div className="terminal-shell flex items-center justify-center h-screen">
      <div className="border border-purple-500/30 p-8 rounded bg-black/80 max-w-sm w-full font-mono">
        <h2 className="text-purple-400 text-lg mb-4 uppercase tracking-[0.2em]">Gov Access Terminal</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[10px] text-white/40 block mb-1">AUTHORIZATION KEY</label>
            <input 
              type="password" 
              className="input-cyber w-full py-2 bg-black text-white px-2"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
            />
          </div>
          <button className="btn-cyber w-full py-2 border-purple-500/50 hover:bg-purple-600/20 text-xs">
            ESTABLISH CONNECTION
          </button>
        </form>
      </div>
    </div>
  )
}
