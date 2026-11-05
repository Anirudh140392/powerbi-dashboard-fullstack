/**
 * NotificationBell — header dropdown showing in-app alert notifications.
 * Sits next to the AvatarMenu, mirrors its size/glass styling.
 *
 * Auto-polls every 60s. Click outside / Escape to close. Clicking a notif
 * marks it read and navigates to the linked tab/sub (e.g. Rules → Events).
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellRing, CheckCheck, X, AlertTriangle } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import type { Notification } from '../types/automation';

function timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d`;
    return new Date(iso).toLocaleDateString();
}

export function NotificationBell({ enabled }: { enabled: boolean }) {
    const { notifications, unreadCount, markRead, markAllRead, dismiss } = useNotifications(enabled);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

    useEffect(() => {
        if (!open) return;
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
        }
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                // Also ignore clicks inside the portal dropdown itself
                const portalEl = document.getElementById('notif-dropdown-portal');
                if (portalEl && portalEl.contains(e.target as Node)) return;
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (!enabled) return null;

    const handleClick = (n: Notification) => {
        if (!n.read_at) markRead(n.id);
        if (n.link_url) {
            setOpen(false);
            window.location.assign(n.link_url);
        }
    };

    const dropdown = open && dropdownPos && (
        <div
            id="notif-dropdown-portal"
            style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }}
        >
            <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="w-80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <BellRing size={14} className="text-indigo-500" /> Notifications
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); markAllRead(); }}
                            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                        >
                            <CheckCheck size={11} /> Mark all read
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="px-3 py-8 text-center text-xs text-slate-500">
                            <Bell size={20} className="mx-auto mb-2 opacity-40" />
                            No notifications yet.
                            <div className="text-[10px] mt-1">In-app alerts from rules with the in-app action will land here.</div>
                        </div>
                    ) : (
                        notifications.map((n) => {
                            const isUnread = !n.read_at;
                            return (
                                <div
                                    key={n.id}
                                    className={`relative px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0 cursor-pointer transition-colors group
                                        ${isUnread
                                            ? 'bg-indigo-50/40 dark:bg-indigo-900/10 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                    onClick={() => handleClick(n)}
                                >
                                    <div className="flex items-start gap-2">
                                        {isUnread && <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                                        <div className={`shrink-0 ${isUnread ? 'mt-0' : 'mt-0.5 ml-3'}`}>
                                            <AlertTriangle size={13} className="text-rose-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-xs leading-snug ${isUnread ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'} truncate`}>
                                                {n.title}
                                            </div>
                                            {n.body && (
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.body}</div>
                                            )}
                                            <div className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)} ago</div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all"
                                            title="Dismiss"
                                        >
                                            <X size={11} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 text-center">
                    Rules with the <strong className="text-slate-700 dark:text-slate-200">in-app</strong> action write here.
                </div>
            </motion.div>
        </div>
    );

    return (
        <>
            <div ref={ref} className="relative">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setOpen(v => !v)}
                    title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Notifications'}
                    className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200/40 dark:border-slate-700/40"
                >
                    {unreadCount > 0 ? <BellRing size={15} className="text-indigo-500" /> : <Bell size={15} className="text-slate-500 dark:text-slate-400" />}
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </motion.button>
            </div>
            <AnimatePresence>
                {dropdown && createPortal(dropdown, document.body)}
            </AnimatePresence>
        </>
    );
}
