import React, { useState, useEffect, useCallback, useContext, useMemo } from "react";
import { FilterContext } from "../../utils/FilterContext";
import { fetchSearchTermsPerformance, fetchSearchTermsLocations, fetchSearchTermsBrandBreakdown, fetchVisibilityFilterOptions } from "../../api/visibilityService";
import { useAuth } from "../../utils/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Search, X, Filter, ChevronRight, TrendingUp, ExternalLink, SlidersHorizontal, Check, PieChart, Calendar } from "lucide-react";
import VisibilityTrendsCompetitionDrawer from "./VisibilityTrendsCompetitionDrawer";

const ALL_KPIS = [
  { id: "searchVolume", label: "Search Volume", group: "Volume", description: "Search query volume for keyword", keywordOnly: true },
  { id: "leadingBrand", label: "Leading Brand", group: "Brand", description: "Top ranking brand by Overall SOS", keywordOnly: true, hideIfSugar: true },
  { id: "overallSOS", label: "Overall SOS", group: "SOS", description: "Share of Search across all positions" },
  { id: "overallSOV", label: "Overall SOV", group: "SOV", description: "Share of Voice based on weighted impressions", keywordOnly: true },
  { id: "organicSOS", label: "Organic SOS", group: "SOS", description: "Organic (non-sponsored) Share of Search" },
  { id: "organicSOV", label: "Organic SOV", group: "SOV", description: "Organic Share of Voice based on weighted impressions", keywordOnly: true },
  { id: "paidSOS", label: "Paid SOS", group: "SOS", description: "Paid (sponsored) Share of Search" },
  { id: "adSOV", label: "Ad SOV", group: "SOV", description: "Ad (sponsored) Share of Voice based on weighted impressions", keywordOnly: true },
];

const DEFAULT_VISIBLE_KPIS = {
  searchVolume: true,
  leadingBrand: true,
  overallSOS: true,
  overallSOV: true,
  organicSOS: true,
  organicSOV: true,
  paidSOS: true,
  adSOV: true,
};


const sosColor = (val) => {
  if (val === 0) return "#94a3b8";
  if (val >= 80) return "#059669";
  if (val >= 50) return "#0284c7";
  return "#d97706";
};

