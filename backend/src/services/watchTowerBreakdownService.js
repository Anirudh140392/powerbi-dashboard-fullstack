import { queryClickHouse } from '../config/clickhouse.js';
import { buildClickHouseConditions, formatCurrency } from './watchTowerEngine.js';
import dayjs from 'dayjs';

/**
 * Get Platform Overview Breakdown (including SOS and MS)
 */
export const getPlatformOverviewData = async (filters) => {
    try {
        const { startDate, endDate, brand } = filters;

        // 1. Offtake and OSA metrics by Platform
        const currConds = buildClickHouseConditions({ ...filters, compFlag: 0 }, { dateCol: 'DATE' });

        // 2. SOS and MS require specialized table queries
        // Note: For efficiency, we run these in parallel
        const [pdpResult, sosNumResult, sosDenomResult, msNumResult, msDenomResult] = await Promise.all([
            queryClickHouse(`
                SELECT 
                    Platform,
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as sales,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Spend)), 0)) as spend,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_sales)), 0)) as ad_sales,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Clicks)), 0)) as clicks,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Quanity_sold)), 0)) as orders,
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as neno,
                    SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as deno
                FROM rb_pdp_olap
                WHERE ${currConds}
                GROUP BY Platform
            `),
            // SOS Numerator
            queryClickHouse(`
                SELECT platform_name as Platform, count() as count
                FROM rb_kw
                WHERE ${buildClickHouseConditions(filters, { dateCol: 'created_on', platformCol: 'platform_name', locationCol: 'location_name', categoryCol: 'keyword_category' })} 
                AND keyword_search_rank < 11 AND toString(keyword_is_rb_product) = '1'
                GROUP BY Platform
            `),
            // SOS Denominator
            queryClickHouse(`
                SELECT platform_name as Platform, count() as count
                FROM rb_kw
                WHERE ${buildClickHouseConditions(filters, { dateCol: 'created_on', platformCol: 'platform_name', locationCol: 'location_name', categoryCol: 'keyword_category' })} 
                AND keyword_search_rank < 11
                GROUP BY Platform
            `),
            // MS Numerator
            queryClickHouse(`
                SELECT Platform, SUM(toFloat64OrZero(toString(sales))) as sales
                FROM test_brand_MS
                WHERE ${buildClickHouseConditions(filters, { dateCol: 'created_on', platformCol: 'Platform', locationCol: 'Location', categoryCol: 'category', brandCol: 'brand' })}
                AND brand IN (SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0)
                GROUP BY Platform
            `),
            // MS Denominator
            queryClickHouse(`
                SELECT Platform, SUM(toFloat64OrZero(toString(sales))) as sales
                FROM test_brand_MS
                WHERE ${buildClickHouseConditions(filters, { dateCol: 'created_on', platformCol: 'Platform', locationCol: 'Location', categoryCol: 'category' })}
                GROUP BY Platform
            `)
        ]);

        // 3. Build lookup maps
        const sosNumMap = new Map(sosNumResult.map(r => [r.Platform, parseInt(r.count)]));
        const sosDenomMap = new Map(sosDenomResult.map(r => [r.Platform, parseInt(r.count)]));
        const msNumMap = new Map(msNumResult.map(r => [r.Platform, parseFloat(r.sales)]));
        const msDenomMap = new Map(msDenomResult.map(r => [r.Platform, parseFloat(r.sales)]));

        // 4. Combine and Format
        return pdpResult.map(p => {
            const platform = p.Platform;
            const sales = parseFloat(p.sales || 0);
            const spend = parseFloat(p.spend || 0);
            const adSales = parseFloat(p.ad_sales || 0);
            const osa = parseFloat(p.deno) > 0 ? (parseFloat(p.neno) / parseFloat(p.deno)) * 100 : 0;
            const roas = spend > 0 ? adSales / spend : 0;

            const sosNum = sosNumMap.get(platform) || 0;
            const sosDenom = sosDenomMap.get(platform) || 0;
            const sos = sosDenom > 0 ? (sosNum / sosDenom) * 100 : 0;

            const msNum = msNumMap.get(platform) || 0;
            const msDenom = msDenomMap.get(platform) || 0;
            const ms = msDenom > 0 ? (msNum / msDenom) * 100 : 0;

            const clicks = parseFloat(p.clicks || 0);
            const orders = parseFloat(p.orders || 0);
            const conversion = clicks > 0 ? (orders / clicks) * 100 : 0;

            return {
                label: platform,
                platform,
                sales: formatCurrency(sales),
                spend: formatCurrency(spend),
                roas: roas.toFixed(2),
                conversion: `${conversion.toFixed(1)}%`,
                osa: `${osa.toFixed(1)}%`,
                sos: `${sos.toFixed(1)}%`,
                marketShare: `${ms.toFixed(1)}%`
            };
        }).sort((a, b) => parseFloat(b.sales.replace(/[^0-9.]/g, '')) - parseFloat(a.sales.replace(/[^0-9.]/g, '')));

    } catch (error) {
        console.error('[getPlatformOverviewData] Error:', error);
        return [];
    }
};

