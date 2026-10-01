import axiosInstance from './axiosInstance';
import dayjs from 'dayjs';

/**
 * Visibility Analysis API Service
 * All functions return promises that can be called in parallel
 */

// Helper to normalize parameters for backend consistency
const normalize = (val) => {
    if (!val || val === 'All' || val === 'all') return 'All';
    return Array.isArray(val) ? val.join(',').toLowerCase() : String(val).toLowerCase();
};

// Helper to safely format any date value (dayjs object, Date, or string) to YYYY-MM-DD
// This prevents timezone issues when dayjs objects are implicitly stringified to UTC format
const formatDate = (val) => {
    if (!val) return null;
    const d = dayjs(val);
    return d.isValid() ? d.format('YYYY-MM-DD') : null;
};

/**
 * Fetch Visibility Overview (KPI cards)
 */
export const fetchVisibilityOverview = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.platform && filters.platform !== 'All') params.append('platform', normalize(filters.platform));
    if (filters.brand && filters.brand !== 'All') params.append('brand', normalize(filters.brand));
    if (filters.location && filters.location !== 'All') params.append('location', normalize(filters.location));
    if (filters.channel && filters.channel !== 'All') params.append('channel', normalize(filters.channel));
    if (filters.keyword && filters.keyword !== 'All') params.append('keyword', normalize(filters.keyword));
    if (filters.rank && filters.rank !== 'All') params.append('rank', normalize(filters.rank));
    if (filters.startDate) params.append('startDate', formatDate(filters.startDate));
    if (filters.endDate) params.append('endDate', formatDate(filters.endDate));
    if (filters.compareStartDate) params.append('compareStartDate', filters.compareStartDate);
    if (filters.compareEndDate) params.append('compareEndDate', filters.compareEndDate);

    const response = await axiosInstance.get(`/visibility-analysis/visibility-overview?${params.toString()}`);
    return response.data;
};

/**
 * Fetch Platform KPI Matrix (Platform/Format/City tabs)
 */
export const fetchVisibilityPlatformKpiMatrix = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.viewMode) params.append('viewMode', filters.viewMode);
    if (filters.platform && filters.platform !== 'All') params.append('platform', normalize(filters.platform));
    if (filters.brand && filters.brand !== 'All') params.append('brand', normalize(filters.brand));
    if (filters.location && filters.location !== 'All') params.append('location', normalize(filters.location));
    if (filters.channel && filters.channel !== 'All') params.append('channel', normalize(filters.channel));
    if (filters.keyword && filters.keyword !== 'All') params.append('keyword', normalize(filters.keyword));
    if (filters.rank && filters.rank !== 'All') params.append('rank', normalize(filters.rank));
    if (filters.startDate) params.append('startDate', formatDate(filters.startDate));
    if (filters.endDate) params.append('endDate', formatDate(filters.endDate));
    if (filters.compareStartDate) params.append('compareStartDate', filters.compareStartDate);
    if (filters.compareEndDate) params.append('compareEndDate', filters.compareEndDate);

    const response = await axiosInstance.get(`/visibility-analysis/platform-kpi-matrix?${params.toString()}`);
    return response.data;
};

/**
 * Fetch Keywords at a Glance (hierarchical drill data)
 */
export const fetchVisibilityKeywordsAtGlance = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.platform && filters.platform !== 'All') params.append('platform', normalize(filters.platform));
    if (filters.brand && filters.brand !== 'All') params.append('brand', normalize(filters.brand));
    if (filters.location && filters.location !== 'All') params.append('location', normalize(filters.location));
    if (filters.channel && filters.channel !== 'All') params.append('channel', normalize(filters.channel));
    if (filters.keyword && filters.keyword !== 'All') params.append('keyword', normalize(filters.keyword));
    if (filters.rank && filters.rank !== 'All') params.append('rank', normalize(filters.rank));
    if (filters.view) params.append('view', filters.view);
    if (filters.startDate) params.append('startDate', formatDate(filters.startDate));
    if (filters.endDate) params.append('endDate', formatDate(filters.endDate));
    if (filters.compareStartDate) params.append('compareStartDate', filters.compareStartDate);
    if (filters.compareEndDate) params.append('compareEndDate', filters.compareEndDate);

    const response = await axiosInstance.get(`/visibility-analysis/keywords-at-glance?${params.toString()}`);
    return response.data;
};

