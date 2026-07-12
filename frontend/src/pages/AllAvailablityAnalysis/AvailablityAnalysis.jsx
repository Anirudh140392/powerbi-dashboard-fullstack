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
    setSelectedChannel,
    channels,
    refreshFilters,
    selectedMsl,
    setSelectedMsl
  } = useContext(FilterContext);

  const [showTrends, setShowTrends] = useState(false);
  const [mslFilter, setMslFilter] = useState('0'); // MSL filter: '0' = All SKUs (default), '1' = MSL SKUs only

  // Initialize filters from context
  const [filters, setFilters] = useState({
    platform: platform || "Blinkit",
    brand: selectedBrand || "All",
    location: selectedLocation || "All",
    category: selectedCategory || "All",
    productCategory: selectedProductCategory || "All",
    zones: selectedZone || "All",
    channel: selectedChannel || "Ecommerce",
    msl: selectedMsl || "All",
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
      const platformVal = Array.isArray(newFilters.platform) ? newFilters.platform[0] : newFilters.platform;
      if (typeof platformVal === 'string') {
        setPlatform(platformVal);
      }
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
    if (newFilters.msl !== undefined && newFilters.msl !== selectedMsl) {
      setSelectedMsl(newFilters.msl);
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
      msl: selectedMsl || prev.msl,
      startDate: timeStart ? timeStart.format('YYYY-MM-DD') : prev.startDate,
      endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : prev.endDate,
      compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : null,
      compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : null
    }));
    // Sync local mslFilter with context selection: if selectedMsl is '1' (or includes '1' and not '0'), use '1', else '0'
    const isMslOnly = Array.isArray(selectedMsl)
      ? (selectedMsl.includes('1') && !selectedMsl.includes('0'))
      : (selectedMsl === '1');
    setMslFilter(isMslOnly ? '1' : '0');
  }, [platform, selectedBrand, selectedLocation, selectedCategory, selectedProductCategory, timeStart, timeEnd, compareStart, compareEnd, selectedZone, selectedChannel, selectedMsl]);

  // Default to Quickcomm if available, otherwise Ecommerce, if current selection is 'All'
  useEffect(() => {
    if (channels && channels.length > 0 && selectedChannel === "All") {
      const quickComm = channels.find(c => c.toLowerCase() === 'quickcomm');
      const ecom = channels.find(c => c.toLowerCase() === 'ecommerce');
      
      if (quickComm) {
        setSelectedChannel(quickComm);
      } else if (ecom) {
        setSelectedChannel(ecom);
      }
    }
  }, [channels, selectedChannel, setSelectedChannel]);

  // Restore comprehensive platform list from rca_sku_dim on mount
  // (Prevents subsetting from other pages like Performance Marketing)
  useEffect(() => {
    if (typeof refreshFilters === 'function') {
      refreshFilters();
    }
  }, [refreshFilters]);

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

    // Force ownBrandsOnly to match Watch Tower KPIs identically
    params.append('ownBrandsOnly', 'true');

    return params.toString();
  };

  // Build query params for OSA Detail View — strips date/month filters
  // so it always shows ALL months available in the DB
  const buildOsaDetailParams = (mslOverride) => {
    const params = new URLSearchParams();
    const dateKeys = new Set(['startDate', 'endDate', 'months', 'dates', 'compareStartDate', 'compareEndDate', 'msl']);
    Object.entries(filters).forEach(([key, value]) => {
      if (dateKeys.has(key)) return; // Skip date filters and msl
      if (value !== undefined && value !== null && value !== 'All' && value !== '') {
        if (Array.isArray(value)) { if (value.length > 0) value.forEach(v => params.append(key, v)); }
        else params.append(key, value);
      }
    });
    if (!params.has('platform')) params.append('platform', 'All');
    if (!params.has('brand')) params.append('brand', 'All');
    if (!params.has('location')) params.append('location', 'All');
    params.append('ownBrandsOnly', 'true');

    // MSL filter selection logic:
    // If there is an override (from the local dropdown change), use it.
    // Otherwise, use the global selection (filters.msl) if it's set to '1' or '0'.
    const mslVal = mslOverride !== undefined ? mslOverride : mslFilter;
    if (mslOverride !== undefined) {
      if (mslVal === '1') {
        params.append('msl', '1');
      } // If '0' (meaning All SKUs locally), we don't append anything
    } else {
      const isMslOnly = Array.isArray(filters.msl)
        ? (filters.msl.includes('1') && !filters.msl.includes('0'))
        : (filters.msl === '1');
      const isNonMslOnly = Array.isArray(filters.msl)
        ? (filters.msl.includes('0') && !filters.msl.includes('1'))
        : (filters.msl === '0');

      if (isMslOnly) {
        params.append('msl', '1');
      } else if (isNonMslOnly) {
        params.append('msl', '0');
      }
    }
    return params.toString();
  };

  // Build query params WITHOUT platform filter — used by Platform KPI Matrix segment
  // so it always shows data across ALL platforms regardless of sidebar selection
  const buildQueryParamsWithoutPlatform = () => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      // Skip platform filter entirely
      if (key === 'platform') return;
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

    // Platform is always 'All' for this segment
    params.append('platform', 'All');
    if (!params.has('brand')) params.append('brand', 'All');
    if (!params.has('location')) params.append('location', 'All');

    params.append('ownBrandsOnly', 'true');

    return params.toString();
  };

  // Get auth headers for API calls (JWT token from localStorage)
  const getAuthHeaders = () => {
    const token = sessionStorage.getItem('token');
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

  const fetchPlatformKpi = async () => {
    try {
      setApiErrors(prev => ({ ...prev, platformKpi: null }));
      const crossPlatformParams = buildQueryParamsWithoutPlatform();
      const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=Platform&${crossPlatformParams}`, { headers: getAuthHeaders() });
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

  const fetchFormatKpi = async () => {
    try {
      setApiErrors(prev => ({ ...prev, formatKpi: null }));
      const crossPlatformParams = buildQueryParamsWithoutPlatform();
      const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=Format&${crossPlatformParams}`, { headers: getAuthHeaders() });
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

  const fetchCityKpi = async () => {
    try {
      setApiErrors(prev => ({ ...prev, cityKpi: null }));
      const crossPlatformParams = buildQueryParamsWithoutPlatform();
      const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=City&${crossPlatformParams}`, { headers: getAuthHeaders() });
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
      console.log('[OsaDetail] API response received. Type:', typeof data, 'IsArray:', Array.isArray(data));
      // Handle new { dates, rows } response shape AND legacy direct array
      let osaRows, osaDates;
      if (data?.dates && data?.rows) {
        osaDates = data.dates;
        osaRows = data.rows;
      } else {
        // Legacy fallback
        osaRows = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : data?.rows || data);
        osaDates = null;
      }
      console.log('[OsaDetail] Parsed rows count:', Array.isArray(osaRows) ? osaRows.length : 'not-array', 'dates:', osaDates?.length || 0);
      setApiData(prev => ({ ...prev, osaDetail: osaRows, osaDates: osaDates }));
      return true;
    } catch (err) {
      console.error('[OsaDetail] API error:', err);
      setApiErrors(prev => ({ ...prev, osaDetail: err.message }));
      return false;
    }
  };

  // Handle MSL filter change — re-fetches only OSA detail data and updates global FilterContext
  const handleMslChange = (newMslValue) => {
    setMslFilter(newMslValue);
    // Map local '0' (All SKUs) to global 'All', and local '1' to global '1'
    const globalMsl = newMslValue === '1' ? '1' : 'All';
    setSelectedMsl(globalMsl);
  };

  const fetchKpiTrends = async (queryParams) => {
    try {
      setApiErrors(prev => ({ ...prev, kpiTrends: null }));
      const params = new URLSearchParams(queryParams);
      params.set('timeStep', 'Daily');
      const res = await fetch(`/api/availability-analysis/kpi-trends?${params.toString()}`, { headers: getAuthHeaders() });
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
    const osaDetailParams = buildOsaDetailParams();

    switch (segmentKey) {
      case 'overview': return fetchOverview(queryParams);
      case 'platformKpi': return fetchPlatformKpi();
      case 'formatKpi': return fetchFormatKpi();
      case 'cityKpi': return fetchCityKpi();
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
      formats: filters.formats,
      msl: filters.msl
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

        // OSA Detail: no date filters — show ALL months in DB
        const osaDetailParams = buildOsaDetailParams();

        // Fire all fetches independently to allow incremental updates
        fetchOverview(queryParams);
        fetchPlatformKpi();
        fetchFormatKpi();
        fetchCityKpi();
        fetchDoi(queryParams);
        fetchMetroCity(queryParams);
        fetchOsaDetail(osaDetailParams);
        fetchKpiTrends(queryParams);

        // We set loading to false immediately so the child can render skeletons 
        // based on the empty apiData and update as responses arrive.
        setIsLoading(false);
      } catch (err) {
        console.error("Error in fetchData:", err);
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
          mslFilter={mslFilter}
          onMslChange={handleMslChange}
        />
      </CommonContainer>
    </>
  );
}
