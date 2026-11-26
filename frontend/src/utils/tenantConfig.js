/**
 * Tenant-specific configuration and KPI filtering utilities.
 * Allows customizing visible KPIs and features per client (e.g. Prestige).
 */

/**
 * Detects if the currently logged-in / active workspace database is Prestige.
 * Checks sessionStorage activeWorkspaceDb, user context, and localStorage.
 */
export const isPrestigeAccount = (user = null) => {
    try {
        const u = user || JSON.parse(sessionStorage.getItem('user') || sessionStorage.getItem('kiryana_user') || localStorage.getItem('user') || '{}');
        const activeDb = (sessionStorage.getItem('activeWorkspaceDb') || u?.dbName || u?.db_name || u?.database || u?.company_name || '').toLowerCase().trim();
        return activeDb.includes('prestige');
    } catch {
        return false;
    }
};

/**
 * Checks if a KPI key or label is one of the hidden KPIs for Prestige:
 * 1. Offtakes (SP Offtake, MRP Offtake, offtake, offtakes, Offtakes Sales)
 * 2. Ad spend (Spend, Ad Spend, spend, ad_spend, Promo Spends)
 * 3. All KPIs related to pm_olap:
 *    spend, inorgSales, inorg_sales, roas, roas_x, roas_new, tacos,
 *    conversion, cpm, cpc, ad_sov, ad_sos, ad_sales, impressions, clicks,
 *    aov, bmi, bmisalesratio
 * 4. Market share KPI (Market Share, Mkt Share, marketShare, MWMarketShare, MLMarketShare, etc.)
 * 5. Category Size (Category Size, Cat Size, categorySize, est_cat_share)
 * 6. Wt. Discount (Wt Discount, Wt. Discount, Wt. Discount%, wtDiscount, wt_discount)
 * 7. Overall SOV (Overall SOV, Overall Sov, overall_sov, overallSOV, Overall SOS, overallSos)
 */
export const isPrestigeHiddenKpi = (kpiKeyOrLabel) => {
    if (!kpiKeyOrLabel) return false;
    const str = String(kpiKeyOrLabel).trim();
    const normalized = str.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Offtakes & Quantity Sold
    if (normalized.includes('offtake') || normalized === 'quantitysold' || normalized === 'qtysold') return true;

    // 2. Ad spend
    if (normalized === 'spend' || normalized === 'adspend' || normalized === 'promospends' || normalized === 'promospend') return true;

    // 3. pm_olap metrics (Note: ad_sov/ad_sos and overall_sos belong to rb_kw_olap, NOT rb_pm_olap)
    const PM_METRICS = [
        'inorgsales', 'inorganicsales', 'inorganic',
        'roas', 'roasx', 'roasnew',
        'tacos',
        'conversion', 'cvr',
        'cpm',
        'cpc',
        'adsales',
        'impressions',
        'clicks',
        'ctr',
        'atc',
        'adunits',
        'adquantitysold',
        'aov',
        'bmi', 'bmisalesratio', 'bmisales'
    ];
    if (PM_METRICS.includes(normalized)) return true;

    // 4. Market share KPI
    if (normalized.includes('marketshare') || normalized === 'mktshare' || normalized === 'mwmarketshare' || normalized === 'mlmarketshare' || normalized === 'estmktshare') return true;

    // 5. Category Size
    if (normalized === 'categorysize' || normalized === 'catsize' || normalized === 'estcatshare') return true;

    // 6. Wt. Discount
    if (normalized === 'wtdiscount' || normalized === 'weighteddiscount' || normalized === 'wtdisc') return true;

    // 7. Overall SOV (keep overallSOS / adSOS / organicSOS from rb_kw_olap visible)
    if (normalized === 'overallsov') return true;

    // 8. Inventory / DOI (missing for Prestige)
    if (
        normalized === 'doi' ||
        normalized === 'doidays' ||
        normalized === 'daysofinventory' ||
        normalized === 'daysinventory' ||
        normalized === 'daysofinventorydoi'
    ) return true;

    return false;
};

/**
 * Filter an array of KPIs for a tenant.
 * If the tenant is Prestige, filters out all prestige-hidden KPIs.
 * For any other client, returns the original array completely untouched.
 */
export const filterKpisForTenant = (kpis, user = null, keyAccessor = null) => {
    if (!Array.isArray(kpis)) return kpis;
    if (!isPrestigeAccount(user)) return kpis;

    return kpis.filter(item => {
        let keyOrLabel = item;
        if (keyAccessor && typeof keyAccessor === 'function') {
            keyOrLabel = keyAccessor(item);
        } else if (item && typeof item === 'object') {
            keyOrLabel = item.key ?? item.id ?? item.title ?? item.label ?? item.kpiKey ?? item.name;
        }
        return !isPrestigeHiddenKpi(keyOrLabel);
    });
};
