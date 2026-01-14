import axios from "axios";

const axiosInstance = axios.create({
    // For production: use relative URL (nginx proxies /api to backend)
    baseURL: "/api",

    headers: {
        "Content-Type": "application/json",
    },
});

export default axiosInstance;
