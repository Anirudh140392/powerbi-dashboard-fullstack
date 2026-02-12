// ═══════════════════════════════════════════════════════════════
// COMPLETE LOGICAL DATA MATRIX — NO RANDOMNESS
// Every entity × KPI combination has a unique hardcoded value.
// ═══════════════════════════════════════════════════════════════

// Helper (kept for legacy references but NO randomness inside)
function applyWeightedVariance(value) {
  return typeof value === 'number' ? value : 0;
}

const getSeedFromStr = (str) => {
  let h = 0xdeadbeef;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
  }
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const getVariance = (seedStr, pointSeed = "") => {
  const val = getSeedFromStr((seedStr || "default") + pointSeed);
  // Range: 0.7 to 1.3 for more visible changes when filters change
  return 0.7 + val * 0.6;
};

// ── Per-Entity KPI Data (keys are lowercase) ─────────────────
const ENTITY_DATA = {
  // ── PLATFORMS ───────────────────────────────────────────────
  blinkit: { offtakes: 4.8, spend: 0.82, roas: 5.9, categorySize: 18.2, conversion: 3.2, availability: 85.8, sos: 32.4, marketShare: 28.5, inorgSales: 14.2, dspSales: 8.5, promoMyBrand: 22.1, promoCompete: 18.4, cpm: 165, cpc: 14.2, osa: 85.8, doi: 38, fillrate: 86.5, assortment: 156, psl: 1.45, promo: 7.2, market: 28.5, inorg: 14.2 },
  instamart: { offtakes: 3.9, spend: 0.68, roas: 5.7, categorySize: 15.8, conversion: 2.8, availability: 84.7, sos: 29.5, marketShare: 25.1, inorgSales: 12.8, dspSales: 7.2, promoMyBrand: 19.8, promoCompete: 16.2, cpm: 152, cpc: 15.8, osa: 84.7, doi: 42, fillrate: 85.8, assortment: 142, psl: 1.28, promo: 6.4, market: 25.1, inorg: 12.8 },
  zepto: { offtakes: 3.2, spend: 0.55, roas: 5.8, categorySize: 13.5, conversion: 2.5, availability: 84.2, sos: 26.8, marketShare: 22.4, inorgSales: 11.5, dspSales: 6.8, promoMyBrand: 17.5, promoCompete: 14.8, cpm: 138, cpc: 16.5, osa: 84.2, doi: 44, fillrate: 85.2, assortment: 134, psl: 1.12, promo: 5.8, market: 22.4, inorg: 11.5 },
  flipkart: { offtakes: 2.4, spend: 0.42, roas: 5.7, categorySize: 11.2, conversion: 1.9, availability: 82.5, sos: 24.2, marketShare: 19.8, inorgSales: 10.2, dspSales: 5.5, promoMyBrand: 15.2, promoCompete: 12.5, cpm: 178, cpc: 19.2, osa: 82.5, doi: 48, fillrate: 84.5, assortment: 128, psl: 0.98, promo: 5.2, market: 19.8, inorg: 10.2 },
  amazon: { offtakes: 2.8, spend: 0.48, roas: 5.8, categorySize: 12.4, conversion: 2.1, availability: 85.2, sos: 25.5, marketShare: 21.2, inorgSales: 10.8, dspSales: 6.2, promoMyBrand: 16.4, promoCompete: 13.8, cpm: 185, cpc: 18.5, osa: 85.2, doi: 46, fillrate: 86.2, assortment: 132, psl: 1.05, promo: 5.5, market: 21.2, inorg: 10.8 },

  // ── ICE CREAM BRANDS / KW Competitors ──────────────────────
  "kwality walls": { offtakes: 5.6, spend: 0.95, roas: 5.9, categorySize: 21.2, conversion: 3.5, availability: 88.2, sos: 38.2, marketShare: 32.4, inorgSales: 16.5, dspSales: 9.8, promoMyBrand: 26.2, promoCompete: 22.5, cpm: 135, cpc: 12.8, osa: 88.2, doi: 34, fillrate: 89.5, assortment: 168, psl: 1.65, promo: 8.2, market: 32.4, inorg: 16.5 },
  amul: { offtakes: 4.2, spend: 0.75, roas: 5.6, categorySize: 17.5, conversion: 2.8, availability: 85.5, sos: 34.5, marketShare: 28.1, inorgSales: 14.2, dspSales: 8.2, promoMyBrand: 22.5, promoCompete: 19.2, cpm: 148, cpc: 14.5, osa: 85.5, doi: 39, fillrate: 86.8, assortment: 155, psl: 1.42, promo: 7.2, market: 28.1, inorg: 14.2 },
  "mother dairy": { offtakes: 3.1, spend: 0.52, roas: 6.0, categorySize: 12.8, conversion: 2.2, availability: 82.8, sos: 25.1, marketShare: 18.5, inorgSales: 9.8, dspSales: 5.5, promoMyBrand: 14.8, promoCompete: 12.2, cpm: 162, cpc: 17.5, osa: 82.8, doi: 45, fillrate: 85.5, assortment: 132, psl: 0.98, promo: 5.2, market: 18.5, inorg: 9.8 },
  vadilal: { offtakes: 2.5, spend: 0.38, roas: 6.6, categorySize: 9.8, conversion: 1.8, availability: 80.2, sos: 22.4, marketShare: 15.2, inorgSales: 8.5, dspSales: 4.8, promoMyBrand: 12.5, promoCompete: 10.8, cpm: 172, cpc: 19.2, osa: 80.2, doi: 48, fillrate: 81.2, assortment: 118, psl: 0.85, promo: 4.5, market: 15.2, inorg: 8.5 },
  havmor: { offtakes: 1.8, spend: 0.32, roas: 5.6, categorySize: 7.5, conversion: 1.5, availability: 78.8, sos: 18.2, marketShare: 12.5, inorgSales: 7.2, dspSales: 4.2, promoMyBrand: 10.2, promoCompete: 8.5, cpm: 195, cpc: 22.5, osa: 78.8, doi: 52, fillrate: 80.8, assortment: 98, psl: 0.72, promo: 3.8, market: 12.5, inorg: 7.2 },
  cornetto: { offtakes: 2.5, spend: 0.38, roas: 6.6, categorySize: 9.8, conversion: 1.8, availability: 81.2, sos: 22.4, marketShare: 15.2, inorgSales: 8.5, dspSales: 4.8, promoMyBrand: 12.5, promoCompete: 10.8, cpm: 172, cpc: 19.2, osa: 81.2, doi: 48, fillrate: 82.2, assortment: 118, psl: 0.85, promo: 4.5, market: 15.2, inorg: 8.5 },
  magnum: { offtakes: 1.8, spend: 0.32, roas: 5.6, categorySize: 7.5, conversion: 1.5, availability: 77.8, sos: 18.2, marketShare: 12.5, inorgSales: 7.2, dspSales: 4.2, promoMyBrand: 10.2, promoCompete: 8.5, cpm: 195, cpc: 22.5, osa: 77.8, doi: 52, fillrate: 79.8, assortment: 98, psl: 0.72, promo: 3.8, market: 12.5, inorg: 7.2 },
  feast: { offtakes: 1.2, spend: 0.22, roas: 5.5, categorySize: 5.8, conversion: 1.2, availability: 76.5, sos: 14.5, marketShare: 9.8, inorgSales: 5.8, dspSales: 3.5, promoMyBrand: 8.2, promoCompete: 6.8, cpm: 215, psl: 0.58, promo: 3.2, market: 9.8, inorg: 5.8, osa: 76.5, doi: 56, fillrate: 78.5, assortment: 82 },
  twister: { offtakes: 0.9, spend: 0.18, roas: 5.0, categorySize: 4.2, conversion: 0.9, availability: 75.8, sos: 11.2, marketShare: 7.5, inorgSales: 4.5, dspSales: 2.8, promoMyBrand: 6.5, promoCompete: 5.2, cpm: 235, psl: 0.45, promo: 2.5, market: 7.5, inorg: 4.5, osa: 75.8, doi: 62, fillrate: 77.8, assortment: 68 },

  // ── MONTHS ─────────────────────────────────────────────────
  oct: { offtakes: 4.5, spend: 0.78, roas: 5.8, categorySize: 17.8, conversion: 3.1, availability: 81.5, sos: 31.2, marketShare: 27.5, inorgSales: 13.8, dspSales: 8.2, promoMyBrand: 21.5, promoCompete: 17.8, cpm: 148, cpc: 14.8, osa: 81.5, doi: 39, fillrate: 84.2, assortment: 152, psl: 1.38, promo: 7.0, market: 27.5, inorg: 13.8 },
  nov: { offtakes: 3.8, spend: 0.65, roas: 5.8, categorySize: 15.2, conversion: 2.7, availability: 79.8, sos: 28.5, marketShare: 24.8, inorgSales: 12.2, dspSales: 7.5, promoMyBrand: 19.2, promoCompete: 15.8, cpm: 155, cpc: 16.2, osa: 79.8, doi: 42, fillrate: 83.5, assortment: 145, psl: 1.22, promo: 6.2, market: 24.8, inorg: 12.2 },
  dec: { offtakes: 5.2, spend: 0.88, roas: 5.9, categorySize: 20.5, conversion: 3.5, availability: 83.2, sos: 34.8, marketShare: 29.5, inorgSales: 15.5, dspSales: 9.2, promoMyBrand: 25.5, promoCompete: 21.2, cpm: 138, cpc: 13.5, osa: 83.2, doi: 36, fillrate: 85.8, assortment: 162, psl: 1.55, promo: 8.5, market: 29.5, inorg: 15.5 },
  jan: { offtakes: 3.2, spend: 0.52, roas: 6.2, categorySize: 12.8, conversion: 2.2, availability: 77.5, sos: 25.2, marketShare: 22.1, inorgSales: 10.8, dspSales: 6.2, promoMyBrand: 16.8, promoCompete: 13.5, cpm: 168, cpc: 18.5, osa: 77.5, doi: 46, fillrate: 81.2, assortment: 135, psl: 1.08, promo: 5.5, market: 22.1, inorg: 10.8 },

  // ── ICE CREAM CATEGORIES ──────────────────────────────────
  cassata: { offtakes: 2.8, spend: 0.42, roas: 6.7, categorySize: 10.5, conversion: 2.8, availability: 81.2, sos: 28.5, marketShare: 24.2, inorgSales: 12.5, dspSales: 7.2, promoMyBrand: 18.5, promoCompete: 15.2, cpm: 145, cpc: 15.2, osa: 81.2, doi: 38, fillrate: 84.5, assortment: 24, psl: 0.85, promo: 6.2, market: 24.2, inorg: 12.5 },
  "core tub": { offtakes: 3.5, spend: 0.58, roas: 6.0, categorySize: 14.2, conversion: 3.1, availability: 82.5, sos: 30.2, marketShare: 26.5, inorgSales: 13.8, dspSales: 8.2, promoMyBrand: 20.5, promoCompete: 17.2, cpm: 138, cpc: 14.5, osa: 82.5, doi: 36, fillrate: 85.2, assortment: 18, psl: 0.98, promo: 7.0, market: 26.5, inorg: 13.8 },
  cup: { offtakes: 1.8, spend: 0.28, roas: 6.4, categorySize: 7.2, conversion: 2.2, availability: 78.5, sos: 22.5, marketShare: 18.8, inorgSales: 9.5, dspSales: 5.5, promoMyBrand: 14.2, promoCompete: 11.8, cpm: 158, cpc: 17.2, osa: 88.5, doi: 42, fillrate: 92.8, assortment: 12, psl: 0.62, promo: 4.8, market: 18.8, inorg: 9.5 },
  "kw sticks": { offtakes: 1.5, spend: 0.22, roas: 6.8, categorySize: 5.8, conversion: 1.8, availability: 76.2, sos: 19.8, marketShare: 15.5, inorgSales: 7.8, dspSales: 4.5, promoMyBrand: 12.2, promoCompete: 9.8, cpm: 168, cpc: 19.5, osa: 86.2, doi: 45, fillrate: 91.2, assortment: 8, psl: 0.48, promo: 3.8, market: 15.5, inorg: 7.8 },
  sandwich: { offtakes: 2.2, spend: 0.35, roas: 6.3, categorySize: 8.8, conversion: 2.5, availability: 80.2, sos: 25.5, marketShare: 21.2, inorgSales: 10.8, dspSales: 6.2, promoMyBrand: 16.5, promoCompete: 13.8, cpm: 148, cpc: 16.2, osa: 90.2, doi: 40, fillrate: 93.5, assortment: 15, psl: 0.72, promo: 5.5, market: 21.2, inorg: 10.8 },
  "family pack": { offtakes: 2.5, spend: 0.38, roas: 6.6, categorySize: 9.5, conversion: 2.4, availability: 79.8, sos: 24.8, marketShare: 20.5, inorgSales: 10.2, dspSales: 5.8, promoMyBrand: 15.8, promoCompete: 13.2, cpm: 152, cpc: 16.8, osa: 89.8, doi: 41, fillrate: 93.2, assortment: 14, psl: 0.78, promo: 5.2, market: 20.5, inorg: 10.2 },
  chocobar: { offtakes: 1.2, spend: 0.18, roas: 6.7, categorySize: 4.5, conversion: 1.5, availability: 75.5, sos: 17.2, marketShare: 13.5, inorgSales: 6.8, dspSales: 3.8, promoMyBrand: 10.2, promoCompete: 8.5, cpm: 175, cpc: 20.5, osa: 85.5, doi: 48, fillrate: 89.8, assortment: 6, psl: 0.38, promo: 3.2, market: 13.5, inorg: 6.8 },
  kulfi: { offtakes: 1.0, spend: 0.15, roas: 6.7, categorySize: 3.8, conversion: 1.2, availability: 73.2, sos: 14.5, marketShare: 11.2, inorgSales: 5.5, dspSales: 3.2, promoMyBrand: 8.5, promoCompete: 7.2, cpm: 185, cpc: 22.5, osa: 83.2, doi: 52, fillrate: 88.5, assortment: 5, psl: 0.32, promo: 2.8, market: 11.2, inorg: 5.5 },
  "jelly cups": { offtakes: 0.8, spend: 0.12, roas: 6.7, categorySize: 3.2, conversion: 1.0, availability: 71.5, sos: 12.2, marketShare: 9.5, inorgSales: 4.5, dspSales: 2.5, promoMyBrand: 7.2, promoCompete: 5.8, cpm: 195, cpc: 24.5, osa: 81.5, doi: 55, fillrate: 86.5, assortment: 4, psl: 0.25, promo: 2.2, market: 9.5, inorg: 4.5 },
  "brownie tub": { offtakes: 0.6, spend: 0.10, roas: 6.0, categorySize: 2.5, conversion: 0.8, availability: 69.8, sos: 10.5, marketShare: 7.8, inorgSales: 3.8, dspSales: 2.2, promoMyBrand: 5.8, promoCompete: 4.8, cpm: 208, cpc: 26.5, osa: 79.8, doi: 58, fillrate: 85.2, assortment: 3, psl: 0.20, promo: 1.8, market: 7.8, inorg: 3.8 },
  exotics: { offtakes: 0.5, spend: 0.08, roas: 6.3, categorySize: 2.2, conversion: 0.7, availability: 68.5, sos: 8.5, marketShare: 6.2, inorgSales: 3.2, dspSales: 1.8, promoMyBrand: 4.8, promoCompete: 3.8, cpm: 218, cpc: 28.5, osa: 78.5, doi: 60, fillrate: 84.2, assortment: 3, psl: 0.18, promo: 1.5, market: 6.2, inorg: 3.2 },
  others: { offtakes: 0.4, spend: 0.05, roas: 5.5, categorySize: 1.8, conversion: 0.5, availability: 65.2, sos: 6.2, marketShare: 4.5, inorgSales: 2.5, dspSales: 1.2, promoMyBrand: 3.5, promoCompete: 2.5, cpm: 235, cpc: 32.5, osa: 75.2, doi: 65, fillrate: 82.5, assortment: 2, psl: 0.12, promo: 1.0, market: 4.5, inorg: 2.5 },

  // ── SKUs (Kwality Walls product SKUs) ─────────────────────
  sku1: { offtakes: 1.8, spend: 0.28, roas: 6.4, categorySize: 6.8, conversion: 2.5, availability: 82.8, sos: 28.5, marketShare: 22.4, inorgSales: 11.2, dspSales: 6.5, promoMyBrand: 18.5, promoCompete: 15.2, cpm: 148, cpc: 14.2, osa: 82.8, doi: 38, fillrate: 85.2, assortment: 1, psl: 0.42, promo: 5.8, market: 22.4, inorg: 11.2 },
  sku2: { offtakes: 1.5, spend: 0.24, roas: 6.3, categorySize: 5.8, conversion: 2.2, availability: 80.5, sos: 25.2, marketShare: 19.8, inorgSales: 9.8, dspSales: 5.8, promoMyBrand: 16.2, promoCompete: 13.5, cpm: 158, cpc: 16.5, osa: 80.5, doi: 41, fillrate: 83.8, assortment: 1, psl: 0.35, promo: 5.2, market: 19.8, inorg: 9.8 },
  sku3: { offtakes: 1.2, spend: 0.18, roas: 6.7, categorySize: 4.5, conversion: 1.8, availability: 77.2, sos: 21.5, marketShare: 16.5, inorgSales: 8.2, dspSales: 4.8, promoMyBrand: 13.5, promoCompete: 11.2, cpm: 168, cpc: 18.8, osa: 77.2, doi: 45, fillrate: 81.5, assortment: 1, psl: 0.28, promo: 4.5, market: 16.5, inorg: 8.2 },
  sku4: { offtakes: 0.9, spend: 0.15, roas: 6.0, categorySize: 3.5, conversion: 1.4, availability: 74.5, sos: 18.2, marketShare: 13.2, inorgSales: 6.8, dspSales: 3.5, promoMyBrand: 10.8, promoCompete: 8.8, cpm: 182, cpc: 21.5, osa: 74.5, doi: 49, fillrate: 79.2, assortment: 1, psl: 0.22, promo: 3.8, market: 13.2, inorg: 6.8 },

  // ── LOCATIONS ──────────────────────────────────────────────
  mumbai: { offtakes: 5.2, spend: 0.88, roas: 5.9, categorySize: 20.5, conversion: 3.4, availability: 83.2, sos: 33.5, marketShare: 29.8, inorgSales: 15.5, dspSales: 9.2, promoMyBrand: 24.5, promoCompete: 20.5, cpm: 142, cpc: 13.5, osa: 83.2, doi: 36, fillrate: 85.5, assortment: 158, psl: 1.55, promo: 7.8, market: 29.8, inorg: 15.5 },
  delhi: { offtakes: 4.8, spend: 0.82, roas: 5.8, categorySize: 18.8, conversion: 3.1, availability: 81.5, sos: 31.2, marketShare: 27.5, inorgSales: 14.2, dspSales: 8.5, promoMyBrand: 22.5, promoCompete: 18.8, cpm: 148, cpc: 14.2, osa: 81.5, doi: 38, fillrate: 84.8, assortment: 152, psl: 1.42, promo: 7.2, market: 27.5, inorg: 14.2 },
  bangalore: { offtakes: 3.5, spend: 0.58, roas: 6.0, categorySize: 14.2, conversion: 2.5, availability: 78.5, sos: 27.2, marketShare: 23.5, inorgSales: 11.8, dspSales: 6.8, promoMyBrand: 18.2, promoCompete: 15.2, cpm: 155, cpc: 16.2, osa: 78.5, doi: 43, fillrate: 82.5, assortment: 138, psl: 1.18, promo: 6.0, market: 23.5, inorg: 11.8 },
  hyderabad: { offtakes: 2.8, spend: 0.45, roas: 6.2, categorySize: 11.5, conversion: 2.0, availability: 75.8, sos: 24.5, marketShare: 20.2, inorgSales: 10.2, dspSales: 5.5, promoMyBrand: 15.5, promoCompete: 12.8, cpm: 162, cpc: 18.2, osa: 75.8, doi: 47, fillrate: 80.8, assortment: 128, psl: 1.02, promo: 5.2, market: 20.2, inorg: 10.2 },
  pune: { offtakes: 2.2, spend: 0.35, roas: 6.3, categorySize: 9.2, conversion: 1.7, availability: 73.2, sos: 21.5, marketShare: 17.8, inorgSales: 8.8, dspSales: 4.8, promoMyBrand: 13.5, promoCompete: 11.2, cpm: 175, cpc: 20.5, osa: 73.2, doi: 50, fillrate: 79.5, assortment: 118, psl: 0.88, promo: 4.5, market: 17.8, inorg: 8.8 },
  chennai: { offtakes: 2.0, spend: 0.32, roas: 6.3, categorySize: 8.5, conversion: 1.5, availability: 71.5, sos: 19.8, marketShare: 15.5, inorgSales: 7.5, dspSales: 4.2, promoMyBrand: 12.2, promoCompete: 10.5, cpm: 182, cpc: 21.8, osa: 71.5, doi: 52, fillrate: 78.2, assortment: 112, psl: 0.75, promo: 4.0, market: 15.5, inorg: 7.5 },
  kolkata: { offtakes: 2.1, spend: 0.35, roas: 6.0, categorySize: 8.8, conversion: 1.6, availability: 72.8, sos: 20.5, marketShare: 16.8, inorgSales: 8.2, dspSales: 4.5, promoMyBrand: 13.2, promoCompete: 10.8, cpm: 178, cpc: 21.2, osa: 72.8, doi: 51, fillrate: 78.8, assortment: 115, psl: 0.82, promo: 4.2, market: 16.8, inorg: 8.2 },
};

