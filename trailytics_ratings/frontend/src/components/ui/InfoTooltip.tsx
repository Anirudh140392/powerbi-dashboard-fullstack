/**
 * InfoTooltip — Reusable ? icon with hover tooltip panel
 * Reads definition from tooltipDefinitions.ts — no inline text.
 * Supports configurable placement (top | bottom | left | right).
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { TooltipDef } from '../../config/tooltipDefinitions';

interface InfoTooltipProps {
    definition: TooltipDef;
    /** Preferred position — auto-flips if near viewport edge */
    placement?: 'top' | 'bottom' | 'left' | 'right';
    size?: 'sm' | 'md';
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({
    definition,
    placement = 'bottom',
    size = 'sm',
}) => {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' | 'left' | 'right' }>({
        top: 0,
        left: 0,
        placement,
    });
    const btnRef = useRef<HTMLButtonElement>(null);
    const tooltipWidth = 272; // px
    const tooltipHeightEstimate = 180;

    const showTooltip = () => {
        if (!btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        const gap = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let top = 0;
        let left = 0;
        let resolvedPlacement = placement;

        // Determine preferred placement, simple logic
        if (placement === 'bottom') {
            top = rect.bottom + gap;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            if (top + tooltipHeightEstimate > vh - 8) {
                resolvedPlacement = 'top';
                top = rect.top - tooltipHeightEstimate - gap;
            }
        } else if (placement === 'top') {
            top = rect.top - tooltipHeightEstimate - gap;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            if (top < 8) {
                resolvedPlacement = 'bottom';
                top = rect.bottom + gap;
            }
        } else if (placement === 'right') {
            top = rect.top + rect.height / 2 - tooltipHeightEstimate / 2;
            left = rect.right + gap;
            if (left + tooltipWidth > vw - 8) {
                resolvedPlacement = 'left';
                left = rect.left - tooltipWidth - gap;
            }
        } else {
            top = rect.top + rect.height / 2 - tooltipHeightEstimate / 2;
            left = rect.left - tooltipWidth - gap;
            if (left < 8) {
                resolvedPlacement = 'right';
                left = rect.right + gap;
            }
        }

        // Clamp horizontally
        left = Math.max(8, Math.min(left, vw - tooltipWidth - 8));
        top = Math.max(8, Math.min(top, vh - tooltipHeightEstimate - 8));

        setCoords({ top, left, placement: resolvedPlacement });
        setVisible(true);
    };

    const hideTooltip = () => setVisible(false);

    // Close on scroll
    useEffect(() => {
        if (!visible) return;
        const onScroll = () => setVisible(false);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [visible]);

    const iconSize = size === 'sm' ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[10px]';

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                aria-label={`Info: ${definition.title}`}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
                className={`${iconSize} inline-flex items-center justify-center rounded-full
                    bg-slate-200 dark:bg-slate-700
                    text-slate-500 dark:text-slate-400
                    hover:bg-indigo-100 dark:hover:bg-indigo-900/40
                    hover:text-indigo-600 dark:hover:text-indigo-400
                    font-bold cursor-help transition-colors duration-150 shrink-0 select-none`}
            >
                ?
            </button>

            {createPortal(
                <AnimatePresence>
                    {visible && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: coords.placement === 'top' ? 4 : -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: coords.placement === 'top' ? 4 : -4 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            style={{
                                position: 'fixed',
                                top: coords.top,
                                left: coords.left,
                                width: tooltipWidth,
                                zIndex: 9999,
                            }}
                            className="pointer-events-none"
                        >
                            {/* Arrow */}
                            {coords.placement === 'bottom' && (
                                <div
                                    style={{ left: tooltipWidth / 2 - 6 }}
                                    className="absolute -top-1.5 w-3 h-1.5 overflow-hidden"
                                >
                                    <div className="w-3 h-3 bg-slate-900 dark:bg-slate-800 rotate-45 origin-bottom-left shadow" />
                                </div>
                            )}

                            {/* Panel */}
                            <div className="rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-700/60 dark:border-slate-600/40 shadow-2xl p-3.5">
                                {/* Title */}
                                <p className="text-[11px] font-bold text-white mb-1.5 flex items-center gap-1.5">
                                    <span className="w-1 h-3 rounded-full bg-indigo-400 inline-block" />
                                    {definition.title}
                                </p>
                                {/* Body */}
                                <p className="text-[10.5px] text-slate-300 leading-relaxed">
                                    {definition.body}
                                </p>
                                {/* Optional bullets */}
                                {definition.bullets && definition.bullets.length > 0 && (
                                    <ul className="mt-2 space-y-1">
                                        {definition.bullets.map((b, i) => (
                                            <li
                                                key={i}
                                                className="text-[10px] text-slate-400 flex items-start gap-1.5"
                                            >
                                                <span className="mt-0.5 w-1 h-1 rounded-full bg-indigo-400/70 shrink-0" />
                                                {b}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};

export default InfoTooltip;
