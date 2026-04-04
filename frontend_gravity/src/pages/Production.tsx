import { useEffect, useState } from 'react';
import { useProductionStore, useGameStore, useInventoryStore } from '../store';
import { useNotificationStore } from '../store/useNotificationStore';
import { ComponentTabs, SendDecisionsButton } from '../components/SharedComponents';
import type { ComponentType } from '../types';

const MAINTENANCE_COSTS = { none: 0, basic: 500, full: 1500, overhaul: 5000 };
const WAGE_COSTS = { below_market: 300, market: 500, above_market: 750 };

export const Production = () => {
  const { phase } = useGameStore();
  const { addToast } = useNotificationStore();
  const { components, fetchInventory } = useInventoryStore();
  const { 
    componentDecisions, wageLevel, targetHeadcount, upgradeAutomation, 
    selectedComponent, setComponent, setMaintenance, setUnitsToProduce, setRndInvest, clearRndInvest,
    setWageLevel, setHeadcount, setAutomation, setBuyMachine, fetchExistingDecisions, submitDecisions 
  } = useProductionStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  useEffect(() => {
    fetchExistingDecisions();
    fetchInventory();
  }, [fetchExistingDecisions, fetchInventory]);

  const isProductionOpen = phase === 'production_open';
  const currentComp = componentDecisions[selectedComponent];
  const factoryCompData = components.find(c => c.component === selectedComponent);

  // Computations
  let totalMaintCost = 0;
  let totalRndCost = 0;
  
  (Object.keys(componentDecisions) as ComponentType[]).forEach(comp => {
    totalMaintCost += MAINTENANCE_COSTS[componentDecisions[comp].maintenance];
    if (componentDecisions[comp].rnd_invest) {
      totalRndCost += (componentDecisions[comp].rnd_invest?.levels || 0) * 10000;
    }
  });

  const workforceCost = (targetHeadcount || 0) * WAGE_COSTS[wageLevel];
  const totalProductionCost = totalMaintCost + totalRndCost + workforceCost;

  const handleSubmit = async () => {
    if (!window.confirm('Confirm production decisions? This cannot be undone until the next phase.')) return;
    setIsSubmitting(true);
    setSubmitMessage('');
    try {
      await submitDecisions();
      const ts = new Date().toLocaleTimeString();
      setSubmitMessage(`SUCCESS: Decisions saved at ${ts}.`);
      addToast(`Decisions saved at ${ts}`, 'success');
    } catch(err: any) {
      setSubmitMessage(`ERROR: ${err.message || "Failed to submit"}`);
      addToast(err?.message || 'Failed to save production decisions', 'error');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmitMessage(''), 3000);
    }
  };

  const handleRndChange = (levels: string) => {
    const parsed = parseInt(levels, 10);
    if (!parsed || parsed <= 0) {
      clearRndInvest(selectedComponent);
    } else {
      setRndInvest(selectedComponent, currentComp.rnd_invest?.focus || 'quality', parsed);
    }
  };

  const AutomationLevelBox = ({ label, val }: { label: string, val: 'manual'|'semi_auto'|'full_auto' }) => (
    <button
      onClick={() => setAutomation(val)}
      disabled={!isProductionOpen}
      className={`flex-1 py-3 px-2 text-xs font-mono tracking-widest uppercase transition-colors border
        ${upgradeAutomation === val ? 'bg-surface-highest text-primary border-primary' : 'bg-surface-low text-on-surface-variant border-outline-variant hover:bg-surface-high'}
        ${!isProductionOpen && 'opacity-50 cursor-not-allowed'}
      `}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-full space-y-6">
      <ComponentTabs selected={selectedComponent} onSelect={setComponent} />
      
      <h1 className="font-display text-3xl uppercase tracking-tighter">
        PRODUCTION
      </h1>

      <div className="flex flex-1 space-x-6">
        
        {/* INPUT SECTION */}
        <div className="w-3/5 flex flex-col space-y-6">
          <div className="bg-surface-container p-6 border border-outline-variant space-y-8 flex-1">
            
            {/* Component Level Decisions */}
            <div className="space-y-4">
              <h2 className="text-xs font-mono text-on-surface-variant uppercase tracking-widest border-b border-outline-variant pb-2">
                COMPONENT DECISIONS ({selectedComponent.replace('_', ' ')})
              </h2>
              
              <div className="flex space-x-6 items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">MAINTENANCE</label>
                  <div className="flex space-x-2">
                    {(['none', 'basic', 'full', 'overhaul'] as const).map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => setMaintenance(selectedComponent, lvl)}
                        disabled={!isProductionOpen}
                        className={`flex-1 py-2 px-2 text-[10px] sm:text-xs font-mono tracking-widest uppercase transition-colors border
                          ${currentComp.maintenance === lvl ? 'bg-surface-highest text-primary border-primary' : 'bg-surface py-2 border-outline-variant text-on-surface-variant'}
                          ${!isProductionOpen && 'opacity-50 cursor-not-allowed'}
                        `}
                      >
                        {lvl} (${MAINTENANCE_COSTS[lvl]})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <label className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">UNITS TO PRODUCE</label>
                  <div className="flex items-center space-x-2 bg-surface-low border border-outline-variant p-2">
                    <input 
                      type="number" min="0" step="1"
                      value={currentComp.units_to_produce === null ? '' : currentComp.units_to_produce}
                      placeholder="Max"
                      onChange={e => setUnitsToProduce(selectedComponent, e.target.value ? parseInt(e.target.value) : null)}
                      disabled={!isProductionOpen}
                      className="w-full bg-transparent font-mono text-xl text-primary disabled:opacity-50 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-6 items-end mt-4">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">R&D INVESTMENT</label>
                  <div className="flex space-x-2">
                    <select
                      value={currentComp.rnd_invest?.focus || 'quality'}
                      onChange={(e) => setRndInvest(selectedComponent, e.target.value, currentComp.rnd_invest?.levels || 1)}
                      className="w-1/2 bg-surface-low border border-outline-variant p-2 font-mono text-xs"
                      disabled={!isProductionOpen}
                    >
                      <option value="quality">quality</option>
                      <option value="consistency">consistency</option>
                      <option value="yield">yield</option>
                    </select>
                    <input 
                      type="number" min="0" max="5" step="1"
                      value={currentComp.rnd_invest?.levels || ''}
                      placeholder="levels"
                      onChange={e => handleRndChange(e.target.value)}
                      disabled={!isProductionOpen}
                      className="w-1/2 bg-surface-low border border-outline-variant p-2.5 font-mono text-lg text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[10px] text-on-surface-variant font-mono">Cost: {(currentComp.rnd_invest?.levels || 0) * 10000} CU · Takes 2 cycles to arrive.</p>
                </div>
                
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">BUY MACHINE TIER</label>
                  <select
                    value={currentComp.buy_machine?.tier || ''}
                    onChange={(e) => setBuyMachine(selectedComponent, (e.target.value || null) as any)}
                    disabled={!isProductionOpen}
                    className="w-full bg-surface-low border border-outline-variant p-3 font-mono text-xs"
                  >
                    <option value="">Do not buy machine</option>
                    <option value="basic">basic</option>
                    <option value="standard">standard</option>
                    <option value="industrial">industrial</option>
                    <option value="precision">precision</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Global Level Decisions */}
            <div className="space-y-4 pt-4">
              <h2 className="text-xs font-mono text-on-surface-variant uppercase tracking-widest border-b border-outline-variant pb-2 mt-4">
                GLOBAL WORKFORCE & INFRASTRUCTURE
              </h2>

              <div className="grid grid-cols-2 gap-6 items-center">
                <div className="space-y-2 flex flex-col">
                  <label className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">WAGE LEVEL</label>
                  <select
                    value={wageLevel}
                    onChange={e => setWageLevel(e.target.value as any)}
                    disabled={!isProductionOpen}
                    className="bg-surface-low border border-outline-variant p-3 font-mono text-sm"
                  >
                    <option value="below_market">LOW</option>
                    <option value="market">MARKET</option>
                    <option value="above_market">HIGH</option>
                  </select>
                </div>
                
                <div className="space-y-2 flex flex-col">
                  <label className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">TARGET HEADCOUNT</label>
                  <input 
                    type="number" min="0" step="1"
                    value={targetHeadcount}
                    onChange={e => setHeadcount(parseInt(e.target.value) || 0)}
                    disabled={!isProductionOpen}
                    className="bg-surface-low border border-outline-variant p-2.5 font-mono text-xl text-primary"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <label className="text-xs font-mono text-on-surface-variant uppercase tracking-widest">AUTOMATION UPGRADE</label>
                <div className="flex space-x-2">
                  <AutomationLevelBox label="MANUAL" val="manual" />
                  <AutomationLevelBox label="SEMI-AUTO" val="semi_auto" />
                  <AutomationLevelBox label="FULL-AUTO" val="full_auto" />
                </div>
              </div>

            </div>
          </div>
          
          {submitMessage && (
            <div className={`p-4 border-l-4 font-mono text-sm bg-surface-high 
              ${submitMessage.startsWith('SUCCESS') ? 'text-primary border-primary' : 'text-error border-error'}`}>
              {submitMessage}
            </div>
          )}
        </div>

        {/* FACTORY STATUS PANEL */}
        <div className="w-2/5 flex flex-col space-y-6">
          <div className="bg-surface-low p-6 border border-outline-variant space-y-6 flex-1 font-mono text-sm">
            <h2 className="font-display text-sm uppercase tracking-widest text-[#978d9e] border-b border-outline-variant pb-2">
              FACTORY STATUS
            </h2>
            
            {factoryCompData ? (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-on-surface-variant text-[10px] uppercase">Max Throughput</span>
                    <span className="text-primary text-xl">{(factoryCompData.total_throughput || 0).toLocaleString()} units</span>
                  </div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-on-surface-variant text-[10px] uppercase">R&D Quality Bonus</span>
                    <span className="text-on-surface">+{factoryCompData.rnd_quality.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-on-surface-variant text-[10px] uppercase">R&D Consistency Bonus</span>
                    <span className="text-on-surface">+{factoryCompData.rnd_consistency.toFixed(1)} σ</span>
                  </div>
                </div>

                <div className="border-t border-outline-variant/30 pt-4">
                  <span className="text-xs text-on-surface-variant uppercase tracking-widest mb-4 block">ACTIVE MACHINES ({factoryCompData.machine_count})</span>
                  <div className="space-y-3">
                    {factoryCompData.machines && factoryCompData.machines.map((mac, idx) => (
                      <div key={idx} className="bg-surface p-3 border border-outline-variant/50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] uppercase text-primary">T{mac.tier} {mac.source}</span>
                          <span className="text-[10px] text-on-surface-variant">Thpt: {mac.throughput}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-on-surface-variant uppercase">Condition</span>
                          <span className={`text-[10px] ${mac.condition < 40 ? 'text-error' : 'text-on-surface'}`}>{mac.condition.toFixed(1)}/100</span>
                        </div>
                        <div className="mt-1 h-1 w-full bg-surface-low">
                          <div
                            className={`h-1 ${mac.condition > 70 ? 'bg-primary' : mac.condition >= 40 ? 'bg-tertiary' : 'bg-error'}`}
                            style={{ width: `${Math.max(0, Math.min(100, mac.condition))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {(!factoryCompData.machines || factoryCompData.machines.length === 0) && (
                      <div className="text-on-surface-variant text-xs italic opacity-50">No active machines</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-on-surface-variant italic opacity-50 text-center py-8">Loading factory data...</div>
            )}

            <div className="border-t border-outline-variant/30 pt-6 mt-auto">
               <h2 className="font-display text-sm uppercase tracking-widest text-[#978d9e] border-b border-outline-variant pb-2 mb-4">
                 COST ESTIMATES
               </h2>
               <div className="space-y-2">
                 <div className="flex justify-between">
                   <span className="text-[10px] text-on-surface-variant">MAINTENANCE</span>
                   <span>${totalMaintCost.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-[10px] text-on-surface-variant">R&D</span>
                   <span>${totalRndCost.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-[10px] text-on-surface-variant">WORKFORCE ({wageLevel})</span>
                   <span>${workforceCost.toLocaleString()}</span>
                 </div>
               </div>
               <div className="flex justify-between mt-4 pt-2 border-t border-outline-variant/50">
                 <span className="text-xs text-on-surface-variant">TOTAL ESTIMATED</span>
                 <span className="text-primary text-xl">${totalProductionCost.toLocaleString()}</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-container border border-outline-variant p-6 flex justify-end">
        <div className="w-64">
          <SendDecisionsButton 
            onClick={handleSubmit} 
            disabled={!isProductionOpen} 
            loading={isSubmitting} 
          />
        </div>
      </div>
    </div>
  );
};
