import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import { Box, CircularProgress, Typography } from "@mui/material";
import { Lock as LockIcon } from "@mui/icons-material";

// Maps route paths to their corresponding tab permission label (must match sidebar & admin panel)
export const ROUTE_TO_TAB_LABEL = {
    "/cross-platform-pricing": "Cross Platform Pricing",
    "/mop-analysis": "MOP Analysis",
    "/watch-tower": "Business Overview",
    "/report-studio": "Report Studio",
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
    "/primary-overview": "Primary Summary",
    "/secondary-overview": "Secondary Summary",
    "/pds-score": "PDS Score",
    "/on-shelf-availability": "Market Coverage",
    "/priority-action": "Priority Action",
};

// Ordered list of routes to try when finding the first allowed page (Business Overview /watch-tower is top priority)
export const ROUTE_PRIORITY = [
    "/watch-tower", "/cross-platform-pricing", "/geo-intelligence", "/insights", "/availability-analysis",
    "/on-shelf-availability", "/visibility-anlysis", "/market-share", "/sales", "/pricing-analysis",
    "/mop-analysis", "/performance-marketing", "/volume-cohort", "/content-score", "/content-analysis",
    "/inventory", "/pds-score", "/review-rating", "/piy", "/category-rca", "/priority-action",
    "/scheduled-reports", "/report-studio", "/download-report",
    "/primary-overview", "/secondary-overview",
];

/**
 * Resolves the raw value of a tab permission from tabPerms, checking direct keys and known aliases.
 */
export function getTabPermValue(tabPerms, label) {
    if (!tabPerms || typeof tabPerms !== 'object' || Object.keys(tabPerms).length === 0) {
        return undefined;
    }
    if (tabPerms[label] !== undefined) {
        return tabPerms[label];
    }
    // Check known aliases
    if (label === "Content Score" && tabPerms["Content Analysis"] !== undefined) {
        return tabPerms["Content Analysis"];
    }
    if (label === "Content Analysis" && tabPerms["Content Score"] !== undefined) {
        return tabPerms["Content Score"];
    }
    if (label === "Market Coverage" && tabPerms["On-Shelf Availability"] !== undefined) {
        return tabPerms["On-Shelf Availability"];
    }
    if (label === "On-Shelf Availability" && tabPerms["Market Coverage"] !== undefined) {
        return tabPerms["Market Coverage"];
    }
    if (label === "Review Rating" && tabPerms["Rating"] !== undefined) {
        return tabPerms["Rating"];
    }
    if (label === "Rating" && tabPerms["Review Rating"] !== undefined) {
        return tabPerms["Review Rating"];
    }
    if (label === "Priority Action" && tabPerms["Supply"] !== undefined) {
        return tabPerms["Supply"];
    }
    if (label === "Supply" && tabPerms["Priority Action"] !== undefined) {
        return tabPerms["Priority Action"];
    }
    return undefined;
}

/**
 * Checks whether tabPerms contains an explicit setting for this tab label (or alias).
 */
export function hasExplicitTabPerm(tabPerms, label) {
    return getTabPermValue(tabPerms, label) !== undefined;
}

/**
 * Checks whether a tab is permitted based on tabPerms.
 * Handles boolean true/false and object structures like { access: true/false, kpi: { ... } }.
 */
export function isTabPermitted(tabPerms, label) {
    if (!tabPerms || typeof tabPerms !== 'object' || Object.keys(tabPerms).length === 0) {
        return true; // No permissions defined -> default to visible
    }
    const val = getTabPermValue(tabPerms, label);
    if (val === undefined) {
        return true; // Tab not mentioned in permissions object -> default to visible
    }
    if (val === false) {
        return false;
    }
    if (typeof val === 'object' && val !== null) {
        if (val.access === false) return false;
        if (val.access === true) return true;
    }
    if (val === true) {
        return true;
    }
    return true;
}

/**
 * Check if a specific route path is allowed for the current user
 */
export function isRouteAllowed(path, user) {
    // Admin routes and routes without a tab mapping are always allowed
    const tabLabel = ROUTE_TO_TAB_LABEL[path];
    if (!tabLabel) return true;

    // If dbStatus is explicitly false, block all dashboard routes
    if (user?.dbStatus === false) return false;

    // Check per-user / per-db tab permissions
    return isTabPermitted(user?.tabPermissions, tabLabel);
}

/**
 * Find the first allowed route for this user
 */
export function getFirstAllowedRoute(user) {
    for (const route of ROUTE_PRIORITY) {
        if (isRouteAllowed(route, user)) {
            return route;
        }
    }
    return "/watch-tower";
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

    const userRole = user?.role?.toLowerCase() || '';
    const isAdmin = userRole.includes('admin') || userRole.includes('super');
    const hasMultipleWorkspaces = Array.isArray(user?.mappedDatabases) && user.mappedDatabases.length >= 2;
    const workspaceSelected = sessionStorage.getItem("workspaceSelected") === "true";

    // Enforce workspace selection screen if user has 2+ mapped DBs and hasn't selected a workspace yet
    if (!isAdmin && !adminOnly && hasMultipleWorkspaces && !workspaceSelected && location.pathname !== '/select-workspace') {
        return <Navigate to="/select-workspace" replace />;
    }

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
