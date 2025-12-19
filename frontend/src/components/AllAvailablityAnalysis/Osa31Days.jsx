import React, { useMemo, useState, useEffect } from "react";

// Single-file React component (JSX)
// Light theme, paginated (default 5 rows/page), sortable columns.
// Removed the “# < 70” column as requested.

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function seededRandom(seed) {
  let t = seed % 2147483647;
  if (t <= 0) t += 2147483646;
  return function () {
    t = (t * 16807) % 2147483647;
    return (t - 1) / 2147483646;
  };
}

function makeRow(seed, name, sku, base) {
  const rnd = seededRandom(seed);
  const values = DAYS.map((d) => {
    const drift = (rnd() - 0.5) * 6;
    const weekdayWave = Math.sin(d / 2.8) * 2;
    const v = clamp(Math.round(base + drift + weekdayWave), 55, 96);
    return v;
  });

  const avg7 = Math.round(values.slice(-7).reduce((a, b) => a + b, 0) / 7);
  const avg31 = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  const status = avg7 >= 85 ? "Healthy" : avg7 >= 70 ? "Watch" : "Action";

  return { name, sku, values, avg7, avg31, status };
}

const SAMPLE_ROWS = [
  makeRow(85045, "KW CORNETTO - DOUBLE CHOC...", "85045", 80),
  makeRow(85047, "KW CORNETTO - BUTTERSCOTCH", "85047", 84),
  makeRow(85123, "KW Cassatta", "85123", 72),
  makeRow(85336, "KW PP Strawberry", "85336", 71),
  makeRow(85338, "KW Magnum Chocolate Truffle", "85338", 74),
  makeRow(85339, "KW Magnum Almond 90 ml", "85339", 81),
  makeRow(85350, "KW CDO - FRUIT & NUT", "85350", 72),
  makeRow(85411, "KW Magnum Brownie 90ml", "85411", 78),
  makeRow(85437, "COR DISC OREO 120ML", "85437", 83),
  makeRow(85438, "KW Sandwich Chocolate n Vanilla...", "85438", 77),
  makeRow(85555, "KW Oreo Tub 2x700ml", "85555", 89),
  makeRow(85570, "KW AAMRAS 70ml", "85570", 86),
];

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

export default function OsaDetailTableLight() {
  const [query, setQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [page, setPage] = useState(1);

  const [sortKey, setSortKey] = useState("avg7");
  const [sortDir, setSortDir] = useState("desc");

  const [visibleDays, setVisibleDays] = useState(31); // 7/14/31 toggle

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SAMPLE_ROWS;
    return SAMPLE_ROWS.filter(
      (r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
    );
  }, [query]);

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

  return (
    <div className="min-h-screen w-full bg-slate-50 p-6">
      <div className="mx-auto max-w-[1400px]">
        {/* Title + Legend */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xl font-semibold text-slate-900">OSA % Detail View</div>
            <div className="text-sm text-slate-500">
              Last {visibleDays} Days • Sortable • Paginated
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
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                ⌕
              </div>
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
            <div className="flex items-center gap-2 mr-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm ring-1 ring-slate-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Healthy
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm ring-1 ring-slate-200">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Watch
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm ring-1 ring-slate-200">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Action
              </span>
            </div>


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
                  {/* Sticky first column header */}
                  <th
                    className="sticky left-0 z-20 bg-white text-left px-4 py-3 text-xs font-semibold tracking-wider text-slate-500 border-b border-slate-200"
                    style={{ minWidth: 280 }}
                  >
                    PRODUCT / SKU
                  </th>

                  <th
                    className="px-3 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 border-b border-slate-200 cursor-pointer select-none"
                    onClick={() => headerSort("avg7")}
                  >
                    7D AVG <SortIcon dir={sortKey === "avg7" ? sortDir : undefined} />
                  </th>

                  <th
                    className="px-3 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 border-b border-slate-200 cursor-pointer select-none"
                    onClick={() => headerSort("avg31")}
                  >
                    AVG <SortIcon dir={sortKey === "avg31" ? sortDir : undefined} />
                  </th>

                  <th className="px-3 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 border-b border-slate-200">
                    STATUS
                  </th>

                  {dayCols.map((d) => (
                    <th
                      key={d}
                      className="px-2 py-3 text-center text-[11px] font-semibold tracking-wider text-slate-500 border-b border-slate-200 cursor-pointer select-none whitespace-nowrap"
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
                  const avgND =
                    visibleDays === 31
                      ? r.avg31
                      : Math.round(r.values.slice(-visibleDays).reduce((a, b) => a + b, 0) / visibleDays);

                  return (
                    <tr key={r.sku} className={"group " + st.rowAccent}>
                      <td
                        className="sticky left-0 z-10 bg-white px-4 py-3 border-b border-slate-100"
                        style={{ minWidth: 280 }}
                      >
                        <div>
                          <div className="font-medium text-slate-900 leading-5">{r.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{r.sku}</div>
                        </div>
                      </td>

                      <td className="px-3 py-3 border-b border-slate-100 text-sm text-slate-900">
                        {r.avg7}%
                      </td>

                      <td className="px-3 py-3 border-b border-slate-100 text-sm text-slate-900">
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
                            title={`${r.name} • Day ${d}: ${v}%`}
                          >
                            <span
                              className={
                                "inline-flex min-w-[42px] justify-center rounded-lg px-2 py-1 text-xs font-semibold text-slate-900 " +
                                cellTone(v)
                              }
                            >
                              {v}%
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={4 + dayCols.length} className="px-4 py-10 text-center text-slate-500">
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
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className={
                  "rounded-xl px-3 py-2 text-sm ring-1 ring-slate-200 bg-white transition " +
                  (safePage === 1 ? "text-slate-300" : "text-slate-700 hover:bg-slate-50")
                }
              >
                First
              </button>
              <button
                onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
                disabled={safePage === 1}
                className={
                  "rounded-xl px-3 py-2 text-sm ring-1 ring-slate-200 bg-white transition " +
                  (safePage === 1 ? "text-slate-300" : "text-slate-700 hover:bg-slate-50")
                }
              >
                Prev
              </button>

              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, safePage - 3), Math.min(totalPages, safePage + 2))
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={
                        "h-9 w-9 rounded-xl text-sm ring-1 ring-slate-200 transition " +
                        (p === safePage
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700 hover:bg-slate-50")
                      }
                    >
                      {p}
                    </button>
                  ))}
              </div>

              <button
                onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
                disabled={safePage === totalPages}
                className={
                  "rounded-xl px-3 py-2 text-sm ring-1 ring-slate-200 bg-white transition " +
                  (safePage === totalPages ? "text-slate-300" : "text-slate-700 hover:bg-slate-50")
                }
              >
                Next
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className={
                  "rounded-xl px-3 py-2 text-sm ring-1 ring-slate-200 bg-white transition " +
                  (safePage === totalPages ? "text-slate-300" : "text-slate-700 hover:bg-slate-50")
                }
              >
                Last
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Tip: Click any header (7D Avg / AVG / Day columns) to sort. Use “Last 7/14/31” to reduce column density.
        </div>
      </div>
    </div>
  );
}
