import React, { useState, useContext, useEffect, useRef } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import StandaloneOsaDetailView from "../../components/OnShelfAvailability/StandaloneOsaDetailView";
import StandaloneKpiMatrix from "../../components/OnShelfAvailability/StandaloneKpiMatrix";
import { FilterContext } from "../../utils/FilterContext";
import { OsaDetailViewSkeleton } from "../../components/AllAvailablityAnalysis/AvailabilitySkeletons";
import dayjs from "dayjs";

export default function OnShelfAvailability() {

  // Get values from FilterContext - the source of truth for dropdown selections
  const {
    platform,
    selectedBrand,
    selectedLocation,
    timeStart,
    timeEnd,
    selectedZone,
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

  // Initialize filters from context
  const [filters, setFilters] = useState({
    platform: platform || "Blinkit",
    brand: selectedBrand || "All",
    location: selectedLocation || "All",
    category: selectedCategory || "All",
    productCategory: selectedProductCategory || "All",
    zones: selectedZone || "All",
    channel: selectedChannel || "Ecommerce",
    startDate: timeStart ? timeStart.format('YYYY-MM-DD') : dayjs().startOf('month').format('YYYY-MM-DD'),
    endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
    compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : null,
    compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : null
  });

  // Wrapper to sync context when filters change locally
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

  // Restore comprehensive platform list from rca_sku_dim on mount
  useEffect(() => {
    if (typeof refreshFilters === 'function') {
      refreshFilters();
    }
  }, [refreshFilters]);

  const [apiData, setApiData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [apiErrors, setApiErrors] = useState({});

  // Build query params helper
  const buildQueryParams = () => {
    const params = new URLSearchParams();

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

  // Get auth headers for API calls (JWT token from localStorage)
  const getAuthHeaders = () => {
    const token = sessionStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch OSA Detail data
  const fetchOsaDetail = async (queryParams) => {
    try {
      setApiErrors(prev => ({ ...prev, osaDetail: null }));
      const res = await fetch(`/api/availability-analysis/absolute-osa/osa-percentage-detail?${queryParams}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log('[OnShelfAvailability][OsaDetail] API response received. Type:', typeof data, 'IsArray:', Array.isArray(data), 'Length:', Array.isArray(data) ? data.length : (data?.length || 'N/A'));
      // Handle both direct array and wrapped responses
      const osaRows = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : data?.rows || data);
      console.log('[OnShelfAvailability][OsaDetail] Parsed rows count:', Array.isArray(osaRows) ? osaRows.length : 'not-array');
      setApiData(prev => ({ ...prev, osaDetail: osaRows }));
      return true;
    } catch (err) {
      console.error('[OnShelfAvailability][OsaDetail] API error:', err);
      setApiErrors(prev => ({ ...prev, osaDetail: err.message }));
      return false;
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
      zones: filters.zones
    });

    // Skip if we already fetched with these same filters
    if (lastFetchedFiltersRef.current === filterKey) {
      console.log('⏭️ [OnShelfAvailability] Skipping duplicate fetch: Filters unchanged');
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

        console.log('📡 [OnShelfAvailability] Fetching OSA detail data. Filters:', filters.platform, filters.brand, filters.location);

        await fetchOsaDetail(queryParams);

        console.log('✅ [OnShelfAvailability] OSA detail data fetched');
      } catch (error) {
        console.error("[OnShelfAvailability] Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [filters]);

  return (
    <>
      <CommonContainer
        title="On-Shelf Availability"
        filters={filters}
        onFiltersChange={handleFiltersChange}
      >
        <div className="max-w-7xl mx-auto space-y-5">
          {isLoading ? (
            <OsaDetailViewSkeleton />
          ) : (
            <StandaloneOsaDetailView
              apiData={apiData}
              loading={isLoading}
            />
          )}

          {/* KPI Matrix Segment (from Market Share) */}
          <StandaloneKpiMatrix loading={isLoading} />
        </div>
      </CommonContainer>
    </>
  );
}
