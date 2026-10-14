/**
 * Sample data for the Report Studio UI.
 *
 * The page is not wired to the backend yet; this module stands in for the
 * future report API. It exposes the same two operations the API will:
 *   - getSampleFilterOptions(filters)  → cascading filter values
 *   - buildSampleReport(request)       → { totalRows, getRow(index) }
 * Values are fictional but deterministic, so the preview stays stable while the
 * configuration changes. Replace the imports of this module to go live.
 */
import dayjs from "dayjs";
import { FIELD_GROUPS, FILTER_FIELD_KEYS } from "./reportStudioConfig";
import { isFilterActive } from "./reportStudioUtils";

/** Exporting more rows than this from generated data is refused, not truncated. */
export const SAMPLE_EXPORT_ROW_LIMIT = 200000;

const CHANNEL_PLATFORMS = [
    { channel: "Quick Commerce", platform: "Blinkit" },
    { channel: "Quick Commerce", platform: "Zepto" },
    { channel: "Quick Commerce", platform: "Swiggy Instamart" },
    { channel: "Quick Commerce", platform: "BigBasket" },
    { channel: "E-Commerce", platform: "Amazon" },
    { channel: "E-Commerce", platform: "Flipkart" },
];

const PRODUCTS = [
    { brand: "Aurora", category: "Chocolates", sub_category: "Milk Chocolate", product_type: "Bar", product: "Aurora Milk Chocolate 50 g", web_pid: "SKU-10021" },
    { brand: "Aurora", category: "Chocolates", sub_category: "Dark Chocolate", product_type: "Bar", product: "Aurora Dark 70% 100 g", web_pid: "SKU-10022" },
    { brand: "Kestrel", category: "Biscuits", sub_category: "Cookies", product_type: "Pack", product: "Kestrel Butter Cookies 150 g", web_pid: "SKU-20011" },
    { brand: "Kestrel", category: "Biscuits", sub_category: "Digestive", product_type: "Pack", product: "Kestrel Digestive 250 g", web_pid: "SKU-20012" },
    { brand: "Nimbus", category: "Snacks", sub_category: "Chips", product_type: "Pouch", product: "Nimbus Sea Salt Chips 90 g", web_pid: "SKU-30031" },
    { brand: "Nimbus", category: "Snacks", sub_category: "Nuts", product_type: "Pouch", product: "Nimbus Roasted Almonds 200 g", web_pid: "SKU-30032" },
    { brand: "Orchid", category: "Beverages", sub_category: "Iced Tea", product_type: "Bottle", product: "Orchid Lemon Iced Tea 500 ml", web_pid: "SKU-40041" },
    { brand: "Orchid", category: "Chocolates", sub_category: "Gift Box", product_type: "Box", product: "Orchid Assorted Gift Box 250 g", web_pid: "SKU-40042" },
    { brand: "Zenith", category: "Beverages", sub_category: "Energy Drink", product_type: "Can", product: "Zenith Energy Drink 250 ml", web_pid: "SKU-50051" },
    { brand: "Zenith", category: "Biscuits", sub_category: "Crackers", product_type: "Pack", product: "Zenith Cream Crackers 200 g", web_pid: "SKU-50052" },
];

const CITIES = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad"].map((city) => ({ city }));

const KEYWORDS = [
    { keyword_type: "Generic", keyword: "chocolate" },
    { keyword_type: "Generic", keyword: "healthy snacks" },
    { keyword_type: "Generic", keyword: "energy drink" },
    { keyword_type: "Branded", keyword: "aurora chocolate" },
    { keyword_type: "Branded", keyword: "kestrel cookies" },
    { keyword_type: "Competition", keyword: "northstar biscuits" },
];

const TARGETING = [{ targeting_type: "Keyword" }, { targeting_type: "Category" }];

/**
 * Attributes that always travel together form a group (a platform belongs to
 * one channel, a product to one brand and category). Rows are built from the
 * distinct combinations within each group, which keeps the sample coherent.
 */
const GROUPS = [
    { id: "channelPlatform", fields: ["channel", "platform"], sources: ["pdp", "kw", "ms", "pm"], atoms: CHANNEL_PLATFORMS },
    { id: "product", fields: ["brand", "category", "sub_category", "product_type", "product", "web_pid"], sources: ["pdp", "kw", "ms", "pm"], atoms: PRODUCTS },
    { id: "city", fields: ["city"], sources: ["pdp", "kw", "ms"], atoms: CITIES },
    { id: "keyword", fields: ["keyword_type", "keyword"], sources: ["kw", "pm"], atoms: KEYWORDS },
    { id: "targeting", fields: ["targeting_type"], sources: ["pm"], atoms: TARGETING },
];

const matchesFilters = (atom, fieldKeys, filters) =>
    fieldKeys.every((key) => {
        const value = filters[key];
        if (!isFilterActive(value)) return true;
        return (Array.isArray(value) ? value : [value]).includes(atom[key]);
    });

/** Filter values cascade within a group, e.g. Channel narrows the Platform list. */
export const getSampleFilterOptions = (filters) =>
    Object.fromEntries(
        FILTER_FIELD_KEYS.map((key) => {
            const group = GROUPS.find((g) => g.fields.includes(key));
            const otherKeys = group.fields.filter((k) => k !== key);
            const values = group.atoms.filter((a) => matchesFilters(a, otherKeys, filters)).map((a) => a[key]);
            return [key, [...new Set(values)].sort((a, b) => a.localeCompare(b))];
        })
    );

