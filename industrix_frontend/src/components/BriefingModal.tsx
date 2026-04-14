import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiFileText, FiTrendingUp, FiTrendingDown, FiActivity,
  FiZap, FiGlobe, FiX, FiCheckCircle, FiInfo, FiAlertTriangle
} from 'react-icons/fi';
import type { CycleBriefingOut } from '../types';

interface BriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CycleBriefingOut | null;
}

export const BriefingModal: React.FC<BriefingModalProps> = ({ isOpen, onClose, data }) => {
  if (!data) return null;

  const stats = data.last_cycle_stats;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative max-w-4xl w-full bg-surface-low border border-outline-variant shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between bg-surface-high">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <FiFileText size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-display font-black uppercase tracking-tighter">Cycle {data.cycle_number} Briefing</h2>
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase">Intelligence Digest & Operational Summary</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-surface-highest transition-colors rounded-full text-on-surface-variant">
                <FiX size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">

              {/* Last Cycle Recap */}
              {stats && (
                <section>
                  <div className="flex items-center space-x-3 mb-6">
                    <h3 className="text-xs font-mono font-bold text-secondary uppercase tracking-[0.2em]">Recap: Cycle {stats.cycle_number} Performance</h3>
                    <div className="h-[1px] flex-1 bg-outline-variant/30"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-surface-high p-4 border border-outline-variant/20 rounded-sm">
                      <span className="text-[9px] font-mono text-on-surface-variant uppercase block mb-1">Net Outcome</span>
                      <div className={`text-xl font-display font-black ${stats.net_profit >= 0 ? 'text-primary' : 'text-error'}`}>
                        {stats.net_profit >= 0 ? '+' : ''}${Math.abs(stats.net_profit).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-surface-high p-4 border border-outline-variant/20 rounded-sm">
                      <span className="text-[9px] font-mono text-on-surface-variant uppercase block mb-1">Total Revenue</span>
                      <div className="text-xl font-display font-black text-on-surface">
                        ${stats.revenue.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-surface-high p-4 border border-outline-variant/20 rounded-sm">
                      <span className="text-[9px] font-mono text-on-surface-variant uppercase block mb-1">Units Sold</span>
                      <div className="text-xl font-display font-black text-on-surface">
                        {stats.units_sold} <span className="text-[10px] text-on-surface-variant">units</span>
                      </div>
                    </div>
                    <div className="bg-surface-high p-4 border border-outline-variant/20 rounded-sm">
                      <span className="text-[9px] font-mono text-on-surface-variant uppercase block mb-1">Brand Shift</span>
                      <div className={`flex items-center space-x-2 text-xl font-display font-black ${stats.brand_delta >= 0 ? 'text-primary' : 'text-error'}`}>
                        {stats.brand_delta >= 0 ? <FiTrendingUp size={16} /> : <FiTrendingDown size={16} />}
                        <span>{stats.brand_delta > 0 ? '+' : ''}{stats.brand_delta}</span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Operational Updates */}
              <section>
                <div className="flex items-center space-x-3 mb-6">
                  <h3 className="text-xs font-mono font-bold text-secondary uppercase tracking-[0.2em]">Operational Intelligence</h3>
                  <div className="h-[1px] flex-1 bg-outline-variant/30"></div>
                </div>

                <div className="space-y-4">
                  {data.operational_updates.length > 0 ? (
                    data.operational_updates.map((update, i) => (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i}
                        className="flex items-start space-x-4 p-4 bg-surface-lowest border-l-4 border-primary/50"
                      >
                        <div className="mt-1 text-primary">
                          {update.type === 'rnd' ? <FiZap size={18} /> : <FiActivity size={18} />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-on-surface uppercase tracking-tight">{update.title}</h4>
                          <p className="text-xs text-on-surface-variant leading-relaxed">{update.description}</p>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-on-surface-variant font-mono italic">No major operational changes reported during cycle transition.</p>
                  )}
                </div>
              </section>

              {/* Market Intelligence */}
              <section>
                <div className="flex items-center space-x-3 mb-6">
                  <h3 className="text-xs font-mono font-bold text-secondary uppercase tracking-[0.2em]">Global Market Digest</h3>
                  <div className="h-[1px] flex-1 bg-outline-variant/30"></div>
                </div>

                <div className="space-y-4">
                  {data.market_intelligence.length > 0 ? (
                    data.market_intelligence.map((intel, i) => (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                        key={i}
                        className={`flex items-start space-x-4 p-4 ${intel.severity === 'warning' ? 'bg-error/5 border-l-4 border-error/50' :
                            intel.severity === 'success' ? 'bg-primary/5 border-l-4 border-primary/50' :
                              'bg-surface-lowest border-l-4 border-on-surface-variant/30'
                          }`}
                      >
                        <div className={`mt-1 ${intel.severity === 'warning' ? 'text-error' :
                            intel.severity === 'success' ? 'text-primary' :
                              'text-on-surface-variant'
                          }`}>
                          {intel.severity === 'warning' ? <FiAlertTriangle size={18} /> :
                            intel.severity === 'success' ? <FiCheckCircle size={18} /> :
                              <FiInfo size={18} />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-on-surface uppercase tracking-tight">{intel.title}</h4>
                          <p className="text-xs text-on-surface-variant leading-relaxed">{intel.message}</p>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="bg-surface-lowest p-6 flex flex-col items-center justify-center border border-dashed border-outline-variant/40 rounded-lg">
                      <FiGlobe className="text-on-surface-variant/20 mb-2" size={32} />
                      <p className="text-xs text-on-surface-variant font-mono">Market conditions remain stable. No major fluctuations detected.</p>
                    </div>
                  )}
                </div>
              </section>

            </div>

            {/* Footer */}
            <div className="p-6 bg-surface-high border-t border-outline-variant/30 flex justify-end">
              <button
                onClick={onClose}
                className="px-8 py-3 bg-primary text-surface font-display font-black uppercase tracking-widest hover:bg-primary-dim transition-all shadow-lg active:scale-95"
              >
                Acknowledge & Sync
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