/**
 * Get Category Overview Breakdown (including Market Share)
 */
export const getCategoryOverviewData = async (filters) => {
    try {
        const currConds = buildClickHouseConditions({ ...filters, compFlag: 0 }, { dateCol: 'DATE' });

        // Parallel queries for PDP metrics and Market Share
        const [categoryMetrics, msResult] = await Promise.all([
            queryClickHouse(`
                SELECT 
                    Category as category,
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as sales,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Spend)), 0)) as spend,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_sales)), 0)) as ad_sales,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Clicks)), 0)) as clicks,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Quanity_sold)), 0)) as orders,
                    SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(MRP)) * toFloat64OrZero(toString(Qty_Sold)), 0)) as mrp_val,
                    SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(Selling_Price)) * toFloat64OrZero(toString(Qty_Sold)), 0)) as actual_sales,
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as neno,
                    SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as deno
                FROM rb_pdp_olap
                WHERE ${currConds}
                GROUP BY category
            `),
            queryClickHouse(`
                SELECT category, SUM(toFloat64OrZero(toString(sales))) as total_sales
                FROM test_brand_MS
                WHERE ${buildClickHouseConditions(filters, { dateCol: 'created_on', platformCol: 'Platform', locationCol: 'Location', categoryCol: 'category' })}
                GROUP BY category
            `)
        ]);

        const msMap = new Map(msResult.map(r => [r.category, parseFloat(r.total_sales || 0)]));

        return categoryMetrics.map(c => {
            const category = c.category;
            const sales = parseFloat(c.sales || 0);
            const mrpVal = parseFloat(c.mrp_val || 0);
            const actualSales = parseFloat(c.actual_sales || 0);
            const promo = mrpVal > 0 ? ((mrpVal - actualSales) / mrpVal) * 100 : 0;
            const osa = parseFloat(c.deno) > 0 ? (parseFloat(c.neno) / parseFloat(c.deno)) * 100 : 0;

            const categoryMarketSize = msMap.get(category) || 0;
            const ms = categoryMarketSize > 0 ? (sales / categoryMarketSize) * 100 : 0;

            const spendValue = parseFloat(c.spend || 0);
            const adSalesValue = parseFloat(c.ad_sales || 0);
            const roas = spendValue > 0 ? adSalesValue / spendValue : 0;
            const clicks = parseFloat(c.clicks || 0);
            const orders = parseFloat(c.orders || 0);
            const conversion = clicks > 0 ? (orders / clicks) * 100 : 0;

            return {
                label: category,
                category,
                sales: formatCurrency(sales),
                spend: formatCurrency(spendValue),
                roas: roas.toFixed(2),
                conversion: `${conversion.toFixed(1)}%`,
                promo: `${promo.toFixed(1)}%`,
                osa: `${osa.toFixed(1)}%`,
                marketShare: `${ms.toFixed(1)}%`
            };
        }).sort((a, b) => parseFloat(b.sales.replace(/[^0-9.]/g, '')) - parseFloat(a.sales.replace(/[^0-9.]/g, '')));
    } catch (error) {
        console.error('[getCategoryOverviewData] Error:', error);
        return [];
    }
};

/**
 * Get Brand Overview Breakdown (including Market Share and SOS)
 */
