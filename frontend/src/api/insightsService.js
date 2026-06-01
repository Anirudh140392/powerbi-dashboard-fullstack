import axiosInstance from "./axiosInstance";

export const fetchInsights = async (filters) => {
    try {
        const response = await axiosInstance.get("/insights", { params: filters });
        return response.data;
    } catch (error) {
        console.error("Error fetching insights:", error);
        throw error;
    }
};

export const fetchInsightsFilters = async () => {
    try {
        const response = await axiosInstance.get("/insights/filters");
        return response.data;
    } catch (error) {
        console.error("Error fetching insight filters:", error);
        return { success: false, data: { categories: [], productLines: [], geographies: [] } };
    }
};

export const fetchCorrelations = async (filters) => {
    try {
        const response = await axiosInstance.get("/insights/correlations", { params: filters });
        return response.data;
    } catch (error) {
        console.error("Error fetching correlations:", error);
        throw error;
    }
};

export const fetchCorrelationsTrend = async (filters) => {
    try {
        const response = await axiosInstance.get("/insights/correlations/trend", { params: filters });
        return response.data;
    } catch (error) {
        console.error("Error fetching correlations trend:", error);
        throw error;
    }
};
