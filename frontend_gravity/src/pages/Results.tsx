import { useEffect, useMemo } from 'react';
import { useResultsStore, useGameStore } from '../store';
import { StatusChip } from '../components/SharedComponents';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCrown, FaArrowUp, FaAward } from 'react-icons/fa';

export const Results = () => {
  const { phase, teamName } = useGameStore();
  const { cycleNumber, isFinal, rows, fetchLeaderboard } = useResultsStore();

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard, phase]); // Refetch when phase switches

  const isBackroom = phase === 'backroom' || phase === 'game_over';

  // Sort rows by rank just in case, though API usually handles this
  const sortedRows = useMemo(() => [...rows].sort((a, b) => (a.rank || 0) - (b.rank || 0)), [rows]);

  return (
    <div className="flex flex-col min-h-full space-y-6">
      <div className="flex justify-between items-start pt-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h1 className="font-display text-5xl font-black uppercase tracking-tighter mb-2 bg-gradient-to-r from-on-surface to-on-surface-variant bg-clip-text text-transparent">
            {phase === 'game_over' && isFinal ? 'FINAL STANDINGS' : 'ROUND RESULTS'}
          </h1>
          <div className="text-on-surface-variant font-mono text-sm tracking-[0.3em] flex items-center gap-3">
            <span className="w-12 h-[1px] bg-outline-variant"></span>
            CYCLE {cycleNumber} • FINAL AUDIT
          </div>
        </motion.div>

        {isBackroom && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <StatusChip label="READ ONLY" variant="warning" />
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {(phase === 'backroom' || phase === 'game_over') && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-surface-low border border-outline-variant/50 p-4 font-mono text-xs text-on-surface-variant backdrop-blur-xl relative overflow-hidden shadow-2xl"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-primary/50"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex space-x-1">
                <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
                <span className="w-2 h-2 rounded-full bg-error animate-pulse delay-75"></span>
              </div>
              <span className="uppercase tracking-widest text-primary font-bold">LIVE AUDIT IN PROGRESS — ORGANISER DESK IS NOW OPEN FOR SETTLEMENTS</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 bg-surface-low/50 border border-outline-variant/20 rounded-sm relative overflow-hidden">
        {/* Background Atmosphere */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(218,185,255,0.05)_0%,transparent_70%)] pointer-events-none"></div>

        <div className="relative z-10">
          <table className="w-full text-left font-mono text-sm border-separate border-spacing-y-3 px-6 pb-12">
            <thead className="sticky top-0 bg-surface-low/95 backdrop-blur-md z-20">
              <tr className="text-outline text-[11px] uppercase tracking-[0.2em]">
                <th className="py-6 pl-6 font-bold uppercase">Rank</th>
                <th className="py-6 px-4 font-bold uppercase">Team Authority</th>
                <th className="py-6 px-4 font-bold uppercase text-right">Composite</th>
                <th className="py-6 px-4 font-bold uppercase text-right">Liquidity</th>
                <th className="py-6 px-4 font-bold uppercase text-right">Profit</th>
                <th className="py-6 px-4 font-bold uppercase text-right">Advantage</th>
                <th className="py-6 px-4 font-bold uppercase text-right">Quality</th>
                <th className="py-6 px-4 font-bold uppercase text-right">Penalty</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, idx) => {
                const isOwnTeam = teamName && row.team_name === teamName;
                const isWinner = row.rank === 1;
                const isTopThree = row.rank <= 3;

                // Bottom-to-top reveal animation logic
                const totalRows = sortedRows.length;
                const revealDelay = (totalRows - 1 - idx) * 0.12;

                return (
                  <motion.tr
                    key={row.team_name}
                    initial={{ opacity: 0, x: -10, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    transition={{
                      duration: 0.7,
                      delay: revealDelay,
                      ease: [0.33, 1, 0.68, 1]
                    }}
                    className={`group relative transition-all duration-300
                      ${isWinner
                        ? 'bg-gradient-to-r from-tertiary/20 to-surface-high border-tertiary/40 shadow-[0_4px_20px_-2px_rgba(239,192,80,0.15)] ring-1 ring-tertiary/20'
                        : isOwnTeam
                          ? 'bg-gradient-to-r from-primary/20 to-surface-high border-primary/40 ring-1 ring-primary/30 shadow-[0_4px_15px_-2px_rgba(218,185,255,0.1)]'
                          : 'bg-surface-high/40 border-outline-variant/10 hover:bg-surface-high/60 border hover:border-outline-variant/30'
                      }
                    `}
                  >
                    <td className="py-6 pl-6 relative">
                      <div className="flex items-center gap-4">
                        <span className={`text-3xl font-display font-black tracking-tighter w-12
                          ${isWinner ? 'text-tertiary' : isOwnTeam ? 'text-primary' : isTopThree ? 'text-secondary' : 'text-outline'}
                        `}>
                          {row.rank.toString().padStart(2, '0')}
                        </span>
                        {isWinner && (
                          <motion.div
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: revealDelay + 0.4, type: 'spring', stiffness: 200 }}
                          >
                            <FaCrown className="text-tertiary text-2xl drop-shadow-[0_0_10px_rgba(239,192,80,0.8)]" />
                          </motion.div>
                        )}
                        {isTopThree && !isWinner && (
                          <FaAward className={`${row.rank === 2 ? 'text-slate-300' : 'text-orange-400'} text-lg opacity-80`} />
                        )}
                      </div>
                    </td>
                    <td className={`py-6 px-4 font-display text-lg tracking-normal
                      ${isWinner ? 'text-tertiary font-black' : isOwnTeam ? 'text-primary font-bold' : 'text-on-surface'}
                    `}>
                      <div className="flex flex-col gap-0.5">
                        <span className="uppercase">{row.team_name}</span>
                        {isOwnTeam && (
                          <span className="text-[9px] uppercase tracking-[0.2em] text-primary/80 font-mono font-bold">PLAYER OPERATING UNIT</span>
                        )}
                      </div>
                    </td>
                    <td className="py-6 px-4 text-right">
                      <span className={`font-display text-2xl font-bold ${isWinner ? 'text-tertiary' : isOwnTeam ? 'text-primary' : 'text-on-surface'}`}>
                        {row.composite_score?.toFixed(1) || 0}
                      </span>
                    </td>
                    <td className="py-6 px-4 text-right text-on-surface-variant font-mono">
                      <span className="opacity-40 text-[10px] mr-1">$</span>
                      {row.closing_funds?.toLocaleString()}
                    </td>
                    <td className={`py-6 px-4 text-right font-bold font-mono text-base
                      ${row.cumulative_profit < 0 ? 'text-error' : 'text-primary'}
                    `}>
                      <span className="opacity-60 text-[10px] mr-0.5">$</span>
                      {row.cumulative_profit?.toLocaleString()}
                    </td>
                    <td className="py-6 px-4 text-right text-on-surface font-mono">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-base">{row.brand_score?.toFixed(1) || 0}</span>
                        {row.brand_score > 50 && <FaArrowUp className="text-[10px] text-primary animate-bounce" />}
                      </div>
                    </td>
                    <td className="py-6 px-4 text-right text-on-surface font-mono text-base">
                      {row.quality_avg?.toFixed(1) || 0}
                    </td>
                    <td className="py-6 px-4 text-right text-error/60 font-mono text-xs">
                      -{row.inventory_penalty > 0 ? `$${row.inventory_penalty?.toLocaleString()}` : '0'}
                    </td>
                  </motion.tr>
                );
              })}

              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-32 text-center">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center gap-6"
                    >
                      <div className="relative">
                        <div className="w-16 h-16 border-2 border-outline-variant/30 rounded-full"></div>
                        <div className="absolute top-0 w-16 h-16 border-2 border-t-primary rounded-full animate-spin"></div>
                      </div>
                      <div className="text-on-surface-variant font-mono text-xs tracking-[0.5em] uppercase">
                        Auditing sequence initiated...
                      </div>
                    </motion.div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
