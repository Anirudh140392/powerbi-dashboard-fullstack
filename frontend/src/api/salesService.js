import axiosInstance from "./axiosInstance";

export const fetchSalesDrilldown = async (params) => {
    try {
        const response = await axiosInstance.get("/sales/drilldown", { params });
        return response.data;
    } catch (error) {
        console.error("fetchSalesDrilldown error:", error);
        throw error;
    }
};

export const fetchCategorySalesMatrix = async (params) => {
    try {
        const response = await axiosInstance.get("/sales/category-matrix", { params });
        return response.data;
    } catch (error) {
        console.error("fetchCategorySalesMatrix error:", error);
        throw error;
    }
};

export const fetchSalesTrends = async (params) => {
    try {
        const response = await axiosInstance.get("/sales/trends", { params });
        return response.data;
    } catch (error) {
        console.error("fetchSalesTrends error:", error);
        throw error;
    }
};

export const fetchSalesFilterOptions = async () => {
    try {
        const response = await axiosInstance.get("/sales/filter-options");
        return response.data;
    } catch (error) {
        console.error("fetchSalesFilterOptions error:", error);
        throw error;
    }
};
