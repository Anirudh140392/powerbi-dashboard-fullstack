import React, { useEffect, useMemo, useRef, useState } from "react";
import RCATree from "./RCATree";

// Guided RCA drill with floating breadcrumb rail (Category -> City -> SKU -> RCA)

// -------------------- Sample Data --------------------
const SAMPLE_CATEGORIES = [
  { category: "Magnum", offtake_sales: 8398, offtake_comp: -2.9, market_share_pct: 28, ms_comp: 0.9, availability_pct: 77, availability_comp: -1.6, spend: 730, spend_comp: 256.7, roas: 3.1, roas_comp: 36.4, cpm: 475, cpm_comp: -19.0, cpc: 36, cpc_comp: -17.5, a2c_pct: 1.8, a2c_comp: 6.7, sos_pct: 29, sos_comp: -10.0, reason: "OK" },
  { category: "Core Tub", offtake_sales: 11064, offtake_comp: -7.0, market_share_pct: 18, ms_comp: 0.0, availability_pct: 84, availability_comp: 0.2, spend: 595, spend_comp: 289.4, roas: 3.3, roas_comp: -9.4, cpm: 576, cpm_comp: -3.6, cpc: 45, cpc_comp: 5.7, a2c_pct: 2.3, a2c_comp: -9.9, sos_pct: 19, sos_comp: -5.2, reason: "Conversion Drop" },
  { category: "Cornetto", offtake_sales: 9551, offtake_comp: -2.8, market_share_pct: 31, ms_comp: 1.2, availability_pct: 81, availability_comp: -0.4, spend: 488, spend_comp: 375.7, roas: 4.0, roas_comp: 13.7, cpm: 530, cpm_comp: 3.6, cpc: 22, cpc_comp: 16.6, a2c_pct: 5.1, a2c_comp: 13.5, sos_pct: 38, sos_comp: -2.0, reason: "OK" },
  { category: "Premium Tub", offtake_sales: 3854, offtake_comp: -3.9, market_share_pct: 18, ms_comp: 0.0, availability_pct: 78, availability_comp: -0.3, spend: 418, spend_comp: 321.3, roas: 2.5, roas_comp: -24.2, cpm: 503, cpm_comp: -1.5, cpc: 79, cpc_comp: 18.0, a2c_pct: 0.7, a2c_comp: -24.0, sos_pct: 19, sos_comp: -5.2, reason: "Conversion Drop" },
];

const APPLIED_FILTERS = [
  { label: "format_l2", value: "is not (Blank)" },
  { label: "for_date", value: "27 Mar 2025 - 09 Dec 2025" },
];

const CITY_LIST = ["PAN India", "Delhi-NCR", "Mumbai", "Bangalore", "Hyderabad", "Kolkata", "Pune", "Chennai"];

// -------------------- Helpers --------------------
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function safeNum(v) {
  const n = Number(v);
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  return n;
}

function deriveCategoryKpis(row) {
  const sales = safeNum(row.offtake_sales) ?? 0;
  const share = safeNum(row.market_share_pct) ?? 0;
  const catSize = share > 0 ? sales / (share / 100) : sales * 3.2;
  const units = Math.max(1, Math.round(sales / 10));
  const impressions = Math.max(1, Math.round((safeNum(row.spend) ?? 0) * 150));
  const wtOsa = safeNum(row.availability_pct) ?? 0;
  const adSov = safeNum(row.sos_pct) ?? 0;
  const conv = safeNum(row.a2c_pct) ?? 0;
  const wtDisc = Math.min(80, Math.max(0, (safeNum(row.cpc) ?? 0) / 2));
  const asp = Math.max(80, Math.round((safeNum(row.cpm) ?? 200) / 2));

  // Map deltas to derived fields for consistent display
  const unitsDelta = safeNum(row.offtake_comp) ?? 0;
  const catSizeDelta = safeNum(row.ms_comp) ?? 0;
  const impressionsDelta = safeNum(row.spend_comp) ?? 0;
  const wtDiscDelta = 0;
  const aspDelta = safeNum(row.cpm_comp) ?? 0;

  return {
    catSize,
    units,
    impressions,
    wtOsa,
    adSov,
    conv,
    wtDisc,
    asp,
    unitsDelta,
    catSizeDelta,
    impressionsDelta,
    wtDiscDelta,
    aspDelta,
  };
}

function deriveCityKpis(row) {
  const sales = safeNum(row.offtake) ?? 0;
  const share = safeNum(row.categoryShare) ?? 0;
  const catSize = share > 0 ? sales / (share / 100) : sales * 2.8;
  const units = Math.max(1, Math.round(sales / 10));
  const impressions = Math.max(1, Math.round(sales * 15));
  const wtOsa = safeNum(row.availability) ?? 0;
  const adSov = safeNum(row.sos) ?? 0;
  const conv = safeNum(row.cvr) ?? 0;
  const wtDisc = Math.min(80, Math.max(0, (safeNum(row.aspComp) ?? 0) * 1.2));
  const asp = safeNum(row.asp) ?? 0;

  const unitsDelta = safeNum(row.offtakeComp) ?? 0;
  const catSizeDelta = safeNum(row.offtakeComp) ?? 0;
  const impressionsDelta = safeNum(row.offtakeComp) ?? 0;
  const wtDiscDelta = 0;
  const aspDelta = safeNum(row.aspComp) ?? 0;

  return {
    catSize,
    units,
    impressions,
    wtOsa,
    adSov,
    conv,
    wtDisc,
    asp,
    unitsDelta,
    catSizeDelta,
    impressionsDelta,
    wtDiscDelta,
    aspDelta,
  };
}
function formatIN(n, decimals = 0) {
  const v = safeNum(n);
  if (v === null) return "--";
  return v.toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}
