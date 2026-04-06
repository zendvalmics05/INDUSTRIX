import { useState } from 'react'
import api from '../../api/api'
import { useAdminStore } from '../../store/adminStore'

interface Team {
  id: number
  name: string
}

interface AssetSide {
  funds: number
  minerals: number
  chemicals: number
  power: number
  machines: string // comma separated IDs
  notes: string
}

export default function InterTeamExchangePanel({ teams, onUpdate }: { teams: Team[], onUpdate: () => void }) {
  const { secret } = useAdminStore()
  const [teamAId, setTeamAId] = useState<number>(teams[0]?.id || 0)
  const [teamBId, setTeamBId] = useState<number>(teams[1]?.id || teams[0]?.id || 0)

  const [aToB, setAToB] = useState<AssetSide>({ funds: 0, minerals: 0, chemicals: 0, power: 0, machines: '', notes: '' })
  const [bToA, setBToA] = useState<AssetSide>({ funds: 0, minerals: 0, chemicals: 0, power: 0, machines: '', notes: '' })

  const handleExchange = async () => {
    if (teamAId === teamBId) {
       alert("Cannot exchange with same team.")
       return
    }

    const payload = {
      team_a_id: teamAId,
      team_b_id: teamBId,
      team_a_to_b: {
        funds: aToB.funds,
        minerals: aToB.minerals,
        chemicals: aToB.chemicals,
        power: aToB.power,
        machines: aToB.machines.split(',').map(s => s.trim()).filter(s => s).map(Number)
      },
      team_b_to_a: {
        funds: bToA.funds,
        minerals: bToA.minerals,
        chemicals: bToA.chemicals,
        power: bToA.power,
        machines: bToA.machines.split(',').map(s => s.trim()).filter(s => s).map(Number)
      },
      notes: `Backroom Exchange: ${teams.find(t=>t.id===teamAId)?.name} <-> ${teams.find(t=>t.id===teamBId)?.name}`
    }

    try {
      await api.post('/organiser/deals/exchange', payload, {
        headers: { 'x-organiser-secret': secret }
      })
      alert("Exchange executed successfully.")
      onUpdate()
    } catch (err: any) {
      alert(err.response?.data?.detail || "Exchange failed.")
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">INTER-TEAM ASSET EXCHANGE</h2>
        <button 
          onClick={handleExchange}
          className="btn-cyber px-8 py-2 bg-yellow-600 text-black font-bold text-xs ring-4 ring-yellow-500/20"
        >
          EXECUTE CONTRACT
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
        
        {/* Team A */}
        <div className="space-y-4 border border-white/5 p-6 rounded bg-black/40">
           <div className="border-b border-white/10 pb-2 mb-4">
             <label className="text-[10px] text-white/40 block">SOURCE TEAM A</label>
             <select 
                className="bg-transparent text-purple-400 font-bold text-lg outline-none w-full"
                value={teamAId}
                onChange={e => setTeamAId(Number(e.target.value))}
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
           </div>

           <AssetInputs state={aToB} setState={setAToB} title="DEPOSITS TO B" />
        </div>

        {/* Swap Icon */}
        <div className="text-yellow-500 text-2xl font-bold px-2">⇌</div>

        {/* Team B */}
        <div className="space-y-4 border border-white/5 p-6 rounded bg-black/40">
           <div className="border-b border-white/10 pb-2 mb-4">
             <label className="text-[10px] text-white/40 block">SOURCE TEAM B</label>
             <select 
                className="bg-transparent text-purple-400 font-bold text-lg outline-none w-full"
                value={teamBId}
                onChange={e => setTeamBId(Number(e.target.value))}
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
           </div>

           <AssetInputs state={bToA} setState={setBToA} title="DEPOSITS TO A" />
        </div>

      </div>
    </div>
  )
}

function AssetInputs({ state, setState, title }: any) {
  const update = (key: string, val: any) => setState({ ...state, [key]: val })

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] text-yellow-500/50 font-bold tracking-widest mb-2 uppercase">{title}</h3>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-white/30 block">FUNDS (CU)</label>
          <input type="number" className="input-cyber w-full py-1 text-xs px-2 bg-black text-white" value={state.funds} onChange={e => update('funds', Number(e.target.value))} />
        </div>
        <div>
          <label className="text-[9px] text-white/30 block">POWER (MW)</label>
          <input type="number" className="input-cyber w-full py-1 text-xs px-2 bg-black text-white" value={state.power} onChange={e => update('power', Number(e.target.value))} />
        </div>
        <div>
          <label className="text-[9px] text-white/30 block">MINERALS</label>
          <input type="number" className="input-cyber w-full py-1 text-xs px-2 bg-black text-white" value={state.minerals} onChange={e => update('minerals', Number(e.target.value))} />
        </div>
        <div>
          <label className="text-[9px] text-white/30 block">CHEMICALS</label>
          <input type="number" className="input-cyber w-full py-1 text-xs px-2 bg-black text-white" value={state.chemicals} onChange={e => update('chemicals', Number(e.target.value))} />
        </div>
      </div>

      <div>
        <label className="text-[9px] text-white/30 block">MACHINE IDs (COMMA SEP)</label>
        <input type="text" className="input-cyber w-full py-1 text-xs px-2 bg-black text-white" value={state.machines} onChange={e => update('machines', e.target.value)} placeholder="e.g. 102, 105" />
      </div>
    </div>
  )
}
