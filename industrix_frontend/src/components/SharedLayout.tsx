import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useGameStore } from '../store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MdLogout } from 'react-icons/md';
import { useInventoryStore } from '../store';
import { useNotificationStore } from '../store/useNotificationStore';
import { useEventsStore } from '../store/useEventsStore';
import { teamApi } from '../api';
import { FiPlus, FiAlertCircle, FiDollarSign, FiUsers } from 'react-icons/fi';
import { SecurityAlertOverlay } from './SecurityAlertOverlay';
import { PhaseTimer } from './PhaseTimer';
import { BriefingModal } from './BriefingModal';
import type { CycleBriefingOut } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

export const SharedLayout = () => {
  const { isLoggedIn, phase, cycleNumber, lastSyncTs, connectionOk, logout, pollStatus, phaseOpenedAt, phaseDuration, lastBriefedCycle, setLastBriefedCycle } = useGameStore();
  const { funds, fetchInventory } = useInventoryStore();
  const { notifications, viewedNotificationIds, markNotificationsAsViewed, fetchNotifications, fetchNews, getUnreadCount } = useEventsStore();
  const { toasts, addToast, removeToast } = useNotificationStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [lastPhase, setLastPhase] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(5000);
  const [lastPhaseChangeAt, setLastPhaseChangeAt] = useState<number>(Date.now());
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const negativeFundsToastRef = useRef<boolean>(false);
  const [expandedSideItem, setExpandedSideItem] = useState<string | null>(null);

  const prevFundsRef = useRef<number | null>(null);
  const [fundsAnimClass, setFundsAnimClass] = useState<string>('');

  const { teamName } = useGameStore();
  const [members, setMembers] = useState<any[]>([]);
  const [finances, setFinances] = useState<any>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [briefingData, setBriefingData] = useState<CycleBriefingOut | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);

  const fetchSidebarData = async () => {
    try {
      const f = await teamApi.getFinances();
      setFinances(f);
      const m = await teamApi.getTeamMembers();
      setMembers(m);
      if (f.funds !== prevFundsRef.current && prevFundsRef.current !== null) {
        // funds changes
      }
    } catch (e) { }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    try {
      await teamApi.addTeamMember(newMemberName.trim(), 'Executive');
      setNewMemberName('');
      fetchSidebarData();
    } catch (e) { }
  };

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }

    // Start polling status with dynamic backoff
    const startPolling = () => {
      if (phase === 'game_over') return;
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      pollStatus();
      fetchNotifications();
      fetchNews();
      fetchInventory().catch(() => { });
      fetchSidebarData().catch(() => { });
      intervalRef.current = window.setInterval(() => {
        pollStatus();
        fetchNotifications();
        fetchNews();
        fetchInventory().catch(() => { });
        fetchSidebarData().catch(() => { });
      }, pollIntervalMs) as unknown as number;
    };

    startPolling();
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLoggedIn, navigate, pollStatus, pollIntervalMs, phase]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Backoff after 2 minutes without phase change; reset on change
  useEffect(() => {
    if (lastPhase === null) {
      setLastPhase(phase);
      setLastPhaseChangeAt(Date.now());
      return;
    }
    if (phase !== lastPhase) {
      setLastPhase(phase);
      setLastPhaseChangeAt(Date.now());
      // Reset to 5s polling immediately
      setPollIntervalMs(5000);
      if (lastPhase) {
        addToast(`Phase changed: ${phase.replace('_', ' ')} is now open`, 'info');
      }
    } else {
      const elapsed = Date.now() - lastPhaseChangeAt;
      if (elapsed > 120000 && pollIntervalMs !== 15000) {
        setPollIntervalMs(15000);
      }
    }
  }, [phase, lastPhase, lastPhaseChangeAt, pollIntervalMs]);

  // Keep global funds fresh periodically (no heavy polling)
  useEffect(() => {
    if (isLoggedIn) {
      fetchInventory().catch(() => { });
    }
  }, [isLoggedIn, fetchInventory, phase]);

  useEffect(() => {
    if (funds < 0 && !negativeFundsToastRef.current) {
      addToast('Warning: funds are negative', 'warning');
      negativeFundsToastRef.current = true;
    }
    if (funds >= 0) {
      negativeFundsToastRef.current = false;
    }

    if (prevFundsRef.current !== null && prevFundsRef.current !== funds) {
      const delta = funds - prevFundsRef.current;
      const sign = delta > 0 ? '+' : '';
      addToast(`Funds Update: ${sign}${delta.toLocaleString()} CU`, delta > 0 ? 'success' : 'error');

      setFundsAnimClass(delta > 0
        ? 'text-green-400 font-bold scale-110 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]'
        : 'text-red-400 font-bold scale-110 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]');

      setTimeout(() => {
        setFundsAnimClass('');
      }, 2000);
    }
    prevFundsRef.current = funds;
  }, [funds, addToast]);

  const sabotageNotification = useMemo(() => {
    return notifications.find(n =>
      !viewedNotificationIds.includes(n.id) &&
      n.type === 'operational_loss'
    );
  }, [notifications, viewedNotificationIds]);

  const handleAcknowledgeSabotage = () => {
    if (sabotageNotification) {
      markNotificationsAsViewed([sabotageNotification.id]);
    }
  };

  useEffect(() => {
    if (isLoggedIn && cycleNumber > lastBriefedCycle && phase === 'procurement_open') {
      const fetchBriefing = async () => {
        try {
          const data = await teamApi.getBriefing();
          setBriefingData(data);
          setShowBriefing(true);
          setLastBriefedCycle(cycleNumber);
        } catch (err) {
          console.error("Failed to fetch briefing", err);
        }
      };
      fetchBriefing();
    }
  }, [isLoggedIn, cycleNumber, lastBriefedCycle, phase, setLastBriefedCycle]);

  if (!isLoggedIn) return null;

  const navItems = [
    { path: '/', label: 'HOME' },
    { path: '/market', label: 'MARKET' },
    { path: '/inventory', label: 'INVENTORY' },
    { path: '/event', label: 'INTEL' },
  ];

  const unreadNotifs = useMemo(() => notifications.filter(n => !viewedNotificationIds.includes(n.id)), [notifications, viewedNotificationIds]);

  const syncAgeSeconds = useMemo(() => {
    if (!lastSyncTs) return null;
    return Math.max(0, Math.floor((nowTs - lastSyncTs) / 1000));
  }, [lastSyncTs, nowTs]);

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      {/* Top Navbar & Notifications Container (Sticky) */}
      <div className="sticky top-0 z-50 w-full flex flex-col shadow-lg shadow-black/20">
        <nav className="flex justify-between items-center bg-surface-low px-4 py-2.5 border-b border-outline-variant/30 backdrop-blur-md">
          <div className="flex space-x-5">
            {navItems.map(item => {
              const isEventTab = item.path === '/event';
              const unread = isEventTab ? getUnreadCount() : 0;
              const isActive = location.pathname === item.path;
              return (
                <motion.button
                  key={item.label}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(item.path)}
                  className={`relative font-display text-[11px] font-bold tracking-widest transition-all px-1 py-1 
                  ${isActive
                      ? 'text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-2 w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                  )}
                </motion.button>
              );
            })}
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-on-surface-variant font-mono text-[10px] flex items-center">
              <span className="flex items-center space-x-1 uppercase tracking-tighter opacity-80">
                <span className={phase === 'procurement_open' ? 'text-primary font-bold' : 'opacity-30'}>PROC</span>
                <span className="opacity-20">/</span>
                <span className={phase === 'production_open' ? 'text-primary font-bold' : 'opacity-30'}>PROD</span>
                <span className="opacity-20">/</span>
                <span className={phase === 'sales_open' ? 'text-primary font-bold' : 'opacity-30'}>SALES</span>
                <span className="opacity-20">/</span>
                <span className={phase === 'backroom' ? 'text-primary font-bold' : 'opacity-30'}>BACK</span>
              </span>
              <span className="ml-3 pl-3 border-l border-outline-variant/30">C<span className="text-on-surface ml-0.5">{cycleNumber || 0}</span></span>
            </div>

            <div className="scale-90 origin-right">
              <PhaseTimer
                openedAt={phaseOpenedAt}
                duration={phaseDuration}
                phase={phase}
              />
            </div>

            <div className={`text-on-surface font-mono text-sm tracking-tight transition-all duration-300 ${fundsAnimClass}`}>
              <AnimatePresence mode="wait">
                <motion.span
                  key={funds}
                  initial={{ opacity: 0.8, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${funds < 0 && !fundsAnimClass ? 'text-error font-bold' : !fundsAnimClass ? 'text-primary/90 font-bold' : ''}`}
                >
                  ${funds.toLocaleString()}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Sync status indicator - Compact version */}
            <div className="flex items-center space-x-1.5 font-mono text-[10px] opacity-70">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${connectionOk ? (syncAgeSeconds !== null && syncAgeSeconds > 15 ? 'bg-tertiary shadow-[0_0_5px_rgba(239,192,80,0.5)]' : 'bg-primary shadow-[0_0_5px_rgba(218,185,255,0.5)]') : 'bg-error animate-pulse shadow-[0_0_5px_rgba(255,0,0,0.5)]'}`} />
              <span className="text-on-surface-variant hidden xl:inline">{syncAgeSeconds ?? '—'}s</span>
            </div>

            <button
              onClick={logout}
              className="flex items-center space-x-1.5 text-on-surface-variant hover:text-error transition-colors ml-2"
            >
              <MdLogout className="text-base" />
            </button>
          </div>
        </nav>

        {/* Notification bar placeholder (toast stack area) */}
        <div className="px-6 py-2 border-b border-outline-variant bg-surface-highest">
          <div id="toast-stack" className="space-y-2 text-sm font-mono">
            {toasts.slice(-3).map((t) => (
              <div
                key={t.id}
                className={`px-3 py-2 border flex items-center justify-between ${t.type === 'success'
                  ? 'border-primary text-primary'
                  : t.type === 'error'
                    ? 'border-error text-error'
                    : t.type === 'warning'
                      ? 'border-tertiary text-tertiary'
                      : 'border-outline-variant text-on-surface'
                  }`}
              >
                <span>{t.message}</span>
                <button className="text-on-surface-variant hover:text-on-surface" onClick={() => removeToast(t.id)}>
                  DISMISS
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-surface-low border-r border-outline-variant flex flex-col py-6 overflow-y-auto custom-scrollbar">

          <div className="px-6 mb-8">
            <div className="text-[10px] text-on-surface-variant font-mono uppercase tracking-[0.2em] mb-1">Operating as</div>
            <h2 className="text-2xl font-display font-black text-primary uppercase tracking-tighter truncate" title={teamName || 'Unknown Team'}>
              {teamName || 'NO TEAM'}
            </h2>
          </div>

          <div className="flex flex-col mb-6">
            <button
              onClick={() => setExpandedSideItem(expandedSideItem === 'roster' ? null : 'roster')}
              className={`flex items-center space-x-3 px-6 py-3 w-full transition-colors relative
                ${expandedSideItem === 'roster' ? 'bg-surface-highest text-primary' : 'text-on-surface-variant hover:bg-surface-highest/50'}
              `}
            >
              {expandedSideItem === 'roster' && (
                <motion.div layoutId="side-highlight" className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
              )}
              <FiUsers className="text-lg" />
              <span className="font-display text-xs tracking-widest uppercase text-left flex-1">Team Roster</span>
              <span className="text-[10px] font-mono bg-surface rounded-full px-2 py-0.5">{members.length}</span>
            </button>
            <AnimatePresence>
              {expandedSideItem === 'roster' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 py-4 bg-surface-highest space-y-3">
                    <div className="space-y-2 font-mono text-xs">
                      {members.map(m => (
                        <div key={m.id} className="flex justify-between text-on-surface border-b border-outline-variant/30 pb-1">
                          <span className="uppercase">{m.name}</span>
                        </div>
                      ))}
                      {members.length === 0 && <div className="text-on-surface-variant opacity-50 italic">No operators logged.</div>}
                    </div>
                    <form onSubmit={handleAddMember} className="mt-2 flex space-x-2">
                      <input
                        type="text"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="Operator Name..."
                        className="flex-1 bg-surface border border-outline-variant/50 text-xs px-2 py-1.5 font-mono focus:border-primary focus:outline-none transition-colors"
                      />
                      <button type="submit" className="bg-primary/20 text-primary py-1.5 px-2 hover:bg-primary hover:text-surface transition-colors" title="Add Member">
                        <FiPlus size={14} />
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col mb-6">
            <button
              onClick={() => setExpandedSideItem(expandedSideItem === 'finances' ? null : 'finances')}
              className={`flex items-center space-x-3 px-6 py-3 w-full transition-colors relative
                ${expandedSideItem === 'finances' ? 'bg-surface-highest text-primary' : 'text-on-surface-variant hover:bg-surface-highest/50'}
              `}
            >
              {expandedSideItem === 'finances' && (
                <motion.div layoutId="side-highlight" className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
              )}
              <FiDollarSign className="text-lg" />
              <span className="font-display text-xs tracking-widest uppercase text-left flex-1">Finances</span>
              {finances?.funds < 0 && <span className="w-2 h-2 rounded-full bg-error animate-pulse" />}
            </button>
            <AnimatePresence>
              {expandedSideItem === 'finances' && finances && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 py-4 bg-surface-highest font-mono text-xs space-y-3">
                    <div>
                      <div className="text-[9px] text-on-surface-variant uppercase tracking-[0.2em]">Net Liquidity</div>
                      <div className={`text-lg font-bold ${(finances.funds ?? 0) < 0 ? 'text-error' : 'text-primary'}`}>
                        ${(finances.funds ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex justify-between border-b border-outline-variant/30 pb-1">
                      <span className="text-on-surface-variant">Cumul. Profit</span>
                      <span className={(finances.cumulative_profit ?? 0) < 0 ? 'text-error' : 'text-green-400'}>
                        ${(finances.cumulative_profit ?? 0).toLocaleString()}
                      </span>
                    </div>
                    {finances.has_gov_loan && (
                      <div className="mt-2 bg-error/10 border border-error/50 p-2 text-[10px] text-error flex items-start space-x-2">
                        <FiAlertCircle className="mt-0.5 shrink-0" />
                        <span>Gov bailout active. Backroom restricted.</span>
                      </div>
                    )}
                    {finances.active_loans && finances.active_loans.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-outline-variant/30">
                        <span className="text-[9px] text-on-surface-variant uppercase tracking-[0.2em] mb-2 block">Projected Obligations</span>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar-thin pr-1">
                          {finances.active_loans.map((loan: any, i: number) => (
                            <div key={i} className={`flex justify-between items-center text-[10px] p-2 rounded-sm border ${loan.type === 'repayment' ? 'bg-error/5 border-error/20 text-error' : 'bg-primary/5 border-primary/20 text-primary'}`}>
                              <div className="flex flex-col">
                                <span className="font-bold">Cycle {loan.cycle_num} {loan.type === 'repayment' ? 'PRINCIPAL' : 'INTEREST'}</span>
                                <span className="text-[8px] opacity-70 uppercase tracking-tighter">Lender: {loan.lender}</span>
                              </div>
                              <span className="font-bold">-${(loan.amount ?? 0).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-2 border-t border-outline-variant/50 flex justify-between items-center">
                           <span className="text-[8px] text-on-surface-variant uppercase font-bold">Total Debt</span>
                           <span className="text-[11px] font-black text-error">${(finances.total_principal_remaining ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col flex-1">
            <button
              onClick={() => setExpandedSideItem(expandedSideItem === 'events' ? null : 'events')}
              className={`flex items-center space-x-3 px-6 py-3 w-full transition-colors relative
                ${expandedSideItem === 'events' ? 'bg-surface-highest text-primary' : 'text-on-surface-variant hover:bg-surface-highest/50'}
              `}
            >
              {expandedSideItem === 'events' && (
                <motion.div layoutId="side-highlight" className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
              )}
              <FiAlertCircle className="text-lg" />
              <span className="font-display text-xs tracking-widest uppercase text-left flex-1">Active Events</span>
              {unreadNotifs.length > 0 && <span className="text-[10px] font-mono bg-error text-surface font-bold rounded-full px-2 py-0.5">{unreadNotifs.length}</span>}
            </button>
            <AnimatePresence>
              {expandedSideItem === 'events' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 py-4 bg-surface-highest border-t border-outline-variant/50 max-h-64 overflow-y-auto custom-scrollbar">
                    {unreadNotifs.length === 0 ? (
                      <span className="text-xs font-mono text-on-surface-variant opacity-50 italic">No pressing events.</span>
                    ) : (
              <div className="space-y-3">
                        {unreadNotifs.map(n => {
                          const NOTIF_TYPE_LABELS: Record<string, string> = {
                            sabotage: 'Security Alert',
                            discovery_self: 'Protocol Compromised',
                            discovery_thwarted: 'Threat Neutralized',
                            benefit: 'Government Accord',
                            fine: 'Ministry Sanction',
                            intel_report: 'Intelligence Report',
                            operational_loss: 'Operational Disturbance',
                            asset_exchange: 'Asset Transfer',
                          };
                          const typeLabel = NOTIF_TYPE_LABELS[n.type] || n.type.replace(/_/g, ' ');
                          return (
                            <div key={n.id} className="text-[10px] border-l-2 border-error pl-2 break-words">
                              <span className="font-bold text-on-surface block mb-0.5">{typeLabel}</span>
                              <span className="text-on-surface-variant font-mono">{n.message}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sponsor Logo */}
          <div className="mt-8 px-6 pb-2 text-center opacity-80 hover:opacity-100 transition-opacity flex flex-col items-center shrink-0">
            <div className="text-[9px] text-on-surface-variant font-mono uppercase tracking-[0.2em] mb-3">Powered By Sponsor</div>
            <img src="/sponsor_logo.png" alt="Sponsor Logo" className="w-full max-w-[200px] drop-shadow-md object-contain" />
          </div>

        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          <Outlet />
        </main>
      </div>

      <SecurityAlertOverlay
        isOpen={!!sabotageNotification}
        onClose={handleAcknowledgeSabotage}
        message={sabotageNotification?.message || ""}
      />

      <BriefingModal
        isOpen={showBriefing}
        onClose={() => setShowBriefing(false)}
        data={briefingData}
      />
    </div>
  );
};
