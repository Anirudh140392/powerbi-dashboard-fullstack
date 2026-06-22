/**
 * Users admin panel — super_admin only.
 *
 * Lists every user with role/MFA/last-login state. Lets super_admins:
 *   - Add a new user (modal) → emails invitation
 *   - Change a user's role inline
 *   - Disable/enable a user (revokes sessions on disable)
 *   - Resend invitation (regenerates the password-set link)
 *   - Send a password-reset email
 *   - Reset a user's MFA (forces re-enrolment + revokes sessions)
 *
 * Shows an SMTP-status banner up top so the super_admin knows whether
 * emails will actually leave.
 */
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ShieldOff, Lock, RefreshCw, AlertCircle, Mail, UserPlus, MailX, MailCheck, MoreHorizontal, Send, UserX, UserCheck } from 'lucide-react';
import { authenticatedFetch } from '../../utils/auth';
import { AddUserModal } from './AddUserModal';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface User {
    id: string;
    username: string;
    email: string;
    full_name: string;
    role: string;
    status: string;
    mfa_enabled: boolean;
    mfa_enrolled_at: string | null;
    mfa_locked_until: string | null;
    last_login_at: string | null;
}

interface MailerStatus {
    configured: boolean;
    smtpHost: string | null;
    smtpUser: string | null;
    smtpFrom: string | null;
    dashboardUrl: string | null;
    hint: string;
}

type ToastKind = 'success' | 'error' | 'info';
type Toast = { kind: ToastKind; message: string } | null;