function formatPct(n, decimals = 1) {
  const v = safeNum(n);
  if (v === null) return "--";
  return `${v.toFixed(decimals)}%`;
}

// IMPORTANT: correct arrow logic (down for negative, up for positive)
function DeltaPill({ value }) {
  const v = safeNum(value);
  if (v === null) {
    return <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">--</span>;
  }
  const up = v > 0;
  const flat = v === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] tabular-nums",
        flat && "bg-slate-100 text-slate-600",
        up && "bg-emerald-50 text-emerald-700",
        !up && !flat && "bg-rose-50 text-rose-700"
      )}
      title="WoW change"
    >
      <span className="leading-none">{flat ? "-" : up ? "^" : "v"}</span>
      <span>{formatPct(v, 1)}</span>
    </span>
  );
}

function Tag({ tone = "neutral", children }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px]",
        tone === "neutral" && "bg-slate-100 text-slate-700",
        tone === "good" && "bg-emerald-50 text-emerald-700",
        tone === "bad" && "bg-rose-50 text-rose-700",
        tone === "warn" && "bg-amber-50 text-amber-800"
      )}
    >
      {children}
    </span>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function makeCityRows(categoryRow) {
  const base = safeNum(categoryRow.offtake_sales) ?? 0;
  const baseShare = safeNum(categoryRow.market_share_pct) ?? 10;
  const baseAvail = safeNum(categoryRow.availability_pct) ?? 70;
  const baseSos = safeNum(categoryRow.sos_pct) ?? 15;
  const seed = categoryRow.category.length * 17;

  return CITY_LIST.map((c, i) => {
    const weight = i === 0 ? 0.42 : 0.1 + ((seed + i * 7) % 12) / 100;
    const offtake = Math.round(base * weight);
    const offtakeComp = clamp((safeNum(categoryRow.offtake_comp) ?? 0) + (((seed + i * 11) % 9) - 4) * 1.3, -35, 35);
    const availability = clamp(baseAvail + (((seed + i * 13) % 9) - 4) * 1.1, 40, 98);
    const availabilityComp = clamp((safeNum(categoryRow.availability_comp) ?? 0) + (((seed + i * 5) % 7) - 3) * 0.6, -8, 8);
    const cvr = clamp((safeNum(categoryRow.a2c_pct) ?? 2.0) + (((seed + i * 3) % 9) - 4) * 0.15, 0.2, 9.0);
    const cvrComp = clamp((safeNum(categoryRow.a2c_comp) ?? 0) + (((seed + i * 19) % 11) - 5) * 0.9, -40, 40);
    const asp = clamp(120 + ((seed + i * 23) % 120), 80, 320);
    const aspComp = clamp((((seed + i * 29) % 13) - 6) * 1.1, -25, 25);
    const sos = clamp(baseSos + (((seed + i * 17) % 9) - 4) * 1.0, 0, 60);
    const sosComp = clamp((safeNum(categoryRow.sos_comp) ?? 0) + (((seed + i * 31) % 11) - 5) * 1.2, -40, 40);

    const verdict = (() => {
      if (offtakeComp < 0 && availabilityComp < 0) return "Availability";
      if (offtakeComp < 0 && cvrComp < 0) return "Conversion";
      if (offtakeComp < 0 && sosComp < 0) return "SoS";
      if (offtakeComp < 0 && aspComp > 0) return "Price";
      return "OK";
    })();

    return {
      city: c,
      offtake,
      offtakeComp,
      categoryShare: clamp(baseShare * weight * 2.2, 0, 45),
      availability,
      availabilityComp,
      cvr,
      cvrComp,
      asp,
      aspComp,
      sos,
      sosComp,
      verdict,
    };
  });
}

function makeSkuRows(categoryRow, cityRow) {
  const seed = (categoryRow.category.length + cityRow.city.length) * 13;
  const base = safeNum(cityRow.offtake) ?? 0;
  const n = clamp(12 + (seed % 8), 12, 24);

  return Array.from({ length: n }, (_, i) => {
    const share = clamp(2 + ((seed + i * 9) % 18), 1, 40);
    const offtake = Math.round((base * share) / 100);
    const offtakeComp = clamp(cityRow.offtakeComp + (((seed + i * 11) % 9) - 4) * 1.4, -45, 45);
    const osa = clamp((safeNum(cityRow.availability) ?? 70) + (((seed + i * 7) % 11) - 5) * 1.2, 35, 99);
    const osaComp = clamp(cityRow.availabilityComp + (((seed + i * 5) % 9) - 4) * 0.7, -12, 12);
    const cvr = clamp((safeNum(cityRow.cvr) ?? 2.0) + (((seed + i * 17) % 11) - 5) * 0.18, 0.2, 12);
    const cvrComp = clamp(cityRow.cvrComp + (((seed + i * 19) % 11) - 5) * 1.1, -50, 50);
    const asp = clamp((safeNum(cityRow.asp) ?? 180) + (((seed + i * 23) % 21) - 10) * 1.3, 60, 420);
    const aspComp = clamp(cityRow.aspComp + (((seed + i * 29) % 13) - 6) * 1.2, -30, 30);
    const driver = (() => {
      if (offtakeComp < 0 && osaComp < 0) return "Low OSA";
      if (offtakeComp < 0 && cvrComp < 0) return "Low CVR";
      if (offtakeComp < 0 && aspComp > 0) return "High ASP";
      return "OK";
    })();

    return {
      sku: `${categoryRow.category} SKU ${String(i + 1).padStart(3, "0")}`,
      pack: (seed + i) % 3 === 0 ? "100ml" : (seed + i) % 3 === 1 ? "200ml" : "500ml",
      offtake,
      offtakeComp,
      share,
      osa,
      osaComp,
      cvr,
      cvrComp,
      asp,
      aspComp,
      driver,
    };
  });
}

