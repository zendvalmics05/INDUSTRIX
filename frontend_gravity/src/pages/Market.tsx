import { useEffect, useState } from 'react';
import { teamApi } from '../api';
import type { MarketFaction } from '../types';
import { useGameStore } from '../store';

export const Market = () => {
  const { phase } = useGameStore();
  const [factions, setFactions] = useState<MarketFaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teamApi.getMarket()
      .then(data => setFactions(data.factions || []))
      .catch(err => console.error("Could not fetch market data:", err))
      .finally(() => setLoading(false));
  }, [phase]);

  return (
    <div className="flex flex-col h-full space-y-8">
      <div>
        <h1 className="font-display text-4xl uppercase tracking-tighter">MARKET ANALYSIS</h1>
        <p className="font-mono text-base font-semibold text-on-surface-variant mt-2">
          Current market factions and their buying parameters. Use this to inform your production and pricing strategies.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-on-surface-variant font-mono">LOADING MARKET DATA...</div>
        ) : factions.length === 0 ? (
          <div className="col-span-full py-12 text-center text-on-surface-variant font-mono">NO ACTIVE MARKET FACTIONS IN THIS PHASE</div>
        ) : (
          factions.map(faction => (
            <div key={faction.id} className="bg-surface-container border border-outline-variant flex flex-col h-full">
              <div className="bg-surface-highest p-4 border-b border-outline-variant flex justify-between items-center">
                <h2 className="font-display text-3xl font-bold font-bold uppercase tracking-widest text-primary">{faction.name}</h2>
              </div>
              <div className="p-6 space-y-4 font-mono text-base font-semibold flex-1">
                <div className="flex justify-between items-end border-b border-outline-variant/30 pb-2">
                  <span className="text-on-surface-variant text-base font-semibold font-medium uppercase">Preferred Tier</span>
                  <span className="text-on-surface font-bold capitalize">{faction.tier_preference}</span>
                </div>
                <div className="flex justify-between items-end border-b border-outline-variant/30 pb-2">
                  <span className="text-on-surface-variant text-base font-semibold font-medium uppercase">Price Ceiling</span>
                  <span className="text-primary">${faction.price_ceiling.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-end border-b border-outline-variant/30 pb-2">
                  <span className="text-on-surface-variant text-base font-semibold font-medium uppercase">Target Volume</span>
                  <span className="text-on-surface">{faction.volume.toLocaleString()} units</span>
                </div>
                <div className="flex justify-between items-end border-b border-outline-variant/30 pb-2">
                  <span className="text-on-surface-variant text-base font-semibold font-medium uppercase">Min Brand Score</span>
                  <span className="text-on-surface">{faction.brand_min > 0 ? faction.brand_min : 'None'}</span>
                </div>
                <div className="flex justify-between items-end pb-2">
                  <span className="text-on-surface-variant text-base font-semibold font-medium uppercase">Flexibility</span>
                  <span className="text-on-surface">
                    {faction.flexibility === 0 ? 'Rigid (0)' : faction.flexibility === 1 ? 'Any Tier (1)' : faction.flexibility.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-surface-low border border-outline-variant p-4 font-mono text-base font-semibold font-medium text-on-surface-variant mt-auto">
        <span className="font-bold">Tips:</span> Factions buy their preferred tier first. If supply runs out, they may buy lower tiers depending on their flexibility. If your brand score is below their minimum, they will not buy from you.
      </div>
    </div>
  );
};