export function UsersAdminPanel() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [confirming, setConfirming] = useState<{ kind: 'mfa' | 'disable'; userId: string } | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [toast, setToast] = useState<Toast>(null);
    const [mailer, setMailer] = useState<MailerStatus | null>(null);
    const [addOpen, setAddOpen] = useState(false);

    const showToast = (kind: ToastKind, message: string) => {
        setToast({ kind, message });
        setTimeout(() => setToast(null), 4000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [u, m] = await Promise.all([
                authenticatedFetch(`${API_BASE}/api/auth/users`),
                authenticatedFetch(`${API_BASE}/api/auth/mailer/status`),
            ]);
            const userPayload = await u.json().catch(() => null);
            if (!u.ok) { setError(userPayload?.error || 'Failed to load users'); return; }
            setUsers(userPayload.users || []);
            const mailPayload = await m.json().catch(() => null);
            if (m.ok) setMailer(mailPayload);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!openMenu) return;
        const onClick = () => setOpenMenu(null);
        document.addEventListener('click', onClick);
        return () => document.removeEventListener('click', onClick);
    }, [openMenu]);

    const resetMfa = async (userId: string) => {
        setBusyId(userId);
        try {
            const r = await authenticatedFetch(`${API_BASE}/api/auth/mfa/reset`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: userId }),
            });
            if (!r.ok) {
                const payload = await r.json().catch(() => null);
                showToast('error', payload?.error || 'Reset failed');
                return;
            }
            await load();
            setConfirming(null);
            showToast('success', 'MFA reset — user must re-enrol on next sign-in.');
        } finally { setBusyId(null); }
    };

    const sendPasswordReset = async (email: string) => {
        setBusyId(email);
        try {
            const r = await fetch(`${API_BASE}/api/auth/password/forgot`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!r.ok) { showToast('error', 'Password-reset request failed'); return; }
            showToast(mailer?.configured ? 'success' : 'info',
                mailer?.configured
                    ? `Password-reset email queued for ${email}.`
                    : `Password-reset prepared, but SMTP isn't configured so no email was sent.`);
        } finally { setBusyId(null); }
    };

    const resendInvite = async (userId: string) => {
        setBusyId(userId);
        try {
            const r = await authenticatedFetch(`${API_BASE}/api/auth/users/${userId}/invite`, { method: 'POST' });
            const payload = await r.json().catch(() => null);
            if (!r.ok) { showToast('error', payload?.error || 'Invite failed'); return; }
            if (payload.invitation?.sent) {
                showToast('success', `Invitation email sent.`);
            } else {
                showToast('info', `Invite link (copy + share): ${payload.invitation?.resetUrl}`);
                if (payload.invitation?.resetUrl) navigator.clipboard?.writeText(payload.invitation.resetUrl).catch(() => {});
            }
        } finally { setBusyId(null); }
    };

    const setRole = async (userId: string, role: string) => {
        setBusyId(userId);
        try {
            const r = await authenticatedFetch(`${API_BASE}/api/auth/users/${userId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            });
            if (!r.ok) { showToast('error', 'Role update failed'); return; }
            await load();
            showToast('success', `Role updated to ${role}.`);
        } finally { setBusyId(null); }
    };

    const setStatus = async (userId: string, status: 'active' | 'disabled') => {
        setBusyId(userId);
        try {
            const r = await authenticatedFetch(`${API_BASE}/api/auth/users/${userId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (!r.ok) { showToast('error', 'Status update failed'); return; }
            await load();
            setConfirming(null);
            showToast('success', status === 'disabled' ? 'User disabled — sessions revoked.' : 'User enabled.');
        } finally { setBusyId(null); }
    };

    return (
        <div className="space-y-3">
            {/* SMTP status banner */}
            {mailer && !mailer.configured && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 text-xs">
                    <MailX size={14} className="shrink-0 mt-0.5" />
                    <div>
                        <strong>SMTP is not configured.</strong> Invitations and password resets won't be emailed — you'll get a copy-paste link instead. Set <code className="bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded">SMTP_HOST</code>, <code className="bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded">SMTP_USER</code>, <code className="bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded">SMTP_PASS</code>, <code className="bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded">SMTP_FROM</code> on Railway, then redeploy.
                    </div>
                </div>
            )}
            {mailer && mailer.configured && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-xs">
                    <MailCheck size={13} className="shrink-0" />
                    SMTP via {mailer.smtpHost} as {mailer.smtpUser} — invitations and resets will send.
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 text-xs">
                    <AlertCircle size={13} className="shrink-0" />
                    {error}
                </div>
            )}
            {toast && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-2 p-3 rounded-xl text-xs border ${
                        toast.kind === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400'
                        : toast.kind === 'error' ? 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                >
                    <span className="break-all">{toast.message}</span>
                </motion.div>
            )}

            <div className="flex justify-between items-center">
                <div className="text-xs text-slate-500 dark:text-slate-400">{users.length} {users.length === 1 ? 'user' : 'users'}</div>
                <button
                    onClick={() => setAddOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                >
                    <UserPlus size={13} /> Add user
                </button>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 overflow-visible">
                <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="text-left px-4 py-2.5 font-semibold">User</th>
                            <th className="text-left px-4 py-2.5 font-semibold">Role</th>
                            <th className="text-left px-4 py-2.5 font-semibold">MFA</th>
                            <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                            <th className="text-left px-4 py-2.5 font-semibold">Last sign-in</th>
                            <th className="text-right px-4 py-2.5 font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No users.</td></tr>
                        ) : users.map(u => {
                            const isDisabled = u.status === 'disabled';
                            return (
                            <tr key={u.id} className={`border-t border-slate-100 dark:border-slate-800 ${isDisabled ? 'opacity-60' : ''}`}>
                                <td className="px-4 py-2.5">
                                    <div className="font-semibold text-slate-900 dark:text-white">{u.full_name}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{u.email}</div>
                                </td>
                                <td className="px-4 py-2.5">
                                    <select
                                        value={u.role}
                                        onChange={e => setRole(u.id, e.target.value)}
                                        disabled={busyId === u.id || isDisabled}
                                        className={`text-[10px] px-1.5 py-1 rounded font-semibold uppercase tracking-wider border bg-transparent
                                            ${u.role === 'super_admin' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800'
                                            : u.role === 'company_admin' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                    >
                                        <option value="viewer">Viewer</option>
                                        <option value="company_admin">Admin</option>
                                        <option value="super_admin">Super Admin</option>
                                    </select>
                                </td>
                                <td className="px-4 py-2.5">
                                    {u.mfa_locked_until && new Date(u.mfa_locked_until) > new Date() ? (
                                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 text-[10px]"><Lock size={10} /> Locked</span>
                                    ) : u.mfa_enabled ? (
                                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px]"><ShieldCheck size={10} /> Enrolled</span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[10px]"><ShieldOff size={10} /> Not enrolled</span>
                                    )}
                                </td>
                                <td className="px-4 py-2.5">
                                    {isDisabled
                                        ? <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold uppercase tracking-wider">Disabled</span>
                                        : <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">Active</span>}
                                </td>
                                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-[10px]">
                                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right relative">
                                    {confirming?.userId === u.id ? (
                                        <span className="inline-flex items-center gap-1">
                                            <button onClick={() => confirming.kind === 'mfa' ? resetMfa(u.id) : setStatus(u.id, isDisabled ? 'active' : 'disabled')}
                                                disabled={busyId === u.id}
                                                className="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold disabled:opacity-50">
                                                {busyId === u.id ? '...' : `Confirm ${confirming.kind === 'mfa' ? 'MFA reset' : (isDisabled ? 'enable' : 'disable')}`}
                                            </button>
                                            <button onClick={() => setConfirming(null)} className="px-2 py-1 rounded-md text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">Cancel</button>
                                        </span>
                                    ) : (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === u.id ? null : u.id); }}
                                            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                                            aria-label="Actions"
                                        >
                                            <MoreHorizontal size={14} />
                                        </button>
                                    )}
                                    {openMenu === u.id && (
                                        <div onClick={e => e.stopPropagation()} className="absolute right-2 top-9 z-20 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
                                            <button onClick={() => { setOpenMenu(null); resendInvite(u.id); }}
                                                className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                <Send size={12} className="text-indigo-500" /> Resend invitation
                                            </button>
                                            <button onClick={() => { setOpenMenu(null); sendPasswordReset(u.email); }}
                                                className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                                                <Mail size={12} className="text-indigo-500" /> Send password-reset email
                                            </button>
                                            {u.mfa_enabled && (
                                                <button onClick={() => { setOpenMenu(null); setConfirming({ kind: 'mfa', userId: u.id }); }}
                                                    className="w-full px-3 py-2 text-left text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/15 flex items-center gap-2">
                                                    <RefreshCw size={12} /> Reset MFA
                                                </button>
                                            )}
                                            <div className="border-t border-slate-100 dark:border-slate-800" />
                                            {isDisabled ? (
                                                <button onClick={() => { setOpenMenu(null); setStatus(u.id, 'active'); }}
                                                    className="w-full px-3 py-2 text-left text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/15 flex items-center gap-2">
                                                    <UserCheck size={12} /> Enable user
                                                </button>
                                            ) : (
                                                <button onClick={() => { setOpenMenu(null); setConfirming({ kind: 'disable', userId: u.id }); }}
                                                    className="w-full px-3 py-2 text-left text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/15 flex items-center gap-2">
                                                    <UserX size={12} /> Disable user
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-400 px-1">
                Disable revokes all active sessions immediately. Reset MFA forces re-enrolment on next sign-in. Role changes apply on next sign-in.
            </p>

            <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
        </div>
    );
}
