import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheckCircle, FiCircle } from 'react-icons/fi';
import { useProcurementStore, useGameStore, useInventoryStore } from '../store';
import { useEventsStore } from '../store/useEventsStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { ComponentTabs, SendDecisionsButton, Tooltip } from '../components/SharedComponents';
import { ProcurementCard } from '../components/PhaseSummaries';
import { getConsistencyLabel, getTransportSpreadLabel } from '../utils/procurementLabels';

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
          <div className="absolute top-6 left-0 hidden group-hover/header:block bg-surface p-2 border border-outline-variant shadow-lg text-xs font-mono text-on-surface w-64 z-50 normal-case leading-relaxed">
            Displays current usable inventory density. Unusable damages (Grade 0) are excluded. New procurements will dynamically merge into this spread upon cycle resolution following transport damage rolls.
          </div>
        </div>

        <div className="flex items-end flex-1 min-h-[60px] w-full space-x-[2px] mt-1 mb-1">
          {deciles.map((val, idx) => (
            <div key={idx} className="flex-1 bg-surface-highest transition-colors flex flex-col justify-end h-full group/col relative">
              <div className="w-full bg-outline transition-all duration-300 group-hover/col:bg-primary rounded-t-sm" style={{ height: `${(val / maxVal) * 100}%` }}></div>
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
    <div className="flex flex-col h-full space-y-6">
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
          <h1 className="font-display text-4xl uppercase tracking-tighter">PROCUREMENT</h1>
          <div className="text-on-surface-variant font-mono text-sm mt-1 font-medium tracking-widest flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>Facility Cycle {useGameStore.getState().cycleNumber} · Supply Chain Active</span>
          </div>
        </div>
      </div>

      <ComponentTabs selected={selectedComponent} onSelect={setComponent} />

      <div className="flex space-x-6 items-center flex-shrink-0">
        <button
          onClick={() => isProcurementOpen && setIsBuying(selectedComponent, false)}
          disabled={!isProcurementOpen}
          className={`flex-1 flex items-center justify-between p-4 border font-display tracking-widest transition-colors ${!buyingCurrentComponent ? 'bg-error-container border-error text-on-surface' : 'bg-surface-low border-outline-variant text-on-surface-variant hover:bg-surface-high'} ${!isProcurementOpen && 'opacity-50 cursor-not-allowed'}`}
        >
          <span className="text-sm font-semibold">DO NOT PURCHASE</span>
          {!buyingCurrentComponent ? <FiCheckCircle className="text-2xl" /> : <FiCircle className="text-2xl opacity-50" />}
        </button>

        <button
          onClick={() => isProcurementOpen && setIsBuying(selectedComponent, true)}
          disabled={!isProcurementOpen}
          className={`flex-1 flex items-center justify-between p-4 border font-display tracking-widest transition-colors ${buyingCurrentComponent ? 'bg-primary-container border-primary text-[#000]' : 'bg-surface-low border-outline-variant text-on-surface-variant hover:bg-surface-high'} ${!isProcurementOpen && 'opacity-50 cursor-not-allowed'}`}
        >
          <span className="text-sm font-semibold">PROCURE COMPONENTS</span>
          {buyingCurrentComponent ? <FiCheckCircle className="text-2xl text-[#000]" /> : <FiCircle className="text-2xl opacity-50" />}
        </button>
      </div>

      {buyingCurrentComponent && (
        <div className="flex flex-1 overflow-hidden space-x-4 animate-fade-in min-h-0">
          {/* INPUT SECTION (LEFT) */}
          <div className="flex-[6] flex flex-col space-y-6 min-h-0">
            <div className="bg-surface-container p-4 space-y-6 flex-1 flex flex-col border border-outline-variant min-h-0">

              <div className="flex space-x-4 flex-shrink-0 h-[320px]">
                <div className="flex-1 flex flex-col space-y-2 h-full">
                  <label className="block text-sm font-bold font-mono text-on-surface-variant uppercase tracking-widest flex-shrink-0">
                    SUPPLIER SOURCE
                  </label>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar relative">
                    {activeSources.map((s, i) => {
                      const isSelected = currentDecision.source_id === s.id;
                      const isSaved = initialDecisions[selectedComponent]?.source_id === s.id && initialDecisions[selectedComponent]?.quantity > 0;
                      return (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => handleSourceSelect(s.id)}
                          className={`relative p-3 border font-mono text-sm cursor-pointer transition-colors ${isSelected ? 'bg-surface-highest border-primary font-medium' : 'bg-surface border-outline-variant hover:bg-surface-high'} ${isSaved ? 'ring-1 ring-tertiary ring-offset-1 ring-offset-surface-container' : ''}`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className={isSelected ? 'text-primary font-bold text-sm' : 'text-on-surface font-semibold text-sm'}>{s.name}</span>
                            <span className="text-xs text-on-surface-variant">${s.base_cost_per_unit}/u</span>
                          </div>
                          <div className="flex justify-between text-xs text-on-surface-variant font-medium">
                            <span>Dist: {s.distance}km</span>
                            <span>{s.quality_mean.toFixed(0)} GR · <span className={getConsistencyLabel(s.quality_sigma).color}>{getConsistencyLabel(s.quality_sigma).text}</span></span>
                          </div>
                          {isSaved && <div className="absolute -top-2 -right-2 bg-tertiary text-[#000] text-[10px] px-1 font-bold">SAVED</div>}
                        </motion.div>
                      );
                    })}
                    {activeSources.length === 0 && (
                      <div className="p-4 text-center text-on-surface-variant italic font-mono text-sm border border-outline-variant">No sources available</div>
                    )}
                  </div>
                </div>

                <div className="flex-1 flex flex-col space-y-6 h-full overflow-y-auto custom-scrollbar pr-2">
                  <AnimatePresence mode="wait">
                    {selectedSource ? (
                      <motion.div 
                        key={selectedSource.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-surface-low border border-outline-variant p-3 space-y-2.5 font-mono text-xs flex-1 flex flex-col font-medium"
                      >
                        <h3 className="text-primary text-sm border-b border-outline-variant/50 pb-2 mb-2 font-bold uppercase">{selectedSource.name}</h3>
                        <div className="flex justify-between items-center">
                          <span className="text-on-surface-variant flex items-center space-x-1">
                            <span>DISTANCE</span>
                            <Tooltip text="Physical displacement from facility. Increases variable transport costs and baseline logistics complexity." />
                          </span>
                          <span>{selectedSource.distance} km</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-on-surface-variant flex items-center space-x-1">
                            <span>QUALITY MEAN</span>
                            <Tooltip text="The average base grade of materials. Represents the foundation for your final product's quality potential." />
                          </span>
                          <span>{selectedSource.quality_mean.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-on-surface-variant flex items-center space-x-1">
                            <span>CONSISTENCY</span>
                            <Tooltip text="Statistical output variance. High stability ensures predictable grades, while variance invites quality gambling." />
                          </span>
                          <span className={`font-bold ${getConsistencyLabel(selectedSource.quality_sigma).color}`}>{getConsistencyLabel(selectedSource.quality_sigma).text}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-on-surface-variant flex items-center space-x-1">
                            <span>UNIT BASE COST</span>
                            <Tooltip text="Raw purchase price per component unit. Does not include transport or specialized handling fees." />
                          </span>
                          <span className="text-tertiary font-bold">${selectedSource.base_cost_per_unit.toFixed(2)}</span>
                        </div>

                        <div className="space-y-4">
                          <div className="flex justify-between items-end">
                            <label className="block text-xs font-bold font-mono text-on-surface-variant uppercase tracking-widest">
                              PROCURING QUANTITY
                            </label>
                            <motion.span 
                              key={currentDecision.quantity}
                              initial={{ scale: 1.2, color: '#3b82f6' }}
                              animate={{ scale: 1, color: '#3b82f6' }}
                              className="text-2xl font-bold font-display text-primary inline-block"
                            >
                              {currentDecision.quantity.toLocaleString()}
                            </motion.span>
                          </div>
                          <div className="relative pt-2">
                            <input
                              type="range"
                              min={selectedSource.min_order || 0}
                              max={selectedSource.max_order || 10000}
                              step="1"
                              value={currentDecision.quantity}
                              onChange={e => {
                                let val = parseInt(e.target.value) || 0;
                                setDecision(selectedComponent, 'quantity', val);
                              }}
                              disabled={!isProcurementOpen}
                              className="premium-slider w-full h-1.5 bg-surface-highest rounded-lg appearance-none cursor-pointer accent-primary border border-outline-variant/30"
                            />
                            <div className="flex justify-between mt-2 text-[10px] font-bold font-mono text-on-surface-variant uppercase tracking-tighter opacity-70">
                              <span>Min: {selectedSource.min_order || 0}</span>
                              <span>Max: {selectedSource.max_order || 10000}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="bg-surface-low border border-outline-variant p-4 flex items-center justify-center text-on-surface-variant font-mono text-sm flex-1 italic">
                        Select a source
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Transport Mode with Hover Cards */}
              <div className="space-y-4 flex-shrink-0">
                <div className="space-y-2">
                  <label className="block text-sm font-bold font-mono text-on-surface-variant uppercase tracking-widest">
                    TRANSPORT MODE
                  </label>
                  <div className="flex space-x-2">
                    {(Object.keys(transports) || []).map(mode => {
                      const tData = transports[mode];
                      const isSelected = currentDecision.transport === mode;
                      return (
                        <div key={mode} className="flex-1">
                          <Tooltip
                            className="w-full"
                            text={
                              <div className="space-y-1.5 min-w-[200px]">
                                <div className="flex justify-between text-xs font-mono">
                                  <span className="text-on-surface-variant">Base Cost</span>
                                  <span className="text-on-surface font-semibold">${tData.base_cost}</span>
                                </div>
                                <div className="flex justify-between text-xs font-mono">
                                  <span className="text-on-surface-variant">Var. Cost</span>
                                  <span className="text-on-surface font-semibold">${tData.var_cost}/u·km</span>
                                </div>
                                <div className="flex justify-between text-xs font-mono">
                                  <span className="text-on-surface-variant">Spread σ</span>
                                  <span className={`font-semibold ${getTransportSpreadLabel(tData.sigma_add).color}`}>{getTransportSpreadLabel(tData.sigma_add).text}</span>
                                </div>
                                <div className="flex justify-between text-xs font-mono">
                                  <span className="text-error">Damage %</span>
                                  <span className="text-error font-bold">{(tData.p_damage * 100).toFixed(1)}%</span>
                                </div>
                              </div>
                            }
                            title={mode}
                          >
                            <motion.button
                              whileHover={{ scale: 1.02, boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)' }}
                              whileTap={{ scale: 0.98 }}
                              disabled={!isProcurementOpen}
                              onClick={() => setDecision(selectedComponent, 'transport', mode)}
                              className={`w-full py-3 text-sm font-semibold font-mono uppercase tracking-widest transition-colors border
                                ${isSelected
                                  ? 'bg-surface-highest text-primary border-primary ring-1 ring-primary'
                                  : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-low'
                                }
                                ${!isProcurementOpen && 'opacity-50 cursor-not-allowed'}
                              `}
                            >
                              {mode}
                            </motion.button>
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PROJECTED COMPONENT COST */}
                {selectedSource && isBuying[selectedComponent] && currentProjections && (
                  <div className="p-4 border border-outline-variant bg-surface-highest group relative flex justify-between items-center cursor-help">
                    <span className="text-on-surface-variant font-mono text-sm font-semibold uppercase tracking-widest flex items-center space-x-2">
                      <span>Projected Total Cost</span>
                      <span className="bg-primary/20 text-primary rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs">i</span>
                    </span>
                    <motion.span 
                      key={componentCost}
                      initial={{ scale: 1.1, color: '#3b82f6' }}
                      animate={{ scale: 1, color: '#3b82f6' }}
                      className="font-mono text-2xl text-primary font-bold"
                    >
                      ${componentCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </motion.span>
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
          <div className="flex-[4] flex flex-col space-y-6 min-h-0 overflow-y-auto custom-scrollbar pr-2">
            <div className="bg-surface-low p-6 border border-outline-variant space-y-6 flex-1 flex flex-col">
              <h2 className="font-display text-base font-bold uppercase tracking-widest text-[#978d9e] border-b border-outline-variant pb-2 flex items-center justify-between group relative cursor-help">
                <span>ORDER SUMMARY</span>
                <span className="bg-surface-high text-on-surface border border-outline-variant rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs">i</span>
                <div className="absolute right-0 top-full mt-2 hidden group-hover:block bg-surface-highest p-3 border border-outline-variant shadow-lg text-xs font-mono text-on-surface w-64 z-[60] leading-relaxed font-normal normal-case">
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
                  </div>

                  {/* Progress Bar Container */}
                  <div className="w-full bg-surface h-4 border border-outline-variant relative overflow-hidden">
                    <div className={`h-full ${progressColor} transition-all duration-300`} style={{ width: `${Math.min(fundUsagePct, 100)}%` }} />
                    {isOverflowing && (
                      <div className="absolute inset-0 bg-error/40" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,0,0,0.5) 5px, rgba(255,0,0,0.5) 10px)' }}></div>
                    )}
                  </div>

                  <div className={`flex justify-between items-end ${isOverflowing ? 'text-error font-bold' : 'text-on-surface'}`}>
                    <span className="text-sm font-bold uppercase">PROJECTED SURPLUS</span>
                    <motion.span 
                      key={remainingFunds}
                      initial={{ scale: 1.1, color: isOverflowing ? '#ef4444' : '#10b981' }}
                      animate={{ scale: 1, color: isOverflowing ? '#ef4444' : '#f8fafc' }}
                      className="text-2xl font-bold"
                    >
                      ${remainingFunds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </motion.span>
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
      <div className="bg-surface-container border border-outline-variant p-6 flex justify-between items-center mt-auto flex-shrink-0">
        <div className="flex space-x-12 relative w-full h-full">
          <div>
            <div className="text-on-surface-variant font-display text-sm font-bold tracking-widest mb-1 flex items-center space-x-2">
              <span>GLOBAL SPEND PROJECTION</span>
              {projectedCosts ? <FiCheckCircle className="text-primary text-sm" /> : null}
            </div>
            <motion.div 
              key={totalProcurementCost}
              initial={{ scale: 1.05, color: isOverflowing ? '#ef4444' : '#3b82f6' }}
              animate={{ scale: 1, color: isOverflowing ? '#ef4444' : '#f8fafc' }}
              className={`font-mono text-3xl font-bold ${isOverflowing ? 'text-error' : 'text-on-surface'}`}
            >
              ${totalProcurementCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </motion.div>
            {lastSavedAt && <div className="absolute top-full mt-2 text-on-surface-variant font-mono text-xs font-semibold">Saved at {lastSavedAt}</div>}
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
