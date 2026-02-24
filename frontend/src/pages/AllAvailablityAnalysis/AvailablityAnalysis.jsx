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
    setPlatform,
    setSelectedLocation,
    setTimeStart,
    setTimeEnd,
    selectedCategory,
    setSelectedCategory,
    compareStart,
    compareEnd,
    selectedChannel,
    refreshFilters
  } = useContext(FilterContext);

  const [showTrends, setShowTrends] = useState(false);

  // Initial filter state from global context
  const initialFilters = {
    platform: platform || "Blinkit",
    brand: selectedBrand || "All",
    location: selectedLocation || "All",
    category: selectedCategory || "All",
    zones: selectedZone || "All",
    channel: selectedChannel || "Ecommerce",
    months: 6,
    timeStep: "Monthly",
    startDate: timeStart ? timeStart.format('YYYY-MM-DD') : dayjs().startOf('month').format('YYYY-MM-DD'),
    endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
    compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : null,
    compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : null
  };

  // Split filter states for independent control
  const [matrixFilters, setMatrixFilters] = useState(initialFilters);
  const [detailFilters, setDetailFilters] = useState(initialFilters);

  // Sync back to global context for top-level dropdowns
  const syncGlobalContext = (newFilters) => {
    if (newFilters.platform && typeof newFilters.platform === 'string' && newFilters.platform !== platform) {
      setPlatform(newFilters.platform);
    }
    if (newFilters.location && typeof newFilters.location === 'string' && newFilters.location !== selectedLocation) {
      setSelectedLocation(newFilters.location);
    }
    if (newFilters.category && typeof newFilters.category === 'string' && newFilters.category !== selectedCategory) {
      setSelectedCategory(newFilters.category);
    }
    if (newFilters.startDate) {
      const newStart = dayjs(newFilters.startDate);
      if (!newStart.isSame(timeStart, 'day')) setTimeStart(newStart);
    }
    if (newFilters.endDate) {
      const newEnd = dayjs(newFilters.endDate);
      if (!newEnd.isSame(timeEnd, 'day')) setTimeEnd(newEnd);
    }
  };

  const handleMatrixFiltersChange = (newFilters) => {
    setMatrixFilters(prev => ({ ...prev, ...newFilters }));
    syncGlobalContext(newFilters);
  };

  const handleDetailFiltersChange = (newFilters) => {
    setDetailFilters(prev => ({ ...prev, ...newFilters }));
    syncGlobalContext(newFilters);
  };

  // Ref to track last fetched filters
  const lastFetchedRef = useRef({ matrix: null, detail: null });

  // Sync local filters when global context changes
  useEffect(() => {
    const syncWithContext = (prev) => {
      const next = { ...prev };
      if (platform && platform !== prev.platform) next.platform = platform;
      if (selectedBrand && selectedBrand !== prev.brand) next.brand = selectedBrand;
      if (selectedLocation && selectedLocation !== prev.location) next.location = selectedLocation;
      if (selectedCategory && selectedCategory !== prev.category) next.category = selectedCategory;
      if (selectedZone && selectedZone !== prev.zones) next.zones = selectedZone;
      if (selectedChannel && selectedChannel !== prev.channel) next.channel = selectedChannel;

      const startStr = timeStart ? timeStart.format('YYYY-MM-DD') : prev.startDate;
      const endStr = timeEnd ? timeEnd.format('YYYY-MM-DD') : prev.endDate;
      const cStartStr = compareStart ? compareStart.format('YYYY-MM-DD') : null;
      const cEndStr = compareEnd ? compareEnd.format('YYYY-MM-DD') : null;

      if (startStr !== prev.startDate) next.startDate = startStr;
      if (endStr !== prev.endDate) next.endDate = endStr;
      if (cStartStr !== prev.compareStartDate) next.compareStartDate = cStartStr;
      if (cEndStr !== prev.compareEndDate) next.compareEndDate = cEndStr;

      return next;
    };

    setMatrixFilters(prev => syncWithContext(prev));
    setDetailFilters(prev => syncWithContext(prev));
  }, [platform, selectedBrand, selectedLocation, selectedCategory, timeStart, timeEnd, compareStart, compareEnd, selectedZone, selectedChannel]);

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Monthly",
    platform: platform || "Blinkit",
  });

  const [trendData, setTrendData] = useState({
    timeSeries: [],
    metrics: {},
  });

  const [apiData, setApiData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [apiErrors, setApiErrors] = useState({});

  // Query builder helper
  const buildQueryParams = (f) => {
    const params = new URLSearchParams();
    Object.entries(f).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== 'All' && value !== '') {
        if (Array.isArray(value)) {
          if (value.length > 0) value.forEach(v => params.append(key, v));
        } else {
          params.append(key, value);
        }
      }
    });
    // Ensure critical ones have defaults if empty
    if (!params.has('platform')) params.append('platform', 'All');
    if (!params.has('brand')) params.append('brand', 'All');
    if (!params.has('location')) params.append('location', 'All');
    return params.toString();
  };

  // Segment fetchers
  const fetchOverview = async (qp) => {
    try {
      const res = await fetch(`/api/availability-analysis/absolute-osa/availability-overview?${qp}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, overview: data }));
    } catch (e) { console.error(e); }
  };

  const fetchPlatformKpi = async (qp) => {
    try {
      const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=Platform&${qp}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, platformKpi: data }));
    } catch (e) { console.error(e); }
  };

  const fetchFormatKpi = async (qp) => {
    try {
      const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=Format&${qp}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, formatKpi: data }));
    } catch (e) { console.error(e); }
  };

  const fetchCityKpi = async (qp) => {
    try {
      const res = await fetch(`/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=City&${qp}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, cityKpi: data }));
    } catch (e) { console.error(e); }
  };

  const fetchDoi = async (qp) => {
    try {
      const res = await fetch(`/api/availability-analysis/absolute-osa/doi?${qp}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, doi: data }));
    } catch (e) { console.error(e); }
  };

  const fetchMetroCity = async (qp) => {
    try {
      const res = await fetch(`/api/availability-analysis/absolute-osa/metro-city-stock-availability?${qp}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, metroCity: data }));
    } catch (e) { console.error(e); }
  };

  const fetchOsaDetail = async (dp) => {
    try {
      const res = await fetch(`/api/availability-analysis/absolute-osa/osa-percentage-detail?${dp}`);
      const data = await res.json();
      setApiData(prev => ({ ...prev, osaDetail: data }));
    } catch (e) { console.error(e); }
  };

  // Matrix Sync
  useEffect(() => {
    const qp = buildQueryParams(matrixFilters);
    if (lastFetchedRef.current.matrix === qp) return;
    lastFetchedRef.current.matrix = qp;

    const fetchData = async () => {
      setIsLoading(true);
      await Promise.allSettled([
        fetchOverview(qp),
        fetchPlatformKpi(qp),
        fetchFormatKpi(qp),
        fetchCityKpi(qp),
        fetchDoi(qp),
        fetchMetroCity(qp)
      ]);
      setIsLoading(false);
    };
    fetchData();
  }, [matrixFilters]);

  // Detail Sync
  useEffect(() => {
    const osaDetailParams = new URLSearchParams({
      platform: Array.isArray(detailFilters.platform) ? detailFilters.platform.join(',') : (detailFilters.platform || 'All'),
      brand: Array.isArray(detailFilters.brand) ? detailFilters.brand.join(',') : (detailFilters.brand || 'All'),
      location: Array.isArray(detailFilters.location) ? detailFilters.location.join(',') : (detailFilters.location || 'All'),
      category: Array.isArray(detailFilters.category) ? detailFilters.category.join(',') : (detailFilters.category || 'All'),
      startDate: detailFilters.startDate,
      endDate: detailFilters.endDate,
      kpis: Array.isArray(detailFilters.kpi) ? detailFilters.kpi.join(',') : (detailFilters.kpi || '')
    }).toString();

    if (lastFetchedRef.current.detail === osaDetailParams) return;
    lastFetchedRef.current.detail = osaDetailParams;

    fetchOsaDetail(osaDetailParams);
  }, [detailFilters]);

  const retrySegment = (seg) => {
    if (refreshFilters) refreshFilters();
    lastFetchedRef.current = { matrix: null, detail: null };
    // Trigger re-fetch by bumping state or just clearing refs
    setMatrixFilters({ ...matrixFilters });
    setDetailFilters({ ...detailFilters });
  };

  return (
    <CommonContainer
      title="Availability Analysis"
      filters={matrixFilters}
      onFiltersChange={handleMatrixFiltersChange}
    >
      <AvailablityAnalysisData
        apiData={apiData}
        apiErrors={apiErrors}
        onRetry={retrySegment}
        matrixFilters={matrixFilters}
        onMatrixFiltersChange={handleMatrixFiltersChange}
        detailFilters={detailFilters}
        onDetailFiltersChange={handleDetailFiltersChange}
        loading={isLoading}
      />
    </CommonContainer>
  );
}
