import { queryClickHouse } from './src/config/clickhouse.js';
import { getTableColumns, resolveColumn } from './src/utils/schemaHelper.js';
import dayjs from 'dayjs';

async function generateQuery() {
    const req = {
        query: {
            platform: 'Amazon,Blinkit,Instamart',
            timePeriod: 'Last 30 Days',
            reportType: 'Master Dump',
            metrics: 'Offtake,Units Sold,Orders,Stock Availability,Listing %,Inorganic Sales,ROAS,Conversion Rate,CPM,CPC,BMI Sales Ratio,Promo %,OSA %,Stock Out %,DOI,SOS %,PSL,Assortment,Metro City Stock Availability,Overall SOS %,Sponsored SOS %,Organic SOS %,Ad Position,Org Position,ECP,MRP,Discount %,RPI,Sales Value,Market Share %,Category Size',
            dimensions: 'Category,Brand,City',
            granularityTime: 'Daily',
            granularitySku: 'Category',
            granularityGeo: 'Pan India',
            startDate: '2026-03-28',
            endDate: '2026-04-27'
        }
    };

    const { platform, brand, city, format, timePeriod, reportType, startDate: qStart, endDate: qEnd } = req.query;

    const pdpCols = await getTableColumns('rb_pdp_olap');
    const col = (name) => resolveColumn(pdpCols, name, '0');

    let catCol = 'Product_type';
    if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category');
    else if (pdpCols.has('category')) catCol = pdpCols.get('category');

    let startDate = qStart;
    let endDate = qEnd;

    let query = '';
    const conditions = [];

    if (platform && platform !== 'All' && platform.trim() !== '') {
        const platforms = platform.split(',').map(p => `'${p.trim().replace(/'/g, "''")}'`).join(', ');
        conditions.push(`Platform IN (${platforms})`);
    }

    conditions.push(`toDate(DATE) BETWEEN '${startDate}' AND '${endDate}'`);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    if (reportType === "Master Dump") {
        const hasKwOlap = true;

        let timeAgg = `toDate(t.DATE)`;
        let cteTimeAgg = `toDate(DATE)`;
        const granTime = req.query.granularityTime || "Daily";

        let reqDimensions = req.query.dimensions ? req.query.dimensions.split(',') : ['Platform', 'Brand', 'City', 'Category', 'Product'];
        if (req.query.granularityGeo === "Pan India") {
            reqDimensions = reqDimensions.filter(d => d !== 'City');
        }

        const granSku = req.query.granularitySku || '';

        let hasPlatform = reqDimensions.includes('Platform');
        let hasBrand = reqDimensions.includes('Brand');
        let hasCity = reqDimensions.includes('City');
        let hasFormat = reqDimensions.includes('Category') || reqDimensions.includes('Format');
        let hasProduct = reqDimensions.includes('Product');

        if (granSku.includes('SKU')) {
            hasProduct = true;
            hasBrand = true;
        } else if (granSku.includes('Brand')) {
            hasBrand = true;
        } else if (granSku.includes('Category')) {
            hasFormat = true;
        }

        const dimSelects = [];
        const dimGroups = [];
        if (hasPlatform) { dimSelects.push(`t.Platform as Platform`); dimGroups.push(`Platform`); }
        if (hasBrand) { dimSelects.push(`t.Brand as Brand`); dimGroups.push(`Brand`); }
        if (hasCity) { dimSelects.push(`t.Location as City`); dimGroups.push(`City`); }
        if (hasFormat) { dimSelects.push(`t.${catCol} as Format`); dimGroups.push(`Format`); }
        if (hasProduct) { dimSelects.push(`t.Product as Product`); dimGroups.push(`Product`); }

        const dimGroupStr = dimGroups.length > 0 ? ', ' + dimGroups.join(', ') : '';

        let sosGroupCols = ['DATE'];
        let sosSelectCols = [`${cteTimeAgg} as DATE`];
        let sosJoinOn = [`${timeAgg} = s.DATE`];

        let totGroupCols = ['DATE'];
        let totSelectCols = [`${cteTimeAgg} as DATE`];
        let totJoinOn = [`${timeAgg} = tot.DATE`];

        if (hasPlatform) {
            sosGroupCols.push('Platform'); sosSelectCols.push('platform_name as Platform'); sosJoinOn.push('t.Platform = s.Platform');
            totGroupCols.push('Platform'); totSelectCols.push('platform_name as Platform'); totJoinOn.push('t.Platform = tot.Platform');
        }
        if (hasBrand) {
            sosGroupCols.push('Brand'); sosSelectCols.push('brand as Brand'); sosJoinOn.push('t.Brand = s.Brand');
        }
        if (hasFormat) {
            sosGroupCols.push('Category'); sosSelectCols.push('keyword_category as Category'); sosJoinOn.push(`t.${catCol} = s.Category`);
            totGroupCols.push('Category'); totSelectCols.push('keyword_category as Category'); totJoinOn.push(`t.${catCol} = tot.Category`);
        }

        const sosCte = hasKwOlap ? `
            WITH sos_stats AS (
                SELECT 
                    ${sosSelectCols.join(', ')},
                    count() as brand_kw_count
                FROM rb_kw_olap
                GROUP BY ${sosGroupCols.join(', ')}
            ),
            total_kw_stats AS (
                SELECT 
                    ${totSelectCols.join(', ')},
                    count() as total_kw_count
                FROM rb_kw_olap
                GROUP BY ${totGroupCols.join(', ')}
            )` : '';

        const sosJoin = hasKwOlap ? `
            LEFT JOIN sos_stats s ON ${sosJoinOn.join(' AND ')}
            LEFT JOIN total_kw_stats tot ON ${totJoinOn.join(' AND ')}` : '';

        const sosCol = hasKwOlap ? `round(any(s.brand_kw_count) / nullIf(any(tot.total_kw_count), 0) * 100, 2) as SOS_Percentage,` : '';

        query = `
            ${sosCte}
            SELECT 
                ${timeAgg} as DATE${dimSelects.length > 0 ? ', ' + dimSelects.join(', ') : ''},
                SUM(toFloat64(${col('Sales')})) as Offtake,
                SUM(assumeNotNull(${col('Qty_Sold')})) as Units_Sold,
                SUM(assumeNotNull(${col('Qty_Sold')})) as Orders,
                round(SUM(toFloat64(${col('Sales')})) / nullIf(SUM(assumeNotNull(${col('Qty_Sold')})), 0), 2) as ASP,

                round(SUM(toFloat64(${col('neno_osa')})) / nullIf(SUM(toFloat64(${col('deno_osa')})), 0) * 100, 2) as Stock_Availability,
                round(avg(toFloat64(${col('DIH')})), 2) as DOI,
                round(avg(ifNull(toFloat64OrZero(toString(${col('listing_percent')})), 0)), 2) as Listing_Percentage,

                SUM(toFloat64(${col('Ad_Impressions')})) as Impressions,
                SUM(toFloat64(${col('Ad_Clicks')})) as Clicks,
                SUM(toFloat64(${col('Ad_Spend')})) as Spend,
                SUM(toFloat64(${col('Ad_Sales')})) as Inorganic_Sales,
                round(SUM(toFloat64(${col('Ad_Sales')})) / nullIf(SUM(toFloat64(${col('Ad_Spend')})), 0), 2) as ROAS,
                round((SUM(toFloat64(${col('Ad_Quantity_sold')})) / nullIf(SUM(toFloat64(${col('Ad_Clicks')})), 0)) * 100, 2) as Conversion_Rate,
                round((SUM(toFloat64(${col('Ad_Spend')})) / nullIf(SUM(toFloat64(${col('Ad_Impressions')})), 0)) * 1000, 2) as CPM,
                round(SUM(toFloat64(${col('Ad_Spend')})) / nullIf(SUM(toFloat64(${col('Ad_Clicks')})), 0), 2) as CPC,

                SUM(toFloat64(${col('Inventory')})) as Current_Inventory,
                SUM(toFloat64(${col('MSL')})) as Target_Inventory,

                round(avg(toFloat64(${col('Selling_Price')})), 2) as ECP,
                round(avg(toFloat64(${col('MRP')})), 2) as MRP,
                round((1 - (SUM(toFloat64(t.${col('Sales')})) / nullIf(SUM(toFloat64(t.${col('MRP')}) * assumeNotNull(t.${col('Qty_Sold')})), 0))) * 100, 2) as Discount_Percentage,
                
                ${sosCol}
                
                round((SUM(toFloat64(${col('Ad_Spend')})) / nullIf(SUM(toFloat64(${col('Sales')})), 0)) * 100, 2) as BMI_Sales_Ratio,
                round(avg(toFloat64(${col('Discount')})), 2) as Promo_Percentage,

                round(SUM(toFloat64(${col('neno_osa')})) / nullIf(SUM(toFloat64(${col('deno_osa')})), 0) * 100, 2) as OSA_Percentage,
                round(100 - (SUM(toFloat64(${col('neno_osa')})) / nullIf(SUM(toFloat64(${col('deno_osa')})), 0) * 100), 2) as Stock_Out_Percentage
            FROM rb_pdp_olap t
            ${sosJoin}
            ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, (match) => match === 'Category' ? 't.' + catCol : 't.' + match)}
            GROUP BY DATE${dimGroupStr}
            ORDER BY DATE DESC
        `;
    }

    console.log(query);
    const data = await queryClickHouse(query);
    console.log("Returned rows:", data.length);
    process.exit(0);
}
generateQuery();
