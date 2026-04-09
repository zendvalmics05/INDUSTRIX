import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertTriangle, FiShield, FiX } from 'react-icons/fi';

interface SecurityAlertOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
}

export const SecurityAlertOverlay: React.FC<SecurityAlertOverlayProps> = ({ isOpen, onClose, message }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
        >
          {/* Pulsing Red Background Glow */}
          <motion.div
            animate={{ 
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-error/20"
          />

          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 20 }}
            className="relative max-w-lg w-full bg-surface border-2 border-error p-8 shadow-[0_0_50px_rgba(255,0,0,0.3)] overflow-hidden"
          >
            {/* Warning Scan Line */}
            <motion.div 
              animate={{ y: [0, 300, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 left-0 w-full h-[2px] bg-error shadow-[0_0_15px_rgba(255,0,0,1)] z-0"
            />

            <div className="relative z-10">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-error text-surface p-4 rounded-full animate-pulse shadow-[0_0_20px_rgba(255,0,0,0.5)]">
                  <FiAlertTriangle size={48} />
                </div>
              </div>

              <h2 className="text-3xl font-display font-black text-error text-center uppercase tracking-tighter mb-4">
                Critical Security Breach
              </h2>

              <p className="font-mono text-sm text-center text-on-surface mb-8 leading-relaxed">
                {message || "Anomalies detected in internal operations. Asset reconciliation required. Our systems have been targetted by unknown hostile entities."}
              </p>

              <div className="bg-error/10 border border-error/30 p-4 mb-8 font-mono text-[10px] text-error flex items-start space-x-3">
                 <FiShield className="mt-1 shrink-0" />
                 <div>
                    <span className="font-bold uppercase block mb-1">Damage Report:</span>
                    <ul className="list-disc list-inside space-y-1 opacity-80 uppercase">
                       <li>Raw material supply chain disrupted</li>
                       <li>Factory throughput synchronization lost</li>
                       <li>Confidential telemetry intercepted</li>
                    </ul>
                 </div>
              </div>

              <button
                onClick={onClose}
                className="w-full bg-error text-surface font-display py-4 tracking-[0.3em] uppercase font-bold hover:bg-error/80 transition-colors flex items-center justify-center space-x-3"
              >
                <span>Acknowledge Breach</span>
                <FiX />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
