import React, { useState } from "react";
import { Box, Typography } from "@mui/material";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import SalesSummaryCards from "./SalesSummaryCards";
import CityKpiTrendShowcase from "../../components/CityKpiTrendShowcase";
import SalesGainerDrainerWrapper from "./SalesGainerDrainerWrapper";
import { SALES_MATRIX_DATA } from "./SalesData";
import RegionSalesTable from "../../components/Sales/RegionSalesTable";

export default function SalesMainPage() {
  const [filters, setFilters] = useState({
    platform: "Zepto",
  });

  return (
    <CommonContainer
      title="Sales"
      filters={filters}
      onFiltersChange={setFilters}
    >
      {/* ---------------- Page Content ---------------- */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

        {/* Description / Header inside content if needed */}
        <Box>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Sales performance, trends and contribution analysis and everything else
          </Typography>
        </Box>

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
          <SalesSummaryCards />

          {/* ---------------- Gainers / Drainers ---------------- */}
          <SalesGainerDrainerWrapper />

          {/* ---------------- Sales Matrix Table (By Format) ---------------- */}
          <CityKpiTrendShowcase
            title="By Format"
            data={SALES_MATRIX_DATA}
          />

          <RegionSalesTable />
        </Box>
      </Box>
    </CommonContainer>
  );
}
