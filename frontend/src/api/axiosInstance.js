import axios from "axios";

const axiosInstance = axios.create({
    // For production: use relative URL (nginx proxies /api to backend)
    baseURL: "/api",

    headers: {
        "Content-Type": "application/json",
    },
});

// Request interceptor: attach JWT token to every request
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
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
