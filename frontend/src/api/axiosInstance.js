import axios from "axios";

const axiosInstance = axios.create({
    baseURL: "https://powerbi-dashboard-backend.onrender.com/api",
    headers: {
        "Content-Type": "application/json",
    },
});

export default axiosInstance;
