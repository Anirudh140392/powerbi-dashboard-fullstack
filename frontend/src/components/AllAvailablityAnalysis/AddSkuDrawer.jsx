import React, { useState, useMemo } from "react";

const CSS = `
/* ================= DRAWER ================= */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
  z-index: 9999;
}

.drawer-panel {
  width: 1000px;
  max-width: 90vw;
  height: 100vh;
  background: white;
  box-shadow: -4px 0px 14px rgba(0,0,0,0.15);
  transform: translateX(100%);
  animation: slideIn 0.3s ease-out forwards;
  display: flex;
  flex-direction: column;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0%); }
}

/* ================= ORIGINAL UI ================= */
.add-sku-root {
  font-family: system-ui, sans-serif;
  height: 100%;
  background: white;
}

.add-sku-modal {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* HEADER */
.add-sku-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
}

.add-sku-close {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #f3f4f6;
  border: none;
  cursor: pointer;
  font-size: 18px;
}

/* BODY */
.add-sku-body {
  display: grid;
  grid-template-columns: 260px 1fr;
  flex: 1;
  min-height: 0;
}

/* FILTERS */
.filters-panel {
  padding: 16px;
  border-right: 1px solid #e5e7eb;
  overflow-y: auto;
}

.filter-section {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-top: 10px;
}

.filter-section-header {
  padding: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.filter-section-body {
  padding: 10px;
  border-top: 1px solid #e5e7eb;
}

.filter-checkbox,
.filter-pill {
  display: flex;
  gap: 8px;
  padding: 6px;
  cursor: pointer;
}

.filter-checkbox:hover,
.filter-pill:hover {
  background: #f3f4ff;
}

.filter-checkbox-box,
.filter-pill-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 2px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-checkbox-box.checked,
.filter-pill-icon.checked {
  border-color: #2563eb;
  background: #2563eb;
  color: white;
}

/* RIGHT PANEL */
.sku-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid #ddd;
}

.sku-list-scroll {
  margin-top: 12px;
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.sku-card {
  padding: 12px;
  display: grid;
  grid-template-columns: 50px 1fr 90px;
  cursor: pointer;
}

.sku-card:hover {
  background: #f9fafb;
}

.sku-card.selected {
  background: #e8f0ff;
}

.sku-thumb {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  border: 1px solid #a3d2ff;
  display: flex;
  justify-content: center;
  align-items: center;
}

.add-sku-btn {
  padding: 6px 12px;
  border-radius: 99px;
  border: 1px dashed #2563eb;
  background: #f0f8ff;
  cursor: pointer;
}

.add-sku-btn.added {
  background: #e8fff0;
  border-color: #16a34a;
}

/* FOOTER */
.add-sku-footer {
  padding: 12px;
  border-top: 1px solid #ddd;
  display: flex;
  justify-content: center;
}
.apply-btn {
  padding: 10px 24px;
  border-radius: 999px;
  background: #2563eb;
  color: white;
  border: none;
  cursor: pointer;
}
`;

/* ================= JSON ================= */
const PLATFORMS = [
  { id: "blinkit", label: "Blinkit" },
  { id: "instamart", label: "Instamart" },
  { id: "zepto", label: "Zepto" },
];

const CATEGORIES = [
  { id: "toothpaste", label: "Toothpaste" },
  { id: "baby-toothbrush", label: "Baby Toothbrush" },
  { id: "baby-toothpaste", label: "Baby Toothpaste" },
];

const BRANDS = ["Colgate", "Sensodyne", "Dabur", "Pepsodent", "Closeup"];

const PPU_BANDS = [
  { id: "all", label: "All" },
  { id: "0-200", label: "0–200" },
  { id: "200-400", label: "200–400" },
  { id: "400+", label: "400+" },
];

const GRAMMAGE_BANDS = [
  { id: "all", label: "All" },
  { id: "0-80", label: "0–80 g" },
  { id: "80-150", label: "80–150 g" },
  { id: "150-250", label: "150–250 g" },
  { id: "250+", label: "250+ g" },
];