export const getBrandOverviewData = async (filters) => {
    try {
        const currConds = buildClickHouseConditions(filters, { dateCol: 'DATE' });

        const [brandMetrics, sosNumResult, sosDenomResult, msNumResult, msDenomResult] = await Promise.all([
            queryClickHouse(`
                SELECT 
                    Brand,
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as sales,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Spend)), 0)) as spend,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_sales)), 0)) as ad_sales,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Clicks)), 0)) as clicks,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Quanity_sold)), 0)) as orders
                FROM rb_pdp_olap
                WHERE ${currConds}
                GROUP BY Brand
            `),
            // SOS Numerator
            queryClickHouse(`
                SELECT brand_name as Brand, count() as count
                FROM rb_kw
                WHERE ${buildClickHouseConditions(filters, { dateCol: 'created_on', platformCol: 'platform_name', locationCol: 'location_name', categoryCol: 'keyword_category', brandCol: 'brand_name' })} 
                AND keyword_search_rank < 11 AND toString(keyword_is_rb_product) = '1'
                GROUP BY Brand
            `),
            // SOS Denominator
            queryClickHouse(`
                SELECT count() as count
                FROM rb_kw
                WHERE ${buildClickHouseConditions(filters, { dateCol: 'created_on', platformCol: 'platform_name', locationCol: 'location_name', categoryCol: 'keyword_category' })} 
                AND keyword_search_rank < 11
            `),
            // MS Numerator
            queryClickHouse(`
                SELECT brand, SUM(toFloat64OrZero(toString(sales))) as sales
                FROM test_brand_MS
                WHERE ${buildClickHouseConditions(filters, { dateCol: 'created_on', platformCol: 'Platform', locationCol: 'Location', categoryCol: 'category', brandCol: 'brand' })}
                GROUP BY brand
            `),
            // MS Denominator
            queryClickHouse(`
                SELECT SUM(toFloat64OrZero(toString(sales))) as sales
                FROM test_brand_MS
                WHERE ${buildClickHouseConditions(filters, { dateCol: 'created_on', platformCol: 'Platform', locationCol: 'Location', categoryCol: 'category' })}
            `)
        ]);

        const sosNumMap = new Map(sosNumResult.map(r => [r.Brand, parseInt(r.count)]));
        const sosTotal = parseInt(sosDenomResult[0]?.count || 0);
        const msNumMap = new Map(msNumResult.map(r => [r.brand, parseFloat(r.sales)]));
        const msTotal = parseFloat(msDenomResult[0]?.sales || 0);

        return brandMetrics.map(b => {
            const brand = b.Brand;
            const sales = parseFloat(b.sales || 0);

            const brandSos = sosNumMap.get(brand) || 0;
            const sos = sosTotal > 0 ? (brandSos / sosTotal) * 100 : 0;

            const brandMs = msNumMap.get(brand) || 0;
            const ms = msTotal > 0 ? (brandMs / msTotal) * 100 : 0;

            const spend = parseFloat(b.spend || 0);
            const adSales = parseFloat(b.ad_sales || 0);
            const roas = spend > 0 ? adSales / spend : 0;
            const clicks = parseFloat(b.clicks || 0);
            const orders = parseFloat(b.orders || 0);
            const conversion = clicks > 0 ? (orders / clicks) * 100 : 0;

            return {
                label: brand,
                brand,
                sales: formatCurrency(sales),
                spend: formatCurrency(spend),
                roas: roas.toFixed(2),
                conversion: `${conversion.toFixed(1)}%`,
                marketShare: `${ms.toFixed(1)}%`,
                sos: `${sos.toFixed(1)}%`
            };
        }).sort((a, b) => parseFloat(b.sales.replace(/[^0-9.]/g, '')) - parseFloat(a.sales.replace(/[^0-9.]/g, '')));
    } catch (error) {
        console.error('[getBrandOverviewData] Error:', error);
        return [];
    }
};

/**
 * Get Month Overview Breakdown (including Market Share)
 */
