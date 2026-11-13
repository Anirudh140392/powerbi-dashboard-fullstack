/**
 * Report Studio field metadata.
 *
 * Each source is one OLAP table. For dimensions, `columns` records the physical
 * column the field reads in each table (checked against the tenant schemas); a
 * dimension can only be used when every selected source has it, because combined
 * sources are joined on Date + the shared dimensions. KPIs belong to exactly one
 * source, and their `formula` strings mirror the Business Overview definitions in
 * backend/src/services/watchTowerService.js. `additive` KPIs can be summed across
 * rows in the pivot view; the rest (ratios, averages) can't. A KPI's optional
 * `target` ({ good, warn }) colours the pivot heatmap against fixed thresholds
 * instead of the visible range, and `better: "lower"` flips its colours.
 *
 * To add a table, KPI or template, extend REPORT_SOURCES / REPORT_FIELDS /
 * SPECIAL_TEMPLATES / GENERAL_TEMPLATES — the UI is driven entirely from these lists.
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
        key: "brand_type",
        label: "Brand Type",
        description: "Own brand or competitor",
        group: FIELD_GROUPS.DIMENSION,
        type: "text",
        // Read from each table's own-brand flag; ad campaigns are all own-brand.
        columns: { pdp: "Comp_flag", kw: "flag", ms: "flag", pm: "brand" },
    },
    {
        key: "region",
        label: "Region",
        description: "Geographic region of the dark store",
        group: FIELD_GROUPS.DIMENSION,
        type: "text",
        // From rb_location_darkstore, joined on Location / location_name.
        columns: { pdp: "region", kw: "region" },
    },
    {
        key: "city",
        label: "City",
        group: FIELD_GROUPS.DIMENSION,
        type: "text",
        columns: { pdp: "Location", kw: "location_name", ms: "location" },
    },
    {
        key: "pds_tier",
        label: "PDS Tier",
        description: "Priority Demand SKU Tier (Gold, Silver, Bronze, Non-PDS)",
        group: FIELD_GROUPS.DIMENSION,
        type: "text",
        columns: { pdp: "pds_tier" },
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
        key: "pincode",
        label: "Pincode",
        group: FIELD_GROUPS.OTHER,
        type: "text",
        // From rb_location_darkstore for rb_pdp_olap, joined on Location.
        columns: { pdp: "pincode", kw: "pincode" },
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
    { key: "osa", label: "OSA", description: "On-shelf availability", group: FIELD_GROUPS.KPI, source: "pdp", unit: "percent", formula: "SUM(neno_osa) ÷ SUM(deno_osa) × 100", target: { good: 80, warn: 70 } },
    { key: "fill_rate", label: "Fill Rate", description: "Order fulfillment rate", group: FIELD_GROUPS.KPI, source: "pdp", unit: "percent", formula: "Fulfilled Orders ÷ Total Orders × 100", target: { good: 90, warn: 80 } },
    { key: "listings_count", label: "Listings", description: "Number of SKU × store listings", group: FIELD_GROUPS.KPI, source: "pdp", unit: "number", additive: true, formula: "COUNT(*) of SKU × location rows" },
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
    { key: "cpc", label: "CPC", description: "Cost per click", group: FIELD_GROUPS.KPI, source: "pm", unit: "currency", formula: "Ad Spend ÷ Clicks", better: "lower" },
    { key: "cpm", label: "CPM", description: "Cost per 1,000 impressions", group: FIELD_GROUPS.KPI, source: "pm", unit: "currency", formula: "Ad Spend ÷ Impressions × 1000", better: "lower" },
    { key: "aov", label: "AOV", description: "Average order value", group: FIELD_GROUPS.KPI, source: "pm", unit: "currency", formula: "Ad Sales ÷ Orders" },
];

export const FIELDS_BY_KEY = Object.fromEntries(REPORT_FIELDS.map((f) => [f.key, f]));
export const SOURCES_BY_ID = Object.fromEntries(REPORT_SOURCES.map((s) => [s.id, s]));

export const UNIT_SUFFIX = { currency: "₹", percent: "%", ratio: "x" };

/**
 * Whose rows the report covers. Competitor rows carry no sales, so Offtake and
 * Quantity Sold are blank for them; ad campaigns are own-brand only.
 */
