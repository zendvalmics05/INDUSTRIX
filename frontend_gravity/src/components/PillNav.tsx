import { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import gsap from 'gsap';

interface PillNavItem {
  label: string;
  href: string;
}

interface PillNavProps {
  items: PillNavItem[];
  activeHref: string;
  onNavigate: (href: string) => void;
  ease?: string;
  pillColor?: string;
  pillTextColor?: string;
  baseColor?: string;
  hoveredPillTextColor?: string;
  initialLoadAnimation?: boolean;
  className?: string;
  badges?: Record<string, number>;
}

export const PillNav = ({
  items,
  activeHref,
  onNavigate,
  ease = 'power3.out',
  pillColor = '#dab9ff',
  pillTextColor = '#111417',
  baseColor = '#cec2d5',
  hoveredPillTextColor = '#111417',
  initialLoadAnimation = true,
  className = '',
  badges = {},
}: PillNavProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hasAnimatedRef = useRef(false);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const getActiveIdx = useCallback(() => {
    const idx = items.findIndex(i => i.href === activeHref);
    return idx === -1 ? 0 : idx;
  }, [items, activeHref]);

  // Get the position of a button relative to the container
  const getElPosition = useCallback((el: HTMLButtonElement) => {
    const container = containerRef.current;
    if (!container) return null;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    return {
      left: eRect.left - cRect.left,
      width: eRect.width,
    };
  }, []);

  // Animate pill to a given button element — kills any in-flight tween first
  const animatePillTo = useCallback(
    (el: HTMLButtonElement, duration = 0.4) => {
      const pill = pillRef.current;
      if (!pill) return;

      const pos = getElPosition(el);
      if (!pos) return;

      // Kill any previous tween to prevent fighting
      if (tweenRef.current) {
        tweenRef.current.kill();
      }

      tweenRef.current = gsap.to(pill, {
        left: pos.left,
        width: pos.width,
        duration,
        ease,
        overwrite: true,
      });
    },
    [ease, getElPosition]
  );

  // Position the pill on first render — use layoutEffect so it's placed before paint
  useLayoutEffect(() => {
    if (hasAnimatedRef.current) return;

    const activeIdx = getActiveIdx();
    const el = itemRefs.current[activeIdx];
    const pill = pillRef.current;
    if (!el || !pill) return;

    const pos = getElPosition(el);
    if (!pos) return;

    if (initialLoadAnimation) {
      // Start collapsed at center of the active item
      gsap.set(pill, {
        left: pos.left + pos.width / 2,
        width: 0,
        opacity: 0,
      });
      gsap.to(pill, {
        left: pos.left,
        width: pos.width,
        opacity: 1,
        duration: 0.6,
        ease: 'power2.out',
        delay: 0.1,
      });
    } else {
      gsap.set(pill, {
        left: pos.left,
        width: pos.width,
      });
    }

    hasAnimatedRef.current = true;
  }, [getActiveIdx, getElPosition, initialLoadAnimation]);

  // Move pill when the active route changes (e.g. after clicking)
  useEffect(() => {
    if (!hasAnimatedRef.current) return;
    // Only snap to active when not hovering
    if (hoveredIdx !== null) return;

    const activeIdx = getActiveIdx();
    const el = itemRefs.current[activeIdx];
    if (el) animatePillTo(el, 0.45);
  }, [activeHref, getActiveIdx, animatePillTo, hoveredIdx]);

  // ── Handlers ──

  const handlePointerEnter = (idx: number) => {
    setHoveredIdx(idx);
    const el = itemRefs.current[idx];
    if (el) animatePillTo(el, 0.3);
  };

  const handleContainerLeave = () => {
    setHoveredIdx(null);
    const activeIdx = getActiveIdx();
    const el = itemRefs.current[activeIdx];
    if (el) animatePillTo(el, 0.35);
  };

  const handleClick = (href: string) => {
    onNavigate(href);
  };

  const activeIdx = getActiveIdx();

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center bg-surface-highest/60 rounded-full px-1.5 py-1.5 backdrop-blur-sm border border-outline-variant/40 ${className}`}
      onPointerLeave={handleContainerLeave}
    >
      {/* Animated pill — positioned absolutely, moved via GSAP `left` + `width` */}
      <div
        ref={pillRef}
        className="absolute top-1.5 bottom-1.5 rounded-full pointer-events-none will-change-[left,width] border border-white/10"
        style={{
          backgroundColor: pillColor,
          boxShadow: '0 0 16px rgba(218, 185, 255, 0.12), inset 0 0 8px rgba(218, 185, 255, 0.06)',
          left: 0,
          width: 0,
        }}
      />

      {/* Nav items */}
      {items.map((item, idx) => {
        const isActive = idx === activeIdx;
        const isHovered = idx === hoveredIdx;
        // When hovering, only the hovered item gets pill text color
        // When not hovering, only the active item gets pill text color
        const isOnPill = hoveredIdx !== null ? isHovered : isActive;

        return (
          <button
            key={item.href}
            ref={el => { itemRefs.current[idx] = el; }}
            onClick={() => handleClick(item.href)}
            onPointerEnter={() => handlePointerEnter(idx)}
            className="relative z-10 px-5 py-2.5 font-display text-sm font-bold tracking-[0.15em] uppercase whitespace-nowrap select-none"
            style={{
              color: isOnPill ? (isActive ? pillTextColor : hoveredPillTextColor) : baseColor,
              transition: 'color 0.15s ease',
            }}
          >
            {item.label}
            {badges[item.href] != null && badges[item.href] > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
                style={{
                  backgroundColor: '#efc050',
                  boxShadow: '0 0 8px rgba(234,179,8,0.8)',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
