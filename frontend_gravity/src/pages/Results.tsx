import { useEffect, useMemo } from 'react';
import { useResultsStore, useGameStore } from '../store';
import { StatusChip } from '../components/SharedComponents';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCrown, FaArrowUp, FaAward, FaUserSecret, FaFingerprint, FaNetworkWired, FaServer, FaGem, FaBiohazard, FaGhost, FaSkullCrossbones, FaChartPie } from 'react-icons/fa';

const MarketShareChart = ({ rows }: { rows: import('../types').LeaderboardRow[] }) => {
  const colors = ['#DAB9FF', '#EFC050', '#8A63D2', '#FF8E8B', '#54C6EB', '#4ADE80', '#A78BFA', '#F472B6', '#34D399'];
  let cumulativePercent = 0;
  
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  const validRows = rows.filter(r => r.market_share > 0);
  
  if (validRows.length === 0) {
    return <div className="h-full flex items-center justify-center text-[10px] text-on-surface-variant uppercase tracking-widest pt-4">No Market Data</div>;
  }

  return (
    <div className="flex h-full w-full mx-auto items-center justify-center gap-10">
      <div className="w-48 h-48 shrink-0 relative flex items-center justify-center">
        <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full transform -rotate-90 drop-shadow-[0_0_12px_rgba(218,185,255,0.15)]">
          {validRows.map((row, index) => {
            const share = row.market_share;
            if (share > 0.999) {
               return <circle key={row.team_name} cx="0" cy="0" r="1" fill={colors[index % colors.length]} />;
            }
            
            const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
            cumulativePercent += share;
            const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
            
            const largeArcFlag = share > 0.5 ? 1 : 0;
            const pathData = [
              `M 0 0`,
              `L ${startX} ${startY}`,
              `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
              `Z`,
            ].join(' ');

            return (
              <path
                key={row.team_name}
                d={pathData}
                fill={colors[index % colors.length]}
                className="stroke-surface-low stroke-[0.015] hover:opacity-80 transition-opacity cursor-pointer"
              >
                <title>{row.team_name}: {(share * 100).toFixed(1)}%</title>
              </path>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-surface-low border-[3px] border-surface-low"></div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 w-full max-w-2xl px-2">
        {validRows.sort((a, b) => b.market_share - a.market_share).map((row, index) => (
          <div key={row.team_name} className="flex flex-col bg-surface-high/20 px-4 py-3 border border-outline-variant/10 rounded transition-colors hover:bg-surface-high/40">
            <div className="flex items-center space-x-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: colors[index % colors.length] }}></span>
              <span className="truncate opacity-70 text-[10px] font-display uppercase tracking-widest leading-none">{row.team_name}</span>
            </div>
            <span className="font-bold font-mono text-tertiary text-base leading-none ml-4 flex items-center gap-2">
              {(row.market_share * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};


export const Results = () => {
  const { phase, teamName } = useGameStore();
  const { cycleNumber, isFinal, rows, awards, fetchLeaderboard } = useResultsStore();

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard, phase]); // Refetch when phase switches

  const isBackroom = phase === 'backroom' || phase === 'game_over';

  // Sort rows by rank just in case, though API usually handles this
  const sortedRows = useMemo(() => [...rows].sort((a, b) => (a.rank || 0) - (b.rank || 0)), [rows]);

  const ownRow = useMemo(() => sortedRows.find(r => r.team_name === teamName), [sortedRows, teamName]);

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
          <>
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono overflow-hidden py-2"
            >
            {/* Panel 1: Main Status */}
            <div className="bg-surface-low border border-primary/30 p-5 backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/20 transition-all duration-1000"></div>
              <div className="flex items-center space-x-3 mb-4">
                <FaUserSecret className="text-primary text-2xl" />
                <h3 className="text-primary font-bold tracking-widest uppercase text-sm">Liaison Status</h3>
              </div>
              <div className="space-y-4 relative z-10">
                <div className="flex items-center space-x-2">
                   <span className="w-2 h-2 rounded-full bg-error animate-pulse shadow-[0_0_8px_rgba(255,0,0,0.8)]"></span>
                   <span className="uppercase text-xs text-on-surface font-bold tracking-[0.2em]">Desk is OPEN</span>
                </div>
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  The Organiser is accepting backroom deals, bribes, and sabotage requests. Approach the desk physically to initiate protocols.
                </p>
                <div className="h-[2px] w-full bg-gradient-to-r from-primary/50 to-transparent"></div>
                <div className="text-[9px] uppercase tracking-widest opacity-50 flex items-center space-x-2">
                  <FaServer />
                  <span className="animate-pulse">Awaiting manual cycle resolution...</span>
                </div>
              </div>
            </div>

            {/* Panel 2: Live Operation Snapshot */}
            <div className="bg-surface-low border border-outline-variant/30 p-5 backdrop-blur-xl relative overflow-hidden">
               <div className="absolute -bottom-4 -right-4 text-[100px] text-primary/5 pointer-events-none font-black font-display rotate-12">
                 C{cycleNumber}
               </div>
               <div className="flex items-center justify-between mb-4 relative z-10">
                 <h3 className="text-on-surface font-bold tracking-widest uppercase text-sm flex items-center space-x-2">
                   <FaFingerprint className="text-on-surface-variant" />
                   <span>Unit Audit</span>
                 </h3>
                 <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded uppercase tracking-widest">Live</span>
               </div>
               {ownRow ? (
                 <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-1">Ent. Value</div>
                      <div className="text-xl font-display font-medium text-primary shadow-primary/20 drop-shadow-md truncate">
                        ${ownRow.enterprise_value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.2em] text-on-surface-variant mb-1">Current Rank</div>
                      <div className="text-xl font-display font-black text-on-surface">
                        #{ownRow.rank}
                      </div>
                    </div>
                    <div className="col-span-2 bg-black/20 p-2 rounded text-[10px] flex justify-between items-center border border-white/5">
                      <span className="uppercase opacity-60">Composite Score</span>
                      <span className="font-bold">{ownRow.composite_score?.toFixed(1)} Pts</span>
                    </div>
                 </div>
               ) : (
                 <div className="h-full flex items-center justify-center text-[10px] text-on-surface-variant uppercase tracking-widest animate-pulse">Syncing Telemetry...</div>
               )}
            </div>

            {/* Panel 3: Intelligence Wire */}
            <div className="bg-surface-low border border-outline-variant/30 p-5 backdrop-blur-xl flex flex-col">
              <div className="flex items-center space-x-3 mb-4">
                <FaNetworkWired className="text-secondary text-base" />
                <h3 className="text-secondary font-bold tracking-widest uppercase text-sm">Intel Wire</h3>
              </div>
              <div className="flex-1 flex flex-col justify-center space-y-4 text-[10px]">
                 <div className="flex items-start space-x-2 opacity-80 group hover:opacity-100 transition-opacity">
                   <span className="text-secondary mt-0.5 animate-pulse">▶</span>
                   <p className="font-mono leading-relaxed">Check the <span className="text-primary font-bold">Events Hub</span> for leaked industry gossip and counter-intelligence.</p>
                 </div>
                 <div className="flex items-start space-x-2 opacity-80 group hover:opacity-100 transition-opacity">
                   <span className="text-secondary mt-0.5 animate-pulse">▶</span>
                   <p className="font-mono leading-relaxed">Consider buying Intelligence Buffs to intercept incoming hostile protocols.</p>
                 </div>
              </div>
            </div>
          </motion.div>

          {/* Market Share Visualization Row */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-surface-low border border-outline-variant/20 p-6 backdrop-blur-xl flex flex-col relative group rounded-sm shadow-xl mt-2 mb-2"
          >
            <div className="flex items-center justify-between mb-4 relative z-10 w-full">
              <div className="flex items-center space-x-3">
                <FaChartPie className="text-tertiary text-xl" />
                <h3 className="font-display font-black tracking-widest uppercase text-base bg-gradient-to-r from-tertiary to-tertiary/70 bg-clip-text text-transparent">Global Market Share</h3>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-on-surface-variant bg-surface-high/50 border border-outline-variant/10 px-3 py-1.5 rounded">
                Live Distribution
              </div>
            </div>
            <div className="w-full flex align-center justify-center relative z-10 py-6 pl-4 border-t border-outline-variant/10">
              <MarketShareChart rows={sortedRows} />
            </div>
          </motion.div>
          </>
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
                <th className="py-6 px-4 font-bold uppercase text-right">Net Margin</th>
                <th className="py-6 px-4 font-bold uppercase text-right">Ent. Value</th>
                <th className="py-6 px-4 font-bold uppercase text-right">Brand</th>
                <th className="py-6 px-4 font-bold uppercase text-right">Ops Efficiency</th>
                <th className="py-6 px-4 font-bold uppercase text-right">Market Share</th>
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
                    <td className="py-6 px-4 text-right text-on-surface-variant font-mono text-base">
                      <span className={`font-bold ${row.net_margin < 0 ? 'text-error/80' : 'text-primary/90'}`}>
                        {(row.net_margin * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className={`py-6 px-4 text-right font-bold font-mono text-base text-on-surface`}>
                      <span className="opacity-60 text-[10px] mr-0.5">$</span>
                      {row.enterprise_value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-6 px-4 text-right text-on-surface font-mono">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-base">{row.brand_score?.toFixed(1) || 0}</span>
                        {row.brand_score > 50 && <FaArrowUp className="text-[10px] text-primary animate-bounce opacity-80" />}
                      </div>
                    </td>
                    <td className="py-6 px-4 text-right text-on-surface font-mono text-base">
                       {row.operational_efficiency > 0 ? (
                         <>{(row.operational_efficiency * 10000).toFixed(2)} <span className="text-[10px] opacity-50 block leading-tight">U/${'10k'}</span></>
                       ) : '0'}
                    </td>
                    <td className="py-6 px-4 text-right text-tertiary font-mono text-base font-bold">
                      {(row.market_share * 100).toFixed(1)}%
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

        {/* Endgame Superlatives */}
        {phase === 'game_over' && awards && awards.length > 0 && (
          <div className="p-8 border-t border-outline-variant/30 bg-surface-low/80">
             <div className="flex items-center space-x-4 mb-8">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-outline-variant/50"></div>
                <h2 className="font-display text-2xl font-black text-on-surface uppercase tracking-widest flex items-center space-x-3">
                   <FaAward className="text-secondary" />
                   <span>Special Commendations</span>
                </h2>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-outline-variant/50"></div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {awards.map((award: any, i: number) => (
                  <motion.div
                    key={award.category}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8 + (i * 0.15), type: 'spring' }}
                    className="p-5 border border-outline-variant/50 bg-surface-high relative overflow-hidden group hover:border-secondary/50 transition-colors"
                  >
                    <div className="absolute -top-4 -right-4 text-7xl text-on-surface/5 opacity-20 group-hover:rotate-12 transition-transform duration-500">
                      {award.icon === 'titan' && <FaGem />}
                      {award.icon === 'paragon' && <FaCrown />}
                      {award.icon === 'tycoon' && <FaSkullCrossbones />}
                      {award.icon === 'nightmare' && <FaBiohazard />}
                      {award.icon === 'king' && <FaGhost />}
                    </div>

                    <div className="relative z-10">
                       <span className="text-[10px] font-mono font-bold text-secondary uppercase tracking-[0.2em] block mb-1">{award.category}</span>
                       <h3 className="font-display text-lg font-black text-on-surface uppercase mb-2 truncate">{award.team_name}</h3>
                       <p className="text-[11px] font-mono text-on-surface-variant leading-relaxed italic border-l-2 border-secondary/30 pl-3">
                         "{award.description}"
                       </p>
                    </div>
                  </motion.div>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
