import axiosInstance from "./axiosInstance";

export const fetchMopFilters = async () => {
    try {
        const response = await axiosInstance.get("/mop-analysis/filters");
        return response.data;
    } catch (error) {
        console.error("fetchMopFilters error:", error);
        return { ecomNaming: [], codes: [] };
    }
};

export const fetchMopData = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/mop-analysis/data", { params });
        return response.data;
    } catch (error) {
        console.error("fetchMopData error:", error);
        return { rows: [], total: 0, platforms: [] };
    }
};
