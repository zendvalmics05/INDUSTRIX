import { useEffect, useState, useMemo } from 'react';
import { useGameStore, useInventoryStore } from '../store';
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
  FiLock,
  FiEye,
  FiZap,
  FiClock,
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
      <h2 className="text-sm font-medium font-mono text-primary uppercase tracking-[0.2em] flex items-center space-x-2">
        <FiShield size={14} className={hasSabotage ? 'text-error' : 'text-primary'} />
        <span>Intelligence & Reporting Protocol</span>
      </h2>
      {hasSabotage && (
        <div className="flex items-center space-x-2 bg-error/20 px-2 py-1 rounded text-[10px] font-bold text-error animate-pulse">
          <FiAlertTriangle size={10} />
          <span>SECURITY BREACH DETECTED</span>
        </div>
      )}
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono leading-relaxed">
      <div className="space-y-2">
        <div className="text-on-surface-variant uppercase text-[10px] tracking-widest border-b border-outline-variant/30 pb-1">Counter-Intelligence Rule</div>
        <p className="text-on-surface">
          Sabotage is an offline mechanic. If your reports show "Sabotaged" units, another team or the organiser has interfered with your supply chain.
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-on-surface-variant uppercase text-[10px] tracking-widest border-b border-outline-variant/30 pb-1">Restitution Protocol</div>
        <p className="text-on-surface">
          Correctly identify the aggressor team to the Organiser during the <span className="text-primary font-bold">Backroom Phase</span>. 
          Validated reports result in <span className="text-primary">full compensation</span> for your losses and <span className="text-error font-bold">heavy fines</span> for the aggressor.
        </p>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Notification Item
