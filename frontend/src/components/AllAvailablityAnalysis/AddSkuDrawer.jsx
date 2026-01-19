import React, { useState, useMemo, useEffect } from "react";
import { Sparkles, Plus, Check, X } from "lucide-react";

const CSS = `
/* ================= DRAWER ================= */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: flex-end;
  z-index: 9999;
}

.drawer-panel {
  width: 1000px;
  max-width: 90vw;
  height: 100vh;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: -8px 0px 32px rgba(15,23,42,0.2);
  transform: translateX(100%);
  animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  display: flex;
  flex-direction: column;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0%); opacity: 1; }
}

/* ================= PREMIUM UI ================= */
.add-sku-root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  height: 100%;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
}

.add-sku-modal {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* HEADER */
.add-sku-header {
  padding: 24px;
  background: linear-gradient(135deg, #0F172A 0%, #1e293b 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 20px rgba(15,23,42,0.15);
}

.add-sku-header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.add-sku-close {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.25);
  cursor: pointer;
  font-size: 20px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.add-sku-close:hover {
  background: rgba(255,255,255,0.25);
  transform: rotate(90deg);
}

/* BODY */
.add-sku-body {
  display: grid;
  grid-template-columns: 280px 1fr;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* FILTERS */
.filters-panel {
  padding: 20px;
  border-right: 1px solid #e2e8f0;
  overflow-y: auto;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.filter-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 14px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15,23,42,0.05);
  transition: all 0.2s;
}

.filter-section:hover {
  box-shadow: 0 4px 12px rgba(15,23,42,0.1);
}

.filter-section-header {
  padding: 12px 14px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  border-bottom: 1px solid #e2e8f0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #0f172a;
}

.filter-section-body {
  padding: 10px 8px;
}

.filter-checkbox,
.filter-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s;
  margin-bottom: 4px;
}

.filter-checkbox:hover,
.filter-pill:hover {
  background: #f1f5f9;
}

.filter-checkbox-box,
.filter-pill-icon {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 2px solid #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  transition: all 0.2s;
}

.filter-checkbox-box.checked,
.filter-pill-icon.checked {
  border-color: #0ea5e9;
  background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(14,165,233,0.3);
}

.filter-checkbox, .filter-pill {
  font-size: 13px;
  color: #475569;
  font-weight: 500;
}

/* RIGHT PANEL */
.sku-panel {
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: white;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(15,23,42,0.05);
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #0ea5e9;
  box-shadow: 0 0 0 3px rgba(14,165,233,0.1), 0 2px 8px rgba(15,23,42,0.08);
}

.sku-list-scroll {
  margin-top: 14px;
  flex: 1;
  overflow-y: auto;
  border-radius: 12px;
  padding: 4px;
}

.sku-list-scroll::-webkit-scrollbar {
  width: 6px;
}

.sku-list-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.sku-list-scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.sku-list-scroll::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.sku-card {
  padding: 14px;
  display: grid;
  grid-template-columns: 56px 1fr 110px;
  gap: 12px;
  cursor: pointer;
  margin-bottom: 10px;
  border-radius: 12px;
  background: white;
  border: 1px solid #e2e8f0;
  align-items: center;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.sku-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(15,23,42,0.12);
  border-color: #cbd5e1;
}

.sku-card.selected {
  background: linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%);
  border-color: #0ea5e9;
  box-shadow: 0 4px 16px rgba(14,165,233,0.15);
}

.sku-thumb {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  border: 2px solid #e2e8f0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 20px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

.sku-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sku-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.sku-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.sku-chip {
  display: inline-block;
  padding: 4px 8px;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}

.add-sku-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1.5px solid #cbd5e1;
  background: white;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  white-space: nowrap;
}

.add-sku-btn:hover {
  border-color: #0ea5e9;
  color: #0ea5e9;
  background: #f0f9ff;
}

.add-sku-btn.added {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border-color: #22c55e;
  color: #166534;
}

/* FOOTER */
.add-sku-footer {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
}

.apply-btn {
  padding: 12px 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);
  color: white;
  border: none;
  cursor: pointer;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 4px 16px rgba(14,165,233,0.3);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.apply-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(14,165,233,0.4);
}

.cancel-btn {
  padding: 12px 32px;
  border-radius: 10px;
  background: white;
  color: #475569;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  font-weight: 700;
  font-size: 14px;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.apply-btn:disabled {
  opacity: 0.6 !important;
  cursor: not-allowed !important;
}

.apply-btn:disabled:hover {
  transform: none !important;
  box-shadow: 0 4px 16px rgba(14,165,233,0.3);
}
`;

