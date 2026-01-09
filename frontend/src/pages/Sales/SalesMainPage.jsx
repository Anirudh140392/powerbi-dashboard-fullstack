import React, { useState, useContext, useEffect } from "react";
import { Box, Typography } from "@mui/material";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import SalesSummaryCards from "./SalesSummaryCards";
import CityKpiTrendShowcase from "../../components/CityKpiTrendShowcase";
import SalesGainerDrainerWrapper from "./SalesGainerDrainerWrapper";
import { SALES_MATRIX_DATA } from "./SalesData";
import DrillDownSalesTable from "../../components/Sales/DrillDownSalesTable";
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

          {/* ---------------- Sales Matrix Table (By Format) ---------------- */}
          <CityKpiTrendShowcase
            dynamicKey='sales_category_table'
            title="By Category"
            data={SALES_MATRIX_DATA}
            firstColLabel="CATEGORY"
          />

          {/* ---------------- Drill Down Sales Table ---------------- */}
          <DrillDownSalesTable />
        </Box>
      </Box>
    </CommonContainer>
  );
}
