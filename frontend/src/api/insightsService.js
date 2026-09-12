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

// ── Alert CRUD API ──────────────────────────────────────────────────────

export const createAlert = async (alertData) => {
    try {
        const response = await axiosInstance.post("/insights/alerts", alertData);
        return response.data;
    } catch (error) {
        console.error("Error creating alert:", error);
        throw error;
    }
};

export const updateAlert = async (id, alertData) => {
    try {
        const response = await axiosInstance.put(`/insights/alerts/${id}`, alertData);
        return response.data;
    } catch (error) {
        console.error("Error updating alert:", error);
        throw error;
    }
};

export const fetchAlerts = async () => {
    try {
        const response = await axiosInstance.get("/insights/alerts");
        return response.data;
    } catch (error) {
        console.error("Error fetching alerts:", error);
        return { success: false, data: [] };
    }
};

export const deleteAlertApi = async (alertId) => {
    try {
        const response = await axiosInstance.delete(`/insights/alerts/${alertId}`);
        return response.data;
    } catch (error) {
        console.error("Error deleting alert:", error);
        throw error;
    }
};

