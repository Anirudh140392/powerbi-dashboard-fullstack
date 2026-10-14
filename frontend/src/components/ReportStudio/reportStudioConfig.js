/**
 * Report Studio field metadata.
 *
 * Each source is one OLAP table. For dimensions, `columns` records the physical
 * column the field reads in each table (checked against the tenant schemas); a
 * dimension can only be used when every selected source has it, because combined
 * sources are joined on Date + the shared dimensions. KPIs belong to exactly one
 * source, and their `formula` strings mirror the Business Overview definitions in
 * backend/src/services/watchTowerService.js. `additive` KPIs can be summed across
 * rows in the pivot view; the rest (ratios, averages) can't.
 *
 * To add a table or KPI, extend REPORT_SOURCES / REPORT_FIELDS — the UI is driven
 * entirely from these lists.
 */

export const REPORT_SOURCES = [
    {
        id: "pdp",
        table: "rb_pdp_olap",
        label: "Availability & Pricing",
        description: "SKU listings — offtake, OSA and pricing",
        accent: "#2563eb",
        tint: "#eff6ff",
    },
    {
        id: "kw",
        table: "rb_kw_olap",
        label: "Share of Search",
        description: "Keyword search results and rank share",
        accent: "#7c3aed",
        tint: "#f5f3ff",
    },
    {
        id: "ms",
        table: "rb_ms_olap",
        label: "Market Share",
        description: "Category sales split by brand",
        accent: "#059669",
        tint: "#ecfdf5",
    },
    {
        id: "pm",
        table: "rb_pm_olap",
        label: "Performance Marketing",
        description: "Ad spend, ad sales and returns",
        accent: "#ea580c",
        tint: "#fff7ed",
    },
];

export const FIELD_GROUPS = {
    REQUIRED: "required",
    DIMENSION: "dimension",
    KPI: "kpi",
    OTHER: "other",
};