// ── Fallback baseline ────────────────────────────────────────
const BASELINE = { offtakes: 2.5, spend: 0.40, roas: 5.8, categorySize: 10.0, conversion: 2.0, availability: 82.0, sos: 25.0, marketShare: 20.0, inorgSales: 10.0, dspSales: 6.0, promoMyBrand: 15.0, promoCompete: 12.0, cpm: 155, cpc: 17.0, osa: 82.0, doi: 42, fillrate: 84.0, assortment: 130, psl: 1.2, promo: 5.5, market: 20.0, inorg: 10.0 };

// ── KPI Alias Map ────────────────────────────────────────────
const KPI_ALIASES = {
  offtake: 'offtakes', offtakes: 'offtakes',
  spend: 'spend',
  roas: 'roas',
  categorysize: 'categorySize',
  conversion: 'conversion',
  availability: 'availability', osa: 'osa',
  sos: 'sos',
  marketshare: 'marketShare', market: 'market',
  inorgsales: 'inorgSales', inorg: 'inorg',
  dspsales: 'dspSales',
  promomybrand: 'promoMyBrand', promo: 'promo',
  promocompete: 'promoCompete',
  cpm: 'cpm', cpc: 'cpc',
  doi: 'doi', fillrate: 'fillrate',
  assortment: 'assortment', psl: 'psl',
};

