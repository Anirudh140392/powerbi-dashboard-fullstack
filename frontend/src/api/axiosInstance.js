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

// Request interceptor: attach JWT token, current date, and qcUser to every request
axiosInstance.interceptors.request.use(
    (config) => {
        // Ensure cache control headers are always set
        config.headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
        config.headers["Pragma"] = "no-cache";

        // Attach browser local current date (YYYY-MM-DD)
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        config.headers["x-current-date"] = `${year}-${month}-${day}`;

        // Attach qc_user state from sessionStorage if available
        try {
            const storedUser = sessionStorage.getItem("user");
            if (storedUser) {
                const u = JSON.parse(storedUser);
                if (u?.qcUser !== undefined) {
                    config.headers["x-qc-user"] = String(u.qcUser);
                }
            }
        } catch (e) { /* ignore */ }
        
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
            if (window.location.hash) {
                window.location.hash = "#/login";
            } else {
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
