import React, { useState } from "react";
import { TrendingUp, BarChart2 } from "lucide-react";
import SimpleTrendPopup from "../AllAvailablityAnalysis/SimpleTrendPopup";
import ComparisonPopup from "../AllAvailablityAnalysis/ComparisonPopup";

export default function SimpleTableWithTabs({
  data = {},
  title = "Heatmap Table",
  subtitle = "",
  cellHeat = () => "",
  trendKey = "trend",
}) {
  const [openTrend, setOpenTrend] = useState(false);
  const [openCompare, setOpenCompare] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  if (!data.columns || !data.rows) {
    return <p className="text-red-500 text-sm">Invalid data format</p>;
  }

  const { columns, rows } = data;

  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-[0_12px_40px_rgba(15,23,42,0.08)] p-5 flex flex-col gap-3">

      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="min-w-full text-[12px] table-fixed">

          {/* Header */}
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 font-semibold text-slate-600 whitespace-nowrap text-center"
                >
                  {col}
                </th>
              ))}

              {/* Trend+Compare */}
              <th className="px-3 py-2 font-semibold text-slate-600 text-center w-[80px]">
                Actions
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-t border-slate-100">

                {columns.map((col) => {
                  const value = row[col];
                  const isNumeric =
                    typeof value === "number" ||
                    (!isNaN(Number(value)) && value !== "");

                  return (
                    <td key={col} className="px-3 py-2 text-center">
                      {isNumeric ? (
                        <span className={`px-2 py-1 rounded ${cellHeat(value)}`}>
                          {value}%
                        </span>
                      ) : (
                        <span className="text-slate-700 font-medium">{value}</span>
                      )}
                    </td>
                  );
                })}

                {/* Trend + Compare Buttons */}
                <td className="px-3 py-2 text-center w-[80px]">
                  <div className="flex items-center justify-center gap-3">

                    {/* Trend */}
                    <button
                      className="text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        setSelectedRow(row);
                        setOpenTrend(true);
                      }}
                    >
                      <TrendingUp size={18} />
                    </button>

                    {/* Compare */}
                    <button
                      className="text-purple-600 hover:text-purple-800"
                      onClick={() => {
                        setSelectedRow(row);
                        setOpenCompare(true);
                      }}
                    >
                      <BarChart2 size={18} />
                    </button>

                  </div>
                </td>

              </tr>
            ))}
          </tbody>

        </table>
      </div>

      {/* Trend Popup */}
      <SimpleTrendPopup
        open={openTrend}
        row={selectedRow}
        trendKey={trendKey}
        onClose={() => setOpenTrend(false)}
      />

      {/* Comparison Popup */}
      <ComparisonPopup
        open={openCompare}
        row={selectedRow}
        onClose={() => setOpenCompare(false)}
      />

    </div>
  );
}
