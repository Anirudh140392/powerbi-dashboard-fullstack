import axios from "axios";

const axiosInstance = axios.create({
    // In dev: "/api" is proxied by Vite to the backend
    // In production: VITE_API_URL points to the actual backend (e.g., https://backend.onrender.com)
    baseURL: import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL}/api`
        : "/api",

    headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
    },
});

// Request interceptor: attach JWT token to every request
axiosInstance.interceptors.request.use(
    (config) => {
        // Ensure cache control headers are always set
        config.headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
        config.headers["Pragma"] = "no-cache";
        
        const token = sessionStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor: handle 401 (expired/invalid token)
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid - redirect to login
            localStorage.removeItem("isLoggedIn");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.hash = "#/login";
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
