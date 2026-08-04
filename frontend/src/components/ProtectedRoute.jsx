import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import { Box, CircularProgress, Typography } from "@mui/material";
import { Lock as LockIcon } from "@mui/icons-material";

// Maps route paths to their corresponding tab permission label (must match sidebar & admin panel)
const ROUTE_TO_TAB_LABEL = {
    "/watch-tower": "Business Overview",
    "/geo-intelligence": "India Overview",
    "/insights": "Insights",
    "/availability-analysis": "Availability Analysis",
    "/visibility-anlysis": "Visibility Analysis",
    "/market-share": "Market Share",
    "/sales": "Sales Data",
    "/pricing-analysis": "Pricing Analysis",
    "/performance-marketing": "Performance Marketing",
    "/volume-cohort": "Portfolio Analysis",
    "/content-score": "Content Score",
    "/content-analysis": "Content Analysis",
    "/inventory": "Inventory Analysis",
    "/piy": "Play it Yourself",
    "/category-rca": "Category RCA",
    "/scheduled-reports": "Scheduled Reports",
    "/download-report": "Download Report",
    "/review-rating": "Review Rating",
    "/pds-score": "PDS Score",
    "/on-shelf-availability": "Market Coverage",
};

// Ordered list of routes to try when finding the first allowed page
const ROUTE_PRIORITY = [
    "/watch-tower", "/geo-intelligence", "/insights", "/availability-analysis",
    "/visibility-anlysis", "/market-share", "/pricing-analysis",
    "/performance-marketing", "/content-score", "/content-analysis", "/inventory",
    "/scheduled-reports", "/download-report", "/review-rating",
];

/**
 * Check if a specific route path is allowed for the current user
 */
function isRouteAllowed(path, user) {
    // Admin routes and routes without a tab mapping are always allowed
    const tabLabel = ROUTE_TO_TAB_LABEL[path];
    if (!tabLabel) return true;

    // If dbStatus is explicitly false, block all dashboard routes
    if (user?.dbStatus === false) return false;

    // Check per-user tab permissions
    const tabPerms = user?.tabPermissions;
    if (tabPerms && Object.keys(tabPerms).length > 0) {
        if (tabPerms[tabLabel] !== undefined) {
            if (tabPerms[tabLabel] === false) return false;
        } else {
            // Fallback for Content Score / Content Analysis label alias mismatch
            if (tabLabel === "Content Score" && tabPerms["Content Analysis"] === false) return false;
            if (tabLabel === "Content Analysis" && tabPerms["Content Score"] === false) return false;
        }
    }

    return true;
}

/**
 * Find the first allowed route for this user
 */
function getFirstAllowedRoute(user) {
    for (const route of ROUTE_PRIORITY) {
        if (isRouteAllowed(route, user)) {
            return route;
        }
    }
    return null; // No routes allowed
}

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

    // --- Tab Permission & DB Status Enforcement ---
    // Skip permission checks for admin users and admin-only routes
    const userRole = user?.role?.toLowerCase() || '';
    const isAdmin = userRole.includes('admin') || userRole.includes('super');

    if (!isAdmin && !adminOnly) {
        const currentPath = location.pathname;

        // Check if the user's DB status is inactive → block ALL dashboard pages
        if (user?.dbStatus === false) {
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
                    <LockIcon sx={{ fontSize: 48, color: "#94a3b8" }} />
                    <Typography
                        variant="h6"
                        sx={{
                            color: "#334155",
                            fontFamily: "Outfit, sans-serif",
                            fontWeight: 700,
                        }}
                    >
                        Access Restricted
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            color: "#94a3b8",
                            fontFamily: "Outfit, sans-serif",
                            fontWeight: 500,
                            textAlign: "center",
                            maxWidth: 400,
                        }}
                    >
                        Your dashboard access is currently inactive. Please contact your administrator to enable access.
                    </Typography>
                </Box>
            );
        }

        // Check if this specific tab/page is allowed
        if (!isRouteAllowed(currentPath, user)) {
            // Find the first allowed route and redirect there
            const fallback = getFirstAllowedRoute(user);
            if (fallback) {
                return <Navigate to={fallback} replace />;
            }

            // No routes allowed at all — show restricted message
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
                    <LockIcon sx={{ fontSize: 48, color: "#94a3b8" }} />
                    <Typography
                        variant="h6"
                        sx={{
                            color: "#334155",
                            fontFamily: "Outfit, sans-serif",
                            fontWeight: 700,
                        }}
                    >
                        Page Not Available
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            color: "#94a3b8",
                            fontFamily: "Outfit, sans-serif",
                            fontWeight: 500,
                            textAlign: "center",
                            maxWidth: 400,
                        }}
                    >
                        You don't have access to this page. Please contact your administrator.
                    </Typography>
                </Box>
            );
        }
    }

    return children;
};

export default ProtectedRoute;