/* ================= JSON ================= */

// Premium color palette for random backgrounds
const COLOR_PALETTE = [
  { bg: "linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%)", text: "white" },
  { bg: "linear-gradient(135deg, #4ECDC4 0%, #44B7B4 100%)", text: "white" },
  { bg: "linear-gradient(135deg, #FFE66D 0%, #FFD93D 100%)", text: "#663c00" },
  { bg: "linear-gradient(135deg, #95E1D3 0%, #75D4C1 100%)", text: "white" },
  { bg: "linear-gradient(135deg, #A8E6CF 0%, #7FD8BE 100%)", text: "white" },
  { bg: "linear-gradient(135deg, #FF8B94 0%, #FF6B7A 100%)", text: "white" },
  { bg: "linear-gradient(135deg, #B4A7FF 0%, #9B7EFF 100%)", text: "white" },
  { bg: "linear-gradient(135deg, #FFB6B9 0%, #FF9BA9 100%)", text: "white" },
  { bg: "linear-gradient(135deg, #A8D8EA 0%, #7BC4D8 100%)", text: "white" },
  { bg: "linear-gradient(135deg, #FFAFAF 0%, #FF8E9F 100%)", text: "white" },
];

const getRandomColor = (id) => {
  return COLOR_PALETTE[id % COLOR_PALETTE.length];
};

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

export const SKU_DATA = [
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
export default function AddSkuDrawer({
  open,
  onClose,
  onApply,
  selectedIds = [],
}) {
  /* 🔥 HOOKS ALWAYS ON TOP — fixed ordering */
  const [search, setSearch] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("blinkit");
  const [selectedCategories, setSelectedCategories] = useState(
    new Set(["toothpaste"])
  );
  const [selectedBrands, setSelectedBrands] = useState(new Set());
  const [selectedPPU, setSelectedPPU] = useState("all");
  const [selectedGrammage, setSelectedGrammage] = useState("all");
  const [selectedSkuIds, setSelectedSkuIds] = useState(new Set(selectedIds));
  const [isApplying, setIsApplying] = useState(false);

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
  useEffect(() => {
    setSelectedSkuIds(new Set(selectedIds));
  }, [selectedIds, open]);

  /* Toggle SKU */
  const toggleSku = (id) => {
    setSelectedSkuIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleApply = async () => {
    if (selectedSkuIds.size === 0) return;
    setIsApplying(true);

    const selectedSkus = SKU_DATA.filter((s) => selectedSkuIds.has(s.id));

    try {
      if (onApply) {
        await onApply(Array.from(selectedSkuIds), selectedSkus);
      }
      // Visual feedback: button shows success state briefly
      setTimeout(() => {
        setIsApplying(false);
        onClose();
      }, 500);
    } catch (error) {
      console.error("Error applying SKUs:", error);
      setIsApplying(false);
    }
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
                  <div className="add-sku-header-title">
                    <Sparkles size={24} style={{ color: "#FBBF24" }} />
                    Add SKU
                  </div>
                  <button className="add-sku-close" onClick={onClose}>
                    <X size={20} />
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
                            <div
                              className="sku-thumb"
                              style={{
                                background: getRandomColor(sku.id).bg,
                                color: getRandomColor(sku.id).text,
                              }}
                            >
                              {sku.brand?.charAt(0).toUpperCase()}
                            </div>

                            <div className="sku-info">
                              <div className="sku-name">{sku.name}</div>
                              <div className="sku-meta">
                                <span className="sku-chip">
                                  {sku.grammage} g
                                </span>
                                <span className="sku-chip brand">
                                  {sku.brand}
                                </span>
                              </div>
                            </div>

                            <div>
                              <button
                                className={`add-sku-btn ${
                                  selected ? "added" : ""
                                }`}
                              >
                                {selected ? (
                                  <>
                                    <Check size={14} />
                                    Added
                                  </>
                                ) : (
                                  <>
                                    <Plus size={14} />
                                    Add
                                  </>
                                )}
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
                  <button
                    className="apply-btn"
                    onClick={handleApply}
                    disabled={selectedSkuIds.size === 0 || isApplying}
                    style={{
                      opacity: selectedSkuIds.size === 0 ? 0.5 : 1,
                      cursor:
                        selectedSkuIds.size === 0 || isApplying
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {isApplying ? (
                      <>
                        <Sparkles
                          size={16}
                          style={{ animation: "spin 1s linear infinite" }}
                        />
                        Applying...
                      </>
                    ) : (
                      `Apply (${selectedSkuIds.size} selected)`
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
