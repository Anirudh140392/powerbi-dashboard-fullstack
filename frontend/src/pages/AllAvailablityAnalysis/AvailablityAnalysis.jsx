import React, { useState, useContext, useEffect, useRef } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import AvailablityAnalysisData from "../../components/AllAvailablityAnalysis/AvailablityAnalysisData";
import { FilterContext } from "../../utils/FilterContext";
import dayjs from "dayjs";

export default function AvailablityAnalysis() {

  // Get values from FilterContext - the source of truth for dropdown selections
  const {
    platform,
    selectedBrand,
    selectedLocation,
    timeStart,
    timeEnd,
    selectedZone,
    pmSelectedPlatform,
    pmSelectedBrand,
    setPlatform,
    setSelectedLocation,
    setTimeStart,
    setTimeEnd,
    selectedCategory,
    setSelectedCategory,
    selectedProductCategory,
    setSelectedProductCategory,
    compareStart,
    compareEnd,
    selectedChannel,
    refreshFilters
  } = useContext(FilterContext);

  const [showTrends, setShowTrends] = useState(false);

  // Initialize filters from context
  const [filters, setFilters] = useState({
    platform: platform || "Blinkit",
    brand: selectedBrand || "All",
    location: selectedLocation || "All",
    category: selectedCategory || "All",
    productCategory: selectedProductCategory || "All",
    zones: selectedZone || "All",
    channel: selectedChannel || "Ecommerce",
    months: 6,
    timeStep: "Monthly",
    startDate: timeStart ? timeStart.format('YYYY-MM-DD') : dayjs().startOf('month').format('YYYY-MM-DD'),
    endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
    compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : null,
    compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : null,
    // Add extra tracking state for Matrix filters
    kpis: [],
    metroFlags: [],
    cities: [],
    formats: []
  });

  // Wrapper to sync context when filters change locally (e.g. from internal matrix filters)
  const handleFiltersChange = (newFilters) => {
    setFilters((prev) => {
      const updatedFilters = { ...prev, ...newFilters };
      return updatedFilters;
    });

    // Sync back to FilterContext to update global header
    if (newFilters.platform && newFilters.platform !== platform) {
      setPlatform(newFilters.platform);
    }
    if (newFilters.location && newFilters.location !== selectedLocation) {
      setSelectedLocation(newFilters.location);
    }
    if (newFilters.category && newFilters.category !== selectedCategory) {
      setSelectedCategory(newFilters.category);
    }
    if (newFilters.productCategory && newFilters.productCategory !== selectedProductCategory) {
      setSelectedProductCategory(newFilters.productCategory);
    }
    if (newFilters.startDate) {
      const newStart = dayjs(newFilters.startDate);
      if (!newStart.isSame(timeStart, 'day')) {
        setTimeStart(newStart);
      }
    }
    if (newFilters.endDate) {
      const newEnd = dayjs(newFilters.endDate);
      if (!newEnd.isSame(timeEnd, 'day')) {
        setTimeEnd(newEnd);
      }
    }
  };

  // Ref to track last fetched filters to prevent duplicate API calls
  const lastFetchedFiltersRef = useRef(null);

  // Sync filters with FilterContext when context values change
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      platform: platform || prev.platform,
      brand: selectedBrand || prev.brand,
      location: selectedLocation || prev.location,
      category: selectedCategory || prev.category,
      productCategory: selectedProductCategory || prev.productCategory,
      zones: selectedZone || prev.zones,
      channel: selectedChannel || prev.channel,
      startDate: timeStart ? timeStart.format('YYYY-MM-DD') : prev.startDate,
      endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : prev.endDate,
      compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : null,
      compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : null
    }));
  }, [platform, selectedBrand, selectedLocation, selectedCategory, selectedProductCategory, timeStart, timeEnd, compareStart, compareEnd, selectedZone, selectedChannel]);

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Monthly",
    platform: platform || "Blinkit",
  });

  const [trendData, setTrendData] = useState({
    timeSeries: [],
    metrics: {},
  });

  const handleViewTrends = (card) => {
    console.log("card clicked", card);

    const series =
      card.chart?.map((v, i) => {
        let date;

        if (trendParams.timeStep === "Monthly") {
          const d = new Date();
          d.setMonth(d.getMonth() - (card.chart.length - 1 - i));
          date = d.toLocaleString("default", {
            month: "short",
            year: "2-digit",
          });
        } else if (trendParams.timeStep === "Weekly") {
          const d = new Date();
          d.setDate(d.getDate() - 7 * (card.chart.length - 1 - i));
          date = d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          });
        } else {
          const d = new Date();
          d.setDate(d.getDate() - (card.chart.length - 1 - i));
          date = d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          });
        }

        return { date, offtake: v };
      }) ?? [];

    setTrendData({
      timeSeries: series,
      metrics: {},
    });

    setTrendParams((prev) => ({
      ...prev,
      platform: card.name ?? "Blinkit",
    }));

    setShowTrends(true);
  };

  const [apiData, setApiData] = useState({});
  // Dedicated loading state - true when API calls are in progress
  const [isLoading, setIsLoading] = useState(true);
  // Per-segment error tracking
  const [apiErrors, setApiErrors] = useState({});

  // Build query params helper
  const buildQueryParams = () => {
    const params = new URLSearchParams();

    // Iterate over all active filters and add to params
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== 'All' && value !== '') {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            value.forEach(v => params.append(key, v));
          }
        } else {
          params.append(key, value);
        }
      }
    });

    // Ensure defaults for required fields if not present
    if (!params.has('platform')) params.append('platform', 'All');
    if (!params.has('brand')) params.append('brand', 'All');
    if (!params.has('location')) params.append('location', 'All');

    return params.toString();
  };

  // Get auth headers for API calls (JWT token from localStorage)
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Individual segment fetch functions for retry capability
  const fetchOverview = async (queryParams) => {
    try {
      setApiErrors(prev => ({ ...prev, overview: null }));
      const res = await fetch(`/api/availability-analysis/absolute-osa/availability-overview?${queryParams}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, overview: data }));
      return true;
    } catch (err) {
      console.error('[Overview] API error:', err);
      setApiErrors(prev => ({ ...prev, overview: err.message }));
      return false;
    }
  };

  const fetchPlatformKpi = async (queryParams) => {
    try {
      setApiErrors(prev => ({ ...prev, platformKpi: null }));
      const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=Platform&${queryParams}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, platformKpi: data }));
      return true;
    } catch (err) {
      console.error('[PlatformKpi] API error:', err);
      setApiErrors(prev => ({ ...prev, platformKpi: err.message }));
      return false;
    }
  };

  const fetchFormatKpi = async (queryParams) => {
    try {
      setApiErrors(prev => ({ ...prev, formatKpi: null }));
      const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=Format&${queryParams}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, formatKpi: data }));
      return true;
    } catch (err) {
      console.error('[FormatKpi] API error:', err);
      setApiErrors(prev => ({ ...prev, formatKpi: err.message }));
      return false;
    }
  };

  const fetchCityKpi = async (queryParams) => {
    try {
      setApiErrors(prev => ({ ...prev, cityKpi: null }));
      const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=City&${queryParams}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, cityKpi: data }));
      return true;
    } catch (err) {
      console.error('[CityKpi] API error:', err);
      setApiErrors(prev => ({ ...prev, cityKpi: err.message }));
      return false;
    }
  };

  const fetchDoi = async (queryParams) => {
    try {
      setApiErrors(prev => ({ ...prev, doi: null }));
      const res = await fetch(`/api/availability-analysis/absolute-osa/doi?${queryParams}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, doi: data }));
      return true;
    } catch (err) {
      console.error('[DOI] API error:', err);
      setApiErrors(prev => ({ ...prev, doi: err.message }));
      return false;
    }
  };

  const fetchMetroCity = async (queryParams) => {
    try {
      setApiErrors(prev => ({ ...prev, metroCity: null }));
      const res = await fetch(`/api/availability-analysis/absolute-osa/metro-city-stock-availability?${queryParams}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, metroCity: data }));
      return true;
    } catch (err) {
      console.error('[MetroCity] API error:', err);
      setApiErrors(prev => ({ ...prev, metroCity: err.message }));
      return false;
    }
  };

  const fetchOsaDetail = async (osaDetailParams) => {
    try {
      setApiErrors(prev => ({ ...prev, osaDetail: null }));
      const res = await fetch(`/api/availability-analysis/absolute-osa/osa-percentage-detail?${osaDetailParams}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log('[OsaDetail] API response received. Type:', typeof data, 'IsArray:', Array.isArray(data), 'Length:', Array.isArray(data) ? data.length : (data?.length || 'N/A'));
      // Handle both direct array and wrapped responses
      const osaRows = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : data?.rows || data);
      console.log('[OsaDetail] Parsed rows count:', Array.isArray(osaRows) ? osaRows.length : 'not-array');
      setApiData(prev => ({ ...prev, osaDetail: osaRows }));
      return true;
    } catch (err) {
      console.error('[OsaDetail] API error:', err);
      setApiErrors(prev => ({ ...prev, osaDetail: err.message }));
      return false;
    }
  };

  const fetchKpiTrends = async (queryParams) => {
    try {
      setApiErrors(prev => ({ ...prev, kpiTrends: null }));
      const res = await fetch(`/api/availability-analysis/kpi-trends?${queryParams}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, kpiTrends: data }));
      return true;
    } catch (err) {
      console.error('[KpiTrends] API error:', err);
      setApiErrors(prev => ({ ...prev, kpiTrends: err.message }));
      return false;
    }
  };

  // Retry handlers for each segment
  const retrySegment = async (segmentKey) => {
    // First, refresh the filter options to ensure dropdowns show updated values
    if (refreshFilters) {
      refreshFilters();
    }

    const queryParams = buildQueryParams();
    const osaDetailParams = new URLSearchParams({
      platform: 'All',
      brand: 'All',
      location: 'All',
      startDate: filters.startDate,
      endDate: filters.endDate,
      productCategory: filters.productCategory
    }).toString();

    switch (segmentKey) {
      case 'overview': return fetchOverview(queryParams);
      case 'platformKpi': return fetchPlatformKpi(queryParams);
      case 'formatKpi': return fetchFormatKpi(queryParams);
      case 'cityKpi': return fetchCityKpi(queryParams);
      case 'doi': return fetchDoi(queryParams);
      case 'metroCity': return fetchMetroCity(queryParams);
      case 'osaDetail': return fetchOsaDetail(osaDetailParams);
      case 'kpiTrends': return fetchKpiTrends(queryParams);
      default: return false;
    }
  };

  useEffect(() => {


    // Create a stable key to detect actual filter changes
    const filterKey = JSON.stringify({
      platform: filters.platform,
      brand: filters.brand,
      location: filters.location,
      category: filters.category,
      productCategory: filters.productCategory,
      channel: filters.channel,
      startDate: filters.startDate,
      endDate: filters.endDate,
      compareStartDate: filters.compareStartDate,
      compareEndDate: filters.compareEndDate,
      months: filters.months,
      zones: filters.zones,
      timeStep: filters.timeStep,
      kpis: filters.kpis,
      metroFlags: filters.metroFlags,
      cities: filters.cities,
      formats: filters.formats
    });

    // Skip if we already fetched with these same filters
    if (lastFetchedFiltersRef.current === filterKey) {
      console.log('⏭️ Skipping duplicate fetch: Filters unchanged');
      return;
    }

    // Mark these filters as being fetched
    lastFetchedFiltersRef.current = filterKey;

    // Set loading true and reset all data to trigger skeleton loaders
    setIsLoading(true);
    setApiData({});
    setApiErrors({});

    const fetchData = async () => {
      try {
        const queryParams = buildQueryParams();

        console.log('📡 Fetching availability data. Global filters:', filters.platform, filters.brand, filters.location);

        // OSA Detail uses only date range (shows ALL products regardless of brand/platform filter)
        const osaDetailParams = new URLSearchParams({
          platform: 'All',
          brand: 'All',
          location: 'All',
          startDate: filters.startDate,
          endDate: filters.endDate,
          productCategory: filters.productCategory
        }).toString();

        // Fetch all segments (errors are tracked per-segment)
        await Promise.allSettled([
          fetchOverview(queryParams),
          fetchPlatformKpi(queryParams),
          fetchFormatKpi(queryParams),
          fetchCityKpi(queryParams),
          fetchDoi(queryParams),
          fetchMetroCity(queryParams),
          fetchOsaDetail(osaDetailParams),
          fetchKpiTrends(queryParams)
        ]);

        console.log('✅ All availability data segments processed');
      } catch (error) {
        console.error("Error fetching availability data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [filters]);

  return (
    <>
      <CommonContainer
        title="Availability Analysis"
        filters={filters}
        onFiltersChange={handleFiltersChange}
      >
        <AvailablityAnalysisData
          apiData={apiData}
          apiErrors={apiErrors}
          onRetry={retrySegment}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          loading={isLoading}
        />
      </CommonContainer>
    </>
  );
}
