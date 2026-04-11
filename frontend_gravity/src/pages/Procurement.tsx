import { useEffect, useState } from 'react';
import { FiCheckCircle, FiCircle } from 'react-icons/fi';
import { useProcurementStore, useGameStore, useInventoryStore } from '../store';
import { useEventsStore } from '../store/useEventsStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { ComponentTabs, SendDecisionsButton } from '../components/SharedComponents';
import { ProcurementCard } from '../components/PhaseSummaries';
import { motion, AnimatePresence } from 'framer-motion';

const getConsistencyLabel = (sigma: number) => {
  if (sigma <= 2.0) return "Ultra Reliable";
  if (sigma <= 5.0) return "Highly Consistent";
  if (sigma <= 10.0) return "Mostly Stable";
  if (sigma <= 18.0) return "Barely Consistent";
  if (sigma <= 30.0) return "Volatile Supply";
  return "Total Gambling";
};

export const Procurement = () => {
  const {
    decisions,
    initialDecisions,
    sourcesByComponent,
    selectedComponent,
    setComponent,
    setDecision,
    isBuying,
    setIsBuying,
    transports,
    projectedCosts,
    fetchSources,
    fetchTransports,
    fetchExistingDecisions,
    submitDecisions
  } = useProcurementStore();

  const { phase } = useGameStore();
  const { funds, fetchInventory, components } = useInventoryStore();
  const { addToast } = useNotificationStore();

  const procurementSummary = useEventsStore(s => s.procurement);
  const loadingSummary = useEventsStore(s => s.loadingProcurement);
  const fetchAllSummaries = useEventsStore(s => s.fetchAll);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState('');


  const isProcurementOpen = phase === 'procurement_open';

  // Initial data load
  useEffect(() => {
    fetchSources();
    fetchTransports();
    fetchInventory();
    fetchExistingDecisions();
    
    if (!isProcurementOpen) {
      fetchAllSummaries(phase);
    }
  }, [fetchSources, fetchTransports, fetchInventory, fetchExistingDecisions, isProcurementOpen, fetchAllSummaries, phase]);

  const currentDecision = decisions[selectedComponent];
  const activeSources = sourcesByComponent[selectedComponent] || [];
  const selectedSource = activeSources.find(s => s.id === currentDecision.source_id) || activeSources[0];

  useEffect(() => {
    if (activeSources.length > 0 && (!currentDecision.source_id || !activeSources.find(s => s.id === currentDecision.source_id))) {
      setDecision(selectedComponent, 'source_id', activeSources[0].id);
    }
  }, [selectedComponent, activeSources, currentDecision.source_id, setDecision]);

  const buyingCurrentComponent = isBuying[selectedComponent];

  // Specific handler for scrolling sources & snapping to min limits
  const handleSourceSelect = (sourceId: number) => {
    if (!isProcurementOpen) return;
    const newSource = activeSources.find(s => s.id === sourceId);
    if (!newSource) return;
    setDecision(selectedComponent, 'source_id', newSource.id);
    setDecision(selectedComponent, 'quantity', newSource.min_order);
  };

  const handleQuantityBlur = () => {
    if (!selectedSource) return;
    let qty = currentDecision.quantity;
    if (qty < selectedSource.min_order) qty = selectedSource.min_order;
    if (qty > selectedSource.max_order) qty = selectedSource.max_order;
    if (qty !== currentDecision.quantity) {
      setDecision(selectedComponent, 'quantity', qty);
    }
  };

  // Computations
  const totalProcurementCost = projectedCosts?.total_cost || 0;
  const currentProjections = projectedCosts?.per_component[selectedComponent];
  const componentCost = isBuying[selectedComponent] ? (currentProjections?.total || 0) : 0;

  const remainingFunds = funds - totalProcurementCost;
  const fundUsagePct = funds > 0 ? (totalProcurementCost / funds) * 100 : 100;

  let progressColor = "bg-[#3b82f6]"; // Blue for < 25%
  if (fundUsagePct >= 25 && fundUsagePct < 50) progressColor = "bg-[#10b981]"; // Green
  else if (fundUsagePct >= 50 && fundUsagePct < 75) progressColor = "bg-[#eab308]"; // Yellow
  else if (fundUsagePct >= 75) progressColor = "bg-error"; // Red

  const isOverflowing = totalProcurementCost > funds;

  const handleSubmit = async () => {
    if (!window.confirm('Confirm procurement decisions? This cannot be undone until the next phase.')) return;
    setIsSubmitting(true);
    setSubmitMessage('');
    try {
      await submitDecisions();
      const ts = new Date().toLocaleTimeString();
      setSubmitMessage(`SUCCESS: Decisions saved at ${ts}.`);
      setLastSavedAt(ts);
      addToast(`Decisions saved at ${ts}`, 'success');
    } catch (err: any) {
      setSubmitMessage(`ERROR: ${err.message || "Failed to submit"}`);
      addToast(err?.message || 'Failed to save procurement decisions', 'error');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmitMessage(''), 3000);
    }
  };

  const factoryStock = components.find(c => c.component === selectedComponent)?.raw_stock;
  const renderStockGraph = () => {
    if (!factoryStock || factoryStock.length !== 101) return null;

    const unusableStock = factoryStock[0];
    const deciles = Array(25).fill(0);
    for (let i = 1; i <= 100; i++) {
      const idx = Math.min(24, Math.floor((i - 1) / 4));
      deciles[idx] += factoryStock[i];
    }
    const maxVal = Math.max(...deciles, 1);
    const totalItems = deciles.reduce((acc, curr) => acc + curr, 0);

    return (
      <div className="pt-2 flex flex-col space-y-2 relative flex-1">
        <div className="flex justify-between items-center text-xs font-semibold text-on-surface-variant uppercase tracking-widest cursor-help group/header relative">
          <span className="flex items-center space-x-2">
            <span>Raw Stock Distribution</span>
            <span className="w-5 h-5 bg-surface-high border border-outline flex items-center justify-center rounded-full text-xs">i</span>
          </span>
          <span>Usable Units: {totalItems}</span>

          {/* Tooltip for graph */}
          <div className="absolute top-6 left-0 hidden group-hover/header:block bg-surface-highest p-3 border border-outline shadow-2xl text-xs font-mono text-on-surface w-64 z-[100] normal-case leading-relaxed">
            Displays current usable inventory density. Unusable damages (Grade 0) are excluded. New procurements will dynamically merge into this spread upon cycle resolution following transport damage rolls.
          </div>
        </div>

        <div className="flex items-end flex-1 min-h-[60px] w-full space-x-[2px] mt-1 mb-1">
          {deciles.map((val, idx) => (
            <div key={idx} className="flex-1 bg-surface-highest transition-colors flex flex-col justify-end h-full group/col relative">
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${(val / maxVal) * 100}%` }}
                transition={{ type: "spring", stiffness: 100, damping: 15 }}
                className="w-full bg-outline transition-all duration-300 group-hover/col:bg-primary rounded-t-sm"
              />
              <div className="absolute bottom-full mb-1 hidden group-hover/col:block bg-surface p-1 text-xs z-10 border border-outline-variant whitespace-nowrap shadow-lg">
                Grade {idx * 4 + 1}-{idx * 4 + 4}: {val} units
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-on-surface-variant font-mono font-medium">
          <span>Gr 1</span>
          <span>Gr 50</span>
          <span>Gr 100</span>
        </div>

        {unusableStock > 0 && (
          <div className="text-xs text-error font-mono mt-1 pt-2 border-t border-error/20 flex justify-between font-bold">
            <span>UNUSABLE INVENTORY (GRADE 0)</span>
            <span>{unusableStock} units</span>
          </div>
        )}
      </div>
    );
  };



  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Phase Summary (if resolved) */}
      {!isProcurementOpen && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-700">
          <h2 className="text-xs font-semibold font-mono text-on-surface-variant uppercase tracking-[0.3em] mb-3 pl-1">Resolution Report</h2>
          {loadingSummary ? (
             <div className="text-sm font-mono text-on-surface-variant animate-pulse px-5 py-8 border border-outline-variant/20 bg-surface-low items-center justify-center flex">
                Decrypting procurement summary...
             </div>
          ) : procurementSummary ? (
            <ProcurementCard data={procurementSummary} />
          ) : (
             <div className="text-sm font-mono text-on-surface-variant px-5 py-8 border border-outline-variant/20 bg-surface-low opacity-60">
                Procurement summary payload not found for this cycle.
             </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-start flex-shrink-0">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tighter">PROCUREMENT</h1>
          <div className="text-on-surface-variant font-mono text-xs mt-0.5 font-medium tracking-widest flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>Facility Cycle {useGameStore.getState().cycleNumber} · Supply Chain Active</span>
          </div>
        </div>
      </div>

      <ComponentTabs selected={selectedComponent} onSelect={setComponent} />

      <div className="flex space-x-4 items-center flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => isProcurementOpen && setIsBuying(selectedComponent, false)}
          disabled={!isProcurementOpen}
          className={`flex-1 flex items-center justify-between p-3 border font-display tracking-widest transition-colors relative ${!buyingCurrentComponent ? 'bg-error-container border-error text-on-surface' : 'bg-surface-low border-outline-variant text-on-surface-variant hover:bg-surface-high'} ${!isProcurementOpen && 'opacity-50 cursor-not-allowed'}`}
        >
          <span className="text-xs font-semibold">DO NOT PURCHASE</span>
          {!buyingCurrentComponent ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <FiCheckCircle className="text-xl" />
            </motion.div>
          ) : <FiCircle className="text-xl opacity-50" />}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => isProcurementOpen && setIsBuying(selectedComponent, true)}
          disabled={!isProcurementOpen}
          className={`flex-1 flex items-center justify-between p-3 border font-display tracking-widest transition-colors relative ${buyingCurrentComponent ? 'bg-primary-container border-primary text-[#000]' : 'bg-surface-low border-outline-variant text-on-surface-variant hover:bg-surface-high'} ${!isProcurementOpen && 'opacity-50 cursor-not-allowed'}`}
        >
          <span className="text-xs font-semibold">PROCURE COMPONENTS</span>
          {buyingCurrentComponent ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <FiCheckCircle className="text-xl text-[#000]" />
            </motion.div>
          ) : <FiCircle className="text-xl opacity-50" />}
        </motion.button>
      </div>

      {buyingCurrentComponent && (
        <div className="flex flex-1 overflow-hidden space-x-4 animate-fade-in min-h-0">
          {/* INPUT SECTION (LEFT) */}
          <div className="w-[60%] flex flex-col space-y-4 min-h-0">
            <div className="bg-surface-container p-4 space-y-4 flex-1 flex flex-col border border-outline-variant min-h-0">
              <div className="flex space-x-4 flex-shrink-0 h-[280px]">
                <div className="w-1/2 flex flex-col space-y-2 h-full">
                  <label className="block text-[11px] font-bold font-mono text-on-surface-variant uppercase tracking-widest flex-shrink-0 flex items-center space-x-2 group relative cursor-help">
                    <span>SUPPLIER SOURCE</span>
                    <span className="bg-surface-high text-on-surface border border-outline-variant rounded-full w-4 h-4 flex items-center justify-center font-bold text-[8px]">i</span>
                    <div className="absolute left-6 top-0 hidden group-hover:block bg-surface-highest p-3 border border-outline shadow-2xl text-[10px] font-mono text-on-surface w-56 z-[100] normal-case leading-relaxed font-normal">
                      Available regional suppliers for the selected component. Each has unique distance, quality, and cost profiles.
                    </div>
                  </label>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar relative">
                    <AnimatePresence mode="popLayout">
                      {activeSources.map((s, idx) => {
                        const isSelected = currentDecision.source_id === s.id;
                        const isSaved = initialDecisions[selectedComponent]?.source_id === s.id && initialDecisions[selectedComponent]?.quantity > 0;
                        return (
                          <motion.div
                            key={s.id}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            onClick={() => handleSourceSelect(s.id)}
                            className={`relative p-3 border font-mono text-sm cursor-pointer transition-colors ${isSelected ? 'bg-surface-highest border-primary font-medium' : 'bg-surface border-outline-variant hover:bg-surface-high'} ${isSaved ? 'ring-1 ring-tertiary ring-offset-1 ring-offset-surface-container' : ''}`}
                          >
                            <div className="flex justify-between items-center mb-0.5">
                              <span className={isSelected ? 'text-primary font-bold text-sm' : 'text-on-surface font-semibold text-sm'}>{s.name}</span>
                              <span className="text-[10px] text-on-surface-variant font-mono">${s.base_cost_per_unit}/u</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-on-surface-variant font-medium font-mono">
                              <span>{s.distance}km · Q:{s.quality_mean.toFixed(0)}</span>
                              <span className="text-primary/80 uppercase">{getConsistencyLabel(s.quality_sigma)}</span>
                            </div>
                            {isSaved && <div className="absolute -top-2 -right-2 bg-tertiary text-[#000] text-[10px] px-1 font-bold">SAVED</div>}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {activeSources.length === 0 && (
                      <div className="p-4 text-center text-on-surface-variant italic font-mono text-sm border border-outline-variant">No sources available</div>
                    )}
                  </div>
                </div>

                <div className="w-1/2 flex flex-col space-y-6 h-full overflow-y-auto custom-scrollbar pr-2">
                  {selectedSource ? (
                    <div className="bg-surface-low border border-outline-variant p-3 space-y-2 font-mono text-xs flex-1 flex flex-col font-medium">
                      <h3 className="text-primary text-sm border-b border-outline-variant/30 pb-1.5 mb-1.5 font-bold uppercase">{selectedSource.name}</h3>
                      <div className="flex justify-between items-center group relative cursor-help">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-on-surface-variant uppercase">DISTANCE</span>
                          <span className="bg-surface-high text-on-surface border border-outline-variant rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold text-[8px]">i</span>
                        </div>
                        <span>{selectedSource.distance} km</span>
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block bg-surface-highest p-2 border border-outline shadow-2xl text-[10px] font-mono text-on-surface w-48 z-[100] normal-case leading-relaxed font-normal">
                           Physical distance from the supplier. Impacts variable transport costs and increases damage risk during transit.
                        </div>
                      </div>

                      <div className="flex justify-between items-center group relative cursor-help">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-on-surface-variant uppercase">QUALITY MEAN</span>
                          <span className="bg-surface-high text-on-surface border border-outline-variant rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold text-[8px]">i</span>
                        </div>
                        <span>{selectedSource.quality_mean.toFixed(2)}</span>
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block bg-surface-highest p-2 border border-outline shadow-2xl text-[10px] font-mono text-on-surface w-48 z-[100] normal-case leading-relaxed font-normal">
                           The average grade (0-100) of materials. Higher grades are required for premium manufacturing and efficient production.
                        </div>
                      </div>

                      <div className="flex justify-between items-center group relative cursor-help">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-on-surface-variant uppercase">CONSISTENCY</span>
                          <span className="bg-surface-high text-on-surface border border-outline-variant rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold text-[8px]">i</span>
                        </div>
                        <span className="text-primary font-bold uppercase">{getConsistencyLabel(selectedSource.quality_sigma)}</span>
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block bg-surface-highest p-2 border border-outline shadow-2xl text-[10px] font-mono text-on-surface w-48 z-[100] normal-case leading-relaxed font-normal">
                           Measures the reliability of the supplier's grade control. High consistency means materials will likely hit the target mean.
                        </div>
                      </div>

                      <div className="flex justify-between items-center group relative cursor-help">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-on-surface-variant uppercase">UNIT BASE COST</span>
                          <span className="bg-surface-high text-on-surface border border-outline-variant rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold text-[8px]">i</span>
                        </div>
                        <span className="text-tertiary font-bold">${selectedSource.base_cost_per_unit.toFixed(2)}</span>
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block bg-surface-highest p-2 border border-outline shadow-2xl text-[10px] font-mono text-on-surface w-48 z-[100] normal-case leading-relaxed font-normal">
                           The raw purchase price per unit of material before transport fees and topographical logistical taxes.
                        </div>
                      </div>

                      <div className="pt-3 border-t border-outline-variant/30 mt-auto">
                        <div className="flex justify-between items-baseline mb-2 group relative cursor-help">
                          <label className="text-[10px] font-bold font-mono text-on-surface-variant uppercase tracking-widest flex items-center space-x-2">
                            <span>QUANTITY</span>
                            <span className="bg-surface-high text-on-surface border border-outline-variant rounded-full w-3 h-3 flex items-center justify-center font-bold text-[7px]">i</span>
                          </label>
                          <span className="text-xl font-bold font-mono text-primary">{currentDecision.quantity} u</span>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block bg-surface-highest p-2 border border-outline-variant shadow-lg text-[10px] font-mono text-on-surface w-48 z-50 normal-case leading-relaxed font-normal">
                            Total volume being ordered. Higher volumes utilize more funds but ensure production stability for the next cycle.
                          </div>
                        </div>
                        <input
                          type="range"
                          min={selectedSource.min_order}
                          max={selectedSource.max_order}
                          step="1"
                          value={currentDecision.quantity}
                          onChange={e => {
                            let val = parseInt(e.target.value) || 0;
                            setDecision(selectedComponent, 'quantity', val);
                          }}
                          disabled={!isProcurementOpen}
                          className="w-full h-1.5 bg-surface rounded-lg appearance-none cursor-pointer accent-primary border border-outline-variant/30"
                        />
                        <div className="flex justify-between text-[9px] text-on-surface-variant font-mono mt-1 opacity-70">
                          <span>MIN: {selectedSource.min_order}</span>
                          <span>MAX: {selectedSource.max_order}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-surface-low border border-outline-variant p-4 flex items-center justify-center text-on-surface-variant font-mono text-sm flex-1 italic">
                      Select a source
                    </div>
                  )}
                </div>
              </div>

              {/* Transport Mode with Hover Cards */}
              <div className="space-y-4 flex-shrink-0">
                <div className="space-y-2">
                  <label className="block text-sm font-bold font-mono text-on-surface-variant uppercase tracking-widest group relative cursor-help flex items-center space-x-2">
                    <span>TRANSPORT MODE</span>
                    <span className="bg-surface-high text-on-surface border border-outline-variant rounded-full w-4 h-4 flex items-center justify-center font-bold text-[8px]">i</span>
                    <div className="absolute left-6 top-0 hidden group-hover:block bg-surface-highest p-3 border border-outline shadow-2xl text-[10px] font-mono text-on-surface w-56 z-[100] normal-case leading-relaxed font-normal">
                      Method of shipment. Controls speed, base/variable costs, and risk of material damage during transit.
                    </div>
                  </label>
                  <div className="flex space-x-2">
                    {(Object.keys(transports) || []).map(mode => {
                      const tData = transports[mode];
                      const isSelected = currentDecision.transport === mode;
                      return (
                        <div key={mode} className="flex-1 relative group/transport">
                          <motion.button
                            whileHover={isProcurementOpen ? { y: -2 } : {}}
                            whileTap={isProcurementOpen ? { scale: 0.96 } : {}}
                            disabled={!isProcurementOpen}
                            onClick={() => setDecision(selectedComponent, 'transport', mode)}
                            className={`w-full py-2 text-xs font-semibold font-mono uppercase tracking-[0.2em] transition-colors border
                              ${isSelected
                                ? 'bg-surface-highest text-primary border-primary ring-1 ring-primary'
                                : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-low'
                              }
                              ${!isProcurementOpen && 'opacity-50 cursor-not-allowed'}
                            `}
                          >
                            {mode}
                          </motion.button>

                          {/* Hover Card */}
                          {tData && (
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 opacity-0 pointer-events-none group-hover/transport:opacity-100 group-hover/transport:pointer-events-auto transition-opacity duration-200 z-20">
                              <div className="bg-surface-highest border border-outline p-3 shadow-[0_4px_24px_rgba(0,0,0,0.5)] space-y-1.5">
                                <div className="text-xs font-bold font-mono text-primary uppercase tracking-widest border-b border-outline-variant/40 pb-1.5 mb-1">{mode}</div>
                                <div className="flex justify-between text-xs font-mono">
                                  <span className="text-on-surface-variant">Base Cost</span>
                                  <span className="text-on-surface font-semibold">${tData.base_cost}</span>
                                </div>
                                <div className="flex justify-between text-xs font-mono">
                                  <span className="text-on-surface-variant">Var. Cost</span>
                                  <span className="text-on-surface font-semibold">${tData.var_cost}/u·km</span>
                                </div>
                                <div className="flex justify-between text-xs font-mono">
                                  <span className="text-on-surface-variant">Consist. Impact</span>
                                  <span className="text-on-surface font-semibold">{getConsistencyLabel(tData.sigma_add)}</span>
                                </div>
                                <div className="flex justify-between text-xs font-mono">
                                  <span className="text-error">Damage %</span>
                                  <span className="text-error font-bold">{(tData.p_damage * 100).toFixed(1)}%</span>
                                </div>
                              </div>
                              {/* Arrow pointing down */}
                              <div className="flex justify-center">
                                <div className="w-2.5 h-2.5 bg-surface-highest border-r border-b border-outline rotate-45 -mt-[6px]"></div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PROJECTED COMPONENT COST */}
                {selectedSource && isBuying[selectedComponent] && currentProjections && (
                  <div className="p-3 border border-outline-variant bg-surface-highest group relative flex justify-between items-center cursor-help">
                    <span className="text-on-surface-variant font-mono text-[10px] font-bold uppercase tracking-widest flex items-center space-x-2">
                      <span>PROJECTED COST</span>
                      <span className="bg-primary/20 text-primary rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px]">i</span>
                    </span>
                    <span className="font-mono text-xl text-primary font-bold">
                      ${componentCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div className="absolute left-1/4 bottom-full hidden group-hover:block bg-surface-highest p-3 border border-outline-variant shadow-lg text-xs font-mono text-on-surface whitespace-nowrap z-50 normal-case">
                      <div className="border-b border-outline-variant/30 pb-2 mb-2 font-bold uppercase tracking-widest text-primary">Cost Breakdown</div>
                      <div className="flex justify-between mb-1 space-x-6"><span className="text-on-surface-variant">Material Subtotal:</span> <span className="font-semibold">${currentProjections.material_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-on-surface-variant">Transport Subtotal:</span> <span className="font-semibold">${currentProjections.transport_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {submitMessage && (
              <div className={`p-4 border-l-4 font-mono text-base font-semibold bg-surface-high flex-shrink-0
                ${submitMessage.startsWith('SUCCESS') ? 'text-primary border-primary' : 'text-error border-error'}`}>
                {submitMessage}
              </div>
            )}
          </div>

          {/* TOTALS & FACTORY IMPACT PANEL (RIGHT) */}
          <div className="w-[40%] flex flex-col space-y-4 min-h-0 overflow-y-auto custom-scrollbar pr-2">
            <div className="bg-surface-low p-4 border border-outline-variant space-y-4 flex-1 flex flex-col">
              <h2 className="font-display text-sm font-bold uppercase tracking-widest text-[#978d9e] border-b border-outline-variant pb-1.5 flex items-center justify-between group relative cursor-help">
                <span>ORDER SUMMARY</span>
                <span className="bg-surface-high text-on-surface border border-outline-variant rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px]">i</span>
                <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block bg-surface-highest p-3 border border-outline shadow-2xl text-xs font-mono text-on-surface w-64 z-[100] leading-relaxed font-normal normal-case">
                  Procured materials are mixed with existing inventory distributions upon cycle resolution. Unfavorable transports reduce incoming grade means or trigger damage variances over distance.
                </div>
              </h2>

              <div className="flex flex-col flex-1">
                {renderStockGraph()}

                <div className="flex flex-col pt-6 mt-4 border-t border-outline-variant/30 space-y-3">
                  <div className="flex justify-between items-center group relative cursor-help">
                    <span className="flex items-center space-x-2">
                      <span className="text-on-surface-variant text-sm font-semibold uppercase tracking-widest">FUND UTILISATION</span>
                      <span className="w-5 h-5 bg-surface-high border border-outline flex items-center justify-center rounded-full text-xs">i</span>
                    </span>
                    <span className="text-on-surface-variant text-xs font-medium">
                      {fundUsagePct.toFixed(1)}% of ${funds.toLocaleString()}
                    </span>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block bg-surface-highest p-3 border border-outline shadow-2xl text-xs font-mono text-on-surface w-64 z-[100] leading-relaxed font-normal normal-case">
                      Current spending compared to total cash on hand. Exceeding 100% will trigger a cash crunch penalty at the end of the cycle.
                    </div>
                  </div>

                  {/* Progress Bar Container */}
                  <div className="w-full bg-surface h-4 border border-outline-variant relative overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(fundUsagePct, 100)}%` }}
                      className={`h-full ${progressColor} transition-all duration-300`} 
                    />
                    {isOverflowing && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-error/40 shadow-[inset_0_0_10px_rgba(255,0,0,0.5)]" 
                        style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,0,0,0.5) 5px, rgba(255,0,0,0.5) 10px)' }} 
                      />
                    )}
                  </div>

                  <div className={`flex justify-between items-end ${isOverflowing ? 'text-error font-bold' : 'text-on-surface'}`}>
                    <span className="text-sm font-bold uppercase">PROJECTED SURPLUS</span>
                    <span className="text-2xl font-bold">
                      ${remainingFunds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {isOverflowing && (
                    <div className="bg-error-container text-on-surface p-3 text-xs font-medium leading-relaxed border-l-2 border-error animate-pulse">
                      <strong className="block mb-1 text-sm">CASH CRUNCH IMMINENT</strong>
                      Your total procurement exceeds available funds. Operational shortages are automatically resolved at year-end.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM BAR */}
      <div className="bg-surface-container border border-outline-variant p-4 flex justify-between items-center mt-auto flex-shrink-0">
        <div className="flex space-x-12 relative w-full h-full">
          <div>
            <div className="text-on-surface-variant font-display text-xs font-bold tracking-[0.2em] mb-1 flex items-center space-x-2">
              <span>GLOBAL SPEND PROJECTION</span>
              {projectedCosts ? <FiCheckCircle className="text-primary text-xs" /> : null}
            </div>
            <div className={`font-mono text-2xl font-bold ${isOverflowing ? 'text-error' : 'text-on-surface'}`}>${totalProcurementCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            {lastSavedAt && <div className="absolute top-full mt-1 text-on-surface-variant font-mono text-[10px] font-semibold">Saved at {lastSavedAt}</div>}
          </div>
        </div>

        <div className="w-64">
          <SendDecisionsButton
            onClick={handleSubmit}
            disabled={!isProcurementOpen || (buyingCurrentComponent && selectedSource && (currentDecision.quantity < selectedSource.min_order || currentDecision.quantity > selectedSource.max_order))}
            loading={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
};
