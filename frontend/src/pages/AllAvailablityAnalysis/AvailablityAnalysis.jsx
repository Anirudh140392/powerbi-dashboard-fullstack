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
    startDate: timeStart ? timeStart.format('YYYY-MM-DD') : dayjs().startOf('month').format('YYYY-MM-DD'),
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

        console.log('📡 Fetching availability data with filters:', filters.platform, filters.brand, filters.location);

        // Fetch each section independently - update state as each completes
        // This allows sections to render as soon as their data is available

        // Availability Overview (Stock Availability)
        fetch(`http://localhost:5000/api/availability-analysis/absolute-osa/availability-overview?${queryParams}`)
          .then(res => res.json())
          .then(overview => {
            console.log('✅ Overview fetched');
            setApiData(prev => ({ ...prev, overview }));
          })
          .catch(err => console.error('❌ Overview fetch error:', err));

        // Platform KPI Matrix (viewMode=Platform)
        fetch(`http://localhost:5000/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=Platform&${queryParams}`)
          .then(res => res.json())
          .then(platformKpi => {
            console.log('✅ Platform KPI Matrix fetched');
            setApiData(prev => ({ ...prev, platformKpi }));
          })
          .catch(err => console.error('❌ Platform KPI Matrix fetch error:', err));

        // Format KPI Matrix (viewMode=Format) - fetched in parallel
        fetch(`http://localhost:5000/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=Format&${queryParams}`)
          .then(res => res.json())
          .then(formatKpi => {
            console.log('✅ Format KPI Matrix fetched');
            setApiData(prev => ({ ...prev, formatKpi }));
          })
          .catch(err => console.error('❌ Format KPI Matrix fetch error:', err));

        // City KPI Matrix (viewMode=City) - fetched in parallel
        fetch(`http://localhost:5000/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=City&${queryParams}`)
          .then(res => res.json())
          .then(cityKpi => {
            console.log('✅ City KPI Matrix fetched');
            setApiData(prev => ({ ...prev, cityKpi }));
          })
          .catch(err => console.error('❌ City KPI Matrix fetch error:', err));

        // DOI (Days of Inventory)
        fetch(`http://localhost:5000/api/availability-analysis/absolute-osa/doi?${queryParams}`)
          .then(res => res.json())
          .then(doi => {
            console.log('✅ DOI fetched');
            setApiData(prev => ({ ...prev, doi }));
          })
          .catch(err => console.error('❌ DOI fetch error:', err));

        // Metro City Stock Availability
        fetch(`http://localhost:5000/api/availability-analysis/absolute-osa/metro-city-stock-availability?${queryParams}`)
          .then(res => res.json())
          .then(metroCity => {
            console.log('✅ Metro City fetched');
            setApiData(prev => ({ ...prev, metroCity }));
          })
          .catch(err => console.error('❌ Metro City fetch error:', err));

        // OSA Detail (keep for completeness)
        fetch(`http://localhost:5000/api/availability-analysis/absolute-osa/osa-percentage-detail?${queryParams}`)
          .then(res => res.json())
          .then(osaDetail => {
            console.log('✅ OSA Detail fetched');
            setApiData(prev => ({ ...prev, osaDetail }));
          })
          .catch(err => console.error('❌ OSA Detail fetch error:', err));

      } catch (error) {
        console.error("Error setting up availability data fetch:", error);
      }
    };

    fetchData();
  }, [filters]);

  return (
    <>
      <CommonContainer
        title="Availability Analysis"
        filters={filters}
        onFiltersChange={setFilters}
      >
        <AvailablityAnalysisData apiData={apiData} filters={filters} />
      </CommonContainer>
    </>
  );
}