const SOSValue = ({ value, fontSize = 15 }) => (
  <span style={{
    fontSize, fontWeight: 700, color: sosColor(value || 0),
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

const DeltaDisplay = ({ value }) => {
  if (value === 0 || value == null) return <span style={{ color: "#6b7280", fontSize: 10, marginLeft: 4 }}>(0.0%)</span>;
  const isPositive = value > 0;
  const color = isPositive ? "#10b981" : "#ef4444";
  const sign = isPositive ? "+" : "";
  return (
    <span style={{ color, fontSize: 10, marginLeft: 4, fontWeight: 600 }}>
      ({sign}{value.toFixed(1)}%)
    </span>
  );
};

const BrandSOSBreakdown = ({ brands, loading }) => {
  if (loading) return <div style={{ padding: "20px 0", background: "#111827", borderRadius: 12 }}><MiniSpinner /></div>;
  if (!brands || brands.length === 0) return <div style={{ padding: 16, color: "#94a3b8", fontSize: 13, textAlign: "center", background: "#111827", borderRadius: 12 }}>No data available</div>;

  const top5 = brands.slice(0, 5);

  return (
    <div style={{ background: "#111827", borderRadius: 12, overflow: "hidden", minWidth: 480 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
        <thead>
          <tr style={{ background: "#1f2937" }}>
            <th style={{ textAlign: "left", padding: "12px 16px", color: "#9ca3af", fontWeight: 500, fontSize: 11, fontStyle: "italic" }}>Brand</th>
            <th style={{ textAlign: "center", padding: "12px 16px", color: "#9ca3af", fontWeight: 500, fontSize: 11, fontStyle: "italic" }}>Ad. SOV</th>
            <th style={{ textAlign: "center", padding: "12px 16px", color: "#9ca3af", fontWeight: 500, fontSize: 11, fontStyle: "italic" }}>Organic SOV</th>
            <th style={{ textAlign: "center", padding: "12px 16px", color: "#9ca3af", fontWeight: 500, fontSize: 11, fontStyle: "italic" }}>Overall SOV</th>
          </tr>
        </thead>
        <tbody>
          {top5.map((b, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #374151" }}>
              <td style={{ padding: "12px 16px", fontWeight: 600, color: i === 0 ? "#60a5fa" : "#fff" }}>{b.brand}</td>
              <td style={{ padding: "12px 16px", textAlign: "center", color: "#fff", fontWeight: 500 }}>
                {b.paidSOS.toFixed(1)}% <DeltaDisplay value={b.paidDelta} />
              </td>
              <td style={{ padding: "12px 16px", textAlign: "center", color: "#fff", fontWeight: 500 }}>
                {b.organicSOS.toFixed(1)}% <DeltaDisplay value={b.organicDelta} />
              </td>
              <td style={{ padding: "12px 16px", textAlign: "center", color: "#fff", fontWeight: 600 }}>
                {b.overallSOS.toFixed(1)}% <DeltaDisplay value={b.overallDelta} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DrilldownModal = ({ 
  items, title, onClose, loading, type = "sku", 
  onToggleLocations, expandedLocs, locsLoading,
  keywordTypeFilter, onKeywordTypeFilterChange 
}) => {
  const downloadModalCSV = () => {
    if (!items || items.length === 0) return;
    const isKeyword = type === "keyword";
    const headers = isKeyword
      ? ["Keyword", "Ad Position", "Organic Position", "Top 5 Days", "Top 10 Days", "Top 20 Days"]
      : [type === "sku" ? "SKU" : "Keyword", "Ad Position", "Organic Position", "Overall SOS", "Organic SOS", "Paid SOS"];
    
    const rows = items.map(it => isKeyword ? [
      `"${(it.name || "").replace(/"/g, '""')}"`,
      it.adPosition || "",
      it.organicPosition || "",
      it.top5Days || 0,
      it.top10Days || 0,
      it.top20Days || 0,
    ] : [
      `"${(it.name || "").replace(/"/g, '""')}"`,
      it.adPosition || "",
      it.organicPosition || "",
      it.overallSOS != null ? it.overallSOS.toFixed(2) : "",
      it.organicSOS != null ? it.organicSOS.toFixed(2) : "",
      it.paidSOS != null ? it.paidSOS.toFixed(2) : "",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${(title || "drilldown").replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 20, boxShadow: "0 24px 64px rgba(0,0,0,0.2)", width: 840, maxWidth: "96%", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid #e2e8f0" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter', sans-serif" }}>
              {type === "sku" ? "SKU Analysis" : (type === "brandKeywords" ? "Brand Keyword Analysis" : "Keyword Analysis")}
            </h3>
            <span style={{ background: "#eef2ff", color: "#4f46e5", fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 8px", border: "1px solid #c7d2fe" }}>
              {type === "brandKeywords" 
                ? (title?.split('—')?.[1]?.trim() || title || "").replace(/"/g, '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') 
                : (title?.split('—')?.[1]?.trim() || title || "")}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button 
              onClick={downloadModalCSV} 
              title="Download CSV"
              style={{ border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center", padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, gap: 5, transition: "background 0.2s" }}
              onMouseOver={e => e.currentTarget.style.background = "#f1f5f9"}
              onMouseOut={e => e.currentTarget.style.background = "#fff"}
            >
              <Download size={13} />
              <span>Export</span>
            </button>
            <button 
              onClick={onClose} 
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", padding: 4, borderRadius: 6, transition: "background 0.2s" }}
              onMouseOver={e => e.currentTarget.style.background = "#e2e8f0"}
              onMouseOut={e => e.currentTarget.style.background = "transparent"}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ padding: "0 24px 24px 24px", display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* Filters for Brand Keyword View */}
          {type === "brandKeywords" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 20px" }}>
              <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2, border: "1px solid #e2e8f0" }}>
                {["All", "Branded", "Competition", "Generic"].map(v => (
                  <button 
                    key={v} 
                    onClick={() => onKeywordTypeFilterChange?.(v)} 
                    style={{
                      padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", transition: "all 0.18s",
                      background: (keywordTypeFilter || "All") === v ? "#fff" : "transparent",
                      color: (keywordTypeFilter || "All") === v ? "#0f172a" : "#64748b",
                      boxShadow: (keywordTypeFilter || "All") === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 20 }}></div>
          )}

        {loading ? (
          <MiniSpinner />
        ) : items.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", padding: "32px 0", fontFamily: "'Inter', sans-serif" }}>
            No {type === "sku" ? "SKUs" : "keywords"} available for this {type === "sku" ? "keyword" : "SKU"}
          </p>
        ) : (
          <div style={{ maxHeight: 520, overflowY: "auto", flex: 1, borderRadius: 8, border: "1px solid #f1f5f9" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
              <tr>
                <th rowSpan={2} style={{ textAlign: "left", padding: "12px 16px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", borderBottom: "2px solid #e2e8f0", verticalAlign: "bottom", background: "#f8fafc" }}>
                  {type === "sku" ? "SKU" : "Keyword"}
                </th>
                <th colSpan={2} style={{ textAlign: "center", padding: "8px 12px 4px", color: "#0f172a", fontWeight: 700, fontSize: 12, fontFamily: "'Inter', sans-serif", borderBottom: "1px solid #e2e8f0", letterSpacing: "-0.01em", background: "#f8fafc" }}>
                  Avg. Position
                </th>
                {type === "keyword" ? (
                  <th colSpan={3} style={{ textAlign: "center", padding: "8px 12px 4px", color: "#0f172a", fontWeight: 700, fontSize: 12, fontFamily: "'Inter', sans-serif", borderBottom: "1px solid #e2e8f0", letterSpacing: "-0.01em", background: "#f8fafc" }}>
                    # Shelf Presence
                  </th>
                ) : (
                  <th colSpan={3} style={{ textAlign: "center", padding: "8px 12px 4px", color: "#0f172a", fontWeight: 700, fontSize: 12, fontFamily: "'Inter', sans-serif", borderBottom: "1px solid #e2e8f0", letterSpacing: "-0.01em", background: "#f8fafc" }}>
                    Share of Search (SOS)
                  </th>
                )}
              </tr>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ textAlign: "center", padding: "8px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  Ad. <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 10, cursor: "help" }} title="The average search ranking position of a brand’s products across sponsored or paid search results for relevant keywords.">ⓘ</span>
                </th>
                <th style={{ textAlign: "center", padding: "8px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  Organic <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 10, cursor: "help" }} title="The average search ranking position of a brand’s products across organic (non-paid) search results for relevant keywords.">ⓘ</span>
                </th>
                {type === "keyword" ? (
                  <>
                    <th style={{ textAlign: "center", padding: "8px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      Top 5 <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 10, cursor: "help" }} title="Number of days the SKU held a top 5 search slot over the selected period">ⓘ</span>
                    </th>
                    <th style={{ textAlign: "center", padding: "8px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      Top 10 <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 10, cursor: "help" }} title="Number of days the SKU held a top 10 search slot over the selected period">ⓘ</span>
                    </th>
                    <th style={{ textAlign: "center", padding: "8px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      Top 20 <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 10, cursor: "help" }} title="Number of days the SKU held a top 20 search slot over the selected period">ⓘ</span>
                    </th>
                  </>
                ) : (
                  <>
                    <th style={{ textAlign: "center", padding: "8px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>Overall</th>
                    <th style={{ textAlign: "center", padding: "8px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>Organic</th>
                    <th style={{ textAlign: "center", padding: "8px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>Paid</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <React.Fragment key={i}>
                  <tr style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {type === "sku" && (
                          item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }}
                              style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #e2e8f0", background: "#f8fafc" }}
                            />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f1f5f9", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                <line x1="12" y1="22.08" x2="12" y2="12" />
                              </svg>
                            </div>
                          )
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600, color: "#0f172a", fontSize: 13, fontFamily: "'Inter', sans-serif", wordBreak: "break-word" }}>
                              {item.name}
                            </span>
                            {item.volShare > 0 && (
                              <span style={{ background: "#f1f5f9", color: "#475569", fontSize: 10, fontWeight: 600, borderRadius: 4, padding: "1px 5px", display: "inline-flex", alignItems: "center", gap: 3 }}>
                                <TrendingUp size={10} color="#64748b" /> {item.volShare}%
                              </span>
                            )}
                          </div>
                          
                          {onToggleLocations && (
                            <div 
                              onClick={() => {
                                const nameFromTitle = title?.split('—')?.[1]?.trim().replace(/"/g, '') || "";
                                if (type === "sku") {
                                  onToggleLocations?.(nameFromTitle, item.name, "All", item.name);
                                } else if (type === "brandKeywords") {
                                  onToggleLocations?.(item.name, "All", nameFromTitle, item.name);
                                } else {
                                  onToggleLocations?.(item.name, nameFromTitle, "All", item.name);
                                }
                              }}
                              style={{ fontSize: 11, color: "#60a5fa", cursor: "pointer", marginTop: 4, textDecoration: "underline", fontWeight: 500, display: "inline-block" }}
                            >
                              {locsLoading?.[item.name] ? "Loading..." : expandedLocs?.[item.name] ? "Hide Locations" : "Show Locations"}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "center", padding: "12px" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: item.adPosition ? "#0f172a" : "#94a3b8", fontFamily: "'Inter', sans-serif" }}>
                        {item.adPosition || "—"}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", padding: "12px" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: item.organicPosition ? "#0f172a" : "#94a3b8", fontFamily: "'Inter', sans-serif" }}>
                        {item.organicPosition || "—"}
                      </span>
                    </td>
                    {type === "keyword" ? (
                      <>
                        <td style={{ textAlign: "center", padding: "12px 8px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: (item.top5Days || 0) > 0 ? "#0f172a" : "#94a3b8", fontFamily: "'Inter', sans-serif" }}>
                              {item.top5Days || 0}
                            </span>
                            <span
                              title={`${item.top5Days || 0} days in Top 5`}
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 4, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#2563eb", flexShrink: 0 }}
                            >
                              <Calendar size={11} />
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: "center", padding: "12px 8px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: (item.top10Days || 0) > 0 ? "#0f172a" : "#94a3b8", fontFamily: "'Inter', sans-serif" }}>
                              {item.top10Days || 0}
                            </span>
                            <span
                              title={`${item.top10Days || 0} days in Top 10`}
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 4, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#2563eb", flexShrink: 0 }}
                            >
                              <Calendar size={11} />
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: "center", padding: "12px 8px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: (item.top20Days || 0) > 0 ? "#0f172a" : "#94a3b8", fontFamily: "'Inter', sans-serif" }}>
                              {item.top20Days || 0}
                            </span>
                            <span
                              title={`${item.top20Days || 0} days in Top 20`}
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 4, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#2563eb", flexShrink: 0 }}
                            >
                              <Calendar size={11} />
                            </span>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ textAlign: "center", padding: "12px" }}><SOSValue value={item.overallSOS} /></td>
                        <td style={{ textAlign: "center", padding: "12px" }}><SOSValue value={item.organicSOS} /></td>
                        <td style={{ textAlign: "center", padding: "12px" }}><SOSValue value={item.paidSOS} /></td>
                      </>
                    )}
                  </tr>
                  
                  {expandedLocs?.[item.name] && expandedLocs[item.name].map((loc, j) => (
                    <tr key={`${i}-loc-${j}`} style={{ background: "#f8fafc", borderBottom: "1px solid #edf2f7" }}>
                      <td style={{ padding: "8px 16px 8px 32px" }}>
                        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#cbd5e1" }}></div>
                          {loc.city}
                        </div>
                      </td>
                      <td style={{ textAlign: "center", padding: "8px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: loc.paidRank ? "#0f172a" : "#94a3b8" }}>
                          {loc.paidRank ? `#${Math.round(loc.paidRank)}` : "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center", padding: "8px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: loc.organicRank ? "#0f172a" : "#94a3b8" }}>
                          {loc.organicRank ? `#${Math.round(loc.organicRank)}` : "—"}
                        </span>
                      </td>
                      {type === "keyword" ? (
                        <>
                          <td style={{ textAlign: "center", padding: "8px" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: (loc.top5Days || 0) > 0 ? "#0f172a" : "#94a3b8" }}>
                                {loc.top5Days || 0}
                              </span>
                              <span
                                title={`${loc.top5Days || 0} days in Top 5 in ${loc.city}`}
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 3, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#2563eb" }}
                              >
                                <Calendar size={10} />
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: "center", padding: "8px" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: (loc.top10Days || 0) > 0 ? "#0f172a" : "#94a3b8" }}>
                                {loc.top10Days || 0}
                              </span>
                              <span
                                title={`${loc.top10Days || 0} days in Top 10 in ${loc.city}`}
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 3, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#2563eb" }}
                              >
                                <Calendar size={10} />
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: "center", padding: "8px" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: (loc.top20Days || 0) > 0 ? "#0f172a" : "#94a3b8" }}>
                                {loc.top20Days || 0}
                              </span>
                              <span
                                title={`${loc.top20Days || 0} days in Top 20 in ${loc.city}`}
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 3, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#2563eb" }}
                              >
                                <Calendar size={10} />
                              </span>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ textAlign: "center", padding: "8px" }}><SOSValue value={loc.overallSOS} fontSize={12} /></td>
                          <td style={{ textAlign: "center", padding: "8px" }}><SOSValue value={loc.organicSOS} fontSize={12} /></td>
                          <td style={{ textAlign: "center", padding: "8px" }}><SOSValue value={loc.paidSOS} fontSize={12} /></td>
                        </>
                      )}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default function SearchTermsPerformance() {
  const { user } = useAuth();
  const isSugarUser = user?.dbName === 'sugar';

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
    compareStart,
    compareEnd,
    platforms: globalPlatforms,
    selectedRank
  } = useContext(FilterContext);

  const [activeView, setActiveView] = useState("keyword");
  const [activeFilter, setActiveFilter] = useState("Generic");
  const [expandedRows, setExpandedRows] = useState({});
  const [locationData, setLocationData] = useState({});
  const [locationLoading, setLocationLoading] = useState({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [drilldownModal, setDrilldownModal] = useState(null);
  const [modalKeywordType, setModalKeywordType] = useState("Generic");
  const [currentModalBrand, setCurrentModalBrand] = useState(null);
  const [hoveredKeyword, setHoveredKeyword] = useState(null);
  const [hoverPos, setHoverPos] = useState({ top: 0, left: 0 });
  const [bbData, setBbData] = useState({});
  const [bbLoading, setBbLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [expandedKeywordLocations, setExpandedKeywordLocations] = useState({});
  const [keywordLocationLoading, setKeywordLocationLoading] = useState({});

  // Local Filter State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Category");
  const [optionSearch, setOptionSearch] = useState("");
  const [localFilters, setLocalFilters] = useState({ platform: [], category: [], brand: [] });
  const [tempLocalFilters, setTempLocalFilters] = useState({ platform: [], category: [], brand: [] });
  const [filterOptions, setFilterOptions] = useState({ platforms: [], categories: [], brands: [] });
  const [optionsLoading, setOptionsLoading] = useState({ platforms: false, categories: false, brands: false });

  // Custom KPI Column Visibility State
  const [visibleKpis, setVisibleKpis] = useState(() => {
    try {
      const saved = localStorage.getItem("top_search_terms_visible_kpis");
      if (saved) {
        return { ...DEFAULT_VISIBLE_KPIS, ...JSON.parse(saved) };
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_VISIBLE_KPIS;
  });
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [tempVisibleKpis, setTempVisibleKpis] = useState(visibleKpis);

  const updateVisibleKpis = (newKpis) => {
    setVisibleKpis(newKpis);
    try {
      localStorage.setItem("top_search_terms_visible_kpis", JSON.stringify(newKpis));
    } catch (e) {
      // ignore
    }
  };

  // Trends Drawer State
  const [isTrendDrawerOpen, setIsTrendDrawerOpen] = useState(false);
  const [trendDrawerFilters, setTrendDrawerFilters] = useState(null);

  const handleOpenTrend = (e, keywordName = null) => {
    if (e && e.stopPropagation) e.stopPropagation();

    const effPlatform = localFilters.platform.length > 0
      ? (Array.isArray(localFilters.platform) ? localFilters.platform[0] : localFilters.platform)
      : (globalPlatform && globalPlatform !== "All" ? (Array.isArray(globalPlatform) ? globalPlatform[0] : globalPlatform) : "All");

    const effCategory = localFilters.category.length > 0
      ? (Array.isArray(localFilters.category) ? localFilters.category[0] : localFilters.category)
      : (selectedCategory && selectedCategory !== "All" ? (Array.isArray(selectedCategory) ? selectedCategory[0] : selectedCategory) : "All");

    const effBrand = localFilters.brand.length > 0
      ? (Array.isArray(localFilters.brand) ? localFilters.brand[0] : localFilters.brand)
      : (selectedBrand && selectedBrand !== "All" ? (Array.isArray(selectedBrand) ? selectedBrand[0] : selectedBrand) : "All");

    const effLocation = selectedLocation && selectedLocation !== "All"
      ? (Array.isArray(selectedLocation) ? selectedLocation[0] : selectedLocation)
      : "All";

    const effKeywordType = activeFilter && activeFilter !== "All"
      ? activeFilter
      : (selectedKeywordType && selectedKeywordType !== "All" ? selectedKeywordType : "All");

    const effKeyword = keywordName || (selectedKeyword && selectedKeyword !== "All" ? selectedKeyword : "All");

    setTrendDrawerFilters({
      Platform: effPlatform,
      Format: effCategory,
      Brand: effBrand,
      City: effLocation,
      SKU: "All",
      Keyword_Type: effKeywordType,
      Keyword: effKeyword,
      rank: selectedRank || "All",
    });
    setIsTrendDrawerOpen(true);
  };

  const activeKpis = useMemo(() => {
    return ALL_KPIS.filter(kpi => {
      if (activeView !== "keyword" && kpi.keywordOnly) return false;
      if (kpi.hideIfSugar && isSugarUser) return false;
      return visibleKpis[kpi.id] !== false;
    });
  }, [activeView, isSugarUser, visibleKpis]);

  const availableKpisForModal = useMemo(() => {
    return ALL_KPIS.filter(kpi => {
      if (activeView !== "keyword" && kpi.keywordOnly) return false;
      if (kpi.hideIfSugar && isSugarUser) return false;
      return true;
    });
  }, [activeView, isSugarUser]);

  // Removed local skuPlatform state - now using global platform filter
  const currentSkuPlatform = globalPlatform || "All";

  // Reset local filters when global filters are reset to defaults
  useEffect(() => {
    const isGlobalPlatformReset = globalPlatform === "All" || (Array.isArray(globalPlatform) && globalPlatform.includes("All")) || globalPlatform === "";
    const isGlobalBrandReset = selectedBrand === "All";
    const isGlobalCategoryReset = selectedCategory === "All";
    const isGlobalLocationReset = selectedLocation === "All";

    if (isGlobalPlatformReset && isGlobalBrandReset && isGlobalCategoryReset && isGlobalLocationReset) {
      setLocalFilters({ platform: [], category: [], brand: [] });
      setTempLocalFilters({ platform: [], category: [], brand: [] });
    }
  }, [globalPlatform, selectedBrand, selectedCategory, selectedLocation]);

  const normalize = (val) => {
    if (!val || val === "All" || (Array.isArray(val) && val.length === 0)) return "All";
    return Array.isArray(val) ? val.join(',') : String(val);
  };

  const filterParams = useMemo(() => {
    if (activeView === "banner") return null;
    return {
      viewMode: activeView,
      platform: normalize(localFilters.platform.length > 0 ? localFilters.platform : (activeView === "sku" ? currentSkuPlatform : globalPlatform)),
      brand: normalize(localFilters.brand.length > 0 ? localFilters.brand : selectedBrand),
      location: normalize(selectedLocation),
      category: normalize(localFilters.category.length > 0 ? localFilters.category : selectedCategory),
      keyword: normalize(selectedKeyword),
      keywordTypeFilter: activeFilter.toLowerCase(),
      keywordType: normalize(selectedKeywordType),
      channel: normalize(selectedChannel),
      ownBrandsOnly: activeView === "sku",
      startDate: timeStart,
      endDate: timeEnd,
      compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : undefined,
      compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : undefined,
      rank: selectedRank || 'All',
    };
  }, [activeView, globalPlatform, currentSkuPlatform, selectedBrand, selectedLocation, selectedCategory, selectedKeyword, selectedKeywordType, selectedChannel, activeFilter, timeStart, timeEnd, compareStart, compareEnd, localFilters, selectedRank]);

  useEffect(() => {
    if (!filterParams) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setExpandedRows({});
      setLocationData({}); // Clear location drilldown cache on filter change
      setBbData({}); // Clear brand breakdown cache on filter change
      setExpandedKeywordLocations({}); // Clear expanded SKU/Keyword locations on filter change
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

  // Fetch filter options when modal opens or temp filters change
  useEffect(() => {
    if (!isFilterModalOpen) return;

    let cancelled = false;

    const loadOptions = async (type, key) => {
      setOptionsLoading(prev => ({ ...prev, [key]: true }));
      try {
        const params = {
          filterType: type,
          platform: type === "platforms" ? "All" : normalize(tempLocalFilters.platform.length > 0 ? tempLocalFilters.platform : globalPlatform),
          brand: type === "brands" ? "All" : normalize(tempLocalFilters.brand.length > 0 ? tempLocalFilters.brand : selectedBrand),
          format: type === "categories" ? "All" : normalize(tempLocalFilters.category.length > 0 ? tempLocalFilters.category : selectedCategory),
          channel: selectedChannel,
          city: selectedLocation
        };
        const data = await fetchVisibilityFilterOptions(params);
        if (!cancelled) {
          setFilterOptions(prev => ({ ...prev, [key]: data.options || [] }));
        }
      } catch (err) {
        console.error(`Error fetching ${type} options:`, err);
        if (!cancelled) setFilterOptions(prev => ({ ...prev, [key]: [] }));
      } finally {
        if (!cancelled) setOptionsLoading(prev => ({ ...prev, [key]: false }));
      }
    };

    loadOptions("categories", "categories");
    loadOptions("brands", "brands");

    return () => { cancelled = true; };
  }, [isFilterModalOpen, tempLocalFilters.category, tempLocalFilters.brand, globalPlatform, selectedBrand, selectedCategory, selectedChannel, selectedLocation]);

  const toggleRow = useCallback(async (itemName) => {
    setExpandedRows(prev => ({ ...prev, [itemName]: !prev[itemName] }));
    if (!locationData[itemName] && !locationLoading[itemName]) {
      setLocationLoading(prev => ({ ...prev, [itemName]: true }));
      try {
        const params = { 
          ...filterParams
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
  }, [locationData, locationLoading, filterParams]);


  const openSkuModal = useCallback((e, keywordName, isMySkus) => {
    e.stopPropagation();
    const title = isMySkus ? `My SKUs — "${keywordName}"` : `All SKUs — "${keywordName}"`;
    setExpandedKeywordLocations({});
    setDrilldownModal({
      title,
      items: [],
      loading: true,
      type: "sku",
      keywordName,
      isMySkus
    });
  }, []);


  const openKeywordModal = useCallback((e, skuName, isMyKeywords) => {
    e.stopPropagation();
    const title = isMyKeywords ? `My Keywords — "${skuName}"` : `All Keywords — "${skuName}"`;
    setExpandedKeywordLocations({});
    setDrilldownModal({
      title,
      items: [],
      loading: true,
      type: "keyword",
      skuName,
      isMyKeywords
    });
  }, []);


  const openBrandKeywordsModal = useCallback((e, brandName) => {
    e.stopPropagation();
    setCurrentModalBrand(brandName);
    setModalKeywordType("All");
    const title = `Keywords — "${brandName}"`;
    setExpandedKeywordLocations({});
    setDrilldownModal({ title, items: [], loading: true, type: "brandKeywords" });
  }, []);

  // Effect to re-fetch SKU or Keyword drilldown modal data when filter parameters change
  useEffect(() => {
    if (!drilldownModal) return;

    if (drilldownModal.type === "sku" && drilldownModal.keywordName) {
      const fetchModalData = async () => {
        setDrilldownModal(prev => ({ ...prev, loading: true }));
        setExpandedKeywordLocations({}); // Reset expanded locations
        try {
          const data = await fetchSearchTermsPerformance({
            ...filterParams,
            viewMode: "sku",
            brand: drilldownModal.isMySkus ? (selectedBrand || "All") : "All",
            location: (selectedLocation && selectedLocation !== "All") 
              ? (Array.isArray(selectedLocation) ? selectedLocation.join(',').toLowerCase() : selectedLocation.toLowerCase()) 
              : "All",
            category: selectedCategory || "All",
            keyword: drilldownModal.keywordName,
            ownBrandsOnly: drilldownModal.isMySkus,
          });
          setDrilldownModal(prev => ({ ...prev, items: data.items || [], loading: false }));
        } catch (err) {
          console.error("Error fetching SKU data reactively:", err);
          setDrilldownModal(prev => ({ ...prev, items: [], loading: false }));
        }
      };
      fetchModalData();
    } else if (drilldownModal.type === "keyword" && drilldownModal.skuName) {
      const fetchModalData = async () => {
        setDrilldownModal(prev => ({ ...prev, loading: true }));
        setExpandedKeywordLocations({}); // Reset expanded locations
        try {
          const data = await fetchSearchTermsPerformance({
            ...filterParams,
            viewMode: "keyword",
            brand: drilldownModal.isMyKeywords ? (selectedBrand || "All") : "All",
            location: (selectedLocation && selectedLocation !== "All") 
              ? (Array.isArray(selectedLocation) ? selectedLocation.join(',').toLowerCase() : selectedLocation.toLowerCase()) 
              : "All",
            category: selectedCategory || "All",
            sku: drilldownModal.skuName,
            ownBrandsOnly: drilldownModal.isMyKeywords,
          });
          setDrilldownModal(prev => ({ ...prev, items: data.items || [], loading: false }));
        } catch (err) {
          console.error("Error fetching Keyword data reactively:", err);
          setDrilldownModal(prev => ({ ...prev, items: [], loading: false }));
        }
      };
      fetchModalData();
    }
  }, [
    drilldownModal?.keywordName, 
    drilldownModal?.skuName, 
    drilldownModal?.type, 
    drilldownModal?.isMySkus, 
    drilldownModal?.isMyKeywords, 
    filterParams,
    selectedBrand,
    selectedLocation,
    selectedCategory
  ]);

  // Effect to re-fetch brand keywords when modal filter changes
  useEffect(() => {
    if (drilldownModal?.type === "brandKeywords" && currentModalBrand) {
      const fetchModalData = async () => {
        setDrilldownModal(prev => ({ ...prev, loading: true }));
        try {
          const data = await fetchSearchTermsPerformance({
            ...filterParams,
            viewMode: "keyword",
            brand: currentModalBrand,
            keywordTypeFilter: modalKeywordType,
            ownBrandsOnly: false,
            sku: "All"
          });
          setDrilldownModal(prev => ({ ...prev, items: data.items || [], loading: false }));
        } catch (err) {
          console.error("Error fetching Keywords for Brand:", err);
          setDrilldownModal(prev => ({ ...prev, items: [], loading: false }));
        }
      };
      fetchModalData();
    }
  }, [modalKeywordType, currentModalBrand, filterParams]);


  const toggleKeywordLocations = useCallback(async (keywordName, skuName, brandName, itemKey) => {
    const keyToExpand = itemKey || keywordName;

    if (expandedKeywordLocations[keyToExpand]) {
      setExpandedKeywordLocations(prev => {
        const newState = { ...prev };
        delete newState[keyToExpand];
        return newState;
      });
      return;
    }

    setKeywordLocationLoading(prev => ({ ...prev, [keyToExpand]: true }));
    try {
      const data = await fetchSearchTermsLocations({
        ...filterParams,
        keyword: keywordName,
        sku: skuName || "All",
        brand: brandName || "All",
        viewMode: (skuName && skuName !== "All") ? "sku" : "keyword"
      });
      setExpandedKeywordLocations(prev => ({ ...prev, [keyToExpand]: data.locations || [] }));
    } catch (err) {
      console.error("Error fetching locations for keyword:", err);
    } finally {
      setKeywordLocationLoading(prev => ({ ...prev, [keyToExpand]: false }));
    }
  }, [expandedKeywordLocations, filterParams]);


  const handleBrandHover = useCallback(async (e, keyword) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPos({ top: rect.top, left: rect.left + rect.width / 2 });
    setHoveredKeyword(keyword);
    
    if (!bbData[keyword] && !bbLoading) {
      setBbLoading(true);
      try {
        const data = await fetchSearchTermsBrandBreakdown({
          ...filterParams,
          keyword
        });
        setBbData(prev => ({ ...prev, [keyword]: data.brands || [] }));
      } catch (err) {
        console.error("Error fetching brand breakdown:", err);
        setBbData(prev => ({ ...prev, [keyword]: [] }));
      } finally {
        setBbLoading(false);
      }
    }
  }, [bbData, bbLoading, filterParams]);

  const shouldShowDrilldown = activeView !== "brand";

  const downloadCSV = () => {
    if (!items || items.length === 0) return;
    
    const isSku = activeView === "sku";
    const headers = [
      activeView === "keyword" ? "Keyword" : (activeView === "brand" ? "Brand" : "SKU"),
      ...(isSku ? ["Offtake Share"] : []),
      ...activeKpis.map(k => k.label)
    ];
      
    const rows = items.map(item => {
      const row = [
        `"${(item.name || "").replace(/"/g, '""')}"`,
        ...(isSku ? [`"${item.offtakeShare != null ? Number(item.offtakeShare).toFixed(2) + '%' : '—'}"`] : []),
        ...activeKpis.map(k => {
          if (k.id === "searchVolume") return `"${item.searchVolume != null ? item.searchVolume : 0}"`;
          if (k.id === "leadingBrand") return `"${(item.leadingBrand || "").replace(/"/g, '""')}"`;
          if (k.id === "overallSOS") return `"${(item.overallSOS || 0).toFixed(2)}%"`;
          if (k.id === "overallSOV") return `"${item.overallSOV != null ? item.overallSOV.toFixed(2) + '%' : '—'}"`;
          if (k.id === "organicSOS") return `"${(item.organicSOS || 0).toFixed(2)}%"`;
          if (k.id === "organicSOV") return `"${item.organicSOV != null ? item.organicSOV.toFixed(2) + '%' : '—'}"`;
          if (k.id === "paidSOS") return `"${(item.paidSOS || 0).toFixed(2)}%"`;
          if (k.id === "adSOV") return `"${item.adSOV != null ? item.adSOV.toFixed(2) + '%' : '—'}"`;
          return '""';
        })
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

  const filteredItems = useMemo(() => {
    let baseItems = items;
    
    if (activeView === "brand") {
      baseItems = baseItems.filter(item => {
        const n = (item.name || "").toLowerCase();
        return n !== "other" && n !== "others" && n !== "none" && n !== "";
      });
    }

    if (!searchQuery.trim()) return baseItems;
    const q = searchQuery.trim().toLowerCase();
    return baseItems.filter(item => (item.name || "").toLowerCase().includes(q));
  }, [items, searchQuery, activeView]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const paginatedItems = filteredItems.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const GRID = useMemo(() => {
    const firstCol = activeView === "sku" ? "minmax(260px, 1fr)" : "minmax(220px, 1fr)";
    const colWidths = activeKpis.map(kpi => {
      if (kpi.id === "searchVolume") return "110px";
      if (kpi.id === "leadingBrand") return "125px";
      return activeKpis.length <= 4 ? "120px" : "95px";
    });
    return [firstCol, ...colWidths].join(" ");
  }, [activeView, activeKpis]);

  const tableMinWidth = useMemo(() => {
    if (activeKpis.length > 5) return 1040;
    if (activeKpis.length > 3) return 820;
    return "100%";
  }, [activeKpis.length]);

  const viewTabs = (
    <div style={{ display: "inline-flex", background: "#e2e8f0", borderRadius: 10, padding: 3, gap: 2, flexShrink: 0 }}>
      {[{ id: "keyword", label: "My Keywords" }, { id: "sku", label: "My SKU" }, { id: "banner", label: "Banner" }].map(v => (
        <button key={v.id} onClick={() => { setActiveView(v.id); setSearchQuery(""); }} style={{
          padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", transition: "all 0.18s",
          background: activeView === v.id ? "#0f172a" : "transparent",
          color: activeView === v.id ? "#fff" : "#64748b",
          boxShadow: activeView === v.id ? "0 1px 4px rgba(0,0,0,0.18)" : "none",
          whiteSpace: "nowrap"
        }}>{v.label}</button>
      ))}
    </div>
  );

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#f1f5f9", minHeight: 200, padding: "28px 32px", borderRadius: 24, margin: "24px 0", border: "1px solid #e2e8f0" }}>
      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .drill-btn:hover { background: #0f172a !important; border-color: #0f172a !important; }
        .drill-btn:hover svg path { stroke: #fff !important; }
        .sku-btn:hover { opacity: 0.8; }
      `}</style>

      {/* Page title */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <TrendingUp size={20} color="#7c3aed" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', fontFamily: "'Mulish', system-ui, sans-serif" }}>Top Search Terms</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b', fontFamily: "'Mulish', system-ui, sans-serif" }}>Share of search performance by keyword</p>
        </div>
      </div>

      {activeView === "banner" ? (
        <>
          {viewTabs}
          <p style={{
            margin: "16px 0 0",
            padding: 24,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.05)",
            textAlign: "center",
            color: "#475569",
          }}>
            Coming soon
          </p>
        </>
      ) : (
      <>
      {/* Controls Row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
        gap: 10,
        flexWrap: "nowrap",
        width: "100%",
        minHeight: 38,
        overflowX: "auto",
        paddingBottom: 2,
        scrollbarWidth: "none",
        msOverflowStyle: "none"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {viewTabs}

          {/* Search Bar */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <Search size={14} style={{ position: "absolute", left: 10, color: "#94a3b8", pointerEvents: "none" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              placeholder={activeView === "keyword" ? "Search keywords..." : (activeView === "brand" ? "Search brands..." : "Search SKUs...")}
              style={{
                padding: "6px 28px 6px 30px",
                borderRadius: 10,
                border: "1.5px solid #e2e8f0",
                background: "#fff",
                fontSize: 12,
                fontFamily: "'Inter', sans-serif",
                color: "#0f172a",
                width: 175,
                outline: "none",
                transition: "border-color 0.18s, box-shadow 0.18s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)"; }}
              onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setPage(0); }}
                style={{ position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center", color: "#94a3b8" }}
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Local Filter Button */}
          <button
            onClick={() => {
              setTempLocalFilters(localFilters);
              setIsFilterModalOpen(true);
            }}
            style={{
              padding: "6px 12px", borderRadius: 10, border: "1.5px solid #bfdbfe", background: "#eff6ff", color: "#3b82f6",
              fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, transition: "all 0.18s", flexShrink: 0,
              whiteSpace: "nowrap"
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "#dbeafe"; e.currentTarget.style.borderColor = "#93c5fd"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.borderColor = "#bfdbfe"; }}
          >
            <Filter size={14} />
            <span>Filter Segment</span>
            {(localFilters.platform.length > 0 || localFilters.category.length > 0 || localFilters.brand.length > 0) && (
               <div style={{ width: 7, height: 7, background: "#ef4444", borderRadius: "50%", marginLeft: 3 }} />
            )}
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {activeView === "keyword" && (
            ["All", "Branded", "Competition", "Generic"].map(f => (
              <button key={f} onClick={() => setActiveFilter(f)} style={{
                padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", transition: "all 0.18s",
                border: activeFilter === f ? "2px solid #0f172a" : "2px solid #cbd5e1",
                background: activeFilter === f ? "#0f172a" : "#fff",
                color: activeFilter === f ? "#fff" : "#475569",
                whiteSpace: "nowrap"
              }}>{f}</button>
            ))
          )}
          <button 
            onClick={() => {
              setTempVisibleKpis({ ...visibleKpis });
              setIsKpiModalOpen(true);
            }}
            title="Customize KPI Columns"
            style={{
              padding: "5px 11px", borderRadius: 10, cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", transition: "all 0.18s",
              border: "1.5px solid #cbd5e1", background: "#fff", color: "#334155",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              marginLeft: 4,
              whiteSpace: "nowrap"
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#94a3b8"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
          >
            <SlidersHorizontal size={14} />
            <span>Custom KPI</span>
            {activeKpis.length < availableKpisForModal.length && (
              <span style={{
                background: "#3b82f6", color: "#fff", borderRadius: 10,
                padding: "1px 5px", fontSize: 10, fontWeight: 700, marginLeft: 2
              }}>
                {activeKpis.length}
              </span>
            )}
          </button>
          <button 
            onClick={downloadCSV}
            title="Download CSV"
            style={{
              padding: "5px 11px", borderRadius: 10, cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", transition: "all 0.18s",
              border: "1.5px solid #cbd5e1", background: "#fff", color: "#475569",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              whiteSpace: "nowrap"
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#94a3b8"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
          >
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div style={{ background: "#fff", borderRadius: 16, overflowX: "auto", overflowY: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>

        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: GRID, minWidth: tableMinWidth, padding: "13px 24px", background: "#f8fafc", borderBottom: "2px solid #e2e8f0", gap: 8, alignItems: "end" }}>
          {[
            { id: "entity", label: activeView === "keyword" ? "Keywords" : (activeView === "brand" ? "Brands" : "SKUs"), sub: null },
            ...activeKpis.map(h => ({
              id: h.id,
              label: h.label,
              sub: h.id === "leadingBrand" ? "by Overall SOS" : null
            }))
          ].map((h, i) => (
            <div key={h.id || i} style={{ textAlign: i === 0 ? "left" : "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h.label}</div>
              {h.sub && <div style={{ fontSize: 10, fontWeight: 500, color: "#94a3b8", marginTop: 1 }}>{h.sub}</div>}
            </div>
          ))}
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>
            {searchQuery.trim() ? `No results matching "${searchQuery}"` : "No data available for the selected filters"}
          </div>
        ) : (
          <>
            {/* ── Summary Aggregate Row ── */}
            {summaryData && activeView === "keyword" && (
              <div style={{ borderBottom: "2px solid #c7d2fe" }}>
                {/* Main Summary Row */}
                <div
                  style={{
                    display: "grid", gridTemplateColumns: GRID, minWidth: tableMinWidth, padding: "16px 24px", alignItems: "center", gap: 8,
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
                          {activeFilter === "All" ? "Overview" : `${activeFilter} Overview`}
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
                        const summarySearchVolume = items.reduce((sum, item) => sum + (item.searchVolume || 0), 0);
                        return (summaryData.totalKeywords > 0 || summaryVolPercent > 0 || (summaryData.totalSearchVolume || 0) > 0 || summarySearchVolume > 0) ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 30, marginTop: 4 }}>
                            {summaryData.totalKeywords > 0 && (
                              <span style={{
                                background: "#eff6ff", color: "#3b82f6", fontSize: 10, fontWeight: 700,
                                borderRadius: 4, padding: "2px 8px", letterSpacing: "0.02em",
                              }}>
                                {summaryData.totalKeywords.toLocaleString()} Keywords
                              </span>
                            )}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* Search Volume */}
                  {visibleKpis.searchVolume && (
                    <div style={{ textAlign: "center" }}>
                      {(() => {
                        const summarySearchVolume = items.reduce((sum, item) => sum + (item.searchVolume || 0), 0);
                        const totalVol = summarySearchVolume > 0 ? summarySearchVolume : (summaryData.totalSearchVolume || 0);
                        return (
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#4f46e5", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>
                            {totalVol > 0 ? totalVol.toLocaleString() : "—"}
                          </span>
                        );
                      })()}
                    </div>
                  )}

                  {/* Leading Brand */}
                  {visibleKpis.leadingBrand && !isSugarUser && (
                    <div style={{ textAlign: "center" }}>
                      <span style={{
                        background: "#e0e7ff", color: "#3730a3", borderRadius: 6, padding: "5px 12px",
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", display: "inline-block",
                        textTransform: "uppercase",
                      }}>
                        {summaryData.leadingBrand}
                      </span>
                    </div>
                  )}

                  {/* Overall SOS */}
                  {visibleKpis.overallSOS && (
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: sosColor(summaryData.overallSOS), letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
                        {summaryData.overallSOS != null ? `${Number(summaryData.overallSOS).toFixed(2)}%` : "—"}
                      </span>
                    </div>
                  )}

                  {/* Overall SOV */}
                  {visibleKpis.overallSOV && (
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: sosColor(summaryData.overallSOV), letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
                        {summaryData.overallSOV != null ? `${Number(summaryData.overallSOV).toFixed(2)}%` : "—"}
                      </span>
                    </div>
                  )}

                  {/* Organic SOS */}
                  {visibleKpis.organicSOS && (
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: sosColor(summaryData.organicSOS), letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
                        {summaryData.organicSOS != null ? `${Number(summaryData.organicSOS).toFixed(2)}%` : "—"}
                      </span>
                    </div>
                  )}

                  {/* Organic SOV */}
                  {visibleKpis.organicSOV && (
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: sosColor(summaryData.organicSOV), letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
                        {summaryData.organicSOV != null ? `${Number(summaryData.organicSOV).toFixed(2)}%` : "—"}
                      </span>
                    </div>
                  )}

                  {/* Paid SOS */}
                  {visibleKpis.paidSOS && (
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: sosColor(summaryData.paidSOS), letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
                        {summaryData.paidSOS != null ? `${Number(summaryData.paidSOS).toFixed(2)}%` : "—"}
                      </span>
                    </div>
                  )}

                  {/* Ad SOV */}
                  {visibleKpis.adSOV && (
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: sosColor(summaryData.adSOV), letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
                        {summaryData.adSOV != null ? `${Number(summaryData.adSOV).toFixed(2)}%` : "—"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Summary Drilldown — Location Breakdown */}
                {summaryExpanded && (
                  <div style={{ background: "#f0f0ff", borderTop: "1px solid #c7d2fe", animation: "slideDown 0.18s ease" }}>
                    <div style={{ display: "grid", gridTemplateColumns: GRID, minWidth: tableMinWidth, padding: "9px 24px 7px", gap: 8, borderBottom: "1px solid #c7d2fe" }}>
                      <div style={{ paddingLeft: 30, fontSize: 10, fontWeight: 700, color: "#4f46e5", letterSpacing: "0.08em", textTransform: "uppercase" }}>📍 Location Breakdown</div>
                      {visibleKpis.searchVolume && (
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Search Volume</div>
                      )}
                      {visibleKpis.leadingBrand && !isSugarUser && <div />}
                      {visibleKpis.overallSOS && <div style={{ fontSize: 10, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Overall SOS</div>}
                      {visibleKpis.overallSOV && <div style={{ fontSize: 10, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Overall SOV</div>}
                      {visibleKpis.organicSOS && <div style={{ fontSize: 10, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Organic SOS</div>}
                      {visibleKpis.organicSOV && <div style={{ fontSize: 10, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Organic SOV</div>}
                      {visibleKpis.paidSOS && <div style={{ fontSize: 10, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Paid SOS</div>}
                      {visibleKpis.adSOV && <div style={{ fontSize: 10, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Ad SOV</div>}
                    </div>

                    {(!summaryData.locations || summaryData.locations.length === 0) ? (
                      <div style={{ padding: "16px 24px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No location data available</div>
                    ) : (
                      summaryData.locations.map((loc, li) => (
                        <div key={li} style={{
                          display: "grid", gridTemplateColumns: GRID, minWidth: tableMinWidth, padding: "11px 24px", alignItems: "center", gap: 8,
                          borderBottom: li < summaryData.locations.length - 1 ? "1px solid #ddd6fe" : "none",
                          background: li % 2 === 0 ? "#f5f3ff" : "#ede9fe",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 30 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", display: "inline-block", flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{loc.city}</span>
                          </div>
                          {visibleKpis.searchVolume && (
                            <div style={{ textAlign: "center" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#4f46e5" }}>
                                {loc.searchVolume != null && loc.searchVolume > 0 ? Number(loc.searchVolume).toLocaleString() : "—"}
                              </span>
                            </div>
                          )}
                          {visibleKpis.leadingBrand && !isSugarUser && <div />}
                          {visibleKpis.overallSOS && <div style={{ textAlign: "center" }}><SOSValue value={loc.overallSOS} /></div>}
                          {visibleKpis.overallSOV && <div style={{ textAlign: "center" }}><SOSValue value={loc.overallSOV} /></div>}
                          {visibleKpis.organicSOS && <div style={{ textAlign: "center" }}><SOSValue value={loc.organicSOS} /></div>}
                          {visibleKpis.organicSOV && <div style={{ textAlign: "center" }}><SOSValue value={loc.organicSOV} /></div>}
                          {visibleKpis.paidSOS && <div style={{ textAlign: "center" }}><SOSValue value={loc.paidSOS} /></div>}
                          {visibleKpis.adSOV && <div style={{ textAlign: "center" }}><SOSValue value={loc.adSOV} /></div>}
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
                <div style={{ display: "grid", gridTemplateColumns: GRID, minWidth: tableMinWidth, padding: "16px 24px", alignItems: "center", gap: 8, background: expandedRows[row.name] ? "#fafbff" : "#fff", transition: "background 0.15s", cursor: shouldShowDrilldown ? "pointer" : "default" }}
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
                      {(activeView === "sku" || activeView === "brand") && (
                        row.imageUrl ? (
                          <img
                            src={row.imageUrl}
                            alt={row.name}
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }}
                            style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #e2e8f0", background: "#f8fafc" }}
                          />
                        ) : null
                      )}
                      {(activeView === "sku" || activeView === "brand") && !row.imageUrl && (
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f1f5f9", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                          </svg>
                        </div>
                      )}
                      {activeView === "sku" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.01em", lineHeight: 1.3, wordBreak: "break-word" }}>
                            {row.name}
                          </span>
                          {row.page_url && (
                            <a
                              href={row.page_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Open product page"
                              style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                padding: "2px 4px", borderRadius: 5, color: "#94a3b8",
                                border: "1px solid #e2e8f0", background: "#fff",
                                textDecoration: "none", flexShrink: 0, transition: "all 0.15s",
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.color = "#3b82f6"; e.currentTarget.style.borderColor = "#93c5fd"; e.currentTarget.style.background = "#eff6ff"; }}
                              onMouseOut={(e) => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#fff"; }}
                            >
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.01em", lineHeight: 1.3, wordBreak: "break-word" }}>
                            {activeView === "brand"
                              ? (row.name || "").split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                              : row.name}
                          </span>
                          {activeView === "keyword" && (
                            <button
                              onClick={(e) => handleOpenTrend(e, row.name)}
                              title={`View Trends for "${row.name}"`}
                              style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                width: 22, height: 22, borderRadius: 6, border: "1px solid #ddd6fe",
                                background: "#f5f3ff", cursor: "pointer", padding: 0,
                                transition: "all 0.15s"
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.background = "#ede9fe"; e.currentTarget.style.borderColor = "#c4b5fd"; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = "#f5f3ff"; e.currentTarget.style.borderColor = "#ddd6fe"; }}
                            >
                              <TrendingUp size={12} color="#7c3aed" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* My SKUs / All SKUs buttons — only in keyword mode */}
                    {activeView === "keyword" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 30 }}>
                        <button className="sku-btn" onClick={(e) => openSkuModal(e, row.name, true)}
                          style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "opacity 0.15s" }}>My SKUs</button>
                        {!isSugarUser && (
                          <button className="sku-btn" onClick={(e) => openSkuModal(e, row.name, false)}
                            style={{ background: "#f0f9ff", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "opacity 0.15s" }}>All SKUs</button>
                        )}
                      </div>
                    )}

                    {/* My Keywords / All Keywords buttons — only in SKU mode */}
                    {activeView === "sku" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 30 + (row.imageUrl ? 44 : 0), marginTop: 2 }}>
                        <button className="sku-btn" onClick={(e) => openKeywordModal(e, row.name, false)}
                          style={{ background: "#f0f9ff", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "opacity 0.15s" }}>All Keywords</button>
                        {row.offtakeShare !== undefined && row.offtakeShare !== null && Number(row.offtakeShare) > 0 && (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background: "#f0f9ff",
                              color: "#0284c7",
                              border: "1px solid #bae6fd",
                              borderRadius: 6,
                              padding: "2.5px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                              fontFamily: "'Inter', sans-serif",
                              cursor: "default"
                            }}
                            title={row.sales ? `Offtake Share: ${Number(row.offtakeShare).toFixed(2)}% (Sales: ₹${Number(row.sales).toLocaleString()})` : `Offtake Share: ${Number(row.offtakeShare).toFixed(2)}%`}
                          >
                            <PieChart size={12} color="#0284c7" strokeWidth={2.2} />
                            <span>{Number(row.offtakeShare).toFixed(2)}% Share</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Keywords button — only in brand mode */}
                    {activeView === "brand" && (
                      <div style={{ display: "flex", gap: 6, paddingLeft: 30 }}>
                        <button className="sku-btn" onClick={(e) => openBrandKeywordsModal(e, row.name)}
                          style={{ background: "#f0f9ff", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "opacity 0.15s" }}>Keywords</button>
                      </div>
                    )}
                  </div>

                  {/* Search Volume — keyword mode only */}
                  {visibleKpis.searchVolume && activeView === "keyword" && (
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter', sans-serif" }}>
                        {row.searchVolume > 0 ? row.searchVolume.toLocaleString() : "—"}
                      </span>
                    </div>
                  )}

                  {/* Leading Brand — keyword mode only */}
                  {visibleKpis.leadingBrand && activeView === "keyword" && !isSugarUser && (
                    <div style={{ textAlign: "center" }}>
                        <div 
                          onMouseEnter={(e) => handleBrandHover(e, row.name)}
                          onMouseLeave={() => setHoveredKeyword(null)}
                          style={{ position: "relative", cursor: "help" }}
                        >
                          <span style={{
                            background: "#eef2ff", color: "#4338ca", borderRadius: 6, padding: "5px 12px",
                            fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", display: "inline-block",
                            textTransform: "uppercase", transition: "all 0.2s",
                            border: `1px solid ${hoveredKeyword === row.name ? "#818cf8" : "transparent"}`,
                          }}>
                            {row.leadingBrand}
                          </span>

                          <AnimatePresence>
                            {hoveredKeyword === row.name && (
                              <motion.div
                                initial={{ opacity: 0, y: 10, x: "-50%" }}
                                animate={{ opacity: 1, y: 0, x: "-50%" }}
                                exit={{ opacity: 0, y: 10, x: "-50%" }}
                                style={{
                                  position: "fixed",
                                  top: hoverPos.top - 12,
                                  left: hoverPos.left,
                                  transform: "translate(-50%, -100%)",
                                  marginBottom: 12,
                                  background: "#111827",
                                  borderRadius: 12,
                                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
                                  zIndex: 9999,
                                  overflow: "hidden",
                                  pointerEvents: "none",
                                  border: "1px solid #374151"
                                }}
                              >
                                <BrandSOSBreakdown brands={bbData[row.name]} loading={bbLoading} />
                                <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 12, height: 12, background: "#111827", borderRight: "1px solid #374151", borderBottom: "1px solid #374151" }} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                    </div>
                  )}

                  {visibleKpis.overallSOS && (
                    <div style={{ textAlign: "center" }}><SOSValue value={row.overallSOS} /></div>
                  )}
                  {visibleKpis.overallSOV && activeView === "keyword" && (
                    <div style={{ textAlign: "center" }}><SOSValue value={row.overallSOV} /></div>
                  )}
                  {visibleKpis.organicSOS && (
                    <div style={{ textAlign: "center" }}><SOSValue value={row.organicSOS} /></div>
                  )}
                  {visibleKpis.organicSOV && activeView === "keyword" && (
                    <div style={{ textAlign: "center" }}><SOSValue value={row.organicSOV} /></div>
                  )}
                  {visibleKpis.paidSOS && (
                    <div style={{ textAlign: "center" }}><SOSValue value={row.paidSOS} /></div>
                  )}
                  {visibleKpis.adSOV && activeView === "keyword" && (
                    <div style={{ textAlign: "center" }}><SOSValue value={row.adSOV} /></div>
                  )}
                </div>

                {/* Drilldown Panel — Location Breakdown */}
                {expandedRows[row.name] && (
                  <div style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", animation: "slideDown 0.18s ease" }}>
                    <div style={{ display: "grid", gridTemplateColumns: GRID, minWidth: tableMinWidth, padding: "9px 24px 7px", gap: 8, borderBottom: "1px solid #e2e8f0" }}>
                      <div style={{ paddingLeft: 30, fontSize: 10, fontWeight: 700, color: "#3b82f6", letterSpacing: "0.08em", textTransform: "uppercase" }}>📍 Location Breakdown</div>
                      {visibleKpis.searchVolume && activeView === "keyword" && (
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Search Volume</div>
                      )}
                      {visibleKpis.leadingBrand && activeView === "keyword" && !isSugarUser && <div />}
                      {visibleKpis.overallSOS && <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Overall SOS</div>}
                      {visibleKpis.overallSOV && activeView === "keyword" && <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Overall SOV</div>}
                      {visibleKpis.organicSOS && <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Organic SOS</div>}
                      {visibleKpis.organicSOV && activeView === "keyword" && <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Organic SOV</div>}
                      {visibleKpis.paidSOS && <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Paid SOS</div>}
                      {visibleKpis.adSOV && activeView === "keyword" && <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Ad SOV</div>}
                    </div>

                    {locationLoading[row.name] ? (
                      <div style={{ padding: "20px 0" }}><MiniSpinner /></div>
                    ) : (locationData[row.name] || []).length === 0 ? (
                      <div style={{ padding: "16px 24px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No location data available</div>
                    ) : (
                      (locationData[row.name] || []).map((loc, li) => (
                        <div key={li} style={{ display: "grid", gridTemplateColumns: GRID, minWidth: tableMinWidth, padding: "11px 24px", alignItems: "center", gap: 8, borderBottom: li < (locationData[row.name] || []).length - 1 ? "1px solid #e2e8f0" : "none", background: li % 2 === 0 ? "#f8fafc" : "#f1f5f9" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 30 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6", display: "inline-block", flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: "#334155", fontWeight: 500, textTransform: "capitalize" }}>
                              {['nation', 'national', 'all india', 'india', 'total', 'pan india'].includes(loc.city?.toLowerCase()) ? "Nation" : loc.city}
                            </span>
                          </div>
                          {visibleKpis.searchVolume && activeView === "keyword" && (
                            <div style={{ textAlign: "center" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", background: "#fff", padding: "2px 8px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                                {loc.searchVolume != null && loc.searchVolume > 0 ? Number(loc.searchVolume).toLocaleString() : "—"}
                              </span>
                            </div>
                          )}
                          {visibleKpis.leadingBrand && activeView === "keyword" && !isSugarUser && <div />}
                          {visibleKpis.overallSOS && <div style={{ textAlign: "center" }}><SOSValue value={loc.overallSOS} /></div>}
                          {visibleKpis.overallSOV && activeView === "keyword" && (
                            <div style={{ textAlign: "center" }}><SOSValue value={loc.overallSOV} /></div>
                          )}
                          {visibleKpis.organicSOS && <div style={{ textAlign: "center" }}><SOSValue value={loc.organicSOS} /></div>}
                          {visibleKpis.organicSOV && activeView === "keyword" && (
                            <div style={{ textAlign: "center" }}><SOSValue value={loc.organicSOV} /></div>
                          )}
                          {visibleKpis.paidSOS && <div style={{ textAlign: "center" }}><SOSValue value={loc.paidSOS} /></div>}
                          {visibleKpis.adSOV && activeView === "keyword" && (
                            <div style={{ textAlign: "center" }}><SOSValue value={loc.adSOV} /></div>
                          )}
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
        {!loading && filteredItems.length > 0 && (
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

      {/* Drilldown Modal (SKU/Keyword) */}
      {drilldownModal && (
        <DrilldownModal 
          items={drilldownModal.items} 
          title={drilldownModal.title} 
          loading={drilldownModal.loading} 
          type={drilldownModal.type} 
          keywordTypeFilter={modalKeywordType}
          onKeywordTypeFilterChange={setModalKeywordType}
          onClose={() => { 
            setDrilldownModal(null); 
            setCurrentModalBrand(null); 
            setExpandedKeywordLocations({});
            setKeywordLocationLoading({});
          }} 
          onToggleLocations={toggleKeywordLocations}
          expandedLocs={expandedKeywordLocations}
          locsLoading={keywordLocationLoading}
        />
      )}

      {/* Local Filter Modal - Colorful Two-Pane Theme */}
      <AnimatePresence>
        {isFilterModalOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)" }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              style={{ background: "#f8fafc", borderRadius: 16, width: "100%", maxWidth: 650, height: 460, boxShadow: "0 24px 48px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflow: "hidden" }}
            >
              {/* Header */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter', sans-serif" }}>Filters</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <button
                    onClick={() => setTempLocalFilters({ platform: [], category: [], brand: [] })}
                    style={{ border: "none", background: "none", cursor: "pointer", color: "#0066ff", fontWeight: 600, fontSize: 14, fontFamily: "'Inter', sans-serif" }}
                  >
                    Clear All
                  </button>
                  <button onClick={() => setIsFilterModalOpen(false)} style={{ border: "none", background: "#f1f5f9", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569" }}>
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* Sidebar */}
                <div style={{ width: 220, borderRight: "1px solid #e2e8f0", padding: "16px 0", background: "#f8fafc", overflowY: "auto" }}>
                  {[
                    { id: "Category", label: "Category" },
                    { id: "Brand", label: "Brand" }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setOptionSearch(""); }}
                      style={{
                        width: "100%", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "none",
                        background: activeTab === tab.id ? "#eff6ff" : "transparent",
                        color: activeTab === tab.id ? "#0066ff" : "#64748b",
                        borderLeft: activeTab === tab.id ? "3px solid #0066ff" : "3px solid transparent",
                        cursor: "pointer", fontSize: 14, fontWeight: activeTab === tab.id ? 600 : 500, fontFamily: "'Inter', sans-serif",
                        transition: "all 0.1s"
                      }}
                    >
                      <span>{tab.label}</span>
                      {activeTab === tab.id && <ChevronRight size={16} color="#0066ff" />}
                      {activeTab !== tab.id && <ChevronRight size={16} color="#cbd5e1" />}
                    </button>
                  ))}
                </div>

                {/* Content Pane */}
                <div style={{ flex: 1, padding: 24, overflowY: "auto", background: "#fff" }}>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px 24px", minHeight: 220, position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter', sans-serif" }}>{activeTab}</h4>
                      <button
                        onClick={() => {
                          const keyMap = { "Category": "category", "Brand": "brand" };
                          setTempLocalFilters(prev => ({ ...prev, [keyMap[activeTab]]: [] }));
                        }}
                        style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", fontWeight: 600, fontSize: 13, fontFamily: "'Inter', sans-serif" }}
                      >
                        Reset
                      </button>
                    </div>

                    {/* Checkbox List with Search */}
                    {(() => {
                      const keyMap = { "Category": "category", "Brand": "brand" };
                      const optionMap = { "Category": filterOptions.categories, "Brand": filterOptions.brands };
                      const loadingMap = { "Category": optionsLoading.categories, "Brand": optionsLoading.brands };
                      
                      const filterKey = keyMap[activeTab];
                      const allOptions = optionMap[activeTab] || [];
                      const isLoading = loadingMap[activeTab];
                      const activeValues = tempLocalFilters[filterKey] || [];
                      const filteredOptions = allOptions.filter(o => o.toLowerCase().includes(optionSearch.toLowerCase()));
                      const isNoneSelected = activeValues.includes('__NONE__');
                      const isAllSelected = activeValues.length === 0 || (!isNoneSelected && activeValues.length === allOptions.length);

                      const toggleOption = (opt) => {
                        setTempLocalFilters(prev => {
                          let current = prev[filterKey] || [];
                          const wasNone = current.includes('__NONE__');
                          
                          if (wasNone) {
                            // If they previously deselected all, selecting one should select ONLY that one
                            return { ...prev, [filterKey]: [opt] };
                          }
                          
                          if (current.length === 0) {
                            // If currently in "All" state, clicking one unchecks it
                            return { ...prev, [filterKey]: allOptions.filter(x => x !== opt) };
                          } else if (current.includes(opt)) {
                            const next = current.filter(x => x !== opt);
                            if (next.length === 0) return { ...prev, [filterKey]: ['__NONE__'] };
                            return { ...prev, [filterKey]: next };
                          } else {
                            const next = [...current, opt];
                            if (next.length === allOptions.length) return { ...prev, [filterKey]: [] };
                            return { ...prev, [filterKey]: next };
                          }
                        });
                      };

                      return (
                        <div style={{ display: "flex", flexDirection: "column", height: 260 }}>
                          <div style={{ marginBottom: 16, position: "relative" }}>
                            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: 10 }} />
                            <input 
                              type="text" 
                              placeholder="Search" 
                              value={optionSearch}
                              onChange={e => setOptionSearch(e.target.value)}
                              style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 14, outline: "none", fontFamily: "'Inter', sans-serif" }}
                            />
                          </div>
                          
                          <div style={{ flex: 1, overflowY: "auto", paddingRight: 8 }}>
                            {isLoading ? (
                              <div style={{ padding: 12, color: "#64748b", fontSize: 13, fontFamily: "'Inter', sans-serif" }}>Loading...</div>
                            ) : (
                              <>
                                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 4px", borderBottom: "1px solid #f1f5f9" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                    <input type="checkbox" checked={isAllSelected} onChange={() => setTempLocalFilters(prev => ({...prev, [filterKey]: isAllSelected ? ['__NONE__'] : []}))} style={{ accentColor: "#0066ff", width: 16, height: 16, cursor: "pointer" }} />
                                    <span style={{ fontSize: 14, color: "#334155", fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>Select All</span>
                                  </label>
                                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                    <input type="checkbox" checked={isNoneSelected} onChange={() => setTempLocalFilters(prev => ({...prev, [filterKey]: isNoneSelected ? [] : ['__NONE__']}))} style={{ accentColor: "#ef4444", width: 16, height: 16, cursor: "pointer" }} />
                                    <span style={{ fontSize: 14, color: "#334155", fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>Deselect All</span>
                                  </label>
                                </div>
                                {filteredOptions.map(opt => (
                                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", cursor: "pointer" }}>
                                    <input type="checkbox" checked={isAllSelected || (!isNoneSelected && activeValues.includes(opt))} onChange={() => toggleOption(opt)} style={{ accentColor: "#0066ff", width: 16, height: 16, cursor: "pointer" }} />
                                    <span style={{ fontSize: 14, color: "#475569", fontFamily: "'Inter', sans-serif" }}>{opt}</span>
                                  </label>
                                ))}
                                {filteredOptions.length === 0 && !isLoading && (
                                  <div style={{ padding: "12px 4px", color: "#94a3b8", fontSize: 13, fontFamily: "'Inter', sans-serif" }}>No options found.</div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", background: "#fff" }}>
                <button
                  onClick={() => {
                    setLocalFilters(tempLocalFilters);
                    setPage(0);
                    setIsFilterModalOpen(false);
                  }}
                  style={{ padding: "10px 32px", borderRadius: 8, border: "none", background: "#0066ff", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif", boxShadow: "0 4px 12px rgba(0,102,255,0.25)" }}
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom KPI Columns Modal */}
      <AnimatePresence>
        {isKpiModalOpen && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 2000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)"
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              style={{
                background: "#ffffff", borderRadius: 18, width: "100%", maxWidth: 560,
                boxShadow: "0 24px 48px -12px rgba(15,23,42,0.25)",
                display: "flex", flexDirection: "column", overflow: "hidden",
                border: "1px solid #e2e8f0"
              }}
            >
              {/* Header */}
              <div style={{
                padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9",
                display: "flex", justifyContent: "space-between", alignItems: "flex-start"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: "#eff6ff",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <SlidersHorizontal size={18} color="#2563eb" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter', sans-serif" }}>
                      Custom KPI Columns
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>
                      Select the KPI columns you want to display in the table
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsKpiModalOpen(false)}
                  style={{
                    border: "none", background: "#f1f5f9", borderRadius: "50%",
                    width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "#64748b"
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Quick Actions Bar */}
              <div style={{
                padding: "10px 24px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
                display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>
                  {availableKpisForModal.filter(k => tempVisibleKpis[k.id]).length} of {availableKpisForModal.length} selected
                </span>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const allOn = {};
                      availableKpisForModal.forEach(k => { allOn[k.id] = true; });
                      setTempVisibleKpis(prev => ({ ...prev, ...allOn }));
                    }}
                    style={{ border: "none", background: "none", color: "#2563eb", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 4px" }}
                  >
                    Select All
                  </button>
                  <span style={{ color: "#cbd5e1" }}>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const first = availableKpisForModal[0]?.id;
                      const allOff = {};
                      availableKpisForModal.forEach(k => { allOff[k.id] = (k.id === first); });
                      setTempVisibleKpis(prev => ({ ...prev, ...allOff }));
                    }}
                    style={{ border: "none", background: "none", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 4px" }}
                  >
                    Deselect All
                  </button>
                  <span style={{ color: "#cbd5e1" }}>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTempVisibleKpis(DEFAULT_VISIBLE_KPIS);
                    }}
                    style={{ border: "none", background: "none", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 4px" }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* KPI Checkboxes Grid */}
              <div style={{ padding: 20, maxHeight: 380, overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {availableKpisForModal.map(kpi => {
                    const isChecked = !!tempVisibleKpis[kpi.id];
                    return (
                      <div
                        key={kpi.id}
                        onClick={() => {
                          const currentlySelected = availableKpisForModal.filter(k => tempVisibleKpis[k.id]);
                          if (isChecked && currentlySelected.length <= 1) {
                            return;
                          }
                          setTempVisibleKpis(prev => ({ ...prev, [kpi.id]: !prev[kpi.id] }));
                        }}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px",
                          borderRadius: 12, border: `1.5px solid ${isChecked ? "#3b82f6" : "#e2e8f0"}`,
                          background: isChecked ? "#f0f7ff" : "#ffffff",
                          cursor: "pointer", transition: "all 0.15s ease",
                          userSelect: "none"
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: 5, marginTop: 2,
                          border: `1.5px solid ${isChecked ? "#2563eb" : "#cbd5e1"}`,
                          background: isChecked ? "#2563eb" : "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, transition: "all 0.15s"
                        }}>
                          {isChecked && <Check size={12} color="#fff" strokeWidth={3} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: isChecked ? "#1e3a8a" : "#334155" }}>
                              {kpi.label}
                            </span>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                              background: kpi.group === "SOV" ? "#dbeafe" : (kpi.group === "SOS" ? "#fef3c7" : (kpi.group === "Volume" ? "#e0e7ff" : (kpi.group === "Sales" ? "#dcfce7" : "#f1f5f9"))),
                              color: kpi.group === "SOV" ? "#1e40af" : (kpi.group === "SOS" ? "#92400e" : (kpi.group === "Volume" ? "#3730a3" : (kpi.group === "Sales" ? "#166534" : "#475569")))
                            }}>
                              {kpi.group}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: 11, color: "#64748b", lineHeight: 1.3 }}>
                            {kpi.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: "14px 24px", borderTop: "1px solid #e2e8f0",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#f8fafc"
              }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  At least 1 KPI must remain selected
                </span>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setIsKpiModalOpen(false)}
                    style={{
                      padding: "8px 18px", borderRadius: 8, border: "1px solid #cbd5e1",
                      background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600,
                      cursor: "pointer", fontFamily: "'Inter', sans-serif"
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateVisibleKpis(tempVisibleKpis);
                      setIsKpiModalOpen(false);
                    }}
                    style={{
                      padding: "8px 22px", borderRadius: 8, border: "none",
                      background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 700,
                      cursor: "pointer", fontFamily: "'Inter', sans-serif",
                      boxShadow: "0 2px 8px rgba(37,99,235,0.3)"
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Visibility Trends & Competition Drawer */}
      {isTrendDrawerOpen && (
        <VisibilityTrendsCompetitionDrawer
          open={isTrendDrawerOpen}
          onClose={() => setIsTrendDrawerOpen(false)}
          initialFilters={trendDrawerFilters}
          initialAudience="Keyword"
        />
      )}
      </>
      )}
    </div>
  );
}
