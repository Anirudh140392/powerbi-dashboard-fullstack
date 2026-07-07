/**
 * Add User modal — super_admin creates an account + sends invite.
 *
 * On success the backend returns a reset URL. If SMTP is not configured
 * we surface the URL with a copy button so the super_admin can hand it
 * over out-of-band.
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, AlertCircle, Check, Copy, Crown, Shield, Eye } from 'lucide-react';
import { authenticatedFetch } from '../../utils/auth';
import { RATINGS_API_BASE } from '../../config/apiBase';

const API_BASE = RATINGS_API_BASE;

interface Props {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
}

type Role = 'super_admin' | 'company_admin' | 'viewer';

interface InviteResult {
    sent: boolean;
    reason?: string;
    resetUrl: string;
    expiresInMinutes: number;
}

export function AddUserModal({ open, onClose, onCreated }: Props) {
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<Role>('viewer');
    const [sendInvite, setSendInvite] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [invite, setInvite] = useState<InviteResult | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);

    useEffect(() => {
        if (open) {
            setEmail(''); setFullName(''); setRole('viewer'); setSendInvite(true);
            setSubmitting(false); setError(''); setInvite(null); setLinkCopied(false);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !fullName.trim()) return;
        setSubmitting(true);
        setError('');
        try {
            const r = await authenticatedFetch(`${API_BASE}/api/auth/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    fullName: fullName.trim(),
                    role,
                    platformScope: 'all',
                    sendInvite,
                }),
            });
            const payload = await r.json().catch(() => null);
            if (!r.ok) { setError(payload?.error || 'Failed to create user'); return; }
            setInvite(payload.invitation);
            onCreated();
        } catch {
            setError('Network error');
        } finally {
            setSubmitting(false);
        }
    };

    const copyLink = async () => {
        if (!invite?.resetUrl) return;
        try {
            await navigator.clipboard.writeText(invite.resetUrl);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch { /* clipboard blocked */ }
    };

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

                        <div className="px-6 pt-6 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <UserPlus size={17} className="text-indigo-500" /> Add user
                            </h2>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Create an account and email them an invitation link.</p>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 text-xs">
                                    <AlertCircle size={13} className="shrink-0" />
                                    {error}
                                </div>
                            )}

                            {invite ? (
                                <div className="space-y-3">
                                    <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${invite.sent
                                        ? 'bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400'}`}>
                                        {invite.sent ? <Check size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
                                        <div>
                                            {invite.sent
                                                ? <>Invitation email sent. The link is valid for {invite.expiresInMinutes} minutes.</>
                                                : <>Email could not be sent ({invite.reason || 'mailer unavailable'}). Copy and share the link manually — valid for {invite.expiresInMinutes} minutes.</>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Password-set link</label>
                                        <button
                                            onClick={copyLink}
                                            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            <code className="text-[11px] font-mono text-slate-700 dark:text-slate-200 truncate text-left flex-1">{invite.resetUrl}</code>
                                            {linkCopied ? <Check size={13} className="text-emerald-500 shrink-0" /> : <Copy size={13} className="text-slate-400 shrink-0" />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => { onClose(); }}
                                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
                                    >
                                        Done
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={submit} className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Email</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            required
                                            autoFocus
                                            placeholder="user@trailytics.com"
                                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        />
                                        <div className="text-[10px] text-slate-500 mt-1">Login ID will be the part before @ (e.g. {email.includes('@') ? email.split('@')[0].toLowerCase() : 'user'})</div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Full name</label>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={e => setFullName(e.target.value)}
                                            required
                                            placeholder="First Last"
                                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Role</label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {([
                                                { v: 'viewer', label: 'Viewer', icon: Eye, desc: 'Read-only' },
                                                { v: 'company_admin', label: 'Admin', icon: Shield, desc: 'Tenant-level' },
                                                { v: 'super_admin', label: 'Super', icon: Crown, desc: 'Pipeline + users' },
                                            ] as { v: Role; label: string; icon: React.ElementType; desc: string }[]).map(opt => {
                                                const Icon = opt.icon;
                                                const active = role === opt.v;
                                                return (
                                                    <button key={opt.v} type="button" onClick={() => setRole(opt.v)}
                                                        className={`p-2 rounded-xl border text-[10px] flex flex-col items-center gap-1 transition-all
                                                            ${active
                                                                ? opt.v === 'super_admin' ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-400 dark:border-violet-700 text-violet-700 dark:text-violet-300'
                                                                : opt.v === 'company_admin' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                                                                : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                                                            }`}>
                                                        <Icon size={14} />
                                                        <span className="font-semibold">{opt.label}</span>
                                                        <span className="text-[9px] opacity-80">{opt.desc}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <label className="flex items-start gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                                        <input type="checkbox" checked={sendInvite} onChange={e => setSendInvite(e.target.checked)}
                                            className="mt-0.5 w-3.5 h-3.5 rounded text-indigo-600" />
                                        <span className="text-xs text-slate-700 dark:text-slate-300">
                                            Email an invitation with a password-set link
                                            <span className="block text-[10px] text-slate-500 mt-0.5">Even if unchecked, you'll see the link to copy/share manually.</span>
                                        </span>
                                    </label>
                                    <button
                                        type="submit"
                                        disabled={submitting || !email.trim() || !fullName.trim()}
                                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {submitting ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Creating...
                                            </>
                                        ) : 'Create user'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modal, document.body);
}
