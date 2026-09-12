import axiosInstance from "./axiosInstance";

const formatParams = (params) => {
    const formatted = {};
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
            formatted[key] = value.join(',');
        } else if (value !== undefined && value !== null && value !== '' && value !== 'All') {
            formatted[key] = value;
        }
    }
    return formatted;
};

/**
 * Fetch visibility signals (gainers/drainers) for the Signal Lab
 * @param {Object} params - { level, signalType, platform, location, startDate, endDate }
 */
export const fetchVisibilitySignals = async (params) => {
    try {
        const response = await axiosInstance.get("/sales/visibility-signals", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchVisibilitySignals error:", error);
        throw error;
    }
};

/**
 * Fetch city-level KPI details for a specific keyword/SKU visibility signal
 * @param {Object} params - { keyword, skuName, level, platform, startDate, endDate }
 */
export const fetchVisibilitySignalCityDetails = async (params) => {
    try {
        const response = await axiosInstance.get("/sales/visibility-signals/city-details", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchVisibilitySignalCityDetails error:", error);
        throw error;
    }
};
