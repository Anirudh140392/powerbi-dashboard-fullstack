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
            responseType: 'blob',
            timeout: 10 * 60 * 1000, // 10 minutes – report queries can be slow for large date ranges
        });
        if (response.status === 204) {
            const err = new Error("No Content");
            err.status = 204;
            throw err;
        }
        return response.data;
    } catch (error) {
        if (error.status !== 204) {
            console.error("downloadReport error:", error);
        }
        throw error;
    }
};

export const fetchAvailableReportTypes = async () => {
    try {
        const response = await axiosInstance.get("/reports/available-types");
        return response.data.reportTypes || [];
    } catch (error) {
        console.error("fetchAvailableReportTypes error:", error);
        return [];
    }
};

export const fetchReportBuilderOptions = async () => {
    try {
        const response = await axiosInstance.get("/reports/builder-options");
        return response.data;
    } catch (error) {
        console.error("fetchReportBuilderOptions error:", error);
        return {};
    }
};

export const fetchPdpReportFilters = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/reports/pdp-report-filters", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchPdpReportFilters error:", error);
        throw error;
    }
};

export const downloadPdpReport = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/reports/download-pdp-report", {
            params: formatParams(params),
            responseType: 'blob',
            timeout: 10 * 60 * 1000,
        });
        if (response.status === 204) {
            const err = new Error("No Content");
            err.status = 204;
            throw err;
        }
        return response.data;
    } catch (error) {
        if (error.status !== 204) {
            console.error("downloadPdpReport error:", error);
        }
        throw error;
    }
};

export const previewPdpReport = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/reports/preview-pdp-report", {
            params: formatParams(params),
            timeout: 2 * 60 * 1000,
        });
        return response.data;
    } catch (error) {
        console.error("previewPdpReport error:", error);
        throw error;
    }
};

export const fetchPromoViolationFilters = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/reports/promo-violation-filters", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchPromoViolationFilters error:", error);
        throw error;
    }
};

export const downloadPromoViolationReport = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/reports/download-promo-violation-report", {
            params: formatParams(params),
            responseType: 'blob',
            timeout: 10 * 60 * 1000,
        });
        if (response.status === 204) {
            const err = new Error("No Content");
            err.status = 204;
            throw err;
        }
        return response.data;
    } catch (error) {
        if (error.status !== 204) {
            console.error("downloadPromoViolationReport error:", error);
        }
        throw error;
    }
};

export const previewPromoViolationReport = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/reports/preview-promo-violation-report", {
            params: formatParams(params),
            timeout: 2 * 60 * 1000,
        });
        return response.data;
    } catch (error) {
        console.error("previewPromoViolationReport error:", error);
        throw error;
    }
};


// ── Report Studio ──

/** One page of the aggregated report: { totalRows, rows, unavailable }. */
export const fetchStudioPreview = async (params, { signal } = {}) => {
    const response = await axiosInstance.get("/reports/studio/preview", {
        params: formatParams(params),
        signal,
        timeout: 2 * 60 * 1000,
    });
    return response.data;
};

/**
 * Every aggregated row, for the pivot: { status: "ok", totalRows, rows, unavailable },
 * or { status: "too-large", totalRows } when the report is over the row limit.
 */
export const fetchStudioRows = async (params, { signal } = {}) => {
    const response = await axiosInstance.get("/reports/studio/rows", {
        params: formatParams(params),
        signal,
        timeout: 5 * 60 * 1000,
    });
    return response.data;
};

/** The full report as a CSV blob, streamed by the server. */
export const downloadStudioCsv = async (params) => {
    const response = await axiosInstance.get("/reports/studio/export", {
        params: formatParams(params),
        responseType: "blob",
        timeout: 10 * 60 * 1000,
    });
    return response.data;
};