// ═══════════════════════════════════════════════════════════════
// MAIN LOOKUP FUNCTION — No randomness
// ═══════════════════════════════════════════════════════════════
function getLogicalKpiValue(kpi, filters = {}) {
  // Helper to safely get string from potentially array input
  const safeStr = (val) => {
    if (Array.isArray(val)) return val.length > 0 ? String(val[0]).toLowerCase() : '';
    return String(val || '').toLowerCase();
  };

  const rawKey = kpi.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Handle delta / direction requests
  const isDelta = rawKey.endsWith('delta');
  const isDir = rawKey.endsWith('dir');

  if (isDelta || isDir) {
    const baseKpi = rawKey.replace(/delta$|dir$/, '');
    const filterKey = filters.entityKey || filters.col || filters.platform || filters.selectedBrand || filters.p || 'blinkit';
    const entityKey = safeStr(filterKey);
    const hash = (entityKey + baseKpi).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    if (isDir) return (hash % 3 === 0) ? 30 : 70;
    const idx = filters.entityIdx || 0;
    // For OSA, DOI, Fillrate deltas, return 5-7%
    if (['osa', 'doi', 'fillrate'].includes(baseKpi)) {
      return 5.1 + ((hash + idx) % 20) * 0.1; // Returns 5.1, 5.2, ... 7.0
    }
    return ((hash + idx) % 3) + 4.5; // Default for others around 4.5-7.5
  }

  // Resolve the KPI alias
  const kpiKey = KPI_ALIASES[rawKey] || rawKey;

  // Create a composite entity key that incorporates brand, location, AND column
  // This ensures that changing brand/location filters will visibly change the data
  const brand = safeStr(filters.selectedBrand || filters.b || '');
  const location = safeStr(filters.selectedLocation || filters.l || '');
  const column = safeStr(filters.col || filters.platform || filters.p || 'blinkit');

  // Combine them with separators so "Amul" + "Delhi" gives different results than "AmulDelhi"
  const compositeKey = [brand, location, column].filter(x => x).join('|');
  const entityKey = compositeKey || 'default';

  // Direct lookup
  const entityData = ENTITY_DATA[entityKey] || BASELINE;
  let value = entityData[kpiKey];
  if (value === undefined) value = BASELINE[kpiKey];
  if (value === undefined) value = 50;

  // Apply deterministic jitter based on the composite key so that brand/location changes affect the value
  // even if we fall back to BASELINE data.
  const varianceSeed = compositeKey || safeStr(filters.col || filters.platform || filters.p || 'blinkit');
  let variance = getVariance(varianceSeed, rawKey);

  // For percentage KPIs like OSA, Availability, Fillrate, etc., use a tighter variance
  // to keep them stable around the ~95% mark as requested.
  const isPercentageKpi = ['osa', 'availability', 'fillrate', 'market', 'sos', 'conversion', 'promo', 'inorg'].includes(rawKey);
  if (isPercentageKpi) {
    // Transform variance 0.7-1.3 into 0.95-1.05 for percentage KPIs
    variance = 0.95 + (variance - 0.7) * 0.167; // (1.05-0.95)/(1.3-0.7) = 0.167
  }

  if (typeof value === 'number') {
    value = value * variance;
    // Cap at 100% for percentages
    if (isPercentageKpi && value > 100) value = 99.8;
  }

  // Stable row-level micro-shift (not random)
  if (filters.entityIdx !== undefined && filters.entityIdx > 0) {
    const shift = ((filters.entityIdx * 7) % 5) - 2;
    if (typeof value === 'number' && value > 10) value += shift * 0.1;
  }

  // Format
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value > 50) return value;
    return parseFloat(value.toFixed(1));
  }
  return value;
}

