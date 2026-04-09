import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiClock } from 'react-icons/fi';

interface PhaseTimerProps {
  openedAt?: number | null;
  duration?: number | null;
  phase: string;
}

export const PhaseTimer: React.FC<PhaseTimerProps> = ({ openedAt, duration, phase }) => {
  const [now, setNow] = useState(Date.now() / 1000);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(timer);
  }, []);

  const { remaining, total, progress, isLow } = useMemo(() => {
    if (!openedAt || !duration || phase === 'game_over' || phase === 'no_active_game') {
      return { remaining: 0, total: 0, progress: 0, isLow: false };
    }
    const rem = Math.max(0, duration - (now - openedAt));
    const prog = (rem / duration) * 100;
    return {
      remaining: rem,
      total: duration,
      progress: prog,
      isLow: rem < 120 // Less than 2 minutes
    };
  }, [openedAt, duration, now, phase]);

  if (!openedAt || !duration || remaining <= 0 && phase === 'backroom') return null;
  if (phase === 'game_over' || phase === 'no_active_game' || phase === 'waiting_for_first_cycle') return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-end space-y-1 min-w-[120px]">
      <div className={`flex items-center space-x-2 font-mono text-xs font-bold transition-colors duration-500 ${isLow ? 'text-error animate-pulse' : 'text-on-surface-variant'}`}>
        <FiClock className={isLow ? 'text-error' : 'text-primary'} />
        <span className="tracking-tighter uppercase">{isLow ? 'Closing Soon' : 'Phase Timer'}</span>
        <span className="text-on-surface ml-1">{formatTime(remaining)}</span>
      </div>
      
      <div className="w-full h-1 bg-surface-highest rounded-full overflow-hidden border border-outline-variant/30">
        <motion.div
          initial={false}
          animate={{ 
            width: `${progress}%`,
            backgroundColor: isLow ? '#ffb4ab' : '#dab9ff'
          }}
          transition={{ duration: 1, ease: "linear" }}
          className="h-full rounded-full"
        />
      </div>
    </div>
  );
};