// -------------------- UI Blocks --------------------
function TableShell({ title, subtitle, right, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
      <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-slate-600">{subtitle}</div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <span className="text-xs font-medium text-slate-700">Search</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-56 bg-transparent text-sm outline-none placeholder:text-slate-400"
      />
    </div>
  );
}

function Stepper({ step, category, city, sku }) {
  const item = (n, label, active, filled, sub) => (
    <div className="flex items-center gap-2">
      <div className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold", active ? "bg-blue-600 text-white" : filled ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700")}>
        {n}
      </div>
      <div className="min-w-0">
        <div className={cn("text-xs font-semibold", active ? "text-slate-900" : "text-slate-600")}>{label}</div>
        <div className="text-[11px] text-slate-500 truncate">{sub}</div>
      </div>
    </div>
  );

  const s1 = category || "Pick a category";
  const s2 = city || "Pick a city";
  const s3 = sku || "Pick a SKU";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900">Guided RCA Path</div>
          <div className="mt-1 text-xs text-slate-600">Follow: Category {"->"} City {"->"} SKU {"->"} RCA</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {item(1, "Category", step === 1, step > 1, s1)}
        {item(2, "City", step === 2, step > 2, s2)}
        {item(3, "SKU", step === 3, step > 3, s3)}
      </div>

    </div>
  );
}

// (KPI cards removed per latest request)

function BreadcrumbRail({
  activeStep, // 1,2,3
  category,
  city,
  sku,
  onJump,     // jump to section without resetting
  onChange,   // reset from this level and jump
  position,
  onDragStart,
  onDragMove,
  onDragEnd,
  onClose,
}) {
  const item = (level, label, value, enabled) => {
    const isActive = activeStep === level;

    return (
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase text-slate-400">{label}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onJump(label.toLowerCase())}
              className={cn(
                "text-[11px] font-semibold",
                enabled ? "text-slate-600 hover:underline" : "text-slate-300 cursor-not-allowed"
              )}
              disabled={!enabled}
              title="Jump to table"
            >
              Jump
            </button>
            <button
              type="button"
              onClick={() => onChange(label.toLowerCase())}
              className={cn(
                "text-[11px] font-semibold",
                enabled ? "text-blue-600 hover:underline" : "text-slate-300 cursor-not-allowed"
              )}
              disabled={!enabled}
              title="Reset this level"
            >
              Change
            </button>
          </div>
        </div>

        <div className={cn("mt-1 rounded-xl border px-3 py-2 text-sm font-medium",
          isActive ? "border-blue-200 bg-blue-50 text-slate-900" : "border-slate-200 bg-white text-slate-900"
        )}>
          <div className={cn(!value && "text-slate-300")}>{value || "Not selected"}</div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn("fixed z-40 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg cursor-grab active:cursor-grabbing")}
      style={{
        maxHeight: "calc(100vh - 48px)",
        overflow: "auto",
        left: position.x,
        top: position.y,
      }}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drill Path</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
        >
          Close
        </button>
      </div>

      {item(1, "Category", category, true)}
      {item(2, "City", city, !!category)}
      {item(3, "SKU", sku, !!city)}
    </div>
  );
}

function DeltaToggle({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
      <span className="font-semibold">Delta</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none"
      >
        <option value="wow">WoW</option>
        <option value="mom">MoM</option>
        <option value="none">No Delta</option>
      </select>
    </div>
  );
}

const renderDelta = (mode, value) => {
  if (mode === "none") return <span className="text-[11px] text-slate-400">--</span>;
  return <DeltaPill value={value} />;
};

function ValueWithDelta({ value, delta, formatter, mode }) {
  const formatted = formatter(value);
  const showDelta = mode !== "none";
  if (!showDelta) {
    return <span className="font-semibold text-slate-900 tabular-nums">{formatted}</span>;
  }
  const d = safeNum(delta) ?? 0;
  const deltaPositive = d > 0;
  const deltaNeutral = d === 0;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 border border-slate-200/70 bg-white",
        deltaNeutral && "bg-slate-50/40",
        deltaPositive && "bg-emerald-50/50",
        !deltaPositive && !deltaNeutral && "bg-rose-50/50"
      )}
    >
      <span className="font-semibold text-slate-900 tabular-nums">{formatted}</span>
      <span className="rounded-full border border-slate-200/60 bg-white/70 px-2 py-0.5">
        {renderDelta(mode, d)}
      </span>
    </div>
  );
}