export const BRAND_SCOPES = { own: "Own brands", all: "Own + competitors" };

export const DEFAULT_CONFIG = {
    sources: ["pdp"],
    columns: ["date", "platform", "brand", "offtake", "osa"],
    brandScope: "own",
};


/** Marker colours for well-known dimension values, shown beside their labels in the pivot. */
export const DIMENSION_VALUE_COLORS = {
    platform: {
        Blinkit: "#eab308",
        Zepto: "#6d28d9",
        "Swiggy Instamart": "#ea580c",
        Instamart: "#ea580c",
        BigBasket: "#65a30d",
        Amazon: "#0f172a",
        Flipkart: "#2563eb",
    },
    pds_tier: {
        Gold: "#ca8a04",
        Silver: "#94a3b8",
        Bronze: "#c2410c",
        "Non-PDS": "#e2e8f0",
    },
};

/**
 * Ready-made report layouts. Applying one sets the sources, report columns and
 * pivot configuration (any pivot option left out takes its default); `periods`
 * also switches the reporting period to the last N fiscal periods.
 *
 * Special templates are built for Mars and lean on its fiscal calendar; every
 * other account gets the General set, which uses calendar dates only.
 */
export const TEMPLATE_CATEGORIES = {
    special: { id: "special", label: "Special", accent: "#7c3aed", tint: "#f5f3ff", border: "#ddd6fe" },
    general: { id: "general", label: "General", accent: "#2563eb", tint: "#eff6ff", border: "#bfdbfe" },
};

// Every Mars database shares the Mars fiscal calendar.
const MARS_ACCOUNTS = ["mars", "mars_dmart", "mars_petcare"];

export const isMarsAccount = (dbName) => MARS_ACCOUNTS.includes(String(dbName || "").toLowerCase().trim());

export const SPECIAL_TEMPLATES = [
    {
        id: "week_vs_week",
        label: "Week vs Week",
        description: "Offtake and OSA by platform, with the change on the week before",
        icon: "week",
        sources: ["pdp"],
        columns: ["date", "platform", "offtake", "osa"],
        periods: 2,
        pivot: {
            areas: { filters: [], rows: ["platform"], columns: ["date"], values: ["offtake", "osa"] },
            dateGrain: "week",
            valuesAxis: "rows",
            compare: true,
            grandTotals: false,
        },
    },
    {
        id: "period_vs_period",
        label: "Period vs Period",
        description: "Offtake, market share and OSA by platform, period on period",
        icon: "period",
        sources: ["pdp", "ms"],
        columns: ["date", "platform", "offtake", "market_share", "osa"],
        periods: 3,
        pivot: {
            areas: { filters: [], rows: ["platform"], columns: ["date"], values: ["offtake", "market_share", "osa"] },
            dateGrain: "period",
            valuesAxis: "rows",
            compare: true,
            grandTotals: false,
        },
    },
    {
        id: "region_osa",
        label: "Region-wise OSA",
        description: "OSA by platform across regions, coloured against target",
        icon: "region",
        sources: ["pdp"],
        columns: ["date", "platform", "region", "osa"],
        pivot: {
            areas: { filters: ["date"], rows: ["platform"], columns: ["region"], values: ["osa"] },
            heatmap: true,
        },
    },
    {
        id: "web_pid",
        label: "Web PID-wise",
        description: "OSA and offtake for every SKU across platforms",
        icon: "sku",
        sources: ["pdp"],
        columns: ["date", "web_pid", "platform", "osa", "offtake"],
        pivot: {
            areas: { filters: ["date"], rows: ["web_pid"], columns: ["platform"], values: ["osa", "offtake"] },
            heatmap: true,
        },
    },
    {
        id: "pincode_web_pid",
        label: "Pincode × Web PID",
        description: "OSA for each SKU within each pincode, across platforms",
        icon: "pincode",
        sources: ["pdp"],
        columns: ["date", "pincode", "web_pid", "platform", "osa"],
        pivot: {
            areas: { filters: ["date"], rows: ["pincode", "web_pid"], columns: ["platform"], values: ["osa"] },
            heatmap: true,
        },
    },
    {
        id: "tier_osa",
        label: "Tier-wise OSA",
        description: "OSA across PDS tiers (Gold, Silver, Bronze) by platform",
        icon: "tier",
        sources: ["pdp"],
        columns: ["date", "pds_tier", "platform", "osa"],
        pivot: {
            areas: { filters: ["date"], rows: ["pds_tier"], columns: ["platform"], values: ["osa"] },
            heatmap: true,
        },
    },
];

