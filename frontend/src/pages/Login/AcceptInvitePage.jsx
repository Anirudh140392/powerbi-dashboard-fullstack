import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../../utils/AuthContext";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck, Mail, Database } from "lucide-react";

const AcceptInvitePage = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const navigate = useNavigate();
    const { loginWithToken } = useAuth();

    const [verifying, setVerifying] = useState(true);
    const [tokenError, setTokenError] = useState(null);
    const [inviteData, setInviteData] = useState(null);

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setTokenError("No invitation token provided in URL link.");
                setVerifying(false);
                return;
            }

            try {
                const API_BASE = import.meta.env.VITE_API_URL
                    ? `${import.meta.env.VITE_API_URL}/api`
                    : "/api";

                const res = await axios.get(`${API_BASE}/auth/verify-invite-token?token=${token}`);
                if (res.data.success) {
                    setInviteData(res.data);
                } else {
                    setTokenError(res.data.error || "Invalid or expired invitation token.");
                }
            } catch (err) {
                setTokenError(err.response?.data?.error || "Failed to verify invitation link. It may be expired.");
            } finally {
                setVerifying(false);
            }
        };

        verifyToken();
    }, [token]);

    const handleSubmitPassword = async (e) => {
        e.preventDefault();
        setSubmitError("");

        if (password.length < 6) {
            setSubmitError("Password must be at least 6 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            setSubmitError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const API_BASE = import.meta.env.VITE_API_URL
                ? `${import.meta.env.VITE_API_URL}/api`
                : "/api";

            const res = await axios.post(`${API_BASE}/auth/complete-invitation`, {
                token,
                password,
            });

            if (res.data.success && res.data.token && res.data.user) {
                // Log user in automatically
                loginWithToken(res.data.token, res.data.user);
                const userRole = res.data.user?.role?.toLowerCase() || '';
                const redirectPath = (userRole.includes('admin') || userRole.includes('super')) ? "/admin" : "/watch-tower";
                navigate(redirectPath, { replace: true });
            } else {
                setSubmitError(res.data.error || "Failed to complete password setup.");
            }
        } catch (err) {
            console.error("Complete invite error:", err);
            setSubmitError(err.response?.data?.error || "An error occurred while creating your password.");
        } finally {
            setLoading(false);
        }
    };

    if (verifying) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-slate-900 font-sans text-white">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm font-medium text-slate-400">Verifying invitation token...</p>
                </div>
            </div>
        );
    }

    if (tokenError) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-slate-900 p-6 font-sans">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 text-center space-y-6 shadow-2xl"
                >
                    <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-white">Invitation Invalid</h2>
                        <p className="text-sm text-slate-400 leading-relaxed">{tokenError}</p>
                    </div>
                    <button
                        onClick={() => navigate("/login")}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
                    >
                        Go to Login Page
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="w-screen h-screen flex items-center justify-center bg-slate-900 p-6 font-sans">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 space-y-6 shadow-2xl"
            >
                <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
                        <ShieldCheck className="w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Create Your Password</h1>
                    <p className="text-xs text-slate-400">Set a password to complete your Trailytics account registration.</p>
                </div>

                {/* Account Details Box */}
                <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 space-y-2.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span className="font-medium text-slate-400">Email:</span>
                        <span className="font-semibold text-white truncate">{inviteData?.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span className="font-medium text-slate-400">Organization DB:</span>
                        <span className="font-semibold text-emerald-400 uppercase">{inviteData?.dbName?.replace(/_/g, " ")}</span>
                    </div>
                </div>

                {submitError && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{submitError}</span>
                    </div>
                )}

                <form onSubmit={handleSubmitPassword} className="space-y-5">
                    {/* Password Input */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            New Password *
                        </label>
                        <div className="relative flex items-center">
                            <Lock className="w-4 h-4 text-slate-500 absolute left-4" />
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                minLength={6}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-11 pr-12 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 text-slate-500 hover:text-slate-300"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password Input */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Confirm Password *
                        </label>
                        <div className="relative flex items-center">
                            <Lock className="w-4 h-4 text-slate-500 absolute left-4" />
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                minLength={6}
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full pl-11 pr-12 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                        {loading ? "Creating Password..." : "Set Password & Sign In"}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

export default AcceptInvitePage;
