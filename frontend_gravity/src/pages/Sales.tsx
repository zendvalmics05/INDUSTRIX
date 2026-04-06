import { useMemo, useState, useEffect } from 'react';
import { useGameStore, useInventoryStore } from '../store';
import { useEventsStore } from '../store/useEventsStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { teamApi } from '../api';
import { SendDecisionsButton, WarningBanner } from '../components/SharedComponents';
import { SalesCard } from '../components/PhaseSummaries';
import { 
  FiTrendingUp, FiShoppingBag, FiTruck, FiAlertTriangle, 
  FiPackage, FiDollarSign, FiZap, FiCheckCircle, FiChevronRight 
} from 'react-icons/fi';

type TierKey = 'reject' | 'substandard' | 'standard' | 'premium';
type SalesAction = 'sell_market' | 'sell_premium' | 'sell_discounted' | 'hold' | 'scrap' | 'black_market';

const DEFAULT_PRICES: Record<TierKey, number> = {
  reject: 200,
  substandard: 1400,
  standard: 3000,
  premium: 3000,
};

export const Sales = () => {
  const { phase, cycleNumber } = useGameStore();
  const { brandScore, brandTier, droneBreakdown, components, fetchInventory } = useInventoryStore();
  const { addToast } = useNotificationStore();
  
  const salesSummary = useEventsStore(s => s.sales);
  const loadingSummary = useEventsStore(s => s.loadingSales);
  const fetchAllSummaries = useEventsStore(s => s.fetchAll);

  const [decisions, setDecisions] = useState<Record<TierKey, { action: SalesAction; price_override?: number | null }>>({
    reject: { action: 'scrap', price_override: null },
    substandard: { action: 'sell_discounted', price_override: 1400 },
    standard: { action: 'sell_market', price_override: null },
    premium: { action: 'sell_market', price_override: null },
  });
  const [unitsToAssemble, setUnitsToAssemble] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TierKey>('standard');
  
  const [baselineDecisions, setBaselineDecisions] = useState<typeof decisions | null>(null);
  const [baselineUnits, setBaselineUnits] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('');

  const isSalesOpen = phase === 'sales_open';
  const canSeeSummary = ['backroom', 'game_over'].includes(phase);

  useEffect(() => {
    fetchInventory().catch(() => {});
    teamApi.getSales().then((data) => {
      if (data) {
        const d = data.decisions ?? {};
        const nextDecisions = {
          reject: d.reject || decisions.reject,
          substandard: d.substandard || decisions.substandard,
          standard: d.standard || decisions.standard,
          premium: d.premium || decisions.premium,
        };
        setDecisions(nextDecisions);
        setBaselineDecisions(nextDecisions);
        
        const u = data.units_to_assemble ?? null;
        setUnitsToAssemble(u);
        setBaselineUnits(u);
      }
    }).catch(() => {});

    if (canSeeSummary) {
      fetchAllSummaries(phase);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, canSeeSummary]);

  // Calculate Max Assembly based on bottleneck component
  const maxAssembly = useMemo(() => {
    if (!components || components.length === 0) return 0;
    // We expect 6 components
    return Math.min(...components.map(c => c.finished_stock || 0));
  }, [components]);

  // Bottleneck component identification
  const bottleneckInfo = useMemo(() => {
    if (!components || components.length === 0) return null;
    const sorted = [...components].sort((a, b) => (a.finished_stock || 0) - (b.finished_stock || 0));
    return sorted[0];
  }, [components]);

  const currentUnitsToAssemble = unitsToAssemble === null ? maxAssembly : unitsToAssemble;

  const getTierCount = (tier: TierKey) => droneBreakdown[tier] || 0;

  const estimateByTier = (tier: TierKey) => {
    const count = getTierCount(tier);
    const d = decisions[tier];
    if (d.action === 'hold') return 0;
    if (d.action === 'scrap') return count * 200;
    if (d.action === 'black_market') return count * 600;
    if (d.action === 'sell_premium') return count * 4800;
    if (d.action === 'sell_discounted') return count * (d.price_override || DEFAULT_PRICES[tier]);
    return count * (d.price_override || DEFAULT_PRICES[tier]);
  };

  const totalEstimate = useMemo(
    () => (['reject', 'substandard', 'standard', 'premium'] as TierKey[]).reduce((sum, t) => sum + estimateByTier(t), 0),
    [decisions, droneBreakdown]
  );

  const onSubmit = async () => {
    if (!window.confirm('Confirm sales decisions? This cannot be undone until the next phase.')) return;
    setSaving(true);
    try {
      const payload: any = {};
      const changedDecisions: Record<string, any> = {};
      (['reject', 'substandard', 'standard', 'premium'] as TierKey[]).forEach((tier) => {
        const current = decisions[tier];
        const prev = baselineDecisions?.[tier];
        if (!prev || JSON.stringify(current) !== JSON.stringify(prev)) {
          changedDecisions[tier] = current;
        }
      });
      if (Object.keys(changedDecisions).length > 0) {
        payload.decisions = changedDecisions;
      }
      
      // If unitsToAssemble is null, it means user wants max, but we should send the actual number if they interacted?
      // Actually, per backend spec, if null it might mean max, but let's be explicit and send the number if it changed.
      if (unitsToAssemble !== baselineUnits) {
        payload.units_to_assemble = unitsToAssemble === null ? maxAssembly : unitsToAssemble;
      }

      if (Object.keys(payload).length > 0) {
        await teamApi.patchSales(payload);
      }
      
      const ts = new Date().toLocaleTimeString();
      setLastSavedAt(ts);
      setBaselineDecisions(decisions);
      setBaselineUnits(unitsToAssemble);
      addToast(`Decisions saved at ${ts}`, 'success');
    } catch (e: any) {
      addToast(e?.message || 'Failed to save sales decisions', 'error');
    } finally {
      setSaving(false);
    }
  };

  const progressPct = maxAssembly > 0 ? (currentUnitsToAssemble / maxAssembly) * 100 : 0;

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Phase Summary (if resolved) */}
      {canSeeSummary && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-700">
          <h2 className="text-base font-semibold font-medium font-mono text-on-surface-variant uppercase tracking-[0.3em] mb-3 pl-1">Resolution Report</h2>
          {loadingSummary ? (
             <div className="text-base font-semibold font-medium font-mono text-on-surface-variant animate-pulse px-5 py-8 border border-outline-variant/20 bg-surface-low items-center justify-center flex">
                Decrypting sales summary...
             </div>
          ) : salesSummary ? (
            <SalesCard data={salesSummary} />
          ) : (
             <div className="text-base font-semibold font-medium font-mono text-on-surface-variant px-5 py-8 border border-outline-variant/20 bg-surface-low opacity-60">
                Sales summary payload not found for this cycle.
             </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-start flex-shrink-0">
        <div>
          <h1 className="font-display text-4xl uppercase tracking-tighter">SALES & ASSEMBLY</h1>
          <div className="text-on-surface-variant font-mono text-base font-semibold font-medium mt-1 tracking-widest flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>Facility Cycle {cycleNumber} · Market Execution Protocol</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-shrink-0">
        <div className="bg-surface-low border border-outline-variant p-5 flex flex-col space-y-4">
          <div className="flex justify-between items-center text-base font-semibold font-medium font-mono text-on-surface-variant uppercase tracking-widest">
            <span>Brand Recognition</span>
            <span className="text-primary font-bold">{brandTier}</span>
          </div>
          <div className="text-3xl font-display text-on-surface">{brandScore.toFixed(1)}</div>
          <div className="text-base font-semibold font-medium font-mono text-on-surface-variant leading-relaxed uppercase">
            Market share & demand sensitivity are indexed to your global reputation score.
          </div>
        </div>

        <div className="lg:col-span-2 bg-surface-low border border-outline-variant p-5 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
             <div className="text-base font-semibold font-medium font-mono text-on-surface-variant uppercase tracking-widest">Assembly Allocation Pipeline</div>
             <div className="text-base font-semibold font-medium font-mono text-on-surface-variant uppercase tracking-widest">
               Max Capacity: <span className="text-primary font-bold">{maxAssembly} Units</span>
             </div>
          </div>
          
          <div className="space-y-4">
            <div className="h-1.5 w-full bg-surface-highest rounded-full overflow-hidden border border-outline-variant/30 relative">
              <div 
                className="h-full bg-primary transition-all duration-500 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" 
                style={{ width: `${progressPct}%` }} 
              />
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex-1 flex flex-col space-y-1">
                <input 
                  type="range" min="0" max={maxAssembly} step="1"
                  value={currentUnitsToAssemble}
                  onChange={e => setUnitsToAssemble(parseInt(e.target.value))}
                  disabled={!isSalesOpen}
                  className="w-full h-1.5 bg-surface-highest rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-base font-semibold font-medium font-mono text-on-surface-variant">
                  <span>MIN: 0</span>
                  <span>TARGET: {currentUnitsToAssemble}</span>
                  <span>MAX: {maxAssembly}</span>
                </div>
              </div>
              
              <div className="w-24">
                <input 
                  type="number" min="0" max={maxAssembly} step="1"
                  value={currentUnitsToAssemble}
                  onChange={e => {
                    const val = Math.min(maxAssembly, Math.max(0, parseInt(e.target.value) || 0));
                    setUnitsToAssemble(val);
                  }}
                  disabled={!isSalesOpen}
                  className="w-full bg-surface-highest border border-outline-variant p-2 font-mono text-3xl font-bold font-bold text-primary text-center focus:border-primary transition-colors outline-none"
                />
              </div>
            </div>
            
            {bottleneckInfo && (
              <div className="text-base font-semibold font-mono text-on-surface-variant uppercase flex items-center space-x-2">
                <FiAlertTriangle className="text-tertiary" />
                <span>Bottleneck: <span className="text-tertiary">{bottleneckInfo.component.replace('_', ' ')}</span> limits assembly to {bottleneckInfo.finished_stock} units.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden space-x-6 min-h-0">
        {/* TABBED TIER MANAGEMENT */}
        <div className="w-[65%] flex flex-col space-y-4 min-h-0">
          <div className="flex space-x-1 flex-shrink-0 bg-surface-low border border-outline-variant/50 p-1">
            {(['substandard', 'standard', 'premium'] as TierKey[]).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 py-3 px-4 font-display text-base font-semibold font-medium tracking-widest transition-all uppercase border ${
                  activeTab === t 
                    ? 'bg-surface-highest text-primary border-outline' 
                    : 'text-on-surface-variant border-transparent hover:bg-surface-low'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 bg-surface-container border border-outline-variant p-8 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-3xl font-bold font-display uppercase tracking-tight text-on-surface mb-1">{activeTab} Tier Dispatch</h2>
                <p className="text-base font-semibold font-medium font-mono text-on-surface-variant uppercase">Current Buffer: {getTierCount(activeTab)} Units Ready</p>
              </div>
              <div className="h-12 w-12 bg-surface-highest border border-outline-variant flex items-center justify-center text-primary">
                <FiPackage size={24} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-base font-semibold font-medium font-mono text-on-surface-variant uppercase tracking-widest mb-3">Market Strategy</label>
                  <div className="space-y-2">
                    {[
                      { id: 'sell_market', label: 'Standard Market Release', icon: FiTrendingUp },
                      { id: 'sell_premium', label: 'Premium Niche Targeting', icon: FiZap, hidden: activeTab !== 'premium' },
                      { id: 'sell_discounted', label: 'Discounted Liquidation', icon: FiShoppingBag },
                      { id: 'hold', label: 'Hold in Storage', icon: FiPackage },
                      { id: 'scrap', label: 'Disposal / Scrap', icon: FiAlertTriangle },
                    ].filter(a => !a.hidden).map(a => (
                      <button
                        key={a.id}
                        disabled={!isSalesOpen}
                        onClick={() => setDecisions(s => ({ ...s, [activeTab]: { ...s[activeTab], action: a.id as SalesAction } }))}
                        className={`w-full flex items-center justify-between p-3 border font-mono text-base font-semibold font-medium transition-all ${
                          decisions[activeTab].action === a.id 
                            ? 'bg-surface-highest border-primary text-primary' 
                            : 'bg-surface-low border-outline-variant text-on-surface-variant hover:border-on-surface'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <a.icon size={12} />
                          <span>{a.label}</span>
                        </div>
                        {decisions[activeTab].action === a.id && <FiCheckCircle />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-base font-semibold font-medium font-mono text-on-surface-variant uppercase tracking-widest mb-3">Price Architecture</label>
                  <div className="bg-surface-low border border-outline-variant p-4 space-y-4">
                    <div className="flex justify-between items-center text-base font-semibold font-medium font-mono text-on-surface-variant uppercase">
                      <span>Baseline Price</span>
                      <span className="text-on-surface">${DEFAULT_PRICES[activeTab].toLocaleString()} / unit</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-base font-semibold font-medium font-mono text-on-surface-variant uppercase">Custom Price Override</div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-mono">$</span>
                        <input
                          type="number"
                          className="w-full bg-surface border border-outline-variant p-3 pl-8 font-mono text-3xl font-bold font-bold text-primary outline-none focus:border-primary transition-colors"
                          value={decisions[activeTab].price_override ?? ''}
                          onChange={(e) => setDecisions((s) => ({ ...s, [activeTab]: { ...s[activeTab], price_override: e.target.value ? Number(e.target.value) : null } }))}
                          disabled={!isSalesOpen}
                          placeholder={DEFAULT_PRICES[activeTab].toString()}
                        />
                      </div>
                      <p className="text-base font-semibold font-mono text-on-surface-variant leading-relaxed normal-case">
                        Manual overrides adjust the unit price for this tier. Substantial deviations from market baseline may impact conversion rates.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-outline-variant/30 flex justify-between items-center">
                      <span className="text-base font-semibold font-medium font-mono text-on-surface-variant uppercase">Effective Revenue</span>
                      <span className="text-3xl font-bold font-display text-primary">${estimateByTier(activeTab).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Reject handling snippet */}
                <button 
                  onClick={() => setActiveTab('reject')}
                  className="w-full p-3 border border-dashed border-outline-variant flex justify-between items-center text-base font-semibold font-medium font-mono text-on-surface-variant hover:border-error hover:text-error transition-colors"
                >
                  <span className="uppercase">Configure Grade 0 (Reject) Disposal</span>
                  <FiChevronRight />
                </button>
              </div>
            </div>
            
            {activeTab === 'reject' && (
               <div className="mt-8 pt-8 border-t border-error/20 space-y-4">
                  <div className="flex items-center space-x-2 text-error">
                    <FiAlertTriangle />
                    <span className="text-base font-bold uppercase tracking-widest">Reject Management Protocol</span>
                  </div>
                  <p className="text-base font-semibold font-medium font-mono text-on-surface-variant leading-relaxed">
                    Reject units cannot be sold on the open market. They must be scrapped for material recovery ($200) or sold via the Black Market ($600) with high discovery risk.
                  </p>
                  {decisions.reject.action === 'black_market' && (
                    <div className="bg-error/10 border-l-4 border-error p-3 text-base font-semibold font-medium font-mono text-error uppercase">
                      Black market sale active: High exposure risk detected.
                    </div>
                  )}
               </div>
            )}
          </div>
        </div>

        {/* COCKPIT PANEL (RIGHT) */}
        <div className="w-[35%] flex flex-col space-y-4">
          <div className="bg-surface-low border border-outline-variant p-6 flex-1 flex flex-col">
            <h2 className="text-base font-semibold font-mono text-on-surface-variant uppercase tracking-[0.25em] border-b border-outline-variant pb-4 mb-6">
              Cycle Projections
            </h2>

            <div className="space-y-6 flex-1">
              <div className="space-y-2">
                <div className="flex justify-between text-base font-semibold font-medium font-mono text-on-surface-variant uppercase">
                  <span>Target Assembly</span>
                  <span className="text-on-surface">{currentUnitsToAssemble} units</span>
                </div>
                <div className="flex justify-between text-base font-semibold font-medium font-mono text-on-surface-variant uppercase">
                  <span>Assembly Throughput</span>
                  <span className="text-on-surface">100% (No Labour Deficit)</span>
                </div>
                <div className="pt-2 border-t border-outline-variant/30 flex justify-between items-end">
                   <div className="text-base font-semibold font-medium font-mono text-on-surface-variant uppercase">Projected Net Revenue</div>
                   <div className="text-3xl font-display text-primary">${totalEstimate.toLocaleString()}</div>
                </div>
              </div>

              <div className="bg-surface-highest/30 border border-outline-variant p-4 space-y-4">
                <div className="text-base font-semibold font-medium font-mono text-primary uppercase tracking-widest font-bold border-b border-primary/20 pb-2 flex items-center space-x-2">
                  <FiDollarSign /> <span>Financial Intelligence</span>
                </div>
                <p className="text-base font-semibold font-medium font-mono text-on-surface-variant leading-relaxed normal-case">
                  Assembly costs (labour/maint) were reconciled during the Production phase. This page manages inventory outflow & liquid fund generation.
                </p>
              </div>
            </div>

            <div className="space-y-4 mt-auto">
              {lastSavedAt && (
                <div className="flex items-center justify-center space-x-2 text-base font-semibold font-medium font-mono text-primary animate-in fade-in">
                  <FiCheckCircle />
                  <span className="uppercase tracking-widest">Protocol Synchronized at {lastSavedAt}</span>
                </div>
              )}
              <SendDecisionsButton onClick={onSubmit} disabled={!isSalesOpen} loading={saving} />
              <div className="text-base font-semibold font-mono text-on-surface-variant text-center opacity-60 normal-case">
                Transmitted decisions are final once the resolution timer expires.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