// ── Deterministic pseudo-random values (FNV-1a hash seeding mulberry32) ──
const hashString = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

const seededRandom = (seed) => {
    let t = seed;
    return () => {
        t = (t + 0x6d2b79f5) | 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
};

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Generates one row's KPI values for a source. `weight` is the number of
 * underlying records the row rolls up, so additive KPIs (sales, spend) grow
 * with coarser rows while ratios (OSA, SOS) stay in range.
 */
const SOURCE_MEASURES = {
    pdp: (rand, weight) => {
        const offtake = weight * (1500 + rand() * 16500);
        const osa = 62 + rand() * 36;
        const discount = 4 + rand() * 24;
        const asp = 45 + rand() * 375;
        return {
            offtake: round2(offtake),
            osa: round2(osa),
            discount: round2(discount),
            wt_discount: round2(Math.max(0, discount + (rand() - 0.5) * 6)),
            asp: round2(asp),
            listing: round2(70 + rand() * 30),
            buy_box: round2(Math.min(osa, 55 + rand() * 42)),
            qty_sold: Math.round(offtake / asp),
        };
    },
    kw: (rand) => ({
        sos: round2(4 + rand() * 34),
        ad_sov: round2(2 + rand() * 28),
        organic_sov: round2(3 + rand() * 33),
    }),
    ms: (rand, weight) => ({
        market_share: round2(3 + rand() * 39),
        category_size: round2(weight * (40000 + rand() * 360000)),
    }),
    pm: (rand, weight) => {
        const spend = weight * (800 + rand() * 8200);
        const roas = 1.4 + rand() * 6.1;
        const adSales = spend * roas;
        const impressions = Math.round(spend * (180 + rand() * 240));
        const clicks = Math.max(1, Math.round(impressions * (0.008 + rand() * 0.027)));
        const orders = Math.max(1, Math.round(clicks * (0.04 + rand() * 0.12)));
        return {
            ad_spend: round2(spend),
            ad_sales: round2(adSales),
            roas: round2(roas),
            impressions,
            clicks,
            orders,
            conversion: round2((orders / clicks) * 100),
            cpc: round2(spend / clicks),
            cpm: round2((spend / impressions) * 1000),
            aov: round2(adSales / orders),
        };
    },
};

const enumerateDates = (start, end) => {
    let from = dayjs(start).startOf("day");
    let to = dayjs(end).startOf("day");
    if (from.isAfter(to)) [from, to] = [to, from];
    const dates = [];
    for (let d = from; !d.isAfter(to); d = d.add(1, "day")) dates.push(d.format("YYYY-MM-DD"));
    return dates;
};

const EMPTY_REPORT = { totalRows: 0, getRow: () => ({}) };

/**
 * @param {object}   request
 * @param {string[]} request.sources   selected source ids
 * @param {object[]} request.fields    selected field metadata, in column order
 * @param {object}   request.filters   { fieldKey: "All" | string[] }
 * @param {dayjs}    request.startDate
 * @param {dayjs}    request.endDate
 */
export const buildSampleReport = ({ sources, fields, filters, startDate, endDate }) => {
    if (!sources.length || !startDate || !endDate) return EMPTY_REPORT;

    const dates = enumerateDates(startDate, endDate);
    const columnKeys = fields.map((f) => f.key);
    const kpiSources = [...new Set(fields.filter((f) => f.group === FIELD_GROUPS.KPI).map((f) => f.source))];

    // Distinct combinations of the selected columns in each relevant group.
    const groups = [];
    for (const group of GROUPS.filter((g) => g.sources.some((s) => sources.includes(s)))) {
        const atoms = group.atoms.filter((a) => matchesFilters(a, group.fields, filters));
        if (!atoms.length) return EMPTY_REPORT;

        const selected = columnKeys.filter((k) => group.fields.includes(k));
        const combos = new Map();
        for (const atom of atoms) {
            const values = Object.fromEntries(selected.map((k) => [k, atom[k]]));
            const id = selected.map((k) => atom[k]).join("\u0001");
            const combo = combos.get(id) || { id, values, weight: 0 };
            combo.weight += 1;
            combos.set(id, combo);
        }
        const sorted = [...combos.values()].sort((a, b) => a.id.localeCompare(b.id));
        const order = selected.length ? columnKeys.indexOf(selected[0]) : Infinity;
        groups.push({ ...group, combos: sorted, order });
    }
    groups.sort((a, b) => a.order - b.order);

    const totalRows = groups.reduce((n, g) => n * g.combos.length, dates.length);

    // Rows are decoded from their index (date first, then groups in column order),
    // so a page of the preview never materialises the whole report.
    const getRow = (index) => {
        let rem = index;
        const picks = new Array(groups.length);
        for (let g = groups.length - 1; g >= 0; g -= 1) {
            const { combos } = groups[g];
            picks[g] = combos[rem % combos.length];
            rem = Math.floor(rem / combos.length);
        }
        const row = { date: dates[rem] };
        picks.forEach((pick) => Object.assign(row, pick.values));

        const rowKey = `${row.date}|${picks.map((p) => p.id).join("|")}`;
        for (const source of kpiSources) {
            const weight = groups.reduce((w, g, i) => (g.sources.includes(source) ? w * picks[i].weight : w), 1);
            const rand = seededRandom(hashString(`${rowKey}|${source}`));
            Object.assign(row, SOURCE_MEASURES[source](rand, weight));
        }
        return row;
    };

    return { totalRows, getRow };
};
