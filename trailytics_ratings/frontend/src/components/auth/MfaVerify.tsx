/**
 * MFA verify step — shown on every returning sign-in after the password.
 *
 * Accepts a 6-digit TOTP or one of the 10 backup codes. Surfaces
 * attempts-remaining hints and the lockout state.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { OtpInput } from './OtpInput';

interface Props {
    challengeToken: string;
    onCancel: () => void;
}

export function MfaVerify({ challengeToken, onCancel }: Props) {
    const { completeMfaVerify } = useAuth();
    const [code, setCode] = useState('');
    const [backupCode, setBackupCode] = useState('');
    const [mode, setMode] = useState<'totp' | 'backup'>('totp');
    const [error, setError] = useState('');
    const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const onVerify = async (typed: string, isBackup = false) => {
        setSubmitting(true);
        setError('');
        const res = await completeMfaVerify(challengeToken, typed, isBackup);
        setSubmitting(false);
        if (res.ok) return; // AuthContext flips isAuthenticated → AppContent renders dashboard
        setError(res.error);
        if (typeof res.attemptsRemaining === 'number') setAttemptsLeft(res.attemptsRemaining);
        if (res.lockedUntil) setAttemptsLeft(0);
        setCode('');
        setBackupCode('');
    };

    return (
        <>
            <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 mb-3">
                    <ShieldCheck size={22} className="text-white" />
                </div>
                <h2 className="text-lg font-bold text-white mb-1">Two-factor sign-in</h2>
                <p className="text-xs text-slate-400">
                    {mode === 'totp' ? 'Enter the 6-digit code from your authenticator app' : 'Enter one of your 10 backup codes'}
                </p>
            </div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                >
                    <AlertCircle size={14} className="shrink-0" />
                    <div className="flex-1">
                        <div>{error}</div>
                        {attemptsLeft !== null && attemptsLeft > 0 && (
                            <div className="text-[10px] text-red-400/80 mt-0.5">{attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} remaining before lockout</div>
                        )}
                    </div>
                </motion.div>
            )}

            {mode === 'totp' ? (
                <>
                    <div className="mb-4">
                        <OtpInput value={code} onChange={setCode} onComplete={(v) => onVerify(v, false)} autoFocus disabled={submitting} />
                    </div>
                    <motion.button
                        onClick={() => onVerify(code, false)}
                        disabled={code.length !== 6 || submitting}
                        whileHover={{ scale: code.length === 6 ? 1.01 : 1 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Verifying...
                            </>
                        ) : 'Verify'}
                    </motion.button>
                    <button
                        onClick={() => { setMode('backup'); setError(''); setCode(''); }}
                        className="w-full mt-3 text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                    >
                        <KeyRound size={12} /> Use a backup code instead
                    </button>
                </>
            ) : (
                <>
                    <input
                        value={backupCode}
                        onChange={e => setBackupCode(e.target.value.toUpperCase())}
                        onKeyDown={e => { if (e.key === 'Enter' && backupCode.replace(/\W/g, '').length === 8) onVerify(backupCode, true); }}
                        placeholder="XXXX-XXXX"
                        autoFocus
                        disabled={submitting}
                        className="w-full mb-3 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white text-center font-mono tracking-widest placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                    />
                    <motion.button
                        onClick={() => onVerify(backupCode, true)}
                        disabled={backupCode.replace(/\W/g, '').length !== 8 || submitting}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Use backup code
                    </motion.button>
                    <button
                        onClick={() => { setMode('totp'); setError(''); setBackupCode(''); }}
                        className="w-full mt-3 text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                    >
                        <ArrowLeft size={12} /> Back to authenticator code
                    </button>
                </>
            )}

            <button
                onClick={onCancel}
                className="w-full mt-5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
                Sign in as a different user
            </button>
        </>
    );
}