// ─────────────────────────────────────────────────────────────────────────────
const NotificationItem = ({ notification }: { notification: any }) => {
  const getColors = () => {
    switch (notification.severity) {
      case 'error': return 'border-error/30 bg-error/5 text-error shadow-[inset_0_0_10px_rgba(var(--error-rgb),0.05)]';
      case 'warning': return 'border-warning/30 bg-warning/5 text-warning shadow-[inset_0_0_10px_rgba(var(--warning-rgb),0.05)]';
      case 'success': return 'border-success/40 bg-success/5 text-success shadow-[inset_0_0_10px_rgba(var(--success-rgb),0.05)]';
      default: return 'border-outline-variant bg-surface-low text-on-surface';
    }
  };

  return (
    <div className={`border p-4 mb-3 rounded-sm transition-all group hover:scale-[1.02] active:scale-[0.98] ${getColors()}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2 overflow-hidden">
          {notification.type === 'sabotage' && <FiAlertTriangle size={14} className="animate-bounce" />}
          {notification.type === 'discovery_self' && <FiLock size={14} />}
          {notification.type === 'discovery_thwarted' && <FiShield size={14} className="text-success" />}
          {notification.type === 'benefit' && <FiCheckCircle size={14} className="text-success" />}
          <span className="font-display text-sm uppercase tracking-tight truncate font-bold">{notification.title}</span>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 ml-2">
          <span className="font-mono text-[9px] uppercase tracking-widest opacity-40">TIMESTAMP</span>
          <span className="font-mono text-[10px] font-bold">C{notification.cycle_number}·PRTC-EX</span>
        </div>
      </div>
      <p className="text-xs opacity-90 leading-tight mb-3 font-mono">{notification.message}</p>
      
      {notification.discovery_code && (
        <div className="mt-2 flex flex-col space-y-1 bg-black/40 p-2 rounded border border-white/10 group-hover:border-error/30 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FiEye size={12} className="opacity-60" />
              <span className="text-[9px] uppercase tracking-widest opacity-60">Trace ID:</span>
              <span className="font-mono text-xs font-bold tracking-[0.2em] text-white selection:bg-error selection:text-white">{notification.discovery_code}</span>
            </div>
          </div>
          <span className="text-[8px] opacity-40 italic uppercase tracking-tighter">Submit to Terminal for Restitution</span>
        </div>
      )}

      {notification.payload && Object.keys(notification.payload).length > 0 && notification.type !== 'sabotage' && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {Object.entries(notification.payload).map(([k, v]) => (
            <div key={k} className="bg-white/5 px-2 py-1 rounded flex flex-col">
              <span className="text-[8px] uppercase opacity-40 tracking-widest truncate">{k.replace(/_/g, ' ')}</span>
              <span className="text-[10px] font-mono font-bold truncate">
                {typeof v === 'number' ? v.toLocaleString() : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Buy Intel Card
// ─────────────────────────────────────────────────────────────────────────────
const BuyIntelCard = () => {
  const status = useEventsStore(s => s.backroomStatus);
  const buyIntel = useEventsStore(s => s.buyIntel);
  const loading = useEventsStore(s => s.loadingNotifications);
  const funds = useInventoryStore(s => s.funds);
  const [confirming, setConfirming] = useState(false);

  if (!status) return null;

  return (
    <div className={`border p-5 mb-6 transition-all relative overflow-hidden ${
      status.discovery_boost_active
        ? 'bg-primary/5 border-primary/40 shadow-[0_0_30px_rgba(var(--primary-rgb),0.1)]'
        : 'bg-surface-low border-outline-variant hover:border-primary/40'
    }`}>
      {status.discovery_boost_active && (
        <div className="absolute top-0 right-0 p-1">
          <div className="w-1 h-1 bg-primary rounded-full animate-ping" />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium font-mono text-on-surface uppercase tracking-[0.2em] flex items-center space-x-2">
          <FiZap size={14} className={status.discovery_boost_active ? 'text-primary' : 'text-on-surface-variant'} />
          <span>Surveillance Boost</span>
        </h2>
        {status.discovery_boost_active ? (
          <div className="bg-primary/20 text-primary border border-primary/40 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest flex items-center space-x-1">
            <span className="w-1 h-1 bg-primary rounded-full animate-pulse" />
            <span>ENCRYPTED</span>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-primary font-bold uppercase">{status.boost_cost.toLocaleString()} CU</span>
        )}
      </div>

      <p className="text-xs font-mono opacity-70 mb-4 leading-tight">
        Activate emergency government surveillance to increase the discovery probability of any backroom deal targeting your facility to <span className="text-primary font-bold">{status.boost_probability * 100}%</span>.
      </p>

      {status.discovery_boost_active ? (
        <div className="flex items-center space-x-2 text-[9px] font-mono text-primary/80 uppercase tracking-widest">
          <FiShield size={10} />
          <span>Facility Hardened against Sabotage</span>
        </div>
      ) : (
        <button
          onClick={() => confirming ? (buyIntel(), setConfirming(false)) : setConfirming(true)}
          onMouseLeave={() => setConfirming(false)}
          disabled={loading || funds < status.boost_cost}
          className={`w-full py-3 font-display text-sm uppercase tracking-widest transition-all border ${
            funds < status.boost_cost
              ? 'border-outline-variant text-on-surface-variant opacity-40 cursor-not-allowed'
              : confirming 
                ? 'bg-primary text-on-primary border-primary animate-pulse'
                : 'border-primary text-primary hover:bg-primary/10 hover:shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]'
          }`}
        >
          {funds < status.boost_cost 
            ? 'Insufficient Liquidity' 
            : confirming 
              ? 'Confirm Authorization?' 
              : 'Authorize Surveillance'}
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Events Page
// ─────────────────────────────────────────────────────────────────────────────
export const Events = () => {
  const { phase, cycleNumber } = useGameStore();
  
  const procurement = useEventsStore(s => s.procurement);
  const production = useEventsStore(s => s.production);
  const sales = useEventsStore(s => s.sales);
  const notifications = useEventsStore(s => s.notifications);
  const loadingProcurement = useEventsStore(s => s.loadingProcurement);
  const loadingProduction = useEventsStore(s => s.loadingProduction);
  const loadingSales = useEventsStore(s => s.loadingSales);
  const loadingNotifications = useEventsStore(s => s.loadingNotifications);
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
          <div className="text-on-surface-variant font-mono text-[10px] mt-1 tracking-widest flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>Cycle {cycleNumber} · Intelligence Stream Active</span>
          </div>
        </div>
        <button
          onClick={() => fetchAll(phase)}
          className="flex items-center space-x-2 text-[10px] font-mono text-on-surface-variant border border-outline-variant px-4 py-2 hover:bg-surface-highest hover:text-on-surface transition-all uppercase tracking-widest group"
        >
          <FiZap size={10} className="group-hover:text-primary transition-colors" />
          <span>Sync Feed</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
        {/* Main Feed */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <FiPackage className="text-on-surface-variant/40" size={14} />
              <h2 className="text-[10px] font-mono text-on-surface-variant uppercase tracking-[0.3em]">Resolution Reports</h2>
              <div className="flex-1 h-[1px] bg-outline-variant/30" />
            </div>
            
            {/* Procurement */}
            {canSeeProcurement ? (
              loadingProcurement ? (
                <div className="text-[10px] font-mono text-on-surface-variant animate-pulse px-5 py-8 border border-outline-variant/20 bg-surface-low items-center justify-center flex">
                  Decrypting procurement summary...
                </div>
              ) : procurement ? (
                <ProcurementCard data={procurement} />
              ) : (
                <div className="text-[10px] font-mono text-on-surface-variant px-5 py-8 border border-outline-variant/20 bg-surface-low opacity-60">
                  Procurement summary payload not found.
                </div>
              )
            ) : (
              <PendingCard label="Procurement Resolution" icon={<FiPackage size={14} />} />
            )}

            {/* Production */}
            {canSeeProduction ? (
              loadingProduction ? (
                <div className="text-[10px] font-mono text-on-surface-variant animate-pulse px-5 py-8 border border-outline-variant/20 bg-surface-low items-center justify-center flex">
                  Decrypting production summary...
                </div>
              ) : production ? (
                <ProductionCard data={production} />
              ) : (
                <div className="text-[10px] font-mono text-on-surface-variant px-5 py-8 border border-outline-variant/20 bg-surface-low opacity-60">
                  Production summary payload not found.
                </div>
              )
            ) : (
              <PendingCard label="Production Resolution" icon={<FiSettings size={14} />} />
            )}

            {/* Sales */}
            {canSeeSales ? (
              loadingSales ? (
                <div className="text-[10px] font-mono text-on-surface-variant animate-pulse px-5 py-8 border border-outline-variant/20 bg-surface-low items-center justify-center flex">
                  Decrypting sales summary...
                </div>
              ) : sales ? (
                <SalesCard data={sales} />
              ) : (
                <div className="text-[10px] font-mono text-on-surface-variant px-5 py-8 border border-outline-variant/20 bg-surface-low opacity-60">
                  Sales summary payload not found.
                </div>
              )
            ) : (
              <PendingCard label="Sales Resolution" icon={<FiTrendingUp size={14} />} />
            )}
          </div>
        </div>

        {/* Intelligence Sidebar */}
        <div className="w-full md:w-80 flex-shrink-0 flex flex-col overflow-hidden bg-surface-low/30 p-1 border-l border-outline-variant/20">
          <div className="flex-1 overflow-y-auto custom-scrollbar pb-8 px-2">
            <h2 className="text-[10px] font-mono text-on-surface-variant uppercase tracking-[0.3em] pl-1 mb-4 flex items-center space-x-2">
              <FiShield size={10} />
              <span>Intelligence Bureau</span>
            </h2>
            
            <IntelSection hasSabotage={hasSabotage} />
            
            {phase === 'backroom' && <BuyIntelCard />}

            <div className="space-y-1">
              <div className="flex items-center justify-between pl-1 mb-3">
                <h3 className="text-[10px] font-mono text-on-surface-variant uppercase tracking-[0.2em] flex items-center space-x-2">
                  <FiClock size={10} />
                  <span>Facility Log</span>
                </h3>
                <span className="text-[8px] font-mono opacity-40 uppercase">Live Feed</span>
              </div>

              {loadingNotifications && notifications.length === 0 ? (
                <div className="p-10 border border-outline-variant/20 bg-surface-low/50 animate-pulse text-[9px] font-mono text-on-surface-variant text-center uppercase tracking-[0.2em] space-y-4">
                  <FiZap className="mx-auto text-primary" size={24} />
                  <p>Initializing Secure Connection...</p>
                </div>
              ) : notifications.length > 0 ? (
                notifications.map(n => <NotificationItem key={n.id} notification={n} />)
              ) : (
                <div className="p-8 border border-dashed border-outline-variant/30 text-center space-y-3 opacity-40 grayscale group hover:grayscale-0 transition-all">
                  <FiLock className="mx-auto" size={24} />
                  <div className="text-[9px] font-mono uppercase tracking-[0.3em]">Encryption Holding · No Threats Detected</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
