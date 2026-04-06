import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";

const ProtectedRoute = ({ children, adminOnly = false }) => {
    const { isLoggedIn, user } = useAuth();
    const location = useLocation();

    if (!isLoggedIn) {
        // Redirect to login page but save the current location to redirect back after login
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (adminOnly && user?.role !== 'admin') {
        // Redirect non-admin users to home/watch-tower
        return <Navigate to="/watch-tower" replace />;
    }

    return children;
};

export default ProtectedRoute;
