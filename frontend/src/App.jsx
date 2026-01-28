import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// MUI Date Picker Providers
import { LocalizationProvider } from "@mui/x-date-pickers";
import SalesMainPage from "./pages/Sales/SalesMainPage";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import WatchTower from "./pages/ControlTower/WatchTower";
import CategoryRca from "./pages/Analytics/CategoryRca";
import VolumeCohort from "./pages/Analytics/PortfoliosAnalysis";
import PricePerPack from "./pages/Analytics/PricePerPack";
import PriceAnalysis from "./pages/Analytics/PriceAnalysis";
import MainPerformanceMarketings from "./pages/PerformanceMarketing/MainPerformanceMarketings";
import ContentScoreDashboards from "./pages/ContentScoreDashboard/ContentScoreDashboards";
import PricingAnalysis from "./pages/AllPricingAnalysis/PricingAnalysis";
import MarketShares from "./pages/AllMarketShares/MarketShares";
import AvailablityAnalysis from "./pages/AllAvailablityAnalysis/AvailablityAnalysis";
import VisibilityAnalysis from "./pages/AllVisibilityAnalysis/VisibilityAnalysis";
import PiyConcept from "./pages/PiyConcept/PiyConcept";
import { FilterProvider } from "./utils/FilterContext";
import InventeryConceptMains from "./pages/InventeryConcept/InventeryConceptMains";
import ScheduledReports from "./pages/Reports/ScheduledReports";

export default function App() {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <BrowserRouter>
        <FilterProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/watch-tower" replace />} />
            <Route path="/watch-tower" element={<WatchTower />} />
            <Route path="/category-rca" element={<CategoryRca />} />
            <Route path="/volume-cohort" element={<VolumeCohort />} />
            <Route path="/price-per-pack" element={<PricePerPack />} />
            <Route path="/price-analysis" element={<PriceAnalysis />} />
            <Route
              path="/performance-marketing"
              element={<MainPerformanceMarketings />}
            />
            <Route
              path="/availability-analysis"
              element={<AvailablityAnalysis />}
            />
            <Route
              path="/visibility-anlysis"
              element={<VisibilityAnalysis />}
            />
            <Route path="/content-score" element={<ContentScoreDashboards />} />
            <Route path="/pricing-analysis" element={<PricingAnalysis />} />
            <Route path="/market-share" element={<MarketShares />} />
            <Route path="/sales" element={<SalesMainPage />} />
            <Route path="/piy" element={<PiyConcept />} />
            <Route path="/inventory" element={<InventeryConceptMains />} />
            <Route path="/scheduled-reports" element={<ScheduledReports />} />
          </Routes>
        </FilterProvider>
      </BrowserRouter>
    </LocalizationProvider>
  );
}
