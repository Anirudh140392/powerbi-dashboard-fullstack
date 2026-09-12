/**
 * 6-digit OTP input — six single-character boxes with auto-advance and
 * full paste support (paste a 6-digit code into any box and it spreads
 * across all six). Used by both MfaEnrolment and MfaVerify.
 */
import { useRef, useEffect, useCallback } from 'react';

interface Props {
    value: string;
    onChange: (v: string) => void;
    onComplete?: (v: string) => void;
    autoFocus?: boolean;
    disabled?: boolean;
}

export function OtpInput({ value, onChange, onComplete, autoFocus, disabled }: Props) {
    const refs = useRef<Array<HTMLInputElement | null>>([]);

    useEffect(() => {
        if (autoFocus) refs.current[0]?.focus();
    }, [autoFocus]);

    const setDigit = useCallback((idx: number, d: string) => {
        const cleaned = d.replace(/\D/g, '').slice(0, 1);
        const next = (value.padEnd(6, ' ').split('').slice(0, 6));
        next[idx] = cleaned || ' ';
        const joined = next.join('').replace(/\s/g, '');
        onChange(joined);
        if (cleaned && idx < 5) refs.current[idx + 1]?.focus();
        if (joined.length === 6 && onComplete) onComplete(joined);
    }, [value, onChange, onComplete]);

    const onPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        e.preventDefault();
        onChange(pasted);
        refs.current[Math.min(pasted.length, 5)]?.focus();
        if (pasted.length === 6 && onComplete) onComplete(pasted);
    }, [onChange, onComplete]);

    return (
        <div className="flex gap-2 justify-center">
            {[0, 1, 2, 3, 4, 5].map(i => (
                <input
                    key={i}
                    ref={el => { refs.current[i] = el; }}
                    value={value[i] || ''}
                    onChange={e => setDigit(i, e.target.value)}
                    onPaste={onPaste}
                    onKeyDown={e => {
                        if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
                        if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
                        if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
                    }}
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    disabled={disabled}
                    className="w-11 h-12 text-center text-lg font-semibold rounded-xl bg-white/[0.08] border border-white/[0.15] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
                />
            ))}
        </div>
    );
}
