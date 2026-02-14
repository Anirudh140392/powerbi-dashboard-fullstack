import React, { useState, useContext, useEffect, useCallback } from "react";
import { Box, Typography } from "@mui/material";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import SalesSummaryCards from "./SalesSummaryCards";
import CityKpiTrendShowcase from "../../components/CityKpiTrendShowcase";
import SalesGainerDrainerWrapper from "./SalesGainerDrainerWrapper";
import ByCategoryKpiMatrix from "../../components/Sales/ByCategoryKpiMatrix";
import DrillDownSalesTable from "../../components/Sales/DrillDownSalesTable";
import SalesTrendsDrawer from "../../components/Sales/SalesTrendsDrawer";
import { FilterContext } from "../../utils/FilterContext";

// ---------------------------------------------------------------------------
// Error State Component - Shows when API fails with refresh button
// ---------------------------------------------------------------------------
const ErrorWithRefresh = ({ segmentName, errorMessage, onRetry, isRetrying = false }) => {
  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[200px] gap-4">
      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
        <svg className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-800 mb-1">Failed to load {segmentName}</h3>
        <p className="text-sm text-slate-500 mb-4">{errorMessage || "An error occurred while fetching data"}</p>
      </div>
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all
          ${isRetrying
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-slate-600 text-white hover:bg-slate-700 shadow-md hover:shadow-lg'
          }`}
      >
        {isRetrying ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-500"></div>
            <span>Retrying...</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </>
        )}
      </button>
    </div>
  );
};

export default function SalesMainPage() {
  const {
    platform,
    selectedBrand,
    selectedLocation,
    timeStart,
    timeEnd,
    compareStart,
    compareEnd,
    refreshFilters
  } = useContext(FilterContext);

  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Per-segment error tracking
  const [apiErrors, setApiErrors] = useState({});

  // Format filter helper
  const formatFilter = useCallback((val) => {
    if (!val || val === "All") return "All";
    if (Array.isArray(val)) return val.join(",");
    return val;
  }, []);

  // Build query params helper
  const buildQueryParams = useCallback(() => {
    return new URLSearchParams({
      platform: formatFilter(platform),
      brand: formatFilter(selectedBrand),
      location: formatFilter(selectedLocation),
      startDate: timeStart ? timeStart.format("YYYY-MM-DD") : "",
      endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : "",
      compareStartDate: compareStart ? compareStart.format("YYYY-MM-DD") : "",
      compareEndDate: compareEnd ? compareEnd.format("YYYY-MM-DD") : "",
    });
  }, [platform, selectedBrand, selectedLocation, timeStart, timeEnd, compareStart, compareEnd, formatFilter]);

  // Individual fetch functions for retry capability
  const fetchSalesOverview = useCallback(async (signal) => {
    try {
      setApiErrors(prev => ({ ...prev, overview: null }));
      setLoading(true);

      const queryParams = buildQueryParams();
      const response = await fetch(`/api/sales/overview?${queryParams}`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSummaryData(data);
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
      console.error("Error fetching sales overview:", error);
      setApiErrors(prev => ({ ...prev, overview: error.message }));
      return false;
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams]);

  // Retry handler for overview segment
  const retrySegment = useCallback(async (segmentKey) => {
    // First, refresh the filter options to ensure dropdowns show updated values
    if (refreshFilters) {
      refreshFilters();
    }

    switch (segmentKey) {
      case 'overview': return fetchSalesOverview();
      default: return false;
    }
  }, [refreshFilters, fetchSalesOverview]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    // Reset errors when filters change
    setApiErrors({});
    fetchSalesOverview(signal);

    return () => controller.abort();
  }, [platform, selectedBrand, selectedLocation, timeStart, timeEnd, compareStart, compareEnd, fetchSalesOverview]);

  return (
    <CommonContainer
      title="Sales"
      filters={{ platform }} // Still pass platform if CommonContainer/Sidebar needs it for highlighting
      onFiltersChange={() => { }} // Header now manages global context instead
    >
      {/* ---------------- Page Content ---------------- */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

        {/* Description / Header inside content if needed */}

        {/* ---------------- Main Page Container ---------------- */}
        <Box
          sx={{
            bgcolor: "background.paper",
            borderRadius: 4,
            boxShadow: 1,
            p: 3,
            display: "flex",
            flexDirection: "column",
            gap: 4
          }}
        >
          {/* ---------------- KPI Cards (with error handling) ---------------- */}
          {apiErrors.overview ? (
            <ErrorWithRefresh
              segmentName="Sales Overview"
              errorMessage={apiErrors.overview}
              onRetry={() => retrySegment('overview')}
            />
          ) : !loading && !summaryData ? (
            <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed #ccc', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">No sales data available for the selected filters.</Typography>
            </Box>
          ) : (
            <SalesSummaryCards
              data={summaryData}
              loading={loading}
              startDate={timeStart ? timeStart.format("YYYY-MM-DD") : ""}
              endDate={timeEnd ? timeEnd.format("YYYY-MM-DD") : ""}
            />
          )}

          {/* ---------------- Gainers / Drainers ---------------- */}
          <SalesGainerDrainerWrapper />

          {/* ---------------- Sales Matrix Table (By Category) ---------------- */}
          <ByCategoryKpiMatrix
            startDate={timeStart ? timeStart.format("YYYY-MM-DD") : ""}
            endDate={timeEnd ? timeEnd.format("YYYY-MM-DD") : ""}
            compareStartDate={compareStart ? compareStart.format("YYYY-MM-DD") : ""}
            compareEndDate={compareEnd ? compareEnd.format("YYYY-MM-DD") : ""}
            platform={platform}
            brand={selectedBrand}
            location={selectedLocation}
            onTrendClick={(metricInfo) => {
              setSelectedMetric(metricInfo.metric);
              setSelectedCategory(metricInfo.category);
              setTrendsOpen(true);
            }}
          />

          {/* ---------------- Drill Down Sales Table ---------------- */}
          <DrillDownSalesTable
            startDate={timeStart ? timeStart.format("YYYY-MM-DD") : ""}
            endDate={timeEnd ? timeEnd.format("YYYY-MM-DD") : ""}
            brand={selectedBrand}
          />
        </Box>
      </Box>
      {/* ---------------- Trends Drawer ---------------- */}
      <SalesTrendsDrawer
        open={trendsOpen}
        onClose={() => setTrendsOpen(false)}
        selectedColumn={selectedMetric}
        startDate={timeStart ? timeStart.format("YYYY-MM-DD") : ""}
        endDate={timeEnd ? timeEnd.format("YYYY-MM-DD") : ""}
        platform={platform}
        brand={selectedBrand}
        location={selectedLocation}
        category={selectedCategory}
      />
    </CommonContainer>
  );
}
