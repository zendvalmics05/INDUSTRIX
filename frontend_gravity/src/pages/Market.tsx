import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiTarget, FiTrendingUp, FiShield, FiZap, FiInfo } from 'react-icons/fi';
import { teamApi } from '../api';
import type { MarketFaction } from '../types';
import { useGameStore, useInventoryStore } from '../store';

const TierPillar = ({ title, factions, allFactions, teamBrand, colorClass, barColor, icon: Icon }: { 
  title: string, 
  factions: MarketFaction[], 
  allFactions: MarketFaction[],
  teamBrand: number,
  colorClass: string,
  barColor: string,
  icon: any
}) => {
  // Dynamically calculate the maximums for proper scaling
  const maxMarketPrice = Math.max(...allFactions.map(f => f.projected_ceiling_max), 1);
  const maxMarketVolume = Math.max(...allFactions.map(f => f.projected_volume_max), 1);

  return (
    <div className="flex-1 flex flex-col space-y-4 min-w-[320px]">
      <div className={`p-3 border-l-4 ${colorClass} bg-surface-container flex items-center justify-between`}>
        <div className="flex items-center space-x-3">
          <Icon className="text-xl" />
          <h2 className="font-display text-xl font-bold uppercase tracking-widest">{title}</h2>
        </div>
        <span className="font-mono text-xs font-bold bg-surface-low px-2 py-1 border border-outline-variant/30">
          {factions.length} SECTORS
        </span>
      </div>

      <div className="flex-1 space-y-3">
        {factions.map((f, idx) => {
          const isEligible = teamBrand >= f.brand_min;
          const pricePctMin = (f.projected_ceiling_min / maxMarketPrice) * 100;
          const pricePctMax = (f.projected_ceiling_max / maxMarketPrice) * 100;
          const volPctMin = (f.projected_volume_min / maxMarketVolume) * 100;
          const volPctMax = (f.projected_volume_max / maxMarketVolume) * 100;

          return (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`bg-surface-low border p-4 group relative overflow-hidden transition-all duration-300 hover:bg-surface-high ${isEligible ? 'border-outline-variant' : 'border-error/30 opacity-70 grayscale'}`}
            >
              {/* Top Row: Name & Brand Requirement */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                  <h3 className="font-display text-lg font-bold text-on-surface group-hover:text-primary transition-colors">{f.name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                     <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isEligible ? 'bg-primary/20 text-primary' : 'bg-error/20 text-error'}`}>
                       BRAND MIN: {f.brand_min}
                     </span>
                     {!isEligible && <span className="text-[9px] font-bold text-error uppercase animate-pulse">LOCKED</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Flexibility</div>
                  <div className="flex space-x-1 justify-end">
                    {[1, 2, 3, 4, 5].map(dot => (
                      <div 
                        key={dot} 
                        className={`w-1.5 h-1.5 rounded-full ${f.flexibility * 5 >= dot ? 'bg-primary shadow-[0_0_5px_rgba(218,185,255,0.5)]' : 'bg-surface-highest'}`} 
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Middle Row: Volume Stats */}
              <div className="space-y-3 mb-4">
                <div className="relative">
                  <div className="flex justify-between text-[10px] font-bold text-on-surface-variant uppercase mb-1 font-mono">
                    <span className="flex items-center space-x-1">
                      <span>Est. Volume Demand</span>
                      {f.last_cycle_volume && (
                        <span className={f.projected_volume_max > f.last_cycle_volume ? "text-primary" : f.projected_volume_max < f.last_cycle_volume ? "text-error" : "text-on-surface-variant/40"}>
                          {f.projected_volume_max > f.last_cycle_volume ? "▲" : f.projected_volume_max < f.last_cycle_volume ? "▼" : "•"}
                        </span>
                      )}
                    </span>
                    <span className="text-on-surface">{f.projected_volume_min} - {f.projected_volume_max} u</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-highest rounded-full overflow-hidden relative">
                    <div 
                      className="absolute h-full bg-on-surface-variant/40 transition-all duration-500" 
                      style={{ left: `${volPctMin}%`, width: `${volPctMax - volPctMin}%` }}
                    />
                  </div>
                </div>

                <div className="relative">
                  <div className="flex justify-between text-[10px] font-bold text-on-surface-variant uppercase mb-1 font-mono">
                    <span className="flex items-center space-x-1">
                      <span>Target Price Ceiling</span>
                      {f.last_cycle_price && (
                        <span className={f.projected_ceiling_max > f.last_cycle_price ? "text-primary" : f.projected_ceiling_max < f.last_cycle_price ? "text-error" : "text-on-surface-variant/40"}>
                          {f.projected_ceiling_max > f.last_cycle_price ? "▲" : f.projected_ceiling_max < f.last_cycle_price ? "▼" : "•"}
                        </span>
                      )}
                    </span>
                    <span className="text-primary font-bold">${f.projected_ceiling_min.toLocaleString()} - ${f.projected_ceiling_max.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-highest rounded-full overflow-hidden relative">
                    <div 
                      className={`absolute h-full opacity-80 transition-all duration-500 ${barColor}`}
                      style={{ left: `${pricePctMin}%`, width: `${pricePctMax - pricePctMin}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Hover Strategic Info */}
              <div className="text-[10px] font-mono text-on-surface-variant/80 italic line-clamp-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                Strategic Note: Priority {f.tier_preference} sector. Price strategy should aim for ${((f.projected_ceiling_min + f.projected_ceiling_max) / 2 * 0.95).toFixed(0)} for volume capture.
              </div>
            </motion.div>
          );
        })}
        {factions.length === 0 && (
          <div className="py-8 border border-dashed border-outline-variant/30 text-center text-on-surface-variant font-mono text-sm italic">
            No intelligence for this sector
          </div>
        )}
      </div>
    </div>
  );
};

