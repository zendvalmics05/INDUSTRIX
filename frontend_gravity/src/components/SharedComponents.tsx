import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiInfo } from 'react-icons/fi';

export const Tooltip = ({ text, title, children, className = "inline-block" }: { text: React.ReactNode; title?: string; children?: React.ReactNode; className?: string }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left + rect.width / 2,
      });
    }
  };

  return (
    <div 
      ref={triggerRef}
      className={className}
      onMouseEnter={() => {
        updateCoords();
        setVisible(true);
      }}
      onMouseLeave={() => setVisible(false)}
    >
      {children || <FiInfo size={12} className="text-on-surface-variant cursor-help" />}
      {visible && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-200"
          style={{ 
            top: `${coords.top - 8}px`, 
            left: `${coords.left}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="w-64 bg-surface-highest border border-outline-variant p-3 shadow-2xl relative">
            {title && <div className="text-xs font-bold font-mono text-primary uppercase mb-1 tracking-widest">{title}</div>}
            <p className="text-xs font-mono text-on-surface leading-normal normal-case font-medium">{text}</p>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-outline-variant"></div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

import { DrawOutlineButton } from './DrawOutlineButton';

export const SendDecisionsButton = ({ 
  onClick, 
  disabled = false, 
  loading = false 
}: { 
  onClick: () => void; 
  disabled?: boolean;
  loading?: boolean;
}) => (
  <DrawOutlineButton
    onClick={onClick}
    disabled={disabled || loading}
  >
    {loading ? 'SENDING...' : 'SEND DECISIONS'}
  </DrawOutlineButton>
);

// Status Chip
export const StatusChip = ({ 
  label, 
  variant = 'active' 
}: { 
  label: string; 
  variant?: 'active' | 'warning' | 'error' | 'ghost'
}) => {
  const vMap = {
    active: 'bg-primary text-[#111417]',
    warning: 'bg-tertiary text-[#111417]',
    error: 'bg-error text-[#111417]',
    ghost: 'bg-surface-highest text-on-surface-variant'
  };
  return (
    <span className={`px-2 py-1 text-sm font-mono font-extrabold uppercase ${vMap[variant]}`}>
      {label}
    </span>
  );
};

// Metric Card
export const MetricCard = ({ 
  label, 
  value,
  subtext 
}: { 
  label: string; 
  value: string | number;
  subtext?: string;
}) => (
  <div className="bg-surface-container p-6 flex flex-col justify-between">
    <div className="text-on-surface-variant text-sm font-display font-semibold uppercase tracking-widest mb-4">
      {label}
    </div>
    <div className="text-on-surface font-display text-5xl font-bold">
      {value}
    </div>
    {subtext && (
      <div className="text-on-surface-variant text-sm mt-2">
        {subtext}
      </div>
    )}
  </div>
);

// Warning Banner
export const WarningBanner = ({ message }: { message: string }) => (
  <div className="bg-tertiary/10 border-l-4 border-tertiary p-3 my-4">
    <p className="text-on-surface text-base font-medium">{message}</p>
  </div>
);

// Component Tabs
import type { ComponentType } from '../types';
import { 
  MdArchitecture, 
  MdSettingsInputComponent, 
  MdFireExtinguisher,
  MdSensors,
  MdBatteryFull,
  MdRocket
} from 'react-icons/md';

const TABS: { id: ComponentType; label: string; icon: React.ReactNode }[] = [
  { id: 'airframe', label: 'AIRFRAME', icon: <MdArchitecture /> },
  { id: 'propulsion', label: 'PROPULSION', icon: <MdRocket /> },
  { id: 'avionics', label: 'AVIONICS', icon: <MdSettingsInputComponent /> },
  { id: 'fire_suppression', label: 'FIRE SUPPRESSION', icon: <MdFireExtinguisher /> },
  { id: 'sensing_safety', label: 'SENSING & SAFETY', icon: <MdSensors /> },
  { id: 'battery', label: 'BATTERY', icon: <MdBatteryFull /> },
];

export const ComponentTabs = ({ 
  selected, 
  onSelect 
}: { 
  selected: ComponentType; 
  onSelect: (c: ComponentType) => void;
}) => {
  return (
    <div className="flex bg-surface-low border-b border-outline-variant">
      {TABS.map(tab => {
        const isActive = selected === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-4 px-2 
              hover:bg-surface-highest transition-colors
              ${isActive ? 'bg-surface-highest border-b-2 border-primary' : 'bg-transparent text-on-surface-variant'}
            `}
          >
            <div className={`text-2xl mb-2 ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
              {tab.icon}
            </div>
            <span className={`text-xs font-display font-semibold uppercase tracking-widest ${isActive ? 'text-primary font-extrabold' : ''}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
