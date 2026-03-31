import React, { createContext, useState, useContext, useEffect } from "react";
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

    const login = async (credentials) => {
        try {
            const response = await axios.post(`${API_BASE}/auth/login`, {
                email: credentials.email,
                password: credentials.password,
            });

            if (response.data.success) {
                const { token, user: userData } = response.data;

                // Store auth data
                localStorage.setItem("isLoggedIn", "true");
                localStorage.setItem("token", token);
                localStorage.setItem("user", JSON.stringify(userData));

                setIsLoggedIn(true);
                setUser(userData);
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
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    };

    return (
        <AuthContext.Provider value={{ isLoggedIn, user, login, logout }}>
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