export const getMonthOverviewData = async (filters) => {
    try {
        const currConds = buildClickHouseConditions({ ...filters, compFlag: 0 }, { dateCol: 'DATE' });

        const [monthMetrics, msResult] = await Promise.all([
            queryClickHouse(`
                SELECT 
                    formatDateTime(toDate(DATE), '%Y-%m-01') as month,
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as sales,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Spend)), 0)) as spend,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_sales)), 0)) as ad_sales,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Clicks)), 0)) as clicks,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Quanity_sold)), 0)) as orders,
                    SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(MRP)) * toFloat64OrZero(toString(Qty_Sold)), 0)) as mrp_val,
                    SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(Selling_Price)) * toFloat64OrZero(toString(Qty_Sold)), 0)) as actual_sales,
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as neno,
                    SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as deno
                FROM rb_pdp_olap
                WHERE ${currConds}
                GROUP BY month
            `),
            queryClickHouse(`
                SELECT formatDateTime(toDate(created_on), '%Y-%m-01') as month, SUM(toFloat64OrZero(toString(sales))) as total_sales
                FROM test_brand_MS
                WHERE ${buildClickHouseConditions(filters, { dateCol: 'created_on', platformCol: 'Platform', locationCol: 'Location', categoryCol: 'category' })}
                GROUP BY month
            `)
        ]);

        const msMap = new Map(msResult.map(r => [r.month, parseFloat(r.total_sales || 0)]));

        return monthMetrics.map(m => {
            const month = m.month;
            const sales = parseFloat(m.sales || 0);
            const spend = parseFloat(m.spend || 0);
            const adSales = parseFloat(m.ad_sales || 0);
            const osa = parseFloat(m.deno) > 0 ? (parseFloat(m.neno) / parseFloat(m.deno)) * 100 : 0;
            const roas = spend > 0 ? adSales / spend : 0;

            const clicks = parseFloat(m.clicks || 0);
            const orders = parseFloat(m.orders || 0);
            const conversion = clicks > 0 ? (orders / clicks) * 100 : 0;

            const mrpVal = parseFloat(m.mrp_val || 0);
            const actualSales = parseFloat(m.actual_sales || 0);
            const promo = mrpVal > 0 ? ((mrpVal - actualSales) / mrpVal) * 100 : 0;

            const monthMarketSize = msMap.get(month) || 0;
            const ms = monthMarketSize > 0 ? (sales / monthMarketSize) * 100 : 0;

            return {
                label: dayjs(month).format('MMM YYYY'),
                month: dayjs(month).format('MMM YYYY'),
                sales: formatCurrency(sales),
                spend: formatCurrency(spend),
                roas: roas.toFixed(2),
                conversion: `${conversion.toFixed(1)}%`,
                promo: `${promo.toFixed(1)}%`,
                osa: `${osa.toFixed(1)}%`,
                marketShare: `${ms.toFixed(1)}%`
            };
        }).sort((a, b) => dayjs(a.month).unix() - dayjs(b.month).unix());
    } catch (error) {
        console.error('[getMonthOverviewData] Error:', error);
        return [];
    }
};

/**
 * Get SKU Overview Breakdown (Optimized from watchTowerService)
 */
