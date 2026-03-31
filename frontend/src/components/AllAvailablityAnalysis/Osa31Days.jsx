import React, { useMemo, useState, useEffect } from "react";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function statusStyles(status) {
  if (status === "Healthy")
    return {
      dot: "bg-emerald-500",
      chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      rowAccent: "border-l-4 border-emerald-200",
    };
  if (status === "Watch")
    return {
      dot: "bg-amber-500",
      chip: "bg-amber-50 text-amber-800 ring-amber-200",
      rowAccent: "border-l-4 border-amber-200",
    };
  return {
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    rowAccent: "border-l-4 border-rose-200",
  };
}

function cellTone(v) {
  if (v >= 85) return "bg-emerald-50";
  if (v >= 70) return "bg-amber-50";
  return "bg-rose-50";
}

function SortIcon({ dir }) {
  return (
    <span className="inline-flex items-center ml-1 text-slate-400">
      {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}
    </span>
  );
}

export default function OsaDetailTableLight({ apiData, loading }) {
  const [query, setQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [page, setPage] = useState(1);

  const [sortKey, setSortKey] = useState("avgSelected");
  const [sortDir, setSortDir] = useState("desc");

  const [visibleDays, setVisibleDays] = useState(31); // 7/14/31 toggle

  const filtered = useMemo(() => {
    let baseRows = [];
    if (apiData?.osaDetail && apiData.osaDetail.length > 0) {
      baseRows = apiData.osaDetail.map(row => ({
        name: row.name || row.productName || "Unknown Product",
        sku: row.sku || "N/A",
        values: row.values || DAYS.map(d => row[String(d)] || 0),
        avg7: row.avg7 || 0,
        avg31: row.avg31 || 0,
        avgSelected: row.avgSelected,
        status: row.status || "Healthy"
      }));
    }

    const q = query.trim().toLowerCase();
    if (!q) return baseRows;
    return baseRows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
    );
  }, [query, apiData]);

  const sorted = useMemo(() => {
    const dirMul = sortDir === "asc" ? 1 : -1;

    const isDayKey = typeof sortKey === "string" && sortKey.startsWith("day_");
    const dayIndex = isDayKey ? parseInt(sortKey.replace("day_", ""), 10) : null;

    const getVal = (r) => {
      if (dayIndex != null) {
        const idx = clamp(dayIndex - 1, 0, 30);
        return r.values[idx];
      }
      return r[sortKey];
    };

    return [...filtered].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);

      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb)) * dirMul;
      }
      return (va - vb) * dirMul;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const safePage = clamp(page, 1, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return sorted.slice(start, end);
  }, [sorted, safePage, rowsPerPage]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  const headerSort = (key) => {
    setPage(1);
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("desc");
      return key;
    });
  };

  const dayCols = DAYS.slice(0, visibleDays);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading OSA Detail...</div>;

  return (
    <div className="min-h-screen w-full bg-slate-50 p-6">
      <div className="mx-auto max-w-[1400px]">
        {/* Title + Legend */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xl font-semibold text-slate-900">OSA % Detail View</div>
            <div className="text-sm text-slate-500">
              Selected Period • Sortable • Paginated
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => {
                  setPage(1);
                  setQuery(e.target.value);
                }}
                placeholder="Search SKU or name…"
                className="w-full sm:w-[320px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Rows</label>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setPage(1);
                  setRowsPerPage(parseInt(e.target.value, 10));
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-800">{pageRows.length}</span> of{" "}
              <span className="font-medium text-slate-800">{sorted.length}</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-auto">
            <table className="min-w-[1200px] w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th
                    className="sticky left-0 z-20 bg-white text-left px-4 py-3 text-xs font-semibold tracking-wider text-slate-500 border-b border-slate-200"
                    style={{ minWidth: 280 }}
                  >
                    PRODUCT / SKU
                  </th>

                  <th
                    className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900 cursor-pointer select-none"
                    onClick={() => headerSort("avgSelected")}
                  >
                    AVG <SortIcon dir={sortKey === "avgSelected" || sortKey === "avg31" ? sortDir : undefined} />
                  </th>

                  <th className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900">
                    STATUS
                  </th>

                  {dayCols.map((d) => (
                    <th
                      key={d}
                      className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900 whitespace-nowrap cursor-pointer select-none"
                      onClick={() => headerSort(`day_${d}`)}
                    >
                      DAY {d}
                      <SortIcon dir={sortKey === `day_${d}` ? sortDir : undefined} />
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {pageRows.map((r) => {
                  const st = statusStyles(r.status);
                  const avgND = r.avgSelected !== undefined
                    ? r.avgSelected
                    : (visibleDays === 31
                      ? r.avg31
                      : Math.round(r.values.slice(-visibleDays).reduce((a, b) => a + b, 0) / visibleDays));

                  return (
                    <tr key={r.sku} className={"group " + st.rowAccent}>
                      <td
                        className="sticky left-0 z-10 bg-white px-4 py-3 border-b border-slate-100"
                        style={{ minWidth: 280 }}
                      >
                        <div>
                          <div className="font-bold text-slate-900 leading-5 text-sm">{r.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{r.sku}</div>
                        </div>
                      </td>

                      <td className="px-3 py-3 border-b border-slate-100 text-sm text-slate-900 text-center">
                        {avgND}%
                      </td>

                      <td className="px-3 py-3 border-b border-slate-100">
                        <span
                          className={
                            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 " +
                            st.chip
                          }
                        >
                          <span className={"h-2 w-2 rounded-full " + st.dot} />
                          {r.status}
                        </span>
                      </td>

                      {dayCols.map((d) => {
                        const v = r.values[d - 1];
                        return (
                          <td
                            key={d}
                            className="px-2 py-3 border-b border-slate-100 text-center"
                          >
                            <span
                              className={
                                "inline-flex min-w-[42px] justify-center rounded-lg px-2 py-1 text-xs font-semibold text-slate-900 " +
                                cellTone(v)
                              }
                            >
                              {v !== undefined ? `${v}%` : '-'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={3 + dayCols.length} className="px-4 py-10 text-center text-slate-500">
                      No rows found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              Page <span className="font-medium text-slate-900">{safePage}</span> of{" "}
              <span className="font-medium text-slate-900">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
                disabled={safePage === 1}
                className="rounded-xl px-3 py-2 text-sm ring-1 ring-slate-200 bg-white"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
                disabled={safePage === totalPages}
                className="rounded-xl px-3 py-2 text-sm ring-1 ring-slate-200 bg-white"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
