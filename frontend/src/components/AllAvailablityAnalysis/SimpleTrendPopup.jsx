// TrendPopup.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactECharts from "echarts-for-react";
import { X } from "lucide-react";

export default function SimpleTrendPopup({ open, onClose, row, trendKey }) {
  if (!open || !row) return null;

  const trendData = row[trendKey] || [];

  const chartOptions = {
    xAxis: { type: "category", data: trendData.map((_, i) => i + 1) },
    yAxis: { type: "value" },
    series: [
      { data: trendData, type: "line", smooth: true, areaStyle: {} }
    ],
    grid: { left: 25, right: 10, top: 20, bottom: 20 },
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-2xl shadow-xl p-5 w-[380px] relative"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
        >
          <button
            className="absolute top-3 right-3 text-gray-600 hover:text-black"
            onClick={onClose}
          >
            <X size={18} />
          </button>

          <h2 className="text-lg font-semibold mb-3">
            Trend for {row.kpi || row.label || row.name}
          </h2>

          <ReactECharts option={chartOptions} style={{ height: 220 }} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
