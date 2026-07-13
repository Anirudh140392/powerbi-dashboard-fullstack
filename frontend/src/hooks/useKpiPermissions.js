/**
 * useKpiPermissions – Shared hook for KPI permission gating across all pages.
 *
 * Usage:
 *   const { isKpiEnabled } = useKpiPermissions('Visibility Analysis');
 *   if (!isKpiEnabled('overall_sos')) { /* hide this KPI * / }
 *
 * The page name must match exactly what ManageKpi uses:
 *   "Business Overview", "India Overview", "Availability Analysis",
 *   "Market Coverage", "Visibility Analysis", "Market Share", "Sales Data",
 *   "Pricing Analysis", "Performance Marketing", "Portfolio Analysis",
 *   "Content Analysis", "Inventory Analysis", etc.
 *
 * This hook is REACTIVE: it reads tabPermissions from the AuthContext, so any
 * admin-panel toggle update (which calls setUser in AuthContext) is reflected
 * immediately across all components without a page reload.
 */
import { useCallback } from 'react';
import { useAuth } from '../utils/AuthContext';

/**
 * Normalizes KPI IDs from UI components to match their database counterparts in ManageKpi/ClickHouse.
 */
export function normalizeKpiId(pageName, kpiId) {
    if (!kpiId) return "";
    const lower = kpiId.toLowerCase().trim().replace(/\s+/g, '_');
    
    // Page: India Overview
    if (pageName === 'India Overview') {
        if (lower === 'osa') return 'osa';
        if (lower === 'wt_osa') return 'wt_osa';
        if (lower === 'listing' || lower === 'listing_pct') return 'listing_pct';
    }

    // Page: Market Coverage
    if (pageName === 'Market Coverage') {
        if (lower === 'marketshare' || lower === 'market_share' || lower === 'market_share_%') return 'market_share';
        if (lower === 'overallsov' || lower === 'overall_share_of_visibility') return 'overall_share_of_visibility';
        if (lower === 'paidsov' || lower === 'paid_share_of_visibility') return 'paid_share_of_visibility';
        if (lower === 'stock_availability') return 'stock_availability';
        if (lower === 'metro_city_stock_availability') return 'metro_city_stock_availability';
        if (lower === 'osa') return 'osa';
    }

    // Page: Availability Analysis
    if (pageName === 'Availability Analysis') {
        if (lower === 'osa') return 'osa';
        if (lower === 'stock_availability' || lower === 'availability') return 'stock_availability';
        if (lower === 'wt_osa_pct') return 'wt_osa_pct';
        if (lower === 'listing' || lower === 'listing_pct') return 'listing_pct';
        if (lower === 'psl' || lower === 'potential_sales_loss') return 'psl';
        if (lower === 'soh' || lower === 'stock_on_hand') return 'soh';
        if (lower === 'doi') return 'doi';
        if (lower === 'assortment') return 'stock_availability';
        if (lower === 'discount') return 'stock_availability';
    }
    
    // Page: Pricing Analysis
    if (pageName === 'Pricing Analysis') {
        if (lower === 'discount' || lower === 'discount_pct') return 'discount_pct';
        if (lower === 'priceperunit' || lower === 'price_unit_1g_1piece') return 'price_unit_1g_1piece';
        if (lower === 'asp' || lower === 'average_selling_price') return 'average_selling_price';
    }
    
    // Page: Market Share
    if (pageName === 'Market Share') {
        if (lower === 'marketshare' || lower === 'market_share' || lower === 'mwmarketshare') return 'market_share';
        if (lower === 'sales' || lower === 'brand_estimated_sales' || lower === 'mwsales') return 'brand_estimated_sales';
        if (lower === 'overallsov' || lower === 'overall_share_of_visibility') return 'overall_share_of_visibility';
        if (lower === 'paidsov' || lower === 'paid_share_of_visibility') return 'paid_share_of_visibility';
        if (lower === 'categorysize' || lower === 'category_size') return 'category_size';
        if (lower === 'mlmarketshare' || lower === 'market_leader_sales') return 'market_leader_sales';
    }

    // Page: Sales Data
    if (pageName === 'Sales Data') {
        if (lower === 'overall_sales' || lower === 'mtd_sales' || lower === 'current_drr' || lower === 'projected_sales' || lower === 'sales_revenue') {
            return 'sales_revenue';
        }
    }

    // Page: Performance Marketing
    if (pageName === 'Performance Marketing') {
        if (lower === 'directconv' || lower === 'conversion') return 'conversion';
    }

    // Page: Visibility Analysis
    if (pageName === 'Visibility Analysis') {
        if (lower === 'overall' || lower === 'overall_sos') return 'Share of Shelf_overall_sos';
        if (lower === 'organic' || lower === 'organic_sos') return 'Share of Shelf_organic_sos';
        if (lower === 'paid' || lower === 'sponsored_sos') return 'Share of Shelf_sponsored_sos';
        if (lower === 'products_in_bsr') return 'BSR_products_in_bsr';
        if (lower === 'avg_bsr_position') return 'BSR_avg_bsr_position';
        if (lower === 'bsr_sov' || lower === 'bsr_sos') return 'BSR_bsr_sov';
        if (lower === 'top_10_bsr_products') return 'BSR_top_10_bsr_products';
        if (lower === 'share_of_shelf_access' || lower === 'share_of_shelf') return 'Share of Shelf_access';
        if (lower === 'bsr_access' || lower === 'bsr') return 'BSR_access';
    }

    // Page: Business Overview
    if (pageName === 'Business Overview') {
        if (lower === 'osa' || lower === 'availability') return 'availability';
        if (lower === 'promo-my' || lower === 'promo' || lower === 'discount' || lower === 'price') return 'promo';
        if (lower === 'sos' || lower === 'share_of_search' || lower === 'overallsos' || lower === 'overall_sos') return 'share_of_search';
        if (lower === 'marketshare' || lower === 'market_share' || lower === 'estcategoryshare') return 'market_share';
    }

    // Page: Scheduled Reports
    if (pageName === 'Scheduled Reports') {
        if (lower === 'listing_%') return 'listing_pct';
        if (lower === 'promo_%') return 'promo_pct';
        if (lower === 'osa_%') return 'osa_pct';
        if (lower === 'stock_out_%') return 'stock_out_pct';
        if (lower === 'sos_%') return 'sos_pct';
        if (lower === 'overall_sos_%') return 'overall_sos_pct';
        if (lower === 'sponsored_sos_%') return 'sponsored_sos_pct';
        if (lower === 'organic_sos_%') return 'organic_sos_pct';
        if (lower === 'discount_%') return 'discount_pct';
        if (lower === 'inventory_health_%') return 'inventory_health_pct';
        if (lower === 'market_share_%') return 'market_share_pct';
    }

    // General fallback mappings
    if (lower === 'osa' || lower === 'availability') return 'availability';
    if (lower === 'sos' || lower === 'share_of_search') return 'share_of_search';
    
    return lower;
}