export const getSkuOverviewData = async (filters) => {
    try {
        const currConds = buildClickHouseConditions({ ...filters, compFlag: 0 }, { dateCol: 'DATE' });

        const [skuMetrics, msResult] = await Promise.all([
            queryClickHouse(`
                SELECT 
                    Product,
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as sales,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Spend)), 0)) as spend,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_sales)), 0)) as ad_sales,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Clicks)), 0)) as clicks,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Quanity_sold)), 0)) as orders,
                    SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(MRP)) * toFloat64OrZero(toString(Qty_Sold)), 0)) as mrp_val,
                    SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(Selling_Price)) * toFloat64OrZero(toString(Qty_Sold)), 0)) as actual_sales,
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as neno,
                    SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as deno
                FROM rb_pdp_olap
                WHERE ${currConds} AND Product IS NOT NULL AND Product != ''
                GROUP BY Product
                ORDER BY sales DESC
                LIMIT 50
            `),
            queryClickHouse(`
                SELECT SUM(toFloat64OrZero(toString(sales))) as total_sales
                FROM test_brand_MS
                WHERE ${buildClickHouseConditions(filters, { dateCol: 'created_on', platformCol: 'Platform', locationCol: 'Location', categoryCol: 'category' })}
            `)
        ]);

        const marketSize = parseFloat(msResult[0]?.total_sales || 0);

        return skuMetrics.map(s => {
            const product = s.Product;
            const sales = parseFloat(s.sales || 0);
            const spend = parseFloat(s.spend || 0);
            const adSales = parseFloat(s.ad_sales || 0);
            const osa = parseFloat(s.deno) > 0 ? (parseFloat(s.neno) / parseFloat(s.deno)) * 100 : 0;
            const roas = spend > 0 ? adSales / spend : 0;

            const mrpVal = parseFloat(s.mrp_val || 0);
            const actualSales = parseFloat(s.actual_sales || 0);
            const promo = mrpVal > 0 ? ((mrpVal - actualSales) / mrpVal) * 100 : 0;

            const ms = marketSize > 0 ? (sales / marketSize) * 100 : 0;

            const spendValue = parseFloat(s.spend || 0);
            const clicks = parseFloat(s.clicks || 0);
            const orders = parseFloat(s.orders || 0);
            const conversion = clicks > 0 ? (orders / clicks) * 100 : 0;

            return {
                label: product,
                sku: product,
                sales: formatCurrency(sales),
                spend: formatCurrency(spendValue),
                roas: roas.toFixed(2),
                conversion: `${conversion.toFixed(1)}%`,
                osa: `${osa.toFixed(1)}%`,
                promo: `${promo.toFixed(1)}%`,
                marketShare: `${ms.toFixed(1)}%`
            };
        });
    } catch (error) {
        console.error('[getSkuOverviewData] Error:', error);
        return [];
    }
};

/**
 * Get City Overview Breakdown (Optimized from watchTowerService)
 */
export const getCityOverviewData = async (filters) => {
    try {
        const currConds = buildClickHouseConditions({ ...filters, compFlag: 0 }, { dateCol: 'DATE' });

        const [cityMetrics, msResult] = await Promise.all([
            queryClickHouse(`
                SELECT 
                    Location,
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as sales,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_Spend)), 0)) as spend,
                    SUM(ifNull(toFloat64OrZero(toString(Ad_sales)), 0)) as ad_sales,
                    SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(MRP)) * toFloat64OrZero(toString(Qty_Sold)), 0)) as mrp_val,
                    SUM(if(toFloat64OrZero(toString(MRP)) > 0, toFloat64OrZero(toString(Selling_Price)) * toFloat64OrZero(toString(Qty_Sold)), 0)) as actual_sales,
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as neno,
                    SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as deno
                FROM rb_pdp_olap
                WHERE ${currConds} AND Location IS NOT NULL AND Location != ''
                GROUP BY Location
                ORDER BY sales DESC
                LIMIT 50
            `),
            queryClickHouse(`
                SELECT Location, SUM(toFloat64OrZero(toString(sales))) as total_sales
                FROM test_brand_MS
                WHERE ${buildClickHouseConditions(filters, { dateCol: 'created_on', platformCol: 'Platform', locationCol: 'Location', categoryCol: 'category' })}
                GROUP BY Location
            `)
        ]);

        const msMap = new Map(msResult.map(r => [r.Location, parseFloat(r.total_sales || 0)]));

        return cityMetrics.map(c => {
            const city = c.Location;
            const sales = parseFloat(c.sales || 0);
            const spend = parseFloat(c.spend || 0);
            const adSales = parseFloat(c.ad_sales || 0);
            const osa = parseFloat(c.deno) > 0 ? (parseFloat(c.neno) / parseFloat(c.deno)) * 100 : 0;
            const roas = spend > 0 ? adSales / spend : 0;

            const mrpVal = parseFloat(c.mrp_val || 0);
            const actualSales = parseFloat(c.actual_sales || 0);
            const promo = mrpVal > 0 ? ((mrpVal - actualSales) / mrpVal) * 100 : 0;

            const cityMarketSize = msMap.get(city) || 0;
            const ms = cityMarketSize > 0 ? (sales / cityMarketSize) * 100 : 0;

            return {
                label: city,
                city,
                sales: formatCurrency(sales),
                roas: roas.toFixed(2),
                osa: `${osa.toFixed(1)}%`,
                promo: `${promo.toFixed(1)}%`,
                marketShare: `${ms.toFixed(1)}%`
            };
        });
    } catch (error) {
        console.error('[getCityOverviewData] Error:', error);
        return [];
    }
};
