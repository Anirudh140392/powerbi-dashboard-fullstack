// TrendStudio.jsx
import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactECharts from "echarts-for-react";
import { X, Download, RefreshCcw, Percent } from "lucide-react";

export default function SimpleTrendPopup({ open, onClose, row, trendKey }) {
  if (!open || !row) return null;

  const metrics = row[trendKey] || {};

  const chartTypes = ["Line", "Area", "Bar"];
  const metricTabs = Object.keys(metrics);

  // ---------------------------------------------
  // 🔥 RESET state whenever popup opens OR row changes
  // ---------------------------------------------
  const [chartType, setChartType] = useState("Line");
  const [activeMetric, setActiveMetric] = useState(metricTabs[0] || "");

  useEffect(() => {
    if (open) {
      setChartType("Line");                  // reset chart type
      setActiveMetric(metricTabs[0] || "");  // reset metric tab
    }
  }, [open, row]);

  // ---------------------------------------------
  // 🔥 Chart builder (auto updates whenever filters change)
  // ---------------------------------------------
  const chartOptions = useMemo(() => {
    if (!metrics || !activeMetric) return {};

    return {
      tooltip: { trigger: "axis" },
      legend: {
        data: metricTabs,
        top: 0
      },
      xAxis: {
        type: "category",
        data: ["Q1", "Q2", "Q3", "Q4"],
        axisLabel: { color: "#6b7280" }
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#6b7280" }
      },
      series: metricTabs.map((metric) => ({
        name: metric,
        type: chartType.toLowerCase(),
        smooth: true,
        data: metrics[metric],
        symbolSize: 8,
        lineStyle: { width: 3 },
        areaStyle:
          chartType === "Area"
            ? { opacity: 0.25 }
            : undefined
      }))
    };
  }, [chartType, activeMetric, metrics]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-md flex justify-center items-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-3xl p-6 w-[900px] max-h-[90vh] shadow-xl relative overflow-hidden border"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 hover:text-black"
          >
            <X size={22} />
          </button>

          {/* Title */}
          <h3 className="text-xs tracking-[0.25em] text-slate-400">TREND STUDIO</h3>
          <h1 className="text-2xl font-semibold text-slate-800 mt-1">{row.kpi}</h1>
          <p className="text-sm text-slate-500 mb-4">
            Visualise Spend, Conversion, ROAS across quarters.
          </p>

          {/* Chart Type Tabs */}
          <div className="flex gap-2 mb-3">
            {chartTypes.map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`px-3 py-1 rounded-full text-sm border transition ${
                  chartType === t
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-100 text-slate-600 border-slate-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Metric Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {metricTabs.map((m) => (
              <button
                key={m}
                onClick={() => setActiveMetric(m)}
                className={`px-3 py-1 rounded-full text-sm border transition ${
                  activeMetric === m
                    ? "bg-blue-700 text-white border-blue-700"
                    : "bg-slate-100 text-slate-600 border-slate-300"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-slate-50 mt-4 rounded-2xl p-4 border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-600 font-medium">Value</span>

              <div className="flex gap-3 text-slate-500">
                <Download size={18} className="cursor-pointer hover:text-black" />
                <RefreshCcw size={18} className="cursor-pointer hover:text-black" />
                <Percent size={18} className="cursor-pointer hover:text-black" />
              </div>
            </div>

            <ReactECharts option={chartOptions} style={{ height: 320 }} />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
