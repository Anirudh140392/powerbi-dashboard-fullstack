import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import axios from "axios";

const AuthContext = createContext(null);

// API base URL for auth requests
// In dev: uses "/api" (proxied by Vite to backend)
// In production: uses VITE_API_URL env var (e.g., https://backend.onrender.com/api)
const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";

export const AuthProvider = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(() => {
        return localStorage.getItem("isLoggedIn") === "true";
    });

    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem("user");
        return stored ? JSON.parse(stored) : null;
    });

    // Loading state: true while verifying session on mount/refresh
    const [isVerifying, setIsVerifying] = useState(() => {
        // Only need to verify if we think we're logged in
        return localStorage.getItem("isLoggedIn") === "true";
    });

    const login = async (credentials) => {
        try {
            let publicIp = '';
            try {
                const ipRes = await axios.get('https://api.ipify.org?format=json');
                publicIp = ipRes.data.ip;
            } catch (e) {
                console.warn("Could not fetch public IP", e);
            }

            const response = await axios.post(`${API_BASE}/auth/login`, {
                email: credentials.email,
                password: credentials.password,
                publicIp: publicIp
            });

            if (response.data.success) {
                const { token, user: userData } = response.data;

                // Normalize role to lowercase for consistent checks
                if (userData.role) {
                    userData.role = userData.role.toLowerCase();
                }

                // Store auth data
                localStorage.setItem("isLoggedIn", "true");
                localStorage.setItem("token", token);
                localStorage.setItem("user", JSON.stringify(userData));

                setIsLoggedIn(true);
                setUser(userData);
                setIsVerifying(false);
                return { success: true };
            }

            return { success: false, error: response.data.error || "Login failed" };
        } catch (error) {
            const errorMsg =
                error.response?.data?.error || "Invalid email or password";
            return { success: false, error: errorMsg };
        }
    };

    const logout = () => {
        setIsLoggedIn(false);
        setUser(null);
        setIsVerifying(false);
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    };

    // Verify session on mount/refresh: re-validate token with backend
    useEffect(() => {
        const verifySession = async () => {
            const token = localStorage.getItem("token");
            const storedLoggedIn = localStorage.getItem("isLoggedIn") === "true";

            if (!storedLoggedIn || !token) {
                setIsVerifying(false);
                setIsLoggedIn(false);
                setUser(null);
                return;
            }

            try {
                const response = await axios.get(`${API_BASE}/auth/verify`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.data.success) {
                    const userData = response.data.user;
                    // Normalize role to lowercase for consistent checks
                    if (userData.role) {
                        userData.role = userData.role.toLowerCase();
                    }
                    setIsLoggedIn(true);
                    setUser(userData);
                    localStorage.setItem("user", JSON.stringify(userData));
                } else {
                    // Token invalid or access revoked
                    console.warn("[Auth] Session verification failed:", response.data.error);
                    logout();
                }
            } catch (error) {
                console.warn("[Auth] Session verification error:", error.message);
                // If backend is unreachable, still allow cached session
                // but normalize the role from cached data
                const stored = localStorage.getItem("user");
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (parsed.role) {
                            parsed.role = parsed.role.toLowerCase();
                        }
                        setUser(parsed);
                    } catch (e) { /* ignore parse error */ }
                }
            } finally {
                setIsVerifying(false);
            }
        };

        verifySession();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <AuthContext.Provider value={{ isLoggedIn, user, login, logout, isVerifying }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
