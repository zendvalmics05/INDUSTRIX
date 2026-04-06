import { useMemo, useState, useEffect } from 'react';
import { useGameStore, useInventoryStore } from '../store';
import { useEventsStore } from '../store/useEventsStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { teamApi } from '../api';
import { SendDecisionsButton } from '../components/SharedComponents';
import { SalesCard } from '../components/PhaseSummaries';
import { 
  FiTrendingUp, FiAlertTriangle, 
  FiPackage, FiDollarSign, FiZap, FiCheckCircle, FiChevronDown 
} from 'react-icons/fi';

type TierKey = 'reject' | 'substandard' | 'standard' | 'premium';
type SalesAction = 'sell_market' | 'sell_premium' | 'sell_discounted' | 'hold' | 'scrap' | 'black_market' | 'rework';

interface StandardPrices {
  scrap: number;
  rework: number;
  black_market: number;
  substandard: number;
  standard: number;
  premium: number;
}

// ── Components ───────────────────────────────────────────────────────────────

const PriceSlider = ({ 
  label, value, min, max, standardPrices, onChange, disabled 
}: { 
  label: string; value: number; min: number; max: number; 
  standardPrices: StandardPrices; onChange: (val: number) => void;
  disabled: boolean;
}) => {
  const blobs = [
    { label: 'Substandard', value: standardPrices.substandard },
    { label: 'Standard', value: standardPrices.standard },
    { label: 'Premium', value: standardPrices.premium },
  ];

  return (
    <div className="space-y-4 py-2">
      <div className="flex justify-between items-end">
        <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest font-bold opacity-70">{label} Valuation</span>
        <div className="text-4xl font-display text-primary flex items-baseline">
          <span className="text-xl mr-1 opacity-40">$</span>
          {value.toLocaleString()}
        </div>
      </div>

      <div className="relative h-12 flex items-center group">
        <div className="absolute w-full h-1 bg-surface-highest rounded-full pointer-events-none" />
        <div 
          className="absolute h-1 bg-primary rounded-full transition-all duration-300 pointer-events-none" 
          style={{ width: `${((value - min) / (max - min)) * 100}%` }}
        />
        <div className="absolute inset-0 z-20 pointer-events-none">
          {blobs.map(b => {
             const pos = ((b.value - min) / (max - min)) * 100;
             const isActive = Math.abs(value - b.value) < 10;
             const isPassed = value >= b.value;
             return (
               <div 
                 key={b.label} 
                 className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center -translate-x-1/2 pointer-events-auto cursor-pointer"
                 style={{ left: `${pos}%` }}
                 onClick={(e) => { e.stopPropagation(); !disabled && onChange(b.value); }}
               >
                 <div className={`w-4 h-4 rounded-full border-2 transform transition-all duration-300 ${
                   isActive 
                     ? 'bg-primary border-primary scale-125 shadow-lg shadow-primary/30' 
                     : isPassed 
                       ? 'bg-primary/40 border-primary/60' 
                       : 'bg-surface border-outline-variant hover:border-on-surface-variant'
                 }`}>
                    {isActive && <div className="absolute inset-1 bg-surface rounded-full shadow-inner animate-in zoom-in-50" />}
                 </div>
                 <span className={`absolute top-6 text-[9px] font-mono uppercase whitespace-nowrap transition-colors ${
                   isActive ? 'text-primary font-bold' : 'text-on-surface-variant'
                 }`}>
                   {b.label}
                 </span>
               </div>
             );
          })}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={10}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          disabled={disabled}
          className="w-full h-12 bg-transparent appearance-none cursor-pointer relative z-10 opacity-0"
        />
      </div>
    </div>
  );
};