// ── Trend Generator ──────────────────────────────────────────
function getLogicalKpiTrend(kpi, filters = {}, points = 12) {
  const base = getLogicalKpiValue(kpi, filters);
  const k = kpi.toLowerCase();
  const shapes = {
    growth: [0.85, 0.87, 0.90, 0.92, 0.94, 0.96, 0.98, 1.00, 1.02, 1.05, 1.08, 1.12],
    stable: [0.98, 1.02, 1.00, 0.99, 1.01, 1.00, 0.98, 1.02, 1.00, 1.01, 0.99, 1.00],
    seasonal: [0.80, 0.85, 0.90, 0.95, 1.00, 1.10, 1.20, 1.10, 1.00, 0.95, 0.90, 0.85],
  };
  let shape = shapes.stable;
  if (k.includes('offtake') || k.includes('market')) shape = shapes.growth;
  if (k.includes('promo') || k.includes('category')) shape = shapes.seasonal;

  const isPercentageKpi = ['osa', 'availability', 'fillrate', 'market', 'sos', 'conversion', 'promo', 'inorg'].includes(k);

  const platformSeed = filters.col || filters.platform || filters.p || 'blinkit';
  return shape.slice(0, points).map((f, i) => {
    let multiplier = f;
    if (isPercentageKpi) {
      // Dampen the trend fluctuation for percentages (e.g. 0.8 -> 0.95, 1.2 -> 1.05)
      multiplier = 1 + (f - 1) * 0.25;
    }
    const pointVariance = getVariance(platformSeed, kpi + i);
    let val = base * multiplier * pointVariance;
    if (isPercentageKpi && val > 100) val = 99.5 + (i % 5) * 0.1;
    return parseFloat(val.toFixed(1));
  });
}

