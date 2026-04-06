import { useState, type FormEvent } from 'react'
import api from '../../api/api'
import { useAdminStore } from '../../store/adminStore'

interface Team {
  id: number
  name: string
}

const DEAL_TYPES = [
  "green_priority_supply", "green_subsidised_inputs", "green_fast_track_infra",
  "green_skilled_labour", "green_research_grant", "green_demand_boost",
  "green_gov_purchase", "green_audit_immunity", "green_quality_waiver",
  "red_supply_sabotage", "red_price_inflation", "red_machine_sabotage",
  "red_infra_delay", "red_labour_strike", "red_labour_poach",
  "red_rnd_sabotage", "red_market_limit", "red_demand_suppression",
  "red_price_pressure", "red_targeted_audit", "red_arbitrary_fine"
]

const COMPONENTS = [
  "airframe", "propulsion", "avionics", "fire_suppression", "sensing_safety", "battery"
]

export default function GovDealsPanel({ teams, onUpdate }: { teams: Team[], onUpdate: () => void }) {
  const { secret } = useAdminStore()
  const [buyerId, setBuyerId] = useState<number>(teams[0]?.id || 0)
  const [targetId, setTargetId] = useState<number | null>(null)
  const [dealType, setDealType] = useState(DEAL_TYPES[0])
  const [bribe, setBribe] = useState(5000)
  const [comp, setComp] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/organiser/deals/gov', {
        buyer_team_id: buyerId,
        target_team_id: targetId,
        deal_type: dealType,
        bribe_amount: bribe,
        target_component: comp,
        notes: notes
      }, {
        headers: { 'x-organiser-secret': secret }
      })
      alert("Deal registered successfully.")
      onUpdate()
    } catch (err: any) {
      alert(err.response?.data?.detail || "Deal failed.")
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <h2 className="text-xl font-bold">BACKROOM DEALS</h2>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6 bg-black/40 p-6 border border-white/5 rounded">
        
        {/* Deal Config */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-white/40 block mb-1">BUYER TEAM (Pays Bribe)</label>
            <select 
              className="input-cyber w-full bg-black text-white py-1 px-2 text-sm"
              value={buyerId}
              onChange={e => setBuyerId(Number(e.target.value))}
            >
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-white/40 block mb-1">DEAL TYPE</label>
            <select 
              className="input-cyber w-full bg-black text-white py-1 px-2 text-sm"
              value={dealType}
              onChange={e => setDealType(e.target.value)}
            >
              {DEAL_TYPES.map(d => <option key={d} value={d}>{d.toUpperCase().replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-white/40 block mb-1">BRIBE AMOUNT (CU)</label>
            <input 
              type="number"
              className="input-cyber w-full bg-black text-white py-1 px-2 text-sm"
              value={bribe}
              onChange={e => setBribe(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Target Config */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-white/40 block mb-1">TARGET TEAM (Offensive Deals Only)</label>
            <select 
              className="input-cyber w-full bg-black text-white py-1 px-2 text-sm"
              value={targetId || ''}
              onChange={e => setTargetId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">SELF / NONE</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-white/40 block mb-1">TARGET COMPONENT (Optional)</label>
            <select 
              className="input-cyber w-full bg-black text-white py-1 px-2 text-sm"
              value={comp || ''}
              onChange={e => setComp(e.target.value || null)}
            >
              <option value="">GLOBAL</option>
              {COMPONENTS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-white/40 block mb-1">ADMIN NOTES</label>
            <textarea 
              className="input-cyber w-full bg-black text-white py-1 px-2 text-sm h-16"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Context for post-game debrief..."
            />
          </div>
        </div>

        <div className="col-span-2">
          <button className="btn-cyber w-full py-3 bg-red-900/20 border-red-500/50 hover:bg-red-900/40 text-red-400 font-bold tracking-widest text-xs">
            EXECUTE CORRUPT ACTION
          </button>
        </div>
      </form>
    </div>
  )
}
