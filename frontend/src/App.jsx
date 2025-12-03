import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// MUI Date Picker Providers
import { LocalizationProvider } from "@mui/x-date-pickers";
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

export default function App() {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <BrowserRouter>
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
          <Route path="/piy" element={<PiyConcept />} />
        </Routes>
      </BrowserRouter>
    </LocalizationProvider>
  );
}