// ── OLD DATA REGISTRY (kept for backward compat) ─────────────
const LOGICAL_DATA_REGISTRY = {
  // Baseline values for a single "Unit" (1 City, 1 Brand, 1 Platform)
  baselines: {
    offtake: 2.1, // Cr per unit
    osa: 88.5,    // % (Average)
    doi: 45.0,    // Days (Average)
    fillrate: 92.2, // % (Average)
    assortment: 120, // SKU count
    psl: 12000,   // Units (Sum)
    promo: 6.5,   // % Spends
    market: 24.2, // % Share (Leader base)
    sos: 28.0,    // % Share (Leader base)
    inorg: 12.4,  // % Share
    conversion: 2.1, // % Rate
    roas: 4.8,    // x (Average)
    cpm: 145,     // Sum/Avg
    cpc: 18.2,    // Avg
    spend: 0.25,  // Cr per unit
  },
  // Weight Multipliers for Dimensions
  weights: {
    locations: {
      "Mumbai": 1.25,
      "Delhi": 1.15,
      "Bangalore": 0.85,
      "Hyderabad": 0.75,
      "Pune": 0.65,
      "Chennai": 0.60,
      "Kolkata": 0.65,
      "All": 5.5, // Aggregate sum of top locations (approx 6-7 equivalent cities)
    },
    brands: {
      "Kwality Walls": 1.4, // Leader
      "Amul": 1.2,
      "Mother Dairy": 0.9,
      "Cornetto": 0.6,
      "Magnum": 0.5,
      "Feast": 0.4,
      "Twister": 0.3,
      "Kwality Wall's (India) Limited": 1.4,
      "All": 4.5, // Aggregate sum of brands
    },
    platforms: {
      "Blinkit": 1.2,
      "Instamart": 1.1,
      "Zepto": 1.0,
      "Amazon": 0.9,
      "Flipkart": 0.8,
      "Reliance Fresh": 0.7,
      "Big Bazaar": 0.6,
      "DMart": 0.6,
      "All": 6.0, // Aggregate sum of platforms
    },
    channels: {
      "Ecom": 1.1,
      "ModernTrade": 0.9,
      "All": 1.8, // Aggregate (Ecom + ModernTrade)
    }
  }
}

// Old getLogicalKpiValue removed — now using entity-lookup version above


function getRandomKpiValue(kpi) {
  return getLogicalKpiValue(kpi, {});
}

function getRandomKpiTrend(base = 80) {
  return getLogicalKpiTrend("generic", { base });
}

// Helper to create weighted variant of product matrix data
function createWeightedProductMatrix(absolute) {
  return {
    formatColumns: absolute.formatColumns,
    data: absolute.data.map(format => ({
      format: format.format,
      products: format.products.map(product => ({
        sku: product.sku,
        name: product.name,
        values: Object.fromEntries(
          Object.entries(product.values).map(([key, val]) => [key, applyWeightedVariance(val)])
        ),
        losses: Object.fromEntries(
          Object.entries(product.losses).map(([key, val]) => [key, parseFloat((val * (0.9 + Math.random() * 0.2)).toFixed(2))])
        )
      }))
    }))
  };
}

const PRODUCT_MATRIX_ABSOLUTE = {
  formatColumns: ["Blinkit", "Instamart", "Zepto", "Flipkart", "Amazon"],
  data: [
    {
      format: "Cassata",
      products: [
        {
          sku: "85123",
          name: "KW Cassatta",
          values: {
            Blinkit: 55,
            Zepto: 81,
            "Virtual Store": 0,
            Instamart: 88,
          },
          losses: {
            Blinkit: 18.42,
            Zepto: 0.0,
            "Virtual Store": 0.0,
            Instamart: 1.12,
          },
        },
      ],
    },

    {
      format: "Core Tub",
      products: [
        {
          sku: "85656",
          name: "KW Dairy Factory Vanilla Ice Cream TUB",
          values: {
            Blinkit: 96,
            Instamart: 84,
            "Virtual Store": 75,
            Zepto: 99,
          },
          losses: {
            Blinkit: 1.08,
            Instamart: 4.79,
            "Virtual Store": 0,
            Zepto: 23.19,
          },
        },
        {
          sku: "85657",
          name: "KW Dairy Factory Mango Ice Cream TUB",
          values: {
            Blinkit: 98,
            Instamart: 83,
            "Virtual Store": 76,
            Zepto: 99,
          },
          losses: {
            Blinkit: 2.39,
            Instamart: 70.21,
            "Virtual Store": 0,
            Zepto: 0,
          },
        },
        {
          sku: "85658",
          name: "KW Dairy Factory Choco Chip Ice Cream TUB",
          values: {
            Blinkit: 97,
            Instamart: 83,
            "Virtual Store": 68,
            Zepto: 99,
          },
          losses: {
            Blinkit: 3.12,
            Instamart: 51.25,
            "Virtual Store": 0,
            Zepto: 1.22,
          },
        },
        {
          sku: "85659",
          name: "KW Dairy Factory Butterscotch Ice Cream TUB",
          values: {
            Blinkit: 96,
            Instamart: 83,
            "Virtual Store": 70,
            Zepto: 100,
          },
          losses: {
            Blinkit: 2.26,
            Instamart: 104.82,
            "Virtual Store": 0,
            Zepto: 0,
          },
        },
      ],
    },

    {
      format: "Cornetto",
      products: [
        {
          sku: "85045",
          name: "KW CORNETTO - DOUBLE CHOCOLATE",
          values: {
            Blinkit: 98,
            Instamart: 85,
            "Virtual Store": 78,
            Zepto: 100,
          },
          losses: {
            Blinkit: 0,
            Instamart: 153.2,
            "Virtual Store": 0,
            Zepto: 0,
          },
        },
      ],
    },
  ],
};

const PRODUCT_MATRIX = {
  absolute: PRODUCT_MATRIX_ABSOLUTE,
  weighted: createWeightedProductMatrix(PRODUCT_MATRIX_ABSOLUTE)
};

// Helper to create weighted variant of OLA_Detailed
function createWeightedOLADetailed(absolute) {
  return absolute.map(platform => ({
    platform: platform.platform,
    ola: applyWeightedVariance(platform.ola),
    zones: platform.zones.map(zone => ({
      zone: zone.zone,
      ola: applyWeightedVariance(zone.ola),
      cities: zone.cities.map(city => ({
        city: city.city,
        ola: applyWeightedVariance(city.ola)
      }))
    }))
  }));
}

