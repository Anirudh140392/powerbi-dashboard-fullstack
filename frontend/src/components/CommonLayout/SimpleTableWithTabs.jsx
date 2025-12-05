import React, { useState } from "react";
import TrendsCompetitionDrawer from "../AllAvailablityAnalysis/TrendsCompetitionDrawer";

export default function SimpleTableWithTabs({
  data = {},
  title = "Heatmap Table",
  subtitle = "",
  cellHeat = () => "",
  trendKey = "trend",
}) {
  const [openTrend, setOpenTrend] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [compMetaForDrawer, setCompMetaForDrawer] = useState(null);

  if (!data.columns || !data.rows) {
    return <p className="text-red-500 text-sm">Invalid data format</p>;
  }

  const { columns, rows } = data;

  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-[0_12px_40px_rgba(15,23,42,0.08)] p-5 flex flex-col gap-3">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          {title}
        </p>
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
                  <div className="flex flex-col items-center gap-2">
                    {/* Column Name */}
                    <div className="font-semibold text-slate-700">{col}</div>

                    {/* Trends Button (Skip KPI column) */}
                    {col !== "kpi" && (
                      <button
                        title={`View trends for ${col}`}
                        className="px-2 py-1 rounded text-xs font-medium bg-sky-100 text-sky-700 hover:bg-sky-200 transition"
                        onClick={() => {
                          const compMeta = {
                            context: { level: "Table", region: "All" },
                            periodToggle: {
                              primary: "MTD",
                              compare: "Previous",
                            },
                            columns: columns.map((c) => ({
                              id: c,
                              label: c,
                              type:
                                typeof rows[0]?.[c] === "number"
                                  ? "metric"
                                  : "text",
                            })),
                            brands: rows.map((r, idx) => {
                              const brandKey = columns[0];
                              const brandName = r[brandKey] ?? `row ${idx + 1}`;
                              const obj = { brand: brandName };

                              columns.forEach((c) => {
                                if (c === brandKey) return;
                                const v = r[c];
                                if (typeof v === "number")
                                  obj[c] = { value: v, delta: 0 };
                              });

                              return obj;
                            }),
                          };

                          setCompMetaForDrawer(compMeta);
                          setSelectedColumn(col);
                          setOpenTrend(true);
                        }}
                      >
                        ▸ Trends
                      </button>
                    )}
                  </div>
                </th>
              ))}
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
                        <span
                          className={`px-2 py-1 rounded ${cellHeat(value)}`}
                        >
                          {value}%
                        </span>
                      ) : (
                        <span className="text-slate-700 font-medium">
                          {value}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trend Drawer */}
      <TrendsCompetitionDrawer
        open={openTrend}
        onClose={() => setOpenTrend(false)}
        compMeta={compMetaForDrawer}
        selectedColumn={selectedColumn}
      />
    </div>
  );
}
