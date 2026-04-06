import { useEffect, useState, useMemo } from 'react';
import { useGameStore } from '../store';
import { useEventsStore } from '../store/useEventsStore';
import {
  ProcurementCard,
  ProductionCard,
  SalesCard,
  PendingCard,
} from '../components/PhaseSummaries';
import {
  FiTrendingUp,
  FiChevronDown,
  FiChevronUp,
  FiAlertTriangle,
  FiCheckCircle,
  FiShield,
  FiPackage,
  FiSettings,
} from 'react-icons/fi';

// ─────────────────────────────────────────────────────────────────────────────
// News & Intelligence Section
// ─────────────────────────────────────────────────────────────────────────────
const IntelSection = ({ hasSabotage }: { hasSabotage: boolean }) => (
  <div className={`border p-5 mb-6 transition-all ${
    hasSabotage 
      ? 'bg-error/5 border-error/30 shadow-[0_0_20px_rgba(var(--error-rgb),0.05)]' 
      : 'bg-surface-low border-outline-variant'
  }`}>
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-semibold font-medium font-mono text-primary uppercase tracking-[0.2em] flex items-center space-x-2">
        <FiShield size={14} className={hasSabotage ? 'text-error' : 'text-primary'} />
        <span>Intelligence & Reporting Protocol</span>
      </h2>
      {hasSabotage && (
        <div className="flex items-center space-x-2 bg-error/20 px-2 py-1 rounded text-base font-bold text-error animate-pulse">
          <FiAlertTriangle size={10} />
          <span>SECURITY BREACH DETECTED</span>
        </div>
      )}
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-base font-semibold font-medium font-mono leading-relaxed">
      <div className="space-y-2">
        <div className="text-on-surface-variant uppercase text-base font-semibold font-medium tracking-widest border-b border-outline-variant/30 pb-1">Counter-Intelligence Rule</div>
        <p className="text-on-surface">
          Sabotage is an offline mechanic. If your reports show "Sabotaged" units, another team or the organiser has interfered with your supply chain.
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-on-surface-variant uppercase text-base font-semibold font-medium tracking-widest border-b border-outline-variant/30 pb-1">Restitution Protocol</div>
        <p className="text-on-surface">
          Correctly identify the aggressor team to the Organiser during the <span className="text-primary font-bold">Backroom Phase</span>. 
          Validated reports result in <span className="text-primary">full compensation</span> for your losses and <span className="text-error font-bold">heavy fines</span> for the aggressor.
        </p>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Events Page
// ─────────────────────────────────────────────────────────────────────────────
export const Events = () => {
  const { phase, cycleNumber } = useGameStore();
  
  const procurement = useEventsStore(s => s.procurement);
  const production = useEventsStore(s => s.production);
  const sales = useEventsStore(s => s.sales);
  const loadingProcurement = useEventsStore(s => s.loadingProcurement);
  const loadingProduction = useEventsStore(s => s.loadingProduction);
  const loadingSales = useEventsStore(s => s.loadingSales);
  const fetchAll = useEventsStore(s => s.fetchAll);

  const canSeeProcurement = ['production_open', 'sales_open', 'backroom', 'game_over'].includes(phase);
  const canSeeProduction  = ['sales_open', 'backroom', 'game_over'].includes(phase);
  const canSeeSales       = ['backroom', 'game_over'].includes(phase);

  useEffect(() => {
    fetchAll(phase);
  }, [phase, fetchAll]);

  const hasSabotage = useMemo(() => {
    if (!procurement) return false;
    return Object.values(procurement.per_component).some(c => c.event === 'sabotaged');
  }, [procurement]);

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-start flex-shrink-0">
        <div>
          <h1 className="font-display text-4xl uppercase tracking-tighter">EVENTS HUB</h1>
          <div className="text-on-surface-variant font-mono text-base font-semibold font-medium mt-1 tracking-widest flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>Facility Cycle {cycleNumber} · Status Reports Classified</span>
          </div>
        </div>
        <button
          onClick={() => fetchAll(phase)}
          className="flex items-center space-x-2 text-base font-semibold font-medium font-mono text-on-surface-variant border border-outline-variant px-4 py-2 hover:bg-surface-highest hover:text-on-surface transition-all uppercase tracking-widest"
        >
          <FiCheckCircle size={12} />
          <span>Sync Data</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-8 custom-scrollbar">
        {/* Intelligence Overlay */}
        <IntelSection hasSabotage={hasSabotage} />

        <div className="space-y-4">
          <h2 className="text-base font-semibold font-medium font-mono text-on-surface-variant uppercase tracking-[0.3em] pl-1">Resolution Reports</h2>
          
          {/* Procurement */}
          {canSeeProcurement ? (
            loadingProcurement ? (
              <div className="text-base font-semibold font-medium font-mono text-on-surface-variant animate-pulse px-5 py-8 border border-outline-variant/20 bg-surface-low items-center justify-center flex">
                Decrypting procurement summary...
              </div>
            ) : procurement ? (
              <ProcurementCard data={procurement} />
            ) : (
              <div className="text-base font-semibold font-medium font-mono text-on-surface-variant px-5 py-8 border border-outline-variant/20 bg-surface-low opacity-60">
                Procurement summary payload not found for this cycle.
              </div>
            )
          ) : (
            <PendingCard label="Procurement Resolution" icon={<FiPackage size={14} />} />
          )}

          {/* Production */}
          {canSeeProduction ? (
            loadingProduction ? (
              <div className="text-base font-semibold font-medium font-mono text-on-surface-variant animate-pulse px-5 py-8 border border-outline-variant/20 bg-surface-low items-center justify-center flex">
                Decrypting production summary...
              </div>
            ) : production ? (
              <ProductionCard data={production} />
            ) : (
              <div className="text-base font-semibold font-medium font-mono text-on-surface-variant px-5 py-8 border border-outline-variant/20 bg-surface-low opacity-60">
                Production summary payload not found for this cycle.
              </div>
            )
          ) : (
            <PendingCard label="Production Resolution" icon={<FiSettings size={14} />} />
          )}

          {/* Sales */}
          {canSeeSales ? (
            loadingSales ? (
              <div className="text-base font-semibold font-medium font-mono text-on-surface-variant animate-pulse px-5 py-8 border border-outline-variant/20 bg-surface-low items-center justify-center flex">
                Decrypting sales summary...
              </div>
            ) : sales ? (
              <SalesCard data={sales} />
            ) : (
              <div className="text-base font-semibold font-medium font-mono text-on-surface-variant px-5 py-8 border border-outline-variant/20 bg-surface-low opacity-60">
                Sales summary payload not found for this cycle.
              </div>
            )
          ) : (
            <PendingCard label="Sales Resolution" icon={<FiTrendingUp size={14} />} />
          )}

          {/* Empty state */}
          {phase === 'procurement_open' && !loadingProcurement && !procurement && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center border border-dashed border-outline-variant">
              <div className="text-5xl opacity-20 filter grayscale">📋</div>
              <div className="space-y-1">
                <div className="font-display text-base font-semibold uppercase tracking-[0.2em] text-on-surface">No Cycle Data Yet</div>
                <div className="text-base font-semibold font-medium font-mono text-on-surface-variant opacity-60 max-w-xs mx-auto">
                  Resolution reports are compiled once the procurement phase concludes.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
