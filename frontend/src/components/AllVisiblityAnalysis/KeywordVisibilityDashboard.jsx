import React, { useState, useContext, useMemo } from "react";
import { FilterContext } from "../../utils/FilterContext";
import { Inbox } from "lucide-react";
import { GainersDrainersSkeleton } from './VisibilitySkeletons';

/* ─── Fonts ───────────────── */
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
  `}</style>
);

/* ─── No Data ───────────────── */
const NoDataAvailable = ({ title = 'No data available' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: '#94a3b8' }}>
    <Inbox size={48} strokeWidth={1.2} style={{ marginBottom: 12, color: '#cbd5e1' }} />
    <p style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>{title}</p>
    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Try adjusting your filters or check back later.</p>
  </div>
);

/* ─── SOS Cell ───────────────── */
function SosCell({ value, delta, color }) {
  const positive = delta > 0;

  return (
    <div style={{ textAlign: "right" }}>
      <div style={{
        fontFamily: "'DM Mono', monospace",
        fontWeight: 600,
        fontSize: 14
      }}>
        {value.toFixed(1)}%
      </div>

      <div style={{
        fontSize: 12,
        color: positive ? "#22863a" : "#cb2431"
      }}>
        {positive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
      </div>
    </div>
  );
}

/* ─── Expand Row ───────────────── */
function ExpandableRow({ title, children, indentLevel = 0, disableExpand = false }) {
  const [open, setOpen] = useState(false);

  // Brand-level row (indentLevel 0): show "+ Show Keywords" / "+ Hide Keywords" below the row
  if (indentLevel === 0) {
    return (
      <>
        <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
          <td style={{ padding: "12px 14px", fontWeight: 500, fontSize: 14 }}>
            <div>{title}</div>
            <div
              onClick={() => setOpen(!open)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                marginTop: 5, cursor: "pointer",
                color: "#3b82f6", fontSize: 12, fontWeight: 600,
                userSelect: "none"
              }}
            >
              <span style={{ fontSize: 13 }}>{open ? "−" : "+"}</span>
              {open ? "Hide Keywords" : "Show Keywords"}
            </div>
          </td>
          <td style={{ padding: 10, verticalAlign: "top" }}>
            {children[0]}
          </td>
        </tr>
        {open && children.slice(1)}
      </>
    );
  }

  // Keyword-level row (indentLevel 1): keep small chevron for location drill
  return (
    <>
      <tr
        onClick={() => { if (!disableExpand) setOpen(!open); }}
        style={{
          cursor: disableExpand ? "default" : "pointer",
          borderBottom: "1px solid #f3f4f6",
          transition: "background 0.1s"
        }}
        className={disableExpand ? "" : "hover:bg-slate-50"}
      >
        <td style={{
          padding: "12px 14px",
          paddingLeft: 14 + (indentLevel * 20),
          fontWeight: 500,
          fontSize: 14 - (indentLevel * 1)
        }}>
          {!disableExpand ? (
            <span style={{
              display: "inline-block",
              width: 14,
              transition: "transform 0.2s",
              transform: open ? "rotate(90deg)" : "rotate(0deg)"
            }}>
              ▶
            </span>
          ) : (
            <span style={{ display: "inline-block", width: 14 }}></span>
          )} {title}
        </td>
        <td style={{ padding: 10 }}>
          {children[0]}
        </td>
      </tr>

      {open && !disableExpand && children.slice(1)}
    </>
  );
}

/* ─── Table ───────────────── */
function SOSTable({ data, type, isGain, title, shouldShowDrilldown }) {

  const getVal = (b) => {
    if (type === "organic") return [b.organic, b.dOrganic];
    if (type === "paid") return [b.paid, b.dPaid];
    return [b.overall, b.dOverall];
  };

  const getKwVal = (k) => {
    if (type === "organic") return [k.organic, k.dOr];
    if (type === "paid") return [k.paid, k.dP];
    return [k.overall, k.dO];
  };

  return (
    <div style={{
      flex: 1,
      background: "#fff",
      borderRadius: 12,
      border: "1px solid #e5e7eb",
      overflow: "hidden"
    }}>
      <div style={{
        padding: 12,
        borderBottom: "1px solid #eee",
        fontWeight: 600,
        background: "#f8fafc"
      }}>
        {title}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            <th style={{ textAlign: "left", padding: 10, fontSize: 11, textTransform: "uppercase", color: "#64748b" }}>
              Brand / Keyword / Location
            </th>
            <th style={{ textAlign: "right", padding: 10, fontSize: 11, textTransform: "uppercase", color: "#64748b" }}>
              {type.toUpperCase()} SOS
            </th>
          </tr>
        </thead>

        <tbody>
          {data.map((b, i) => {
            const [val, delta] = getVal(b);

            return (
              <ExpandableRow key={i} title={b.platform ? `${b.brand} (${b.platform})` : b.brand} indentLevel={0}>
                <SosCell value={val} delta={delta} color={isGain ? "#22863a" : "#e24b4a"} />

                {(b.keywords || []).map((k, ki) => {
                  const [kVal, kDelta] = getKwVal(k);

                  return (
                    <ExpandableRow key={ki} title={k.kw} indentLevel={1} disableExpand={!shouldShowDrilldown}>
                      <SosCell value={kVal} delta={kDelta} color={isGain ? "#22863a" : "#e24b4a"} />

                      {(k.locations || []).filter(l => l.loc && l.loc.toLowerCase() !== 'other' && l.loc.toLowerCase() !== 'others').map((l, li) => {
                        const [lVal, lDelta] = getKwVal(l);

                        return (
                          <tr key={li} style={{ borderBottom: "1px solid #f3f4f6", background: "#f9fafb" }}>
                            <td style={{ padding: "10px 14px 10px 54px", fontSize: 13, color: "#475569" }}>
                              • {l.loc}
                            </td>
                            <td style={{ padding: 10 }}>
                              <SosCell value={lVal} delta={lDelta} color={isGain ? "#22863a" : "#e24b4a"} />
                            </td>
                          </tr>
                        );
                      })}
                    </ExpandableRow>
                  );
                })}
              </ExpandableRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main ───────────────── */
export default function KeywordVisibilityDashboard({ apiData, loading }) {
  const { platform: globalPlatform } = useContext(FilterContext);

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

  const [type, setType] = useState("overall");

  // Show skeleton while loading
  if (loading) {
    return <GainersDrainersSkeleton />;
  }

  // No data state
  if (!apiData || (!apiData.gain?.length && !apiData.drain?.length)) {
    return (
      <div style={{ padding: 24, background: "#f8fafc", borderRadius: 20, border: "1px solid #e2e8f0", marginTop: 24, fontFamily: "'DM Sans', sans-serif" }}>
        <FontLoader />
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>Share of Search — Gainers & Drainers</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Side-by-side comparison of SOS growth and decline</p>
        <NoDataAvailable title="No gainers & drainers data available" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: "#f8fafc", borderRadius: 20, border: "1px solid #e2e8f0", marginTop: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <FontLoader />

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>Share of Search — Gainers & Drainers</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Side-by-side comparison of SOS growth and decline</p>

      {/* Toggle */}
      <div style={{ marginBottom: 20, display: "flex", gap: 8 }}>
        {["overall", "organic", "paid"].map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.2s",
              border: "1px solid " + (type === t ? "#0f172a" : "#e2e8f0"),
              background: type === t ? "#0f172a" : "#fff",
              color: type === t ? "#fff" : "#475569",
              cursor: "pointer"
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tables */}
      <div style={{ display: "flex", gap: 16, flexDirection: "row" }}>
        <SOSTable data={apiData.gain || []} type={type} isGain={true} title="Top Gainers" shouldShowDrilldown={shouldShowDrilldown} />
        <SOSTable data={apiData.drain || []} type={type} isGain={false} title="Top Drainers" shouldShowDrilldown={shouldShowDrilldown} />
      </div>
    </div>
  );
}
