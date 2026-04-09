import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import { Box, CircularProgress, Typography } from "@mui/material";

const ProtectedRoute = ({ children, adminOnly = false }) => {
    const { isLoggedIn, user, isVerifying } = useAuth();
    const location = useLocation();

    // Show loading screen while verifying session (on page refresh)
    if (isVerifying) {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    width: "100vw",
                    background: "linear-gradient(135deg, #f8f9fe 0%, #eef0ff 100%)",
                    gap: 2,
                }}
            >
                <Box
                    component="img"
                    src="/sidebar_logo.png"
                    alt="Trailytics Logo"
                    sx={{ width: 140, height: "auto", mb: 2, opacity: 0.8 }}
                />
                <CircularProgress
                    size={36}
                    sx={{ color: "#4f46e5" }}
                />
                <Typography
                    variant="body2"
                    sx={{
                        color: "#94a3b8",
                        fontFamily: "Outfit, sans-serif",
                        fontWeight: 500,
                        mt: 1,
                    }}
                >
                    Verifying session...
                </Typography>
            </Box>
        );
    }

    if (!isLoggedIn) {
        // Redirect to login page but save the current location to redirect back after login
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (adminOnly) {
        const userRole = user?.role?.toLowerCase() || '';
        const hasAdminAccess = userRole.includes('admin') || userRole.includes('super');
        if (!hasAdminAccess) {
            // Redirect non-admin users to home/watch-tower
            return <Navigate to="/watch-tower" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
