/**
 * LoginPage — Premium login screen for Rating Intelligence.
 *
 * Simplified: single-step password authentication (MFA removed).
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, User, AlertCircle, Star, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ForgotPasswordModal } from './auth/ForgotPasswordModal';

const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [forgotOpen, setForgotOpen] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await login(username.trim(), password);
        setIsLoading(false);

        if (result.status === 'error') {
            setError(result.error || 'Invalid credentials');
        }
        // On success, AuthContext updates isAuthenticated → AppContent re-renders to Dashboard
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
            <div className="absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950" />
                <motion.div
                    className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"
                    animate={{ x: [0, 50, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/15 rounded-full blur-3xl"
                    animate={{ x: [0, -40, 0], y: [0, 40, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="relative z-10 w-full max-w-md mx-4"
            >
                <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl shadow-2xl p-8">
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 mb-4"
                        >
                            <Star size={28} className="text-white fill-white/30" />
                        </motion.div>
                        <h1 className="text-2xl font-bold text-white mb-1">Rating Intelligence</h1>
                        <p className="text-sm text-slate-400">Sign in to access your analytics</p>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 p-3 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                        >
                            <AlertCircle size={16} className="shrink-0" />
                            {error}
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                                Username or Email
                            </label>
                            <div className="relative">
                                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    id="login-username"
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="Enter username or email"
                                    required
                                    autoFocus
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Password
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setForgotOpen(true)}
                                    className="text-[11px] text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-1"
                                >
                                    <KeyRound size={10} /> Forgot?
                                </button>
                            </div>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    required
                                    className="w-full pl-10 pr-12 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <motion.button
                            type="submit"
                            disabled={isLoading}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </motion.button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
                        <p className="text-[11px] text-slate-500">
                            Contact your administrator for access credentials
                        </p>
                    </div>
                </div>
            </motion.div>

            <ForgotPasswordModal
                open={forgotOpen}
                onClose={() => setForgotOpen(false)}
                defaultEmail={username.includes('@') ? username : undefined}
            />
        </div>
    );
};

export default LoginPage;
