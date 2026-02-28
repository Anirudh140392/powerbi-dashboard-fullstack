import React, { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(() => {
        // Check localStorage on initial load
        return localStorage.getItem("isLoggedIn") === "true";
    });

    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem("user");
        return storedUser ? JSON.parse(storedUser) : null;
    });

    const login = (credentials) => {
        // Basic mock login - in a real app, this would verify with backend
        if (credentials.email === "admin@trailytics.com" && credentials.password === "admin123") {
            setIsLoggedIn(true);
            const userData = { email: credentials.email, role: "admin", name: "Admin" };
            setUser(userData);
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("user", JSON.stringify(userData));
            return true;
        } else if (credentials.email === "shubham@trailytics.com" && credentials.password === "shubham123") {
            setIsLoggedIn(true);
            const userData = { email: credentials.email, role: "user", name: "Shubham" };
            setUser(userData);
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("user", JSON.stringify(userData));
            return true;
        } else if (credentials.email && credentials.password) {
            // Mock login for other users
            setIsLoggedIn(true);
            const userData = { email: credentials.email, role: "user", name: "User" };
            setUser(userData);
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("user", JSON.stringify(userData));
            return true;
        }
        return false;
    };

    const logout = () => {
        setIsLoggedIn(false);
        setUser(null);
        localStorage.removeItem("isLoggedIn");
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
