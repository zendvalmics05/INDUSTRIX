import { useEffect, useMemo, useState } from 'react'
import { MaterialMap } from '../../MaterialMap'
import { useGameStore } from '../../store/useGameStore'

const COMPONENTS = [
  'airframe',
  'propulsion',
  'avionics',
  'fire_suppression',
  'sensing_safety',
  'battery',
]

export default function ProcurementPanel() {
  const {
    selectedComponent,
    setSelectedComponent,
    sources,
    selectedSource,
    selectSource,
    updateProcurement,
    totalCost,
    fetchSources,
    submitProcurement,
    fetchCostEstimate,
  } = useGameStore()

  const [quantity, setQuantity] = useState(0)
  const [transport, setTransport] = useState<'air' | 'rail' | 'road'>('road')

  // Filter sources based on selected component (safe)
  const filteredSources = useMemo(() => {
    return (sources || []).filter((s) => s.component === selectedComponent)
  }, [sources, selectedComponent])

  // Load sources on mount
  useEffect(() => {
    fetchSources()
  }, [fetchSources])

  // When user clicks confirm
  const handleConfirm = async () => {
    if (!selectedSource) return

    updateProcurement(selectedComponent, {
      source_id: selectedSource.id,
      quantity,
      transport_mode: transport,
    })

    await submitProcurement(selectedComponent)
    await fetchCostEstimate()
  }

  // Provisioning state
  const { provisionResources } = useGameStore()
  const [provMinerals, setProvMinerals] = useState(0)
  const [provChemicals, setProvChemicals] = useState(0)
  const [provPower, setProvPower] = useState(0)

  const handleProvision = async () => {
    try {
      await provisionResources({
        minerals: provMinerals,
        chemicals: provChemicals,
        power: provPower
      })
      // Clear inputs on success
      setProvMinerals(0)
      setProvChemicals(0)
      setProvPower(0)
      alert("Resources provisioned successfully.")
    } catch (err: any) {
      alert(err.response?.data?.detail || "Provisioning failed.")
    }
  }

  // Map click handler
  const handleMapSelect = (site: any) => {
    if (!site) return
    selectSource(site)
  }

  return (
    <div className="flex flex-col gap-4 p-4">

      {/* 🔹 Component Selector */}
      <div className="flex gap-2 flex-wrap">
        {COMPONENTS.map((comp) => (
          <button
            key={comp}
            onClick={() => setSelectedComponent(comp)}
            className={`px-3 py-1 border rounded text-sm ${
              selectedComponent === comp
                ? 'bg-purple-600 text-white'
                : 'bg-black text-white/60 border-white/10'
            }`}
          >
            {comp}
          </button>
        ))}
      </div>

      {/* 🔹 Map + Controls */}
      <div className="grid grid-cols-[2fr_1fr] gap-4 h-[560px]">

        {/* 🌍 Map */}
        <div className="h-full min-h-[400px]">
          <MaterialMap
            sites={filteredSources}
            selectedSiteId={selectedSource?.id || null}
            onSelectSite={handleMapSelect}
            zoomResetKey={selectedComponent}
          />
        </div>

        {/* 📦 Right Panel Container */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-2">
          
          {/* 📦 Order Panel */}
          <div className="flex flex-col gap-4 border border-white/10 p-4 rounded bg-black/40">
            <h3 className="text-sm font-bold text-purple-400">RAW MATERIAL ORDER</h3>
            
            {/* Supplier Info */}
            {selectedSource ? (
              <div>
                <h2 className="text-base font-bold text-white">
                  {selectedSource.name}
                </h2>
                <p className="text-xs text-white/50">
                  {selectedSource.component}
                </p>

                <div className="mt-2 text-xs space-y-1">
                  <div>Quality: {selectedSource.quality_mean}</div>
                  <div>Consistency: {selectedSource.quality_sigma}</div>
                  <div>Cost/unit: {selectedSource.base_cost_per_unit} CU</div>
                </div>
              </div>
            ) : (
              <div className="text-white/40 text-xs">
                Select a supplier from map
              </div>
            )}

            {/* Controls */}
            <div className="flex flex-col gap-2">
              <input
                type="number"
                placeholder="Quantity"
                className="input-cyber py-1 text-sm text-white"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />

              <select
                className="input-cyber py-1 text-sm bg-black text-white"
                value={transport}
                onChange={(e) =>
                  setTransport(e.target.value as 'air' | 'rail' | 'road')
                }
              >
                <option value="road">Road (cheap, risky)</option>
                <option value="rail">Rail (balanced)</option>
                <option value="air">Air (expensive, safe)</option>
              </select>

              <button className="btn-cyber py-1 text-sm" onClick={handleConfirm}>
                Confirm Order
              </button>
            </div>

            {/* Cost Summary */}
            <div className="mt-2 border-t border-white/10 pt-2 text-xs">
              <div>Total Order: {Math.round(totalCost)} CU</div>
            </div>
          </div>

          {/* 📦 Provisioning Panel */}
          <div className="flex flex-col gap-3 border border-purple-500/30 p-4 rounded bg-purple-900/10">
            <h3 className="text-sm font-bold text-purple-400">STATE PROVISIONING</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Purchase Utility Resources from State</p>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] w-16 text-white/60">MINERALS</span>
                <input
                  type="number"
                  className="input-cyber flex-1 py-1 text-xs text-white"
                  value={provMinerals}
                  onChange={(e) => setProvMinerals(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] w-16 text-white/60">CHEMICALS</span>
                <input
                  type="number"
                  className="input-cyber flex-1 py-1 text-xs text-white"
                  value={provChemicals}
                  onChange={(e) => setProvChemicals(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] w-16 text-white/60">POWER</span>
                <input
                  type="number"
                  className="input-cyber flex-1 py-1 text-xs text-white"
                  value={provPower}
                  onChange={(e) => setProvPower(Number(e.target.value))}
                />
              </div>
            </div>

            <button 
              className="btn-cyber py-1 text-xs border-purple-500/50 hover:bg-purple-600/20"
              onClick={handleProvision}
            >
              PROVISION ASSETS
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}