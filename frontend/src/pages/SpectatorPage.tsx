import { useEffect, useState, useMemo } from 'react';
import api from '../api/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiZap, FiActivity, FiGlobe, FiUsers, 
  FiClock, FiTrendingUp, FiSettings, FiFilter 
} from 'react-icons/fi';
import { FaCrown, FaAward, FaChartPie, FaFingerprint } from 'react-icons/fa';

interface LeaderboardRow {
  rank: number;
  team_name: string;
  composite_score: number;
  net_margin: number;
  enterprise_value: number;
  liquid_cash: number;
  brand_score: number;
  operational_efficiency: number;
  market_share: number;
}

interface SpectatorStatus {
  game_name: string;
  cycle_number: number;
  phase: string;
  game_active: boolean;
  phase_opened_at: number | null;
  phase_duration: number | null;
}

export default function SpectatorPage() {
  const [status, setStatus] = useState<SpectatorStatus | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/team/status');
      setStatus(res.data);
      
      // If we are in backroom or game_over, fetch leaderboard
      if (res.data.phase === 'backroom' || res.data.phase === 'game_over') {
        const lbRes = await api.get('/team/leaderboard');
        setLeaderboard(lbRes.data.rows || []);
      } else {
        setLeaderboard([]); // Clear it in other phases
      }
      setError(null);
    } catch (err: any) {
      console.error("Spectator Sync Error:", err);
      setError("RE-ESTABLISHING UPLINK...");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-2 border-brand-purple/20 rounded-full flex items-center justify-center relative">
            <div className="absolute inset-0 border-2 border-t-brand-purple rounded-full animate-spin" />
            <FiZap className="text-brand-purple animate-pulse" size={24} />
          </div>
          <p className="font-mono text-sm text-brand-purple/60 tracking-[0.5em] uppercase">Booting Spectator Core...</p>
        </div>
      </div>
    );
  }

  const isRevealPhase = status?.phase === 'backroom' || status?.phase === 'game_over';

  return (
    <div className="min-h-screen bg-brand-bg text-white font-body selection:bg-brand-purple selection:text-white flex flex-col overflow-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[500px] bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.15)_0%,transparent_70%)] opacity-60" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-50 contrast-150" />
      </div>

      {/* Header Bar */}
      <header className="relative z-50 border-b border-brand-border/50 bg-brand-surface/40 backdrop-blur-xl px-12 py-6 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <h1 className="font-display text-2xl font-black tracking-tighter text-white flex items-center gap-3">
              <span className="text-brand-purple animate-flicker">|</span> INDUSTRIX SPECTATOR
            </h1>
            <span className="font-mono text-[10px] text-white/40 uppercase tracking-[0.3em]">{status?.game_name} // NODE_01</span>
          </div>
          
          <div className="h-10 w-px bg-brand-border/50 mx-2" />
          
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Global Cycle</span>
              <span className="font-display text-xl font-bold text-brand-purple">#{status?.cycle_number || 0}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Active Phase</span>
              <span className="font-display text-xl font-bold text-brand-pink uppercase tracking-tight">{status?.phase.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Market Status</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRevealPhase ? 'bg-brand-pink animate-pulse' : 'bg-green-500'} shadow-glow`} />
              <span className={`text-xs font-mono font-bold uppercase ${isRevealPhase ? 'text-brand-pink' : 'text-green-500'}`}>
                {isRevealPhase ? 'Reveal Mode' : 'Live Operations'}
              </span>
            </div>
          </div>
          {error && <span className="text-[10px] font-mono text-brand-pink animate-pulse ml-4 border border-brand-pink/30 px-3 py-1 bg-brand-pink/5">{error}</span>}
        </div>
      </header>

      {/* Main Stage */}
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {!isRevealPhase ? (
            <motion.div 
              key="waiting"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex-1 flex flex-col items-center justify-center p-12 text-center"
            >
              <div className="relative mb-8">
                <motion.div 
                   animate={{ rotate: 360 }}
                   transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                   className="w-64 h-64 border border-brand-purple/20 rounded-full"
                />
                <motion.div 
                   animate={{ rotate: -360 }}
                   transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                   className="absolute inset-4 border border-brand-pink/10 rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                   <FiActivity className="text-brand-purple w-20 h-20 animate-pulse-slow" />
                </div>
              </div>

              <h2 className="font-display text-6xl font-black uppercase tracking-tighter mb-4 max-w-2xl bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent italic">
                Simulation Underway
              </h2>
              <p className="font-mono text-sm text-brand-border uppercase tracking-[0.5em] mb-12">
                Teams are currently optimizing production grids
              </p>

              <div className="grid grid-cols-3 gap-12 max-w-4xl w-full">
                <LiveStat label="Market Volatility" value="Low" icon={<FiActivity />} />
                <LiveStat label="Labour Efficiency" value="Nominal" icon={<FiUsers />} />
                <LiveStat label="Resource Demand" value="Rising" icon={<FiGlobe />} />
              </div>

              <div className="mt-20 p-4 border border-brand-border/30 bg-brand-surface/20 flex items-center gap-4 group cursor-default">
                 <div className="w-1.5 h-1.5 bg-brand-purple rounded-full animate-ping" />
                 <span className="text-[10px] font-mono text-white/50 uppercase tracking-[0.3em]">
                   Awaiting Sales Resolution Summary for Round Reveal
                 </span>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="leaderboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col p-12 overflow-y-auto"
            >
              <div className="flex justify-between items-end mb-12">
                <div>
                   <h2 className="font-display text-7xl font-black uppercase tracking-tighter mb-2">
                     Round Standings
                   </h2>
                   <p className="font-mono text-sm text-brand-purple uppercase tracking-[0.4em] flex items-center gap-3">
                     <FiFilter /> Authority Audit complete • Ranking by Composite Performance
                   </p>
                </div>
                {status?.phase === 'game_over' && (
                  <div className="bg-brand-pink border border-brand-pink/50 text-white font-display text-3xl px-8 py-3 uppercase tracking-tighter font-black shadow-glow-pink">
                    FINALE: Simulation Concluded
                  </div>
                )}
              </div>

              {/* Leaderboard Grid */}
              <div className="w-full flex flex-col gap-4">
                 <div className="grid grid-cols-12 px-8 py-4 bg-brand-surface/20 border-y border-brand-border/20 text-[10px] font-mono font-bold text-white/30 uppercase tracking-[0.2em] mb-4">
                    <div className="col-span-1">Rank</div>
                    <div className="col-span-3">Corporation Authority</div>
                    <div className="col-span-2 text-right">Net Margin</div>
                    <div className="col-span-2 text-right">Enterprise Value</div>
                    <div className="col-span-2 text-right">Market Share</div>
                    <div className="col-span-2 text-right">Authority Score</div>
                 </div>

                 <AnimatePresence>
                   {leaderboard.map((row, idx) => (
                     <LeaderboardItem key={row.team_name} row={row} idx={idx} total={leaderboard.length} />
                   ))}
                 </AnimatePresence>
              </div>

              {/* Bottom Decoration */}
              <div className="mt-auto pt-24 grid grid-cols-3 gap-8 opacity-20 filter grayscale group-hover:grayscale-0 transition-all duration-700">
                <div className="h-px bg-gradient-to-r from-transparent via-brand-purple to-transparent" />
                <div className="h-px bg-gradient-to-r from-transparent via-brand-pink to-transparent" />
                <div className="h-px bg-gradient-to-r from-transparent via-brand-purple to-transparent" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="relative z-50 px-12 py-6 border-t border-brand-border/30 bg-black/80 flex justify-between items-center text-[9px] font-mono text-white/30 tracking-widest uppercase">
         <div className="flex gap-8">
           <span>OS: GOV_OS v4.2</span>
           <span>Latency: 22ms</span>
           <span>Buffer: Standard</span>
         </div>
         <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-pulse" />
           <span>Simulation Link: Secure / Encrypted</span>
         </div>
      </footer>
    </div>
  );
}

function LiveStat({ label, value, icon }: any) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="p-3 bg-brand-surface border border-brand-border/50 text-brand-purple mb-1">
        {icon}
      </div>
      <span className="text-[10px] text-white/40 uppercase tracking-widest">{label}</span>
      <span className="text-2xl font-display font-black text-white uppercase">{value}</span>
    </div>
  );
}

function LeaderboardItem({ row, idx, total }: { row: LeaderboardRow, idx: number, total: number }) {
  // Bottom-to-top reveal animation logic
  const revealDelay = (total - 1 - idx) * 0.15;
  const isWinner = row.rank === 1;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      transition={{ delay: revealDelay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`grid grid-cols-12 items-center px-8 py-6 border rounded-sm transition-all duration-500 relative overflow-hidden group
        ${isWinner 
          ? 'bg-gradient-to-r from-brand-purple/20 via-brand-surface to-brand-surface border-brand-purple shadow-glow ring-1 ring-brand-purple/30' 
          : 'bg-brand-surface/40 border-brand-border/50 hover:bg-brand-surface hover:border-brand-purple/50'
        }
      `}
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-brand-purple/5 to-transparent skew-x-12 translate-x-16 pointer-events-none" />

      <div className="col-span-1 flex items-center gap-2">
        <span className={`text-3xl font-display font-black tracking-tighter w-12 
          ${isWinner ? 'text-brand-purple' : 'text-white/40'}
        `}>
          {row.rank.toString().padStart(2, '0')}
        </span>
        {isWinner && <FaCrown className="text-brand-purple text-xl animate-bounce" />}
      </div>

      <div className="col-span-3">
        <div className="flex flex-col">
          <span className={`font-display text-2xl font-bold uppercase tracking-tight
            ${isWinner ? 'text-brand-purple' : 'text-white'}
          `}>
            {row.team_name}
          </span>
          {isWinner && <span className="text-[9px] font-mono font-bold text-brand-purple/60 uppercase tracking-widest">Global Industry Leader</span>}
        </div>
      </div>

      <div className="col-span-2 text-right">
        <div className="flex flex-col">
           <span className="text-[9px] font-mono text-white/30 uppercase mb-1">Net Margin</span>
           <span className={`text-xl font-mono font-bold ${row.net_margin < 0 ? 'text-brand-pink' : 'text-brand-purple'}`}>
             {(row.net_margin * 100).toFixed(1)}%
           </span>
        </div>
      </div>

      <div className="col-span-2 text-right">
        <div className="flex flex-col">
           <span className="text-[9px] font-mono text-white/30 uppercase mb-1">Ent. Value</span>
           <span className="text-xl font-mono font-bold text-white">
             <span className="text-xs opacity-40 mr-1">$</span>
             {(row.enterprise_value / 1000000).toFixed(2)}M
           </span>
        </div>
      </div>

      <div className="col-span-2 text-right">
        <div className="flex flex-col">
           <span className="text-[9px] font-mono text-white/30 uppercase mb-1">Market Share</span>
           <span className="text-xl font-mono font-bold text-brand-pink">
             {(row.market_share * 100).toFixed(1)}%
           </span>
        </div>
      </div>

      <div className="col-span-2 text-right">
        <div className="flex flex-col border-l border-brand-border/50 pl-6">
           <span className="text-[9px] font-mono text-white/30 uppercase mb-1">Composite</span>
           <span className={`text-2xl font-display font-black ${isWinner ? 'text-brand-purple shadow-glow' : 'text-white/80'}`}>
             {row.composite_score.toFixed(1)}
           </span>
        </div>
      </div>
    </motion.div>
  );
}