export const REPORT_FIELDS = [
    // ── Required ──
    {
        key: "date",
        label: "Date",
        group: FIELD_GROUPS.REQUIRED,
        type: "date",
        columns: { pdp: "DATE", kw: "DATE", ms: "created_on", pm: "DATE" },
    },

    // ── Dimensions ──
    {
        key: "channel",
        label: "Channel",
        group: FIELD_GROUPS.DIMENSION,
        type: "text",
        columns: { pdp: "channel", kw: "channel", ms: "channel", pm: "channel" },
    },
    {
        key: "platform",
        label: "Platform",
        group: FIELD_GROUPS.DIMENSION,
        type: "text",
        columns: { pdp: "Platform", kw: "platform_name", ms: "platform", pm: "Platform" },
    },
    {
        key: "category",
        label: "Category",
        group: FIELD_GROUPS.DIMENSION,
        type: "text",
        columns: { pdp: "Category", kw: "keyword_category", ms: "category", pm: "category" },
    },
    {
        key: "brand",
        label: "Brand",
        group: FIELD_GROUPS.DIMENSION,
        type: "text",
        columns: { pdp: "Brand", kw: "brand", ms: "group_brand", pm: "brand" },
    },
    {
        key: "city",
        label: "City",
        group: FIELD_GROUPS.DIMENSION,
        type: "text",
        columns: { pdp: "Location", kw: "location_name", ms: "location" },
    },

    // ── Other available fields ──
    {
        key: "product",
        label: "Product",
        group: FIELD_GROUPS.OTHER,
        type: "text",
        columns: { pdp: "Product", ms: "item_name" },
    },
    {
        key: "web_pid",
        label: "Web PID",
        group: FIELD_GROUPS.OTHER,
        type: "text",
        columns: { pdp: "Web_Pid", kw: "web_pid", ms: "web_pid" },
    },
    {
        key: "sub_category",
        label: "Sub-category",
        group: FIELD_GROUPS.OTHER,
        type: "text",
        columns: { pdp: "Product_Subcategory" },
    },
    {
        key: "product_type",
        label: "Product Type",
        group: FIELD_GROUPS.OTHER,
        type: "text",
        columns: { pdp: "Product_type" },
    },
    {
        key: "keyword",
        label: "Keyword",
        group: FIELD_GROUPS.OTHER,
        type: "text",
        columns: { kw: "keyword", pm: "keyword" },
    },
    {
        key: "keyword_type",
        label: "Keyword Type",
        group: FIELD_GROUPS.OTHER,
        type: "text",
        columns: { kw: "keyword_type", pm: "keyword_type" },
    },
    {
        key: "targeting_type",
        label: "Targeting Type",
        group: FIELD_GROUPS.OTHER,
        type: "text",
        columns: { pm: "targeting_type" },
    },

    // ── KPIs: rb_pdp_olap ──
    { key: "offtake", label: "Offtake", group: FIELD_GROUPS.KPI, source: "pdp", unit: "currency", formula: "SUM(Sales) for own brands", additive: true },
    { key: "osa", label: "OSA", description: "On-shelf availability", group: FIELD_GROUPS.KPI, source: "pdp", unit: "percent", formula: "SUM(neno_osa) ÷ SUM(deno_osa) × 100" },
    { key: "discount", label: "Discount", group: FIELD_GROUPS.KPI, source: "pdp", unit: "percent", formula: "(SUM(MRP) − SUM(Selling_Price)) ÷ SUM(MRP) × 100, in-stock rows" },
    { key: "wt_discount", label: "Wt. Discount", description: "Sales-weighted discount", group: FIELD_GROUPS.KPI, source: "pdp", unit: "percent", formula: "Σ(((MRP − Selling_Price) ÷ MRP) × Sales) ÷ Σ Sales × 100" },
    { key: "asp", label: "ASP", description: "Average selling price", group: FIELD_GROUPS.KPI, source: "pdp", unit: "currency", formula: "AVG(Selling_Price) for in-stock own SKUs" },
    { key: "listing", label: "Listing %", group: FIELD_GROUPS.KPI, source: "pdp", unit: "percent", formula: "AVG(listing_percent)" },
    { key: "buy_box", label: "Buy Box %", group: FIELD_GROUPS.KPI, source: "pdp", unit: "percent", formula: "SUM(buy_box_neno_osa) ÷ SUM(deno_osa) × 100" },
    { key: "qty_sold", label: "Quantity Sold", group: FIELD_GROUPS.KPI, source: "pdp", unit: "number", formula: "SUM(Qty_Sold) for own brands", additive: true },

    // ── KPIs: rb_kw_olap ──
    { key: "sos", label: "SOS", description: "Share of search", group: FIELD_GROUPS.KPI, source: "kw", unit: "percent", formula: "Own-brand share of overall results in the top 10 positions" },
    { key: "ad_sov", label: "Ad SOV", description: "Sponsored share of voice", group: FIELD_GROUPS.KPI, source: "kw", unit: "percent", formula: "Own-brand share of sponsored results in the top 10 positions" },
    { key: "organic_sov", label: "Organic SOV", description: "Organic share of voice", group: FIELD_GROUPS.KPI, source: "kw", unit: "percent", formula: "Own-brand share of organic results in the top 10 positions" },

    // ── KPIs: rb_ms_olap ──
    { key: "market_share", label: "Market Share", group: FIELD_GROUPS.KPI, source: "ms", unit: "percent", formula: "Own-brand SUM(sales) ÷ category SUM(sales) × 100" },
    { key: "category_size", label: "Category Size", group: FIELD_GROUPS.KPI, source: "ms", unit: "currency", formula: "SUM(sales) across all brands", additive: true },

    // ── KPIs: rb_pm_olap ──
    { key: "ad_spend", label: "Ad Spend", group: FIELD_GROUPS.KPI, source: "pm", unit: "currency", formula: "SUM(ad_spend)", additive: true },
    { key: "ad_sales", label: "Ad Sales", group: FIELD_GROUPS.KPI, source: "pm", unit: "currency", formula: "SUM(ad_sales)", additive: true },
    { key: "roas", label: "ROAS", description: "Return on ad spend", group: FIELD_GROUPS.KPI, source: "pm", unit: "ratio", formula: "SUM(ad_sales) ÷ SUM(ad_spend)" },
    { key: "impressions", label: "Impressions", group: FIELD_GROUPS.KPI, source: "pm", unit: "number", formula: "SUM(impressions)", additive: true },
    { key: "clicks", label: "Clicks", group: FIELD_GROUPS.KPI, source: "pm", unit: "number", formula: "SUM(ad_click)", additive: true },
    { key: "orders", label: "Orders", group: FIELD_GROUPS.KPI, source: "pm", unit: "number", formula: "SUM(ad_quantity_sold)", additive: true },
    { key: "conversion", label: "Conversion", group: FIELD_GROUPS.KPI, source: "pm", unit: "percent", formula: "Orders ÷ Clicks × 100" },
    { key: "cpc", label: "CPC", description: "Cost per click", group: FIELD_GROUPS.KPI, source: "pm", unit: "currency", formula: "Ad Spend ÷ Clicks" },
    { key: "cpm", label: "CPM", description: "Cost per 1,000 impressions", group: FIELD_GROUPS.KPI, source: "pm", unit: "currency", formula: "Ad Spend ÷ Impressions × 1000" },
    { key: "aov", label: "AOV", description: "Average order value", group: FIELD_GROUPS.KPI, source: "pm", unit: "currency", formula: "Ad Sales ÷ Orders" },
];

export const FIELDS_BY_KEY = Object.fromEntries(REPORT_FIELDS.map((f) => [f.key, f]));
export const SOURCES_BY_ID = Object.fromEntries(REPORT_SOURCES.map((s) => [s.id, s]));

export const UNIT_SUFFIX = { currency: "₹", percent: "%", ratio: "x" };

export const DEFAULT_CONFIG = {
    sources: ["pdp"],
    columns: ["date", "platform", "brand", "offtake", "osa"],
};
