import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import axios from "axios";
import fpPromise from "@fingerprintjs/fingerprintjs";

const AuthContext = createContext(null);

// API base URL for auth requests
// In dev: uses "/api" (proxied by Vite to backend)
// In production: uses VITE_API_URL env var (e.g., https://backend.onrender.com/api)
const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";

/**
 * Helper to extract browser/OS metadata from the UserAgent string.
 * This information is sent to the backend to help admins identify devices.
 */
function getBrowserMetadata() {
    const ua = navigator.userAgent || '';
    let browser = 'Unknown';
    let browserVersion = '';
    let os = 'Unknown';
    let platform = navigator.platform || '';

    // Detect browser
    if (ua.includes('Firefox/')) {
        browser = 'Firefox';
        browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Edg/')) {
        browser = 'Edge';
        browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Chrome/')) {
        browser = 'Chrome';
        browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || '';
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
        browser = 'Safari';
        browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || '';
    }

    // Detect OS
    if (ua.includes('Windows NT')) os = 'Windows';
    else if (ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';

    return { browser, browserVersion, os, platform };
}

export const AuthProvider = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(() => {
        return sessionStorage.getItem("isLoggedIn") === "true";
    });

    const [user, setUser] = useState(() => {
        const stored = sessionStorage.getItem("user");
        return stored ? JSON.parse(stored) : null;
    });

    // Loading state: true while verifying session on mount/refresh
    const [isVerifying, setIsVerifying] = useState(() => {
        // Only need to verify if we think we're logged in
        return sessionStorage.getItem("isLoggedIn") === "true";
    });

    const login = async (credentials) => {
        try {
            // Get FingerprintJS visitorId (used as secondary/fallback device signal)
            let visitorId = '';
            try {
                const fp = await fpPromise.load();
                const result = await fp.get();
                visitorId = result.visitorId;
            } catch (e) {
                console.warn("Could not generate device fingerprint", e);
            }

            // Get browser metadata for admin identification
            const { browser, browserVersion, os, platform } = getBrowserMetadata();

            const response = await axios.post(`${API_BASE}/auth/login`, {
                email: credentials.email,
                password: credentials.password,
                visitorId,       // FingerprintJS ID (secondary device signal)
                browser,
                browserVersion,
                os,
                platform,
            }, {
                withCredentials: true,  // Required for HTTP-only cookie handling
            });

            if (response.data.success) {
                const { token, user: userData } = response.data;

                // Normalize role to lowercase for consistent checks
                if (userData.role) {
                    userData.role = userData.role.toLowerCase();
                }

                // Store auth data
                sessionStorage.setItem("isLoggedIn", "true");
                sessionStorage.setItem("token", token);
                sessionStorage.setItem("user", JSON.stringify(userData));

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
        sessionStorage.removeItem("isLoggedIn");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
    };

    // Verify session on mount/refresh: re-validate token with backend
    useEffect(() => {
        const verifySession = async () => {
            const token = sessionStorage.getItem("token");
            const storedLoggedIn = sessionStorage.getItem("isLoggedIn") === "true";

            if (!storedLoggedIn || !token) {
                setIsVerifying(false);
                setIsLoggedIn(false);
                setUser(null);
                return;
            }

            try {
                const response = await axios.get(`${API_BASE}/auth/verify`, {
                    headers: { Authorization: `Bearer ${token}` },
                    withCredentials: true,  // Send device_token cookie for re-verification
                });

                if (response.data.success) {
                    const userData = response.data.user;
                    // Normalize role to lowercase for consistent checks
                    if (userData.role) {
                        userData.role = userData.role.toLowerCase();
                    }
                    setIsLoggedIn(true);
                    setUser(userData);
                    sessionStorage.setItem("user", JSON.stringify(userData));
                } else {
                    // Token invalid or access revoked
                    console.warn("[Auth] Session verification failed:", response.data.error);
                    logout();
                }
            } catch (error) {
                console.warn("[Auth] Session verification error:", error.message);
                // If backend is unreachable, still allow cached session
                // but normalize the role from cached data
                const stored = sessionStorage.getItem("user");
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

    const loginWithToken = (token, userData) => {
        if (userData?.role) {
            userData.role = userData.role.toLowerCase();
        }
        sessionStorage.setItem("isLoggedIn", "true");
        sessionStorage.setItem("token", token);
        sessionStorage.setItem("user", JSON.stringify(userData));

        setIsLoggedIn(true);
        setUser(userData);
        setIsVerifying(false);
    };

    const loginWithSso = async (provider, payloadData) => {
        try {
            let visitorId = '';
            try {
                const fp = await fpPromise.load();
                const result = await fp.get();
                visitorId = result.visitorId;
            } catch (e) { /* ignore */ }

            const { browser, browserVersion, os, platform } = getBrowserMetadata();
            const endpoint = provider === 'google' ? `${API_BASE}/auth/google-login` : `${API_BASE}/auth/microsoft-login`;
            const reqBody = provider === 'google'
                ? { credential: payloadData, visitorId, browser, browserVersion, os, platform }
                : { idToken: payloadData, visitorId, browser, browserVersion, os, platform };

            const response = await axios.post(endpoint, reqBody, { withCredentials: true });

            if (response.data.success) {
                const { token, user: userData } = response.data;
                loginWithToken(token, userData);
                return { success: true, user: userData };
            }
            return { success: false, error: response.data.error || `${provider} login failed` };
        } catch (error) {
            const errorMsg = error.response?.data?.error || `${provider} authentication failed`;
            return { success: false, error: errorMsg };
        }
    };

    return (
        <AuthContext.Provider value={{ isLoggedIn, user, login, logout, isVerifying, loginWithToken, loginWithSso }}>
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
