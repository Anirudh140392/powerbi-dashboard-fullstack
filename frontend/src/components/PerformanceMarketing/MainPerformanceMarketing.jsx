import React, { useState, useEffect, useRef } from "react";
import { Box, Grid, Card, Typography, Chip } from "@mui/material";
import * as Icons from "lucide-react";
import axiosInstance from "../../api/axiosInstance";

import performanceData from "../../utils/PerformanceMarketingData";
import HeatMapDrillTable from "./HeatMapDrillTable";
import InsightHorizontalKpis from "./InsightHorizontalKpis";
import DrilldownLatestTable from "./DrilldownLatestTable";
import KeywordAnalysisTable from "./KeywordAnalysisTable";
const kpiStats = [
  { label: "Impressions", value: "91", trend: "10.4%", trendColor: "bg-emerald-400", trendShape: "rounded-full" },
  { label: "Conversion", value: "1%", trend: "0.1%", trendColor: "bg-emerald-400", trendShape: "rounded-full" },
  { label: "Spend", value: "65", trend: "18.0%", trendColor: "bg-rose-500", trendShape: "rounded-full" },
  { label: "ROAS", value: "3", trend: "0.0", trendColor: "bg-rose-500", trendShape: "rounded-full" },
];

function KpiStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-6xl mx-auto">
      {kpiStats.map((stat, index) => (
        <div key={index} className="flex flex-col justify-start gap-4 rounded-3xl bg-white p-6 shadow-sm border border-slate-100 min-h-[180px]">
          <div className="text-sm font-bold text-slate-700">
            {stat.label}
          </div>

          <div className="text-6xl font-bold text-slate-900">
            {stat.value}
          </div>

          <div className="flex items-center gap-2 mt-auto">
            <div className={`h-3 w-3 ${stat.trendColor} rounded-full`}></div>
            <div className="text-sm font-medium text-slate-600">
              {stat.trend}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MainPerformanceMarketings() {
  const calledOnce = useRef(false);
  const [selectedInsight, setSelectedInsight] = useState("All Campaign Summary");
  useEffect(() => {
    if (calledOnce.current) return;
    calledOnce.current = true;

    const fetchPerformanceData = async () => {
      try {
        const response = await axiosInstance.get("/performance-marketing", {
          params: { platform: "Blinkit" }, // Default filter
        });
        console.log("Performance Marketing Data:", response.data);
      } catch (error) {
        console.error("Error fetching Performance Marketing data:", error);
      }
    };

    fetchPerformanceData()
  }, [])

  return (
    <Box>

      <Box sx={{ mt: 4 }}>
        <KpiStats />
      </Box>
      <Box sx={{ mt: 4 }}>
        <InsightHorizontalKpis
          selectedInsight={selectedInsight}
          setSelectedInsight={setSelectedInsight}
        />
      </Box>
      {/* NEW HEATMAP (Tailwind + Framer Motion) */}
      <Box sx={{ mt: 4 }}>
        <HeatMapDrillTable selectedInsight={selectedInsight} />
      </Box>
      <Box sx={{ mt: 4 }}>
        <KeywordAnalysisTable />
      </Box>
      <Box sx={{ mt: 4 }}>
        <DrilldownLatestTable />
      </Box>
    </Box>

  );
};
