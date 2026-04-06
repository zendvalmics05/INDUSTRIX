import { useEffect, useState } from 'react'
import api from '../api/api'
import { useAdminStore } from '../store/adminStore'
import { useNavigate } from 'react-router-dom'
import GovDealsPanel from '../components/organiser/GovDealsPanel.tsx'
import InterTeamExchangePanel from '../components/organiser/InterTeamExchangePanel.tsx'

// Note: In a real app, we'd have separate component files. 
// For this task, I'll define the main sub-components below or in the same file to ensure they exist.

export default function OrganiserPage() {
  const [activeTab, setActiveTab] = useState<'cycle' | 'deals' | 'exchange' | 'teams'>('cycle')
  const { secret, logout } = useAdminStore()
  const navigate = useNavigate()
  const [gameSummary, setGameSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchSummary = async () => {
    try {
      const res = await api.get('/organiser/game/summary', {
        headers: { 'x-organiser-secret': secret }
      })
      setGameSummary(res.data)
    } catch (err) {
      console.error(err)
      if ((err as any).response?.status === 403) {
        logout()
        navigate('/admin/login')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
    const interval = setInterval(fetchSummary, 5000)
    return () => clearInterval(interval)
  }, [secret])

  if (loading) return <div className="p-8 font-mono text-purple-400 animate-pulse">BOOTING GOV_OS...</div>

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono flex flex-col">
      {/* Top Bar */}
      <div className="border-b border-purple-500/30 p-4 flex justify-between items-center bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <h1 className="text-lg font-bold tracking-tighter uppercase whitespace-nowrap">
            INDUSTRIX <span className="text-purple-500">GOV_CORE</span>
          </h1>
          <div className="px-2 py-0.5 border border-purple-500/50 text-[10px] rounded text-purple-400">
            {gameSummary?.game?.name || 'NO_GAME'}
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div className="flex gap-4">
             <div className="flex flex-col items-end">
               <span className="text-white/40 text-[9px]">CYCLE</span>
               <span className="text-purple-400">{gameSummary?.cycle?.number || '0'}</span>
             </div>
             <div className="flex flex-col items-end">
               <span className="text-white/40 text-[9px]">PHASE</span>
               <span className="text-purple-400 uppercase">{gameSummary?.cycle?.phase || 'NONE'}</span>
             </div>
          </div>
          <button 
            onClick={() => { logout(); navigate('/admin/login'); }}
            className="text-red-400 border border-red-900/50 px-3 py-1 hover:bg-red-950/30 rounded"
          >
            TERMINATE
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar Nav */}
        <div className="w-48 border-r border-white/5 flex flex-col gap-1 p-2 bg-black/20">
          <NavBtn active={activeTab === 'cycle'} onClick={() => setActiveTab('cycle')} label="CYCLE_MGMT" />
          <NavBtn active={activeTab === 'teams'} onClick={() => setActiveTab('teams')} label="TEAM_AUDIT" />
          <div className="my-2 border-t border-white/5 mx-2" />
          <NavBtn active={activeTab === 'deals'} onClick={() => setActiveTab('deals')} label="BACKROOM_DEALS" />
          <NavBtn active={activeTab === 'exchange'} onClick={() => setActiveTab('exchange')} label="ASSET_EXCHANGE" color="text-yellow-500" />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[radial-gradient(circle_at_50%_0%,rgba(88,28,135,0.05)_0%,transparent_50%)]">
          {activeTab === 'cycle' && <CyclePanel summary={gameSummary} onUpdate={fetchSummary} />}
          {activeTab === 'teams' && <TeamAuditPanel teams={gameSummary?.teams || []} />}
          {activeTab === 'deals' && <GovDealsPanel teams={gameSummary?.teams || []} onUpdate={fetchSummary} />}
          {activeTab === 'exchange' && <InterTeamExchangePanel teams={gameSummary?.teams || []} onUpdate={fetchSummary} />}
        </div>
      </div>
    </div>
  )
}

function NavBtn({ active, onClick, label, color = "text-purple-400" }: any) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-4 py-2 text-[11px] font-bold tracking-widest transition-all duration-200 border-l-2 ${
        active 
          ? `bg-purple-500/10 border-purple-500 ${color}` 
          : 'border-transparent text-white/40 hover:text-white/60 hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  )
}

// STUB COMPONENTS - Will implement properly in following steps or together
function CyclePanel({ summary, onUpdate }: any) { 
  const { secret } = useAdminStore()
  const advance = async () => {
    if (!confirm("Advance Game Phase?")) return
    await api.post('/organiser/cycle/advance', {}, { headers: { 'x-organiser-secret': secret }})
    onUpdate()
  }
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold tracking-tight">CYCLE MANAGEMENT</h2>
          <p className="text-xs text-white/40 mt-1">Status: {summary?.cycle?.phase || 'OFFLINE'}</p>
        </div>
        <button onClick={advance} className="btn-cyber px-6 py-2 bg-purple-600 text-white font-bold text-xs ring-4 ring-purple-500/20">
          ADVANCE PHASE →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-white/5 p-4 rounded bg-black/40">
           <h3 className="text-[10px] text-white/40 mb-2 uppercase">Current Events</h3>
           <div className="space-y-2">
             {Object.entries(summary?.pending_events_by_phase || {}).map(([phase, count]: any) => (
                <div key={phase} className="flex justify-between text-xs border-b border-white/5 pb-1">
                  <span className="opacity-60">{phase}</span>
                  <span className={count > 0 ? 'text-green-400' : 'opacity-30'}>{count}</span>
                </div>
             ))}
           </div>
        </div>
        <div className="border border-white/5 p-4 rounded bg-black/40">
           <h3 className="text-[10px] text-white/40 mb-2 uppercase">Game Rules</h3>
           <div className="space-y-1 text-[11px]">
              <div className="flex justify-between"><span>Demand Multiplier:</span> <span className="text-purple-400">{summary?.game?.demand_multiplier}x</span></div>
              <div className="flex justify-between"><span>QR Hard:</span> <span className="text-purple-400">{summary?.game?.qr_hard}</span></div>
              <div className="flex justify-between"><span>QR Soft:</span> <span className="text-purple-400">{summary?.game?.qr_soft}</span></div>
           </div>
        </div>
      </div>
    </div>
  ) 
}

function TeamAuditPanel({ teams }: any) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">TEAM AUDIT</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-white/40 border-b border-white/10 uppercase text-left">
              <th className="py-2 font-normal">Team</th>
              <th className="py-2 font-normal">Cash</th>
              <th className="py-2 font-normal">Brand</th>
              <th className="py-2 font-normal">Finished Stock</th>
              <th className="py-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t: any) => (
              <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-3 font-bold text-purple-400">{t.name}</td>
                <td className="py-3">{Math.round(t.funds)} CU</td>
                <td className="py-3">{t.brand_score} ({t.brand_tier})</td>
                <td className="py-3">{t.fin_stock_total}</td>
                <td className="py-3">
                  <span className={t.is_active ? 'text-green-500' : 'text-red-500'}>
                    {t.is_active ? 'ACTIVE' : 'ELIMINATED'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// STUBS REMOVED
