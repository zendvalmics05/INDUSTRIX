import { useEffect, useMemo } from 'react';
import { useInventoryStore, useGameStore } from '../store';
import type { ComponentSlotData, MachineData } from '../types';

/** Bin a 101-element grade array into 10 bins of width 10 (1-10, 11-20, …, 91-100). Returns [scrap, ...10 bins]. */
function binGrades(arr: any): { scrap: number; bins: number[]; total: number } {
  // Ensure we have an array-like object. 
  // If it's a dict or sparse array, we want to handle it robustly.
  const getVal = (idx: number) => {
    if (!arr) return 0;
    const val = arr[idx];
    return typeof val === 'number' ? val : (parseInt(val) || 0);
  };

  const scrap = getVal(0);
  const bins: number[] = [];
  let usableTotal = 0;

  for (let b = 0; b < 10; b++) {
    let sum = 0;
    for (let g = b * 10 + 1; g <= (b + 1) * 10; g++) {
      sum += getVal(g);
    }
    bins.push(sum);
    usableTotal += sum;
  }
  
  return { scrap, bins, total: usableTotal };
}

const BIN_LABELS = ['1-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80', '81-90', '91-100'];

/** Compact inline histogram bar chart */
function GradeHistogram({ arr, label, color = 'primary' }: { arr: number[]; label: string; color?: string }) {
  const { scrap, bins, total } = useMemo(() => binGrades(arr), [arr]);
  const max = Math.max(...bins, 1);

  const colorMap: Record<string, { bar: string; text: string }> = {
    primary: { bar: 'bg-primary', text: 'text-primary' },
    tertiary: { bar: 'bg-tertiary', text: 'text-tertiary' },
    secondary: { bar: 'bg-secondary', text: 'text-secondary' },
    error: { bar: 'bg-error', text: 'text-error' },
  };
  const c = colorMap[color] || colorMap.primary;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs tracking-widest uppercase text-on-surface-variant">{label}</span>
        <span className="font-mono text-xs text-on-surface">{total} units</span>
      </div>
      <div className="flex items-end gap-[2px] h-10 bg-surface-highest/5 rounded-sm p-[2px] border border-outline-variant/10">
        {bins.map((count, i) => (
          <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
            <div
              className={`w-full ${c.bar} opacity-80 transition-all duration-200 hover:opacity-100 min-h-[2px]`}
              style={{ height: `${(count / max) * 100}%` }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-surface-highest border border-outline-variant px-2 py-1 text-xs font-mono whitespace-nowrap z-10 pointer-events-none">
              Grade {BIN_LABELS[i]}: {count}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] font-mono text-on-surface-variant">
        <span>1</span>
        <span>50</span>
        <span>100</span>
      </div>
      {scrap > 0 && (
        <div className="text-xs font-mono text-error">
          ⚠ {scrap} unusable (grade 0)
        </div>
      )}
    </div>
  );
}

/** Compact machine card */
function MachineCard({ m }: { m: MachineData }) {
  const condColor = m.condition > 70 ? 'text-primary' : m.condition > 30 ? 'text-tertiary' : 'text-error';
  return (
    <div className={`flex items-center justify-between px-3 py-2 border border-outline-variant/40 ${m.is_active ? 'bg-surface-highest/20' : 'bg-surface-low opacity-50'}`}>
      <div className="flex items-center gap-3">
        <span className="font-display text-xs tracking-wider uppercase text-on-surface">{m.tier}</span>
        {!m.is_active && <span className="text-error text-[10px] font-mono">DESTROYED</span>}
      </div>
      <div className="flex items-center gap-4 font-mono text-xs">
        <span className={condColor}>{m.condition.toFixed(0)}%</span>
        <span className="text-on-surface-variant">{m.throughput} u/c</span>
        {m.source !== 'seed' && <span className="text-on-surface-variant opacity-60">{m.source}</span>}
      </div>
    </div>
  );
}

/** One component section — raw + finished + machines */
function ComponentSection({ slot }: { slot: ComponentSlotData }) {
  const rawTotal = slot.raw_stock_total;
  const finTotal = slot.fin_stock_total;
  const activeMachines = slot.machines.filter(m => m.is_active);

  return (
    <div className="bg-surface-container border border-outline-variant p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-outline-variant pb-2">
        <h3 className="font-display text-sm uppercase tracking-widest text-on-surface">
          {slot.component.replace('_', ' ')}
        </h3>
        <div className="flex gap-4 font-mono text-xs text-on-surface-variant">
          <span>R&D: Q{slot.rnd_quality} C{slot.rnd_consistency} Y{slot.rnd_yield}</span>
          <span>{activeMachines.length} machine{activeMachines.length !== 1 ? 's' : ''}</span>
          <span>{slot.total_throughput} u/c</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <GradeHistogram arr={slot.raw_stock} label={`Raw Materials — ${rawTotal}`} color="tertiary" />
        <GradeHistogram arr={slot.finished_stock} label={`Finished Components — ${finTotal}`} color="primary" />
      </div>

      {slot.machines.length > 0 && (
        <div className="space-y-1">
          <span className="font-display text-[10px] tracking-widest uppercase text-on-surface-variant">MACHINES</span>
          {slot.machines.map(m => <MachineCard key={m.id} m={m} />)}
        </div>
      )}
    </div>
  );
}

export const Inventory = () => {
  const { phase } = useGameStore();
  const {
    funds, brandScore, brandTier, droneStockTotal, droneStock,
    components, hasGovLoan, workforceSize, skillLevel, morale, automationLevel,
    fetchInventory, scrapRejectUnits, fundsLedger, clearLedger
  } = useInventoryStore();

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory, phase]);

  const reversedLedger = useMemo(() => [...fundsLedger].reverse(), [fundsLedger]);
  const droneScrap = droneStock[0] || 0;
  const droneUsable = droneStockTotal - droneScrap;

  return (
    <div className="flex flex-col h-full space-y-6 pb-8">
      <h1 className="font-display text-4xl uppercase tracking-tighter">
        INVENTORY & LOGISTICS
      </h1>

      {/* ── Top metrics row ────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 max-w-6xl">
        <div className="bg-surface-container p-4 border border-outline-variant">
          <div className="text-on-surface-variant text-[10px] font-display uppercase tracking-widest mb-1">FUNDS</div>
          <div className={`font-display text-2xl ${funds < 0 ? 'text-error' : 'text-on-surface'}`}>
            ${funds.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-surface-container p-4 border border-outline-variant">
          <div className="text-on-surface-variant text-[10px] font-display uppercase tracking-widest mb-1">BRAND</div>
          <div className="font-display text-2xl text-on-surface">
            {brandScore.toFixed(1)} <span className="text-sm text-on-surface-variant">{brandTier.toUpperCase()}</span>
          </div>
        </div>
        <div className="bg-surface-container p-4 border border-outline-variant">
          <div className="text-on-surface-variant text-[10px] font-display uppercase tracking-widest mb-1">WORKFORCE</div>
          <div className="font-mono text-sm text-on-surface space-y-0.5">
            <div>{workforceSize} workers · Skill {skillLevel.toFixed(1)}</div>
            <div>Morale {morale.toFixed(1)} · {automationLevel.replace('_', ' ')}</div>
          </div>
        </div>
        <div className="bg-surface-container p-4 border border-outline-variant">
          <div className="text-on-surface-variant text-[10px] font-display uppercase tracking-widest mb-1">DRONES IN STOCK</div>
          <div className="font-display text-2xl text-on-surface">{droneStockTotal}</div>
          {hasGovLoan && <div className="text-error text-[10px] font-mono mt-1">GOV LOAN ACTIVE</div>}
        </div>
      </div>

      {/* ── Finished Drones grade distribution ─────────────────────── */}
      {droneStockTotal > 0 && (
        <div className="max-w-6xl bg-surface-low border border-outline-variant p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm uppercase tracking-widest text-[#978d9e]">
              FINISHED DRONES — QUALITY DISTRIBUTION
            </h2>
            {droneScrap > 0 && (
              <button
                onClick={() => scrapRejectUnits()}
                className="font-display text-[10px] tracking-widest uppercase text-error border border-error px-3 py-1 hover:bg-error hover:text-surface transition-colors"
              >
                SCRAP {droneScrap} REJECTS
              </button>
            )}
          </div>
          <GradeHistogram arr={droneStock} label={`${droneUsable} usable · ${droneScrap} scrap`} color="secondary" />
        </div>
      )}

      {/* ── Components ─────────────────────────────────────────────── */}
      <div className="max-w-6xl space-y-3">
        <h2 className="font-display text-sm uppercase tracking-widest text-[#978d9e] border-b border-outline-variant pb-2">
          COMPONENT INVENTORY
        </h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {components.map(slot => (
            <ComponentSection key={slot.component} slot={slot} />
          ))}
        </div>
      </div>

      {/* ── Financial Records ──────────────────────────────────────── */}
      <div className="max-w-6xl w-full">
        <div className="bg-surface-low border border-outline-variant p-6">
          <div className="flex items-center justify-between border-b border-outline-variant pb-3 mb-4">
            <h2 className="font-display text-sm uppercase tracking-widest text-[#978d9e]">
              FINANCIAL RECORDS
            </h2>
            {fundsLedger.length > 0 && (
              <button
                onClick={clearLedger}
                className="font-display text-[10px] tracking-widest uppercase text-on-surface-variant hover:text-error transition-colors border border-outline-variant px-3 py-1"
              >
                CLEAR
              </button>
            )}
          </div>

          {reversedLedger.length === 0 ? (
            <div className="text-on-surface-variant font-mono text-xs italic py-4 text-center">
              No fund movements recorded yet. Changes appear automatically.
            </div>
          ) : (
            <div className="overflow-y-auto max-h-56">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="text-on-surface-variant font-medium border-b border-outline-variant sticky top-0 bg-surface-low">
                    <th className="py-1.5 pl-2 font-normal w-28">TIME</th>
                    <th className="py-1.5 font-normal text-right w-36">CHANGE</th>
                    <th className="py-1.5 pr-2 font-normal text-right">BALANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {reversedLedger.map((entry, idx) => (
                    <tr
                      key={`${entry.timestamp}-${idx}`}
                      className={`${idx % 2 === 0 ? 'bg-surface-highest/10' : ''} hover:bg-surface-highest/30 transition-colors`}
                    >
                      <td className="py-1.5 pl-2 text-on-surface-variant">{entry.timestamp}</td>
                      <td className={`py-1.5 text-right font-semibold ${entry.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {entry.delta > 0 ? '+' : ''}{entry.delta.toLocaleString(undefined, { minimumFractionDigits: 2 })} CU
                      </td>
                      <td className={`py-1.5 pr-2 text-right ${entry.balance < 0 ? 'text-error' : 'text-on-surface'}`}>
                        ${entry.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Status warnings */}
      <div className="max-w-6xl space-y-2">
        {funds < 0 && (
          <div className="bg-surface-low border border-error p-3 font-mono text-xs text-error">
            ⚠ NEGATIVE FUND BALANCE — contact organiser immediately
          </div>
        )}
        {hasGovLoan && (
          <div className="bg-surface-low border border-outline-variant p-3 font-mono text-xs text-on-surface-variant">
            GOVERNMENT LOAN ACTIVE — backroom deals blocked. Brand score penalty active.
          </div>
        )}
      </div>
    </div>
  );
};
