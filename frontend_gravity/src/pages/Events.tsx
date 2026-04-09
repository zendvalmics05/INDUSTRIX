import { useEffect, useMemo, useState } from 'react';
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
  <div className={`border p-5 mb-6 transition-all bg-surface-low border-outline-variant`}>
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-medium font-mono text-primary uppercase tracking-[0.2em] flex items-center space-x-2">
        <FiShield size={14} className="text-primary" />
        <span>The Ministry Directorate</span>
      </h2>
    </div>

    <div className="bg-error/5 border border-error/20 p-4 mb-6 shadow-[inset_0_0_20px_rgba(var(--error-rgb),0.05)] text-error opacity-90">
      <p className="text-xs font-mono font-bold uppercase tracking-widest text-center mb-2 flex justify-center items-center space-x-2">
        <FiAlertTriangle size={14} />
        <span>Risk Advisory</span>
        <FiAlertTriangle size={14} />
      </p>
      <p className="text-[11px] font-mono leading-relaxed text-center max-w-2xl mx-auto">
        THE MINISTRY IS NOT YOUR FRIEND. THEY ARE THE MARKET. You may pay them, but you cannot buy them. Tread lightly. You are a small fish in an ocean they own. Every backroom deal or aggressive action carries an inherent risk of discovery and catastrophic fines. The state does not tolerate embarrassment.
      </p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono leading-relaxed">
      <div className="space-y-2">
        <div className="text-on-surface-variant uppercase text-[10px] tracking-widest border-b border-outline-variant/30 pb-1 flex justify-between">
          <span>Counter-Intelligence</span>
          {hasSabotage && <span className="text-error font-bold animate-pulse">BREACH DETECTED</span>}
        </div>
        <p className="text-on-surface">
          Sabotage is an offline mechanic. If your Resolution Reports mandate "Sabotaged" units, another corporation has compromised your supply chain under Ministry cover.
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-on-surface-variant uppercase text-[10px] tracking-widest border-b border-outline-variant/30 pb-1">Restitution Protocol</div>
        <p className="text-on-surface">
          Identify the aggressor to the Directorate during the <span className="text-primary font-bold">Backroom Phase</span>. 
          Validated leads result in <span className="text-success font-bold">full compensation</span> and <span className="text-error font-bold">heavy penalties</span> against the aggressor.
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
          {notification.type === 'intel_report' && <FiEye size={14} className="text-primary animate-pulse" />}
          {notification.type === 'operational_loss' && <FiAlertTriangle size={14} className="text-error" />}
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
                {typeof v === 'object' && v !== null 
                  ? JSON.stringify(v) 
                  : typeof v === 'number' 
                    ? v.toLocaleString() 
                    : String(v)}
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
        Activate custom government security protocols to increase the discovery probability of any backroom deal targeting your facility.
        {status.discovery_boost_active && (
          <span className="block mt-2 text-primary font-bold">CURRENT PROTECTION: {status.boost_probability * 100}%</span>
        )}
      </p>

      {status.discovery_boost_active ? (
        <div className="flex items-center space-x-2 text-[9px] font-mono text-primary/80 uppercase tracking-widest bg-primary/10 p-3 border border-primary/20">
          <FiShield size={10} />
          <span>Security Protocol Active: Hostile Traces Heightened</span>
        </div>
      ) : (
        <div className="border border-outline-variant/30 p-4 text-[10px] font-mono text-center space-y-2 opacity-60">
          <FiLock className="mx-auto mb-1" size={16} />
          <div className="uppercase tracking-widest">Protocol Offline</div>
          <p className="text-[9px] leading-tight">Standard autonomous activation is DISABLED. Negotiate custom protection rates with the Government Liaison in the Backroom.</p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Events Page
// ─────────────────────────────────────────────────────────────────────────────
export const Events = () => {
  const [activeTab, setActiveTab] = useState<'reports' | 'intelligence'>('reports');
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
  const markNotificationsAsViewed = useEventsStore(s => s.markNotificationsAsViewed);

  const canSeeProcurement = ['production_open', 'sales_open', 'backroom', 'game_over'].includes(phase);
  const canSeeProduction  = ['sales_open', 'backroom', 'game_over'].includes(phase);
  const canSeeSales       = ['backroom', 'game_over'].includes(phase);

  useEffect(() => {
    fetchAll(phase);
  }, [phase, fetchAll]);

  useEffect(() => {
    if (notifications.length > 0) {
      markNotificationsAsViewed(notifications.map(n => n.id));
    }
  }, [notifications, markNotificationsAsViewed]);

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

      {/* Tabs Switcher */}
      <div className="flex space-x-4 border-b border-outline-variant/50 sticky top-0 bg-surface z-10 pt-2 pb-px">
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center space-x-2 pb-3 px-2 font-display text-sm tracking-widest uppercase transition-all whitespace-nowrap ${
            activeTab === 'reports'
              ? 'text-primary border-b-2 border-primary'
              : 'text-on-surface-variant hover:text-on-surface border-b-2 border-transparent hover:border-outline-variant'
          }`}
        >
          <FiPackage size={14} />
          <span>Resolution Reports</span>
        </button>
        <button
          onClick={() => setActiveTab('intelligence')}
          className={`flex items-center space-x-2 pb-3 px-2 font-display text-sm tracking-widest uppercase transition-all whitespace-nowrap relative ${
            activeTab === 'intelligence'
              ? 'text-primary border-b-2 border-primary'
              : 'text-on-surface-variant hover:text-on-surface border-b-2 border-transparent hover:border-outline-variant'
          }`}
        >
          <FiShield size={14} />
          <span>Intelligence Bureau</span>
          {hasSabotage && <span className="absolute top-0 -right-2 w-2 h-2 bg-error rounded-full animate-pulse" />}
        </button>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {activeTab === 'reports' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar pb-8 space-y-6 lg:max-w-4xl max-w-full">
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
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar pb-8 px-2 lg:max-w-5xl max-w-full">
            <IntelSection hasSabotage={hasSabotage} />
            
            {phase === 'backroom' && <BuyIntelCard />}

            <div className="space-y-4 mt-8">
              <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2 mb-4">
                <h3 className="text-[10px] font-mono text-on-surface-variant uppercase tracking-[0.2em] flex items-center space-x-2">
                  <FiClock size={10} />
                  <span>Facility Log & Deals</span>
                </h3>
                <span className="text-[8px] font-mono opacity-40 uppercase flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 bg-primary/80 rounded-full animate-ping" />
                  <span>Live Event Feed</span>
                </span>
              </div>

              {loadingNotifications && notifications.length === 0 ? (
                <div className="p-10 border border-outline-variant/20 bg-surface-low/50 animate-pulse text-[9px] font-mono text-on-surface-variant text-center uppercase tracking-[0.2em] space-y-4">
                  <FiZap className="mx-auto text-primary" size={24} />
                  <p>Initializing Secure Connection...</p>
                </div>
              ) : notifications.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                  {notifications.map(n => <NotificationItem key={n.id} notification={n} />)}
                </div>
              ) : (
                <div className="p-12 border border-dashed border-outline-variant/30 text-center space-y-3 opacity-40 grayscale group hover:grayscale-0 transition-all flex flex-col justify-center items-center">
                  <FiLock size={32} />
                  <div className="text-[10px] font-mono uppercase tracking-[0.3em] mt-4">Encryption Holding</div>
                  <p className="text-[8px] font-mono uppercase">No Traces or Threats Detected</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
