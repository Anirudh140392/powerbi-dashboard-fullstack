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
    timeStart,
    timeEnd
  } = useContext(FilterContext);

  const [showTrends, setShowTrends] = useState(false);

  // Initialize filters from context
  const [filters, setFilters] = useState({
    platform: platform || "Blinkit",
    brand: selectedBrand || "All",
    location: selectedLocation || "All",
    months: 6,
    timeStep: "Monthly",
    startDate: timeStart ? timeStart.format('YYYY-MM-DD') : dayjs().subtract(1, 'month').format('YYYY-MM-DD'),
    endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
  });

  // Ref to track last fetched filters to prevent duplicate API calls
  const lastFetchedFiltersRef = useRef(null);

  // Sync filters with FilterContext when context values change
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      platform: platform || prev.platform,
      brand: selectedBrand || prev.brand,
      location: selectedLocation || prev.location,
      startDate: timeStart ? timeStart.format('YYYY-MM-DD') : prev.startDate,
      endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : prev.endDate
    }));
  }, [platform, selectedBrand, selectedLocation, timeStart, timeEnd]);

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Monthly",
    platform: platform || "Blinkit",
  });

  const [trendData, setTrendData] = useState({
    timeSeries: [],
    metrics: {},
  });

  // API data state - fetched when filters change
  const [apiData, setApiData] = useState({});

  // Fetch visibility data when filters change
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
      console.log('⏭️ [Visibility] Skipping duplicate fetch: Filters unchanged');
      return;
    }

    // Mark these filters as being fetched
    lastFetchedFiltersRef.current = filterKey;

    // Reset all data to trigger skeleton loaders
    setApiData({});

    const fetchData = async () => {
      try {
        // Build query params from current filter state (synced with FilterContext)
        const queryParams = new URLSearchParams({
          platform: filters.platform || 'All',
          brand: filters.brand || 'All',
          location: filters.location || 'All',
          startDate: filters.startDate,
          endDate: filters.endDate
        }).toString();

        console.log('📡 [Visibility] Fetching data with filters:', filters.platform, filters.brand, filters.location, filters.startDate, filters.endDate);

        // Fetch each section independently - update state as each completes
        // This allows sections to render as soon as their data is available

        // Visibility Overview (SOS cards)
        fetch(`/api/visibility-analysis/visibility-overview?${queryParams}`)
          .then(res => res.json())
          .then(overview => {
            console.log('✅ [Visibility] Overview fetched');
            setApiData(prev => ({ ...prev, overview }));
          })
          .catch(err => console.error('❌ [Visibility] Overview fetch error:', err));

        // Platform KPI Matrix
        fetch(`/api/visibility-analysis/platform-kpi-matrix?${queryParams}`)
          .then(res => res.json())
          .then(matrix => {
            console.log('✅ [Visibility] Platform KPI Matrix fetched');
            setApiData(prev => ({ ...prev, matrix }));
          })
          .catch(err => console.error('❌ [Visibility] Platform KPI Matrix fetch error:', err));

        // Keywords at a Glance
        fetch(`/api/visibility-analysis/keywords-at-glance?${queryParams}`)
          .then(res => res.json())
          .then(keywords => {
            console.log('✅ [Visibility] Keywords at Glance fetched');
            setApiData(prev => ({ ...prev, keywords }));
          })
          .catch(err => console.error('❌ [Visibility] Keywords at Glance fetch error:', err));

        // Top Search Terms
        fetch(`/api/visibility-analysis/top-search-terms?${queryParams}`)
          .then(res => res.json())
          .then(searchTerms => {
            console.log('✅ [Visibility] Top Search Terms fetched');
            setApiData(prev => ({ ...prev, searchTerms }));
          })
          .catch(err => console.error('❌ [Visibility] Top Search Terms fetch error:', err));

      } catch (error) {
        console.error("[Visibility] Error setting up data fetch:", error);
      }
    };

    fetchData();
  }, [filters]);

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
        <VisiblityAnalysisData apiData={apiData} filters={filters} />
      </CommonContainer>
    </>
  );
}

