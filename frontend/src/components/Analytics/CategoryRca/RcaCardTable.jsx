import React, { useEffect, useMemo, useRef, useState, memo, useCallback } from "react";
// Removed framer-motion animations for performance

/**
 * Horizontal RCA Card Lanes (Category → City → SKU)
 * - 3 horizontal lanes always visible
 * - High-contrast, readable typography
 * - Premium card styling
 * - Slow horizontal scroll (wheel-to-horizontal + easing)
 * - Cards show 3–4 KPIs by default; "View more" expands inside the card
 *
 * NOTE: Sample data only. Replace DATA with API data.
 */

// ---------------------------
// Sample Data (bigger + richer)
// ---------------------------
const fmtInr = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹ ${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹ ${(n / 1e5).toFixed(2)} L`;
  return `₹ ${n.toLocaleString("en-IN")}`;
};
const fmtPct = (n) => `${n.toFixed(1)}%`;
const fmtNum = (n) => n.toLocaleString("en-IN");

const rand = (min, max) => Math.round(min + Math.random() * (max - min));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const mkKpis = () => {
  const offtake = rand(2_50_000, 55_00_000);
  const spend = rand(40_000, 9_20_000);
  const roas = Math.max(0.7, Math.round((offtake / Math.max(1, spend)) * 10) / 10);
  const osa = rand(58, 97);
  const sos = rand(6, 42);
  const cvr = Math.round((Math.random() * 5 + 1.8) * 10) / 10;

  const d = () => Math.round((Math.random() * 30 - 15) * 10) / 10;

  return {
    offtake: { v: fmtInr(offtake), d: d() },
    osa: { v: fmtPct(osa), d: d() },
    spend: { v: fmtInr(spend), d: d() },
    roas: { v: roas.toFixed(1), d: d() },
    sos: { v: fmtPct(sos), d: d() },
    cvr: { v: fmtPct(cvr), d: d() },
  };
};

const mkData = () => {
  const categories = ["Magnum", "Core Tub", "Cornetto", "Kulfi", "Family Pack", "Stick", "Cone", "Mini"];
  const cities = [
    "Delhi",
    "Gurgaon",
    "Noida",
    "Mumbai",
    "Pune",
    "Bengaluru",
    "Hyderabad",
    "Chennai",
    "Kolkata",
    "Ahmedabad",
    "Jaipur",
    "Lucknow",
  ];
  const flavours = ["Chocolate", "Almond", "Mango", "Vanilla", "Strawberry", "Cookie", "Coffee", "Butterscotch"];
  const skuTypes = ["Classic", "Gold", "Mini", "XL", "Duo", "Bites"];
  const packs = ["80ml", "90ml", "100ml", "125ml", "500ml", "700ml", "1L"];

  const out = categories.map((c, i) => {
    const cityCount = rand(4, 6); // Reduced from 8-12 for performance
    const cityList = Array.from({ length: cityCount }).map((_, ci) => {
      const cityName = cities[(i * 3 + ci) % cities.length] + (Math.random() < 0.18 ? " (U)" : "");
      const skuCount = rand(4, 6); // Reduced from 10-18 for performance
      const skuList = Array.from({ length: skuCount }).map((__, si) => {
        const sName = `${c} ${pick(skuTypes)} ${pick(flavours)} ${pick(packs)}`;
        return {
          id: `sku-${i}-${ci}-${si}`,
          name: sName,
          kpis: mkKpis(),
          meta: {
            pack: pick(packs),
            rating: (Math.round((Math.random() * 1.2 + 3.6) * 10) / 10).toFixed(1),
            reviews: fmtNum(rand(1200, 98000)),
          },
        };
      });

      return {
        id: `city-${i}-${ci}`,
        name: cityName,
        kpis: mkKpis(),
        skus: skuList,
      };
    });

    return {
      id: `cat-${i}`,
      name: c,
      kpis: mkKpis(),
      cities: cityList,
    };
  });

  return out;
};

const DATA = mkData();

// Memoized outside component to avoid recreation

// ---------------------------
// Wheel-to-horizontal scroll hook (improved)
// ---------------------------
function useSlowHScroll(ref, deps = []) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e) => {
      // Skip if user is scrolling horizontally with trackpad
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      // Convert vertical scroll to horizontal
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * 1.5; // Faster scroll multiplier
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...deps]);
}

// ---------------------------
// UI Bits
// ---------------------------
function Delta({ d }) {
  const up = d >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: 0.2,
        color: up ? "#065f46" : "#9f1239",
        background: up ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)",
        border: `1px solid ${up ? "rgba(16,185,129,0.24)" : "rgba(244,63,94,0.24)"}`,
      }}
    >
      <span style={{ fontSize: 12 }}>{up ? "▲" : "▼"}</span>
      <span>{Math.abs(d).toFixed(1)}%</span>
    </span>
  );
}

function MiniKpi({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 500, color: "#475569" }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

function LaneHeader({ title, subtitle, right }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 10,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 950,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#64748b",
          }}
        >
          {subtitle}
        </div>
        <div style={{ fontSize: 18, fontWeight: 1000, color: "#0f172a" }}>{title}</div>
      </div>
      {right}
    </div>
  );
}

function Breadcrumb({ category, city, onReset }) {
  const pill = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.9)",
    color: "#0f172a",
    boxShadow: "0 12px 30px -22px rgba(15,23,42,0.35)",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={pill}>All</span>
      <span style={{ color: "#94a3b8", fontWeight: 900 }}>›</span>
      <span style={pill}>{category?.name || "Select Category"}</span>
      <span style={{ color: "#94a3b8", fontWeight: 900 }}>›</span>
      <span style={pill}>{city?.name || "Select City"}</span>
      <button
        onClick={onReset}
        style={{
          marginLeft: 6,
          padding: "8px 12px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 950,
          border: "1px solid rgba(79,70,229,0.22)",
          background: "rgba(79,70,229,0.08)",
          color: "#3730a3",
          cursor: "pointer",
        }}
      >
        Reset
      </button>
    </div>
  );
}

// ---------------------------
// Premium Card - Memoized for performance
// ---------------------------
const PremiumCard = memo(function PremiumCard({
  kind,
  title,
  sub,
  accent,
  selected,
  disabled,
  kpis,
  expanded,
  onToggleExpand,
  onClick,
  footerLeft,
  footerRight,
}) {
  const accentMap = {
    indigo: "#4f46e5",
    emerald: "#10b981",
    cyan: "#06b6d4",
    violet: "#8b5cf6",
    amber: "#f59e0b",
  };
  const a = accentMap[accent] || accentMap.indigo;

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      style={{
        flexShrink: 0,
        borderRadius: 26,
        background: "#ffffff",
        border: "1px solid rgba(15,23,42,0.10)",
        boxShadow: "0 20px 55px -42px rgba(15,23,42,0.32)",
        overflow: "hidden",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        position: "relative",
      }}
    >
      {/* Accent glow */}
      <div
        style={{
          position: "absolute",
          inset: -1,
          background: `radial-gradient(600px 140px at 40% 0%, ${a}1F, transparent 55%)`,
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          position: "relative",
          padding: "16px 16px 10px",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 950,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            {sub}
          </div>
          <div
            title={title}
            style={{
              marginTop: 6,
              fontSize: 18,
              fontWeight: 600,
              color: "#0f172a",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Delta d={kpis.offtake.d} />
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: selected ? a : "rgba(15,23,42,0.16)",
              boxShadow: selected ? `0 0 0 6px ${a}14` : "none",
            }}
          />
        </div>
      </div>

      {/* Main KPI */}
      <div style={{ position: "relative", padding: "14px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: "#475569" }}>Offtake</div>
            <div style={{ marginTop: 2, fontSize: 30, fontWeight: 1050, color: "#0f172a", letterSpacing: "-0.03em" }}>
              {kpis.offtake.v}
            </div>
          </div>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 18,
              border: "1px solid rgba(15,23,42,0.10)",
              background: "rgba(248,250,252,0.9)",
              minWidth: 120,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 950, color: "#64748b", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              ROAS
            </div>
            <div style={{ marginTop: 2, fontSize: 16, fontWeight: 1000, color: "#0f172a" }}>{kpis.roas.v}</div>
            <div style={{ marginTop: 2, fontSize: 12, fontWeight: 900, color: "#64748b" }}>{fmtPct(kpis.roas.d)}</div>
          </div>
        </div>

        {/* 3 key KPIs row */}
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 18,
            border: "1px solid rgba(15,23,42,0.08)",
            background: "rgba(248,250,252,0.92)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <MiniKpi label="Wt. OSA" value={`${kpis.osa.v} (${kpis.osa.d >= 0 ? "+" : "-"}${Math.abs(kpis.osa.d).toFixed(1)}%)`} />
          <MiniKpi label="Ad Spend" value={`${kpis.spend.v}`} />
          <MiniKpi label="SOS" value={`${kpis.sos.v}`} />
          <MiniKpi label="CVR" value={`${kpis.cvr.v}`} />
        </div>

        {/* View more */}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12.5, fontWeight: 850, color: "#64748b" }}>{footerLeft}</div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: `1px solid ${selected ? a + "33" : "rgba(15,23,42,0.10)"}`,
              background: selected ? a + "14" : "rgba(255,255,255,0.9)",
              color: selected ? "#1e1b4b" : "#0f172a",
              fontSize: 12,
              fontWeight: 1000,
              cursor: "pointer",
            }}
          >
            {expanded ? "View less" : "View more"}
          </button>
        </div>

        {/* Expanded body */}
        {expanded ? (
          <div
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 18,
                border: "1px solid rgba(15,23,42,0.08)",
                background: "rgba(255,255,255,0.92)",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.16em", textTransform: "uppercase", color: "#64748b" }}>
                Details
              </div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <MiniKpi label="Insight" value={kpis.osa.d < 0 ? "OSA drag detected" : "Efficiency healthy"} />
                <MiniKpi label="Suggested action" value={kpis.sos.d < 0 ? "Boost SOS in top keywords" : "Hold, optimize spend"} />
                <div style={{ gridColumn: "span 2" }}>
                  <MiniKpi label="Notes" value={footerRight || "Open trends for deeper RCA"} />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});

// ---------------------------
// Lane container
// ---------------------------
function Lane({ title, subtitle, hint, children, laneRef, cardCount = 0 }) {
  const enableScroll = cardCount > 3;
  return (
    <div
      style={{
        padding: "18px 0 8px 18px",
        borderRadius: 26,
        border: "1px solid rgba(15,23,42,0.10)",
        background: "rgba(255,255,255,0.82)",
        boxShadow: "0 30px 70px -55px rgba(15,23,42,0.40)",
        backdropFilter: "blur(10px)",
        overflow: "hidden",
      }}
    >
      <style>{`
        .lane-scroll {
          scrollbar-width: auto;
          scrollbar-color: rgba(79, 70, 229, 0.6) rgba(15, 23, 42, 0.08);
        }
        .lane-scroll::-webkit-scrollbar {
          height: 12px;
          display: block !important;
        }
        .lane-scroll::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.08);
          border-radius: 10px;
        }
        .lane-scroll::-webkit-scrollbar-thumb {
          background: rgba(79, 70, 229, 0.6);
          border-radius: 10px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .lane-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(79, 70, 229, 0.9);
          background-clip: content-box;
        }
      `}</style>
      <LaneHeader
        title={title}
        subtitle={subtitle}
        right={<div style={{ fontSize: 12.5, fontWeight: 850, color: "#64748b" }}>{hint}</div>}
      />

      <div
        ref={laneRef}
        className={enableScroll ? "lane-scroll" : ""}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          overflowX: enableScroll ? "auto" : "visible",
          overflowY: "hidden",
          paddingBottom: 18,
          paddingTop: 12,
          paddingLeft: 4,
          paddingRight: enableScroll ? 50 : 4,
          minHeight: 100,
          flexWrap: enableScroll ? "nowrap" : "wrap",
        }}
      >
        {children}
        {/* Spacer to ensure last card is fully visible */}
        {enableScroll && <div style={{ minWidth: 20, flexShrink: 0 }} />}
      </div>

      {/* Edge fade - left only */}
      <div
        style={{
          position: "relative",
          marginTop: -10,
          height: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: -120,
            width: 46,
            height: 100,
            background: "linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0))",
            pointerEvents: "none",
          }}
        />
        {/* Right fade removed to show last card fully */}
      </div>
    </div>
  );
}

// ---------------------------
// Main
// ---------------------------
export default function RcaCardTable() {
  const [selectedCatId, setSelectedCatId] = useState(DATA[0].id);
  const [selectedCityId, setSelectedCityId] = useState(null);

  const [expanded, setExpanded] = useState({});

  const cat = useMemo(() => DATA.find((x) => x.id === selectedCatId) || DATA[0], [selectedCatId]);
  const cities = cat?.cities || [];
  const city = useMemo(() => (selectedCityId ? cities.find((x) => x.id === selectedCityId) : null), [selectedCityId, cities]);
  const skus = city?.skus || [];

  const catLaneRef = useRef(null);
  const cityLaneRef = useRef(null);
  const skuLaneRef = useRef(null);

  useSlowHScroll(catLaneRef);
  useSlowHScroll(cityLaneRef, [selectedCatId]); // Re-attach when category changes
  useSlowHScroll(skuLaneRef, [selectedCityId]); // Re-attach when city changes

  // Memoized handlers to prevent child re-renders
  const toggleExpand = useCallback((key) => setExpanded((p) => ({ ...p, [key]: !p[key] })), []);

  const handleCatClick = useCallback((catId) => {
    setSelectedCatId(catId);
    setSelectedCityId(null);
  }, []);

  const handleCityClick = useCallback((cityId) => {
    setSelectedCityId(cityId);
  }, []);

  const reset = useCallback(() => {
    setSelectedCatId(DATA[0].id);
    setSelectedCityId(null);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#f8fafc",
        padding: "28px 0", // Vertical padding only, horizontal handled by containers
        fontFamily: "Inter, ui-sans-serif, system-ui",
        overflowX: "hidden",
        overflowY: "auto",
      }}
    >
      {/* Top header */}
      <div
        style={{
          width: "100%",
          maxWidth: 1480,
          margin: "0 auto",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16,
          padding: "0 18px",
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.18em", textTransform: "uppercase", color: "#64748b" }}>
            RCA Drill | Horizontal lanes
          </div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 1050, color: "#0f172a", letterSpacing: "-0.03em" }}>
            Category → City → SKU
          </div>
        </div>

        <Breadcrumb category={cat} city={city} onReset={reset} />
      </div>

      <div style={{ width: "100%", maxWidth: 1480, margin: "0 auto", display: "grid", gap: 14, padding: "0 18px" }}>
        {/* CATEGORY LANE */}
        <Lane
          title="Categories"
          subtitle="Lane 1"
          hint="Scroll slowly (wheel) →"
          laneRef={catLaneRef}
          cardCount={DATA.length}
        >
          {DATA.map((c) => {
            const key = `cat:${c.id}`;
            const selected = selectedCatId === c.id;
            return (
              <PremiumCard
                key={c.id}
                kind="category"
                title={c.name}
                sub="Category"
                accent="indigo"
                selected={selected}
                disabled={false}
                kpis={c.kpis}
                expanded={!!expanded[key]}
                onToggleExpand={() => toggleExpand(key)}
                onClick={() => handleCatClick(c.id)}
                footerLeft={`${fmtNum(c.cities.length)} cities`}
                footerRight="Double-click card for trends (demo)"
              />
            );
          })}
        </Lane>

        {/* CITY LANE */}
        <div key={selectedCatId}>
          <Lane title="Cities" subtitle="Lane 2" hint={cat ? `Filtered by: ${cat.name}` : "Select a category"} laneRef={cityLaneRef} cardCount={cities.length}>
            {cities.map((c) => {
              const key = `city:${selectedCatId}:${c.id}`;
              const selected = selectedCityId === c.id;
              return (
                <PremiumCard
                  key={c.id}
                  kind="city"
                  title={c.name}
                  sub={`City • ${cat?.name}`}
                  accent="violet"
                  selected={selected}
                  disabled={false}
                  kpis={c.kpis}
                  expanded={!!expanded[key]}
                  onToggleExpand={() => toggleExpand(key)}
                  onClick={() => handleCityClick(c.id)}
                  footerLeft={`${fmtNum(c.skus.length)} skus`}
                  footerRight="Top SKUs are below"
                />
              );
            })}

            {/* If no city selected show a helper card */}
            {!cities.length ? (
              <div style={{ padding: 18, fontSize: 14, fontWeight: 900, color: "#64748b" }}>No cities</div>
            ) : null}
          </Lane>
        </div>

        {/* SKU LANE */}
        <div key={selectedCityId || "none"}>
          <Lane
            title="SKUs"
            subtitle="Lane 3"
            hint={city ? `Filtered by: ${cat?.name} • ${city?.name}` : "Select a city"}
            laneRef={skuLaneRef}
            cardCount={skus.length}
          >
            {skus.map((s) => {
              const key = `sku:${selectedCatId}:${selectedCityId}:${s.id}`;
              return (
                <PremiumCard
                  key={s.id}
                  kind="sku"
                  title={s.name}
                  sub={`SKU • ${city?.name || ""}`}
                  accent="cyan"
                  selected={false}
                  disabled={!city}
                  kpis={s.kpis}
                  expanded={!!expanded[key]}
                  onToggleExpand={() => toggleExpand(key)}
                  onClick={() => { }}
                  footerLeft={`⭐ ${s.meta.rating} • ${s.meta.reviews} reviews`}
                  footerRight="Tap for SKU details"
                />
              );
            })}

            {!city ? (
              <div
                style={{
                  minWidth: 360,
                  borderRadius: 26,
                  border: "1px dashed rgba(15,23,42,0.18)",
                  background: "rgba(255,255,255,0.7)",
                  padding: 18,
                  color: "#64748b",
                  fontWeight: 950,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Select a city to load SKUs
              </div>
            ) : null}
          </Lane>
        </div>

        {/* Footer hint */}
        <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 850, color: "#64748b" }}>
          UX detail: wheel scrolling inside each lane moves horizontally and is slowed down. Cards keep names large and readable.
        </div>
      </div>
    </div>
  );
}
