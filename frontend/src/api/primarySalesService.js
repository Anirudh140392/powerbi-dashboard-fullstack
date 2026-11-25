// frontend/src/api/primarySalesService.js
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

/**
 * Fetch all Primary Sales Summary data (MOM, Quarterly, Pivot table) in one call
 */
export const fetchPrimarySalesAll = async (params) => {
    try {
        const response = await axiosInstance.get("/primary-sales/all", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchPrimarySalesAll error:", error);
        throw error;
    }
};

/**
 * Fetch distinct options for filters
 */
export const fetchPrimaryFilterOptions = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/primary-sales/filters", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchPrimaryFilterOptions error:", error);
        throw error;
    }
};

/**
 * Fetch latest available billing dates in rb_primary_olap
 */
export const fetchPrimaryLatestDate = async () => {
    try {
        const response = await axiosInstance.get("/primary-sales/latest-date");
        return response.data;
    } catch (error) {
        console.error("fetchPrimaryLatestDate error:", error);
        throw error;
    }
};

/**
 * Fetch top products/sub-items for Gainers and Drainers drilldown
 */
export const fetchPrimaryTopProducts = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/primary-sales/top-products", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchPrimaryTopProducts error:", error);
        throw error;
    }
};

/**
 * Fetch daily retailer sales/units trend for Retailer Wise Analysis chart
 */
export const fetchPrimaryRetailerDailyTrend = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/primary-sales/retailer-daily-trend", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchPrimaryRetailerDailyTrend error:", error);
        throw error;
    }
};
