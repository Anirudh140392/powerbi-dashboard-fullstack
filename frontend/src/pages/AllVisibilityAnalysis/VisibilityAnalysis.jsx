import React, { useState, useContext, useEffect, useRef } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import VisiblityAnalysisData from "../../components/AllVisiblityAnalysis/VisiblityAnalysisData";
import { FilterContext } from "../../utils/FilterContext";
import dayjs from "dayjs";

export default function VisibilityAnalysis() {
  // Get values from FilterContext - the source of truth for dropdown selections
  const {
    platform,
    selectedBrand,
    selectedLocation,
    selectedKeyword,
    timeStart,
    timeEnd,
    refreshFilters,
  } = useContext(FilterContext);

  const [showTrends, setShowTrends] = useState(false);

  // Track if visibility-specific dates have been initialized from rb_kw table
  const [visibilityDatesReady, setVisibilityDatesReady] = useState(false);

  // Initialize filters with empty dates - will be set after fetching from backend
  const [filters, setFilters] = useState({
    platform: platform || "Blinkit",
    brand: selectedBrand || "All",
    location: selectedLocation || "All",
    keyword: selectedKeyword || "All",
    months: 6,
    timeStep: "Weekly",
    startDate: null,
    endDate: null
  });

  // Ref to track last fetched filters to prevent duplicate API calls
  const lastFetchedFiltersRef = useRef(null);
  const lastMainFiltersRef = useRef(null); // Track only global filters

  // ============ CRITICAL: Fetch visibility-specific dates FIRST on mount ============
  useEffect(() => {
    // Only run once on mount
    if (visibilityDatesReady) return;

    const fetchVisibilityDates = async () => {
      try {
        console.log('🗓️ [Visibility] Fetching latest available dates from rb_kw table...');
        const response = await fetch('/api/visibility-analysis/latest-available-dates');
        const data = await response.json();

        let startDate, endDate;
        if (data.available) {
          console.log('✅ [Visibility] Received date range:', data.startDate, 'to', data.endDate);
          startDate = data.startDate;
          endDate = data.endDate;
        } else {
          // Fallback to last month if no data available
          console.log('⚠️ [Visibility] No data available, using fallback dates');
          const fallbackEnd = dayjs();
          const fallbackStart = fallbackEnd.subtract(1, 'month');
          startDate = fallbackStart.format('YYYY-MM-DD');
          endDate = fallbackEnd.format('YYYY-MM-DD');
        }

        // Set ready flag FIRST - so when filters update triggers re-render, ready is already true
        setVisibilityDatesReady(true);
        // Then set filters - this will trigger the data fetch effect with visibilityDatesReady=true
        setFilters(prev => ({
          ...prev,
          startDate,
          endDate
        }));
        console.log('🎯 [Visibility] Dates set, visibilityDatesReady set to true');
      } catch (error) {
        console.error('❌ [Visibility] Error fetching dates:', error);
        // Fallback on error
        const fallbackEnd = dayjs();
        const fallbackStart = fallbackEnd.subtract(1, 'month');
        setVisibilityDatesReady(true);
        setFilters(prev => ({
          ...prev,
          startDate: fallbackStart.format('YYYY-MM-DD'),
          endDate: fallbackEnd.format('YYYY-MM-DD')
        }));
      }
    };

    fetchVisibilityDates();
  }, [visibilityDatesReady]);

  // Sync platform/brand/location AND dates with FilterContext
  // When user changes dates in the header, update our local filters
  useEffect(() => {
    setFilters(prev => {
      const updates = {
        ...prev,
        platform: platform || prev.platform,
        brand: selectedBrand || prev.brand,
        location: selectedLocation || prev.location,
        keyword: selectedKeyword || prev.keyword,
      };

      // Sync dates from FilterContext if they're changed by user in the header
      if (timeStart && timeEnd) {
        const newStartDate = dayjs(timeStart).format('YYYY-MM-DD');
        const newEndDate = dayjs(timeEnd).format('YYYY-MM-DD');

        if (newStartDate !== prev.startDate || newEndDate !== prev.endDate) {
          console.log('🗓️ [Visibility] Syncing dates from header:', newStartDate, 'to', newEndDate);
          updates.startDate = newStartDate;
          updates.endDate = newEndDate;
        }
      }

      return updates;
    });
  }, [platform, selectedBrand, selectedLocation, selectedKeyword, timeStart, timeEnd]);

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Weekly",
    platform: platform || "Blinkit",
  });

  const [trendData, setTrendData] = useState({
    timeSeries: [],
    metrics: {},
  });

  // Tab for Top Search Terms
  const [topSearchFilter, setTopSearchFilter] = useState("All");

  // API data state - fetched when filters change
  const [apiData, setApiData] = useState({});
  // Per-segment error tracking
  const [apiErrors, setApiErrors] = useState({});

  // Individual segment fetch functions for retry capability
  const fetchVisibilityOverview = async (queryParams) => {
    try {
      setApiErrors(prev => ({ ...prev, overview: null }));
      const res = await fetch(`/api/visibility-analysis/visibility-overview?${queryParams}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, overview: data }));
      return true;
    } catch (err) {
      console.error('❌ [Visibility] Overview fetch error:', err);
      setApiErrors(prev => ({ ...prev, overview: err.message }));
      return false;
    }
  };

  const fetchVisibilityMatrix = async (matrixParams) => {
    try {
      setApiErrors(prev => ({ ...prev, matrix: null }));
      const res = await fetch(`/api/visibility-analysis/platform-kpi-matrix?${matrixParams}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, matrix: data }));
      return true;
    } catch (err) {
      console.error('❌ [Visibility] Platform KPI Matrix fetch error:', err);
      setApiErrors(prev => ({ ...prev, matrix: err.message }));
      return false;
    }
  };

  const fetchVisibilityKeywords = async (queryParams) => {
    try {
      setApiErrors(prev => ({ ...prev, keywords: null }));
      const res = await fetch(`/api/visibility-analysis/keywords-at-glance?${queryParams}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, keywords: data }));
      return true;
    } catch (err) {
      console.error('❌ [Visibility] Keywords at Glance fetch error:', err);
      setApiErrors(prev => ({ ...prev, keywords: err.message }));
      return false;
    }
  };

  const fetchVisibilitySearchTerms = async (termsParams) => {
    try {
      setApiErrors(prev => ({ ...prev, searchTerms: null }));
      const res = await fetch(`/api/visibility-analysis/top-search-terms?${termsParams}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, searchTerms: data }));
      return true;
    } catch (err) {
      console.error('❌ [Visibility] Top Search Terms fetch error:', err);
      setApiErrors(prev => ({ ...prev, searchTerms: err.message }));
      return false;
    }
  };

  // Retry handlers for each segment
  const retrySegment = async (segmentKey) => {
    // First, refresh the filter options to ensure dropdowns show updated values
    if (refreshFilters) {
      refreshFilters();
    }

    const baseParams = {
      platform: filters.platform || 'All',
      brand: filters.brand || 'All',
      location: filters.location || 'All',
      startDate: filters.startDate,
      endDate: filters.endDate
    };

    const queryParams = new URLSearchParams(baseParams).toString();
    const matrixParams = new URLSearchParams({
      platform: 'All',
      brand: filters.brand || 'All',
      location: filters.location || 'All',
      startDate: filters.startDate,
      endDate: filters.endDate
    }).toString();
    const termsParams = new URLSearchParams({
      ...baseParams,
      filter: topSearchFilter
    }).toString();

    switch (segmentKey) {
      case 'overview': return fetchVisibilityOverview(queryParams);
      case 'matrix': return fetchVisibilityMatrix(matrixParams);
      case 'keywords': return fetchVisibilityKeywords(queryParams);
      case 'searchTerms': return fetchVisibilitySearchTerms(termsParams);
      default: return false;
    }
  };

  // Fetch matrix with extra filters from the Advanced Filters modal
  // sectionValues shape: { platform: [], zone: [], metroFlag: [], pincode: [], kpi: [], ... }
  // Fetch dashboard data with extra filters from the Advanced Filters modal
  const fetchDashboardWithFilters = async (sectionValues) => {
    console.log('🔎 [Visibility] Global filter panel applied:', sectionValues);

    const baseParams = {
      brand: filters.brand || 'All',
      location: filters.location || 'All',
      startDate: filters.startDate,
      endDate: filters.endDate,
    };

    // Map filter panel selections to API params
    const selectedPlatforms = sectionValues?.platform;
    const platformParam = (selectedPlatforms && selectedPlatforms.length > 0)
      ? selectedPlatforms.join(',')
      : 'All';

    const selectedZones = sectionValues?.zone;
    const zoneParam = (selectedZones && selectedZones.length > 0)
      ? selectedZones.join(',')
      : undefined;

    const selectedMetro = sectionValues?.metroFlag;
    const metroParam = (selectedMetro && selectedMetro.length > 0)
      ? selectedMetro.join(',')
      : undefined;

    const selectedPincodes = sectionValues?.pincode;
    const pincodeParam = (selectedPincodes && selectedPincodes.length > 0)
      ? selectedPincodes.join(',')
      : undefined;

    const extraParams = {
      ...baseParams,
      platform: platformParam,
      ...(zoneParam ? { zone: zoneParam } : {}),
      ...(metroParam ? { metroFlag: metroParam } : {}),
      ...(pincodeParam ? { pincode: pincodeParam } : {}),
    };

    const cleanExtra = Object.fromEntries(
      Object.entries(extraParams).filter(([_, v]) => v !== undefined)
    );
    const queryParams = new URLSearchParams(cleanExtra).toString();

    // For Matrix, we often want platform: 'All' unless specifically overridden
    const matrixParams = new URLSearchParams({
      ...cleanExtra,
      platform: platformParam || 'All'
    }).toString();

    const termsParams = new URLSearchParams({
      ...cleanExtra,
      filter: topSearchFilter
    }).toString();

    // Clear current data to show skeletons
    setApiData({});

    await Promise.allSettled([
      fetchVisibilityOverview(queryParams),
      fetchVisibilityMatrix(matrixParams),
      fetchVisibilityKeywords(queryParams),
      fetchVisibilitySearchTerms(termsParams)
    ]);
  };

  useEffect(() => {
    // Debug: log current state
    console.log('🔍 [Visibility] Effect triggered - visibilityDatesReady:', visibilityDatesReady,
      'startDate:', filters.startDate, 'endDate:', filters.endDate);

    // Wait for visibility-specific dates to be initialized before making any API calls
    if (!visibilityDatesReady) {
      console.log('⏳ [Visibility] visibilityDatesReady is false, waiting...');
      return;
    }

    if (!filters.startDate || !filters.endDate) {
      console.log('⏳ [Visibility] Dates not yet set in filters, waiting...');
      return;
    }

    // Create a stable key for main global filters only
    const mainFiltersKey = JSON.stringify({
      platform: filters.platform,
      brand: filters.brand,
      location: filters.location,
      keyword: filters.keyword,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    // Create a stable key to detect actual filter changes (including tabs)
    const filterKey = JSON.stringify({
      ...JSON.parse(mainFiltersKey),
      topSearchFilter: topSearchFilter // Add tab filter to dependency tracking
    });

    // Check if MAIN filters (platform, brand, location, dates) actually changed
    const isMainFilterChange = lastMainFiltersRef.current !== mainFiltersKey;

    // Skip if we already fetched with these same FINAL filters (including tabs)
    if (lastFetchedFiltersRef.current === filterKey) {
      console.log('⏭️ [Visibility] Skipping duplicate fetch: Filters unchanged');
      return;
    }

    console.log('✅ [Visibility] Proceeding with fetch - filterKey:', filterKey);

    // Mark these filters as being fetched (to prevent immediate logical loop)
    lastFetchedFiltersRef.current = filterKey;

    // Only reset all data (triggering all skeleton loaders) if MAIN filters changed.
    if (isMainFilterChange) {
      console.log('🔄 [Visibility] Main filters changed, resetting all data');
      setApiData({});
      setApiErrors({});
      // Update the main ref here to mark this state change
      lastMainFiltersRef.current = mainFiltersKey;
    } else {
      console.log('⚡ [Visibility] Only tab changed, isolating update');
      // Optionally clear only searchTerms to show its specific loader
      setApiData(prev => ({ ...prev, searchTerms: undefined }));
    }

    const fetchData = async () => {
      try {
        const baseParams = {
          platform: filters.platform || 'All',
          brand: filters.brand || 'All',
          location: filters.location || 'All',
          keyword: (filters.keyword && filters.keyword !== 'All') ? filters.keyword : undefined,
          startDate: filters.startDate,
          endDate: filters.endDate
        };

        // Remove undefined keys before building URLSearchParams
        const cleanParams = Object.fromEntries(
          Object.entries(baseParams).filter(([_, v]) => v !== undefined)
        );

        // 1. ALWAYS fetch Top Search Terms if tab OR main filters changed
        const termsParams = new URLSearchParams({
          ...cleanParams,
          filter: topSearchFilter
        }).toString();

        console.log('📡 [Visibility] Fetching Top Search Terms:', topSearchFilter);
        fetchVisibilitySearchTerms(termsParams);

        // 2. Only fetch OTHER segments if it was a main filter change
        if (!isMainFilterChange) {
          console.log('⏭️ [Visibility] Skipping non-tab fetches (main filters unchanged)');
          return;
        }

        const queryParams = new URLSearchParams(cleanParams).toString();
        const matrixParams = new URLSearchParams({
          ...cleanParams,
          platform: 'All', // Matrix always fetches all platforms
        }).toString();

        console.log('📡 [Visibility] Fetching ALL segments (main filters changed)');

        // Fetch all segments (errors are tracked per-segment)
        await Promise.allSettled([
          fetchVisibilityOverview(queryParams),
          fetchVisibilityMatrix(matrixParams),
          fetchVisibilityKeywords(queryParams)
        ]);
      } catch (error) {
        console.error("[Visibility] Error setting up data fetch:", error);
      }
    };

    fetchData();
  }, [filters, topSearchFilter, visibilityDatesReady]); // Wait for visibility dates before fetching

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

  return (
    <>
      <CommonContainer
        title="Visibility Analysis"
        filters={filters}
        onFiltersChange={setFilters}
      >
        <VisiblityAnalysisData
          apiData={apiData}
          apiErrors={apiErrors}
          onRetry={retrySegment}
          filters={filters}
          topSearchFilter={topSearchFilter}
          setTopSearchFilter={setTopSearchFilter}
          onMatrixFiltersApply={fetchDashboardWithFilters}
        />
      </CommonContainer>
    </>
  );
}

