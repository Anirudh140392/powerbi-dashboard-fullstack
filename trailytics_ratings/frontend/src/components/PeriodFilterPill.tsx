/**
 * Period Filter Pill - Floating Period Selector
 * Fixed position floating pill that controls global period filtering
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown, X } from 'lucide-react';
import type { PeriodKey } from '../types';
import { PERIOD_OPTIONS } from '../types';
import { formatDateRange } from '../utils/periodFilter';

interface PeriodFilterPillProps {
    selectedPeriod: PeriodKey;
    onPeriodChange: (period: PeriodKey) => void;
}

const PeriodFilterPill: React.FC<PeriodFilterPillProps> = ({
    selectedPeriod,
    onPeriodChange
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const pillRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pillRef.current && !pillRef.current.contains(event.target as Node)) {
                setIsExpanded(false);
            }
        };

        if (isExpanded) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isExpanded]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsExpanded(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    const currentPeriod = PERIOD_OPTIONS.find(p => p.key === selectedPeriod);

    return (
        <div
            ref={pillRef}
            className="fixed bottom-6 right-6 z-[1300]"
        >
            <AnimatePresence mode="wait">
                {!isExpanded ? (
                    // Collapsed State - Pill Button
                    <motion.button
                        key="collapsed"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsExpanded(true)}
                        className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-shadow cursor-pointer group"
                    >
                        <Calendar className="text-indigo-500" size={18} />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {currentPeriod?.shortLabel}
                        </span>
                        <ChevronDown
                            className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors"
                            size={16}
                        />
                    </motion.button>
                ) : (
                    // Expanded State - Period Selector
                    <motion.div
                        key="expanded"
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 20 }}
                        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden min-w-[320px]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                            <div className="flex items-center gap-2">
                                <Calendar className="text-indigo-500" size={18} />
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    Select Period
                                </span>
                            </div>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <X size={18} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Period Options */}
                        <div className="p-3 grid grid-cols-3 gap-2">
                            {PERIOD_OPTIONS.map((period) => (
                                <motion.button
                                    key={period.key}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        onPeriodChange(period.key);
                                        setIsExpanded(false);
                                    }}
                                    className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedPeriod === period.key
                                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                        }`}
                                >
                                    <div className="font-bold">{period.shortLabel}</div>
                                    <div className="text-xs opacity-80 mt-0.5">{period.label}</div>
                                </motion.button>
                            ))}
                        </div>

                        {/* Current Range Display */}
                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
                            <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
                                📅 {formatDateRange(selectedPeriod)}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PeriodFilterPill;
