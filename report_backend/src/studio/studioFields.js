/**
 * Report Studio field registry — the server side of
 * frontend/src/components/ReportStudio/reportStudioConfig.js. Keys must match the
 * frontend's source ids and field keys; the frontend owns presentation, this
 * file owns the SQL.
 *
 * Physical column names are logical here and resolved per tenant through
 * getTableColumns (case-insensitive), because casing and types differ between
 * tenant databases. A field whose columns a tenant lacks is reported back as
 * unavailable and comes out as NA.
 */

export const STUDIO_SOURCES = {
    pdp: { table: 'rb_pdp_olap', date: 'DATE' },
    kw: { table: 'rb_kw_olap', date: 'DATE' },
    ms: { table: 'rb_ms_olap', date: 'created_on' },
    pm: { table: 'rb_pm_olap', date: 'DATE' },
};

export const LOCATION_TABLE = 'rb_location_darkstore';

/**
 * Dimensions and other text fields. `columns` maps source → column; `region`
 * is looked up from LOCATION_TABLE by the source's city and platform columns.
 * `item` marks attributes of the ranked/sold item rather than of its context:
 * share KPIs (SOS, market share) keep their all-brand denominator across them.
 * `ownFlag` reads the source's own-brand test instead of a column.
 * `label` and `display` feed the CSV export.
 */
export const STUDIO_DIMENSIONS = {
    channel: { label: 'Channel', display: 'initcap', columns: { pdp: 'channel', kw: 'channel', ms: 'channel', pm: 'channel' } },
    platform: { label: 'Platform', display: 'initcap', columns: { pdp: 'Platform', kw: 'platform_name', ms: 'platform', pm: 'Platform' } },
    category: { label: 'Category', display: 'initcap', columns: { pdp: 'Category', kw: 'keyword_category', ms: 'category', pm: 'category' } },
    brand: { label: 'Brand', display: 'initcap', item: true, columns: { pdp: 'Brand', kw: 'brand', ms: 'group_brand', pm: 'brand' } },
    // Own or Competitor, from each source's own-brand flag (OWN_BRAND in studioKpis.js).
    brand_type: { label: 'Brand Type', display: 'initcap', item: true, ownFlag: true },
    region: {
        label: 'Region',
        display: 'initcap',
        lookup: { pdp: { city: 'Location' }, kw: { city: 'location_name' } },
    },
    city: { label: 'City', display: 'initcap', columns: { pdp: 'Location', kw: 'location_name', ms: 'location' } },
    // No source holds these at the grain of the OLAP tables yet (rb_pdp_olap is
    // city-level, PDS tiers aren't stored), so they always come out as NA.
    pds_tier: { label: 'PDS Tier', columns: {} },
    pincode: { label: 'Pincode', columns: {} },

    product: { label: 'Product', item: true, columns: { pdp: 'Product', ms: 'item_name' } },
    web_pid: { label: 'Web PID', display: 'web_pid', item: true, columns: { pdp: 'Web_Pid', kw: 'web_pid', ms: 'web_pid' } },
    sub_category: { label: 'Sub-category', display: 'initcap', columns: { pdp: 'Product_Subcategory' } },
    product_type: { label: 'Product Type', display: 'initcap', columns: { pdp: 'Product_type' } },
    keyword: { label: 'Keyword', columns: { kw: 'keyword', pm: 'keyword' } },
    keyword_type: { label: 'Keyword Type', display: 'initcap', columns: { kw: 'keyword_type', pm: 'keyword_type' } },
    targeting_type: { label: 'Targeting Type', display: 'initcap', columns: { pm: 'targeting_type' } },
};

/** Platforms whose Web PIDs are shown upper-case, as in the other report exports. */
export const UPPERCASE_WEB_PID_PLATFORMS = ['amazon', 'flipkart', 'fk minutes', 'fk_minutes', 'amz now', 'amz_now', 'instamart'];
