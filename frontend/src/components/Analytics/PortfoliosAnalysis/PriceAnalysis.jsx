import React, { useState, useMemo, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Cell,
} from "recharts";
import { SlidersHorizontal, Filter } from "lucide-react";

/* =========================
   CATEGORY-WISE MRP + DISCOUNT
   (each category has full brand rows)
   ========================= */
const categoryMRPData = {
  Cassata: [
    { brand: "Amul", mrp: 280, discount: 5 },
    { brand: "Arun", mrp: 250, discount: 4 },
    { brand: "BaskinRobbins", mrp: 620, discount: 6 },
    { brand: "CreamBell", mrp: 350, discount: 8 },
    { brand: "DairyDay", mrp: 260, discount: 3 },
    { brand: "GoZero", mrp: 520, discount: 9 },
    { brand: "Grameen", mrp: 220, discount: 3 },
    { brand: "Havmor", mrp: 330, discount: 10 },
    { brand: "Hocco", mrp: 500, discount: 5 },
    { brand: "KwalityWalls", mrp: 300, discount: 13 },
    { brand: "Nic", mrp: 320, discount: 7 },
    { brand: "Vadilal", mrp: 250, discount: 5 },
    { brand: "Others", mrp: 200, discount: 2 },
  ],

  Cone: [
    { brand: "Amul", mrp: 260, discount: 4 },
    { brand: "Arun", mrp: 240, discount: 3 },
    { brand: "BaskinRobbins", mrp: 600, discount: 8 },
    { brand: "CreamBell", mrp: 340, discount: 9 },
    { brand: "DairyDay", mrp: 240, discount: 3 },
    { brand: "GoZero", mrp: 510, discount: 11 },
    { brand: "Grameen", mrp: 210, discount: 2 },
    { brand: "Havmor", mrp: 320, discount: 11 },
    { brand: "Hocco", mrp: 480, discount: 6 },
    { brand: "KwalityWalls", mrp: 290, discount: 12 },
    { brand: "Nic", mrp: 300, discount: 6 },
    { brand: "Vadilal", mrp: 230, discount: 4 },
    { brand: "Others", mrp: 190, discount: 2 },
  ],

  Cup: [
    { brand: "Amul", mrp: 300, discount: 7 },
    { brand: "Arun", mrp: 260, discount: 4 },
    { brand: "BaskinRobbins", mrp: 640, discount: 10 },
    { brand: "CreamBell", mrp: 370, discount: 12 },
    { brand: "DairyDay", mrp: 270, discount: 4 },
    { brand: "GoZero", mrp: 540, discount: 12 },
    { brand: "Grameen", mrp: 230, discount: 3 },
    { brand: "Havmor", mrp: 340, discount: 13 },
    { brand: "Hocco", mrp: 520, discount: 7 },
    { brand: "KwalityWalls", mrp: 320, discount: 16 },
    { brand: "Nic", mrp: 330, discount: 8 },
    { brand: "Vadilal", mrp: 260, discount: 5 },
    { brand: "Others", mrp: 210, discount: 2 },
  ],
};

/* =========================
   PACK SALIENCY (category-wise)
   ========================= */
