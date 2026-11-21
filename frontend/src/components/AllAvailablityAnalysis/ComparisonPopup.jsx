// ComparisonPopup.jsx — HEAVEN LIGHT MODE (COMPACT VERSION + INLINE CSS)
import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactECharts from "echarts-for-react";
import {
  X,
  BarChart2,
  Radar,
  LineChart,
  GitCompare,
  Users2,
} from "lucide-react";

export default function ComparisonPopup({ open, onClose, row }) {
  if (!open || !row) return null;

  const title = row.kpi;

  const compareKeys = Object.keys(row).filter(
    (k) => typeof row[k] === "number"
  );

  const compareValues = compareKeys.map((k) => row[k]);

  const tabs = ["Competition", "VS Mode"];
  const [activeTab, setActiveTab] = useState("Competition");

  const chartModes = ["Bar", "Radar", "Line"];
  const [mode, setMode] = useState("Bar");

  useEffect(() => {
    if (open) {
      setActiveTab("Competition");
      setMode("Bar");
      setVsA(compareKeys[0]);
      setVsB(compareKeys[1] || compareKeys[0]);
    }
  }, [open]);

  const sorted = [...compareKeys]
    .map((k) => ({ key: k, value: row[k] }))
    .sort((a, b) => b.value - a.value);

  const winner = sorted[0];
  const loser = sorted[sorted.length - 1];

  const [vsA, setVsA] = useState(compareKeys[0]);
  const [vsB, setVsB] = useState(compareKeys[1] || compareKeys[0]);

  const vsData = {
    diff: row[vsA] - row[vsB],
  };

  const defaultOptions = useMemo(() => {
    if (mode === "Bar") {
      return {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: compareKeys },
        yAxis: { type: "value" },
        series: [
          {
            type: "bar",
            data: compareValues,
            itemStyle: { color: "#6366f1", borderRadius: 6 },
          },
        ],
      };
    }

    if (mode === "Radar") {
      return {
        tooltip: {},
        radar: {
          indicator: compareKeys.map((k) => ({ name: k, max: 100 })),
        },
        series: [
          {
            type: "radar",
            data: [
              {
                value: compareValues,
                name: title,
                areaStyle: { opacity: 0.2, color: "#a78bfa" },
                lineStyle: { width: 2, color: "#7c3aed" },
              },
            ],
          },
        ],
      };
    }

    if (mode === "Line") {
      return {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: compareKeys },
        yAxis: { type: "value" },
        series: [
          {
            type: "line",
            data: compareValues,
            smooth: true,
            symbolSize: 8,
            lineStyle: { width: 3, color: "#10b981" },
            areaStyle: { opacity: 0.15, color: "#10b981" },
          },
        ],
      };
    }
  }, [mode, compareKeys]);

  const vsOptions = {
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: [vsA, vsB] },
    yAxis: { type: "value" },
    series: [
      {
        name: vsA,
        type: "bar",
        data: [row[vsA], null],
        itemStyle: { color: "#2563eb", borderRadius: 6 },
      },
      {
        name: vsB,
        type: "bar",
        data: [null, row[vsB]],
        itemStyle: { color: "#9333ea", borderRadius: 6 },
      },
    ],
  };

  return (
    <>
      <style>{`
        .popup-light {
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(18px);
          border-radius: 20px;
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        }

        .tab-btn {
          background: rgba(0,0,0,0.05);
          border: 1px solid rgba(0,0,0,0.1);
          transition: 0.2s;
        }

        .tab-btn-active {
          background: #6366f1;
          border-color: #6366f1;
          color: white !important;
        }

        .chart-box {
          background: white;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 18px;
          padding: 15px;
          box-shadow: 0 5px 15px rgba(0,0,0,0.06);
        }

        .insight-box {
          background: rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 12px 14px;
        }

        .select-light {
          background: white;
          border: 1px solid rgba(0,0,0,0.15);
          border-radius: 10px;
          padding: 6px 10px;
        }
      `}</style>

      <AnimatePresence>
        <motion.div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm flex justify-center items-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="popup-light w-[760px] p-6 relative max-h-[90vh] overflow-auto"
            initial={{ scale: 0.88, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.88, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-600 hover:text-black transition"
            >
              <X size={22} />
            </button>

            {/* Title */}
            <h3 className="text-xs tracking-[0.25em] text-gray-500 uppercase">
              Competition Studio
            </h3>
            <h1 className="text-xl font-semibold text-gray-800 mt-1">
              {title}
            </h1>

            {/* Tabs */}
            <div className="flex gap-3 mt-4">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-4 py-2 rounded-full text-sm flex items-center gap-2 tab-btn 
                    ${activeTab === t ? "tab-btn-active" : ""}
                  `}
                >
                  {t === "Competition" && <Users2 size={15} />}
                  {t === "VS Mode" && <GitCompare size={15} />}
                  {t}
                </button>
              ))}
            </div>

            {/* COMPETITION */}
            {activeTab === "Competition" && (
              <>
                <div className="insight-box text-sm text-gray-700 mt-3">
                  <strong>{winner.key}</strong> leads with{" "}
                  <strong>{winner.value}%</strong>. Lowest is{" "}
                  <strong>{loser.key}</strong> at{" "}
                  <strong>{loser.value}%</strong>.
                </div>

                {/* Chart mode */}
                <div className="flex gap-2 mt-3">
                  {chartModes.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`px-3 py-1 rounded-full border text-sm flex items-center gap-2 ${
                        mode === m
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-gray-200 text-gray-700 border-gray-300"
                      }`}
                    >
                      {m === "Bar" && <BarChart2 size={14} />}
                      {m === "Radar" && <Radar size={14} />}
                      {m === "Line" && <LineChart size={14} />}
                      {m}
                    </button>
                  ))}
                </div>

                {/* Chart */}
                <div className="chart-box mt-4">
                  <ReactECharts
                    option={defaultOptions}
                    style={{ height: 280 }}
                  />
                </div>
              </>
            )}

            {/* VS MODE — Modern Pivot Mode */}
            {activeTab === "VS Mode" && (
              <>
                {/* Add z-index here */}
                <div className="relative z-[200] mt-2 bg-white/70 border border-gray-200 rounded-xl p-1 shadow-sm flex items-center justify-between gap-4">
                  {/* LEFT Pivot Card */}
                  <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="text-xs text-gray-500 tracking-wide mb-2">
                      SELECT A
                    </div>
                    <select
                      value={vsA}
                      onChange={(e) => setVsA(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-indigo-300"
                    >
                      {compareKeys.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                    <div className="mt-3 text-center">
                      <div className="text-3xl font-semibold text-indigo-600">
                        {row[vsA]}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Current Value
                      </div>
                    </div>
                  </div>

                  {/* MIDDLE */}
                  <div className="flex flex-col items-center w-28">
                    <div className="text-xs text-gray-400 tracking-wide">
                      DIFFERENCE
                    </div>
                    <div
                      className={`mt-3 px-4 py-2 rounded-xl text-center text-sm font-bold shadow-sm border
            ${
              vsData.diff > 0
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
                    >
                      {vsData.diff > 0 ? "+" : ""}
                      {vsData.diff}%
                    </div>
                    <div className="mt-2 text-gray-400 text-xs">
                      {vsData.diff > 0 ? "A leading" : "B leading"}
                    </div>
                  </div>

                  {/* RIGHT Pivot Card */}
                  <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="text-xs text-gray-500 tracking-wide mb-2">
                      SELECT B
                    </div>
                    <select
                      value={vsB}
                      onChange={(e) => setVsB(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-purple-300"
                    >
                      {compareKeys.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                    <div className="mt-3 text-center">
                      <div className="text-3xl font-semibold text-purple-600">
                        {row[vsB]}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Current Value
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="chart-box mt-5 relative z-[150]">
                  <ReactECharts option={vsOptions} style={{ height: 250 }} />
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
