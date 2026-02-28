import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import {
    Box,
    TextField,
    Button,
    Typography,
    IconButton,
    InputAdornment,
    Alert,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import {
    Visibility,
    VisibilityOff,
    Email as EmailIcon,
    Lock as LockIcon,
} from "@mui/icons-material";
import ads3dIllustration from "../../assets/ads_3d.png";

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    // Mouse Parallax Values
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const springConfig = { damping: 25, stiffness: 150 };
    const springX = useSpring(mouseX, springConfig);
    const springY = useSpring(mouseY, springConfig);

    // Parallax Transforms
    const rotateX = useTransform(springY, [-0.5, 0.5], [10, -10]);
    const rotateY = useTransform(springX, [-0.5, 0.5], [-10, 10]);
    const translateX = useTransform(springX, [-0.5, 0.5], [-20, 20]);
    const translateY = useTransform(springY, [-0.5, 0.5], [-20, 20]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            const { innerWidth, innerHeight } = window;
            const x = (e.clientX / innerWidth) - 0.5;
            const y = (e.clientY / innerHeight) - 0.5;
            mouseX.set(x);
            mouseY.set(y);
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [mouseX, mouseY]);


    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        // Start a 2-second timer
        const timer = new Promise((resolve) => setTimeout(resolve, 2000));

        const success = await login({ email, password });

        if (success) {
            // Wait for the timer to finish before navigating
            await timer;
            navigate("/", { replace: true });
        } else {
            setError("Invalid credentials. Use admin@trailytics.com / admin123 (Admin) or shubham@trailytics.com / shubham123 (User)");
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { duration: 0.6, staggerChildren: 0.1 },
        },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { duration: 0.5 } },
    };

    return (
        <Box
            sx={{
                height: "100vh",
                width: "100vw",
                display: "flex",
                overflow: "hidden",
                bgcolor: "#fff",
            }}
        >
            {/* LEFT PANEL - 3D ILLUSTRATION */}
            {!isMobile && (
                <Box
                    sx={{
                        flex: 1.5,
                        background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        p: 6,
                        overflow: "hidden",
                    }}
                >
                    <motion.div
                        style={{
                            perspective: 1000,
                            width: "100%",
                            maxWidth: "600px",
                            textAlign: "center",
                            zIndex: 2,
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <Typography
                                variant="h3"
                                sx={{
                                    color: "#fff",
                                    fontWeight: 800,
                                    mb: 1.5,
                                    fontFamily: "Outfit, sans-serif",
                                    textShadow: "0 10px 20px rgba(0,0,0,0.1)",
                                }}
                            >
                                Master Your Ad Campaigns
                            </Typography>
                            <Typography
                                variant="h6"
                                sx={{
                                    color: "rgba(255, 255, 255, 0.85)",
                                    mb: 8,
                                    fontWeight: 400,
                                    maxWidth: "500px",
                                    mx: "auto",
                                }}
                            >
                                Intelligent analytics for maximum performance and cross-platform visibility.
                            </Typography>
                        </motion.div>

                        <motion.div
                            style={{
                                rotateX,
                                rotateY,
                                x: translateX,
                                y: translateY,
                            }}
                            animate={{
                                y: [0, -15, 0],
                            }}
                            transition={{
                                duration: 6,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        >
                            <Box
                                component="img"
                                src={ads3dIllustration}
                                alt="Ads Management Illustration"
                                sx={{
                                    width: "100%",
                                    height: "auto",
                                    maxHeight: "550px",
                                    objectFit: "contain",
                                    filter: "drop-shadow(0 30px 50px rgba(0,0,0,0.3))",
                                }}
                            />
                        </motion.div>
                    </motion.div>

                    {/* Decorative 3D-feeling shapes (parallax) */}
                    <motion.div
                        style={{
                            position: "absolute",
                            top: "10%",
                            left: "5%",
                            width: 150,
                            height: 150,
                            borderRadius: "50%",
                            background: "rgba(255, 255, 255, 0.08)",
                            x: useTransform(springX, [-0.5, 0.5], [-50, 50]),
                            y: useTransform(springY, [-0.5, 0.5], [-50, 50]),
                        }}
                    />
                    <motion.div
                        style={{
                            position: "absolute",
                            bottom: "15%",
                            right: "10%",
                            width: 250,
                            height: 250,
                            borderRadius: "50%",
                            background: "rgba(255, 255, 255, 0.05)",
                            x: useTransform(springX, [-0.5, 0.5], [100, -100]),
                            y: useTransform(springY, [-0.5, 0.5], [100, -100]),
                        }}
                    />
                    <Box
                        sx={{
                            position: "absolute",
                            top: "-15%",
                            right: "-5%",
                            width: 400,
                            height: 400,
                            borderRadius: "50%",
                            background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
                            zIndex: 1,
                        }}
                    />
                </Box>
            )}

            {/* RIGHT PANEL - LOGIN FORM */}
            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    p: { xs: 3, md: 8 },
                    bgcolor: "#fff",
                    zIndex: 10,
                }}
            >
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    style={{ width: "100%", maxWidth: "420px" }}
                >
                    <motion.div variants={itemVariants}>
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 800,
                                color: "#1e293b",
                                mb: 1,
                                fontFamily: "Outfit, sans-serif",
                                textAlign: "left",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            Get Started
                        </Typography>
                        <Box sx={{ width: "50px", height: "4px", bgcolor: "#4F46E5", mb: 8, borderRadius: "2px" }} />
                    </motion.div>

                    {error && (
                        <motion.div variants={itemVariants}>
                            <Alert severity="error" sx={{ mb: 4, borderRadius: "16px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                                {error}
                            </Alert>
                        </motion.div>
                    )}

                    <Box
                        component="form"
                        onSubmit={handleLogin}
                        sx={{ width: "100%" }}
                    >
                        <motion.div variants={itemVariants}>
                            <Typography
                                variant="body2"
                                sx={{
                                    fontWeight: 600,
                                    color: "#475569",
                                    mb: 1.5,
                                    ml: 0.5,
                                    textTransform: "uppercase",
                                    fontSize: "0.75rem",
                                    letterSpacing: "0.05em",
                                }}
                            >
                                Email Address
                            </Typography>
                            <TextField
                                fullWidth
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                variant="outlined"
                                required
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <EmailIcon sx={{ color: "#94a3b8", fontSize: "1.2rem" }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    mb: 4,
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "16px",
                                        bgcolor: "#f8fafc",
                                        transition: "all 0.2s",
                                        "&:hover": { bgcolor: "#f1f5f9" },
                                        "&.Mui-focused": { bgcolor: "#fff", boxShadow: "0 0 0 4px rgba(79, 70, 229, 0.1)" },
                                        "& fieldset": { borderColor: "#e2e8f0" },
                                    },
                                }}
                            />
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 600,
                                        color: "#475569",
                                        ml: 0.5,
                                        textTransform: "uppercase",
                                        fontSize: "0.75rem",
                                        letterSpacing: "0.05em",
                                    }}
                                >
                                    Password
                                </Typography>
                                {/* <Typography
                                    variant="body2"
                                    sx={{
                                        color: "#4F46E5",
                                        fontWeight: 600,
                                        fontSize: "0.75rem",
                                        cursor: "pointer",
                                        "&:hover": { textDecoration: "underline" },
                                    }}
                                >
                                    Forgot password?
                                </Typography> */}
                            </Box>
                            <TextField
                                fullWidth
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                variant="outlined"
                                required
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LockIcon sx={{ color: "#94a3b8", fontSize: "1.2rem" }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowPassword(!showPassword)}
                                                edge="end"
                                                sx={{ color: "#94a3b8" }}
                                            >
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    mb: 6,
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "16px",
                                        bgcolor: "#f8fafc",
                                        transition: "all 0.2s",
                                        "&:hover": { bgcolor: "#f1f5f9" },
                                        "&.Mui-focused": { bgcolor: "#fff", boxShadow: "0 0 0 4px rgba(79, 70, 229, 0.1)" },
                                        "& fieldset": { borderColor: "#e2e8f0" },
                                    },
                                }}
                            />
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                disabled={loading}
                                sx={{
                                    py: 2,
                                    borderRadius: "16px",
                                    bgcolor: "#4F46E5",
                                    textTransform: "none",
                                    fontSize: "1.05rem",
                                    fontWeight: 700,
                                    boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4)",
                                    "&:hover": {
                                        bgcolor: "#4338CA",
                                        boxShadow: "0 20px 30px -5px rgba(79, 70, 229, 0.5)",
                                        transform: "translateY(-2px)",
                                    },
                                    transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                                }}
                            >
                                Sign In
                            </Button>
                        </motion.div>
                    </Box>
                </motion.div>
            </Box>

            {/* FULL SCREEN LOADER */}
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
                                src="/Trailytics.jpg"
                                alt="Trailytics Logo"
                                sx={{ width: 120, height: "auto", mb: 3 }}
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
                                Powered by <span style={{ color: "#4F46E5" }}>Trailytics</span>
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
                                        background: "linear-gradient(90deg, transparent, #4F46E5, transparent)"
                                    }}
                                />
                            </Box>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Box>
    );
};

export default LoginPage;