const OLA_Detailed_ABSOLUTE = [
  {
    platform: "Blinkit",
    ola: 90,
    zones: [
      {
        zone: "West",
        ola: 84,
        cities: [
          { city: "Ahmedabad", ola: 89 },
          { city: "Mumbai", ola: 79 },
          { city: "Nagpur", ola: 82 },
          { city: "Nashik", ola: 79 },
          { city: "Panaji", ola: 75 },
          { city: "Pune", ola: 87 },
          { city: "Rajkot", ola: 90 },
          { city: "Surat", ola: 90 },
          { city: "Vadodara", ola: 86 }
        ]
      }
    ]
  },
  {
    platform: "Instamart",
    ola: 82,
    zones: [{ zone: "All", ola: 82, cities: [] }]
  },
  {
    platform: "Zepto",
    ola: 72,
    zones: [{ zone: "East", ola: 72, cities: [] }]
  },
  {
    platform: "Flipkart",
    ola: 85,
    zones: [{ zone: "North", ola: 85, cities: [] }]
  },
  {
    platform: "Amazon",
    ola: 88,
    zones: [{ zone: "South", ola: 88, cities: [] }]
  }
];

const OLA_Detailed = {
  absolute: OLA_Detailed_ABSOLUTE,
  weighted: createWeightedOLADetailed(OLA_Detailed_ABSOLUTE)
};

function generateTrend(base, points = 8, variance = 8) {
  return Array.from({ length: points }, (_, i) =>
    Math.max(
      0,
      Math.min(100, Math.round(base + Math.sin(i / 2) * variance + (Math.random() * 6 - 3)))
    )
  );
}

function generateTrendMulti(base) {
  return {
    Spend: generateTrend(base),
    "M-1 Spend": generateTrend(base - 5),
    "M-2 Spend": generateTrend(base - 10),
    Conversion: generateTrend(Math.round(base / 2)),
    "M-1 Conv": generateTrend(Math.round(base / 2) - 3),
    "M-2 Conv": generateTrend(Math.round(base / 2) - 6),
    ROAS: generateTrend(Math.round(base / 3)),
    CPM: generateTrend(Math.round(base / 4))
  };
}

// Helper to create weighted variant of FORMAT_MATRIX
function createWeightedFormatMatrix(absolute) {
  return {
    PlatformColumns: absolute.PlatformColumns,
    formatColumns: absolute.formatColumns,
    CityColumns: absolute.CityColumns,
    PlatformData: absolute.PlatformData.map(item => ({
      kpi: item.kpi,
      values: Object.fromEntries(
        Object.entries(item.values).map(([key, val]) => [key, applyWeightedVariance(val)])
      ),
      trend: item.trend
    })),
    FormatData: absolute.FormatData.map(item => ({
      kpi: item.kpi,
      values: Object.fromEntries(
        Object.entries(item.values).map(([key, val]) => [key, applyWeightedVariance(val)])
      ),
      trend: item.trend
    })),
    CityData: absolute.CityData.map(item => ({
      kpi: item.kpi,
      values: Object.fromEntries(
        Object.entries(item.values).map(([key, val]) => [key, applyWeightedVariance(val)])
      ),
      trend: item.trend
    }))
  };
}

const FORMAT_MATRIX_ABSOLUTE = {
  PlatformColumns: ["Blinkit", "Instamart", "Zepto", "Flipkart", "Amazon"],

  formatColumns: [
    "Cassata", "Core Tub", "Cornetto", "Magnum",
    "Premium Tub", "KW Sticks", "Sandwich"
  ],

  CityColumns: [
    "Ajmer", "Amritsar", "Bathinda", "Bhopal",
    "Chandigarh", "Gwalior", "Indore", "Jaipur",
    "Lucknow", "Patna", "Ranchi", "Varanasi",
    "Kanpur", "Meerut", "Agra", "Noida"
  ],

  // ------------------------------------------------------------
  // PLATFORM LEVEL – upgraded trend
  // ------------------------------------------------------------
  PlatformData: [
    {
      kpi: "Osa",
      values: {
        Blinkit: 82, Instamart: 78, Zepto: 65, Flipkart: 75, Amazon: 70
      },
      trend: generateTrendMulti(78)
    },
    {
      kpi: "Doi",
      values: {
        Blinkit: 45, Instamart: 52, Zepto: 48, Flipkart: 49, Amazon: 47
      },
      trend: generateTrendMulti(48)
    },
    {
      kpi: "Fillrate",
      values: {
        Blinkit: 91, Instamart: 84, Zepto: 79, Flipkart: 86, Amazon: 81
      },
      trend: generateTrendMulti(85)
    },
    {
      kpi: "Assortment",
      values: {
        Blinkit: 142, Instamart: 138, Zepto: 122, Flipkart: 135, Amazon: 128
      },
      trend: generateTrendMulti(66)
    },
    {
      kpi: "PSL",
      values: {
        Blinkit: 18, Instamart: 12, Zepto: 25, Flipkart: 11, Amazon: 20
      },
      trend: generateTrendMulti(15)
    }
  ],

  // ------------------------------------------------------------
  // FORMAT LEVEL – upgraded trend
  // ------------------------------------------------------------
  FormatData: [
    {
      kpi: "Osa",
      values: {
        Cassata: 7, "Core Tub": 81, Cornetto: 90, Magnum: 91,
        "KW Sticks": 97, "Premium Tub": 85, Sandwich: 82
      },
      trend: generateTrendMulti(75)
    },
    {
      kpi: "Doi",
      values: {
        Cassata: 13, "Core Tub": 87, Cornetto: 98, Magnum: 100,
        "KW Sticks": 100, "Premium Tub": 78, Sandwich: 95
      },
      trend: generateTrendMulti(85)
    },
    {
      kpi: "Fillrate",
      values: {
        Cassata: 17, "Core Tub": 99, Cornetto: 99, Magnum: 100,
        "KW Sticks": 100, "Premium Tub": 99, Sandwich: 100
      },
      trend: generateTrendMulti(95)
    },
    {
      kpi: "Assortment",
      values: {
        Cassata: 72, "Core Tub": 96, Cornetto: 82, Magnum: 91,
        "KW Sticks": 94, "Premium Tub": 88, Sandwich: 55
      },
      trend: generateTrendMulti(85)
    },
    {
      kpi: "PSL",
      values: {
        Cassata: 28, "Core Tub": 4, Cornetto: 10, Magnum: 9,
        "KW Sticks": 6, "Premium Tub": 12, Sandwich: 45
      },
      trend: generateTrendMulti(20)
    }
  ],

  // ------------------------------------------------------------
  // CITY LEVEL – upgraded trend
  // ------------------------------------------------------------
  CityData: [
    {
      kpi: "Osa",
      values: {
        Ajmer: 72, Amritsar: 85, Bathinda: 79, Bhopal: 88,
        Chandigarh: 81, Gwalior: 75, Indore: 92, Jaipur: 69,
        Lucknow: 78, Patna: 72, Ranchi: 75, Varanasi: 70,
        Kanpur: 82, Meerut: 74, Agra: 77, Noida: 85
      },
      trend: generateTrendMulti(80)
    },
    {
      kpi: "Doi",
      values: {
        Ajmer: 42, Amritsar: 55, Bathinda: 49, Bhopal: 60,
        Chandigarh: 53, Gwalior: 44, Indore: 67, Jaipur: 51,
        Lucknow: 48, Patna: 45, Ranchi: 47, Varanasi: 42,
        Kanpur: 50, Meerut: 46, Agra: 48, Noida: 55
      },
      trend: generateTrendMulti(52)
    },
    {
      kpi: "Fillrate",
      values: {
        Ajmer: 91, Amritsar: 88, Bathinda: 84, Bhopal: 94,
        Chandigarh: 92, Gwalior: 76, Indore: 90, Jaipur: 82,
        Lucknow: 85, Patna: 80, Ranchi: 82, Varanasi: 78,
        Kanpur: 88, Meerut: 84, Agra: 86, Noida: 90
      },
      trend: generateTrendMulti(88)
    },
    {
      kpi: "Assortment",
      values: {
        Ajmer: 73, Amritsar: 69, Bathinda: 71, Bhopal: 82,
        Chandigarh: 80, Gwalior: 63, Indore: 87, Jaipur: 78,
        Lucknow: 75, Patna: 70, Ranchi: 72, Varanasi: 68,
        Kanpur: 77, Meerut: 73, Agra: 76, Noida: 80
      },
      trend: generateTrendMulti(76)
    },
    {
      kpi: "PSL",
      values: {
        Ajmer: 27, Amritsar: 15, Bathinda: 21, Bhopal: 12,
        Chandigarh: 19, Gwalior: 37, Indore: 8, Jaipur: 22,
        Lucknow: 18, Patna: 25, Ranchi: 20, Varanasi: 30,
        Kanpur: 15, Meerut: 22, Agra: 19, Noida: 10
      },
      trend: generateTrendMulti(25)
    }
  ]
};

