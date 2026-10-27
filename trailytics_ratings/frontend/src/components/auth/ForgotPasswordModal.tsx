/**
 * "Forgot password" modal launched from LoginPage.
 * Always shows the same success message so the API doesn't leak
 * which emails are registered.
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, AlertCircle, Check } from 'lucide-react';

interface Props {
    open: boolean;
    onClose: () => void;
    defaultEmail?: string;
}

const API_BASE = (import.meta.env.VITE_RATINGS_API_URL || import.meta.env.VITE_API_URL) || '';

export function ForgotPasswordModal({ open, onClose, defaultEmail }: Props) {
    const [email, setEmail] = useState(defaultEmail || '');
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) {
            setEmail(defaultEmail || '');
            setSubmitting(false);
            setSent(false);
            setError('');
        }
    }, [open, defaultEmail]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setSubmitting(true);
        setError('');
        try {
            const r = await fetch(`${API_BASE}/api/auth/password/forgot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            if (!r.ok) {
                const payload = await r.json().catch(() => null);
                setError(payload?.error || 'Could not send reset email.');
                return;
            }
            setSent(true);
        } catch {
            setError('Network error — try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const modal = (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={onClose}
                    className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 10 }}
                        transition={{ duration: 0.2 }}
                        onClick={e => e.stopPropagation()}
                        className="relative w-full max-w-sm rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] shadow-2xl p-6"
                    >
                        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-white/10 transition-colors" aria-label="Close">
                            <X size={16} />
                        </button>
                        <div className="text-center mb-5">
                            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 mb-3">
                                <Mail size={20} className="text-white" />
                            </div>
                            <h2 className="text-base font-bold text-white mb-1">Reset your password</h2>
                            <p className="text-[11px] text-slate-400">We'll email a single-use reset link.</p>
                        </div>

                        {sent ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                                    <Check size={14} className="shrink-0 mt-0.5" />
                                    <div>
                                        If <strong>{email}</strong> is registered, a reset link is on its way. Check your inbox (and spam folder). The link expires in 30 minutes.
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-sm text-slate-200 transition-all"
                                >
                                    Back to sign in
                                </button>
                            </motion.div>
                        ) : (
                            <form onSubmit={submit} className="space-y-4">
                                {error && (
                                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                                        <AlertCircle size={13} className="shrink-0" />
                                        {error}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Email address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        autoFocus
                                        required
                                        placeholder="you@ttkprestige.com"
                                        className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                                    />
                                </div>
                                <motion.button
                                    type="submit"
                                    disabled={submitting || !email.trim()}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Sending...
                                        </>
                                    ) : 'Send reset link'}
                                </motion.button>
                            </form>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modal, document.body);
}
