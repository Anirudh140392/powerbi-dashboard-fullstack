import React, { useState, useEffect, useCallback, useContext, useMemo } from "react";
import { FilterContext } from "../../utils/FilterContext";
import { fetchSearchTermsPerformance, fetchSearchTermsLocations, fetchSearchTermsBrandBreakdown } from "../../api/visibilityService";
import { motion, AnimatePresence } from "framer-motion";
import { Download } from "lucide-react";

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

const BrandSOSBreakdown = ({ brands, loading }) => {
  if (loading) return <div style={{ padding: "20px 0" }}><MiniSpinner /></div>;
  if (!brands || brands.length === 0) return <div style={{ padding: 16, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>No data available</div>;

  return (
    <div style={{ padding: "16px 20px", minWidth: 260 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>Brand SOS Breakdown</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {brands.map((b, i) => (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>{b.brand}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: b.overallSOS >= 50 ? "#059669" : "#3b82f6", fontFamily: "'DM Mono', monospace" }}>{b.overallSOS.toFixed(1)}%</span>
            </div>
            <div style={{ width: "100%", height: 6, background: "#f1f5f9", borderRadius: 10, overflow: "hidden" }}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${b.overallSOS}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ height: "100%", background: b.overallSOS >= 50 ? "#10b981" : "linear-gradient(90deg, #3b82f6, #60a5fa)", borderRadius: 10 }} 
              />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #f1f5f9", fontSize: 10, color: "#94a3b8", fontStyle: "italic" }}>
        Market share breakdown for this keyword
      </div>
    </div>
  );
};

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
  const {
    platform: globalPlatform,
    selectedBrand,
    selectedLocation,
    selectedCategory,
    selectedKeyword,
    selectedKeywordType,
    selectedChannel,
    timeStart,
    timeEnd,
    platforms: globalPlatforms
  } = useContext(FilterContext);

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
  const [hoveredKeyword, setHoveredKeyword] = useState(null);
  const [bbData, setBbData] = useState({});
  const [bbLoading, setBbLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Removed local skuPlatform state - now using global platform filter
  const currentSkuPlatform = globalPlatform || "All";

  const filterParams = useMemo(() => ({
    viewMode: activeView === "keyword" ? "keyword" : "sku",
    platform: activeView === "sku" ? currentSkuPlatform : (globalPlatform || "All"),
    brand: selectedBrand || "All",
    location: selectedLocation || "All",
    category: selectedCategory || "All",
    keyword: selectedKeyword || "All",
    keywordTypeFilter: activeFilter,
    keywordType: selectedKeywordType || "All",
    channel: selectedChannel || "All",
    ownBrandsOnly: activeView === "sku",
    startDate: timeStart,
    endDate: timeEnd,
  }), [activeView, globalPlatform, currentSkuPlatform, selectedBrand, selectedLocation, selectedCategory, selectedKeyword, selectedKeywordType, selectedChannel, activeFilter, timeStart, timeEnd]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setExpandedRows({});
      setLocationData({});
      setSummaryExpanded(false);
      try {
        const data = await fetchSearchTermsPerformance(filterParams);
        if (!cancelled) {
          setItems(data.items || []);
          setSummaryData(data.summary || null);
          setPage(0);
        }
      } catch (err) {
        console.error("Error fetching search terms performance:", err);
        if (!cancelled) { setItems([]); setSummaryData(null); }
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
        const params = { 
          platform: globalPlatform || "All", 
          brand: selectedBrand || "All", 
          channel: selectedChannel || "All",
          startDate: timeStart, 
          endDate: timeEnd 
        };
        if (activeView === "keyword") params.keyword = itemName;
        else params.sku = itemName;
        const data = await fetchSearchTermsLocations(params);
        const filteredLocs = (data.locations || []).filter(l => l.city && l.city.toLowerCase() !== 'other' && l.city.toLowerCase() !== 'others');
        setLocationData(prev => ({ ...prev, [itemName]: filteredLocs }));
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
        category: selectedCategory || "All",
        startDate: timeStart, endDate: timeEnd,
        keywordTypeFilter: activeFilter,
        keywordType: selectedKeywordType || "All",
        channel: selectedChannel || "All",
        keyword: keywordName,
        ownBrandsOnly: isMySkus,
      });
      setSkuModal({ title, skus: data.items || [], loading: false });
    } catch (err) {
      console.error("Error fetching SKU data for keyword:", err);
      setSkuModal({ title, skus: [], loading: false });
    }
  }, [globalPlatform, selectedBrand, selectedLocation, selectedCategory, selectedKeywordType, activeFilter, timeStart, timeEnd]);

  const shouldShowDrilldown = useMemo(() => {
    if (!globalPlatform || globalPlatform === "All") return true;
    const plats = typeof globalPlatform === "string" 
      ? globalPlatform.split(",").map(p => p.trim().toLowerCase()) 
      : (Array.isArray(globalPlatform) ? globalPlatform.map(p => typeof p === 'string' ? p.toLowerCase() : String(p).toLowerCase()) : []);
      
    if (plats.length === 0) return true;
    
    const isEcomOnly = plats.every(p => 
      p.includes("ecom") || p.includes("e-com") || p.includes("ecommerce") || p === "amazon" || p === "flipkart" || p === "myntra" || p === "nykaa"
    );
    
    return !isEcomOnly;
  }, [globalPlatform]);

  const downloadCSV = () => {
    if (!items || items.length === 0) return;
    
    const isKeyword = activeView === "keyword";
    const headers = isKeyword 
      ? ["Keyword", "Leading Brand", "Overall SOS", "Organic SOS", "Paid SOS"]
      : ["SKU", "Overall SOS", "Organic SOS", "Paid SOS"];
      
    const rows = items.map(item => {
      const row = [
        `"${(item.name || "").replace(/"/g, '""')}"`,
        ...(isKeyword ? [`"${(item.leadingBrand || "").replace(/"/g, '""')}"`] : []),
        `"${(item.overallSOS || 0).toFixed(2)}%"`,
        `"${(item.organicSOS || 0).toFixed(2)}%"`,
        `"${(item.paidSOS || 0).toFixed(2)}%"`
      ];
      return row;
    });

    const csvContent = headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Top_Search_Terms_${activeView}_${activeFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
          {[{ id: "keyword", label: "My Keywords" }, { id: "sku", label: "My SKU" }].map(v => (
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
          {activeView === "keyword" && (
            ["All", "Branded", "Competitor", "Generic"].map(f => (
              <button key={f} onClick={() => setActiveFilter(f)} style={{
                padding: "6px 16px", borderRadius: 20, cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", transition: "all 0.18s",
                border: activeFilter === f ? "2px solid #0f172a" : "2px solid #cbd5e1",
                background: activeFilter === f ? "#0f172a" : "#fff",
                color: activeFilter === f ? "#fff" : "#475569",
              }}>{f}</button>
            ))
          )}
          <button 
            onClick={downloadCSV}
            title="Download CSV"
            style={{
              padding: "6px 12px", borderRadius: 10, cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", transition: "all 0.18s",
              border: "1.5px solid #cbd5e1", background: "#fff", color: "#475569",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              marginLeft: 8
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#94a3b8"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
          >
            <Download size={16} />
            <span>Export</span>
          </button>
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
            {/* ── Summary Aggregate Row ── */}
            {summaryData && activeView === "keyword" && (
              <div style={{ borderBottom: "2px solid #c7d2fe" }}>
                {/* Main Summary Row */}
                <div
                  style={{
                    display: "grid", gridTemplateColumns: GRID, padding: "16px 24px", alignItems: "center", gap: 8,
                    background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                    cursor: "pointer", transition: "background 0.15s",
                  }}
                  onClick={() => setSummaryExpanded(prev => !prev)}
                >
                  {/* Name Cell */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSummaryExpanded(prev => !prev); }}
                        title="Show location breakdown"
                        style={{
                          width: 22, height: 22, borderRadius: 6,
                          border: `1.5px solid ${summaryExpanded ? "#4f46e5" : "#818cf8"}`,
                          background: summaryExpanded ? "#4f46e5" : "#fff",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, padding: 0, transition: "all 0.18s",
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: summaryExpanded ? "rotate(90deg)" : "none", transition: "transform 0.18s" }}>
                          <path d="M3 2L7 5L3 8" stroke={summaryExpanded ? "#fff" : "#4f46e5"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 14, fontWeight: 800, color: "#312e81", letterSpacing: "-0.01em",
                          fontFamily: "'Inter', sans-serif",
                        }}>
                          {activeFilter === "All" ? "All Keywords" : `${activeFilter} Keywords`}
                        </span>
                        <span style={{
                          background: "#4f46e5", color: "#fff", fontSize: 9, fontWeight: 700,
                          borderRadius: 4, padding: "2px 8px", letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}>
                          AGGREGATE
                        </span>
                      </div>
                      {(() => {
                        const summaryVolPercent = items.reduce((sum, item) => sum + (item.volShare || 0), 0);
                        return (summaryData.totalKeywords > 0 || summaryVolPercent > 0 || (summaryData.totalSearchVolume || 0) > 0) ? (
                          <div style={{ display: "flex", gap: 6, paddingLeft: 30, marginTop: 4 }}>
                            {summaryData.totalKeywords > 0 && (
                              <span style={{
                                background: "#eff6ff", color: "#3b82f6", fontSize: 10, fontWeight: 700,
                                borderRadius: 4, padding: "2px 8px", letterSpacing: "0.02em",
                              }}>
                                {summaryData.totalKeywords.toLocaleString()} Keywords
                              </span>
                            )}
                            {summaryVolPercent > 0 && (
                              <span style={{
                                background: "#fff7ed", color: "#ea580c", fontSize: 10, fontWeight: 700,
                                borderRadius: 4, padding: "2px 8px", letterSpacing: "0.02em",
                                border: "1px solid #ffedd5"
                              }}>
                                {summaryVolPercent.toFixed(2)}% Total Vol. Share
                              </span>
                            )}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* Leading Brand */}
                  <div style={{ textAlign: "center" }}>
                    <span style={{
                      background: "#e0e7ff", color: "#3730a3", borderRadius: 6, padding: "5px 12px",
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", display: "inline-block",
                      textTransform: "uppercase",
                    }}>
                      {summaryData.leadingBrand}
                    </span>
                  </div>

                  {/* Overall SOS */}
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: sosColor(summaryData.overallSOS), letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
                      {summaryData.overallSOS != null ? `${Number(summaryData.overallSOS).toFixed(2)}%` : "—"}
                    </span>
                  </div>

                  {/* Organic SOS */}
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: sosColor(summaryData.organicSOS), letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
                      {summaryData.organicSOS != null ? `${Number(summaryData.organicSOS).toFixed(2)}%` : "—"}
                    </span>
                  </div>

                  {/* Paid SOS */}
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: sosColor(summaryData.paidSOS), letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
                      {summaryData.paidSOS != null ? `${Number(summaryData.paidSOS).toFixed(2)}%` : "—"}
                    </span>
                  </div>
                </div>

                {/* Summary Drilldown — Location Breakdown */}
                {summaryExpanded && (
                  <div style={{ background: "#f0f0ff", borderTop: "1px solid #c7d2fe", animation: "slideDown 0.18s ease" }}>
                    <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "9px 24px 7px", gap: 8, borderBottom: "1px solid #c7d2fe" }}>
                      <div style={{ paddingLeft: 30, fontSize: 10, fontWeight: 700, color: "#4f46e5", letterSpacing: "0.08em", textTransform: "uppercase" }}>📍 Location Breakdown</div>
                      <div />
                      {["Overall SOS", "Organic SOS", "Paid SOS"].map((h) => (
                        <div key={h} style={{ fontSize: 10, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>{h}</div>
                      ))}
                    </div>

                    {(!summaryData.locations || summaryData.locations.length === 0) ? (
                      <div style={{ padding: "16px 24px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No location data available</div>
                    ) : (
                      summaryData.locations.map((loc, li) => (
                        <div key={li} style={{
                          display: "grid", gridTemplateColumns: GRID, padding: "11px 24px", alignItems: "center", gap: 8,
                          borderBottom: li < summaryData.locations.length - 1 ? "1px solid #ddd6fe" : "none",
                          background: li % 2 === 0 ? "#f5f3ff" : "#ede9fe",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 30 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", display: "inline-block", flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{loc.city}</span>
                          </div>
                          <div />
                          <div style={{ textAlign: "center" }}><SOSValue value={loc.overallSOS} /></div>
                          <div style={{ textAlign: "center" }}><SOSValue value={loc.organicSOS} /></div>
                          <div style={{ textAlign: "center" }}><SOSValue value={loc.paidSOS} /></div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {paginatedItems.map((row, rowIdx) => (
              <div key={row.name + rowIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {/* Main Row */}
                <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "16px 24px", alignItems: "center", gap: 8, background: expandedRows[row.name] ? "#fafbff" : "#fff", transition: "background 0.15s", cursor: shouldShowDrilldown ? "pointer" : "default" }}
                  onClick={() => shouldShowDrilldown && toggleRow(row.name)}>

                  {/* Name Cell */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      {shouldShowDrilldown ? (
                        <button className="drill-btn" onClick={(e) => { e.stopPropagation(); toggleRow(row.name); }} title="Show location breakdown"
                          style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${expandedRows[row.name] ? "#0f172a" : "#cbd5e1"}`, background: expandedRows[row.name] ? "#0f172a" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, transition: "all 0.18s" }}>
                          <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: expandedRows[row.name] ? "rotate(90deg)" : "none", transition: "transform 0.18s" }}>
                            <path d="M3 2L7 5L3 8" stroke={expandedRows[row.name] ? "#fff" : "#475569"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          </svg>
                        </button>
                      ) : (
                        <div style={{ width: 22, height: 22, flexShrink: 0 }} />
                      )}
                      {/* SKU Image Thumbnail — only in SKU view */}
                      {activeView === "sku" && (
                        row.imageUrl ? (
                          <img
                            src={row.imageUrl}
                            alt={row.name}
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }}
                            style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #e2e8f0", background: "#f8fafc" }}
                          />
                        ) : null
                      )}
                      {activeView === "sku" && !row.imageUrl && (
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f1f5f9", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                          </svg>
                        </div>
                      )}
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
                    <div style={{ textAlign: "center", position: "relative" }}>
                      <span 
                        onMouseEnter={() => handleBrandHover(row.name)}
                        onMouseLeave={() => setHoveredKeyword(null)}
                        style={{ background: "#f1f5f9", color: "#334155", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", display: "inline-block", textTransform: "uppercase", cursor: "help", transition: "all 0.2s" }}>
                        {row.leadingBrand}
                      </span>

                      <AnimatePresence>
                        {hoveredKeyword === row.name && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            style={{
                              position: "absolute",
                              bottom: "100%",
                              left: "50%",
                              transform: "translateX(-50%)",
                              marginBottom: 12,
                              background: "#fff",
                              borderRadius: 16,
                              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0,0,0,0.05)",
                              zIndex: 100,
                              overflow: "hidden",
                              pointerEvents: "none"
                            }}
                          >
                            <BrandSOSBreakdown brands={bbData[row.name]} loading={bbLoading} />
                            <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 12, height: 12, background: "#fff", boxShadow: "2px 2px 2px rgba(0,0,0,0.02)" }} />
                          </motion.div>
                        )}
                      </AnimatePresence>
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
