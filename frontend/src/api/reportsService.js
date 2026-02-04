import axiosInstance from "./axiosInstance";

// Helper to convert array params to comma-separated strings for multi-select filters
const formatParams = (params) => {
    const formatted = {};
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
            formatted[key] = value.join(',');
        } else if (value !== undefined && value !== null && value !== '') {
            formatted[key] = value;
        }
    }
    return formatted;
};

export const fetchReportFilterOptions = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/reports/filter-options", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchReportFilterOptions error:", error);
        throw error;
    }
};

export const downloadReport = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/reports/download", {
            params: formatParams(params),
            responseType: 'blob'
        });
        return response.data;
    } catch (error) {
        console.error("downloadReport error:", error);
        throw error;
    }
};