/**
 * Fetch Top Search Terms
 */
export const fetchVisibilityTopSearchTerms = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.viewMode) params.append('viewMode', filters.viewMode);
    if (filters.platform && filters.platform !== 'All') params.append('platform', normalize(filters.platform));
    if (filters.brand && filters.brand !== 'All') params.append('brand', normalize(filters.brand));
    if (filters.location && filters.location !== 'All') params.append('location', normalize(filters.location));
    if (filters.keyword && filters.keyword !== 'All') params.append('keyword', normalize(filters.keyword));
    if (filters.keywordType && filters.keywordType !== 'All') params.append('keywordType', normalize(filters.keywordType));
    if (filters.category && filters.category !== 'All') params.append('category', normalize(filters.category));
    if (filters.channel && filters.channel !== 'All') params.append('channel', normalize(filters.channel));
    if (filters.rank && filters.rank !== 'All') params.append('rank', normalize(filters.rank));
    if (filters.filter && filters.filter !== 'All') params.append('filter', filters.filter);
    if (filters.startDate) params.append('startDate', formatDate(filters.startDate));
    if (filters.endDate) params.append('endDate', formatDate(filters.endDate));
    if (filters.compareStartDate) params.append('compareStartDate', filters.compareStartDate);
    if (filters.compareEndDate) params.append('compareEndDate', filters.compareEndDate);

    const response = await axiosInstance.get(`/visibility-analysis/top-search-terms?${params.toString()}`);
    return response.data;
};

/**
 * Fetch Brand Visibility Drilldown for a keyword
 */
export const fetchVisibilityBrandDrilldown = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.keyword) params.append('keyword', normalize(filters.keyword));
    if (filters.platform && filters.platform !== 'All') params.append('platform', normalize(filters.platform));
    if (filters.brand && filters.brand !== 'All') params.append('brand', normalize(filters.brand));
    if (filters.location && filters.location !== 'All') params.append('location', normalize(filters.location));
    if (filters.channel && filters.channel !== 'All') params.append('channel', normalize(filters.channel));
    if (filters.rank && filters.rank !== 'All') params.append('rank', normalize(filters.rank));
    if (filters.startDate) params.append('startDate', formatDate(filters.startDate));
    if (filters.endDate) params.append('endDate', formatDate(filters.endDate));
    if (filters.compareStartDate) params.append('compareStartDate', filters.compareStartDate);
    if (filters.compareEndDate) params.append('compareEndDate', filters.compareEndDate);

    const response = await axiosInstance.get(`/visibility-analysis/brand-drilldown?${params.toString()}`);
    return response.data;
};

/**
 * Fetch all visibility data in parallel
 * @param {Object} filters - Common filters to apply
 * @returns {Promise<Object>} - Object with overview, matrix, keywords, searchTerms
 */
export const fetchAllVisibilityData = async (filters = {}) => {
    const [overview, matrix, keywords, searchTerms] = await Promise.all([
        fetchVisibilityOverview(filters),
        fetchVisibilityPlatformKpiMatrix(filters),
        fetchVisibilityKeywordsAtGlance(filters),
        fetchVisibilityTopSearchTerms(filters)
    ]);

    return {
        overview,
        matrix,
        keywords,
        searchTerms
    };
};

// Helper to format date fields in raw param objects before sending to backend.
// Prevents timezone mismatch: browser (IST) sends "Sun, 14 Jun 2026 18:30:00 GMT"
// which a UTC server would parse as June 14 instead of the intended June 15.
const formatParamDates = (params) => {
    const formatted = { ...params };
    ['startDate', 'endDate', 'compareStartDate', 'compareEndDate'].forEach(key => {
        if (formatted[key]) formatted[key] = formatDate(formatted[key]);
    });
    return formatted;
};

/**
 * Fetch SKU visibility drilldown for a specific keyword
 */