export const Market = () => {
  const { phase } = useGameStore();
  const { brandScore, brandTier, fetchInventory } = useInventoryStore();
  const [factions, setFactions] = useState<MarketFaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
    teamApi.getMarket()
      .then(data => setFactions(data.factions || []))
      .catch(err => console.error("Could not fetch market data:", err))
      .finally(() => setLoading(false));
  }, [phase, fetchInventory]);

  // Sort factions by tier: Premium -> Standard -> Substandard
  const sortedFactions = [...factions].sort((a, b) => {
    const tierOrder: Record<string, number> = { premium: 1, standard: 2, substandard: 3 };
    return tierOrder[a.tier_preference] - tierOrder[b.tier_preference];
  });

  const getTierConfig = (tier: string) => {
    switch(tier) {
      case 'premium': return { color: 'border-primary bg-primary/5', bar: 'bg-primary', icon: FiZap, label: 'PREMIUM' };
      case 'standard': return { color: 'border-secondary bg-secondary/5', bar: 'bg-secondary', icon: FiTrendingUp, label: 'STANDARD' };
      case 'substandard': return { color: 'border-tertiary bg-tertiary/5', bar: 'bg-tertiary', icon: FiShield, label: 'BUDGET' };
      default: return { color: 'border-outline-variant', bar: 'bg-outline-variant', icon: FiInfo, label: 'OTHER' };
    }
  };

  const maxMarketPrice = Math.max(...factions.map(f => f.projected_ceiling_max), 1);
  const maxMarketVolume = Math.max(...factions.map(f => f.projected_volume_max), 1);

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-end border-b border-outline-variant/20 pb-4">
        <div>
          <h1 className="font-display text-4xl uppercase tracking-tighter">MARKET INTELLIGENCE</h1>
          <div className="flex items-center space-x-3 mt-1 font-mono text-sm font-semibold text-on-surface-variant uppercase tracking-widest">
            <span className="flex items-center space-x-1">
              <FiTarget className="text-primary" />
              <span>Current Brand Score:</span>
              <span className="text-primary font-bold">{brandScore} ({brandTier.toUpperCase()})</span>
            </span>
            <span>·</span>
            <span>Cycle Intelligence Phase active</span>
          </div>
        </div>
        <div className="bg-surface-highest/50 px-4 py-2 border border-outline-variant/30 text-[10px] font-mono leading-tight max-w-sm text-on-surface-variant">
          <FiInfo className="inline mr-1 text-primary" />
          Intelligence forecasts map the ±15% variance zone. Price ceilings are hard limits; volumes represent max potential appetite.
        </div>
      </div>

      {/* Market Sentiment Summary */}
      {!loading && factions.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          {(() => {
            const totalVol = factions.reduce((acc, f) => acc + f.projected_volume_max, 0);
            const prevVol = factions.reduce((acc, f) => acc + (f.last_cycle_volume || f.projected_volume_max / 1.15), 0);
            const volDelta = ((totalVol - prevVol) / prevVol) * 100;

            const avgPrice = factions.reduce((acc, f) => acc + f.projected_ceiling_max, 0) / factions.length;
            const prevPrice = factions.reduce((acc, f) => acc + (f.last_cycle_price || f.projected_ceiling_max / 1.15), 0) / factions.length;
            const priceDelta = ((avgPrice - prevPrice) / prevPrice) * 100;

            return (
              <>
                <motion.div whileHover={{ scale: 1.02 }} className="bg-surface-container border border-outline-variant p-3 flex flex-col justify-center relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-50" />
                   <span className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Market Sentiment</span>
                   <div className="flex items-center space-x-2">
                      <span className={`text-xl font-display font-bold uppercase ${volDelta + priceDelta > 0 ? 'text-primary' : 'text-error'}`}>
                        {volDelta + priceDelta > 5 ? 'Bullish' : volDelta + priceDelta < -5 ? 'Bearish' : 'Neutral'}
                      </span>
                      <FiTrendingUp className={`transition-transform duration-500 ${volDelta + priceDelta > 0 ? 'rotate-0 text-primary' : 'rotate-90 text-error'}`} />
                   </div>
                </motion.div>
                <div className="bg-surface-container border border-outline-variant p-3 flex flex-col justify-center">
                   <span className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Volume Liquidity</span>
                   <div className="flex items-baseline space-x-2">
                      <span className="text-xl font-mono font-bold text-on-surface">{totalVol.toLocaleString()} u</span>
                      <span className={`text-xs font-bold ${volDelta >= 0 ? 'text-primary' : 'text-error'}`}>
                        {volDelta >= 0 ? '+' : ''}{volDelta.toFixed(1)}%
                      </span>
                   </div>
                </div>
                <div className="bg-surface-container border border-outline-variant p-3 flex flex-col justify-center">
                   <span className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Avg. Price Cap</span>
                   <div className="flex items-baseline space-x-2">
                      <span className="text-xl font-mono font-bold text-on-surface">${avgPrice.toFixed(0)}</span>
                      <span className={`text-xs font-bold ${priceDelta >= 0 ? 'text-primary' : 'text-error'}`}>
                        {priceDelta >= 0 ? '+' : ''}{priceDelta.toFixed(1)}%
                      </span>
                   </div>
                </div>
                <div className="bg-surface-container border border-outline-variant p-3 flex flex-col justify-center">
                   <span className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Ineligible Sectors</span>
                   <div className="flex items-center space-x-2">
                      <span className="text-xl font-mono font-bold text-on-surface">
                        {factions.filter(f => brandScore < f.brand_min).length}
                      </span>
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">Locked by Brand</span>
                   </div>
                </div>
              </>
            );
          })()}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex-1 flex flex-col items-center justify-center space-y-4"
          >
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <div className="font-mono text-sm font-bold uppercase tracking-widest text-primary animate-pulse">Decrypting Market Data...</div>
          </motion.div>
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar pr-2 min-h-0 items-stretch">
            {sortedFactions.map((f, idx) => {
              const cfg = getTierConfig(f.tier_preference);
              const isEligible = brandScore >= f.brand_min;
              const pricePctMin = (f.projected_ceiling_min / maxMarketPrice) * 100;
              const pricePctMax = (f.projected_ceiling_max / maxMarketPrice) * 100;
              const volPctMin = (f.projected_volume_min / maxMarketVolume) * 100;
              const volPctMax = (f.projected_volume_max / maxMarketVolume) * 100;

              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`bg-surface-low border-2 p-5 group relative overflow-hidden transition-all duration-300 hover:bg-surface-high flex flex-col h-full
                    ${cfg.color} ${isEligible ? 'border-outline-variant/40 hover:border-primary/50' : 'border-error/20 opacity-60 grayscale'}`}
                >
                  {/* Tier Accent Decor */}
                  <div className={`absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 rounded-full opacity-10 transition-transform duration-700 group-hover:scale-150 ${cfg.bar}`} />

                  <div className="flex justify-between items-start mb-5 relative z-10">
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2 mb-1.5">
                        <cfg.icon className="text-xs text-primary" />
                        <span className="text-[10px] font-black tracking-[0.2em] text-primary/80 uppercase">{cfg.label} SECTOR</span>
                      </div>
                      <h3 className="font-display text-xl font-black text-on-surface group-hover:text-primary transition-colors leading-none tracking-tight uppercase">
                        {f.name}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6 relative z-10 flex-1">
                    {/* Volume Intelligence */}
                    <div className="relative">
                      <div className="flex justify-between text-[11px] font-bold text-on-surface-variant uppercase mb-1.5 font-mono">
                        <span className="flex items-center space-x-1.5">
                          <FiTrendingUp className="text-[10px] opacity-60" />
                          <span>Est. Demand</span>
                          {f.last_cycle_volume && (
                            <span className={f.projected_volume_max > f.last_cycle_volume ? "text-primary anim-pulse" : f.projected_volume_max < f.last_cycle_volume ? "text-error" : "text-on-surface-variant/40"}>
                              {f.projected_volume_max > f.last_cycle_volume ? "▲" : f.projected_volume_max < f.last_cycle_volume ? "▼" : "•"}
                            </span>
                          )}
                        </span>
                        <span className="text-on-surface tracking-tighter">{f.projected_volume_min} — {f.projected_volume_max} u</span>
                      </div>
                      <div 
                        className="h-2 w-full bg-black/30 rounded-full overflow-hidden relative border border-white/5 cursor-help"
                        title={`Estimated market appetite between ${f.projected_volume_min} and ${f.projected_volume_max} units.`}
                      >
                        <div 
                          className="absolute h-full bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.2)] transition-all duration-700" 
                          style={{ left: `${volPctMin}%`, width: `${volPctMax - volPctMin}%` }}
                        />
                      </div>
                    </div>

                    {/* Pricing Intelligence */}
                    <div className="relative">
                      <div className="flex justify-between text-[11px] font-bold text-on-surface-variant uppercase mb-1.5 font-mono">
                        <span className="flex items-center space-x-1.5">
                          <FiZap className="text-[10px] opacity-60" />
                          <span>Price Ceiling</span>
                          {f.last_cycle_price && (
                            <span className={f.projected_ceiling_max > f.last_cycle_price ? "text-primary" : f.projected_ceiling_max < f.last_cycle_price ? "text-error" : "text-on-surface-variant/40"}>
                              {f.projected_ceiling_max > f.last_cycle_price ? "▲" : f.projected_ceiling_max < f.last_cycle_price ? "▼" : "•"}
                            </span>
                          )}
                        </span>
                        <span className="text-primary font-black tracking-tighter">${f.projected_ceiling_max.toLocaleString()}</span>
                      </div>
                      <div 
                        className="h-2 w-full bg-black/30 rounded-full overflow-hidden relative border border-white/5 cursor-help"
                        title={`Faction will reject all units priced above $${f.projected_ceiling_max.toLocaleString()}. Optimal price band: $${f.projected_ceiling_min.toLocaleString()} - $${f.projected_ceiling_max.toLocaleString()}.`}
                      >
                        <div 
                          className={`absolute h-full opacity-90 shadow-[0_0_12px_rgba(218,185,255,0.4)] transition-all duration-700 ${cfg.bar}`}
                          style={{ left: `${pricePctMin}%`, width: `${pricePctMax - pricePctMin}%` }}
                        />
                      </div>
                    </div>

                    {/* Strategic Insight */}
                    <div className="pt-3 border-t border-white/5">
                       <p className="text-[10px] leading-relaxed text-on-surface-variant/70 italic font-medium">
                         Strategy: {f.tier_preference === 'premium' ? 
                           "Focus on high-grade consistency. Volume is secondary to unit margin." : 
                           f.tier_preference === 'standard' ? 
                           "Balanced throughput required. Aim for median price range (~92%)." : 
                           "Mass production prioritized. Undercut competitors to clear inventory."}
                       </p>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 flex justify-between items-end relative z-10 border-t border-white/5">
                    <div className="flex flex-col gap-3 w-full">
                       <div className="flex justify-between items-center">
                          <div 
                            className="flex flex-col cursor-help"
                            title={`Flexibility: ${(f.flexibility * 100).toFixed(0)}%. Higher flexibility means this faction is more likely to buy lower-tier drones if their preferred tier is unavailable.`}
                          >
                            <span className="text-[7px] text-white/30 uppercase tracking-[0.2em] mb-1">Flexibility</span>
                           <div className="flex space-x-1">
                             {[1,2,3,4,5].map(d => (
                               <div key={d} className={`w-1 h-1 rounded-full ${f.flexibility * 5 >= d ? 'bg-primary' : 'bg-surface-highest'}`} />
                             ))}
                           </div>
                         </div>

                         <div className="text-right">
                            <span className="text-[7px] text-white/30 uppercase tracking-[0.2em] block mb-0.5">Brand Image</span>
                            <span className={`text-[10px] font-black font-mono uppercase ${isEligible ? 'text-primary' : 'text-error'}`}>{brandTier}</span>
                         </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                         <div className="flex items-center gap-2">
                           <div className={`px-1.5 py-0.5 border flex flex-col items-center justify-center min-w-[32px]
                               ${isEligible ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-error/10 border-error/30 text-error border-dashed'}`}>
                             <span className="text-[10px] font-black leading-tight">{f.brand_min}</span>
                             <span className="text-[6px] font-bold opacity-70 leading-tight">MIN</span>
                           </div>
                           <span className={`text-[9px] font-black uppercase tracking-widest ${isEligible ? 'text-primary' : 'text-error animate-pulse'}`}>
                             {isEligible ? 'ELIGIBLE' : 'LOCKED'}
                           </span>
                         </div>
                         {!isEligible && (
                           <span className="text-[8px] font-mono text-error/60 italic overflow-hidden whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                             Need +{(f.brand_min - brandScore).toFixed(0)}
                           </span>
                         )}
                      </div>
                   </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      <div className="flex-shrink-0 bg-surface-low border border-outline-variant p-4 font-mono text-xs font-semibold font-medium text-on-surface-variant flex justify-between items-center">
        <div className="space-x-4">
           <span className="font-bold text-primary">STRATEGY:</span> 
           <span>Aim for high brands to unlock Premium sectors.</span>
           <span>Use Rail for medium volume cross-sector transport.</span>
        </div>
        <div className="text-[10px] opacity-60 italic uppercase tracking-tighter">
          Timestamp: {new Date().toLocaleTimeString()} · Data Integrity Verified
        </div>
      </div>
    </div>
  );
};
