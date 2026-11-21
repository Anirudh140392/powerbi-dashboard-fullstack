import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";

/**
 * VisitorTracker component
 * Monitors route transitions and records user page visits into admin_master.tb_visitors.
 * Automatically extracts:
 *   - email: from AuthContext
 *   - client_db: user's active dbName
 *   - page: location.pathname
 */
export default function VisitorTracker() {
    const location = useLocation();
    const { user, isLoggedIn } = useAuth();
    const lastTrackedRef = useRef({ page: null, email: null, client_db: null });

    useEffect(() => {
        // Track only when user is logged in and has an email
        if (!isLoggedIn || !user?.email) {
            return;
        }

        const email = user.email.toLowerCase().trim();
        const client_db = (user.dbName || "").toLowerCase().trim();
        const page = (location.pathname || "/").replace(/\/$/, "") || "/";

        // Prevent redundant tracking of the exact same page for the same user and client_db
        if (
            lastTrackedRef.current.page === page &&
            lastTrackedRef.current.email === email &&
            lastTrackedRef.current.client_db === client_db
        ) {
            return;
        }

        lastTrackedRef.current = { page, email, client_db };

        const token = sessionStorage.getItem("token");
        const headers = {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        axios.post(
            `${API_BASE}/visitors/track`,
            {
                email,
                client_db,
                page,
            },
            {
                headers,
                withCredentials: true,
            }
        ).catch((err) => {
            // Silently catch error so tracking never impacts UI or navigation
            console.debug("[VisitorTracker] Error recording page visit:", err?.message);
        });
    }, [location.pathname, user?.email, user?.dbName, isLoggedIn]);

    return null;
}
