/**
 * Avatar dropdown — consolidates theme toggle / Rules shortcut / sign-out
 * into a single header control. Frees ~120px of horizontal space so the
 * top-nav can carry the 6 primary tabs without wrapping on 1280px screens.
 *
 * Closes on outside-click and on Escape.
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Settings, ChevronDown, Shield, ShieldCheck, User as UserIcon, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SecurityModal } from './auth/SecurityModal';

interface Props {
    isDarkMode: boolean;
    onToggleTheme: () => void;
    onOpenRules: () => void;
}

function initialsFor(name: string | undefined | null): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AvatarMenu({ isDarkMode, onToggleTheme, onOpenRules }: Props) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [securityOpen, setSecurityOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (!user) return null;
    const isSuperAdmin = user.role === 'super_admin';
    const isAdmin = isSuperAdmin || user.role === 'company_admin';

    return (
        <div ref={ref} className="relative">
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setOpen(v => !v)}
                title={user.displayName}
                className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200/40 dark:border-slate-700/40"
            >
                <span className="w-7 h-7 rounded-lg bg-indigo-500 text-white text-[11px] font-semibold flex items-center justify-center">
                    {initialsFor(user.displayName)}
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 hidden md:inline max-w-[120px] truncate">
                    {user.displayName}
                </span>
                <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden z-50"
                    >
                        {/* User identity panel */}
                        <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                            <span className="w-9 h-9 rounded-lg bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center shrink-0">
                                {initialsFor(user.displayName)}
                            </span>
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.displayName}</div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
                            </div>
                        </div>

                        {/* Identity badge row */}
                        <div className="px-3 py-2 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800">
                            {isSuperAdmin ? (
                                <span className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider inline-flex items-center gap-1">
                                    <Crown size={9} /> Super Admin
                                </span>
                            ) : isAdmin ? (
                                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider inline-flex items-center gap-1">
                                    <Shield size={9} /> Admin
                                </span>
                            ) : (
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-medium uppercase tracking-wider inline-flex items-center gap-1">
                                    <UserIcon size={9} /> {user.role || 'Viewer'}
                                </span>
                            )}
                        </div>

                        {/* Action items */}
                        <button
                            onClick={() => { setOpen(false); onToggleTheme(); }}
                            className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            {isDarkMode ? <Sun size={15} className="text-amber-500" /> : <Moon size={15} className="text-indigo-500" />}
                            <span className="flex-1">{isDarkMode ? 'Light mode' : 'Dark mode'}</span>
                        </button>

                        <button
                            onClick={() => { setOpen(false); setSecurityOpen(true); }}
                            className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <ShieldCheck size={15} className="text-indigo-500" />
                            <span className="flex-1">Security</span>
                        </button>

                        <button
                            onClick={() => { setOpen(false); onOpenRules(); }}
                            className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <Settings size={15} className="text-slate-500" />
                            <span className="flex-1">Rules &amp; Settings</span>
                        </button>

                    </motion.div>
                )}
            </AnimatePresence>
            <SecurityModal open={securityOpen} onClose={() => setSecurityOpen(false)} />
        </div>
    );
}
