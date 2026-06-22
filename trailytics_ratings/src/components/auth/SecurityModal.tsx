/**
 * Security profile modal — launched from the Avatar dropdown.
 *
 * Shows MFA status, lets the user regenerate backup codes (after typing a
 * fresh TOTP code), change their password, and open the setup-help walkthrough.
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, KeyRound, RefreshCw, AlertCircle, Check, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { authenticatedFetch } from '../../utils/auth';
import { MfaSetupHelp } from './MfaSetupHelp';
import { MfaBackupCodes } from './MfaBackupCodes';

interface Props {
    open: boolean;
    onClose: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

interface MfaStatus {
    enrolled: boolean;
    enrolledAt: string | null;
    remainingBackupCodes: number;
}

type View = 'main' | 'regen' | 'codes' | 'password';

export function SecurityModal({ open, onClose }: Props) {
    const [status, setStatus] = useState<MfaStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<View>('main');
    const [helpOpen, setHelpOpen] = useState(false);
    const [error, setError] = useState('');

    // Regen-codes form
    const [regenCode, setRegenCode] = useState('');
    const [regenSubmitting, setRegenSubmitting] = useState(false);
    const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);

    // Change-password form
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [pwSubmitting, setPwSubmitting] = useState(false);
    const [pwSuccess, setPwSuccess] = useState(false);

    useEffect(() => {
        if (!open) return;
        setView('main');
        setError('');
        setPwSuccess(false);
        loadStatus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    async function loadStatus() {
        setLoading(true);
        try {
            const r = await authenticatedFetch(`${API_BASE}/api/auth/mfa/status`);
            const payload = await r.json().catch(() => null);
            setStatus(payload || null);
        } finally {
            setLoading(false);
        }
    }

    async function regenerate(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setRegenSubmitting(true);
        try {
            const r = await authenticatedFetch(`${API_BASE}/api/auth/mfa/backup-codes/regenerate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: regenCode.trim() }),
            });
            const payload = await r.json().catch(() => null);
            if (!r.ok) { setError(payload?.error || 'Could not regenerate codes.'); return; }
            setNewBackupCodes(payload.backupCodes || []);
            setView('codes');
            setRegenCode('');
            loadStatus();
        } finally {
            setRegenSubmitting(false);
        }
    }

    async function changePassword(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
        if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
        setPwSubmitting(true);
        try {
            const r = await authenticatedFetch(`${API_BASE}/api/auth/password/change`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const payload = await r.json().catch(() => null);
            if (!r.ok) { setError(payload?.error || 'Could not change password.'); return; }
            setPwSuccess(true);
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } finally {
            setPwSubmitting(false);
        }
    }

    const modal = (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={onClose}
                    className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 10 }}
                        transition={{ duration: 0.2 }}
                        onClick={e => e.stopPropagation()}
                        className="relative w-full max-w-md my-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl"
                    >
                        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Close">
                            <X size={16} />
                        </button>

                        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <ShieldCheck size={17} className="text-indigo-500" />
                                Security
                            </h2>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Two-factor sign-in and password</p>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 text-xs">
                                    <AlertCircle size={13} className="shrink-0" />
                                    {error}
                                </div>
                            )}

                            {view === 'main' && (
                                <>
                                    {/* MFA status card */}
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                    Two-factor authentication
                                                    {status?.enrolled && (
                                                        <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">On</span>
                                                    )}
                                                </div>
                                                {loading ? (
                                                    <div className="text-[11px] text-slate-500 mt-1">Loading...</div>
                                                ) : status?.enrolled ? (
                                                    <>
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                                            Enrolled {status.enrolledAt ? new Date(status.enrolledAt).toLocaleDateString() : '—'}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            {status.remainingBackupCodes} of 10 backup codes remaining
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Not enabled — sign out and back in to enrol.</div>
                                                )}
                                            </div>
                                            <button onClick={() => setHelpOpen(true)} title="Setup help" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                <HelpCircle size={14} />
                                            </button>
                                        </div>
                                        {status?.enrolled && (
                                            <button
                                                onClick={() => { setView('regen'); setError(''); }}
                                                className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 transition-colors"
                                            >
                                                <RefreshCw size={12} /> Regenerate backup codes
                                            </button>
                                        )}
                                    </div>

                                    {/* Password card */}
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5">
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">Password</div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Change your sign-in password.</div>
                                        <button
                                            onClick={() => { setView('password'); setError(''); setPwSuccess(false); }}
                                            className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 transition-colors"
                                        >
                                            <KeyRound size={12} /> Change password
                                        </button>
                                    </div>

                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed text-center px-4 py-2">
                                        Lost your phone and backup codes? Contact{' '}
                                        <a href="mailto:saurabh.j@trailytics.com" className="underline">saurabh.j@trailytics.com</a> to have your MFA reset.
                                    </div>
                                </>
                            )}

                            {view === 'regen' && (
                                <form onSubmit={regenerate} className="space-y-3">
                                    <button onClick={() => setView('main')} className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">← Back</button>
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">Regenerate backup codes</div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Your existing codes will stop working. Enter your current 6-digit code to continue.</p>
                                    </div>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={regenCode}
                                        onChange={e => setRegenCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="6-digit code"
                                        autoFocus
                                        required
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    />
                                    <button
                                        type="submit"
                                        disabled={regenCode.length !== 6 || regenSubmitting}
                                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {regenSubmitting ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Generating...
                                            </>
                                        ) : 'Generate new codes'}
                                    </button>
                                </form>
                            )}

                            {view === 'codes' && (
                                <div>
                                    <MfaBackupCodes
                                        backupCodes={newBackupCodes}
                                        title="Your new backup codes"
                                        onContinue={() => { setNewBackupCodes([]); setView('main'); }}
                                    />
                                </div>
                            )}

                            {view === 'password' && (
                                <form onSubmit={changePassword} className="space-y-3">
                                    <button type="button" onClick={() => setView('main')} className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">← Back</button>
                                    {pwSuccess && (
                                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-xs">
                                            <Check size={13} className="shrink-0" />
                                            Password updated.
                                        </div>
                                    )}
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Change password</div>
                                    <div className="relative">
                                        <input
                                            type={showPasswords ? 'text' : 'password'}
                                            value={currentPassword}
                                            onChange={e => setCurrentPassword(e.target.value)}
                                            placeholder="Current password"
                                            required
                                            className="w-full px-3 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        />
                                        <button type="button" onClick={() => setShowPasswords(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                                            {showPasswords ? <EyeOff size={13} /> : <Eye size={13} />}
                                        </button>
                                    </div>
                                    <input
                                        type={showPasswords ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="New password (min 8 chars)"
                                        required
                                        minLength={8}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    />
                                    <input
                                        type={showPasswords ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                        required
                                        minLength={8}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    />
                                    <button
                                        type="submit"
                                        disabled={pwSubmitting || !currentPassword || !newPassword || newPassword !== confirmPassword}
                                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {pwSubmitting ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Updating...
                                            </>
                                        ) : 'Update password'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
            <MfaSetupHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
        </AnimatePresence>
    );

    // Portal to document.body so the modal escapes the Dashboard's animated
    // header — a Framer Motion transform ancestor was breaking `position: fixed`
    // and letting dashboard content render on top of the modal.
    if (typeof document === 'undefined') return null;
    return createPortal(modal, document.body);
}
