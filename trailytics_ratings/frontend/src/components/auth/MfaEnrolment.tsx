/**
 * MFA enrolment screen — shown on first login after MFA rollout.
 *
 * Renders the QR data URI from /api/auth/mfa/enrol/start, accepts the first
 * 6-digit code, hands the resulting backup codes off to the parent.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Copy, Check, HelpCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { OtpInput } from './OtpInput';
import { MfaSetupHelp } from './MfaSetupHelp';

interface Props {
    challengeToken: string;
    email: string;
    onSuccess: (backupCodes: string[]) => void;
}

export function MfaEnrolment({ challengeToken, email, onSuccess }: Props) {
    const { startMfaEnrolment, completeMfaEnrolment } = useAuth();
    const [setup, setSetup] = useState<{ challengeToken: string; qrDataUri: string; manualSecret: string } | null>(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let alive = true;
        startMfaEnrolment(challengeToken).then(res => {
            if (!alive) return;
            if (!res.ok) {
                setError(res.error);
                return;
            }
            setSetup({ challengeToken: res.challengeToken, qrDataUri: res.qrDataUri, manualSecret: res.manualSecret });
        });
        return () => { alive = false; };
    }, [challengeToken, startMfaEnrolment]);

    const onVerify = async (typed: string) => {
        if (!setup) return;
        setSubmitting(true);
        setError('');
        const res = await completeMfaEnrolment(setup.challengeToken, typed);
        setSubmitting(false);
        if (!res.ok) {
            setError(res.error);
            setCode('');
            return;
        }
        onSuccess(res.backupCodes);
    };

    const copySecret = async () => {
        if (!setup) return;
        try {
            await navigator.clipboard.writeText(setup.manualSecret);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard blocked */ }
    };

    return (
        <>
            <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 mb-3">
                    <ShieldCheck size={22} className="text-white" />
                </div>
                <h2 className="text-lg font-bold text-white mb-1 flex items-center justify-center gap-2">
                    Set up two-factor sign-in
                    <button
                        onClick={() => setHelpOpen(true)}
                        title="How does this work?"
                        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <HelpCircle size={15} />
                    </button>
                </h2>
                <p className="text-xs text-slate-400">One-time setup for <span className="text-slate-200">{email}</span></p>
            </div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                >
                    <AlertCircle size={14} className="shrink-0" />
                    {error}
                </motion.div>
            )}

            {!setup && !error && (
                <div className="flex items-center justify-center py-12 text-slate-400 text-xs gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating your QR code...
                </div>
            )}

            {setup && (
                <>
                    <div className="flex flex-col items-center gap-3 mb-4">
                        <div className="rounded-xl bg-white p-2 shadow-inner">
                            <img src={setup.qrDataUri} alt="MFA QR code" width={180} height={180} />
                        </div>
                        <p className="text-[11px] text-slate-400 text-center max-w-xs leading-relaxed">
                            Scan with Google Authenticator, Microsoft Authenticator, Authy, or 1Password.
                            <button onClick={() => setHelpOpen(true)} className="ml-1 underline text-indigo-300 hover:text-indigo-200">Need help?</button>
                        </p>
                    </div>

                    <div className="mb-5">
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                            Or enter this code manually
                        </label>
                        <button
                            onClick={copySecret}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] transition-all"
                        >
                            <code className="text-xs font-mono text-slate-200 tracking-wider">{setup.manualSecret}</code>
                            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} className="text-slate-400" />}
                        </button>
                    </div>

                    <div className="mb-4">
                        <label className="block text-[10px] font-semibold text-slate-400 mb-2 uppercase tracking-wider text-center">
                            Enter the 6-digit code from your app
                        </label>
                        <OtpInput value={code} onChange={setCode} onComplete={onVerify} autoFocus disabled={submitting} />
                    </div>

                    <motion.button
                        onClick={() => onVerify(code)}
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
                        ) : 'Verify and continue'}
                    </motion.button>
                </>
            )}

            <MfaSetupHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
        </>
    );
}
