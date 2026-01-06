import axios from "axios";

const axiosInstance = axios.create({
    baseURL: "http://3.7.138.75:5001/api",

    headers: {
        "Content-Type": "application/json",
    },
});

export default axiosInstance;