const pricePerPackData = {
  Cassata: {
    pack: [
      { range: "Pack 0", Amul: 18, BaskinRobbins: 12, CreamBell: 22, GoZero: 6, Grameen: 4, Havmor: 10, Hocco: 8, KwalityWalls: 12, Others: 5, Vadilal: 3, Nic: 0, Arun: 0, DairyDay: 0 },
      { range: "Pack 1", Amul: 22, BaskinRobbins: 15, CreamBell: 20, GoZero: 8, Grameen: 5, Havmor: 12, Hocco: 5, KwalityWalls: 9, Others: 3, Vadilal: 1, Nic: 0, Arun: 0, DairyDay: 0 },
      { range: "Pack 2", Amul: 16, BaskinRobbins: 22, CreamBell: 28, GoZero: 9, Grameen: 6, Havmor: 8, Hocco: 4, KwalityWalls: 5, Others: 1, Vadilal: 1, Nic: 0, Arun: 0, DairyDay: 0 },
      { range: "Pack 3", Amul: 12, BaskinRobbins: 26, CreamBell: 24, GoZero: 10, Grameen: 8, Havmor: 7, Hocco: 4, KwalityWalls: 6, Others: 2, Vadilal: 1, Nic: 0, Arun: 0, DairyDay: 0 },
      { range: "Pack 4", Amul: 10, BaskinRobbins: 30, CreamBell: 19, GoZero: 6, Grameen: 7, Havmor: 10, Hocco: 8, KwalityWalls: 5, Others: 3, Vadilal: 2, Nic: 0, Arun: 0, DairyDay: 0 },
      { range: "Pack 5", Amul: 8, BaskinRobbins: 35, CreamBell: 16, GoZero: 5, Grameen: 6, Havmor: 12, Hocco: 10, KwalityWalls: 4, Others: 2, Vadilal: 2, Nic: 0, Arun: 0, DairyDay: 0 },
      { range: "Pack 6", Amul: 6, BaskinRobbins: 27, CreamBell: 23, GoZero: 7, Grameen: 5, Havmor: 14, Hocco: 11, KwalityWalls: 4, Others: 1, Vadilal: 2, Nic: 0, Arun: 0, DairyDay: 0 },
      { range: "Pack 7", Amul: 5, BaskinRobbins: 18, CreamBell: 20, GoZero: 8, Grameen: 7, Havmor: 28, Hocco: 10, KwalityWalls: 2, Others: 1, Vadilal: 1, Nic: 0, Arun: 0, DairyDay: 0 },
      { range: "Pack 8", Amul: 2, BaskinRobbins: 60, CreamBell: 10, GoZero: 5, Grameen: 2, Havmor: 12, Hocco: 5, KwalityWalls: 2, Others: 1, Vadilal: 1, Nic: 0, Arun: 0, DairyDay: 0 },
      { range: "Pack 9", Amul: 1, BaskinRobbins: 5, CreamBell: 12, GoZero: 4, Grameen: 4, Havmor: 60, Hocco: 10, KwalityWalls: 2, Others: 1, Vadilal: 1, Nic: 0, Arun: 0, DairyDay: 0 },
      { range: "Pack 10", BaskinRobbins: 100, Amul: 0, CreamBell: 0, GoZero: 0, Grameen: 0, Havmor: 0, Hocco: 0, KwalityWalls: 0, Others: 0, Vadilal: 0, Nic: 0, Arun: 0, DairyDay: 0 },
      { range: "Pack 11", Havmor: 100, Amul: 0, BaskinRobbins: 0, CreamBell: 0, GoZero: 0, Grameen: 0, Hocco: 0, KwalityWalls: 0, Others: 0, Vadilal: 0, Nic: 0, Arun: 0, DairyDay: 0 },
    ],
  },

  Cone: {
    pack: [
      { range: "Pack 0", Amul: 20, Arun: 10, CreamBell: 15, Havmor: 18, KwalityWalls: 12, GoZero: 5, BaskinRobbins: 0, Hocco: 0, Nic: 0, Grameen: 0, Vadilal: 0, Others:0, DairyDay:0 },
      { range: "Pack 1", Amul: 15, BaskinRobbins: 20, CreamBell: 25, GoZero: 15, Havmor: 10, KwalityWalls: 8, Arun:0, Hocco:0, Nic:0, Grameen:0, Vadilal:0, Others:0, DairyDay:0 },
      { range: "Pack 2", Amul: 10, CreamBell: 30, GoZero: 20, Havmor: 15, KwalityWalls: 10, Arun: 5, BaskinRobbins:0, Hocco:0, Nic:0, Grameen:0, Vadilal:0, Others:0, DairyDay:0 },
      { range: "Pack 3", BaskinRobbins: 40, GoZero: 12, CreamBell: 20, Havmor: 10, KwalityWalls: 8, Others: 5, Amul:0, Arun:0, Hocco:0, Nic:0, Grameen:0, Vadilal:0, DairyDay:0 },
      { range: "Pack 4", Hocco: 60, GoZero: 10, CreamBell: 12, Havmor: 10, KwalityWalls: 8, Amul:0, Arun:0, BaskinRobbins:0, Nic:0, Grameen:0, Vadilal:0, Others:0, DairyDay:0 },
      { range: "Pack 5", Amul: 8, Arun: 12, Havmor: 25, CreamBell: 30, GoZero: 15, KwalityWalls: 10, BaskinRobbins:0, Hocco:0, Nic:0, Grameen:0, Vadilal:0, Others:0, DairyDay:0 },
      { range: "Pack 6", BaskinRobbins: 55, Amul: 18, CreamBell: 12, Havmor: 10, KwalityWalls: 5, Arun:0, GoZero:0, Hocco:0, Nic:0, Grameen:0, Vadilal:0, Others:0, DairyDay:0 },
      { range: "Pack 7", GoZero: 45, Amul: 20, CreamBell: 18, Havmor: 10, KwalityWalls: 7, Arun:0, BaskinRobbins:0, Hocco:0, Nic:0, Grameen:0, Vadilal:0, Others:0, DairyDay:0 },
      { range: "Pack 8", CreamBell: 70, Amul: 10, GoZero: 6, Havmor: 8, KwalityWalls: 6, Arun:0, BaskinRobbins:0, Hocco:0, Nic:0, Grameen:0, Vadilal:0, Others:0, DairyDay:0 },
      { range: "Pack 9", Havmor: 100, Amul:0, Arun:0, BaskinRobbins:0, CreamBell:0, KwalityWalls:0, GoZero:0, Hocco:0, Nic:0, Grameen:0, Vadilal:0, Others:0, DairyDay:0 },
    ],
  },

  Cup: {
    pack: [
      { range: "Pack 0", KwalityWalls: 40, Amul: 20, Nic: 15, Havmor: 10, CreamBell: 10, Others: 5, Arun:0, BaskinRobbins:0, Hocco:0, Grameen:0, Vadilal:0, DairyDay:0, GoZero:0 },
      { range: "Pack 1", CreamBell: 70, Havmor: 10, Nic: 10, KwalityWalls: 6, Amul: 4, Arun:0, BaskinRobbins:0, Hocco:0, Grameen:0, Vadilal:0, Others:0, DairyDay:0 },
      { range: "Pack 2", Amul: 35, KwalityWalls: 25, Havmor: 20, Nic: 15, Others: 5, CreamBell:0, Arun:0, BaskinRobbins:0, Hocco:0, Grameen:0, Vadilal:0, DairyDay:0, GoZero:0 },
      { range: "Pack 3", Nic: 60, Havmor: 18, KwalityWalls: 12, Amul: 7, CreamBell: 3, Others:0, Arun:0, BaskinRobbins:0, Hocco:0, Grameen:0, Vadilal:0, DairyDay:0, GoZero:0 },
      { range: "Pack 4", CreamBell: 100, KwalityWalls:0, Amul:0, Nic:0, Havmor:0, Others:0, Arun:0, BaskinRobbins:0, Hocco:0, Grameen:0, Vadilal:0, DairyDay:0, GoZero:0 },
      { range: "Pack 5", KwalityWalls: 90, Amul: 10, Nic:0, Havmor:0, CreamBell:0, Others:0, Arun:0, BaskinRobbins:0, Hocco:0, Grameen:0, Vadilal:0, DairyDay:0, GoZero:0 },
      { range: "Pack 6", BaskinRobbins: 100, KwalityWalls:0, Amul:0, Nic:0, Havmor:0, CreamBell:0, Others:0, Arun:0, Hocco:0, Grameen:0, Vadilal:0, DairyDay:0, GoZero:0 },
      { range: "Pack 7", Havmor: 80, KwalityWalls: 15, Amul: 5, Nic:0, CreamBell:0, Others:0, Arun:0, BaskinRobbins:0, Hocco:0, Grameen:0, Vadilal:0, DairyDay:0, GoZero:0 },
      { range: "Pack 8", KwalityWalls: 65, CreamBell: 20, Amul: 10, Nic: 5, Others:0, Arun:0, BaskinRobbins:0, Hocco:0, Grameen:0, Vadilal:0, DairyDay:0, GoZero:0 },
      { range: "Pack 9", Amul: 50, Havmor: 25, KwalityWalls: 15, CreamBell: 5, Nic: 5, Others:0, Arun:0, BaskinRobbins:0, Hocco:0, Grameen:0, Vadilal:0, DairyDay:0, GoZero:0 },
      { range: "Pack 10", KwalityWalls: 100, Amul:0, Nic:0, Havmor:0, CreamBell:0, Others:0, Arun:0, BaskinRobbins:0, Hocco:0, Grameen:0, Vadilal:0, DairyDay:0, GoZero:0 },
    ],
  },
};

