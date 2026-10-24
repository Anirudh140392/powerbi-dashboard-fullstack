/**
 * One-time display of the 10 backup codes after enrolment OR regeneration.
 *
 * Forces the user to tick "I have saved these" before they can proceed —
 * we never show them again.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Download, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
    backupCodes: string[];
    title?: string;
    onContinue: () => void;
}

export function MfaBackupCodes({ backupCodes, title, onContinue }: Props) {
    const [copied, setCopied] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    const copyAll = async () => {
        try {
            await navigator.clipboard.writeText(backupCodes.join('\n'));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard blocked */ }
    };

    const downloadTxt = () => {
        const today = new Date().toISOString().slice(0, 10);
        const body =
            `Rating Intelligence — MFA backup codes\n` +
            `Generated: ${today}\n` +
            `Account: keep these somewhere safe — each one works exactly once.\n\n` +
            backupCodes.map((c, i) => `${String(i + 1).padStart(2, '0')}. ${c}`).join('\n') + '\n';
        const blob = new Blob([body], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rating-intelligence-backup-codes-${today}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 mb-3">
                    <ShieldCheck size={22} className="text-white" />
                </div>
                <h2 className="text-lg font-bold text-white mb-1">{title || 'Save your backup codes'}</h2>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Each code works exactly once. Use one to sign in if you lose access to your authenticator app.
                </p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed"
            >
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                    <strong>These codes will not be shown again.</strong> Save them in your password manager (1Password, Bitwarden) or print them now.
                </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                {backupCodes.map((code, i) => (
                    <div key={code} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.04]">
                        <span className="text-[10px] font-mono text-slate-500 w-4 text-right">{i + 1}.</span>
                        <code className="text-xs font-mono text-white tracking-wider">{code}</code>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={copyAll}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs text-slate-200 transition-all"
                >
                    {copied ? <><Check size={13} className="text-emerald-400" /> Copied</> : <><Copy size={13} /> Copy all</>}
                </button>
                <button
                    onClick={downloadTxt}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs text-slate-200 transition-all"
                >
                    <Download size={13} /> Download .txt
                </button>
            </div>

            <label className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] cursor-pointer">
                <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    className="mt-0.5 w-3.5 h-3.5 rounded text-indigo-600 bg-transparent border-slate-500 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                    I've saved these backup codes somewhere safe. I understand they won't be shown again.
                </span>
            </label>

            <motion.button
                onClick={onContinue}
                disabled={!confirmed}
                whileHover={{ scale: confirmed ? 1.01 : 1 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Continue to dashboard
            </motion.button>
        </div>
    );
}
