import React, { useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import {
  Calendar,
  Plus,
  ChevronDown
} from "lucide-react";

// -------------------------------
// JSON DATA (You can replace with API)
// -------------------------------
const TREND_DATA = {
  metrics: [
    { id: "Osa", label: "Offtake", color: "#E74C3C" },
    { id: "ecs", label: "Est. Cat Share", color: "#8E44AD" },
    { id: "osa", label: "Wt. OSA%", color: "#27AE60" },
    { id: "dsl", label: "DS Listing%", color: "#2980B9" },
    { id: "Sos", label: "Overall Sos", color: "#E91E63" },
    { id: "adSos", label: "Ad. Sos", color: "#7CB342" },
    { id: "discount", label: "Wt. Discount%", color: "#795548" },
    { id: "ppu", label: "Wt. PPU (x100)", color: "#6E0000" }
  ],

  // Mock daily trend for 1 month
  trends: {
    dsl: Array.from({ length: 30 }, (_, i) =>
      i < 20 ? 100 : i < 23 ? 98 : i < 25 ? 92 : i < 26 ? 85 : 95
    ),
  },

  dates: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`)
};

// ---------------------------------------
// MAIN COMPONENT
// ---------------------------------------
export default function CompareSKUs() {
  const [activeRange, setActiveRange] = useState("1M");
  const [timeStep, setTimeStep] = useState("Daily");
  const [activeMetric, setActiveMetric] = useState("dsl");

  const metricObj = TREND_DATA.metrics.find(m => m.id === activeMetric);

  // ---------------- CHART CONFIG ----------------
  const chartOptions = useMemo(() => ({
    grid: { top: 40, bottom: 40, left: 50, right: 20 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: TREND_DATA.dates,
      axisLabel: { color: "#777" }
    },
    yAxis: {
      type: "value",
      min: 20,
      max: 120,
      axisLabel: { formatter: "{value}%", color: "#777" }
    },
    series: [
      {
        data: TREND_DATA.trends[activeMetric],
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 3, color: metricObj.color },
        itemStyle: { color: metricObj.color },
      }
    ]
  }), [activeMetric]);

  // ---------------------------------------
  // JSX UI
  // ---------------------------------------
  return (
    <div className="p-6 w-full font-sans">
      {/* HEADER */}
      <div className="flex items-center gap-2 text-2xl font-semibold">
        <span>Compare SKUs</span>
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">MRP</span>
      </div>

      {/* RANGE + TIMESTEP */}
      <div className="flex items-center gap-3 mt-5">

        <button className="border px-4 py-2 rounded flex items-center gap-2">
          <Calendar size={16} /> Custom
        </button>

        {["1M", "3M", "6M", "1Y"].map(r => (
          <button
            key={r}
            onClick={() => setActiveRange(r)}
            className={`px-4 py-2 rounded border ${
              activeRange === r ? "bg-blue-600 text-white" : "bg-white"
            }`}
          >
            {r}
          </button>
        ))}

        <div className="ml-4 flex items-center gap-2 border px-4 py-2 rounded">
          <span>Time Step:</span>
          <select
            className="font-semibold"
            value={timeStep}
            onChange={(e) => setTimeStep(e.target.value)}
          >
            <option>Daily</option>
            <option>Weekly</option>
            <option>Monthly</option>
          </select>
        </div>
      </div>

      {/* ADD SKU BUTTON */}
      <button className="mt-5 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded">
        <Plus size={18} /> Add SKUs
      </button>

      {/* METRIC BUTTONS */}
      <div className="flex gap-4 mt-5 flex-wrap">
        {TREND_DATA.metrics.map(m => (
          <button
            key={m.id}
            onClick={() => setActiveMetric(m.id)}
            className={`px-4 py-2 rounded-full flex items-center gap-2 border ${
              activeMetric === m.id ? "bg-blue-100 border-blue-500" : "bg-white"
            }`}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ background: m.color }}
            ></span>
            {m.label}
          </button>
        ))}
      </div>

      {/* CHART */}
      <div className="mt-6 bg-white rounded-lg shadow p-4">
        <ReactECharts option={chartOptions} style={{ height: 350 }} />
      </div>
    </div>
  );
}
