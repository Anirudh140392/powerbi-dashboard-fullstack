/**
 * ResetPasswordPage — landing page for the link sent by /auth/password/forgot.
 * Mounted at /reset-password by App.tsx (above the auth gate so unauthenticated
 * users can reach it).
 *
 * On mount: POST /auth/password/reset/validate to confirm the token is still
 * valid; show "link expired" if not.
 * On submit: POST /auth/password/reset with the new password.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Lock, AlertCircle, Check, Eye, EyeOff } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_RATINGS_API_URL || import.meta.env.VITE_API_URL) || '';

export function ResetPasswordPage() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || '';

    const [validating, setValidating] = useState(true);
    const [valid, setValid] = useState(false);
    const [email, setEmail] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [show, setShow] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    useEffect(() => {
        let alive = true;
        if (!token) { setValidating(false); setValid(false); return; }
        (async () => {
            try {
                const r = await fetch(`${API_BASE}/api/auth/password/reset/validate`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });
                const payload = await r.json().catch(() => null);
                if (!alive) return;
                setValid(Boolean(payload?.valid));
                setEmail(payload?.email || null);
            } catch {
                if (alive) setValid(false);
            } finally {
                if (alive) setValidating(false);
            }
        })();
        return () => { alive = false; };
    }, [token]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
        if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
        setSubmitting(true);
        setError('');
        try {
            const r = await fetch(`${API_BASE}/api/auth/password/reset`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });
            const payload = await r.json().catch(() => null);
            if (!r.ok) { setError(payload?.error || 'Could not reset password.'); return; }
            setDone(true);
        } catch {
            setError('Network error — try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950" />
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-md mx-4"
            >
                <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl shadow-2xl p-8">
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 mb-3">
                            <Star size={22} className="text-white fill-white/30" />
                        </div>
                        <h1 className="text-xl font-bold text-white mb-1">Reset your password</h1>
                        {email && !done && <p className="text-xs text-slate-400">For <span className="text-slate-200">{email}</span></p>}
                    </div>

                    {validating ? (
                        <div className="flex items-center justify-center py-12 text-slate-400 text-xs gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Checking your link...
                        </div>
                    ) : !valid ? (
                        <div className="space-y-4">
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                <div>
                                    This reset link is invalid or has expired. Reset links are good for 30 minutes and can only be used once.
                                </div>
                            </div>
                            <a href="/" className="block w-full text-center py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-sm text-slate-200 transition-all">
                                Back to sign in
                            </a>
                        </div>
                    ) : done ? (
                        <div className="space-y-4">
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                                <Check size={14} className="shrink-0 mt-0.5" />
                                <div>
                                    Password updated. All of your other sessions have been signed out. You can now sign in with your new password.
                                </div>
                            </div>
                            <a href="/" className="block w-full text-center py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/25">
                                Go to sign in
                            </a>
                        </div>
                    ) : (
                        <form onSubmit={submit} className="space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                                    <AlertCircle size={13} className="shrink-0" />
                                    {error}
                                </div>
                            )}
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">New password</label>
                                <div className="relative">
                                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type={show ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        required
                                        autoFocus
                                        minLength={8}
                                        placeholder="At least 8 characters"
                                        className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                                    />
                                    <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1">
                                        {show ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Confirm new password</label>
                                <div className="relative">
                                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type={show ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={8}
                                        placeholder="Type it again"
                                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                                    />
                                </div>
                            </div>
                            <motion.button
                                type="submit"
                                disabled={submitting || newPassword.length < 8 || newPassword !== confirmPassword}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Updating...
                                    </>
                                ) : 'Set new password'}
                            </motion.button>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
