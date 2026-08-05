import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import { PublicClientApplication } from "@azure/msal-browser";
import {
    Box,
    Typography,
    Alert,
} from "@mui/material";
import {
    Mail,
    Lock,
    Eye,
    EyeOff,
    BarChart3,
    TrendingUp,
    PieChart,
    Send,
    Truck,
} from "lucide-react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "176719245227-cse1isbmn2qp4hu1se9voboitm8t9oht.apps.googleusercontent.com";

const GoogleSsoButton = ({ onSuccess, onError }) => {
    const loginWithGoogle = useGoogleLogin({
        onSuccess: (tokenResponse) => {
            if (tokenResponse?.access_token) {
                onSuccess(tokenResponse.access_token);
            }
        },
        onError: () => onError("Google sign-in was canceled or failed."),
    });

    return (
        <button
            type="button"
            onClick={() => loginWithGoogle()}
            className="w-full h-[52px] border border-gray-200 bg-white hover:bg-gray-50/80 rounded-[18px] text-[14px] font-semibold text-gray-700 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5 cursor-pointer shadow-sm"
        >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Sign in with Google</span>
        </button>
    );
};

const LoginPageContent = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login, isLoggedIn, user, isVerifying, loginWithSso } = useAuth();
    const navigate = useNavigate();

    const handleMicrosoftLogin = async () => {
        setError("");
        setLoading(true);
        try {
            const msalConfig = {
                auth: {
                    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '153c3bd5-c6f7-41a5-b11c-3334d71b5db4',
                    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID || 'b50e2cd2-ee2d-4b60-ab85-dc4ce039da6a'}`,
                    redirectUri: `${window.location.origin}/api/auth/callback/microsoft`,
                }
            };
            const msalInstance = new PublicClientApplication(msalConfig);
            await msalInstance.initialize();
            const loginResponse = await msalInstance.loginPopup({
                scopes: ["User.Read", "openid", "profile", "email"]
            });
            if (loginResponse && loginResponse.idToken) {
                const res = await loginWithSso('microsoft', loginResponse.idToken);
                if (!res.success) {
                    setError(res.error || "Microsoft login failed.");
                }
            }
        } catch (err) {
            console.error("Microsoft SSO Error:", err);
            setError(err.message || "Microsoft authentication canceled or failed.");
        } finally {
            setLoading(false);
        }
    };


    // Auto-redirect if already logged in AND effectively on the login page
    useEffect(() => {
        if (!isVerifying && isLoggedIn && window.location.href.includes('/login')) {
            const userRole = user?.role?.toLowerCase() || '';
            const hasAdminAccess = userRole.includes('admin') || userRole.includes('super');
            const redirectPath = hasAdminAccess ? "/admin" : "/watch-tower";
            navigate(redirectPath, { replace: true });
        }
    }, [isLoggedIn, isVerifying, navigate, user]);

    // While verifying session, don't render the login form (prevents flash)
    if (isVerifying) {
        return null;
    }

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        setError("");
        setLoading(true);

        const result = await login({ email, password });

        if (result.success) {
            // Check role from AuthContext user if not immediately available in result
            // though login service returns them
            // Let's rely on the useEffect above or do it here
            // navigate(userData.role === 'admin' ? "/admin" : "/watch-tower", { replace: true });
        } else {
            setError(result.error || "Invalid email or password");
            setLoading(false);
        }
    };

    return (
        <div className="w-screen h-screen flex overflow-hidden font-['Outfit',_sans-serif] bg-[#f4f4f7]">
            {/* Background Layout */}
            <div className="absolute inset-0 flex">
                <div className="w-[65%] h-full bg-gradient-to-br from-[#4c46f5] via-[#6248f4] to-[#7b45f0]" />
                <div className="w-[35%] h-full bg-[#f4f4f7]" />
            </div>

            {/* Content Layer */}
            <div className="relative z-10 w-full h-full flex items-center">
                {/* Logo top-left */}
                <div className="absolute top-10 left-12">
                    <img src="/sidebar_logo.png" alt="Trailytics Logo" className="h-10 w-auto" />
                </div>

                {/* Left Side Content */}
                <div className="w-[60%] h-full flex flex-col justify-center px-16 lg:px-24">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.7 }}
                    >
                        <h1 className="text-white text-[56px] font-extrabold leading-[1.1] tracking-tight">
                            Unified E-Commerce <br /> Intelligence
                        </h1>

                        <p className="text-white/80 mt-8 text-[18px] max-w-[500px] leading-relaxed">
                            Actionable analytics for modern retail performance and
                            market share visibility.
                        </p>
                    </motion.div>

                    {/* Dashboard Illustration */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="relative mt-16 w-full max-w-[580px]"
                    >
                        {/* Simplified Dashboard Mockup */}
                        <div className="bg-white/10 backdrop-blur-md rounded-[28px] border border-white/20 p-8 shadow-2xl">
                            <div className="flex gap-3 mb-8">
                                <div className="w-3 h-3 rounded-full bg-white/30" />
                                <div className="w-3 h-3 rounded-full bg-white/30" />
                                <div className="w-3 h-3 rounded-full bg-white/30" />
                            </div>
                            <div className="space-y-6">
                                <div className="h-6 w-3/4 bg-white/20 rounded-full" />
                                <div className="flex items-end gap-3 h-[120px]">
                                    {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 bg-white/30 rounded-t-lg transition-all hover:bg-white/50"
                                            style={{ height: `${h}%` }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Floating elements */}
                        <div className="absolute -right-6 -top-6 w-20 h-20 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center">
                            <TrendingUp className="w-10 h-10 text-white" />
                        </div>
                        <div className="absolute -left-4 bottom-10 w-16 h-16 bg-white/10 backdrop-blur-lg rounded-2xl flex items-center justify-center transform -rotate-12">
                            <PieChart className="w-8 h-8 text-white" />
                        </div>
                    </motion.div>
                </div>

                {/* Right Side - Overlapping Login Card */}
                <div className="w-[40%] flex justify-start items-center">
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="w-[480px] bg-white rounded-[32px] shadow-[0_50px_100px_rgba(0,0,0,0.12)] p-14 -ml-8 z-20"
                    >
                        <h2 className="text-[32px] font-bold text-[#1f2937]">Sign In</h2>
                        <div className="w-14 h-[5px] bg-[#4c46f5] mt-3 rounded-full mb-10" />

                        {error && (
                            <Alert 
                                severity={error.toLowerCase().includes("access request") || error.toLowerCase().includes("access pending") ? "success" : "error"} 
                                sx={{ mb: 4, borderRadius: "18px" }}
                            >
                                {error}
                            </Alert>
                        )}

                        <form onSubmit={handleLogin} className="space-y-8">
                            {/* EMAIL */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-400 tracking-[0.2em] uppercase">
                                    EMAIL ADDRESS
                                </label>
                                <div className="mt-3 flex items-center border border-gray-100 rounded-[20px] px-6 h-[60px] bg-gray-50 focus-within:ring-4 focus-within:ring-[#4c46f5]/5 focus-within:border-[#4c46f5]/20 transition-all">
                                    <Mail className="w-5 h-5 text-gray-400" />
                                    <input
                                        type="email"
                                        placeholder="name@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="ml-4 w-full bg-transparent outline-none text-[16px] text-[#4b5565] placeholder:text-gray-300"
                                    />
                                </div>
                            </div>

                            {/* PASSWORD */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-400 tracking-[0.2em] uppercase">
                                    PASSWORD
                                </label>
                                <div className="mt-3 flex items-center border border-gray-100 rounded-[20px] px-6 h-[60px] bg-gray-50 focus-within:ring-4 focus-within:ring-[#4c46f5]/5 focus-within:border-[#4c46f5]/20 transition-all">
                                    <Lock className="w-5 h-5 text-gray-400" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="ml-4 w-full bg-transparent outline-none text-[16px] text-[#4b5565] placeholder:text-gray-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="p-2 transition-colors rounded-lg overflow-hidden flex items-center justify-center hover:bg-black/5"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <Eye className="w-5 h-5 text-gray-400" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* BUTTON */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-8 w-full h-[60px] bg-[#4c46f5] text-white rounded-[20px] text-[16px] font-bold shadow-[0_15px_30px_rgba(76,70,245,0.25)] hover:bg-[#3d38c5] transition-all transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {loading ? "Signing In..." : "Sign In"}
                            </button>
                        </form>

                        {/* SSO DIVIDER */}
                        <div className="relative my-8 flex items-center justify-center">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-100" />
                            </div>
                            <div className="relative bg-white px-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                                OR CONTINUE WITH
                            </div>
                        </div>

                        {/* SSO BUTTONS GRID */}
                        <div className="space-y-3">
                            {/* GOOGLE SSO BUTTON */}
                            <GoogleSsoButton
                                onSuccess={async (credential) => {
                                    setLoading(true);
                                    setError("");
                                    const res = await loginWithSso('google', credential);
                                    if (!res.success) {
                                        setError(res.error || "Google authentication failed.");
                                    }
                                    setLoading(false);
                                }}
                                onError={(err) => setError(err || "Google sign-in was canceled or failed.")}
                            />

                            {/* MICROSOFT SSO BUTTON */}
                            <button
                                type="button"
                                onClick={handleMicrosoftLogin}
                                disabled={loading}
                                className="w-full h-[52px] border border-gray-200 bg-white hover:bg-gray-50/80 rounded-[18px] text-[14px] font-semibold text-gray-700 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5 cursor-pointer shadow-sm disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 23 23">
                                    <path fill="#f35325" d="M1 1h10v10H1z" />
                                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                                </svg>
                                <span>Sign in with Microsoft</span>
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* FULL SCREEN LOADER - Preserved */}
            <AnimatePresence>
                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            background: "rgba(255, 255, 255, 0.9)",
                            backdropFilter: "blur(10px)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 10000,
                        }}
                    >
                        <motion.div
                            animate={{
                                scale: [1, 1.1, 1],
                                opacity: [0.7, 1, 0.7],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        >
                            <Box
                                component="img"
                                src="/sidebar_logo.png"
                                alt="Trailytics Logo"
                                sx={{ width: 180, height: "auto", mb: 3 }}
                            />
                        </motion.div>
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Typography
                                variant="h5"
                                sx={{
                                    fontWeight: 700,
                                    color: "#1e293b",
                                    fontFamily: "Outfit, sans-serif",
                                    letterSpacing: "0.1em",
                                    textAlign: "center"
                                }}
                            >
                                Powered by <span style={{ color: "#4f46e5" }}>Trailytics</span>
                            </Typography>
                            <Box sx={{ width: "100%", mt: 2, height: 4, bgcolor: "#f1f5f9", borderRadius: 2, overflow: 'hidden' }}>
                                <motion.div
                                    animate={{
                                        x: ["-100%", "100%"]
                                    }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: "linear"
                                    }}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        background: "linear-gradient(90deg, transparent, #4f46e5, transparent)"
                                    }}
                                />
                            </Box>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const LoginPage = () => {
    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <LoginPageContent />
        </GoogleOAuthProvider>
    );
};

export default LoginPage;