const FORMAT_MATRIX = {
  absolute: FORMAT_MATRIX_ABSOLUTE,
  weighted: createWeightedFormatMatrix(FORMAT_MATRIX_ABSOLUTE)
};


const FORMAT_MATRIX_Visibility = {
  PlatformColumns: ["Blinkit", "Instamart", "Zepto", "Flipkart", "Amazon"],

  formatColumns: [
    "Cassata", "Core Tub", "Cornetto", "Magnum",
    "Premium Tub", "KW Sticks", "Sandwich"
  ],

  CityColumns: [
    "Mumbai", "Delhi", "Bangalore", "Hyderabad",
    "Chennai", "Kolkata", "Pune", "Ahmedabad",
    "Lucknow", "Patna", "Ranchi", "Varanasi",
    "Kanpur", "Meerut", "Agra", "Noida"
  ],

  // -----------------------------------------
  // PLATFORM LEVEL – NEW KPIs
  // -----------------------------------------
  PlatformData: [
    {
      kpi: "Overall Weighted SOS",
      values: { Blinkit: 92, Instamart: 88, Zepto: 85, Flipkart: 87, Amazon: 90 },
      trend: generateTrendMulti(88)
    },
    {
      kpi: "Sponsored Weighted SOS",
      values: { Blinkit: 12, Instamart: 15, Zepto: 10, Flipkart: 16, Amazon: 14 },
      trend: generateTrendMulti(14)
    },
    {
      kpi: "Organic Weighted SOS",
      values: { Blinkit: 96, Instamart: 94, Zepto: 92, Flipkart: 91, Amazon: 89 },
      trend: generateTrendMulti(92)
    },
    {
      kpi: "Display SOS",
      values: { Blinkit: 89, Instamart: 91, Zepto: 85, Flipkart: 88, Amazon: 86 },
      trend: generateTrendMulti(88)
    }
  ],

  // -----------------------------------------
  // FORMAT LEVEL – NEW KPIs
  // -----------------------------------------
  FormatData: [
    {
      kpi: "Overall Weighted SOS",
      values: { Cassata: 75, "Core Tub": 82, Cornetto: 90, Magnum: 87, "KW Sticks": 95, "Premium Tub": 80, Sandwich: 76 },
      trend: generateTrendMulti(82)
    },
    {
      kpi: "Sponsored Weighted SOS",
      values: { Cassata: 18, "Core Tub": 12, Cornetto: 14, Magnum: 16, "KW Sticks": 10, "Premium Tub": 20, Sandwich: 22 },
      trend: generateTrendMulti(15)
    },
    {
      kpi: "Organic Weighted SOS",
      values: { Cassata: 92, "Core Tub": 95, Cornetto: 98, Magnum: 99, "KW Sticks": 100, "Premium Tub": 93, Sandwich: 91 },
      trend: generateTrendMulti(95)
    },
    {
      kpi: "Display SOS",
      values: { Cassata: 70, "Core Tub": 88, Cornetto: 90, Magnum: 92, "KW Sticks": 96, "Premium Tub": 85, Sandwich: 82 },
      trend: generateTrendMulti(86)
    }
  ],

  // -----------------------------------------
  // CITY LEVEL – NEW KPIs (Metro Cities)
  // -----------------------------------------
  CityData: [
    {
      kpi: "Overall Weighted SOS",
      values: { Mumbai: 88, Delhi: 90, Bangalore: 85, Hyderabad: 83, Chennai: 82, Kolkata: 86, Pune: 89, Ahmedabad: 84, Lucknow: 81, Patna: 78, Ranchi: 80, Varanasi: 75, Kanpur: 85, Meerut: 82, Agra: 83, Noida: 88 },
      trend: generateTrendMulti(86)
    },
    {
      kpi: "Sponsored Weighted SOS",
      values: { Mumbai: 14, Delhi: 12, Bangalore: 15, Hyderabad: 11, Chennai: 16, Kolkata: 13, Pune: 14, Ahmedabad: 18, Lucknow: 15, Patna: 12, Ranchi: 14, Varanasi: 13, Kanpur: 16, Meerut: 15, Agra: 14, Noida: 11 },
      trend: generateTrendMulti(14)
    },
    {
      kpi: "Organic Weighted SOS",
      values: { Mumbai: 95, Delhi: 94, Bangalore: 93, Hyderabad: 90, Chennai: 92, Kolkata: 91, Pune: 96, Ahmedabad: 89, Lucknow: 91, Patna: 88, Ranchi: 90, Varanasi: 85, Kanpur: 92, Meerut: 90, Agra: 91, Noida: 94 },
      trend: generateTrendMulti(93)
    },
    {
      kpi: "Display SOS",
      values: { Mumbai: 90, Delhi: 92, Bangalore: 88, Hyderabad: 87, Chennai: 85, Kolkata: 86, Pune: 91, Ahmedabad: 84, Lucknow: 88, Patna: 85, Ranchi: 87, Varanasi: 82, Kanpur: 89, Meerut: 87, Agra: 88, Noida: 91 },
      trend: generateTrendMulti(88)
    }
  ]
};


