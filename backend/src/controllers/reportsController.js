import { queryClickHouse } from '../config/clickhouse.js';
import { generateCacheKey, getCachedOrCompute, CACHE_TTL } from '../utils/cacheHelper.js';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

/**
 * Get filter options for Scheduled Reports
 */
export const getReportFilterOptions = async (req, res) => {
    try {
        const { platform } = req.query;
        const cacheKey = generateCacheKey('report_filter_options_ch', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            let platformQuery = `SELECT DISTINCT Platform FROM rb_pdp_olap WHERE Platform != '' AND Platform IS NOT NULL ORDER BY Platform`;

            let brandQuery = `SELECT DISTINCT Brand FROM rb_pdp_olap WHERE Brand != '' AND Brand IS NOT NULL AND toString(Comp_flag) = '0'`;
            if (platform && platform !== 'All') {
                brandQuery += ` AND Platform = '${platform.replace(/'/g, "''")}'`;
            }
            brandQuery += ` ORDER BY Brand`;

            let locationQuery = `SELECT DISTINCT Location FROM rb_pdp_olap WHERE Location != '' AND Location IS NOT NULL`;
            if (platform && platform !== 'All') {
                locationQuery += ` AND Platform = '${platform.replace(/'/g, "''")}'`;
            }
            locationQuery += ` ORDER BY Location`;

            let formatQuery = `SELECT DISTINCT Category FROM rb_pdp_olap WHERE Category != '' AND Category IS NOT NULL`;
            if (platform && platform !== 'All') {
                formatQuery += ` AND Platform = '${platform.replace(/'/g, "''")}'`;
            }
            formatQuery += ` ORDER BY Category`;

            let monthsQuery = `SELECT DISTINCT formatDateTime(DATE, '%Y-%m') as Month FROM rb_pdp_olap WHERE DATE IS NOT NULL ORDER BY Month DESC`;

            const [platforms, brands, locations, formats, months] = await Promise.all([
                queryClickHouse(platformQuery),
                queryClickHouse(brandQuery),
                queryClickHouse(locationQuery),
                queryClickHouse(formatQuery),
                queryClickHouse(monthsQuery)
            ]);

            return {
                platforms: platforms.map(p => p.Platform).filter(Boolean),
                brands: brands.map(b => b.Brand).filter(Boolean),
                cities: locations.map(l => l.Location).filter(Boolean),
                formats: formats.map(f => f.Category).filter(Boolean),
                months: months.map(m => m.Month).filter(Boolean)
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
        if (platform && platform !== 'All') conditions.push(`Platform = '${platform.replace(/'/g, "''")}'`);
        if (brand && brand !== 'All' && !brand.startsWith('All ')) conditions.push(`Brand = '${brand.replace(/'/g, "''")}'`);
        if (city && city !== 'All' && !city.startsWith('All ')) conditions.push(`Location = '${city.replace(/'/g, "''")}'`);
        if (format && format !== 'All' && !format.startsWith('All ')) conditions.push(`Category = '${format.replace(/'/g, "''")}'`);
        conditions.push(`toDate(DATE) BETWEEN '${startDate}' AND '${endDate}'`);

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        if (reportType === "Availability Analysis") {
            query = `
                WITH sos_stats AS (
                    SELECT 
                        toDate(kw_crawl_date) as DATE, platform_name as Platform, brand_name as Brand, keyword_category as Category,
                        count() as brand_kw_count
                    FROM rb_kw
                    GROUP BY DATE, Platform, Brand, Category
                ),
                total_kw_stats AS (
                    SELECT 
                        toDate(kw_crawl_date) as DATE, platform_name as Platform, keyword_category as Category,
                        count() as total_kw_count
                    FROM rb_kw
                    GROUP BY DATE, Platform, Category
                )
                SELECT 
                    t.DATE, t.Platform, t.Brand, t.Location as City, t.Category as Format, t.Product,
                    -- Core Availability Metrics
                    round(SUM(toFloat64(t.neno_osa)) / nullIf(SUM(toFloat64(t.deno_osa)), 0) * 100, 2) as OSA_Percentage,
                    round(100 - (SUM(toFloat64(t.neno_osa)) / nullIf(SUM(toFloat64(t.deno_osa)), 0) * 100), 2) as Stock_Out_Percentage,
                    round(avg(toFloat64(t.DIH)), 2) as DOI,
                    round(SUM(toFloat64(t.buy_box_neno_osa)) / nullIf(SUM(toFloat64(t.deno_osa)), 0) * 100, 2) as Fillrate_Percentage,
                    
                    -- SOS % (Share of Search)
                    round(any(s.brand_kw_count) / nullIf(any(tot.total_kw_count), 0) * 100, 2) as SOS_Percentage,
                    
                    -- PSL Calculation (Latest Inventory / MSL proxy)
                    round(SUM(toFloat64(t.Inventory)) / nullIf(SUM(toFloat64(t.MSL)), 0) * 100, 2) as PSL,
                    
                    -- Assortment (Distinct Count of Web_Pid)
                    COUNT(DISTINCT t.Web_Pid) as Assortment,
                    
                    -- Metro City Stock Availability
                    round(SUM(if(m.is_metro = 1, toFloat64(t.neno_osa), 0)) / nullIf(SUM(if(m.is_metro = 1, toFloat64(t.deno_osa), 0)), 0) * 100, 2) as Metro_City_Stock_Availability
                FROM rb_pdp_olap t
                LEFT JOIN sos_stats s ON toDate(t.DATE) = s.DATE AND t.Platform = s.Platform AND t.Brand = s.Brand AND t.Category = s.Category
                LEFT JOIN total_kw_stats tot ON toDate(t.DATE) = tot.DATE AND t.Platform = tot.Platform AND t.Category = tot.Category
                LEFT JOIN (
                    SELECT DISTINCT location, 1 as is_metro
                    FROM rb_location_darkstore
                    WHERE tier = 'Tier 1'
                ) m ON t.Location = m.location
                ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, 't.$1')}
                GROUP BY t.DATE, t.Platform, t.Brand, t.Location, t.Category, t.Product
                ORDER BY t.DATE DESC
            `;
        } else if (reportType === "Visibility Analysis") {
            query = `
                WITH category_stats AS (
                    SELECT 
                        toDate(kw_crawl_date) as JoinDate, platform_name as Platform, keyword_category as Category,
                        count() as Total_Category_Keywords
                    FROM rb_kw
                    WHERE toDate(kw_crawl_date) BETWEEN '${startDate}' AND '${endDate}'
                    AND keyword_search_rank < 11
                    ${platform && platform !== 'All' ? `AND platform_name = '${platform.replace(/'/g, "''")}'` : ''}
                    GROUP BY JoinDate, Platform, Category
                )
                SELECT 
                    toDate(t.kw_crawl_date) as DATE, t.platform_name as Platform, t.brand_name as Brand, t.keyword_category as Keyword_Category, t.keyword_type as Keyword_Type,
                    round(countIf(toString(t.keyword_is_rb_product) = '1') * 100.0 / nullIf(any(c.Total_Category_Keywords), 0), 2) as Overall_SOS_Percentage,
                    round(countIf(toString(t.spons_flag) = '1' AND toString(t.keyword_is_rb_product) = '1') * 100.0 / nullIf(any(c.Total_Category_Keywords), 0), 2) as Sponsored_SOS_Percentage,
                    round(countIf(toString(t.spons_flag) != '1' AND toString(t.keyword_is_rb_product) = '1') * 100.0 / nullIf(any(c.Total_Category_Keywords), 0), 2) as Organic_SOS_Percentage,
                    round(avgIf(toInt64OrZero(toString(t.keyword_search_rank)), toString(t.spons_flag) = '1'), 2) as Ad_POS,
                    round(avgIf(toInt64OrZero(toString(t.keyword_search_rank)), toString(t.spons_flag) != '1'), 2) as Org_Pos
                FROM rb_kw t
                LEFT JOIN category_stats c ON toDate(t.kw_crawl_date) = c.JoinDate AND t.platform_name = c.Platform AND t.keyword_category = c.Category
                WHERE toDate(t.kw_crawl_date) BETWEEN '${startDate}' AND '${endDate}'
                AND t.keyword_search_rank < 11
                ${platform && platform !== 'All' ? `AND t.platform_name = '${platform.replace(/'/g, "''")}'` : ''}
                ${brand && brand !== 'All' && !brand.startsWith('All ') ? `AND t.brand_name = '${brand.replace(/'/g, "''")}'` : ''}
                GROUP BY DATE, Platform, Brand, t.keyword_category, t.keyword_type
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Market Share") {
            query = `
                SELECT 
                    toDate(created_on) as DATE, brand as Brand, category as Category, Location as City,
                    SUM(sales) as Sales_Value,
                    ROUND(SUM(sales) / nullIf(SUM(SUM(sales)) OVER (PARTITION BY DATE, category, Location), 0) * 100, 2) as Market_Share_Percentage
                FROM test_brand_MS
                WHERE toDate(created_on) BETWEEN '${startDate}' AND '${endDate}'
                ${brand && brand !== 'All' && !brand.startsWith('All ') ? `AND brand = '${brand.replace(/'/g, "''")}'` : ''}
                ${city && city !== 'All' && !city.startsWith('All ') ? `AND Location = '${city.replace(/'/g, "''")}'` : ''}
                GROUP BY DATE, brand, category, Location
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Sales Data") {
            // To calculate historical comparisons, we fetch a wider range (up to 13 months back)
            const widerStartDate = dayjs(startDate).subtract(13, 'month').format('YYYY-MM-DD');
            query = `
                WITH daily_agg AS (
                    SELECT 
                        toDate(DATE) as DATE, Platform, Brand, Location as City, Category as Format, Product,
                        SUM(toFloat64OrZero(Sales)) as daily_sales,
                        SUM(assumeNotNull(Qty_Sold)) as daily_orders
                    FROM rb_pdp_olap
                    WHERE toDate(DATE) BETWEEN '${widerStartDate}' AND '${endDate}'
                    ${platform && platform !== 'All' ? `AND Platform = '${platform.replace(/'/g, "''")}'` : ''}
                    ${brand && brand !== 'All' && !brand.startsWith('All ') ? `AND Brand = '${brand.replace(/'/g, "''")}'` : ''}
                    ${city && city !== 'All' && !city.startsWith('All ') ? `AND Location = '${city.replace(/'/g, "''")}'` : ''}
                    ${format && format !== 'All' && !format.startsWith('All ') ? `AND Category = '${format.replace(/'/g, "''")}'` : ''}
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
                        toDate(DATE) as JoinDate, Location, Category,
                        avg(toFloat64OrZero(Selling_Price)) as Cat_Avg_Price
                    FROM rb_pdp_olap
                    ${whereClause}
                    GROUP BY JoinDate, Location, Category
                )
                SELECT 
                    toDate(t.DATE) as DATE, t.Platform, t.Brand, t.Location as City, t.Category as Format, t.Product,
                    round(avg(toFloat64OrZero(t.Selling_Price)), 2) as ECP,
                    round(avg(toFloat64OrZero(t.MRP)), 2) as MRP,
                    round((1 - (SUM(toFloat64OrZero(t.Sales)) / nullIf(SUM(toFloat64OrZero(t.MRP) * assumeNotNull(t.Qty_Sold)), 0))) * 100, 2) as Discount_Percentage,
                    round(avg(toFloat64OrZero(t.Selling_Price)) / nullIf(any(c.Cat_Avg_Price), 0), 2) as RPI
                FROM rb_pdp_olap t
                LEFT JOIN category_stats c ON toDate(t.DATE) = c.JoinDate AND t.Location = c.Location AND t.Category = c.Category
                ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, 't.$1')}
                GROUP BY DATE, t.Platform, t.Brand, t.Location, t.Category, t.Product
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Performance Marketing") {
            query = `
                SELECT 
                    DATE, Platform, Brand, Location as City, Category as Format, Product,
                    SUM(toFloat64OrZero(Ad_Impressions)) as Impressions,
                    SUM(toFloat64OrZero(Ad_Clicks)) as Clicks,
                    SUM(toFloat64OrZero(Ad_Spend)) as Spend,
                    round(SUM(toFloat64OrZero(Ad_sales)) / nullIf(SUM(toFloat64OrZero(Ad_Spend)), 0), 2) as ROAS,
                    round((SUM(toFloat64OrZero(Ad_Quanity_sold)) / nullIf(SUM(toFloat64OrZero(Ad_Clicks)), 0)) * 100, 2) as Conversion_Rate,
                    round((SUM(toFloat64OrZero(Ad_Spend)) / nullIf(SUM(toFloat64OrZero(Ad_Impressions)), 0)) * 1000, 2) as CPM,
                    round(SUM(toFloat64OrZero(Ad_Spend)) / nullIf(SUM(toFloat64OrZero(Ad_Clicks)), 0), 2) as CPC
                FROM rb_pdp_olap
                ${whereClause}
                GROUP BY DATE, Platform, Brand, Location, Category, Product
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Content Analysis") {
            query = `
                SELECT 
                    toDate(extraction_timestamp) as DATE, brand_name as Brand, title as Product, url as URL,
                    product_platform_total as Overall_Content_Score,
                    title_length_score as Title_Score,
                    thumbnail_media_score as Image_Score,
                    prod_desc_score as Description_Score,
                    title_char_count as Title_Length,
                    description_char_count as Word_Count
                FROM gcpl.tb_content_score_data
                WHERE toDate(extraction_timestamp) BETWEEN '${startDate}' AND '${endDate}'
                ${brand && brand !== 'All' && !brand.startsWith('All ') ? `AND lower(brand_name) = lower('${brand.replace(/'/g, "''")}')` : ''}
                ORDER BY DATE DESC
                LIMIT 5000
            `;
        } else if (reportType === "Inventory Analysis") {
            query = `
                SELECT 
                    DATE, Platform, Brand, Location as City, Category as Format, Product,
                    round(argMax(toFloat64OrZero(Inventory), DATE), 2) as Current_Inventory,
                    round(SUM(ifNull(Qty_Sold, 0)) / 30, 2) as DRR,
                    round(if(DRR > 0, Current_Inventory / DRR, 0), 2) as DOH,
                    round(if(8 > DOH, (8 - DOH) * DRR, 0), 2) as Req_PO_Quantity,
                    round(Req_PO_Quantity / 24, 2) as Req_Boxes
                FROM rb_pdp_olap
                ${whereClause}
                GROUP BY DATE, Platform, Brand, Location, Category, Product
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Category RCA") {
            query = `
                SELECT 
                    DATE, Platform, Category as Format, Location as City,
                    SUM(toFloat64OrZero(Sales)) as Offtake_Sales,
                    SUM(assumeNotNull(Qty_Sold)) as Units,
                    round(SUM(toFloat64OrZero(Sales)) / nullIf(SUM(SUM(toFloat64OrZero(Sales))) OVER (PARTITION BY DATE, Platform, Location), 0) * 100, 2) as Category_Share,
                    SUM(SUM(toFloat64OrZero(Sales))) OVER (PARTITION BY DATE, Platform, Location) as Cat_Size
                FROM rb_pdp_olap
                ${whereClause}
                GROUP BY DATE, Platform, Category, Location
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Portfolio Analysis") {
            query = `
                SELECT 
                    DATE, Platform, Brand, Location as City, Category as Format, Product,
                    round(SUM(toFloat64OrZero(Sales)) / nullIf(SUM(assumeNotNull(Qty_Sold)), 0), 2) as ASP,
                    round((1 - (SUM(toFloat64OrZero(Sales)) / nullIf(SUM(toFloat64OrZero(MRP) * assumeNotNull(Qty_Sold)), 0))) * 100, 2) as Discount_Percentage,
                    SUM(assumeNotNull(Qty_Sold)) as Volume,
                    SUM(if(toFloat64OrZero(Discount) > 0, assumeNotNull(Qty_Sold), 0)) as Promo_Volume,
                    round(Promo_Volume / nullIf(Volume, 0) * 100, 2) as Promo_Volume_Percentage
                FROM rb_pdp_olap
                ${whereClause}
                GROUP BY DATE, Platform, Brand, Location, Category, Product
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Watch Tower") {
            query = `
                SELECT 
                    DATE, Platform, Brand, Location as City, Category as Format, Product,
                    -- Core Metrics
                    SUM(toFloat64OrZero(Sales)) as Offtake,
                    SUM(assumeNotNull(Qty_Sold)) as Units_Sold,
                    round(SUM(toFloat64OrZero(neno_osa)) / nullIf(SUM(toFloat64(deno_osa)), 0) * 100, 2) as Stock_Availability,
                    round(avg(toFloat64OrZero(DIH)), 2) as DOI,
                    
                    -- Performance Marketing Metrics
                    SUM(toFloat64OrZero(Ad_sales)) as Inorganic_Sales,
                    SUM(toFloat64OrZero(Ad_Spend)) as Spend,
                    round(SUM(toFloat64OrZero(Ad_sales)) / nullIf(SUM(toFloat64OrZero(Ad_Spend)), 0), 2) as ROAS,
                    round((SUM(toFloat64OrZero(Ad_Quanity_sold)) / nullIf(SUM(toFloat64OrZero(Ad_Clicks)), 0)) * 100, 2) as Conversion,
                    round((SUM(toFloat64OrZero(Ad_Spend)) / nullIf(SUM(toFloat64OrZero(Ad_Impressions)), 0)) * 1000, 2) as CPM,
                    round(SUM(toFloat64OrZero(Ad_Spend)) / nullIf(SUM(toFloat64OrZero(Ad_Clicks)), 0), 2) as CPC,
                    
                    -- Ad Spend over Sales
                    round((SUM(toFloat64OrZero(Ad_Spend)) / nullIf(SUM(toFloat64OrZero(Sales)), 0)) * 100, 2) as BMI_Sales_Ratio,
                    
                    -- Promo Metrics
                    round(avg(toFloat64OrZero(Discount)), 2) as Promo_Percentage
                FROM rb_pdp_olap
                ${whereClause}
                GROUP BY DATE, Platform, Brand, Location, Category, Product
                ORDER BY DATE DESC
            `;
        } else {
            // Default generic query for other report types (Category RCA, Portfolio, Play it You)
            query = `
                SELECT 
                    DATE, Platform, Brand, Location as City, Category as Format, Product,
                    SUM(toFloat64OrZero(Sales)) as Sales,
                    SUM(assumeNotNull(Qty_Sold)) as Qty,
                    round(SUM(toFloat64OrZero(neno_osa)) / nullIf(SUM(toFloat64(deno_osa)), 0) * 100, 2) as OSA,
                    round(avg(toFloat64OrZero(DIH)), 2) as DOI
                FROM rb_pdp_olap
                ${whereClause}
                GROUP BY DATE, Platform, Brand, Location, Category, Product
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