const RcaMiniIcon = ({ className = "h-3.5 w-3.5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.2 4.7 3 6l1 1h6l1-1c1.8-1.3 3-3.5 3-6a7 7 0 0 0-7-7Z" />
  </svg>
);

const SkuMiniIcon = ({ className = "h-3.5 w-3.5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

// -------------------- Main Page --------------------
export default function RCATable() {
  // Keep default category selected if you want. You can set null if you want true Step 1 start.
  const [selectedCategory, setSelectedCategory] = useState(SAMPLE_CATEGORIES[0]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedSku, setSelectedSku] = useState(null);
  const [railPos, setRailPos] = useState({ x: 16, y: 16 });
  const [railOpen, setRailOpen] = useState(false);
  const [rcaCategoryOpen, setRcaCategoryOpen] = useState(false);
  const [cityRcaOpen, setCityRcaOpen] = useState(false);

  const [catDeltaMode, setCatDeltaMode] = useState("wow");
  const [cityDeltaMode, setCityDeltaMode] = useState("wow");
  const [skuDeltaMode, setSkuDeltaMode] = useState("wow");
  const [expandedCity, setExpandedCity] = useState(null);
  const [expandedSku, setExpandedSku] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);

  const [catQ, setCatQ] = useState("");
  const [cityQ, setCityQ] = useState("");
  const [skuQ, setSkuQ] = useState("");

  const [rcaOpen, setRcaOpen] = useState(false);

  // Section anchors
  const categoryRef = useRef(null);
  const cityRef = useRef(null);
  const skuRef = useRef(null);
  const rootRef = useRef(null);
  const scrollElRef = useRef(null);
  const draggingRef = useRef(false);
  const pointerOffsetRef = useRef({ x: 0, y: 0 });
  const mountedRef = useRef(false);
  const dragListenerRef = useRef({ move: null, up: null });

  // Figure active step for rail highlight
  const activeStep = selectedSku ? 3 : selectedCity ? 2 : 1;
  const categoryLabel = selectedCategory?.category || "All Categories";
  const cityLabel = selectedCity?.city || "All Cities";
  const skuLabel = selectedSku?.sku || "All SKUs";

  const categories = useMemo(() => {
    const q = catQ.trim().toLowerCase();
    const rows = q ? SAMPLE_CATEGORIES.filter((r) => r.category.toLowerCase().includes(q)) : SAMPLE_CATEGORIES;
    return rows.sort((a, b) => (safeNum(b.offtake_sales) ?? 0) - (safeNum(a.offtake_sales) ?? 0));
  }, [catQ]);

  const cities = useMemo(() => {
    if (!selectedCategory) return [];
    const rows = makeCityRows(selectedCategory);
    const q = cityQ.trim().toLowerCase();
    return q ? rows.filter((r) => r.city.toLowerCase().includes(q)) : rows;
  }, [selectedCategory, cityQ]);

  const skus = useMemo(() => {
    if (!selectedCategory || !selectedCity) return [];
    const rows = makeSkuRows(selectedCategory, selectedCity);
    const q = skuQ.trim().toLowerCase();
    return q ? rows.filter((r) => r.sku.toLowerCase().includes(q) || r.pack.toLowerCase().includes(q)) : rows;
  }, [selectedCategory, selectedCity, skuQ]);

  // Find nearest scrollable parent (CommonContainer uses an inner Box)
  useEffect(() => {
    const findScrollParent = (node) => {
      let el = node;
      // include self first, then walk up
      while (el) {
        const style = getComputedStyle(el);
        const canScrollY = /(auto|scroll)/.test(style.overflowY);
        if (canScrollY) return el;
        el = el.parentElement;
      }
      return document.scrollingElement || window;
    };
    scrollElRef.current = findScrollParent(rootRef.current);
  }, []);

  // Scroll helper: account for fixed rail and header
  const scrollToRef = (ref) => {
    const el = ref?.current;
    if (!el) return;
    // First try native scrollIntoView on the nearest scrollable ancestor
    el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  };

  // Auto-scroll behavior (the "guided" part)
  useEffect(() => {
    mountedRef.current = true;
    // set default rail position bottom-right so it doesn't sit over the tables
    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;
    setRailPos((cur) => {
      if (cur.x !== 16 || cur.y !== 16) return cur;
      return {
        x: Math.max(12, vw - 340),
        y: Math.max(12, vh - 260),
      };
    });
  }, []);

  const scheduleScroll = (ref, delay = 120) => {
    window.setTimeout(() => scrollToRef(ref), delay);
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (!draggingRef.current) return;
      const next = { x: e.clientX - pointerOffsetRef.current.x, y: e.clientY - pointerOffsetRef.current.y };
      const scroller = scrollElRef.current === window ? window : scrollElRef.current;
      const maxX = (scrollElRef.current === window ? window.innerWidth : scrollElRef.current.clientWidth) - 260;
      const maxY = (scrollElRef.current === window ? window.innerHeight : scrollElRef.current.clientHeight) - 80;
      setRailPos({ x: clamp(next.x, 8, Math.max(8, maxX)), y: clamp(next.y, 8, Math.max(8, maxY)) });
    };
    const handleUp = () => {
      draggingRef.current = false;
    };
    dragListenerRef.current = { move: handleMove, up: handleUp };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current || !selectedCategory) return;
    const id = setTimeout(() => scrollToRef(cityRef), 120);
    return () => clearTimeout(id);
  }, [selectedCategory]);

  useEffect(() => {
    if (!mountedRef.current || !selectedCity) return;
    const id = setTimeout(() => scrollToRef(skuRef), 120);
    return () => clearTimeout(id);
  }, [selectedCity]);

  // Breadcrumb actions
  const handleJump = (level) => {
    if (level === "category") scrollToRef(categoryRef);
    if (level === "city") scrollToRef(cityRef);
    if (level === "sku") scrollToRef(skuRef);
  };

  const handleChange = (level) => {
    if (level === "category") {
      setSelectedCategory(null);
      setSelectedCity(null);
      setSelectedSku(null);
      setTimeout(() => scrollToRef(categoryRef), 50);
      return;
    }
    if (level === "city") {
      setSelectedCity(null);
      setSelectedSku(null);
      setTimeout(() => scrollToRef(cityRef), 50);
      return;
    }
    if (level === "sku") {
      setSelectedSku(null);
      setTimeout(() => scrollToRef(skuRef), 50);
      return;
    }
  };

  const handlePanIndiaSku = (cat = selectedCategory) => {
    const category = cat || selectedCategory;
    if (!category) return;
    const panRow = makeCityRows(category).find((c) => c.city === "PAN India") || makeCityRows(category)[0];
    setSelectedCity(panRow);
    setSelectedSku(null);
    scheduleScroll(skuRef, 80);
  };

  return (
    // IMPORTANT: remove overflow-y-auto from the root so browser scroll works normally
    <div className="min-h-screen bg-slate-50" ref={rootRef}>
      {/* Floating rail (desktop) */}
      <div className="hidden md:block">
        {railOpen && (
          <BreadcrumbRail
            activeStep={activeStep}
            category={selectedCategory?.category}
            city={selectedCity?.city}
            sku={selectedSku?.sku}
            onJump={handleJump}
            onChange={handleChange}
            position={railPos}
            onDragStart={(e) => {
              draggingRef.current = true;
              pointerOffsetRef.current = { x: e.clientX - railPos.x, y: e.clientY - railPos.y };
            }}
            onDragMove={(e) => {
              if (!draggingRef.current) return;
              const next = { x: e.clientX - pointerOffsetRef.current.x, y: e.clientY - pointerOffsetRef.current.y };
              const maxX = (scrollElRef.current === window ? window.innerWidth : scrollElRef.current.clientWidth) - 260;
              const maxY = (scrollElRef.current === window ? window.innerHeight : scrollElRef.current.clientHeight) - 80;
              setRailPos({ x: clamp(next.x, 8, Math.max(8, maxX)), y: clamp(next.y, 8, Math.max(8, maxY)) });
            }}
            onDragEnd={() => {
              draggingRef.current = false;
            }}
            onClose={() => setRailOpen(false)}
          />
        )}
        {!railOpen && (
          <button
            type="button"
            onClick={() => setRailOpen(true)}
            className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-lg border border-slate-200 hover:shadow-xl"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-[11px]">
              {activeStep}
            </span>
            <span className="max-w-[180px] truncate">
              {selectedCategory?.category || "Pick category"}
              {selectedCity ? ` / ${selectedCity.city}` : ""}
              {selectedSku ? ` / ${selectedSku.sku}` : ""}
            </span>
          </button>
        )}
      </div>

      {/* Main content: give left padding so rail doesn't overlap */}
      <div className="w-full px-2 py-4 md:px-4 lg:px-6">
        {/* Anchor for category */}
        <div ref={categoryRef} style={{ scrollMarginTop: 96 }} />

        <div className="space-y-4">
          {/* CATEGORY TABLE */}
          <TableShell
            title="Step 1: Select Category"
            subtitle=""
            right={
              <div className="flex flex-wrap gap-2">
                <DeltaToggle value={catDeltaMode} onChange={setCatDeltaMode} />
                <SearchBox value={catQ} onChange={setCatQ} placeholder="Type category..." />
              </div>
            }
          >
            <div className="w-full overflow-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-white/90">
                    <th className="sticky left-0 z-20 border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">
                      Category
                    </th>
                    <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Estimated Offtake (INR)</th>
                    <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Units</th>
                    <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Est. Category Share</th>
                    <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Cat. Size (INR)</th>
                    <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Indexed Impressions</th>
                    <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Wt. OSA %</th>
                    <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Ad. SOV</th>
                    <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Reason</th>
                    <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {categories.map((r) => {
                    const selected = selectedCategory?.category === r.category;
                    const { catSize, units, impressions, wtOsa, adSov, conv, wtDisc, asp, unitsDelta, catSizeDelta, impressionsDelta, wtDiscDelta, aspDelta } = deriveCategoryKpis(r);

                    return (
                      <React.Fragment key={r.category}>
                        <tr
                          className={cn("hover:bg-slate-50 transition-colors", selected && "bg-blue-50")}
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            setSelectedCategory(r);
                            setSelectedCity(null);
                            setSelectedSku(null);
                            scheduleScroll(cityRef);
                          }}
                        >
                          <td className={cn("sticky left-0 z-10 border-b border-slate-100 px-3 py-2", selected ? "bg-blue-50" : "bg-white")}>
                            <div className="font-semibold text-slate-900">{r.category}</div>
                          </td>

                          <td className="border-b border-slate-100 px-3 py-2">
                            <ValueWithDelta value={r.offtake_sales} delta={r.offtake_comp} formatter={(v) => formatIN(v)} mode={catDeltaMode} />
                          </td>

                          <td className="border-b border-slate-100 px-3 py-2 text-center tabular-nums">
                            <ValueWithDelta value={units} delta={unitsDelta} formatter={(v) => formatIN(v)} mode={catDeltaMode} />
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 text-center tabular-nums">
                            <ValueWithDelta value={r.market_share_pct} delta={r.ms_comp} formatter={(v) => formatPct(v, 1)} mode={catDeltaMode} />
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 text-center tabular-nums">
                            <ValueWithDelta value={catSize} delta={catSizeDelta} formatter={(v) => formatIN(v)} mode={catDeltaMode} />
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 text-center tabular-nums">
                            <ValueWithDelta value={impressions} delta={impressionsDelta} formatter={(v) => formatIN(v)} mode={catDeltaMode} />
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 text-center tabular-nums">
                            <ValueWithDelta value={wtOsa} delta={r.availability_comp} formatter={(v) => formatPct(v, 0)} mode={catDeltaMode} />
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 text-center tabular-nums">
                            <ValueWithDelta value={adSov} delta={r.sos_comp} formatter={(v) => formatPct(v, 1)} mode={catDeltaMode} />
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 text-center">{r.reason || "--"}</td>
                          <td className="border-b border-slate-100 px-3 py-2 space-x-2 whitespace-nowrap text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedCategory((cur) => (cur === r.category ? null : r.category));
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              {expandedCategory === r.category ? "Hide" : "More KPIs"}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCategory(r);
                                setSelectedCity(null);
                                setSelectedSku(null);
                                setRcaCategoryOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              <RcaMiniIcon />
                              RCA
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCategory(r);
                                handlePanIndiaSku(r);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <SkuMiniIcon />
                              SKUs
                            </button>
                          </td>
                        </tr>

                        {expandedCategory === r.category && (
                          <tr>
                            <td colSpan={14} className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-3">
                              <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[11px] font-semibold text-slate-700">Spend</div>
                                  <div className="mt-1 flex items-center justify-between">
                                    <ValueWithDelta value={r.spend} delta={r.spend_comp} formatter={(v) => formatIN(v)} mode={catDeltaMode} />
                                  </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[11px] font-semibold text-slate-700">ROAS</div>
                                  <div className="mt-1 flex items-center justify-between">
                                    <ValueWithDelta value={safeNum(r.roas) === null ? "--" : Number(r.roas).toFixed(1)} delta={r.roas_comp} formatter={(v) => v} mode={catDeltaMode} />
                                  </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[11px] font-semibold text-slate-700">CPM / CPC</div>
                                  <div className="mt-1 text-xs text-slate-700">
                                    <div className="flex items-center justify-between">
                                      <span>CPM</span>
                                      <ValueWithDelta value={r.cpm} delta={r.cpm_comp} formatter={(v) => formatIN(v)} mode={catDeltaMode} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span>CPC</span>
                                      <ValueWithDelta value={r.cpc} delta={r.cpc_comp} formatter={(v) => formatIN(v)} mode={catDeltaMode} />
                                    </div>
                                  </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[11px] font-semibold text-slate-700">SoS%</div>
                                  <div className="mt-1 flex items-center justify-between">
                                    <ValueWithDelta value={r.sos_pct} delta={r.sos_comp} formatter={(v) => formatPct(v, 0)} mode={catDeltaMode} />
                                  </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[11px] font-semibold text-slate-700">Indexed Conversion</div>
                                  <div className="mt-1 flex items-center justify-between">
                                    <ValueWithDelta value={conv} delta={r.a2c_comp} formatter={(v) => formatPct(v, 1)} mode={catDeltaMode} />
                                  </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[11px] font-semibold text-slate-700">Wt. Disc%</div>
                                  <div className="mt-1 flex items-center justify-between">
                                    <ValueWithDelta value={wtDisc} delta={wtDiscDelta} formatter={(v) => formatPct(v, 1)} mode={catDeltaMode} />
                                  </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[11px] font-semibold text-slate-700">ASP</div>
                                  <div className="mt-1 flex items-center justify-between">
                                    <ValueWithDelta value={asp} delta={aspDelta} formatter={(v) => formatIN(v)} mode={catDeltaMode} />
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
              Select a category. The page will guide you to City. You can still scroll anywhere manually.
            </div>
          </TableShell>

          {/* CITY TABLE */}
          <div ref={cityRef} style={{ scrollMarginTop: 96 }} />
          <TableShell
            title={`Step 2: Select City ${selectedCategory ? `for ${selectedCategory.category}` : ""}`}
            subtitle=""
            right={
              <div className="flex flex-wrap gap-2">
                <DeltaToggle value={cityDeltaMode} onChange={setCityDeltaMode} />
                <SearchBox value={cityQ} onChange={setCityQ} placeholder="Type city..." />
              </div>
            }
          >
            {!selectedCategory ? (
              <div className="px-4 py-6 text-sm text-slate-600">Select a category first.</div>
            ) : (
              <>
                <div className="w-full overflow-auto">
                  <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="sticky left-0 z-20 border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">City</th>
                        <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Estimated Offtake (INR)</th>
                        <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Units</th>
                        <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Est. Category Share</th>
                        <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Cat. Size (INR)</th>
                        <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Indexed Impressions</th>
                        <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Wt. OSA %</th>
                        <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Ad. SOV</th>
                        <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Verdict</th>
                        <th className="border-b border-slate-200 bg-white px-3 py-2 text-center text-[12px] font-semibold text-slate-800">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {cities.map((r) => {
                        const selected = selectedCity?.city === r.city;
                        const { catSize, units, impressions, wtOsa, adSov, conv, wtDisc, asp, unitsDelta, catSizeDelta, impressionsDelta, wtDiscDelta, aspDelta } = deriveCityKpis(r);
                        return (
                          <React.Fragment key={r.city}>
                            <tr
                              className={cn("hover:bg-slate-50 transition-colors", selected && "bg-blue-50")}
                              style={{ cursor: "pointer" }}
                          onClick={() => {
                            setSelectedCity(r);
                            setSelectedSku(null);
                            scheduleScroll(skuRef);
                          }}
                        >
                              <td className={cn("sticky left-0 z-10 border-b border-slate-100 px-3 py-2 text-left", selected ? "bg-blue-50" : "bg-white")}>
                                <div className="font-semibold text-slate-900">{r.city}</div>
                              </td>
                              <td className="border-b border-slate-100 px-3 py-2 text-center">
                                <ValueWithDelta value={r.offtake} delta={r.offtakeComp} formatter={(v) => formatIN(v)} mode={cityDeltaMode} />
                              </td>
                              <td className="border-b border-slate-100 px-3 py-2 text-center tabular-nums">
                                <ValueWithDelta value={units} delta={unitsDelta} formatter={(v) => formatIN(v)} mode={cityDeltaMode} />
                              </td>
                              <td className="border-b border-slate-100 px-3 py-2 text-center tabular-nums">
                                <ValueWithDelta value={r.categoryShare} delta={r.offtakeComp} formatter={(v) => formatPct(v, 1)} mode={cityDeltaMode} />
                              </td>
                              <td className="border-b border-slate-100 px-3 py-2 text-center tabular-nums">
                                <ValueWithDelta value={catSize} delta={catSizeDelta} formatter={(v) => formatIN(v)} mode={cityDeltaMode} />
                              </td>
                              <td className="border-b border-slate-100 px-3 py-2 text-center tabular-nums">
                                <ValueWithDelta value={impressions} delta={impressionsDelta} formatter={(v) => formatIN(v)} mode={cityDeltaMode} />
                              </td>
                              <td className="border-b border-slate-100 px-3 py-2 text-center">
                                <ValueWithDelta value={wtOsa} delta={r.availabilityComp} formatter={(v) => formatPct(v, 0)} mode={cityDeltaMode} />
                              </td>
                              <td className="border-b border-slate-100 px-3 py-2 text-center">
                                <ValueWithDelta value={adSov} delta={r.sosComp} formatter={(v) => formatPct(v, 1)} mode={cityDeltaMode} />
                              </td>
                              <td className="border-b border-slate-100 px-3 py-2 text-center">
                                {r.verdict === "OK" ? <Tag tone="good">OK</Tag> : <Tag tone="warn">{r.verdict}</Tag>}
                              </td>
                              <td className="border-b border-slate-100 px-3 py-2 text-center space-x-2 whitespace-nowrap">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedCity((cur) => (cur === r.city ? null : r.city));
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  {expandedCity === r.city ? "Hide" : "More KPIs"}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCity(r);
                                    setCityRcaOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                >
                                  <RcaMiniIcon />
                                  RCA
                                </button>
                              </td>
                            </tr>

                        {expandedCity === r.city && (
                          <tr>
                            <td colSpan={10} className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-3">
                              <div className="grid gap-2 md:grid-cols-3">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[11px] font-semibold text-slate-700">Indexed Conversion</div>
                                  <div className="mt-1 flex items-center justify-between">
                                    <ValueWithDelta value={conv} delta={r.cvrComp} formatter={(v) => formatPct(v, 1)} mode={cityDeltaMode} />
                                  </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[11px] font-semibold text-slate-700">Wt. Disc%</div>
                                  <div className="mt-1 flex items-center justify-between">
                                    <ValueWithDelta value={wtDisc} delta={wtDiscDelta} formatter={(v) => formatPct(v, 1)} mode={cityDeltaMode} />
                                  </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[11px] font-semibold text-slate-700">ASP</div>
                                  <div className="mt-1 flex items-center justify-between">
                                    <ValueWithDelta value={asp} delta={aspDelta} formatter={(v) => formatIN(v)} mode={cityDeltaMode} />
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
                  Select a city. The page will guide you to SKU. You can still scroll anywhere manually.
                </div>
              </>
            )}
          </TableShell>

          {/* SKU TABLE */}
          <div ref={skuRef} style={{ scrollMarginTop: 96 }} />
          <TableShell
            title={`Step 3: Select SKU ${selectedCity ? `for ${selectedCity.city}` : ""}`}
            subtitle="Choose a SKU to open RCA."
            right={
              <div className="flex flex-wrap gap-2">
                <DeltaToggle value={skuDeltaMode} onChange={setSkuDeltaMode} />
                <SearchBox value={skuQ} onChange={setSkuQ} placeholder="Search SKU / pack..." />
              </div>
            }
          >
            {!selectedCity ? (
              <div className="px-4 py-6 text-sm text-slate-600">Select a city first.</div>
            ) : (
              <>
                <div className="w-full overflow-auto">
                  <table className="w-full border-separate border-spacing-0 table-fixed text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="sticky left-0 z-20 w-[260px] border-b border-slate-200 bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">SKU</th>
                        <th className="w-[90px] border-b border-slate-200 bg-slate-50 px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">Pack</th>
                        <th className="w-[180px] border-b border-slate-200 bg-slate-50 px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">Estimated Offtake (INR)</th>
                        <th className="w-[120px] border-b border-slate-200 bg-slate-50 px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">Share</th>
                        <th className="w-[120px] border-b border-slate-200 bg-slate-50 px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">OSA</th>
                        <th className="w-[120px] border-b border-slate-200 bg-slate-50 px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">CVR</th>
                        <th className="w-[140px] border-b border-slate-200 bg-slate-50 px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">ASP (INR)</th>
                        <th className="w-[140px] border-b border-slate-200 bg-slate-50 px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">Driver</th>
                        <th className="w-[130px] border-b border-slate-200 bg-slate-50 px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {skus.map((r, idx) => {
                        const selected = selectedSku?.sku === r.sku;
                        return (
                          <React.Fragment key={r.sku}>
                            <tr
                              className={cn(
                                "transition-colors",
                                idx % 2 === 0 ? "bg-white" : "bg-slate-50/20",
                                "hover:bg-slate-50",
                                selected && "bg-blue-50/50"
                              )}
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                setSelectedSku(r);
                                setRcaOpen(true);
                              }}
                            >
                              <td className={cn("sticky left-0 z-10 border-b border-slate-100 px-5 py-3", selected ? "bg-blue-50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/40")}>
                                <div className="font-semibold text-slate-900">{r.sku}</div>
                              </td>
                              <td className="border-b border-slate-100 px-5 py-3 text-center">
                                <Tag tone="neutral">{r.pack}</Tag>
                              </td>
                              <td className="border-b border-slate-100 px-5 py-3 text-center tabular-nums">
                                <ValueWithDelta value={r.offtake} delta={r.offtakeComp} formatter={(v) => formatIN(v)} mode={skuDeltaMode} />
                              </td>
                              <td className="border-b border-slate-100 px-5 py-3 text-center tabular-nums">
                                <ValueWithDelta value={r.share} delta={r.offtakeComp} formatter={(v) => formatPct(v, 1)} mode={skuDeltaMode} />
                              </td>
                              <td className="border-b border-slate-100 px-5 py-3 text-center tabular-nums">
                                <ValueWithDelta value={r.osa} delta={r.osaComp} formatter={(v) => formatPct(v, 0)} mode={skuDeltaMode} />
                              </td>
                              <td className="border-b border-slate-100 px-5 py-3 text-center tabular-nums">
                                <ValueWithDelta value={r.cvr} delta={r.cvrComp} formatter={(v) => formatPct(v, 1)} mode={skuDeltaMode} />
                              </td>
                              <td className="border-b border-slate-100 px-5 py-3 text-center tabular-nums">
                                <ValueWithDelta value={r.asp} delta={r.aspComp} formatter={(v) => formatIN(v, 0)} mode={skuDeltaMode} />
                              </td>
                              <td className="border-b border-slate-100 px-5 py-3 text-center">
                                {r.driver === "OK" ? <Tag tone="good">OK</Tag> : <Tag tone="warn">{r.driver}</Tag>}
                              </td>
                              <td className="border-b border-slate-100 px-5 py-3 text-center space-x-2 whitespace-nowrap">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSku(r);
                                    setRcaOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                >
                                  <RcaMiniIcon />
                                  RCA
                                </button>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
                  Click a SKU to open RCA. You can also Jump/Change using the floating drill path.
                </div>
              </>
            )}
          </TableShell>

          <Modal
            open={rcaCategoryOpen}
            onClose={() => setRcaCategoryOpen(false)}
            title={`RCA: ${categoryLabel}`}
          >
            <div className="h-[520px]">
              <RCATree />
            </div>
          </Modal>

          <Modal
            open={cityRcaOpen}
            onClose={() => setCityRcaOpen(false)}
            title={`RCA: ${categoryLabel} / ${cityLabel}`}
          >
            <div className="h-[520px]">
              <RCATree />
            </div>
          </Modal>

          <Modal
            open={rcaOpen}
            onClose={() => setRcaOpen(false)}
            title={`RCA: ${categoryLabel} / ${cityLabel} / ${skuLabel}`}
          >
            <div className="h-[520px]">
              <RCATree />
            </div>
          </Modal>

          <div className="pb-10 text-xs text-slate-500">
            Replace sample data with live data. Keep the guided layout and the floating rail.
          </div>
        </div>
      </div>
    </div>
  );
}