// Helper to create weighted variant of FORMAT_ROWS
function createWeightedFormatRows(absolute) {
  return absolute.map(row => ({
    ...row,
    offtakes: Math.max(0, Math.round(row.offtakes * (0.9 + Math.random() * 0.2))),
    spend: Math.max(0, Math.round(row.spend * (0.9 + Math.random() * 0.2))),
    roas: Math.max(0, parseFloat((row.roas * (0.9 + Math.random() * 0.2)).toFixed(1))),
    inorgSalesPct: applyWeightedVariance(row.inorgSalesPct),
    conversionPct: Math.max(0, parseFloat((row.conversionPct * (0.9 + Math.random() * 0.2)).toFixed(1))),
    marketSharePct: applyWeightedVariance(row.marketSharePct),
    cpm: Math.max(0, Math.round(row.cpm * (0.9 + Math.random() * 0.2))),
    cpc: Math.max(0, Math.round(row.cpc * (0.9 + Math.random() * 0.2)))
  }));
}

const FORMAT_ROWS_ABSOLUTE = [
  {
    name: "Cassata",
    offtakes: 4,
    spend: 0,
    roas: 3.2,
    inorgSalesPct: 19,
    conversionPct: 2.3,
    marketSharePct: 23,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 384,
    cpc: 4736,
  },
  {
    name: "Core Tub",
    offtakes: 61,
    spend: 2,
    roas: 5.5,
    inorgSalesPct: 18,
    conversionPct: 2.6,
    marketSharePct: 16,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 404,
    cpc: 51,
  },
  {
    name: "Cornetto",
    offtakes: 48,
    spend: 1,
    roas: 7.4,
    inorgSalesPct: 12,
    conversionPct: 10.7,
    marketSharePct: 8,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 456,
    cpc: 71,
  },
  {
    name: "Cup",
    offtakes: 4,
    spend: 0,
    roas: 5.2,
    inorgSalesPct: 2,
    conversionPct: 1.9,
    marketSharePct: 3,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 210,
    cpc: 15,
  },
  {
    name: "KW Sticks",
    offtakes: 9,
    spend: 0,
    roas: 5.7,
    inorgSalesPct: 13,
    conversionPct: 4.1,
    marketSharePct: 22,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 402,
    cpc: 96,
  },
  {
    name: "Magnum",
    offtakes: 14,
    spend: 0,
    roas: 9.9,
    inorgSalesPct: 35,
    conversionPct: 5.6,
    marketSharePct: 22,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 428,
    cpc: 169,
  },
  {
    name: "Others",
    offtakes: 0,
    spend: 0,
    roas: 14.2,
    inorgSalesPct: 100,
    conversionPct: 1.4,
    marketSharePct: 0,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 337,
    cpc: 16,
  },
];

const FORMAT_ROWS = {
  absolute: FORMAT_ROWS_ABSOLUTE,
  weighted: createWeightedFormatRows(FORMAT_ROWS_ABSOLUTE)
};

const ONE_VIEW_DRILL_DATA = [
  {
    label: "Blinkit",                               // PLATFORM
    values: {},                                     // platform has no direct values
    children: [
      {
        label: "East",                               // ZONE
        values: {},
        children: [
          {
            label: "Kolkata",                        // CITY
            values: {},
            children: [
              {
                label: "Cassata",                    // PRODUCT
                values: {
                  "Tdp-1": 82,
                  "Tdp-2": 78,
                  "Tdp-3": 80
                },
                trend: [72, 74, 77, 80, 82, 81],
                children: [
                  {
                    label: "ID: P001",               // PRODUCT ID
                    values: {
                      "Tdp-1": 82,
                      "Tdp-2": 78,
                      "Tdp-3": 80
                    },
                    trend: [72, 74, 77, 80, 82, 81],
                    children: []
                  }
                ]
              },
              {
                label: "Cornetto",
                values: {
                  "Tdp-1": 91,
                  "Tdp-2": 88,
                  "Tdp-3": 92
                },
                trend: [85, 87, 88, 90, 91, 92],
                children: [
                  {
                    label: "ID: P002",
                    values: {
                      "Tdp-1": 91,
                      "Tdp-2": 88,
                      "Tdp-3": 92
                    },
                    trend: [85, 87, 88, 90, 91, 92],
                    children: []
                  }
                ]
              }
            ]
          },

          {
            label: "Patna",
            values: {},
            children: [
              {
                label: "Cassata",
                values: {
                  "Tdp-1": 76,
                  "Tdp-2": 73,
                  "Tdp-3": 75
                },
                trend: [70, 72, 74, 76, 75, 75],
                children: [
                  {
                    label: "ID: P001",
                    values: {
                      "Tdp-1": 76,
                      "Tdp-2": 73,
                      "Tdp-3": 75
                    },
                    trend: [70, 72, 74, 76, 75, 75],
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      },

      {
        label: "West",
        values: {},
        children: [
          {
            label: "Mumbai",
            values: {},
            children: [
              {
                label: "Cornetto",
                values: {
                  "Tdp-1": 88,
                  "Tdp-2": 85,
                  "Tdp-3": 89
                },
                trend: [80, 82, 84, 86, 88, 89],
                children: [
                  {
                    label: "ID: P002",
                    values: {
                      "Tdp-1": 88,
                      "Tdp-2": 85,
                      "Tdp-3": 89
                    },
                    trend: [80, 82, 84, 86, 88, 89],
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  // ---------------- ZEPTO ----------------
  {
    label: "Instamart",
    values: {},
    children: [
      {
        label: "South",
        values: {},
        children: [
          {
            label: "Bengaluru",
            values: {},
            children: [
              {
                label: "Cassata",
                values: {
                  "Tdp-1": 91,
                  "Tdp-2": 93,
                  "Tdp-3": 94
                },
                trend: [84, 86, 89, 91, 93, 94],
                children: [
                  {
                    label: "ID: P001",
                    values: {
                      "Tdp-1": 91,
                      "Tdp-2": 93,
                      "Tdp-3": 94
                    },
                    trend: [84, 86, 89, 91, 93, 94],
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  // ---------------- INSTAMART ----------------
  {
    label: "Instamart",
    values: {},
    children: [
      {
        label: "South",
        values: {},
        children: [
          {
            label: "Hyderabad",
            values: {},
            children: [
              {
                label: "Premium Tub",
                values: {
                  "Tdp-1": 82,
                  "Tdp-2": 84,
                  "Tdp-3": 83
                },
                trend: [75, 78, 80, 81, 82, 83],
                children: [
                  {
                    label: "ID: P003",
                    values: {
                      "Tdp-1": 82,
                      "Tdp-2": 84,
                      "Tdp-3": 83
                    },
                    trend: [75, 78, 80, 81, 82, 83],
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
];

const DRILL_COLUMNS = [
  { key: "Tdp-1", label: "Tdp-1", isPercent: true },
  { key: "Tdp-2", label: "Tdp-2", isPercent: true },
  { key: "Tdp-3", label: "Tdp-3", isPercent: true }
];



export {
  FORMAT_MATRIX,
  FORMAT_ROWS,
  PRODUCT_MATRIX,
  OLA_Detailed,
  ONE_VIEW_DRILL_DATA,
  DRILL_COLUMNS,
  FORMAT_MATRIX_Visibility,
  getRandomKpiValue,
  getRandomKpiTrend,
  getLogicalKpiValue,
  getLogicalKpiTrend
};