export const GENERAL_TEMPLATES = [
    {
        id: "month_vs_month",
        label: "Month vs Month",
        description: "Offtake and OSA by platform, with the change on the month before",
        icon: "month",
        sources: ["pdp"],
        columns: ["date", "platform", "offtake", "osa"],
        pivot: {
            areas: { filters: [], rows: ["platform"], columns: ["date"], values: ["offtake", "osa"] },
            dateGrain: "month",
            valuesAxis: "rows",
            compare: true,
            grandTotals: false,
        },
    },
    {
        id: "brand_scorecard",
        label: "Brand Scorecard",
        description: "Offtake, OSA and discount for each brand across platforms",
        icon: "brand",
        sources: ["pdp"],
        columns: ["date", "brand", "platform", "offtake", "osa", "discount"],
        pivot: {
            areas: { filters: ["date"], rows: ["brand"], columns: ["platform"], values: ["offtake", "osa", "discount"] },
            valuesAxis: "rows",
        },
    },
    {
        id: "category_performance",
        label: "Category Performance",
        description: "Offtake and quantity sold by category, month on month",
        icon: "category",
        sources: ["pdp"],
        columns: ["date", "category", "offtake", "qty_sold"],
        pivot: {
            areas: { filters: [], rows: ["category"], columns: ["date"], values: ["offtake", "qty_sold"] },
            dateGrain: "month",
        },
    },
    {
        id: "city_osa",
        label: "City-wise OSA",
        description: "OSA by city across platforms, coloured against target",
        icon: "city",
        sources: ["pdp"],
        columns: ["date", "city", "platform", "osa"],
        pivot: {
            areas: { filters: ["date"], rows: ["city"], columns: ["platform"], values: ["osa"] },
            heatmap: true,
        },
    },
    {
        id: "share_of_search",
        label: "Share of Search",
        description: "SOS, ad and organic share of voice by keyword category",
        icon: "search",
        sources: ["kw"],
        columns: ["date", "category", "platform", "sos", "ad_sov", "organic_sov"],
        pivot: {
            areas: { filters: ["date"], rows: ["category"], columns: ["platform"], values: ["sos", "ad_sov", "organic_sov"] },
            valuesAxis: "rows",
        },
    },
    {
        id: "ad_performance",
        label: "Ad Performance",
        description: "Ad spend, ad sales and ROAS by platform, month on month",
        icon: "ads",
        sources: ["pm"],
        columns: ["date", "platform", "ad_spend", "ad_sales", "roas"],
        pivot: {
            areas: { filters: [], rows: ["platform"], columns: ["date"], values: ["ad_spend", "ad_sales", "roas"] },
            dateGrain: "month",
            valuesAxis: "rows",
        },
    },
];

/** The template category and templates an account can use. */
export const getTemplateCatalog = (dbName) =>
    isMarsAccount(dbName)
        ? { category: TEMPLATE_CATEGORIES.special, templates: SPECIAL_TEMPLATES }
        : { category: TEMPLATE_CATEGORIES.general, templates: GENERAL_TEMPLATES };