export function getKpiCount(pageName, tabPerms) {
    // A mapping of the default KPIs for each page matching PAGE_KPIS_MAP / ClickHouse migration defaults.
    const defaultKpisMap = {
        "Business Overview": [
            "offtake", "availability", "share_of_search", "market_share", "promo",
            "inorganic_sales", "conversion", "roas", "orders", "spend", "category_size",
            "sponsored_sos", "organic_sos", "cpm", "cpc", "impressions", "clicks", "ctr", "cost_per_click"
        ],
        "India Overview": [
            "osa", "listing_pct", "market_share", "sales", "orders"
        ],
        "Availability Analysis": [
            "osa", "stock_availability", "doi", "metro_city_stock_availability", "psl",
            "soh", "wt_osa_pct", "offtake_share"
        ],
        "Market Coverage": [
            "stock_availability", "metro_city_stock_availability", "osa",
            "market_share", "overall_share_of_visibility", "paid_share_of_visibility"
        ],
        "Visibility Analysis": [
            "Share of Shelf_access",
            "Share of Shelf_overall_sos", "Share of Shelf_sponsored_sos", "Share of Shelf_organic_sos",
            "BSR_access",
            "BSR_products_in_bsr", "BSR_avg_bsr_position", "BSR_bsr_sov", "BSR_top_10_bsr_products"
        ],
        "Market Share": [
            "category_size", "market_leader_sales", "brand_estimated_sales",
            "market_share", "overall_share_of_visibility", "paid_share_of_visibility"
        ],
        "Sales Data": [
            "sales_revenue", "orders_count", "average_order_value"
        ],
        "Pricing Analysis": [
            "discount_pct", "weighted_discount", "average_selling_price",
            "price_drop_my_skus", "price_increase_my_skus", "price_drop_comp_skus",
            "price_increase_comp_skus", "price_unit_1g_1piece"
        ],
        "Performance Marketing": [
            "impressions", "conversion", "spend", "roas", "cpm", "sales"
        ],
        "Portfolio Analysis": [
            "pds_score", "pds_score_delta", "perfect_pdp_pct"
        ],
        "Content Analysis": [
            "title_match_pct", "image_match_pct", "desc_match_pct", "video_match_pct"
        ],
        "Inventory Analysis": [
            "instock_pct", "outofstock_pct", "critical_stock_alerts"
        ],
        "Scheduled Reports": [
            "listing_pct", "promo_pct", "osa_pct", "stock_out_pct", "sos_pct",
            "overall_sos_pct", "sponsored_sos_pct", "organic_sos_pct", "discount_pct",
            "inventory_health_pct", "market_share_pct"
        ],
        "Insights": [
            "share_headroom_hotspots", "price_parity_radar", "ds_listing_summary", "competitor_osa_weak_spots",
            "remove_ad_low_osa", "surplus_stock", "prioritise_po", "transfer_issue",
            "new_market_entry", "dark_store_coverage_gaps", "new_dark_store_expansion", "co_relations"
        ]
    };

    const kpiIds = new Set(defaultKpisMap[pageName] || []);

    // Merge any dynamic KPI IDs that exist in the user's tab permissions for this page
    const prefix = `kpi_${pageName}_`;
    Object.keys(tabPerms).forEach(key => {
        if (key.startsWith(prefix)) {
            const kpiId = key.substring(prefix.length);
            if (kpiId && !kpiId.endsWith('_access')) {
                kpiIds.add(kpiId);
            }
        }
    });

    const total = kpiIds.size;
    let enabled = 0;
    kpiIds.forEach(id => {
        const flatKey = `kpi_${pageName}_${id}`;
        if (tabPerms[flatKey] !== false) {
            enabled++;
        }
    });

    return { enabled, total };
}

export default function useKpiPermissions(pageName) {
    const { user } = useAuth();
    const tabPerms = user?.tabPermissions || {};

    /**
     * Check if a KPI is enabled for the given page.
     * @param {string} kpiId – The KPI id (e.g. 'overall_sos', 'Osa', 'Listing')
     * @returns {boolean}
     */
    const isKpiEnabled = useCallback((kpiId) => {
        if (!kpiId) return true;
        const normalized = normalizeKpiId(pageName, kpiId);
        const idsToCheck = Array.isArray(normalized) ? normalized : [normalized];
        
        for (const id of idsToCheck) {
            const flatKey = `kpi_${pageName}_${id}`;
            const val = tabPerms[flatKey];
            if (val === false) {
                return false;
            }
        }
        return true; // default visible
    }, [tabPerms, pageName]);

    const getPageKpiCount = useCallback(() => {
        return getKpiCount(pageName, tabPerms);
    }, [pageName, tabPerms]);

    return { isKpiEnabled, tabPerms, getKpiCount: getPageKpiCount };
}
