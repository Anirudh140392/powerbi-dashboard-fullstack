// frontend/src/api/secondarySalesService.js
import axiosInstance from "./axiosInstance";

const formatParams = (params) => {
    const formatted = {};
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
            if (value.length > 0) formatted[key] = value.join(',');
        } else if (value !== undefined && value !== null && value !== '') {
            formatted[key] = value;
        }
    }
    return formatted;
};

/**
 * Fetch distinct options for secondary sales filters from ClickHouse (rb_secondary_olap)
 */
export const fetchSecondaryFilterOptions = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/secondary-sales/filters", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchSecondaryFilterOptions error:", error);
        throw error;
    }
};

/**
 * Fetch latest available dates in rb_secondary_olap
 */
export const fetchSecondaryLatestDate = async () => {
    try {
        const response = await axiosInstance.get("/secondary-sales/latest-date");
        return response.data;
    } catch (error) {
        console.error("fetchSecondaryLatestDate error:", error);
        throw error;
    }
};

/**
 * Fetch seller-wise sales data (donut + table)
 */
export const fetchSecondarySellerWise = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/secondary-sales/seller-wise", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchSecondarySellerWise error:", error);
        throw error;
    }
};

/**
 * Fetch quarter-wise sales data (area chart)
 */
export const fetchSecondaryQuarterWise = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/secondary-sales/quarter-wise", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchSecondaryQuarterWise error:", error);
        throw error;
    }
};

/**
 * Fetch top 5 brand contribution data
 */
export const fetchSecondaryTopBrands = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/secondary-sales/top-brands", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchSecondaryTopBrands error:", error);
        throw error;
    }
};

/**
 * Fetch MRP / Units monthly sales timeline data
 */
export const fetchSecondarySalesTimeline = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/secondary-sales/sales-timeline", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchSecondarySalesTimeline error:", error);
        throw error;
    }
};
