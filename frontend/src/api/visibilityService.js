import axiosInstance from './axiosInstance';

/**
 * Visibility Analysis API Service
 * All functions return promises that can be called in parallel
 */

/**
 * Fetch Visibility Overview (KPI cards)
 */
export const fetchVisibilityOverview = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.platform && filters.platform !== 'All') params.append('platform', filters.platform);
    if (filters.brand && filters.brand !== 'All') params.append('brand', filters.brand);
    if (filters.location && filters.location !== 'All') params.append('location', filters.location);
    if (filters.channel && filters.channel !== 'All') params.append('channel', filters.channel);
    if (filters.keyword && filters.keyword !== 'All') params.append('keyword', filters.keyword);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response = await axiosInstance.get(`/visibility-analysis/visibility-overview?${params.toString()}`);
    return response.data;
};

/**
 * Fetch Platform KPI Matrix (Platform/Format/City tabs)
 */
export const fetchVisibilityPlatformKpiMatrix = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.viewMode) params.append('viewMode', filters.viewMode);
    if (filters.platform && filters.platform !== 'All') params.append('platform', filters.platform);
    if (filters.brand && filters.brand !== 'All') params.append('brand', filters.brand);
    if (filters.location && filters.location !== 'All') params.append('location', filters.location);
    if (filters.channel && filters.channel !== 'All') params.append('channel', filters.channel);
    if (filters.keyword && filters.keyword !== 'All') params.append('keyword', filters.keyword);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response = await axiosInstance.get(`/visibility-analysis/platform-kpi-matrix?${params.toString()}`);
    return response.data;
};

/**
 * Fetch Keywords at a Glance (hierarchical drill data)
 */
export const fetchVisibilityKeywordsAtGlance = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.platform && filters.platform !== 'All') params.append('platform', filters.platform);
    if (filters.brand && filters.brand !== 'All') params.append('brand', filters.brand);
    if (filters.location && filters.location !== 'All') params.append('location', filters.location);
    if (filters.channel && filters.channel !== 'All') params.append('channel', filters.channel);
    if (filters.keyword && filters.keyword !== 'All') params.append('keyword', filters.keyword);
    if (filters.view) params.append('view', filters.view);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response = await axiosInstance.get(`/visibility-analysis/keywords-at-glance?${params.toString()}`);
    return response.data;
};

/**
 * Fetch Top Search Terms
 */
export const fetchVisibilityTopSearchTerms = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.viewMode) params.append('viewMode', filters.viewMode);
    if (filters.platform && filters.platform !== 'All') params.append('platform', filters.platform);
    if (filters.brand && filters.brand !== 'All') params.append('brand', filters.brand);
    if (filters.location && filters.location !== 'All') params.append('location', filters.location);
    if (filters.keyword && filters.keyword !== 'All') params.append('keyword', filters.keyword);
    if (filters.keywordType && filters.keywordType !== 'All') params.append('keywordType', filters.keywordType);
    if (filters.category && filters.category !== 'All') params.append('category', filters.category);
    if (filters.channel && filters.channel !== 'All') params.append('channel', filters.channel);
    if (filters.filter && filters.filter !== 'All') params.append('filter', filters.filter);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response = await axiosInstance.get(`/visibility-analysis/top-search-terms?${params.toString()}`);
    return response.data;
};

/**
 * Fetch Brand Visibility Drilldown for a keyword
 */
export const fetchVisibilityBrandDrilldown = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.keyword) params.append('keyword', filters.keyword);
    if (filters.platform && filters.platform !== 'All') params.append('platform', filters.platform);
    if (filters.brand && filters.brand !== 'All') params.append('brand', filters.brand);
    if (filters.location && filters.location !== 'All') params.append('location', filters.location);
    if (filters.channel && filters.channel !== 'All') params.append('channel', filters.channel);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

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

/**
 * Fetch SKU visibility drilldown for a specific keyword
 */
export const fetchVisibilitySkuDrilldown = async (params) => {
    try {
        const queryParams = new URLSearchParams(params).toString();
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
        const queryParams = new URLSearchParams(params).toString();
        const response = await axiosInstance.get(`/visibility-analysis/city-drilldown?${queryParams}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching City drilldown:", error);
        throw error;
    }
};

/**
 * Fetch Search Terms Performance (Top Search Terms segment — keyword/SKU modes)
 */
export const fetchSearchTermsPerformance = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.viewMode) params.append('viewMode', filters.viewMode);
    if (filters.platform && filters.platform !== 'All') params.append('platform', filters.platform);
    if (filters.brand && filters.brand !== 'All') params.append('brand', filters.brand);
    if (filters.location && filters.location !== 'All') params.append('location', filters.location);
    if (filters.keyword && filters.keyword !== 'All') params.append('keyword', filters.keyword);
    if (filters.keywordType && filters.keywordType !== 'All') params.append('keywordType', filters.keywordType);
    if (filters.keywordTypeFilter && filters.keywordTypeFilter !== 'All') params.append('keywordTypeFilter', filters.keywordTypeFilter);
    if (filters.category && filters.category !== 'All') params.append('category', filters.category);
    if (filters.channel && filters.channel !== 'All') params.append('channel', filters.channel);
    if (filters.ownBrandsOnly) params.append('ownBrandsOnly', filters.ownBrandsOnly);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response = await axiosInstance.get(`/visibility-analysis/search-terms-performance?${params.toString()}`);
    return response.data;
};

/**
 * Fetch Search Terms Location Drilldown
 */
export const fetchSearchTermsLocations = async (params) => {
    try {
        const queryParams = new URLSearchParams(params).toString();
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
    if (filters.platform && filters.platform !== 'All') params.append('platform', filters.platform);
    if (filters.channel && filters.channel !== 'All') params.append('channel', filters.channel);
    if (filters.keyword && filters.keyword !== 'All') params.append('keyword', filters.keyword);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response = await axiosInstance.get(`/visibility-analysis/search-terms-brand-breakdown?${params.toString()}`);
    return response.data;
};