const RejectActionCard = ({ 
  id, label, icon: Icon, desc, active, onClick, disabled 
}: { 
  id: string; label: string; icon: any; desc: string; 
  active: boolean; onClick: () => void; disabled: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border transition-all duration-300 ${active ? 'bg-surface-highest/50 border-primary shadow-lg shadow-primary/5' : 'bg-surface-low border-outline-variant hover:border-on-surface-variant/50'}`}>
      <button
        disabled={disabled}
        onClick={onClick}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center space-x-4">
          <div className={`w-10 h-10 flex items-center justify-center transition-colors ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
            <Icon size={20} />
          </div>
          <div>
            <div className={`text-sm font-bold font-mono uppercase tracking-wider ${active ? 'text-primary' : 'text-on-surface'}`}>{label}</div>
            <div className="text-[10px] text-on-surface-variant font-mono uppercase opacity-60">Protocol {id.replace('_', ' ')}</div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {active && <FiCheckCircle className="text-primary" />}
          <div 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className={`p-1 hover:bg-surface-highest rounded-full transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          >
            <FiChevronDown className="text-on-surface-variant" />
          </div>
        </div>
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
          <div className="pt-3 border-t border-outline-variant/30 text-[11px] font-mono leading-relaxed text-on-surface-variant uppercase">
            {desc}
          </div>
        </div>
      )}
    </div>
  );
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
    standard: { action: 'sell_market', price_override: 3000 },
    premium: { action: 'sell_premium', price_override: 4800 },
  });
  const [unitsToAssemble, setUnitsToAssemble] = useState<number | null>(null);
  
  const [projection, setProjection] = useState<{
    projected_distribution: number[];
    bottleneck_component: string;
    max_possible: number;
  } | null>(null);
  const [loadingProjection, setLoadingProjection] = useState(false);

  const [baselineDecisions, setBaselineDecisions] = useState<typeof decisions | null>(null);
  const [baselineUnits, setBaselineUnits] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [qrThresholds, setQrThresholds] = useState({ qr_hard: 30, qr_soft: 60, qr_premium: 85 });
  const [standardPrices, setStandardPrices] = useState<StandardPrices | null>(null);

  const isSalesOpen = phase === 'sales_open';
  const canSeeSummary = ['backroom', 'game_over'].includes(phase);

  useEffect(() => {
    fetchInventory().catch(() => {});
    teamApi.getSales().then((data: any) => {
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

        if (data.qr_hard !== undefined) {
          setQrThresholds({
            qr_hard: data.qr_hard,
            qr_soft: data.qr_soft,
            qr_premium: data.qr_premium
          });
        }
      }
    }).catch(() => {});

    teamApi.getSalesPrices().then(setStandardPrices).catch(() => {});

    if (canSeeSummary) {
      fetchAllSummaries(phase);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, canSeeSummary]);

  // Calculate Max Assembly based on bottleneck component
  const maxAssembly = useMemo(() => {
    if (!components || components.length === 0) return 0;
    // Fix: use fin_stock_total instead of finished_stock array
    return Math.min(...components.map(c => c.fin_stock_total || 0));
  }, [components]);

  // Bottleneck component identification
  const bottleneckInfo = useMemo(() => {
    if (!components || components.length === 0) return null;
    // Fix: sort by fin_stock_total
    const sorted = [...components].sort((a, b) => (a.fin_stock_total || 0) - (b.fin_stock_total || 0));
    return sorted[0];
  }, [components]);

  const currentUnitsToAssemble = unitsToAssemble === null ? maxAssembly : unitsToAssemble;

  // Debounced projection fetch
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (currentUnitsToAssemble > 0) {
        setLoadingProjection(true);
        try {
          const data = await teamApi.projectSalesAssembly(currentUnitsToAssemble);
          setProjection(data);
        } catch (e) {
          console.error("Projection failed", e);
        } finally {
          setLoadingProjection(false);
        }
      } else {
        setProjection(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [currentUnitsToAssemble]);

  // Classify projection into tiers
  const projectedTierCounts = useMemo(() => {
    const counts: Record<TierKey, number> = { reject: 0, substandard: 0, standard: 0, premium: 0 };
    if (!projection?.projected_distribution) return counts;

    const dist = projection.projected_distribution;
    const { qr_hard, qr_soft, qr_premium } = qrThresholds;

    for (let g = 1; g <= 100; g++) {
      const n = dist[g] || 0;
      if (n === 0) continue;
      if (g < qr_hard) counts.reject += n;
      else if (g < qr_soft) counts.substandard += n;
      else if (g < qr_premium) counts.standard += n;
      else counts.premium += n;
    }
    return counts;
  }, [projection, qrThresholds]);

  const getTierCount = (tier: TierKey) => {
    const current = droneBreakdown[tier] || 0;
    const projected = projectedTierCounts[tier] || 0;
    return current + projected;
  };

  const estimateByTier = (tier: TierKey) => {
    const count = getTierCount(tier);
    if (count <= 0) return 0;
    
    const d = decisions[tier];
    if (d.action === 'hold') return 0;
    
    const p = standardPrices || { 
      scrap: 200, rework: 400, black_market: 600, substandard: 1400, standard: 3000, premium: 4800 
    };

    if (d.action === 'scrap') return count * p.scrap;
    if (d.action === 'rework') return count * p.rework;
    if (d.action === 'black_market') return count * p.black_market;
    
    // For selling actions (market, premium, discounted), use override or mapped standard price
    let effectivePrice = d.price_override;
    if (effectivePrice === null || effectivePrice === undefined) {
      if (d.action === 'sell_premium') effectivePrice = p.premium;
      else if (d.action === 'sell_discounted') effectivePrice = p.substandard;
      else effectivePrice = p.standard;
    }

    return count * effectivePrice;
  };

  const totalEstimate = useMemo(
    () => (['reject', 'substandard', 'standard', 'premium'] as TierKey[]).reduce((sum, t) => sum + estimateByTier(t), 0),
    [decisions, droneBreakdown, projectedTierCounts, standardPrices]
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

  const renderProjectedDistribution = () => {
    if (loadingProjection) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3 opacity-50 bg-surface-lowest/10 border border-dashed border-outline-variant rounded-sm min-h-[120px]">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-[10px] font-mono text-on-surface-variant uppercase tracking-[0.2em]">Simulating Assembly...</div>
        </div>
      );
    }

    if (!projection) {
      return (
        <div className="flex-1 flex items-center justify-center bg-surface-lowest/10 border border-dashed border-outline-variant rounded-sm min-h-[120px]">
          <div className="text-[10px] font-mono text-on-surface-variant uppercase tracking-[0.2em]">Adjust target to view quality projection</div>
        </div>
      );
    }

    const { projected_distribution } = projection;
    const deciles = Array(25).fill(0);
    for (let i = 1; i <= 100; i++) {
      const idx = Math.min(24, Math.floor((i - 1) / 4));
      deciles[idx] += projected_distribution[i] || 0;
    }
    const maxVal = Math.max(...deciles, 1);

    return (
      <div className="flex-1 flex flex-col space-y-2">
        <div className="flex justify-between items-center text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">
          <span>Projected Grade Distribution</span>
          <span className="text-secondary font-bold">Stochastic Simulation (n={currentUnitsToAssemble})</span>
        </div>
        
        <div className="p-2 border border-secondary/30 bg-secondary/5 rounded-sm flex items-center space-x-2 mb-2">
          <FiAlertTriangle className="text-secondary flex-shrink-0" size={12} />
          <p className="text-[10px] font-mono leading-tight text-on-surface-variant uppercase">
            Simulation Result: Actual assembly quality follows a normal distribution and may vary from these projections. <span className="text-secondary">Decisions must be made for all possible outcomes.</span>
          </p>
        </div>

        <div className="flex items-end h-[80px] w-full space-x-[2px] mt-1">
          {deciles.map((val, idx) => (
            <div key={idx} className="flex-1 bg-surface-highest transition-colors flex flex-col justify-end h-full group/col relative">
              <div 
                className="w-full bg-primary/40 group-hover/col:bg-primary transition-all duration-300 rounded-t-[1px]" 
                style={{ height: `${(val / maxVal) * 100}%` }} 
              />
              <div className="absolute bottom-full mb-1 hidden group-hover/col:block bg-surface p-1 text-[10px] z-10 border border-outline-variant whitespace-nowrap shadow-lg font-mono">
                Gr {idx * 4 + 1}-{idx * 4 + 4}: ~{val} drones
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-on-surface-variant font-mono uppercase opacity-60">
          <span>Reject</span>
          <span>Standard</span>
          <span>Premium</span>
        </div>
      </div>
    );
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-shrink-0">
        <div className="lg:col-span-3 bg-surface-low border border-outline-variant p-5 flex flex-col space-y-4">
          <div className="flex justify-between items-center text-base font-semibold font-medium font-mono text-on-surface-variant uppercase tracking-widest">
            <span>Brand Recognition</span>
            <span className="text-primary font-bold">{brandTier}</span>
          </div>
          <div className="text-3xl font-display text-on-surface">{brandScore.toFixed(1)}</div>
          <div className="text-sm font-semibold font-mono text-on-surface-variant leading-relaxed uppercase opacity-80">
            Market share and buyer trust are indexed to your global reputation score.
          </div>
        </div>

        <div className="lg:col-span-9 bg-surface-low border border-outline-variant p-5 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="text-base font-semibold font-medium font-mono text-on-surface-variant uppercase tracking-widest">Assembly Allocation Pipeline</div>
            <div className="flex items-center space-x-6 text-sm font-mono uppercase">
              <div className="text-on-surface-variant">
                Bottleneck: <span className="text-tertiary font-bold">{projection?.bottleneck_component?.replace('_', ' ') || bottleneckInfo?.component?.replace('_', ' ') || 'NONE'}</span>
              </div>
              <div className="text-on-surface-variant">
                Max Capacity: <span className="text-primary font-bold">{maxAssembly} Units</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-6">
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
                  <div className="flex justify-between text-[11px] font-bold font-mono text-on-surface-variant pt-2">
                    <span>ZERO SOURCE</span>
                    <span>TARGET: {currentUnitsToAssemble}</span>
                    <span>MAX PIPELINE</span>
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
                    className="w-full bg-surface-highest border border-outline-variant p-2 font-mono text-3xl font-bold text-primary text-center focus:border-primary transition-colors outline-none"
                  />
                </div>
              </div>
              
              {bottleneckInfo && (
                <div className="p-3 bg-tertiary/10 border-l-2 border-tertiary text-[11px] font-semibold font-mono text-tertiary uppercase flex items-center space-x-2">
                  <FiAlertTriangle />
                  <span>The factor limiting your assembly is the inventory of {bottleneckInfo.component.replace('_', ' ')}.</span>
                </div>
              )}
            </div>

            <div className="bg-surface-highest/20 border border-outline-variant/30 p-4 min-h-[140px] flex flex-col">
              {renderProjectedDistribution()}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden space-x-6 min-h-0">
        {/* SINGLE PANE QUALITY MANAGEMENT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8 pb-32">
          
          {/* 1. REJECT TIER */}
          <section className="bg-surface-low border border-outline-variant p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-sm">
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h2 className="text-3xl font-bold font-display uppercase tracking-tight text-error">Reject Tier</h2>
                  <span className="px-2 py-0.5 bg-error/10 text-error text-[10px] font-mono font-bold uppercase tracking-widest border border-error/20 rounded-full">Protocol Grade 0</span>
                </div>
                <p className="text-sm font-semibold font-mono text-on-surface-variant uppercase tracking-wider">
                  Current Pipeline: <span className="text-on-surface">{getTierCount('reject')} Units</span> Detected
                </p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-mono text-on-surface-variant uppercase mb-1">Potential Recovery</span>
                <div className="text-3xl font-display text-error">${estimateByTier('reject').toLocaleString()}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: 'scrap', label: 'Industrial Scrap', icon: FiAlertTriangle, desc: 'Immediate physical destruction of reject units. Recovers raw materials ($200/unit) with zero discovery risk.' },
                { id: 'rework', label: 'Factory Rework', icon: FiTrendingUp, desc: 'Disassemble and salvage standard components ($400/unit). High efficiency but consumes minor facility bandwidth.' },
                { id: 'hold', label: 'Inventory Hold', icon: FiPackage, desc: 'Store units in the overflow buffer ($0/unit). Useful for future rework or delayed liquidation strategy.' },
                { id: 'black_market', label: 'Black Market Sale', icon: FiZap, desc: 'Clandestine liquidation via unauthorized channels ($600/unit). WARNING: High discovery risk may lead to massive brand damage and state penalties.' },
              ].map(a => (
                <RejectActionCard 
                  key={a.id}
                  id={a.id}
                  label={a.label}
                  icon={a.icon}
                  desc={a.desc}
                  active={decisions.reject.action === a.id}
                  disabled={!isSalesOpen}
                  onClick={() => setDecisions(s => ({ ...s, reject: { ...s.reject, action: a.id as SalesAction } }))}
                />
              ))}
            </div>
          </section>

          {/* 2. SUBSTANDARD / STANDARD / PREMIUM TIERS */}
          {(['substandard', 'standard', 'premium'] as TierKey[]).map((tier) => {
             const count = getTierCount(tier);
             const tierColor = tier === 'premium' ? 'text-secondary' : tier === 'standard' ? 'text-primary' : 'text-on-surface-variant';
             const tierBg = tier === 'premium' ? 'bg-secondary/5 border-secondary/20' : tier === 'standard' ? 'bg-primary/5 border-primary/20' : 'bg-surface-low border-outline-variant';

             return (
               <section key={tier} className={`${tierBg} border p-8 animate-in fade-in slide-in-from-bottom-4 duration-700 rounded-sm`}>
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <div className="flex items-center space-x-3 mb-2">
                        <h2 className={`text-3xl font-bold font-display uppercase tracking-tight ${tierColor}`}>{tier} Tier</h2>
                        <span className={`px-2 py-0.5 border rounded-full text-[10px] font-mono font-bold uppercase tracking-widest ${tierColor} opacity-70`}>Quality Threshold Met</span>
                      </div>
                      <p className="text-sm font-semibold font-mono text-on-surface-variant uppercase tracking-wider">
                        Ready For Dispatch: <span className="text-on-surface">{count} Units</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase mb-1">Projected Tier Revenue</span>
                      <div className={`text-3xl font-display ${tierColor}`}>${estimateByTier(tier).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                    <div className="lg:col-span-7">
                      {standardPrices && (
                        <PriceSlider 
                          label={tier}
                          value={decisions[tier].price_override ?? (tier === 'premium' ? standardPrices.premium : tier === 'substandard' ? standardPrices.substandard : standardPrices.standard)}
                          min={1}
                          max={Math.round((standardPrices?.premium || 4800) * 1.5)}
                          standardPrices={standardPrices}
                          disabled={!isSalesOpen}
                          onChange={(val) => setDecisions(s => ({ ...s, [tier]: { ...s[tier], price_override: val, action: 'sell_market' as SalesAction } }))}
                        />
                      )}
                    </div>
                    <div className="lg:col-span-5 space-y-4">
                      <div className="bg-surface p-5 border border-outline-variant/30 space-y-4 shadow-inner">
                         <div className="flex items-center space-x-2 text-[10px] font-mono text-on-surface-variant uppercase tracking-widest font-bold border-b border-outline-variant/20 pb-2">
                            <FiDollarSign className={tierColor} />
                            <span>Revenue Architecture</span>
                         </div>
                         <div className="flex justify-between items-center text-xs font-mono uppercase">
                            <span className="opacity-60 text-[10px]">Unit Valuation</span>
                            <span className="text-on-surface font-bold text-lg">
                              ${(decisions[tier].price_override || (standardPrices ? (tier === 'premium' ? standardPrices.premium : tier === 'substandard' ? standardPrices.substandard : standardPrices.standard) : 0)).toLocaleString()}
                            </span>
                         </div>
                         <div className="flex justify-between items-center text-xs font-mono uppercase">
                            <span className="opacity-60 text-[10px]">Efficiency Delta</span>
                            <span className="text-secondary">+12.4% vs Baseline</span>
                         </div>
                      </div>

                      <div className="flex space-x-2">
                        <button 
                          onClick={() => setDecisions(s => ({ ...s, [tier]: { ...s[tier], action: 'hold' } }))}
                          className={`flex-1 py-3 px-3 border font-mono text-[10px] font-bold uppercase tracking-widest transition-all ${decisions[tier].action === 'hold' ? 'bg-on-surface text-surface border-on-surface' : 'bg-transparent border-outline-variant text-on-surface-variant hover:border-on-surface'}`}
                        >
                          Hold Inventory
                        </button>
                        <button 
                          onClick={() => setDecisions(s => ({ ...s, [tier]: { ...s[tier], action: 'scrap' } }))}
                          className={`flex-1 py-3 px-3 border font-mono text-[10px] font-bold uppercase tracking-widest transition-all ${decisions[tier].action === 'scrap' ? 'bg-error text-surface border-error' : 'bg-transparent border-outline-variant text-on-surface-variant hover:border-error text-error'}`}
                        >
                          Liquidate Scrub
                        </button>
                      </div>
                    </div>
                  </div>
               </section>
             );
          })}

          <div className="p-6 bg-secondary/5 border border-secondary/20 flex items-start space-x-4 rounded-sm">
            <FiAlertTriangle className="text-secondary mt-1 flex-shrink-0" size={20} />
            <div className="space-y-1">
              <h4 className="text-xs font-bold font-mono text-secondary uppercase tracking-widest">Global Market Intelligence</h4>
              <p className="text-[11px] font-mono text-on-surface-variant leading-relaxed uppercase">
                Market factions are rational independent actors. They will prioritize the <span className="text-secondary font-bold underline">cheapest option</span> that meets their minimum quality floor. Choosing prices significantly above standard blobs may lead to zero conversion if competitors undercut your valuation.
              </p>
            </div>
          </div>
        </div>

        {/* COCKPIT PANEL (RIGHT - STICKY-LIKE) */}
        <div className="w-[30%] flex flex-col space-y-4">
          <div className="bg-surface-low border border-outline-variant p-6 flex-1 flex flex-col shadow-2xl shadow-black/20 rounded-sm">
            <h2 className="text-base font-semibold font-mono text-on-surface-variant uppercase tracking-[0.25em] border-b border-outline-variant pb-4 mb-8 flex items-center justify-between">
              <span>Command Center</span>
              <span className="text-[10px] opacity-40">ALPHA-9</span>
            </h2>

            <div className="space-y-8 flex-1">
              <div className="space-y-4">
                <div className="flex justify-between items-center group">
                  <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest group-hover:text-primary transition-colors">Target Throttling</span>
                  <span className="text-base font-mono text-on-surface">{currentUnitsToAssemble} Units</span>
                </div>
                <div className="flex justify-between items-center group">
                  <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest group-hover:text-primary transition-colors">Projected Throughput</span>
                  <span className="text-base font-mono text-on-surface">100%</span>
                </div>
                
                <div className="pt-6 border-t border-outline-variant/30">
                   <div className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-2">Cycle Revenue Target</div>
                   <div className="text-5xl font-display text-primary tracking-tighter transition-all hover:scale-105 origin-left">
                     <span className="text-2xl mr-1 opacity-50 font-bold">$</span>
                     {totalEstimate.toLocaleString()}
                   </div>
                </div>
              </div>

              <div className="bg-surface-highest/10 border border-outline-variant p-5 space-y-4 text-center rounded-sm">
                <div className="flex justify-center text-primary mb-2">
                  <FiDollarSign size={24} />
                </div>
                <p className="text-[11px] font-mono text-on-surface-variant leading-relaxed uppercase font-bold px-2 tracking-wide">
                  Projected revenue is indexed to current market liquidity and faction appetite.
                </p>
              </div>
            </div>

            <div className="space-y-4 mt-auto pt-8">
              {lastSavedAt && (
                <div className="flex items-center justify-center space-x-2 text-[10px] font-mono text-secondary animate-in fade-in fill-mode-both duration-500">
                  <FiCheckCircle />
                  <span className="uppercase tracking-widest font-bold">Vault Synchronized: {lastSavedAt}</span>
                </div>
              )}
              <SendDecisionsButton onClick={onSubmit} disabled={!isSalesOpen} loading={saving} />
              <div className="text-[9px] font-mono text-on-surface-variant text-center opacity-40 uppercase tracking-[0.2em] mt-2">
                Protocol Lock: Final Resolution Imminent
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
