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

export const fetchPriceViolationFilters = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/reports/price-violation-filters", { params: formatParams(params) });
        return response.data;
    } catch (error) {
        console.error("fetchPriceViolationFilters error:", error);
        throw error;
    }
};

export const downloadPriceViolationReport = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/reports/download-price-violation-report", {
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
            console.error("downloadPriceViolationReport error:", error);
        }
        throw error;
    }
};

export const previewPriceViolationReport = async (params = {}) => {
    try {
        const response = await axiosInstance.get("/reports/preview-price-violation-report", {
            params: formatParams(params),
            timeout: 2 * 60 * 1000,
        });
        return response.data;
    } catch (error) {
        console.error("previewPriceViolationReport error:", error);
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
        timeout: 10 * 60 * 1000,
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

// ── Scheduled report emails ──

/** The workspace's report schedules, newest first. */
export const fetchReportSchedules = async () => {
    const response = await axiosInstance.get("/report-schedules");
    return response.data.data;
};

export const createReportSchedule = async (schedule) => {
    const response = await axiosInstance.post("/report-schedules", schedule);
    return response.data.data;
};

export const updateReportSchedule = async (id, schedule) => {
    const response = await axiosInstance.put(`/report-schedules/${id}`, schedule);
    return response.data.data;
};

/** status: "active" | "paused" */
export const setReportScheduleStatus = async (id, status) => {
    const response = await axiosInstance.patch(`/report-schedules/${id}/status`, { status });
    return response.data.data;
};

export const deleteReportSchedule = async (id) => {
    await axiosInstance.delete(`/report-schedules/${id}`);
};

/** Builds and emails the report now: { status, rows }. */
export const sendReportScheduleNow = async (id) => {
    const response = await axiosInstance.post(`/report-schedules/${id}/send`, null, { timeout: 10 * 60 * 1000 });
    return response.data.data;
};

// ── Saved Report Studio templates ──

/** The user's own templates and the workspace's shared ones. */
export const fetchReportTemplates = async () => {
    const response = await axiosInstance.get("/report-templates");
    return response.data.data;
};

/** { name, description, visibility, config: { view, sources, columns, brandScope, pivot, period, includeFilters } } */
export const createReportTemplate = async (template) => {
    const response = await axiosInstance.post("/report-templates", template);
    return response.data.data;
};

/** Any of name, description, visibility, config. */
export const updateReportTemplate = async (id, changes) => {
    const response = await axiosInstance.put(`/report-templates/${id}`, changes);
    return response.data.data;
};

export const deleteReportTemplate = async (id) => {
    await axiosInstance.delete(`/report-templates/${id}`);
};

export const markReportTemplateUsed = async (id) => {
    await axiosInstance.post(`/report-templates/${id}/used`);
};
