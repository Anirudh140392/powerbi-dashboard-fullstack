import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
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

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        setError("");
        setLoading(true);

        const timer = new Promise((resolve) => setTimeout(resolve, 2000));
        const result = await login({ email, password });

        if (result.success) {
            await timer;
            navigate("/watch-tower", { replace: true });
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
                            <Alert severity="error" sx={{ mb: 4, borderRadius: "18px" }}>
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
                                className="mt-8 w-full h-[64px] bg-[#4c46f5] text-white rounded-[24px] text-[18px] font-bold shadow-[0_20px_40px_rgba(76,70,245,0.3)] hover:bg-[#3d38c5] hover:shadow-[0_25px_50px_rgba(76,70,245,0.4)] transition-all transform hover:-translate-y-1 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? "Signing In..." : "Sign In"}
                            </button>
                        </form>

                        <p className="text-center text-[15px] font-medium text-gray-500 mt-8 cursor-pointer hover:text-[#4c46f5] transition-colors">
                            Forgot password?
                        </p>
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

export default LoginPage;
