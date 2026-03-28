import React, { useState, useEffect, useCallback, useContext, useMemo } from "react";
import { FilterContext } from "../../utils/FilterContext";
import { fetchSearchTermsPerformance, fetchSearchTermsLocations } from "../../api/visibilityService";

const sosColor = (val) => {
  if (val === 0) return "#94a3b8";
  if (val >= 80) return "#059669";
  if (val >= 50) return "#0284c7";
  return "#d97706";
};

const SOSValue = ({ value }) => (
  <span style={{
    fontSize: 15, fontWeight: 700, color: sosColor(value || 0),
    letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif",
  }}>
    {value == null || Number.isNaN(value) ? "—" : `${Number(value).toFixed(2)}%`}
  </span>
);

const LoadingSpinner = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "48px 0" }}>
    <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTop: "3px solid #3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const MiniSpinner = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "32px 0" }}>
    <div style={{ width: 24, height: 24, border: "2.5px solid #e2e8f0", borderTop: "2.5px solid #3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
  </div>
);

/** Modal to display SKU details for a keyword */
const SkuModal = ({ skus, title, onClose, loading }) => (
  <div
    style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(2px)" }}
    onClick={onClose}
  >
    <div
      style={{ background: "#fff", borderRadius: 16, padding: 28, minWidth: 580, maxWidth: 750, boxShadow: "0 24px 64px rgba(0,0,0,0.16)", maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>{title}</h3>
        <button onClick={onClose} style={{ border: "none", background: "#f1f5f9", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 18, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
      </div>

      {loading ? (
        <MiniSpinner />
      ) : skus.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", padding: "32px 0", fontFamily: "'Inter', sans-serif" }}>
          No SKUs available for this keyword
        </p>
      ) : (
        <div style={{ maxHeight: 360, overflowY: "auto", flex: 1 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
            <tr>
              <th rowSpan={2} style={{ textAlign: "left", padding: "10px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", borderBottom: "2px solid #e2e8f0", verticalAlign: "bottom", background: "#fff" }}>SKU</th>
              <th colSpan={2} style={{ textAlign: "center", padding: "8px 12px 4px", color: "#0f172a", fontWeight: 700, fontSize: 12, fontFamily: "'Inter', sans-serif", borderBottom: "1px solid #e2e8f0", letterSpacing: "-0.01em", background: "#fff" }}>Most Viewed Position</th>
            </tr>
            <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ textAlign: "center", padding: "6px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", background: "#fff" }}>Ad. <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 10, cursor: "help" }} title="Average ad (sponsored) position on the search results page">ⓘ</span></th>
              <th style={{ textAlign: "center", padding: "6px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", background: "#fff" }}>Organic <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 10, cursor: "help" }} title="Average organic position on the search results page">ⓘ</span></th>
            </tr>
          </thead>
          <tbody>
            {skus.map((sku, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fafbfc" : "#fff" }}>
                <td style={{ padding: "12px 12px" }}>
                  <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 13, fontFamily: "'Inter', sans-serif", wordBreak: "break-word" }}>{sku.name}</div>
                  {sku.volShare > 0 && (
                    <span style={{ background: "#eff6ff", color: "#3b82f6", fontSize: 10, fontWeight: 600, borderRadius: 4, padding: "2px 6px", marginTop: 3, display: "inline-block" }}>{sku.volShare}% VOL.</span>
                  )}
                </td>
                <td style={{ textAlign: "center", padding: "12px" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: sku.adPosition ? "#0f172a" : "#94a3b8", fontFamily: "'Inter', sans-serif" }}>
                    {sku.adPosition || "—"}
                  </span>
                </td>
                <td style={{ textAlign: "center", padding: "12px" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: sku.organicPosition ? "#0f172a" : "#94a3b8", fontFamily: "'Inter', sans-serif" }}>
                    {sku.organicPosition || "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  </div>
);

export default function SearchTermsPerformance() {
  const { platform: globalPlatform, selectedBrand, selectedLocation, timeStart, timeEnd, platforms: globalPlatforms } = useContext(FilterContext);

  const [activeView, setActiveView] = useState("keyword");
  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedRows, setExpandedRows] = useState({});
  const [locationData, setLocationData] = useState({});
  const [locationLoading, setLocationLoading] = useState({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [skuModal, setSkuModal] = useState(null);

  const validPlatforms = useMemo(() => (globalPlatforms || []).filter(p => p !== "All"), [globalPlatforms]);
  const [skuPlatform, setSkuPlatform] = useState("");

  useEffect(() => {
    if ((!skuPlatform || !validPlatforms.includes(skuPlatform)) && validPlatforms.length > 0) {
      setSkuPlatform(validPlatforms[0]);
    }
  }, [validPlatforms, skuPlatform]);

  const currentSkuPlatform = skuPlatform || validPlatforms[0] || "Blinkit";

  const filterParams = useMemo(() => ({
    viewMode: activeView === "keyword" ? "keyword" : "sku",
    platform: activeView === "sku" ? currentSkuPlatform : (globalPlatform || "All"),
    brand: selectedBrand || "All",
    location: selectedLocation || "All",
    startDate: timeStart,
    endDate: timeEnd,
    keywordTypeFilter: activeFilter,
  }), [activeView, globalPlatform, currentSkuPlatform, selectedBrand, selectedLocation, timeStart, timeEnd, activeFilter]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setExpandedRows({});
      setLocationData({});
      try {
        const data = await fetchSearchTermsPerformance(filterParams);
        if (!cancelled) { setItems(data.items || []); setPage(0); }
      } catch (err) {
        console.error("Error fetching search terms performance:", err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [filterParams]);

  const toggleRow = useCallback(async (itemName) => {
    setExpandedRows(prev => ({ ...prev, [itemName]: !prev[itemName] }));
    if (!locationData[itemName] && !locationLoading[itemName]) {
      setLocationLoading(prev => ({ ...prev, [itemName]: true }));
      try {
        const params = { platform: globalPlatform || "All", brand: selectedBrand || "All", startDate: timeStart, endDate: timeEnd };
        if (activeView === "keyword") params.keyword = itemName;
        else params.sku = itemName;
        const data = await fetchSearchTermsLocations(params);
        setLocationData(prev => ({ ...prev, [itemName]: data.locations || [] }));
      } catch (err) {
        console.error("Error fetching location drilldown:", err);
        setLocationData(prev => ({ ...prev, [itemName]: [] }));
      } finally {
        setLocationLoading(prev => ({ ...prev, [itemName]: false }));
      }
    }
  }, [locationData, locationLoading, activeView, globalPlatform, selectedBrand, timeStart, timeEnd]);

  const openSkuModal = useCallback(async (e, keywordName, isMySkus) => {
    e.stopPropagation();
    const title = isMySkus ? `My SKUs — "${keywordName}"` : `All SKUs — "${keywordName}"`;
    setSkuModal({ title, skus: [], loading: true });
    try {
      const data = await fetchSearchTermsPerformance({
        viewMode: "sku",
        platform: globalPlatform || "All",
        brand: isMySkus ? (selectedBrand || "All") : "All",
        location: selectedLocation || "All",
        startDate: timeStart, endDate: timeEnd,
        keywordTypeFilter: activeFilter,
        keyword: keywordName,
        ownBrandsOnly: isMySkus,
      });
      setSkuModal({ title, skus: data.items || [], loading: false });
    } catch (err) {
      console.error("Error fetching SKU data for keyword:", err);
      setSkuModal({ title, skus: [], loading: false });
    }
  }, [globalPlatform, selectedBrand, selectedLocation, timeStart, timeEnd, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage));
  const paginatedItems = items.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const GRID = activeView === "keyword"
    ? "minmax(260px,1fr) 150px 130px 130px 130px"
    : "minmax(260px,1fr) 130px 130px 130px";

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#f1f5f9", minHeight: 200, padding: "28px 32px", borderRadius: 24, margin: "24px 0", border: "1px solid #e2e8f0" }}>
      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .drill-btn:hover { background: #0f172a !important; border-color: #0f172a !important; }
        .drill-btn:hover svg path { stroke: #fff !important; }
        .sku-btn:hover { opacity: 0.8; }
      `}</style>

      {/* Page title */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>Top Search Terms</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Share of search performance by keyword</p>
      </div>

      {/* Controls Row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "inline-flex", background: "#e2e8f0", borderRadius: 10, padding: 3, gap: 2 }}>
          {[{ id: "keyword", label: "My Keywords" }, { id: "sku", label: "SKU" }].map(v => (
            <button key={v.id} onClick={() => setActiveView(v.id)} style={{
              padding: "7px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif", transition: "all 0.18s",
              background: activeView === v.id ? "#0f172a" : "transparent",
              color: activeView === v.id ? "#fff" : "#64748b",
              boxShadow: activeView === v.id ? "0 1px 4px rgba(0,0,0,0.18)" : "none",
            }}>{v.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          {activeView === "keyword" ? (
            ["All", "Branded", "Competitor", "Generic"].map(f => (
              <button key={f} onClick={() => setActiveFilter(f)} style={{
                padding: "6px 16px", borderRadius: 20, cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", transition: "all 0.18s",
                border: activeFilter === f ? "2px solid #0f172a" : "2px solid #cbd5e1",
                background: activeFilter === f ? "#0f172a" : "#fff",
                color: activeFilter === f ? "#fff" : "#475569",
              }}>{f}</button>
            ))
          ) : (
            <select
              value={currentSkuPlatform}
              onChange={(e) => setSkuPlatform(e.target.value)}
              style={{
                padding: "6px 16px", borderRadius: 20, cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif",
                border: "2px solid #cbd5e1", background: "#fff", color: "#475569", outline: "none", appearance: "auto"
              }}
            >
              {validPlatforms.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>

        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "13px 24px", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", gap: 8, alignItems: "end" }}>
          {[
            { label: activeView === "keyword" ? "Keywords" : "SKUs", sub: null },
            ...(activeView === "keyword" ? [{ label: "Leading Brand", sub: "by Overall SOS" }] : []),
            { label: "Overall SOS", sub: null },
            { label: "Organic SOS", sub: null },
            { label: "Paid SOS", sub: null },
          ].map((h, i) => (
            <div key={i} style={{ textAlign: i === 0 ? "left" : "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h.label}</div>
              {h.sub && <div style={{ fontSize: 10, fontWeight: 500, color: "#94a3b8", marginTop: 1 }}>{h.sub}</div>}
            </div>
          ))}
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>No data available for the selected filters</div>
        ) : (
          <>
            {paginatedItems.map((row, rowIdx) => (
              <div key={row.name + rowIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {/* Main Row */}
                <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "16px 24px", alignItems: "center", gap: 8, background: expandedRows[row.name] ? "#fafbff" : "#fff", transition: "background 0.15s", cursor: "pointer" }}
                  onClick={() => toggleRow(row.name)}>

                  {/* Name Cell */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      <button className="drill-btn" onClick={(e) => { e.stopPropagation(); toggleRow(row.name); }} title="Show location breakdown"
                        style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${expandedRows[row.name] ? "#0f172a" : "#cbd5e1"}`, background: expandedRows[row.name] ? "#0f172a" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, transition: "all 0.18s" }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: expandedRows[row.name] ? "rotate(90deg)" : "none", transition: "transform 0.18s" }}>
                          <path d="M3 2L7 5L3 8" stroke={expandedRows[row.name] ? "#fff" : "#475569"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      </button>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.01em", lineHeight: 1.3, wordBreak: "break-word" }}>{row.name}</span>
                      {row.volShare > 0 && activeView === "keyword" && (
                        <span style={{ background: "#eff6ff", color: "#3b82f6", fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "2px 7px", letterSpacing: "0.02em", flexShrink: 0 }}>{row.volShare}% VOL.</span>
                      )}
                    </div>

                    {/* My SKUs / All SKUs buttons — only in keyword mode */}
                    {activeView === "keyword" && (
                      <div style={{ display: "flex", gap: 6, paddingLeft: 30 }}>
                        <button className="sku-btn" onClick={(e) => openSkuModal(e, row.name, true)}
                          style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "opacity 0.15s" }}>My SKUs</button>
                        <button className="sku-btn" onClick={(e) => openSkuModal(e, row.name, false)}
                          style={{ background: "#f0f9ff", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "opacity 0.15s" }}>All SKUs</button>
                      </div>
                    )}
                  </div>

                  {/* Leading Brand — keyword mode only */}
                  {activeView === "keyword" && (
                    <div style={{ textAlign: "center" }}>
                      <span style={{ background: "#f1f5f9", color: "#334155", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", display: "inline-block", textTransform: "uppercase" }}>{row.leadingBrand}</span>
                    </div>
                  )}

                  <div style={{ textAlign: "center" }}><SOSValue value={row.overallSOS} /></div>
                  <div style={{ textAlign: "center" }}><SOSValue value={row.organicSOS} /></div>
                  <div style={{ textAlign: "center" }}><SOSValue value={row.paidSOS} /></div>
                </div>

                {/* Drilldown Panel — Location Breakdown */}
                {expandedRows[row.name] && (
                  <div style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", animation: "slideDown 0.18s ease" }}>
                    <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "9px 24px 7px", gap: 8, borderBottom: "1px solid #e2e8f0" }}>
                      <div style={{ paddingLeft: 30, fontSize: 10, fontWeight: 700, color: "#3b82f6", letterSpacing: "0.08em", textTransform: "uppercase" }}>📍 Location Breakdown</div>
                      {activeView === "keyword" && <div />}
                      {["Overall SOS", "Organic SOS", "Paid SOS"].map((h) => (
                        <div key={h} style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>{h}</div>
                      ))}
                    </div>

                    {locationLoading[row.name] ? (
                      <div style={{ padding: "20px 0" }}><MiniSpinner /></div>
                    ) : (locationData[row.name] || []).length === 0 ? (
                      <div style={{ padding: "16px 24px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No location data available</div>
                    ) : (
                      (locationData[row.name] || []).map((loc, li) => (
                        <div key={li} style={{ display: "grid", gridTemplateColumns: GRID, padding: "11px 24px", alignItems: "center", gap: 8, borderBottom: li < (locationData[row.name] || []).length - 1 ? "1px solid #e2e8f0" : "none", background: li % 2 === 0 ? "#f8fafc" : "#f1f5f9" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 30 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6", display: "inline-block", flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{loc.city}</span>
                          </div>
                          {activeView === "keyword" && <div />}
                          <div style={{ textAlign: "center" }}><SOSValue value={loc.overallSOS} /></div>
                          <div style={{ textAlign: "center" }}><SOSValue value={loc.organicSOS} /></div>
                          <div style={{ textAlign: "center" }}><SOSValue value={loc.paidSOS} /></div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Pagination */}
        {!loading && items.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 24px", borderTop: "1px solid #e2e8f0", background: "#fafafa" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                style={{ border: "1px solid #e2e8f0", background: page === 0 ? "#f8fafc" : "#fff", borderRadius: 7, padding: "6px 14px", cursor: page === 0 ? "default" : "pointer", fontSize: 12, color: page === 0 ? "#94a3b8" : "#475569", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>← Prev</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                style={{ border: "1px solid #e2e8f0", background: page >= totalPages - 1 ? "#f8fafc" : "#fff", borderRadius: 7, padding: "6px 14px", cursor: page >= totalPages - 1 ? "default" : "pointer", fontSize: 12, color: page >= totalPages - 1 ? "#94a3b8" : "#475569", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>Next →</button>
              <span style={{ fontSize: 12, color: "#64748b", padding: "0 6px" }}>Page {page + 1} / {totalPages}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Rows/page</span>
              <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                style={{ border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 10px", fontSize: 12, color: "#334155", background: "#fff", fontFamily: "'Inter', sans-serif", cursor: "pointer" }}>
                <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* SKU Modal */}
      {skuModal && <SkuModal skus={skuModal.skus} title={skuModal.title} loading={skuModal.loading} onClose={() => setSkuModal(null)} />}
    </div>
  );
}
