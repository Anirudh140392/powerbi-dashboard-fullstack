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

export const fetchSalesDrilldown = async (params) => {
    try {
        const response = await axiosInstance.get("/sales/drilldown", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchSalesDrilldown error:", error);
        throw error;
    }
};

export const fetchCategorySalesMatrix = async (params) => {
    try {
        const response = await axiosInstance.get("/sales/category-matrix", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchCategorySalesMatrix error:", error);
        throw error;
    }
};

export const fetchSalesTrends = async (params) => {
    try {
        const response = await axiosInstance.get("/sales/trends", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchSalesTrends error:", error);
        throw error;
    }
};

export const fetchSalesFilterOptions = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/sales/filter-options", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchSalesFilterOptions error:", error);
        throw error;
    }
};