export const fetchVisibilitySkuDrilldown = async (params) => {
    try {
        const queryParams = new URLSearchParams(formatParamDates(params)).toString();
        const response = await axiosInstance.get(`/visibility-analysis/sku-drilldown?${queryParams}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching SKU drilldown:", error);
        throw error;
    }
};

/**
 * Fetch City visibility drilldown for a specific SKU and keyword
 */
export const fetchVisibilityCityDrilldown = async (params) => {
    try {
        const queryParams = new URLSearchParams(formatParamDates(params)).toString();
        const response = await axiosInstance.get(`/visibility-analysis/city-drilldown?${queryParams}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching City drilldown:", error);
        throw error;
    }
};

/**
 * Fetch Search Terms Performance (Top Search Terms segment \u2014 keyword/SKU modes)
 */
export const fetchSearchTermsPerformance = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.viewMode) params.append('viewMode', filters.viewMode);
    if (filters.platform && filters.platform !== 'All') params.append('platform', normalize(filters.platform));
    if (filters.brand && filters.brand !== 'All') params.append('brand', normalize(filters.brand));
    if (filters.location && filters.location !== 'All') params.append('location', normalize(filters.location));
    if (filters.keyword && filters.keyword !== 'All') params.append('keyword', normalize(filters.keyword));
    if (filters.keywordType && filters.keywordType !== 'All') params.append('keywordType', normalize(filters.keywordType));
    if (filters.keywordTypeFilter && filters.keywordTypeFilter !== 'All') params.append('keywordTypeFilter', normalize(filters.keywordTypeFilter));
    if (filters.category && filters.category !== 'All') params.append('category', normalize(filters.category));
    if (filters.channel && filters.channel !== 'All') params.append('channel', normalize(filters.channel));
    if (filters.sku && filters.sku !== 'All') params.append('sku', normalize(filters.sku));
    if (filters.rank && filters.rank !== 'All') params.append('rank', normalize(filters.rank));
    if (filters.ownBrandsOnly) params.append('ownBrandsOnly', filters.ownBrandsOnly);
    if (filters.startDate) params.append('startDate', formatDate(filters.startDate));
    if (filters.endDate) params.append('endDate', formatDate(filters.endDate));
    if (filters.compareStartDate) params.append('compareStartDate', filters.compareStartDate);
    if (filters.compareEndDate) params.append('compareEndDate', filters.compareEndDate);

    const response = await axiosInstance.get(`/visibility-analysis/search-terms-performance?${params.toString()}`);
    return response.data;
};

/**
 * Fetch Search Terms Location Drilldown
 */
export const fetchSearchTermsLocations = async (params) => {
    try {
        const queryParams = new URLSearchParams(formatParamDates(params)).toString();
        const response = await axiosInstance.get(`/visibility-analysis/search-terms-locations?${queryParams}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching search terms locations:", error);
        throw error;
    }
};

/**
 * Fetch Search Terms Brand Breakdown (Hover detail for Leading Brand)
 */
export const fetchSearchTermsBrandBreakdown = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.platform && filters.platform !== 'All') params.append('platform', normalize(filters.platform));
    if (filters.channel && filters.channel !== 'All') params.append('channel', normalize(filters.channel));
    if (filters.keyword && filters.keyword !== 'All') params.append('keyword', normalize(filters.keyword));
    if (filters.startDate) params.append('startDate', formatDate(filters.startDate));
    if (filters.endDate) params.append('endDate', formatDate(filters.endDate));
    if (filters.compareStartDate) params.append('compareStartDate', filters.compareStartDate);
    if (filters.compareEndDate) params.append('compareEndDate', filters.compareEndDate);
    if (filters.rank && filters.rank !== 'All') params.append('rank', filters.rank);

    const response = await axiosInstance.get(`/visibility-analysis/search-terms-brand-breakdown?${params.toString()}`);

    return response.data;
};
/**
 * Fetch dynamic filter options for Visibility Analysis
 */
export const fetchVisibilityFilterOptions = async (params) => {
    try {
        const queryParams = new URLSearchParams(formatParamDates(params)).toString();
        const response = await axiosInstance.get(`/visibility-analysis/filter-options?${queryParams}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching visibility filter options:", error);
        throw error;
    }
};

/**
 * Fetch maximum position value in the db to dynamic filter rank options
 */
export const fetchVisibilityMaxPosition = async () => {
    try {
        const response = await axiosInstance.get('/visibility-analysis/max-position');
        return response.data;
    } catch (error) {
        console.error("Error fetching visibility max position:", error);
        throw error;
    }
};

