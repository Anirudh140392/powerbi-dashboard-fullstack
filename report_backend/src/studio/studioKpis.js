/**
 * Report Studio KPIs, mirroring the Business Overview definitions in
 * backend/src/services/watchTowerService.js. `sql(c)` receives a column
 * resolver for the KPI's source table (see makeResolver in studioQuery.js);
 * referencing a column the tenant lacks makes the KPI unavailable (NA).
 *
 * Kinds:
 *  - plain:   `sql` returns one aggregate over the group's rows.
 *  - share:   `sql` returns { num, den }; the value is num ÷ den × 100, with
 *             den summed across item dimensions (brand, product, Web PID) so a
 *             brand's share is of the whole category / search results.
 *  - context: `sql` returns { den }; the value is den summed the same way
 *             (e.g. category size stays the category's total on a brand row).
 *
 * rb_pdp_olap rows are already limited to own brands (Comp_flag = 0); kw and
 * ms rows keep competitors for the denominators, and flag = 1 marks own brands.
 */

const ratio = (num, den) => `${num} / nullIf(${den}, 0) * 100`;
const kwOwn = (c) => `toString(${c.col('flag')}) = '1'`;
const kwTop10 = (c) => `${c.num('POSITION')} <= 10`;
const kwShare = (column) => (c) => ({
    num: `sumIf(${c.num(column)}, ${kwOwn(c)} AND ${kwTop10(c)})`,
    den: `sumIf(${c.num(column)}, ${kwTop10(c)})`,
});
const inStock = (c) => `${c.num('neno_osa')} > 0`;

export const STUDIO_KPIS = {
    // ── rb_pdp_olap ──
    offtake: { source: 'pdp', label: 'Offtake', unit: 'currency', sql: (c) => `sum(${c.num('Sales')})` },
    osa: { source: 'pdp', label: 'OSA', unit: 'percent', sql: (c) => ratio(`sum(${c.num('neno_osa')})`, `sum(${c.num('deno_osa')})`) },
    // Needs fulfilled/total order columns, which no OLAP table has yet.
    fill_rate: { source: 'pdp', label: 'Fill Rate', unit: 'percent', sql: null },
    listings_count: { source: 'pdp', label: 'Listings', unit: 'number', sql: () => 'toFloat64(count())' },
    discount: {
        source: 'pdp',
        label: 'Discount',
        unit: 'percent',
        sql: (c) => {
            const mrp = `sumIf(${c.num('MRP')}, ${inStock(c)})`;
            return ratio(`(${mrp} - sumIf(${c.num('Selling_Price')}, ${inStock(c)}))`, mrp);
        },
    },
    wt_discount: {
        source: 'pdp',
        label: 'Wt. Discount',
        unit: 'percent',
        sql: (c) => ratio(`sum((${c.num('MRP')} - ${c.num('Selling_Price')}) / nullIf(${c.num('MRP')}, 0) * ${c.num('Sales')})`, `sum(${c.num('Sales')})`),
    },
    asp: {
        source: 'pdp',
        label: 'ASP',
        unit: 'currency',
        sql: (c) => `avgIf(${c.num('Selling_Price')}, ${c.num('Selling_Price')} > 0 AND ${inStock(c)})`,
    },
    listing: {
        source: 'pdp',
        label: 'Listing %',
        unit: 'percent',
        // Falls back to the row's OSA where listing_percent isn't filled in.
        sql: (c) => `avg(if(${c.num('listing_percent')} > 0, ${c.num('listing_percent')}, ${ratio(c.num('neno_osa'), c.num('deno_osa'))}))`,
    },
    buy_box: { source: 'pdp', label: 'Buy Box %', unit: 'percent', sql: (c) => ratio(`sum(${c.num('buy_box_neno_osa')})`, `sum(${c.num('deno_osa')})`) },
    qty_sold: { source: 'pdp', label: 'Quantity Sold', unit: 'number', sql: (c) => `sum(${c.num('Qty_Sold')})` },

    // ── rb_kw_olap: own-brand share of the top 10 results ──
    sos: { source: 'kw', label: 'SOS', unit: 'percent', kind: 'share', sql: kwShare('overall') },
    ad_sov: { source: 'kw', label: 'Ad SOV', unit: 'percent', kind: 'share', sql: kwShare('spons') },
    organic_sov: { source: 'kw', label: 'Organic SOV', unit: 'percent', kind: 'share', sql: kwShare('organic') },

    // ── rb_ms_olap ──
    market_share: {
        source: 'ms',
        label: 'Market Share',
        unit: 'percent',
        kind: 'share',
        sql: (c) => ({ num: `sumIf(${c.num('sales')}, toString(${c.col('flag')}) = '1')`, den: `sum(${c.num('sales')})` }),
    },
    category_size: { source: 'ms', label: 'Category Size', unit: 'currency', kind: 'context', sql: (c) => ({ den: `sum(${c.num('sales')})` }) },

    // ── rb_pm_olap (own campaigns only, so no brand filter) ──
    ad_spend: { source: 'pm', label: 'Ad Spend', unit: 'currency', sql: (c) => `sum(${c.num('ad_spend')})` },
    ad_sales: { source: 'pm', label: 'Ad Sales', unit: 'currency', sql: (c) => `sum(${c.num('ad_sales')})` },
    roas: { source: 'pm', label: 'ROAS', unit: 'ratio', sql: (c) => `sum(${c.num('ad_sales')}) / nullIf(sum(${c.num('ad_spend')}), 0)` },
    impressions: { source: 'pm', label: 'Impressions', unit: 'number', sql: (c) => `sum(${c.num('impressions')})` },
    clicks: { source: 'pm', label: 'Clicks', unit: 'number', sql: (c) => `sum(${c.num('ad_click')})` },
    orders: { source: 'pm', label: 'Orders', unit: 'number', sql: (c) => `sum(${c.num('ad_quantity_sold')})` },
    conversion: { source: 'pm', label: 'Conversion', unit: 'percent', sql: (c) => ratio(`sum(${c.num('ad_quantity_sold')})`, `sum(${c.num('ad_click')})`) },
    cpc: { source: 'pm', label: 'CPC', unit: 'currency', sql: (c) => `sum(${c.num('ad_spend')}) / nullIf(sum(${c.num('ad_click')}), 0)` },
    cpm: { source: 'pm', label: 'CPM', unit: 'currency', sql: (c) => `sum(${c.num('ad_spend')}) / nullIf(sum(${c.num('impressions')}), 0) * 1000` },
    aov: { source: 'pm', label: 'AOV', unit: 'currency', sql: (c) => `sum(${c.num('ad_sales')}) / nullIf(sum(${c.num('ad_quantity_sold')}), 0)` },
};

/** Per source: the row filter (pdp) or own-brand row test (kw, ms) behind "own brands only". */
export const OWN_BRAND = {
    pdp: { filter: (c) => `toString(${c.col('Comp_flag')}) = '0'` },
    kw: { ownRows: (c) => `countIf(toString(${c.col('flag')}) = '1')` },
    ms: { ownRows: (c) => `countIf(toString(${c.col('flag')}) = '1')` },
};
