import axios from "axios";

const axiosInstance = axios.create({
    // baseURL: "http://3.7.138.75:5001/api",
    baseURL: "http://localhost:5000/api",

    headers: {
        "Content-Type": "application/json",
    },
});

export default axiosInstance;