const SKU_DATA = [
  {
    id: 1,
    name: "Colgate Strong Teeth (150 g)",
    platform: "blinkit",
    brand: "Colgate",
    category: "toothpaste",
    grammage: 150,
    ppuBand: "200-400",
    mySku: true,
  },
  {
    id: 2,
    name: "Sensodyne Deep Clean",
    platform: "blinkit",
    brand: "Sensodyne",
    category: "toothpaste",
    grammage: 70,
    ppuBand: "200-400",
  },
  {
    id: 3,
    name: "Sensodyne Rapid Relief",
    platform: "blinkit",
    brand: "Sensodyne",
    category: "toothpaste",
    grammage: 80,
    ppuBand: "200-400",
  },
  {
    id: 4,
    name: "Dabur Red Herbal (200 g)",
    platform: "blinkit",
    brand: "Dabur",
    category: "toothpaste",
    grammage: 200,
    ppuBand: "0-200",
  },
  {
    id: 5,
    name: "Colgate Visible White",
    platform: "blinkit",
    brand: "Colgate",
    category: "toothpaste",
    grammage: 120,
    ppuBand: "200-400",
    mySku: true,
  },
  {
    id: 6,
    name: "Sensodyne Repair & Protect",
    platform: "blinkit",
    brand: "Sensodyne",
    category: "toothpaste",
    grammage: 100,
    ppuBand: "400+",
  },
  {
    id: 7,
    name: "Pepsodent Germi Check",
    platform: "instamart",
    brand: "Pepsodent",
    category: "toothpaste",
    grammage: 150,
    ppuBand: "0-200",
  },
  {
    id: 8,
    name: "Closeup Everfresh (150 g)",
    platform: "zepto",
    brand: "Closeup",
    category: "toothpaste",
    grammage: 150,
    ppuBand: "0-200",
  },
];

function grammageBand(g) {
  if (g <= 80) return "0-80";
  if (g <= 150) return "80-150";
  if (g <= 250) return "150-250";
  return "250+";
}

