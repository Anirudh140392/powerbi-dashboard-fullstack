/**
 * Walkthrough modal explaining how to set up MFA on first login.
 *
 * Surfaced from a "?" help button next to the MFA enrolment form AND
 * from the profile/Security panel so a returning user can refresh their
 * memory before regenerating backup codes.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, ScanLine, ShieldCheck, Save } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
    open: boolean;
    onClose: () => void;
}

const STEPS = [
    {
        icon: Smartphone,
        title: '1. Install an authenticator app',
        body: 'On your phone install any of: Google Authenticator, Microsoft Authenticator, Authy, 1Password, or Bitwarden. All work — pick whichever you already use.',
    },
    {
        icon: ScanLine,
        title: '2. Scan the QR code',
        body: 'In the app, tap "Add account" or the "+" button and choose "Scan QR code". Point your camera at the QR shown on the enrolment screen. If you can\'t scan, tap "Enter setup key" instead and paste the alphanumeric code shown below the QR.',
    },
    {
        icon: ShieldCheck,
        title: '3. Type the 6-digit code',
        body: 'Your app will show a 6-digit code that refreshes every 30 seconds. Type the current code into the form and press Verify. From now on, every sign-in will ask for a fresh 6-digit code from this app.',
    },
    {
        icon: Save,
        title: '4. Save your backup codes',
        body: 'After verifying you\'ll get 10 single-use backup codes. Save them in your password manager (1Password, Bitwarden) or print them. These are the only way to sign in if you lose your phone. They are shown exactly once.',
    },
];

export function MfaSetupHelp({ open, onClose }: Props) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const modal = (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={onClose}
                    className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 10 }}
                        transition={{ duration: 0.2 }}
                        onClick={e => e.stopPropagation()}
                        className="relative w-full max-w-lg my-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>
                        <div className="px-6 pt-6 pb-2">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <ShieldCheck size={18} className="text-indigo-500" />
                                Setting up two-factor sign-in
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Takes about 60 seconds. You only need to do this once.
                            </p>
                        </div>
                        <div className="px-6 pb-6 space-y-4">
                            {STEPS.map((step) => {
                                const Icon = step.icon;
                                return (
                                    <div key={step.title} className="flex gap-3">
                                        <div className="shrink-0 w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                                            <Icon size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{step.title}</div>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{step.body}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                                <strong>Lost your phone?</strong> Use one of the backup codes you saved during setup, or ask a super-admin to reset your MFA. If both are gone, contact <a href="mailto:saurabh.j@trailytics.com" className="underline">saurabh.j@trailytics.com</a>.
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modal, document.body);
}
