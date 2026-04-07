import { queryClickHouse } from '../config/clickhouse.js';
import { generateCacheKey, getCachedOrCompute, CACHE_TTL } from '../utils/cacheHelper.js';
import { getTableColumns, resolveColumn } from '../utils/schemaHelper.js';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

/**
 * Check if a table exists in the current ClickHouse database
 */
const checkTableExists = async (tableName) => {
    try {
        const result = await queryClickHouse(`EXISTS TABLE ${tableName}`);
        return result && result[0] && result[0].result === 1;
    } catch (error) {
        console.warn(`[Reports] Table existence check failed for ${tableName}:`, error.message);
        return false;
    }
};

/**
 * Get filter options for Scheduled Reports
 */
export const getReportFilterOptions = async (req, res) => {
    try {
        const { platform, brand, city, format } = req.query;
        const cacheKey = generateCacheKey('report_filter_options_ch_v2', req.query);

        // Dynamically determine the Category column to avoid hardcoding "Product_type"
        const pdpCols = await getTableColumns('rb_pdp_olap');
        let catCol = 'Product_type';
        if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category');
        else if (pdpCols.has('category')) catCol = pdpCols.get('category');
        else if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category'); // For specific casing fallback if mapped
        
        const data = await getCachedOrCompute(cacheKey, async () => {
            const buildWhere = (excludeField) => {
                const conditions = [];
                if (platform && platform !== 'All' && platform !== 'All Platforms' && excludeField !== 'Platform') {
                    conditions.push(`lower(Platform) = lower('${platform.replace(/'/g, "''")}')`);
                }
                if (brand && brand !== 'All Brands' && excludeField !== 'Brand') {
                    conditions.push(`lower(Brand) = lower('${brand.replace(/'/g, "''")}')`);
                }
                if (city && city !== 'All Locations' && excludeField !== 'Location') {
                    conditions.push(`lower(Location) = lower('${city.replace(/'/g, "''")}')`);
                }
                if (format && format !== 'All Categories' && excludeField !== catCol) {
                    conditions.push(`lower(${catCol}) = lower('${format.replace(/'/g, "''")}')`);
                }
                return conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';
            };

            let platformQuery = `SELECT DISTINCT Platform FROM rb_pdp_olap WHERE Platform != '' AND Platform IS NOT NULL ${buildWhere('Platform')} ORDER BY Platform`;

            let brandQuery = `SELECT DISTINCT Brand FROM rb_pdp_olap WHERE Brand != '' AND Brand IS NOT NULL AND toString(Comp_flag) = '0' ${buildWhere('Brand')} ORDER BY Brand`;

            let locationQuery = `SELECT DISTINCT Location FROM rb_pdp_olap WHERE Location != '' AND Location IS NOT NULL ${buildWhere('Location')} ORDER BY Location`;

            let formatQuery = `SELECT DISTINCT ${catCol} as CatLabel FROM rb_pdp_olap WHERE ${catCol} != '' AND ${catCol} IS NOT NULL ${buildWhere(catCol)} ORDER BY CatLabel`;

            let skuQuery = `SELECT DISTINCT Product FROM rb_pdp_olap WHERE Product != '' AND Product IS NOT NULL ${buildWhere('Product')} ORDER BY Product`;

            let monthsQuery = `SELECT DISTINCT formatDateTime(DATE, '%Y-%m') as Month FROM rb_pdp_olap WHERE DATE IS NOT NULL ORDER BY Month DESC`;

            const [platforms, brands, locations, formats, skus, months] = await Promise.all([
                queryClickHouse(platformQuery),
                queryClickHouse(brandQuery),
                queryClickHouse(locationQuery),
                queryClickHouse(formatQuery),
                queryClickHouse(skuQuery),
                queryClickHouse(monthsQuery)
            ]);

            const capitalize = (str) => {
                if (!str) return str;
                return str.toString().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            };

            // Safely get the first value of the object regardless of what casing ClickHouse assigned the key
            const getColVal = (row) => row ? Object.values(row)[0] : null;

            // Deduplicate options if case variations exist (e.g. 'amazon', 'Amazon')
            const uniqueMap = (arr) => [...new Set(arr.map(getColVal).filter(Boolean).map(capitalize))];

            return {
                platforms: uniqueMap(platforms),
                brands: uniqueMap(brands),
                cities: uniqueMap(locations),
                formats: uniqueMap(formats),
                skus: uniqueMap(skus),
                months: months.map(getColVal).filter(Boolean)
            };
        }, CACHE_TTL.METRICS);

        res.json(data);
    } catch (error) {
        console.error('[getReportFilterOptions] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Download Report as Excel
 */
export const downloadReport = async (req, res) => {
    try {
        const { platform, brand, city, format, timePeriod, reportType, startDate: qStart, endDate: qEnd } = req.query;

        // Discover actual column names for rb_pdp_olap (handles case-sensitivity differences)
        const pdpCols = await getTableColumns('rb_pdp_olap');
        // Provide '0' as fallback so queries don't crash if optional columns (like DIH, Ad_Sales) are missing
        const col = (name) => resolveColumn(pdpCols, name, '0');

        // Dynamically determine Category column
        let catCol = 'Product_type';
        if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category');
        else if (pdpCols.has('category')) catCol = pdpCols.get('category');
        else if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category');

        // 1. Determine Date Range from timePeriod
        let startDate, endDate;
        const now = dayjs();

        if (timePeriod === "Custom Range" && qStart && qEnd) {
            startDate = qStart;
            endDate = qEnd;
        } else if (timePeriod === "Last 7 Days") {
            startDate = now.subtract(7, 'day').format('YYYY-MM-DD');
            endDate = now.format('YYYY-MM-DD');
        } else if (timePeriod === "Last 30 Days") {
            startDate = now.subtract(30, 'day').format('YYYY-MM-DD');
            endDate = now.format('YYYY-MM-DD');
        } else if (timePeriod === "Last 90 Days") {
            startDate = now.subtract(90, 'day').format('YYYY-MM-DD');
            endDate = now.format('YYYY-MM-DD');
        } else if (timePeriod === "Last 6 Months") {
            startDate = now.subtract(6, 'month').format('YYYY-MM-DD');
            endDate = now.format('YYYY-MM-DD');
        } else if (timePeriod === "Last Year") {
            startDate = now.subtract(1, 'year').format('YYYY-MM-DD');
            endDate = now.format('YYYY-MM-DD');
        } else if (/^\d{4}-\d{2}$/.test(timePeriod)) {
            // Specific month format YYYY-MM
            startDate = dayjs(timePeriod).startOf('month').format('YYYY-MM-DD');
            endDate = dayjs(timePeriod).endOf('month').format('YYYY-MM-DD');
        } else {
            // Default to last 30 days
            startDate = now.subtract(30, 'day').format('YYYY-MM-DD');
            endDate = now.format('YYYY-MM-DD');
        }

        // 2. Build Query based on reportType
        let query = '';
        const conditions = [];
        if (platform && platform !== 'All') conditions.push(`lower(Platform) = lower('${platform.replace(/'/g, "''")}')`);
        if (brand && brand !== 'All' && !brand.startsWith('All ')) conditions.push(`lower(Brand) = lower('${brand.replace(/'/g, "''")}')`);
        if (city && city !== 'All' && !city.startsWith('All ')) conditions.push(`lower(Location) = lower('${city.replace(/'/g, "''")}')`);
        if (format && format !== 'All' && !format.startsWith('All ')) conditions.push(`lower(${catCol}) = lower('${format.replace(/'/g, "''")}')`);
        conditions.push(`toDate(DATE) BETWEEN '${startDate}' AND '${endDate}'`);

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Check which optional tables exist for conditional JOINs
        const [hasKwOlap, hasLocationDarkstore] = await Promise.all([
            checkTableExists('rb_kw_olap'),
            checkTableExists('rb_location_darkstore'),
        ]);

        if (reportType === "Availability Analysis") {
            // Build optional CTEs/JOINs based on table existence
            const sosCte = hasKwOlap ? `
                WITH sos_stats AS (
                    SELECT 
                        toDate(DATE) as DATE, platform_name as Platform, brand as Brand, keyword_category as Category,
                        count() as brand_kw_count
                    FROM rb_kw_olap
                    GROUP BY DATE, Platform, Brand, Category
                ),
                total_kw_stats AS (
                    SELECT 
                        toDate(DATE) as DATE, platform_name as Platform, keyword_category as Category,
                        count() as total_kw_count
                    FROM rb_kw_olap
                    GROUP BY DATE, Platform, Category
                )` : '';

            const sosJoin = hasKwOlap ? `
                LEFT JOIN sos_stats s ON toDate(t.DATE) = s.DATE AND t.Platform = s.Platform AND t.Brand = s.Brand AND t.${catCol} = s.Category
                LEFT JOIN total_kw_stats tot ON toDate(t.DATE) = tot.DATE AND t.Platform = tot.Platform AND t.${catCol} = tot.Category` : '';

            const metroJoin = hasLocationDarkstore ? `
                LEFT JOIN (
                    SELECT DISTINCT location, 1 as is_metro
                    FROM rb_location_darkstore
                    WHERE tier = 'Tier 1'
                ) m ON t.Location = m.location` : '';

            const sosCol = hasKwOlap ? `round(any(s.brand_kw_count) / nullIf(any(tot.total_kw_count), 0) * 100, 2) as SOS_Percentage,` : '';
            const metroCol = hasLocationDarkstore ? `round(SUM(if(m.is_metro = 1, toFloat64(t.${col('neno_osa')}), 0)) / nullIf(SUM(if(m.is_metro = 1, toFloat64(t.${col('deno_osa')}), 0)), 0) * 100, 2) as Metro_City_Stock_Availability` : `0 as Metro_City_Stock_Availability`;

            query = `
                ${sosCte}
                SELECT 
                    t.${col('DATE')} as DATE, t.${col('Platform')} as Platform, t.${col('Brand')} as Brand, t.${col('Location')} as City, t.${col(catCol)} as Format, t.${col('Product')} as Product,
                    round(SUM(toFloat64(t.${col('neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0) * 100, 2) as OSA_Percentage,
                    round(100 - (SUM(toFloat64(t.${col('neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0) * 100), 2) as Stock_Out_Percentage,
                    round(avg(toFloat64(t.${col('DIH')})), 2) as DOI,
                    round(SUM(toFloat64(t.${col('buy_box_neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0) * 100, 2) as Fillrate_Percentage,
                    ${sosCol}
                    round(SUM(toFloat64(t.${col('Inventory')})) / nullIf(SUM(toFloat64(t.${col('MSL')})), 0) * 100, 2) as PSL,
                    COUNT(DISTINCT t.${col('Web_Pid')}) as Assortment,
                    ${metroCol}
                FROM rb_pdp_olap t
                ${sosJoin}
                ${metroJoin}
                ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, (match) => match === 'Category' ? col(catCol) : 't.' + col(match))}
                GROUP BY t.DATE, t.Platform, t.Brand, t.Location, t.${catCol}, t.Product
                ORDER BY t.DATE DESC
            `;
        } else if (reportType === "Visibility Analysis") {
            query = `
                WITH category_stats AS (
                    SELECT 
                        toDate(DATE) as JoinDate, platform_name as Platform, keyword_category as Category,
                        count() as Total_Category_Keywords
                    FROM rb_kw_olap
                    WHERE toDate(DATE) BETWEEN '${startDate}' AND '${endDate}'
                    AND POSITION < 11
                    ${platform && platform !== 'All' ? `AND lower(platform_name) = lower('${platform.replace(/'/g, "''")}')` : ''}
                    GROUP BY JoinDate, Platform, Category
                )
                SELECT 
                    toDate(t.DATE) as DATE, t.platform_name as Platform, t.brand as Brand, t.keyword_category as Keyword_Category, t.keyword_type as Keyword_Type,
                    round(countIf(toString(t.flag) = '1') * 100.0 / nullIf(any(c.Total_Category_Keywords), 0), 2) as Overall_SOS_Percentage,
                    round(countIf(toInt32(t.spons) = 1 AND toString(t.flag) = '1') * 100.0 / nullIf(any(c.Total_Category_Keywords), 0), 2) as Sponsored_SOS_Percentage,
                    round(countIf(toInt32(t.spons) != 1 AND toString(t.flag) = '1') * 100.0 / nullIf(any(c.Total_Category_Keywords), 0), 2) as Organic_SOS_Percentage,
                    round(avgIf(toInt64OrZero(toString(t.POSITION)), toInt32(t.spons) = 1), 2) as Ad_POS,
                    round(avgIf(toInt64OrZero(toString(t.POSITION)), toInt32(t.spons) != 1), 2) as Org_Pos
                FROM rb_kw_olap t
                LEFT JOIN category_stats c ON toDate(t.DATE) = c.JoinDate AND t.platform_name = c.Platform AND t.keyword_category = c.Category
                WHERE toDate(t.DATE) BETWEEN '${startDate}' AND '${endDate}'
                AND t.POSITION < 11
                ${platform && platform !== 'All' ? `AND lower(t.platform_name) = lower('${platform.replace(/'/g, "''")}')` : ''}
                ${brand && brand !== 'All' && !brand.startsWith('All ') ? `AND lower(t.brand) = lower('${brand.replace(/'/g, "''")}')` : ''}
                GROUP BY DATE, Platform, Brand, t.keyword_category, t.keyword_type
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Market Share") {
            // Use rb_brand_ms if it exists, otherwise fall back to rb_ms_olap
            const hasBrandMs = await checkTableExists('rb_brand_ms');
            const msTable = hasBrandMs ? 'rb_brand_ms' : 'rb_ms_olap';
            const msDateCol = hasBrandMs ? 'created_on' : 'created_on';
            const msBrandCol = hasBrandMs ? 'brand' : 'group_brand';

            // Filter for only 12 specific cities as requested
            const allowedCities = ['Ahmedabad', 'Mumbai', 'Pune', 'Hyderabad', 'Bengaluru', 'Chennai', 'Kolkata', 'Lucknow', 'Delhi', 'Gurgaon', 'Faridabad', 'Chandigarh'];
            const cityFilter = `AND location IN ('${allowedCities.join("','")}')`;

            query = `
                SELECT 
                    toDate(${msDateCol}) as DATE, ${msBrandCol} as Brand, category as Category, location as City,
                    SUM(sales) as Sales_Value,
                    ROUND(SUM(sales) / nullIf(SUM(SUM(sales)) OVER (PARTITION BY DATE, category, location), 0) * 100, 2) as Market_Share_Percentage
                FROM ${msTable}
                WHERE toDate(${msDateCol}) BETWEEN '${startDate}' AND '${endDate}'
                ${brand && brand !== 'All' && !brand.startsWith('All ') ? `AND lower(${msBrandCol}) = lower('${brand.replace(/'/g, "''")}')` : ''}
                ${city && city !== 'All' && !city.startsWith('All ') ? `AND lower(location) = lower('${city.replace(/'/g, "''")}')` : ''}
                ${cityFilter}
                GROUP BY DATE, ${msBrandCol}, category, location
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Sales Data") {
            // To calculate historical comparisons, we fetch a wider range (up to 13 months back)
            const widerStartDate = dayjs(startDate).subtract(13, 'month').format('YYYY-MM-DD');
            query = `
                WITH daily_agg AS (
                    SELECT 
                        toDate(DATE) as DATE, Platform, Brand, Location as City, ${catCol} as Format, Product,
                        SUM(toFloat64(Sales)) as daily_sales,
                        SUM(assumeNotNull(Qty_Sold)) as daily_orders
                    FROM rb_pdp_olap
                    WHERE toDate(DATE) BETWEEN '${widerStartDate}' AND '${endDate}'
                    ${platform && platform !== 'All' ? `AND lower(Platform) = lower('${platform.replace(/'/g, "''")}')` : ''}
                    ${brand && brand !== 'All' && !brand.startsWith('All ') ? `AND lower(Brand) = lower('${brand.replace(/'/g, "''")}')` : ''}
                    ${city && city !== 'All' && !city.startsWith('All ') ? `AND lower(Location) = lower('${city.replace(/'/g, "''")}')` : ''}
                    ${format && format !== 'All' && !format.startsWith('All ') ? `AND lower(${catCol}) = lower('${format.replace(/'/g, "''")}')` : ''}
                    GROUP BY DATE, Platform, Brand, City, Format, Product
                ),
                running_metrics AS (
                    SELECT 
                        *,
                        SUM(daily_sales) OVER (PARTITION BY Platform, Brand, City, Format, Product, toStartOfMonth(DATE) ORDER BY DATE) as MTD_Sales,
                        SUM(daily_sales) OVER (PARTITION BY Platform, Brand, City, Format, Product, toStartOfYear(DATE) ORDER BY DATE) as YTD_Sales
                    FROM daily_agg
                )
                SELECT 
                    t.DATE as DATE, t.Platform as Platform, t.Brand as Brand, t.City as City, t.Format as Format, t.Product as Product,
                    round(t.daily_sales, 2) as Overall_Sales,
                    t.daily_orders as Orders,
                    round(t.daily_sales / nullIf(t.daily_orders, 0), 2) as ASP,
                    round(t.MTD_Sales, 2) as MTD_Sales,
                    round(pm.MTD_Sales, 2) as PREV_MONTH_MTD,
                    round(t.YTD_Sales, 2) as YTD_Sales,
                    round(ly.daily_sales, 2) as LAST_YEAR_SALES,
                    
                    round(t.MTD_Sales / nullIf(toDayOfMonth(t.DATE), 0), 2) as Current_DRR,
                    -- Projected Sales: DRR * Total days in month
                    round(Current_DRR * toDayOfMonth(date_add(month, 1, toStartOfMonth(t.DATE)) - 1), 2) as Projected_Sales,
                    
                    round(t.daily_sales / nullIf(SUM(t.daily_sales) OVER (PARTITION BY t.DATE, t.Platform, t.City), 0) * 100, 2) as Revenue_Share
                FROM running_metrics t
                LEFT JOIN daily_agg ly ON 
                    t.Platform = ly.Platform AND t.Brand = ly.Brand AND t.City = ly.City AND t.Format = ly.Format AND t.Product = ly.Product
                    AND t.DATE = date_add(year, 1, ly.DATE)
                LEFT JOIN running_metrics pm ON 
                    t.Platform = pm.Platform AND t.Brand = pm.Brand AND t.City = pm.City AND t.Format = pm.Format AND t.Product = pm.Product
                    AND t.DATE = date_add(month, 1, pm.DATE)
                WHERE t.DATE BETWEEN '${startDate}' AND '${endDate}'
                ORDER BY t.DATE DESC
            `;
        } else if (reportType === "Pricing Analysis") {
            query = `
                WITH category_stats AS (
                    SELECT 
                        toDate(DATE) as JoinDate, Location, ${catCol} as Category,
                        avg(toFloat64(Selling_Price)) as Cat_Avg_Price
                    FROM rb_pdp_olap
                    ${whereClause.replace(/\bCategory\b/g, catCol)}
                    GROUP BY JoinDate, Location, Category
                )
                SELECT 
                    toDate(t.DATE) as DATE, t.Platform, t.Brand, t.Location as City, t.${catCol} as Format, t.Product,
                    round(avg(toFloat64(t.Selling_Price)), 2) as ECP,
                    round(avg(toFloat64(t.MRP)), 2) as MRP,
                    round((1 - (SUM(toFloat64(t.Sales)) / nullIf(SUM(toFloat64(t.MRP) * assumeNotNull(t.Qty_Sold)), 0))) * 100, 2) as Discount_Percentage,
                    round(avg(toFloat64(t.Selling_Price)) / nullIf(any(c.Cat_Avg_Price), 0), 2) as RPI
                FROM rb_pdp_olap t
                LEFT JOIN category_stats c ON toDate(t.DATE) = c.JoinDate AND t.Location = c.Location AND t.${catCol} = c.Category
                ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, (m) => m === 'Category' ? catCol : 't.' + m)}
                GROUP BY DATE, t.Platform, t.Brand, t.Location, t.${catCol}, t.Product
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Performance Marketing") {
            query = `
                SELECT 
                    ${col('DATE')} as DATE, ${col('Platform')} as Platform, ${col('Brand')} as Brand, ${col('Location')} as City, ${col(catCol)} as Format, ${col('Product')} as Product,
                    SUM(toFloat64(${col('Ad_Impressions')})) as Impressions,
                    SUM(toFloat64(${col('Ad_Clicks')})) as Clicks,
                    SUM(toFloat64(${col('Ad_Spend')})) as Spend,
                    round(SUM(toFloat64(${col('Ad_Sales')})) / nullIf(SUM(toFloat64(${col('Ad_Spend')})), 0), 2) as ROAS,
                    round((SUM(toFloat64(${col('Ad_Quantity_sold')})) / nullIf(SUM(toFloat64(${col('Ad_Clicks')})), 0)) * 100, 2) as Conversion_Rate,
                    round((SUM(toFloat64(${col('Ad_Spend')})) / nullIf(SUM(toFloat64(${col('Ad_Impressions')})), 0)) * 1000, 2) as CPM,
                    round(SUM(toFloat64(${col('Ad_Spend')})) / nullIf(SUM(toFloat64(${col('Ad_Clicks')})), 0), 2) as CPC
                FROM rb_pdp_olap
                ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, (match) => match === 'Category' ? col(catCol) : col(match))}
                GROUP BY DATE, Platform, Brand, Location, ${catCol}, Product
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Content Analysis") {
            // Use tb_content_score_data without hardcoded DB prefix — resolves to user's current DB
            const hasContentTable = await checkTableExists('tb_content_score_data');
            if (!hasContentTable) {
                return res.status(404).json({ error: 'Content Analysis is not available for this database. The table tb_content_score_data does not exist.' });
            }
            query = `
                SELECT 
                    toDate(extraction_timestamp) as DATE, brand_name as Brand, title as Product, url as URL,
                    product_platform_total as Overall_Content_Score,
                    title_length_score as Title_Score,
                    thumbnail_media_score as Image_Score,
                    prod_desc_score as Description_Score,
                    title_char_count as Title_Length,
                    description_char_count as Word_Count
                FROM tb_content_score_data
                WHERE toDate(${col('extraction_timestamp')}) BETWEEN '${startDate}' AND '${endDate}'
                ${brand && brand !== 'All' && !brand.startsWith('All ') ? `AND lower(${col('brand_name')}) = lower('${brand.replace(/'/g, "''")}')` : ''}
                ORDER BY DATE DESC
                LIMIT 5000
            `;
        } else if (reportType === "Inventory Analysis") {
            query = `
                SELECT 
                    ${col('DATE')} as DATE, ${col('Platform')} as Platform, ${col('Brand')} as Brand, ${col('Location')} as City, ${col(catCol)} as Format, ${col('Product')} as Product,
                    SUM(toFloat64(${col('Inventory')})) as Current_Inventory,
                    SUM(toFloat64(${col('MSL')})) as Target_Inventory,
                    round(SUM(toFloat64(${col('Inventory')})) / nullIf(SUM(toFloat64(${col('MSL')})), 0) * 100, 2) as Inventory_Health_Percentage,
                    round(avg(toFloat64(${col('DIH')})), 2) as Days_Inventory_on_Hand
                FROM rb_pdp_olap
                ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, (match) => match === 'Category' ? col(catCol) : col(match))}
                GROUP BY DATE, Platform, Brand, City, Format, Product
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Category RCA") {
            query = `
                SELECT 
                    ${col('DATE')} as DATE, ${col('Platform')} as Platform, ${col(catCol)} as Format, ${col('Location')} as City,
                    SUM(toFloat64(${col('Sales')})) as Offtake_Sales,
                    SUM(assumeNotNull(${col('Qty_Sold')})) as Units,
                    round(SUM(toFloat64(${col('Sales')})) / nullIf(SUM(SUM(toFloat64(${col('Sales')}))) OVER (PARTITION BY ${col('DATE')}, ${col('Platform')}, ${col('Location')}), 0) * 100, 2) as Category_Share,
                    SUM(SUM(toFloat64(${col('Sales')}))) OVER (PARTITION BY ${col('DATE')}, ${col('Platform')}, ${col('Location')}) as Cat_Size
                FROM rb_pdp_olap
                ${whereClause.replace(/\bCategory\b/g, catCol)}
                GROUP BY DATE, Platform, ${catCol}, Location
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Portfolio Analysis") {
            query = `
                SELECT 
                    ${col('DATE')} as DATE, ${col('Platform')} as Platform, ${col('Brand')} as Brand, ${col('Location')} as City, ${col(catCol)} as Format, ${col('Product')} as Product,
                    round(SUM(toFloat64(${col('Sales')})) / nullIf(SUM(assumeNotNull(${col('Qty_Sold')})), 0), 2) as ASP,
                    round((1 - (SUM(toFloat64(${col('Sales')})) / nullIf(SUM(toFloat64(${col('MRP')}) * assumeNotNull(${col('Qty_Sold')})), 0))) * 100, 2) as Discount_Percentage,
                    SUM(assumeNotNull(${col('Qty_Sold')})) as Volume,
                    SUM(if(toFloat64(${col('Discount')}) > 0, assumeNotNull(${col('Qty_Sold')}), 0)) as Promo_Volume,
                    round(Promo_Volume / nullIf(Volume, 0) * 100, 2) as Promo_Volume_Percentage
                FROM rb_pdp_olap
                ${whereClause.replace(/\bCategory\b/g, catCol)}
                GROUP BY DATE, Platform, Brand, Location, ${catCol}, Product
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Business Overview") {
            query = `
                SELECT 
                    ${col('DATE')} as DATE, ${col('Platform')} as Platform, ${col('Brand')} as Brand, ${col('Location')} as City, ${col(catCol)} as Format, ${col('Product')} as Product,
                    -- Core Metrics
                    SUM(toFloat64(${col('Sales')})) as Offtake,
                    SUM(assumeNotNull(${col('Qty_Sold')})) as Units_Sold,
                    round(SUM(toFloat64(${col('neno_osa')})) / nullIf(SUM(toFloat64(${col('deno_osa')})), 0) * 100, 2) as Stock_Availability,
                    round(avg(toFloat64(${col('DIH')})), 2) as DOI,
                    round(avg(ifNull(toFloat64OrZero(toString(${col('listing_percent')})), 0)), 2) as listing_percentage,
                    
                    -- Performance Marketing Metrics
                    SUM(toFloat64(${col('Ad_Sales')})) as Inorganic_Sales,
                    SUM(toFloat64(${col('Ad_Spend')})) as Spend,
                    round(SUM(toFloat64(${col('Ad_Sales')})) / nullIf(SUM(toFloat64(${col('Ad_Spend')})), 0), 2) as ROAS,
                    round((SUM(toFloat64(${col('Ad_Quantity_sold')})) / nullIf(SUM(toFloat64(${col('Ad_Clicks')})), 0)) * 100, 2) as Conversion,
                    round((SUM(toFloat64(${col('Ad_Spend')})) / nullIf(SUM(toFloat64(${col('Ad_Impressions')})), 0)) * 1000, 2) as CPM,
                    round(SUM(toFloat64(${col('Ad_Spend')})) / nullIf(SUM(toFloat64(${col('Ad_Clicks')})), 0), 2) as CPC,
                    
                    -- Ad Spend over Sales
                    round((SUM(toFloat64(${col('Ad_Spend')})) / nullIf(SUM(toFloat64(${col('Sales')})), 0)) * 100, 2) as BMI_Sales_Ratio,
                    
                    -- Promo Metrics
                    round(avg(toFloat64(${col('Discount')})), 2) as Promo_Percentage
                FROM rb_pdp_olap
                ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, (match) => match === 'Category' ? col(catCol) : col(match))}
                GROUP BY DATE, Platform, Brand, Location, ${catCol}, Product
                ORDER BY DATE DESC
            `;
        } else {
            // Default generic query for other report types (Category RCA, Portfolio, Play it You)
            query = `
                SELECT 
                    ${col('DATE')} as DATE, ${col('Platform')} as Platform, ${col('Brand')} as Brand, ${col('Location')} as City, ${col(catCol)} as Format, ${col('Product')} as Product,
                    SUM(toFloat64(${col('Sales')})) as Sales,
                    SUM(assumeNotNull(${col('Qty_Sold')})) as Qty,
                    round(SUM(toFloat64(${col('neno_osa')})) / nullIf(SUM(toFloat64(${col('deno_osa')})), 0) * 100, 2) as OSA,
                    round(avg(toFloat64(${col('DIH')})), 2) as DOI
                FROM rb_pdp_olap
                ${whereClause.replace(/\bCategory\b/g, catCol)}
                GROUP BY DATE, Platform, Brand, Location, ${catCol}, Product
                ORDER BY DATE DESC
                LIMIT 10000
            `;
        }

        // 3. Execute Query
        console.log(`[downloadReport] Executing query for ${reportType}:`, query);
        const rawData = await queryClickHouse(query);
        console.log(`[downloadReport] Fetched ${rawData?.length || 0} rows`);

        if (!rawData || rawData.length === 0) {
            return res.status(404).json({ error: 'No data found for the selected filters' });
        }

        // 4. Generate Excel using xlsx
        const worksheet = XLSX.utils.json_to_sheet(rawData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report Data");

        // Set column widths
        const maxWidths = {};
        rawData.forEach(row => {
            Object.keys(row).forEach(key => {
                const val = String(row[key] || '');
                maxWidths[key] = Math.max(maxWidths[key] || key.length, val.length);
            });
        });
        worksheet["!cols"] = Object.keys(maxWidths).map(key => ({ wch: Math.min(maxWidths[key] + 2, 50) }));

        // 5. Send file Buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        const fileName = `${reportType.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('[downloadReport] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get available report types based on which tables exist in the current DB
 */
export const getAvailableReportTypes = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('available_report_types', {});

        const data = await getCachedOrCompute(cacheKey, async () => {
            // Define report types and their required tables
            const reportTableMap = [
                { type: 'Business Overview', tables: ['rb_pdp_olap'] },
                { type: 'Availability Analysis', tables: ['rb_pdp_olap'] },
                { type: 'Visibility Analysis', tables: ['rb_kw_olap'] },
                { type: 'Sales Data', tables: ['rb_pdp_olap'] },
                { type: 'Pricing Analysis', tables: ['rb_pdp_olap'] },
                { type: 'Performance Marketing', tables: ['rb_pdp_olap'] },
                { type: 'Inventory Analysis', tables: ['rb_pdp_olap'] },
                { type: 'Market Share', tables: ['rb_brand_ms', 'rb_ms_olap'] },  // either works
                { type: 'Content Analysis', tables: ['tb_content_score_data'] },
                { type: 'Category RCA', tables: ['rb_pdp_olap'] },
                { type: 'Portfolio Analysis', tables: ['rb_pdp_olap'] },
            ];

            const results = [];
            for (const entry of reportTableMap) {
                // For Market Share: need at least one of the tables
                if (entry.type === 'Market Share') {
                    const checks = await Promise.all(entry.tables.map(t => checkTableExists(t)));
                    if (checks.some(Boolean)) results.push(entry.type);
                } else {
                    // For others: need all required tables
                    const checks = await Promise.all(entry.tables.map(t => checkTableExists(t)));
                    if (checks.every(Boolean)) results.push(entry.type);
                }
            }
            return results;
        }, CACHE_TTL.METRICS);

        res.json({ reportTypes: data });
    } catch (error) {
        console.error('[getAvailableReportTypes] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
