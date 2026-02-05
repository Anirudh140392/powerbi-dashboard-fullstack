import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";

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
    const cityCount = rand(8, 12);
    const cityList = Array.from({ length: cityCount }).map((_, ci) => {
      const cityName = cities[(i * 3 + ci) % cities.length] + (Math.random() < 0.18 ? " (U)" : "");
      const skuCount = rand(10, 18);
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

// ---------------------------
// Motion Tokens
// ---------------------------
const spring = { type: "spring", stiffness: 240, damping: 22, mass: 0.85 };
const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
};

// ---------------------------
// Slow wheel-to-horizontal scroll hook
// ---------------------------
function useSlowHScroll(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e) => {
      if (e.deltaY === 0) return;
      // If we are scrolling vertically, we convert it to horizontal
      // but only if there's no significant horizontal intent
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        // Don't preventDefault here to allow page scroll if at the end of the lane
        // but it might feel better for lanes to "capture" the wheel
        e.preventDefault();
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
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
// Premium Card
// ---------------------------
function PremiumCard({
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
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      whileHover={!disabled ? { y: -8, scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.995 } : undefined}
      onClick={!disabled ? onClick : undefined}
      style={{
        flexShrink: 0,
        borderRadius: 26,
        background: "#ffffff",
        border: selected ? `2px solid ${a}` : "1px solid rgba(15,23,42,0.10)",
        boxShadow: selected
          ? `0 26px 64px -36px rgba(79,70,229,0.55), 0 18px 40px -28px rgba(15,23,42,0.35)`
          : "0 20px 55px -42px rgba(15,23,42,0.32)",
        overflow: "hidden",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : selected ? 1 : 0.92,
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
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="expanded"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring}
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
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ---------------------------
// Lane container
// ---------------------------
function Lane({ title, subtitle, hint, children, laneRef }) {
  return (
    <div className="relative p-4 sm:p-6 rounded-[2.5rem] border border-slate-200/60 bg-white/80 shadow-[0_30px_70px_-55px_rgba(15,23,42,0.3)] backdrop-blur-xl overflow-hidden">
      <style>{`
        .lane-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(79, 70, 229, 0.3) rgba(15, 23, 42, 0.02);
        }
        .lane-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .lane-scroll::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.02);
          border-radius: 10px;
        }
        .lane-scroll::-webkit-scrollbar-thumb {
          background: rgba(79, 70, 229, 0.3);
          border-radius: 10px;
          border: 1px solid transparent;
          background-clip: content-box;
        }
        .lane-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(79, 70, 229, 0.6);
        }
      `}</style>

      <LaneHeader
        title={title}
        subtitle={subtitle}
        right={<div className="text-[11px] sm:text-[12px] font-black text-slate-400 tracking-wider hidden sm:block">{hint}</div>}
      />

      <div
        ref={laneRef}
        className="lane-scroll flex items-start gap-4 sm:gap-6 overflow-x-auto pb-5 pt-3 sm:px-2 scroll-smooth no-scrollbar sm:custom-scrollbar"
      >
        {children}
      </div>

      {/* Edge fades for desktop */}
      <div className="hidden sm:block pointer-events-none">
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white/60 to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white/60 to-transparent z-10" />
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

  const toggleExpand = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const reset = () => {
    setSelectedCatId(DATA[0].id);
    setSelectedCityId(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#fcfdfe] py-6 sm:py-10 font-sans overflow-x-hidden overflow-y-auto">
      {/* Top Header Section */}
      <div className="w-full max-w-[1520px] mx-auto px-4 sm:px-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8 sm:mb-12">
        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="text-[10px] sm:text-[11px] font-black tracking-[0.2em] uppercase text-indigo-400 mb-1.5">
            RCA Drill | Horizontal Analysis
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-none">
            Category <span className="text-indigo-600">→</span> City <span className="text-indigo-600">→</span> SKU
          </h1>
        </div>

        <div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-150">
          <Breadcrumb category={cat} city={city} onReset={reset} />
        </div>
      </div>

      {/* Main Content Areas - Lanes */}
      <div className="w-full max-w-[1520px] mx-auto px-4 sm:px-8 grid grid-cols-1 gap-10 sm:gap-14">
        {/* CATEGORY LANE */}
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
          <Lane
            title="Categories"
            subtitle="Step 1"
            hint="Select a category to drill down"
            laneRef={catLaneRef}
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
                  onClick={() => {
                    setSelectedCatId(c.id);
                    setSelectedCityId(null);
                  }}
                  footerLeft={`${fmtNum(c.cities.length)} cities available`}
                  footerRight="Expansion shows localized performance"
                />
              );
            })}
          </Lane>
        </div>

        {/* CITY LANE */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={selectedCatId}
            {...fadeUp}
            transition={spring}
            className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-400"
          >
            <Lane
              title="Cities"
              subtitle="Step 2"
              hint={cat ? `Performance for ${cat.name}` : "Please select a category first"}
              laneRef={cityLaneRef}
            >
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
                    onClick={() => setSelectedCityId(c.id)}
                    footerLeft={`${fmtNum(c.skus.length)} skus detected`}
                    footerRight="Reviewing city-level distribution"
                  />
                );
              })}

              {!cities.length && (
                <div className="flex items-center justify-center min-w-[300px] h-[200px] text-slate-400 font-bold italic">
                  No cities found for this category.
                </div>
              )}
            </Lane>
          </motion.div>
        </AnimatePresence>

        {/* SKU LANE */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={selectedCityId || "none"}
            {...fadeUp}
            transition={spring}
            className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-500"
          >
            <Lane
              title="SKUs"
              subtitle="Step 3"
              hint={city ? `SKUs in ${city?.name}` : "Select a city to view top SKUs"}
              laneRef={skuLaneRef}
            >
              {city ? (
                skus.map((s) => {
                  const key = `sku:${selectedCatId}:${selectedCityId}:${s.id}`;
                  return (
                    <PremiumCard
                      key={s.id}
                      kind="sku"
                      title={s.name}
                      sub={`SKU Detail`}
                      accent="cyan"
                      selected={false}
                      disabled={false}
                      kpis={s.kpis}
                      expanded={!!expanded[key]}
                      onToggleExpand={() => toggleExpand(key)}
                      onClick={() => { }}
                      footerLeft={`⭐ ${s.meta.rating} • ${s.meta.reviews} reviews`}
                      footerRight="SKU-specific RCA insights"
                    />
                  );
                })
              ) : (
                <div className="flex-1 min-h-[160px] min-w-full flex items-center justify-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30 text-slate-300 font-black uppercase tracking-widest text-sm">
                  Select a city above to load deep-dive data
                </div>
              )}
            </Lane>
          </motion.div>
        </AnimatePresence>

        {/* Page Footer Info */}
        <div className="text-center pb-10">
          <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">
            Analysis complete • Data refreshed 2 mins ago
          </p>
        </div>
      </div>
    </div>
  );
}
