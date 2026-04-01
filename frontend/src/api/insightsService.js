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
