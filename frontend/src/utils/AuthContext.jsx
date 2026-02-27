import React, { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(() => {
        // Check localStorage on initial load
        return localStorage.getItem("isLoggedIn") === "true";
    });

    const login = (credentials) => {
        // Basic mock login - in a real app, this would verify with backend
        if (credentials.email === "admin@trailytics.com" && credentials.password === "admin123") {
            setIsLoggedIn(true);
            localStorage.setItem("isLoggedIn", "true");
            return true;
        }
        return false;
    };

    const logout = () => {
        setIsLoggedIn(false);
        localStorage.removeItem("isLoggedIn");
    };

    return (
        <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
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
