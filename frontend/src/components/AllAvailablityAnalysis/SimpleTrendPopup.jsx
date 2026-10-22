// TrendStudio.jsx — FINAL PRO VERSION (Fully Dynamic)
import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactECharts from "echarts-for-react";
import { X, Download, RefreshCcw, Percent } from "lucide-react";

export default function SimpleTrendPopup({ open, onClose, row, trendKey }) {
  if (!open || !row) return null;

  // ---------------------------------------------
  // 1️⃣ CLEAN & NORMALIZE TREND DATA
  // ---------------------------------------------
  let raw = row[trendKey];

  if (!raw) raw = {};
  if (Array.isArray(raw)) raw = { Value: raw };

  // Format:
  // { Spend: [...], "M-1 Spend":[...], Conversion:[...] }
  const metrics = Object.fromEntries(
    Object.entries(raw).map(([k, arr]) => {
      if (Array.isArray(arr)) {
        return [k, arr.map((v) => Number(v) || 0)];
      }
      return [k, []];
    })
  );

  const metricTabs = Object.keys(metrics);
  const [activeMetric, setActiveMetric] = useState(metricTabs[0]);
  const [chartType, setChartType] = useState("Line");

  useEffect(() => {
    setActiveMetric(metricTabs[0]);
    setChartType("Line");
  }, [open, row]);

  const values = metrics[activeMetric] || [];

  // ---------------------------------------------
  // 2️⃣ PRO LABEL GENERATION
  // ---------------------------------------------
  let labels = [];

  const len = values.length;

  if (len <= 1) {
    labels = ["No Data"];
  }
  else if (len === 4) {
    labels = ["Q1", "Q2", "Q3", "Q4"]; // Quarter case
  }
  else if (len === 12) {
    labels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  }
  else if (len === 8) {
    labels = ["P1","P2","P3","P4","P5","P6","P7","P8"];
  }
  else {
    labels = Array.from({ length: len }, (_, i) => `P${i + 1}`);
  }

  // ---------------------------------------------
  // 3️⃣ ECHARTS OPTIONS (PRO LOOK)
  // ---------------------------------------------
  const chartOptions = useMemo(() => {
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 50, right: 30, top: 40, bottom: 40 },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: { fontSize: 12, color: "#6b7280" },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 12, color: "#6b7280" },
        splitLine: { lineStyle: { color: "#e5e7eb" } }
      },
      series: [
        {
          name: activeMetric,
          type: chartType.toLowerCase(),
          smooth: true,
          data: values,
          symbolSize: 8,
          lineStyle: { width: 3, color: "#2563eb" },
          itemStyle: { color: "#2563eb" },
          areaStyle: chartType === "Area" ? { opacity: 0.25, color: "#93c5fd" } : undefined
        }
      ]
    };
  }, [chartType, activeMetric, values, labels]);

  // ---------------------------------------------
  // RENDER UI
  // ---------------------------------------------
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-md flex justify-center items-center z-[999]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-3xl p-6 w-[950px] max-h-[90vh] shadow-xl relative overflow-auto border border-slate-200"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 hover:text-black"
          >
            <X size={22} />
          </button>

          {/* Title */}
          <h3 className="text-xs tracking-[0.25em] text-slate-400 mb-1">TREND STUDIO</h3>
          <h1 className="text-2xl font-semibold text-slate-800">{row.kpi}</h1>

          {/* Chart Type Tabs */}
          <div className="flex gap-2 my-4">
            {["Line", "Area", "Bar"].map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`px-4 py-1 rounded-full text-sm border ${
                  chartType === t
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-100 text-slate-700 border-slate-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Metric Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-3">
            {metricTabs.map((m) => (
              <button
                key={m}
                className={`px-4 py-1 rounded-full text-sm border whitespace-nowrap ${
                  activeMetric === m
                    ? "bg-blue-700 text-white border-blue-700"
                    : "bg-slate-100 text-slate-700 border-slate-300"
                }`}
                onClick={() => setActiveMetric(m)}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-slate-50 mt-4 rounded-2xl p-4 border">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-slate-600 font-medium">Trend</span>

              <div className="flex gap-3 text-slate-500">
                <Download size={18} />
                <RefreshCcw size={18} />
                <Percent size={18} />
              </div>
            </div>

            <ReactECharts option={chartOptions} style={{ height: 340 }} />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
