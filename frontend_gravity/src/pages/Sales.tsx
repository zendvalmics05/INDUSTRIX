import { useMemo, useState, useEffect } from 'react';
import { useGameStore, useInventoryStore } from '../store';
import { useNotificationStore } from '../store/useNotificationStore';
import { teamApi } from '../api';
import { SendDecisionsButton, WarningBanner } from '../components/SharedComponents';

type TierKey = 'reject' | 'substandard' | 'standard' | 'premium';
type SalesAction = 'sell_market' | 'sell_premium' | 'sell_discounted' | 'hold' | 'scrap' | 'black_market';

const DEFAULT_PRICES: Record<TierKey, number> = {
  reject: 200,
  substandard: 1400,
  standard: 3000,
  premium: 3000,
};

export const Sales = () => {
  const { phase } = useGameStore();
  const { brandScore, brandTier, droneBreakdown, fetchInventory } = useInventoryStore();
  const { addToast } = useNotificationStore();
  const [decisions, setDecisions] = useState<Record<TierKey, { action: SalesAction; price_override?: number | null }>>({
    reject: { action: 'scrap', price_override: null },
    substandard: { action: 'sell_discounted', price_override: 1400 },
    standard: { action: 'sell_market', price_override: null },
    premium: { action: 'sell_market', price_override: null },
  });
  const [unitsToAssemble, setUnitsToAssemble] = useState<number | null>(null);
  
  const [baselineDecisions, setBaselineDecisions] = useState<typeof decisions | null>(null);
  const [baselineUnits, setBaselineUnits] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('');

  const isSalesOpen = phase === 'sales_open';

  useEffect(() => {
    fetchInventory().catch(() => {});
    teamApi.getSales().then((data) => {
      const d = data?.decisions ?? {};
      const nextDecisions = {
        reject: d.reject || decisions.reject,
        substandard: d.substandard || decisions.substandard,
        standard: d.standard || decisions.standard,
        premium: d.premium || decisions.premium,
      };
      setDecisions(nextDecisions);
      setBaselineDecisions(nextDecisions);
      
      const u = data?.units_to_assemble ?? null;
      setUnitsToAssemble(u);
      setBaselineUnits(u);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTierCount = (tier: TierKey) => droneBreakdown[tier] || 0;

  const estimateByTier = (tier: TierKey) => {
    const count = getTierCount(tier);
    const d = decisions[tier];
    if (d.action === 'hold') return 0;
    if (d.action === 'scrap') return count * 200;
    if (d.action === 'black_market') return count * 600;
    if (d.action === 'sell_premium') return count * 4800;
    if (d.action === 'sell_discounted') return count * (d.price_override || DEFAULT_PRICES[tier]);
    return count * DEFAULT_PRICES[tier];
  };

  const totalEstimate = useMemo(
    () => (['reject', 'substandard', 'standard', 'premium'] as TierKey[]).reduce((sum, t) => sum + estimateByTier(t), 0),
    [decisions, droneBreakdown]
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
      
      if (unitsToAssemble !== baselineUnits) {
        payload.units_to_assemble = unitsToAssemble;
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

  return (
    <div className="flex flex-col h-full space-y-6">
      <h1 className="font-display text-3xl uppercase tracking-tighter">SALES & ASSEMBLY</h1>
      
      <div className="flex space-x-6">
        <div className="bg-surface-low border border-outline-variant p-4 font-mono text-sm flex-1">
          Brand score: {brandScore.toFixed(1)} · {brandTier.toUpperCase()} · Brand score affects your share of market demand.
        </div>
        
        <div className="bg-surface-low border border-outline-variant p-4 font-mono flex items-center space-x-4 w-1/3">
          <label className="text-xs text-on-surface-variant uppercase tracking-widest flex-1">UNITS TO ASSEMBLE</label>
          <input 
            type="number" min="0" step="1"
            value={unitsToAssemble === null ? '' : unitsToAssemble}
            onChange={e => setUnitsToAssemble(e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Max"
            disabled={!isSalesOpen}
            className="w-1/2 bg-surface text-xl border border-outline-variant p-2 text-primary text-right"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {(['reject', 'substandard', 'standard', 'premium'] as TierKey[]).map((tier) => (
          <div key={tier} className="bg-surface-container border border-outline-variant p-4 space-y-3">
            <div className="font-display text-sm uppercase tracking-widest">{tier}</div>
            <div className="font-mono text-xs text-on-surface-variant">Available: {getTierCount(tier)} units</div>
            <select
              className="w-full bg-surface-low border border-outline-variant p-2 font-mono text-sm"
              value={decisions[tier].action}
              disabled={!isSalesOpen}
              onChange={(e) => setDecisions((s) => ({ ...s, [tier]: { ...s[tier], action: e.target.value as SalesAction } }))}
            >
              {tier === 'reject' && (
                <>
                  <option value="scrap">scrap</option>
                  <option value="black_market">black_market</option>
                </>
              )}
              {tier !== 'reject' && (
                <>
                  <option value="sell_market">sell_market</option>
                  {tier === 'premium' && <option value="sell_premium">sell_premium</option>}
                  <option value="sell_discounted">sell_discounted</option>
                  <option value="hold">hold</option>
                  <option value="scrap">scrap</option>
                </>
              )}
            </select>
            {decisions[tier].action === 'sell_discounted' && (
              <input
                type="number"
                className="w-full bg-surface-low border border-outline-variant p-2 font-mono text-sm"
                value={decisions[tier].price_override ?? ''}
                onChange={(e) => setDecisions((s) => ({ ...s, [tier]: { ...s[tier], price_override: Number(e.target.value) } }))}
                disabled={!isSalesOpen}
                placeholder="price_override"
              />
            )}
            {tier === 'reject' && decisions.reject.action === 'black_market' && (
              <WarningBanner message="Black market sale: risk of discovery. If caught, fine = 3× revenue + severe brand hit." />
            )}
            <div className="font-mono text-xs text-on-surface-variant">Estimated revenue: ${estimateByTier(tier).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface-container border border-outline-variant p-4 flex items-center justify-between mt-auto">
        <div className="font-mono text-sm">
          Estimated total revenue: <span className="text-on-surface">${totalEstimate.toLocaleString()}</span>
        </div>
        <div className="w-64">
          <SendDecisionsButton onClick={onSubmit} disabled={!isSalesOpen} loading={saving} />
        </div>
      </div>
      <div className="font-mono text-xs text-on-surface-variant">
        Defaults if no submit: REJECT → scrap, SUBSTANDARD → sell discounted at 1,400 CU, STANDARD → sell at 3,000 CU, PREMIUM → sell at 3,000 CU.
      </div>
      {lastSavedAt && <div className="font-mono text-xs text-on-surface-variant">Last saved at {lastSavedAt}</div>}
    </div>
  );
};
