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
    refreshFilters
  } = useContext(FilterContext);

  const [showTrends, setShowTrends] = useState(false);

  // Initialize filters from context
  const [filters, setFilters] = useState({
    platform: platform || "Blinkit",
    brand: selectedBrand || "All",
    location: selectedLocation || "All",
    zones: selectedZone || "All",
    months: 6,
    timeStep: "Monthly",
    startDate: timeStart ? timeStart.format('YYYY-MM-DD') : dayjs().startOf('month').format('YYYY-MM-DD'),
    endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
  });

  // Wrapper to sync context when filters change locally (e.g. from internal matrix filters)
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);

    // Sync back to FilterContext to update global header
    if (newFilters.platform && newFilters.platform !== platform) {
      setPlatform(newFilters.platform);
    }
    if (newFilters.location && newFilters.location !== selectedLocation) {
      setSelectedLocation(newFilters.location);
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
      zones: selectedZone || prev.zones,
      startDate: timeStart ? timeStart.format('YYYY-MM-DD') : prev.startDate,
      endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : prev.endDate
    }));
  }, [platform, selectedBrand, selectedLocation, timeStart, timeEnd, selectedZone]);

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

  // Individual segment fetch functions for retry capability
  const fetchOverview = async (queryParams) => {
    try {
      setApiErrors(prev => ({ ...prev, overview: null }));
      const res = await fetch(`/api/availability-analysis/absolute-osa/availability-overview?${queryParams}`);
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
      const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=Platform&${queryParams}`);
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
      const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=Format&${queryParams}`);
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
      const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=City&${queryParams}`);
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
      const res = await fetch(`/api/availability-analysis/absolute-osa/doi?${queryParams}`);
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
      const res = await fetch(`/api/availability-analysis/absolute-osa/metro-city-stock-availability?${queryParams}`);
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
      const res = await fetch(`/api/availability-analysis/absolute-osa/osa-percentage-detail?${osaDetailParams}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, osaDetail: data }));
      return true;
    } catch (err) {
      console.error('[OsaDetail] API error:', err);
      setApiErrors(prev => ({ ...prev, osaDetail: err.message }));
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
      endDate: filters.endDate
    }).toString();

    switch (segmentKey) {
      case 'overview': return fetchOverview(queryParams);
      case 'platformKpi': return fetchPlatformKpi(queryParams);
      case 'formatKpi': return fetchFormatKpi(queryParams);
      case 'cityKpi': return fetchCityKpi(queryParams);
      case 'doi': return fetchDoi(queryParams);
      case 'metroCity': return fetchMetroCity(queryParams);
      case 'osaDetail': return fetchOsaDetail(osaDetailParams);
      default: return false;
    }
  };

  useEffect(() => {
    // Create a stable key to detect actual filter changes
    const filterKey = JSON.stringify({
      platform: filters.platform,
      brand: filters.brand,
      location: filters.location,
      startDate: filters.startDate,
      endDate: filters.endDate
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

        // OSA Detail - Following global date range
        const osaDetailParams = new URLSearchParams({
          platform: 'All',
          brand: 'All',
          location: 'All',
          startDate: filters.startDate,
          endDate: filters.endDate
        }).toString();

        console.log('📡 Fetching availability data. Global filters:', filters.platform, filters.brand, filters.location);

        // Fetch all segments (errors are tracked per-segment)
        await Promise.allSettled([
          fetchOverview(queryParams),
          fetchPlatformKpi(queryParams),
          fetchFormatKpi(queryParams),
          fetchCityKpi(queryParams),
          fetchDoi(queryParams),
          fetchMetroCity(queryParams),
          fetchOsaDetail(osaDetailParams)
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