/* =========================
   PACK DISCOUNT (B3 - light per category)
   ========================= */
const categoryWisePackDiscount = {
  Cassata: [
    { pack: "Pack 1", Amul: 6, Arun: 4, BaskinRobbins: 5, CreamBell: 8, DairyDay: 4, GoZero: 7, Grameen: 3, Havmor: 9, Hocco: 5, KwalityWalls: 12, Nic: 6, Vadilal: 5, Others: 2 },
    { pack: "Pack 2", Amul: 5, Arun: 3, BaskinRobbins: 4, CreamBell: 7, DairyDay: 3, GoZero: 6, Grameen: 2, Havmor: 8, Hocco: 5, KwalityWalls: 10, Nic: 5, Vadilal: 4, Others: 2 },
    { pack: "Pack 3", Amul: 7, Arun: 4, BaskinRobbins: 5, CreamBell: 9, DairyDay: 5, GoZero: 7, Grameen: 3, Havmor: 10, Hocco: 6, KwalityWalls: 14, Nic: 6, Vadilal: 5, Others: 3 },
    { pack: "Pack 4", Amul: 6, Arun: 5, BaskinRobbins: 6, CreamBell: 10, DairyDay: 4, GoZero: 8, Grameen: 3, Havmor: 11, Hocco: 6, KwalityWalls: 15, Nic: 7, Vadilal: 5, Others: 3 },
  ],
  Cone: [
    { pack: "Pack 1", Amul: 5, Arun: 6, BaskinRobbins: 7, CreamBell: 9, DairyDay: 4, GoZero: 10, Grameen: 3, Havmor: 12, Hocco: 6, KwalityWalls: 13, Nic: 6, Vadilal: 5, Others: 2 },
    { pack: "Pack 2", Amul: 4, Arun: 5, BaskinRobbins: 6, CreamBell: 8, DairyDay: 4, GoZero: 9, Grameen: 2, Havmor: 10, Hocco: 5, KwalityWalls: 12, Nic: 5, Vadilal: 4, Others: 2 },
    { pack: "Pack 3", Amul: 6, Arun: 5, BaskinRobbins: 8, CreamBell: 10, DairyDay: 5, GoZero: 11, Grameen: 3, Havmor: 13, Hocco: 6, KwalityWalls: 14, Nic: 6, Vadilal: 5, Others: 3 },
    { pack: "Pack 4", Amul: 5, Arun: 6, BaskinRobbins: 9, CreamBell: 11, DairyDay: 5, GoZero: 12, Grameen: 3, Havmor: 14, Hocco: 7, KwalityWalls: 15, Nic: 7, Vadilal: 6, Others: 3 },
  ],
  Cup: [
    { pack: "Pack 1", Amul: 6, Arun: 4, BaskinRobbins: 8, CreamBell: 10, DairyDay: 5, GoZero: 12, Grameen: 3, Havmor: 15, Hocco: 6, KwalityWalls: 14, Nic: 7, Vadilal: 6, Others: 3 },
    { pack: "Pack 2", Amul: 5, Arun: 4, BaskinRobbins: 7, CreamBell: 9, DairyDay: 5, GoZero: 11, Grameen: 2, Havmor: 13, Hocco: 6, KwalityWalls: 12, Nic: 6, Vadilal: 5, Others: 2 },
    { pack: "Pack 3", Amul: 7, Arun: 5, BaskinRobbins: 9, CreamBell: 11, DairyDay: 6, GoZero: 13, Grameen: 3, Havmor: 16, Hocco: 7, KwalityWalls: 15, Nic: 8, Vadilal: 6, Others: 3 },
    { pack: "Pack 4", Amul: 6, Arun: 5, BaskinRobbins: 10, CreamBell: 12, DairyDay: 6, GoZero: 14, Grameen: 3, Havmor: 17, Hocco: 7, KwalityWalls: 15, Nic: 8, Vadilal: 6, Others: 3 },
  ],
};

