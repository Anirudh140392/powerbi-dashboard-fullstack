import React, { useState, useContext, useEffect, useRef } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import VisiblityAnalysisData from "../../components/AllVisiblityAnalysis/VisiblityAnalysisData";
import { FilterContext } from "../../utils/FilterContext";
import axiosInstance from "../../api/axiosInstance";
import dayjs from "dayjs";

export default function VisibilityAnalysis() {
  // Get values from FilterContext - the source of truth for dropdown selections
  const {
    platform,
    selectedBrand,
    selectedLocation,
    selectedKeyword,
    selectedKeywordType,
    selectedCategory,
    selectedChannel,
    timeStart,
    timeEnd,
    selectedZone,
    selectedMetroFlag,
    selectedPincode,
    refreshFilters,
  } = useContext(FilterContext);

  const [showTrends, setShowTrends] = useState(false);

  // Track if visibility-specific dates have been initialized from rb_kw_olap table
  const [visibilityDatesReady, setVisibilityDatesReady] = useState(false);

  // Initialize filters with empty dates - will be set after fetching from backend
  const [filters, setFilters] = useState({
    platform: platform || "Blinkit",
    brand: selectedBrand || "All",
    location: "All",
    keyword: selectedKeyword || "All",
    keywordType: selectedKeywordType || "All",
    category: selectedCategory || "All",
    channel: selectedChannel || "All",
    zone: selectedZone || "All",
    metroFlag: selectedMetroFlag || "All",
    pincode: selectedPincode || "All",
    months: 6,
    timeStep: "Weekly",
    startDate: null,  // Will be set after fetching latest available dates
    endDate: null     // Will be set after fetching latest available dates
  });

  // Ref to track last fetched filters to prevent duplicate API calls
  const lastFetchedFiltersRef = useRef(null);
  const lastMainFiltersRef = useRef(null); // Track only global filters
  const abortControllerRef = useRef(null); // Persistent ref to handle abortions manually

  // ============ CRITICAL: Fetch visibility-specific dates FIRST on mount ============
  useEffect(() => {
    // Only run once on mount
    if (visibilityDatesReady) return;

    const fetchVisibilityDates = async () => {
      try {
        console.log('🗓️ [Visibility] Fetching latest available dates from rb_kw_olap table...');
        const response = await axiosInstance.get('/visibility-analysis/latest-available-dates');
        const data = response.data;

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

  // Sync platform/brand/location/keyword/category AND dates with FilterContext
  // When user changes any global filter in the header, update our local filters
  useEffect(() => {
    // Only update if filters actually changed to avoid unnecessary re-renders/aborts
    const currentPlatform = platform || filters.platform;
    const currentBrand = selectedBrand || filters.brand;
    const currentLocation = selectedLocation || filters.location;
    const currentKeyword = selectedKeyword || filters.keyword;
    const currentKeywordType = selectedKeywordType || filters.keywordType;
    const currentCategory = selectedCategory || filters.category;
    const currentChannel = selectedChannel || filters.channel;
    const currentZone = selectedZone || filters.zone;
    const currentMetroFlag = selectedMetroFlag || filters.metroFlag;
    const currentPincode = selectedPincode || filters.pincode;
    const currentStartDate = timeStart ? dayjs(timeStart).format('YYYY-MM-DD') : filters.startDate;
    const currentEndDate = timeEnd ? dayjs(timeEnd).format('YYYY-MM-DD') : filters.endDate;

    if (
      currentPlatform !== filters.platform ||
      currentBrand !== filters.brand ||
      currentKeyword !== filters.keyword ||
      currentKeywordType !== filters.keywordType ||
      currentCategory !== filters.category ||
      currentChannel !== filters.channel ||
      currentLocation !== filters.location ||
      currentZone !== filters.zone ||
      currentMetroFlag !== filters.metroFlag ||
      currentPincode !== filters.pincode ||
      currentStartDate !== filters.startDate ||
      currentEndDate !== filters.endDate
    ) {
      console.log('🗓️ [Visibility] Syncing filters from global context');
      setFilters(prev => ({
        ...prev,
        platform: currentPlatform,
        brand: currentBrand,
        location: currentLocation,
        zone: currentZone,
        metroFlag: currentMetroFlag,
        pincode: currentPincode,
        keyword: currentKeyword,
        keywordType: currentKeywordType,
        category: currentCategory,
        channel: currentChannel,
        startDate: currentStartDate,
        endDate: currentEndDate
      }));
    }
  }, [platform, selectedBrand, selectedLocation, selectedZone, selectedMetroFlag, selectedPincode, selectedKeyword, selectedKeywordType, selectedCategory, selectedChannel, timeStart, timeEnd]);

  // Restore comprehensive platform list from rca_sku_dim on mount
  // (Prevents subsetting from other pages like Performance Marketing)
  useEffect(() => {
    if (typeof refreshFilters === 'function') {
      refreshFilters();
    }
  }, [refreshFilters]);

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Weekly",
    platform: platform || "Blinkit",
  });

  const [trendData, setTrendData] = useState({
    timeSeries: [],
    metrics: {},
  });



  // API data state - fetched when filters change
  const [apiData, setApiData] = useState({});
  // Per-segment error tracking
  const [apiErrors, setApiErrors] = useState({});
  // Per-segment loading state
  const [loading, setLoading] = useState({
    overview: false,
    matrix: false,
    keywords: false,
    gainersAndDrainers: false
  });

  // Individual segment fetch functions for retry capability
  const fetchVisibilityOverview = async (queryParams, signal) => {
    try {
      setLoading(prev => ({ ...prev, overview: true }));
      setApiErrors(prev => ({ ...prev, overview: null }));
      const res = await axiosInstance.get(`/visibility-analysis/visibility-overview?${queryParams}`, { signal });
      const data = res.data;
      setApiData(prev => ({ ...prev, overview: data }));
      return true;
    } catch (err) {
      if (axiosInstance.isCancel(err)) return false;
      console.error('❌ [Visibility] Overview fetch error:', err);
      setApiErrors(prev => ({ ...prev, overview: err.message }));
      return false;
    } finally {
      setLoading(prev => ({ ...prev, overview: false }));
    }
  };

  const fetchVisibilityMatrix = async (matrixParams, signal) => {
    try {
      setLoading(prev => ({ ...prev, matrix: true }));
      setApiErrors(prev => ({ ...prev, matrix: null }));
      const res = await axiosInstance.get(`/visibility-analysis/platform-kpi-matrix?${matrixParams}`, { signal });
      const data = res.data;
      setApiData(prev => ({ ...prev, matrix: data }));
      return true;
    } catch (err) {
      if (axiosInstance.isCancel(err)) return false;
      console.error('❌ [Visibility] Platform KPI Matrix fetch error:', err);
      setApiErrors(prev => ({ ...prev, matrix: err.message }));
      return false;
    } finally {
      setLoading(prev => ({ ...prev, matrix: false }));
    }
  };

  const fetchVisibilityKeywords = async (queryParams, signal) => {
    try {
      setLoading(prev => ({ ...prev, keywords: true }));
      setApiErrors(prev => ({ ...prev, keywords: null }));
      const res = await axiosInstance.get(`/visibility-analysis/keywords-at-glance?${queryParams}`, { signal });
      const data = res.data;
      setApiData(prev => ({ ...prev, keywords: data }));
      return true;
    } catch (err) {
      if (axiosInstance.isCancel(err)) return false;
      console.error('❌ [Visibility] Keywords at Glance fetch error:', err);
      setApiErrors(prev => ({ ...prev, keywords: err.message }));
      return false;
    } finally {
      setLoading(prev => ({ ...prev, keywords: false }));
    }
  };



  const fetchVisibilityGainersAndDrainers = async (queryParams, signal) => {
    try {
      setLoading(prev => ({ ...prev, gainersAndDrainers: true }));
      setApiErrors(prev => ({ ...prev, gainersAndDrainers: null }));
      const res = await axiosInstance.get(`/visibility-analysis/gainers-drainers?${queryParams}`, { signal });
      const data = res.data;
      setApiData(prev => ({ ...prev, gainersAndDrainers: data }));
      return true;
    } catch (err) {
      if (axiosInstance.isCancel(err)) return false;
      console.error('❌ [Visibility] Gainers & Drainers fetch error:', err);
      setApiErrors(prev => ({ ...prev, gainersAndDrainers: err.message }));
      return false;
    } finally {
      setLoading(prev => ({ ...prev, gainersAndDrainers: false }));
    }
  };

  // Retry handlers for each segment
  const retrySegment = async (segmentKey) => {
    // First, refresh the filter options to ensure dropdowns show updated values
    if (refreshFilters) {
      refreshFilters();
    }

    const baseParams = {
      platform: (filters.platform && filters.platform !== 'All') ? (Array.isArray(filters.platform) ? filters.platform.join(',').toLowerCase() : String(filters.platform).toLowerCase()) : 'All',
      brand: (filters.brand && filters.brand !== 'All') ? (Array.isArray(filters.brand) ? filters.brand.join(',').toLowerCase() : String(filters.brand).toLowerCase()) : 'All',
      location: (filters.location && filters.location !== 'All') ? (Array.isArray(filters.location) ? filters.location.join(',').toLowerCase() : String(filters.location).toLowerCase()) : 'all',
      keyword: filters.keyword || 'All',
      keywordType: filters.keywordType || 'All',
      category: (filters.category && filters.category !== 'All') ? (Array.isArray(filters.category) ? filters.category.join(',').toLowerCase() : String(filters.category).toLowerCase()) : 'All',
      channel: filters.channel || 'All',
      startDate: filters.startDate,
      endDate: filters.endDate
    };

    const queryParams = new URLSearchParams(baseParams).toString();
    const matrixParams = new URLSearchParams({
      platform: (filters.platform && filters.platform !== 'All') ? (Array.isArray(filters.platform) ? filters.platform.join(',').toLowerCase() : String(filters.platform).toLowerCase()) : 'All',
      brand: (filters.brand && filters.brand !== 'All') ? (Array.isArray(filters.brand) ? filters.brand.join(',').toLowerCase() : String(filters.brand).toLowerCase()) : 'All',
      location: (filters.location && filters.location !== 'All') ? (Array.isArray(filters.location) ? filters.location.join(',').toLowerCase() : String(filters.location).toLowerCase()) : 'all',
      keyword: filters.keyword || 'All',
      keywordType: filters.keywordType || 'All',
      category: (filters.category && filters.category !== 'All') ? (Array.isArray(filters.category) ? filters.category.join(',').toLowerCase() : String(filters.category).toLowerCase()) : 'All',
      channel: filters.channel || 'All',
      startDate: filters.startDate,
      endDate: filters.endDate
    }).toString();


    switch (segmentKey) {
      case 'overview': return fetchVisibilityOverview(queryParams);
      case 'matrix': return fetchVisibilityMatrix(matrixParams);
      case 'keywords': return fetchVisibilityKeywords(queryParams);
      case 'gainersAndDrainers': return fetchVisibilityGainersAndDrainers(queryParams);
      default: return false;
    }
  };

  // Fetch visibility data when filters change
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
      platform: (filters.platform && filters.platform !== 'All') ? (Array.isArray(filters.platform) ? filters.platform.join(',').toLowerCase() : String(filters.platform).toLowerCase()) : 'All',
      brand: (filters.brand && filters.brand !== 'All') ? (Array.isArray(filters.brand) ? filters.brand.join(',').toLowerCase() : String(filters.brand).toLowerCase()) : 'All',
      location: (filters.location && filters.location !== 'All') ? (Array.isArray(filters.location) ? filters.location.join(',').toLowerCase() : String(filters.location).toLowerCase()) : 'all',
      keyword: filters.keyword,
      keywordType: filters.keywordType,
      category: (filters.category && filters.category !== 'All') ? (Array.isArray(filters.category) ? filters.category.join(',').toLowerCase() : String(filters.category).toLowerCase()) : 'All',
      channel: filters.channel,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    // Create a stable key to detect actual filter changes
    const filterKey = mainFiltersKey;

    // Check if MAIN filters (platform, brand, location, dates) actually changed
    const isMainFilterChange = lastMainFiltersRef.current !== mainFiltersKey;

    // Skip if we already fetched with these same FINAL filters (including tabs)
    // Check if we already have a fetch in progress for THIS EXACT filter set
    if (lastFetchedFiltersRef.current === filterKey) {
      console.log('⏭️ [Visibility] Skipping redundant fetch: Filter key matches active/last success');
      return;
    }

    console.log('✅ [Visibility] Proceeding with fetch - filterKey:', filterKey);

    // ABORT PREVIOUS FETCH (Different key)
    if (abortControllerRef.current) {
      console.log('🛑 [Visibility] Aborting previous fetch due to new key');
      abortControllerRef.current.abort();
    }

    // CREATE NEW CONTROLLER FOR THIS KEY
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    lastFetchedFiltersRef.current = filterKey;

    // Only reset all data (triggering all skeleton loaders) if MAIN filters changed.
    if (isMainFilterChange) {
      console.log('🔄 [Visibility] Main filters changed, resetting all data');
      setApiData({});
      setApiErrors({});
      // Set all loading states to true
      setLoading({
        overview: true,
        matrix: true,
        keywords: true,
        gainersAndDrainers: true
      });
      // Update the main ref here to mark this state change
      lastMainFiltersRef.current = mainFiltersKey;
    }


    const fetchData = async () => {
      try {
        const baseParams = {
          platform: (filters.platform && filters.platform !== 'All') ? (Array.isArray(filters.platform) ? filters.platform.join(',').toLowerCase() : String(filters.platform).toLowerCase()) : 'All',
          brand: (filters.brand && filters.brand !== 'All') ? (Array.isArray(filters.brand) ? filters.brand.join(',').toLowerCase() : String(filters.brand).toLowerCase()) : 'All',
          location: (filters.location && filters.location !== 'All') ? (Array.isArray(filters.location) ? filters.location.join(',').toLowerCase() : String(filters.location).toLowerCase()) : 'all',
          zone: filters.zone || 'All',
          metroFlag: filters.metroFlag || 'All',
          pincode: filters.pincode || 'All',
          keyword: filters.keyword || 'All',
          keywordType: filters.keywordType || 'All',
          category: (filters.category && filters.category !== 'All') ? (Array.isArray(filters.category) ? filters.category.join(',').toLowerCase() : String(filters.category).toLowerCase()) : 'All',
          channel: filters.channel || 'All',
          startDate: filters.startDate,
          endDate: filters.endDate
        };

        const queryParams = new URLSearchParams(baseParams).toString();
        const matrixParams = new URLSearchParams(baseParams).toString();


        console.log('📡 [Visibility] Fetching segments in parallel...');

        const fetchPromises = [];

        if (isMainFilterChange) {
          fetchPromises.push(
            fetchVisibilityOverview(queryParams, abortController.signal),
            fetchVisibilityMatrix(matrixParams, abortController.signal),
            fetchVisibilityKeywords(queryParams, abortController.signal),
            fetchVisibilityGainersAndDrainers(queryParams, abortController.signal)
          );
        }

        await Promise.allSettled(fetchPromises);
      } catch (error) {
        if (axiosInstance.isCancel(error)) {
          console.log('Fetch operation cancelled by AbortController');
        } else {
          console.error("[Visibility] Error setting up data fetch:", error);
          lastFetchedFiltersRef.current = null;
        }
      }
    };

    fetchData();

    return () => {
      // AbortController logic handled via abortControllerRef for stability
    };
  }, [filters, visibilityDatesReady]); // Wait for visibility dates before fetching

  // REAL Cleanup function to handle component unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        console.log('🧹 [Visibility] Final cleanup: Aborting all fetches on unmount');
        abortControllerRef.current.abort();
      }
    };
  }, []);

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
          loading={loading}
          onRetry={retrySegment}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </CommonContainer>
    </>
  );
}

