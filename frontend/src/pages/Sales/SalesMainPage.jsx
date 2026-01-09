import React, { useState, useContext, useEffect } from "react";
import { Box, Typography } from "@mui/material";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import SalesSummaryCards from "./SalesSummaryCards";
import CityKpiTrendShowcase from "../../components/CityKpiTrendShowcase";
import SalesGainerDrainerWrapper from "./SalesGainerDrainerWrapper";
import ByCategoryKpiMatrix from "../../components/Sales/ByCategoryKpiMatrix";
import DrillDownSalesTable from "../../components/Sales/DrillDownSalesTable";
import SalesTrendsDrawer from "../../components/Sales/SalesTrendsDrawer";
import { FilterContext } from "../../utils/FilterContext";

export default function SalesMainPage() {
  const {
    platform,
    selectedBrand,
    selectedLocation,
    timeStart,
    timeEnd,
    compareStart,
    compareEnd
  } = useContext(FilterContext);

  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchSalesOverview = async () => {
      try {
        setLoading(true);
        const queryParams = new URLSearchParams({
          platform: platform || "All",
          brand: selectedBrand || "All",
          location: selectedLocation || "All",
          startDate: timeStart ? timeStart.format("YYYY-MM-DD") : "",
          endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : "",
          compareStartDate: compareStart ? compareStart.format("YYYY-MM-DD") : "",
          compareEndDate: compareEnd ? compareEnd.format("YYYY-MM-DD") : "",
        });

        const response = await fetch(`/api/sales/overview?${queryParams}`, { signal });
        if (!response.ok) throw new Error("Failed to fetch sales overview");
        const data = await response.json();
        setSummaryData(data);
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error("Error fetching sales overview:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSalesOverview();

    return () => controller.abort();
  }, [platform, selectedBrand, selectedLocation, timeStart, timeEnd, compareStart, compareEnd]);

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
          {/* ---------------- KPI Cards ---------------- */}
          {!loading && !summaryData ? (
            <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed #ccc', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">No sales data available for the selected filters.</Typography>
            </Box>
          ) : (
            <SalesSummaryCards data={summaryData} loading={loading} />
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
            onTrendClick={(metric) => {
              setSelectedMetric(metric);
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
      />
    </CommonContainer>
  );
}
