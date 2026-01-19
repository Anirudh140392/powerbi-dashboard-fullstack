import React, { useState } from "react";
import { Box, Typography } from "@mui/material";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import SalesSummaryCards from "./SalesSummaryCards";
import CityKpiTrendShowcase from "../../components/CityKpiTrendShowcase";
import SalesGainerDrainerWrapper from "./SalesGainerDrainerWrapper";
import { SALES_MATRIX_DATA } from "./SalesData";
import RegionSalesTable from "../../components/Sales/RegionSalesTable";

import DrillDownSalesTable from "../../components/Sales/DrillDownSalesTable";

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
