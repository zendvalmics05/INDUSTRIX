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
        headers: { 'x-organiser-secret': secret },
        timeout: 10000
      })
      setGameSummary(res.data)
    } catch (err: any) {
      if (err.response?.status === 403) {
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

  // If no game exists or no cycle exists, show the setup wizard
  if (!gameSummary?.game || !gameSummary?.cycle) {
    return <InitialisationWizard summary={gameSummary} onUpdate={fetchSummary} />
  }

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

// ── SETUP WIZARD ──────────────────────────────────────────────────────────────

function InitialisationWizard({ summary, onUpdate }: any) {
  const { secret } = useAdminStore()
  const [step, setStep] = useState(summary?.game ? 2 : 1)
  const [gameForm, setGameForm] = useState({
    name: 'JU_INDUSTRIX_2026',
    qr_hard: 50,
    qr_soft: 70,
    qr_premium: 85,
    market_demand_multiplier: 1.0,
    starting_funds: 100000
  })

  const [teamForm, setTeamForm] = useState({ name: '', pin: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Wizard: Creating Game...", gameForm)
    setIsSubmitting(true)
    try {
      const res = await api.post('/organiser/game/create', gameForm, {
        headers: { 'x-bootstrap-secret': secret }
      })
      console.log("Wizard: Game Created!", res.data)
      await onUpdate()
      setStep(2)
    } catch (err: any) {
      console.error("Wizard: Game Creation Failed", err)
      alert(`Simulation Initialization Failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamForm.name || !teamForm.pin) return
    console.log("Wizard: Adding Team...", teamForm)
    setIsSubmitting(true)
    try {
      const res = await api.post('/organiser/teams/add', teamForm, {
        headers: { 'x-organiser-secret': secret }
      })
      console.log("Wizard: Team Added!", res.data)
      setTeamForm({ name: '', pin: '' })
      await onUpdate()
    } catch (err: any) {
      console.error("Wizard: Add Team Failed", err)
      alert(`Team Registration Failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStartCycle = async () => {
    console.log("Wizard: Initiating Cycle 1...")
    if (summary.teams.length < 2) {
      if (!confirm("Less than 2 teams registered. Proceed anyway?")) return
    }
    setIsSubmitting(true)
    try {
      const res = await api.post('/organiser/cycle/create', {}, {
        headers: { 'x-organiser-secret': secret }
      })
      console.log("Wizard: Cycle Started!", res.data)
      await onUpdate()
    } catch (err: any) {
      console.error("Wizard: Cycle Start Failed", err)
      alert(`Simulation Launch Failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono flex flex-col items-center justify-center p-6 pb-20">
      <div className="max-w-2xl w-full space-y-8 animate-in fade-in zoom-in duration-500">
        
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black tracking-tighter text-purple-500 uppercase">System Initialisation</h1>
          <p className="text-white/40 text-sm tracking-widest uppercase">Environment: JU_PROD_ENG_LAB</p>
        </div>

        {/* Steps Tracker */}
        <div className="flex justify-between border-y border-white/5 py-4 px-8 bg-white/5 rounded-xl backdrop-blur-sm">
          <StepIndicator num={1} label="CONFIG" active={step === 1} done={step > 1} />
          <div className="h-px bg-white/10 flex-1 mx-4 self-center" />
          <StepIndicator num={2} label="TEAMS" active={step === 2} done={step > 2} />
          <div className="h-px bg-white/10 flex-1 mx-4 self-center" />
          <StepIndicator num={3} label="START" active={step === 3} done={step > 3} />
        </div>

        {/* Step 1: Game Config */}
        {step === 1 && (
          <form onSubmit={handleCreateGame} className="space-y-6 bg-black/40 p-8 rounded-2xl border border-white/5 shadow-2xl">
            <div className="space-y-4">
              <label className="block">
                <span className="text-[10px] text-white/40 uppercase tracking-widest">Simulation Name</span>
                <input 
                  type="text" 
                  value={gameForm.name} 
                  onChange={e => setGameForm({...gameForm, name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded p-3 mt-1 focus:border-purple-500 outline-none"
                />
              </label>
              
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] text-white/40 uppercase">Starting Funds</span>
                  <input 
                    type="number" 
                    value={gameForm.starting_funds} 
                    onChange={e => setGameForm({...gameForm, starting_funds: parseInt(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded p-3 mt-1 focus:border-purple-500 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-white/40 uppercase">Demand Multiplier</span>
                  <input 
                    type="number" step="0.1"
                    value={gameForm.market_demand_multiplier} 
                    onChange={e => setGameForm({...gameForm, market_demand_multiplier: parseFloat(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded p-3 mt-1 focus:border-purple-500 outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-4">
                 {['qr_hard', 'qr_soft', 'qr_premium'].map(f => (
                   <label key={f} className="block">
                     <span className="text-[10px] text-white/40 uppercase underline decoration-purple-500/50">{f.replace('qr_', '')}</span>
                     <input 
                        type="number" 
                        value={(gameForm as any)[f]} 
                        onChange={e => setGameForm({...gameForm, [f]: parseInt(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded p-3 mt-1 focus:border-purple-500 outline-none"
                      />
                   </label>
                 ))}
              </div>
            </div>

            <button 
              disabled={isSubmitting}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] uppercase tracking-widest disabled:opacity-50"
            >
              Initialize Global State →
            </button>
          </form>
        )}

        {/* Step 2: Teams */}
        {step === 2 && (
          <div className="space-y-6">
            <form onSubmit={handleAddTeam} className="bg-black/40 p-8 rounded-2xl border border-white/5 shadow-2xl space-y-4">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-tighter">Add Participant Team</h3>
              <div className="grid grid-cols-2 gap-4">
                <input 
                  placeholder="TEAM NAME"
                  value={teamForm.name}
                  onChange={e => setTeamForm({...teamForm, name: e.target.value})}
                  className="bg-white/5 border border-white/10 rounded p-3 outline-none focus:border-purple-500"
                />
                <input 
                  placeholder="PIN"
                  value={teamForm.pin}
                  onChange={e => setTeamForm({...teamForm, pin: e.target.value})}
                  className="bg-white/5 border border-white/10 rounded p-3 outline-none focus:border-purple-500"
                />
              </div>
              <button 
                disabled={isSubmitting}
                className="w-full border border-purple-500/50 hover:bg-purple-500/10 text-purple-400 font-bold py-3 rounded-lg uppercase text-xs tracking-widest transition-all"
              >
                + Register Team
              </button>
            </form>

            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] text-white/40 uppercase tracking-widest">Registered Entities ({summary.teams.length})</h3>
                {summary.teams.length >= 2 && (
                  <button 
                    onClick={() => setStep(3)}
                    className="text-[10px] text-green-400 border border-green-900/50 px-3 py-1 rounded-full uppercase hover:bg-green-900/20"
                  >
                    Next Step →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {summary.teams.map((t: any) => (
                  <div key={t.id} className="p-3 bg-black/40 border border-white/5 rounded-lg flex justify-between items-center group">
                    <span className="text-xs font-bold text-white/80">{t.name}</span>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  </div>
                ))}
                {summary.teams.length === 0 && <p className="col-span-2 text-center text-xs text-white/20 py-4 uppercase">No teams registered</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Final Push */}
        {step === 3 && (
          <div className="bg-black/40 p-8 rounded-2xl border border-white/5 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-purple-500/10">
              <div className="w-8 h-8 bg-purple-500 rounded-full animate-ping" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">READY FOR DEPLOYMENT</h3>
              <p className="text-xs text-white/40 max-w-xs mx-auto">This will launch Cycle 1 Phase 1 (Procurement). All teams will be granted access to the production grid.</p>
            </div>
            <button 
              onClick={handleStartCycle}
              disabled={isSubmitting}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] uppercase tracking-widest disabled:opacity-50"
            >
              Initiate Simulation Core →
            </button>
            <button 
               onClick={() => setStep(2)}
               className="text-[10px] text-white/30 uppercase hover:text-white/60 tracking-widest"
            >
               ← Back to Teams
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

function StepIndicator({ num, label, active, done }: any) {
  return (
    <div className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${active ? 'scale-110' : 'opacity-40'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono border-2 ${
        done 
          ? 'bg-purple-500 border-purple-500 text-white' 
          : active 
            ? 'border-purple-500 text-purple-500' 
            : 'border-white/20 text-white/20'
      }`}>
        {done ? '✓' : num}
      </div>
      <span className={`text-[9px] font-black tracking-tighter ${active ? 'text-purple-400' : 'text-white'}`}>{label}</span>
    </div>
  )
}