/* =========================
   BRAND COLORS
   ========================= */
const brandColors = {
  Amul: "#2196F3",
  Arun: "#64B5F6",
  BaskinRobbins: "#1565C0",
  CreamBell: "#0288D1",
  DairyDay: "#E91E63",
  GoZero: "#EC407A",
  Grameen: "#9C27B0",
  Havmor: "#F06292",
  Hocco: "#BA68C8",
  KwalityWalls: "#AB47BC",
  Nic: "#7E57C2",
  Vadilal: "#FFA726",
  Others: "#8D6E63",
};

/* =========================
   MAIN COMPONENT
   ========================= */
const PriceAnalysis = () => {
  const categoryTabs = Object.keys(pricePerPackData);
  const [selectedCategory, setSelectedCategory] = useState("Cassata");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [openFilter, setOpenFilter] = useState(false);

  /* === Build brand list (from MRP + pack data) === */
  const allBrands = useMemo(() => {
    const set = new Set();
    // from MRP map for completeness
    Object.keys(categoryMRPData).forEach((cat) =>
      categoryMRPData[cat].forEach((r) => set.add(r.brand))
    );
    // also from pack saliency (some brands may exist there)
    pricePerPackData[selectedCategory].pack.forEach((row) =>
      Object.keys(row).forEach((k) => k !== "range" && set.add(k))
    );
    return ["All", ...Array.from(set)];
  }, [selectedCategory]);

  /* === Ensure brand exists in new category; reset to All if not === */
  useEffect(() => {
    // If user had selected a brand that's not present in combined list, reset to All
    if (selectedBrand !== "All" && !allBrands.includes(selectedBrand)) {
      setSelectedBrand("All");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, allBrands]);

  /* === PACK SALIENCY filtered by brand === */
  const filteredPackData = useMemo(() => {
    const pack = pricePerPackData[selectedCategory].pack;
    if (selectedBrand === "All") return pack;
    return pack.map((row) => ({ range: row.range, [selectedBrand]: row[selectedBrand] || 0 }));
  }, [selectedCategory, selectedBrand]);

  /* === Active MRP data per category & brand === */
  const activeMRPData = useMemo(() => {
    const rows = categoryMRPData[selectedCategory] || [];
    if (selectedBrand === "All") return rows;
    return rows.filter((r) => r.brand === selectedBrand);
  }, [selectedCategory, selectedBrand]);

  /* === Pack discount filtered by category & brand.
         Default (All) -> show per-pack average discount across brands.
         Brand selected -> show discount for that brand per pack.
  === */
  const filteredPackDiscount = useMemo(() => {
    const data = categoryWisePackDiscount[selectedCategory] || [];
    if (selectedBrand === "All") {
      return data.map((row) => {
        const brandKeys = Object.keys(row).filter((k) => k !== "pack");
        const total = brandKeys.reduce((s, k) => s + (row[k] || 0), 0);
        const avg = Math.round(total / brandKeys.length);
        return { pack: row.pack, discount: avg };
      });
    }
    return data.map((row) => ({ pack: row.pack, discount: row[selectedBrand] || 0 }));
  }, [selectedCategory, selectedBrand]);

  /* === Custom label inside bars when large enough === */
  const CustomLabel = ({ x, y, width, value }) =>
    typeof value === "number" && value >= 5 ? (
      <text x={x + width / 2} y={y + 15} fill="#fff" textAnchor="middle" fontSize={11} fontWeight="600">
        {value}%
      </text>
    ) : null;

  /* === Brand filter dialog UI === */
  const BrandFilterDialog = () =>
    openFilter ? (
      <div
        onClick={() => setOpenFilter(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: 360, maxWidth: "94%", background: "#fff", borderRadius: 12, padding: 20 }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <Filter size={18} />
            <h3 style={{ margin: 0 }}>Filters</h3>
          </div>

          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>Brand</label>
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          >
            {allBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            <button
              onClick={() => setSelectedBrand("All")}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #1976d2",
                background: "#fff",
                color: "#1976d2",
                fontWeight: 600,
              }}
            >
              Reset
            </button>
            <button
              onClick={() => setOpenFilter(false)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                border: "none",
                background: "#1976d2",
                color: "#fff",
                fontWeight: 600,
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    ) : null;

  /* === Main render === */
  return (
    <div style={{ padding: 24, background: "#f7f7f9", minHeight: "100vh" }}>
      {/* Category tabs */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 20,
          background: "#fff",
          padding: 8,
          borderRadius: 10,
        }}
      >
        {categoryTabs.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setSelectedCategory(cat);
            }}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: selectedCategory === cat ? "#1976d2" : "transparent",
              color: selectedCategory === cat ? "#fff" : "#333",
              fontWeight: 600,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Charts one-per-row */}
      <div style={{ display: "grid", gap: 24 }}>
        {/* MRP Chart */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 18 }}>
          <h3 style={{ margin: 0, marginBottom: 12 }}>MRP / Discount per Brand</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={activeMRPData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="brand" angle={-12} height={60} textAnchor="end" />
              <YAxis yAxisId="left" label={{ value: "MRP", angle: -90, position: "insideLeft" }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} domain={[0, 20]} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="mrp" radius={[8, 8, 0, 0]}>
                {activeMRPData.map((r) => (
                  <Cell key={r.brand} fill={brandColors[r.brand] || "#1976d2"} />
                ))}
              </Bar>
              <Line yAxisId="right" dataKey="discount" type="monotone" stroke="#f44336" strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Pack Discount Chart */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 18 }}>
          <h3 style={{ margin: 0, marginBottom: 12 }}>{`Pack Discount ${selectedBrand !== "All" ? `— ${selectedBrand}` : "(avg across brands)"}`}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={filteredPackDiscount}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="pack" />
              <YAxis tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="discount" fill="#1976d2" radius={[8, 8, 0, 0]} label={<CustomLabel />} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pack Saliency Chart */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 18 }}>
          <h3 style={{ margin: 0, marginBottom: 12 }}>{`Pack Wise Saliency ${selectedBrand !== "All" ? `— ${selectedBrand}` : ""}`}</h3>
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={filteredPackData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="range" />
              <YAxis tickFormatter={(v) => `${v}%`} />
              <Tooltip />
              <Legend />
              {Array.from(new Set(filteredPackData.flatMap((r) => Object.keys(r).filter((k) => k !== "range")))).map((brand) => (
                <Bar
                  key={brand}
                  dataKey={brand}
                  stackId="a"
                  fill={brandColors[brand] || "#ccc"}
                  radius={[6, 6, 0, 0]}
                  label={<CustomLabel />}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Floating Filter Button */}
      <button
        onClick={() => setOpenFilter(true)}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 64,
          height: 64,
          borderRadius: 32,
          border: "none",
          background: "#1976d2",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
          cursor: "pointer",
        }}
      >
        <SlidersHorizontal size={26} />
      </button>

      {/* Brand Filter Dialog */}
      {BrandFilterDialog()}
    </div>
  );
};

export default PriceAnalysis;
