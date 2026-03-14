import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
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
import { AuthProvider, useAuth } from "./utils/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/Login/LoginPage";
import InventeryConceptMains from "./pages/InventeryConcept/InventeryConceptMains";
import ScheduledReports from "./pages/Reports/ScheduledReports";
import GeoIntelligenceMap from "./pages/GeoAnalysis/GeoIntelligenceMap.jsx";
import Insights from "./pages/Insights/Insights";

function AppContent() {
  const { isLoggedIn, user } = useAuth();

  // 🔥 NUCLEAR RESET: The 'key' attribute forces React to destroy and 
  // remount the entire FilterProvider (and all its children) whenever 
  // the user logs in or out. This ensures NO stale data leaks.
  const sessionKey = isLoggedIn ? (user?.email || "authenticated") : "guest";

  return (
    <FilterProvider key={sessionKey}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={<Navigate to="/watch-tower" replace />} />

          <Route path="/watch-tower" element={
            <ProtectedRoute>
              <WatchTower />
            </ProtectedRoute>
          } />

          <Route path="/insights" element={
            <ProtectedRoute>
              <Insights />
            </ProtectedRoute>
          } />

          <Route path="/category-rca" element={
            <ProtectedRoute>
              <CategoryRca />
            </ProtectedRoute>
          } />

          <Route path="/volume-cohort" element={
            <ProtectedRoute>
              <VolumeCohort />
            </ProtectedRoute>
          } />

          <Route path="/price-per-pack" element={
            <ProtectedRoute>
              <PricePerPack />
            </ProtectedRoute>
          } />

          <Route path="/price-analysis" element={
            <ProtectedRoute>
              <PriceAnalysis />
            </ProtectedRoute>
          } />

          <Route path="/performance-marketing" element={
            <ProtectedRoute>
              <MainPerformanceMarketings />
            </ProtectedRoute>
          } />

          <Route path="/availability-analysis" element={
            <ProtectedRoute>
              <AvailablityAnalysis />
            </ProtectedRoute>
          } />

          <Route path="/visibility-anlysis" element={
            <ProtectedRoute>
              <VisibilityAnalysis />
            </ProtectedRoute>
          } />

          <Route path="/content-score" element={
            <ProtectedRoute>
              <ContentScoreDashboards />
            </ProtectedRoute>
          } />

          <Route path="/pricing-analysis" element={
            <ProtectedRoute>
              <PricingAnalysis />
            </ProtectedRoute>
          } />

          <Route path="/market-share" element={
            <ProtectedRoute>
              <MarketShares />
            </ProtectedRoute>
          } />

          <Route path="/sales" element={
            <ProtectedRoute>
              <SalesMainPage />
            </ProtectedRoute>
          } />

          <Route path="/piy" element={
            <ProtectedRoute>
              <PiyConcept />
            </ProtectedRoute>
          } />

          <Route path="/inventory" element={
            <ProtectedRoute>
              <InventeryConceptMains />
            </ProtectedRoute>
          } />

          <Route path="/scheduled-reports" element={
            <ProtectedRoute>
              <ScheduledReports />
            </ProtectedRoute>
          } />

          <Route path="/geo-intelligence" element={
            <ProtectedRoute>
              <GeoIntelligenceMap />
            </ProtectedRoute>
          } />
        </Routes>
      </HashRouter>
    </FilterProvider>
  );
}

export default function App() {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LocalizationProvider>
  );
}