/* ================= COMPONENT ================= */
export default function AddSkuDrawer({ open, onClose }) {
  /* 🔥 HOOKS ALWAYS ON TOP — fixed ordering */
  const [search, setSearch] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("blinkit");
  const [selectedCategories, setSelectedCategories] = useState(
    new Set(["toothpaste"])
  );
  const [selectedBrands, setSelectedBrands] = useState(new Set());
  const [selectedPPU, setSelectedPPU] = useState("all");
  const [selectedGrammage, setSelectedGrammage] = useState("all");
  const [selectedSkuIds, setSelectedSkuIds] = useState(new Set([1]));

  /* FILTERING */
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return SKU_DATA.filter((s) => {
      if (s.platform !== selectedPlatform) return false;
      if (!selectedCategories.has(s.category)) return false;
      if (selectedBrands.size && !selectedBrands.has(s.brand)) return false;
      if (selectedPPU !== "all" && s.ppuBand !== selectedPPU) return false;
      if (
        selectedGrammage !== "all" &&
        grammageBand(s.grammage) !== selectedGrammage
      )
        return false;
      if (term && !s.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [
    search,
    selectedPlatform,
    selectedCategories,
    selectedBrands,
    selectedPPU,
    selectedGrammage,
  ]);

  /* Toggle SKU */
  const toggleSku = (id) => {
    setSelectedSkuIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* RETURN — drawer is conditionally shown, NOT hooks */
  return (
    <>
      <style>{CSS}</style>

      {open && (
        <div className="drawer-overlay" onClick={onClose}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="add-sku-root">
              <div className="add-sku-modal">
                {/* HEADER */}
                <div className="add-sku-header">
                  <h3>Add SKU</h3>
                  <button className="add-sku-close" onClick={onClose}>
                    ×
                  </button>
                </div>

                {/* BODY */}
                <div className="add-sku-body">
                  {/* FILTER PANEL */}
                  <div className="filters-panel">
                    {/* Platforms */}
                    <div className="filter-section">
                      <div className="filter-section-header">Platforms</div>
                      <div className="filter-section-body">
                        {PLATFORMS.map((p) => (
                          <div
                            key={p.id}
                            className="filter-pill"
                            onClick={() => setSelectedPlatform(p.id)}
                          >
                            <div
                              className={`filter-pill-icon ${
                                selectedPlatform === p.id ? "checked" : ""
                              }`}
                            />
                            {p.label}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Categories */}
                    <div className="filter-section">
                      <div className="filter-section-header">Category</div>
                      <div className="filter-section-body">
                        {CATEGORIES.map((c) => (
                          <div
                            key={c.id}
                            className="filter-checkbox"
                            onClick={() =>
                              setSelectedCategories((prev) => {
                                const next = new Set(prev);
                                next.has(c.id)
                                  ? next.delete(c.id)
                                  : next.add(c.id);
                                return next;
                              })
                            }
                          >
                            <div
                              className={`filter-checkbox-box ${
                                selectedCategories.has(c.id) ? "checked" : ""
                              }`}
                            >
                              {selectedCategories.has(c.id) && "✓"}
                            </div>
                            {c.label}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Brands */}
                    <div className="filter-section">
                      <div className="filter-section-header">Brands</div>
                      <div className="filter-section-body">
                        {BRANDS.map((b) => (
                          <div
                            key={b}
                            className="filter-checkbox"
                            onClick={() =>
                              setSelectedBrands((prev) => {
                                const next = new Set(prev);
                                next.has(b) ? next.delete(b) : next.add(b);
                                return next;
                              })
                            }
                          >
                            <div
                              className={`filter-checkbox-box ${
                                selectedBrands.has(b) ? "checked" : ""
                              }`}
                            >
                              {selectedBrands.has(b) && "✓"}
                            </div>
                            {b}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PPU */}
                    <div className="filter-section">
                      <div className="filter-section-header">PPU (x100)</div>
                      <div className="filter-section-body">
                        {PPU_BANDS.map((band) => (
                          <div
                            key={band.id}
                            className="filter-checkbox"
                            onClick={() => setSelectedPPU(band.id)}
                          >
                            <div
                              className={`filter-checkbox-box ${
                                selectedPPU === band.id ? "checked" : ""
                              }`}
                            >
                              {selectedPPU === band.id && "✓"}
                            </div>
                            {band.label}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* GRAMMAGE */}
                    <div className="filter-section">
                      <div className="filter-section-header">Grammage</div>
                      <div className="filter-section-body">
                        {GRAMMAGE_BANDS.map((band) => (
                          <div
                            key={band.id}
                            className="filter-checkbox"
                            onClick={() => setSelectedGrammage(band.id)}
                          >
                            <div
                              className={`filter-checkbox-box ${
                                selectedGrammage === band.id ? "checked" : ""
                              }`}
                            >
                              {selectedGrammage === band.id && "✓"}
                            </div>
                            {band.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT SIDE LIST */}
                  <div className="sku-panel">
                    {/* Search */}
                    <input
                      className="search-input"
                      placeholder="Search SKUs"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />

                    {/* SKU List */}
                    <div className="sku-list-scroll">
                      {filtered.map((sku) => {
                        const selected = selectedSkuIds.has(sku.id);
                        return (
                          <div
                            key={sku.id}
                            className={`sku-card ${selected ? "selected" : ""}`}
                            onClick={() => toggleSku(sku.id)}
                          >
                            <div className="sku-thumb">
                              {sku.brand?.charAt(0).toUpperCase()}
                            </div>

                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>
                                {sku.name}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 4,
                                  marginTop: 4,
                                }}
                              >
                                <span className="sku-chip">
                                  {sku.grammage} g
                                </span>
                                <span className="sku-chip secondary">
                                  Toothpaste
                                </span>
                              </div>
                            </div>

                            <div>
                              <button
                                className={`add-sku-btn ${
                                  selected ? "added" : ""
                                }`}
                              >
                                {selected ? "Added" : "+ Add SKU"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="add-sku-footer">
                  <button className="apply-btn">Apply</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
