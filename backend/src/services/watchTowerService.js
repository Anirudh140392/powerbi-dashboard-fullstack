import TbZeptoBrandSalesAnalytics from '../models/TbZeptoBrandSalesAnalytics.js';
import TbZeptoInventoryData from '../models/TbZeptoInventoryData.js';
import TbBlinkitSalesData from '../models/TbBlinkitSalesData.js';
import RbPdpOlap from '../models/RbPdpOlap.js';

import RbKw from '../models/RbKw.js';
import RbBrandMs from '../models/RbBrandMs.js';
import ZeptoMarketShare from '../models/ZeptoMarketShare.js'; // Keeping for reference if needed, but primary is now RbBrandMs
import RcaSkuDim from '../models/RcaSkuDim.js';
import { Op, Sequelize } from 'sequelize';
import sequelize from '../config/db.js';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import weekOfYear from 'dayjs/plugin/weekOfYear.js';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);

// Import cache helpers
import { getCachedOrCompute, generateCacheKey } from '../utils/cacheHelper.js';

// Internal implementation with all the compute logic
const computeSummaryMetrics = async (filters) => {
    try {
        console.log("Processing Watch Tower request with filters:", filters);

        const { months = 1, startDate: qStartDate, endDate: qEndDate, brand: rawBrand, location: rawLocation, category } = filters;
        const brand = rawBrand?.trim();
        const location = rawLocation?.trim();
        const monthsBack = parseInt(months, 10) || 1;

        // Calculate date range
        let endDate = dayjs().endOf('day');
        let startDate = endDate.subtract(monthsBack, 'month').startOf('day');

        if (qStartDate && qEndDate) {
            startDate = dayjs(qStartDate).startOf('day');
            endDate = dayjs(qEndDate).endOf('day');
        }

        console.log(`Date Range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);

        // Helper to generate month buckets
        const generateMonthBuckets = (start, end) => {
            const buckets = [];
            let current = start.clone().startOf('month');
            const endMonth = end.clone().endOf('month');
            while (current.isBefore(endMonth)) {
                buckets.push({
                    label: current.format('MMM'),
                    date: current.toDate(),
                    value: 0
                });
                current = current.add(1, 'month');
            }
            return buckets;
        };

        const monthBuckets = generateMonthBuckets(startDate, endDate);

        // Helper for currency formatting
        const formatCurrency = (value) => {
            const val = parseFloat(value);
            if (isNaN(val)) return "0";

            if (val >= 1000000000) return `₹${(val / 1000000000).toFixed(2)} B`;
            if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
            if (val >= 1000000) return `₹${(val / 1000000).toFixed(2)} M`;
            if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lac`;
            if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
            return `₹${val.toFixed(2)}`;
        };

        // Build Where Clause for RbPdpOlap (Offtake)
        const offtakeWhereClause = {
            DATE: {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
            }
        };

        if (brand && brand !== 'All') {
            offtakeWhereClause.Brand = { [Op.like]: `%${brand}%` };
        }
        if (location && location !== 'All') {
            offtakeWhereClause.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
        }

        const selectedPlatform = filters.platform;
        if (selectedPlatform && selectedPlatform !== 'All') {
            offtakeWhereClause.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase());
        }

        // 3. Availability Calculation Helper (Unified for all platforms using RbPdpOlap)
        const getAvailability = async (start, end, brandFilter, platformFilter, locationFilter, categoryFilter) => {
            let where = {};

            // Check if first argument is a pre-built where clause (overload)
            if (start && typeof start.toDate !== 'function' && typeof start === 'object') {
                where = start;
            } else {
                where = {
                    DATE: {
                        [Op.between]: [start.toDate(), end.toDate()]
                    }
                };

                if (brandFilter && brandFilter !== 'All') {
                    where.Brand = {
                        [Op.like]: `%${brandFilter}%`
                    };
                }
                if (platformFilter && platformFilter !== 'All') where.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platformFilter.toLowerCase());
                if (locationFilter && locationFilter !== 'All') where.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), locationFilter.toLowerCase());
                if (categoryFilter && categoryFilter !== 'All') where.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), categoryFilter.toLowerCase());
            }

            const result = await RbPdpOlap.findOne({
                attributes: [
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: where,
                raw: true
            });

            const totalNeno = parseFloat(result?.total_neno || 0);
            const totalDeno = parseFloat(result?.total_deno || 0);

            return totalDeno > 0 ? (totalNeno / totalDeno) * 100 : 0;
        };

        // Share of Search Calculation Helper
        const getShareOfSearch = async (start, end, brandFilter, platformFilter, locationFilter, categoryFilter) => {
            try {

                // Common where clause
                const baseWhere = {
                    kw_crawl_date: {
                        [Op.between]: [start.toDate(), end.toDate()]
                    }
                };

                if (categoryFilter) {
                    baseWhere.keyword_category = sequelize.where(sequelize.fn('LOWER', sequelize.col('keyword_category')), categoryFilter.toLowerCase());
                }

                if (locationFilter && locationFilter !== 'All') {
                    baseWhere.location_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), locationFilter.toLowerCase());
                }

                if (platformFilter && platformFilter !== 'All') {
                    baseWhere.platform_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), platformFilter.toLowerCase());
                }

                // 1. Total count of rows for selected brand
                const brandWhere = { ...baseWhere };
                if (brandFilter && brandFilter !== 'All') {
                    brandWhere.brand_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), brandFilter.toLowerCase());
                }

                // 2. Total count of rows for selected brand with spons_flag = 1
                const sponsoredWhere = { ...brandWhere };
                sponsoredWhere.spons_flag = 1;

                // 3. Total count of rows for all brands (Denominator)
                const denominatorWhere = { ...baseWhere };

                const [brandCount, sponsoredCount, denominatorCount] = await Promise.all([
                    RbKw.count({ where: brandWhere }),
                    RbKw.count({ where: sponsoredWhere }),
                    RbKw.count({ where: denominatorWhere })
                ]);

                const numerator = brandCount - sponsoredCount;
                const sos = denominatorCount > 0 ? (numerator / denominatorCount) * 100 : 0;

                return sos;
            } catch (error) {
                console.error("Error calculating Share of Search:", error);
                return 0;
            }
        };

        // Execute queries concurrently
        const [
            offtakeData,
            marketShareData,
            totalMarketShareResult,
            topSkus,
            currentAvailability,
            prevAvailability,
            currentShareOfSearch,
            prevShareOfSearch,
            availabilityTrendData,
            shareOfSearchTrendData,
            prevOfftakeResult,
            prevMarketShareResult
        ] = await Promise.all([
            // 1. Total Offtake (Sales) & Chart Data - Always use rb_pdp_olap Sales column
            (async () => {
                console.log("\n[OFFTAKE DEBUG] Querying rb_pdp_olap with filters:");
                console.log("  Where Clause:", JSON.stringify(offtakeWhereClause, null, 2));

                const result = await RbPdpOlap.findAll({
                    attributes: [
                        [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01'), 'month_date'],
                        [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']
                    ],
                    where: offtakeWhereClause,
                    group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01')],
                    raw: true
                });

                console.log(`  Result: ${result.length} month(s) with data`);
                result.forEach(r => {
                    console.log(`    ${r.month_date}: ₹${(r.total_sales || 0).toLocaleString('en-IN')}`);
                });

                const totalSales = result.reduce((sum, r) => sum + parseFloat(r.total_sales || 0), 0);
                console.log(`  Total Offtake: ₹${totalSales.toLocaleString('en-IN')}\n`);

                return result;
            })(),
            // 2. Total Market Share & Chart Data (Using RbBrandMs)
            RbBrandMs.findAll({
                attributes: [
                    [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01'), 'month_date'],
                    [Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_market_share']
                ],
                where: {
                    created_on: {
                        [Op.between]: [startDate.toDate(), endDate.toDate()]
                    },
                    ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                    ...(selectedPlatform && selectedPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase()) })
                },
                group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01')],
                raw: true
            }),
            // Total Market Share Average
            RbBrandMs.findOne({
                attributes: [
                    [Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_market_share'],
                    [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
                    [Sequelize.fn('MIN', Sequelize.col('market_share')), 'min_val'],
                    [Sequelize.fn('MAX', Sequelize.col('market_share')), 'max_val']
                ],
                where: {
                    created_on: {
                        [Op.between]: [startDate.toDate(), endDate.toDate()]
                    },
                    ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                    ...(selectedPlatform && selectedPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase()) })
                },
                raw: true
            }),
            // 3. Top SKUs by GMV (Using rb_sku_platform.sku_name instead of Product)
            (async () => {
                try {
                    // Build WHERE conditions for the SQL query
                    let whereConditions = [];
                    let replacements = {};

                    // Date filter
                    if (offtakeWhereClause.DATE) {
                        whereConditions.push('olap.DATE BETWEEN :dateFrom AND :dateTo');
                        replacements.dateFrom = offtakeWhereClause.DATE[Op.between][0];
                        replacements.dateTo = offtakeWhereClause.DATE[Op.between][1];
                    }

                    // Brand filter - use brand_name from rb_sku_platform
                    if (brand && brand !== 'All') {
                        whereConditions.push('sku.brand_name = :brand');
                        replacements.brand = brand;
                    }

                    // Location filter (case-insensitive)
                    if (location && location !== 'All') {
                        whereConditions.push('LOWER(olap.Location) = :location');
                        replacements.location = location.toLowerCase();
                    }

                    // Platform filter (case-insensitive)
                    if (selectedPlatform && selectedPlatform !== 'All') {
                        whereConditions.push('LOWER(olap.Platform) = :platform');
                        replacements.platform = selectedPlatform.toLowerCase();
                    }

                    // Category filter (case-insensitive)
                    if (category && category !== 'All') {
                        whereConditions.push('LOWER(olap.Category) = :category');
                        replacements.category = category.toLowerCase();
                    }

                    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

                    // Use raw SQL to join with rb_sku_platform
                    const query = `
                        SELECT 
                            sku.sku_name AS sku_name,
                            SUM(olap.Sales) AS sku_gmv
                        FROM rb_pdp_olap AS olap
                        INNER JOIN rb_sku_platform AS sku ON olap.Web_Pid = sku.web_pid
                        ${whereClause}
                        GROUP BY sku.sku_name
                        ORDER BY sku_gmv DESC
                        LIMIT 10
                    `;

                    const results = await sequelize.query(query, {
                        replacements,
                        type: sequelize.QueryTypes.SELECT
                    });

                    return results;
                } catch (error) {
                    console.error('Error fetching top SKUs:', error);
                    return [];
                }
            })(),
            // 4. Current Availability
            getAvailability(startDate, endDate, brand, selectedPlatform, location, category),
            // 5. Previous Availability (if compare dates exist)
            (filters.compareStartDate && filters.compareEndDate)
                ? getAvailability(dayjs(filters.compareStartDate), dayjs(filters.compareEndDate), brand, selectedPlatform, location, category)
                : Promise.resolve(0),
            // 6. Current Share of Search
            getShareOfSearch(startDate, endDate, brand, selectedPlatform, location, category),
            // 7. Previous Share of Search
            (filters.compareStartDate && filters.compareEndDate)
                ? getShareOfSearch(dayjs(filters.compareStartDate), dayjs(filters.compareEndDate), brand, selectedPlatform, location, category)
                : Promise.resolve(0),
            // 8. Availability Trend Data (Monthly)
            RbPdpOlap.findAll({
                attributes: [
                    [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01'), 'month_date'],
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: offtakeWhereClause, // Reusing the same where clause as Offtake (RbPdpOlap)
                group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01')],
                raw: true
            }),
            // 9. Share of Search Trend Data (Monthly)
            // Note: This might be heavy, but required.
            (async () => {
                const trendPromises = monthBuckets.map(async (bucket) => {
                    const mStart = dayjs(bucket.date).startOf('month');
                    const mEnd = dayjs(bucket.date).endOf('month');
                    const val = await getShareOfSearch(mStart, mEnd, brand, selectedPlatform, location, category);
                    return { month_date: bucket.date, value: val };
                });
                return Promise.all(trendPromises);
            })(),
            // 10. Previous Offtake (Total Sales) - Always use rb_pdp_olap Sales column
            (filters.compareStartDate && filters.compareEndDate)
                ? RbPdpOlap.sum('Sales', {
                    where: {
                        DATE: { [Op.between]: [dayjs(filters.compareStartDate).toDate(), dayjs(filters.compareEndDate).toDate()] },
                        ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
                        ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                        ...(category && category !== 'All' && { Category: sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase()) }),
                        ...(selectedPlatform && selectedPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase()) })
                    }
                })
                : Promise.resolve(0),
            // 11. Previous Market Share
            (filters.compareStartDate && filters.compareEndDate)
                ? RbBrandMs.findOne({
                    attributes: [[Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                    where: {
                        created_on: { [Op.between]: [dayjs(filters.compareStartDate).toDate(), dayjs(filters.compareEndDate).toDate()] },
                        ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                        ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                        ...(selectedPlatform && selectedPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase()) })
                    },
                    raw: true
                })
                : Promise.resolve(null)
        ]);

        // Process Offtake Data
        const offtakeChart = monthBuckets.map(bucket => {
            const match = offtakeData.find(d => {
                return dayjs(d.month_date).isSame(dayjs(bucket.date), 'month');
            });
            return match ? parseFloat(match.total_sales) / 10000000 : 0; // Convert to Cr
        });

        const totalOfftake = offtakeData.reduce((sum, d) => sum + parseFloat(d.total_sales), 0);
        const formattedOfftake = formatCurrency(totalOfftake);

        // Calculate Offtake Trend
        const prevOfftakeVal = parseFloat(prevOfftakeResult || 0);
        let offtakeChange = 0;
        if (prevOfftakeVal > 0) {
            offtakeChange = ((totalOfftake - prevOfftakeVal) / prevOfftakeVal) * 100;
        } else if (totalOfftake > 0) {
            offtakeChange = 100; // Treat as 100% growth if previous was 0 and current is > 0
        }
        const offtakeTrendStr = (offtakeChange >= 0 ? "+" : "") + offtakeChange.toFixed(1) + "%";

        // Process Market Share Data
        const marketShareChart = monthBuckets.map(bucket => {
            const match = marketShareData.find(d => dayjs(d.month_date).isSame(dayjs(bucket.date), 'month'));
            return match ? parseFloat(match.avg_market_share) : 0;
        });

        const totalMarketShare = totalMarketShareResult?.avg_market_share || 0;
        const formattedMarketShare = parseFloat(totalMarketShare).toFixed(1) + "%";

        // Calculate Market Share Trend
        const prevMarketShareVal = parseFloat(prevMarketShareResult?.avg_ms || 0);
        let marketShareChange = 0;
        if (prevMarketShareVal > 0) {
            marketShareChange = ((totalMarketShare - prevMarketShareVal) / prevMarketShareVal) * 100;
        } else if (totalMarketShare > 0) {
            marketShareChange = 100;
        }
        const marketShareTrendStr = (marketShareChange >= 0 ? "+" : "") + marketShareChange.toFixed(1) + "%";

        // Process Availability Data
        const formattedAvailability = currentAvailability.toFixed(1) + "%";

        // Calculate Availability Trend
        let availabilityChange = 0;
        if (prevAvailability > 0) {
            availabilityChange = ((currentAvailability - prevAvailability) / prevAvailability) * 100;
        } else if (currentAvailability > 0) {
            availabilityChange = 100;
        }
        const availabilityTrendStr = (availabilityChange >= 0 ? "+" : "") + availabilityChange.toFixed(1) + "%";

        // Process Availability Chart
        const availabilityChart = monthBuckets.map(bucket => {
            const match = availabilityTrendData.find(d => dayjs(d.month_date).isSame(dayjs(bucket.date), 'month'));
            if (match) {
                const totalNeno = parseFloat(match.total_neno || 0);
                const totalDeno = parseFloat(match.total_deno || 0);
                return totalDeno > 0 ? (totalNeno / totalDeno) * 100 : 0;
            }
            return 0;
        });

        // Process Share of Search Data
        const formattedShareOfSearch = currentShareOfSearch.toFixed(1) + "%";

        // Calculate SOS Trend
        let sosChange = 0;
        if (prevShareOfSearch > 0) {
            sosChange = ((currentShareOfSearch - prevShareOfSearch) / prevShareOfSearch) * 100;
        } else if (currentShareOfSearch > 0) {
            sosChange = 100;
        }
        const sosTrendStr = (sosChange >= 0 ? "+" : "") + sosChange.toFixed(1) + "%";

        // Process Share of Search Chart
        const shareOfSearchChart = monthBuckets.map(bucket => {
            const match = shareOfSearchTrendData.find(d => dayjs(d.month_date).isSame(dayjs(bucket.date), 'month'));
            return match ? parseFloat(match.value) : 0;
        });

        // Process Top SKUs
        const skuTableData = topSkus.map(sku => ({
            sku_name: sku.sku_name,
            gmv: formatCurrency(sku.sku_gmv)
        }));

        // Prepare Summary Metrics Object (Header values)
        const summaryMetrics = {
            offtakes: `₹${formattedOfftake}`,
            offtakesTrend: offtakeTrendStr,
            shareOfSearch: formattedShareOfSearch,
            shareOfSearchTrend: sosTrendStr,
            stockAvailability: formattedAvailability,
            stockAvailabilityTrend: availabilityTrendStr,
            marketShare: formattedMarketShare,
        };

        // Prepare Top Metrics Array (Cards with Charts)
        const chartLabels = monthBuckets.map(b => b.label);

        // Determine subtitle based on filters
        let subtitle = `last ${monthsBack} months`;
        if (qStartDate && qEndDate) {
            subtitle = `${dayjs(qStartDate).format('DD MMM')} - ${dayjs(qEndDate).format('DD MMM')}`;
        }

        const topMetrics = [
            {
                name: "Offtake",
                label: formattedOfftake,
                subtitle: subtitle,
                trend: offtakeTrendStr,
                trendType: offtakeChange >= 0 ? "positive" : "negative",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: offtakeChart,
                labels: chartLabels
            },
            {
                name: "Availability",
                label: formattedAvailability,
                subtitle: subtitle,
                trend: availabilityTrendStr,
                trendType: availabilityChange >= 0 ? "positive" : "negative",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: availabilityChart,
                labels: chartLabels
            },
            {
                name: "Share of Search",
                label: formattedShareOfSearch,
                subtitle: subtitle,
                trend: sosTrendStr,
                trendType: sosChange >= 0 ? "positive" : "negative",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: shareOfSearchChart,
                labels: chartLabels
            },
            {
                name: "Market Share",
                label: formattedMarketShare,
                subtitle: subtitle,
                trend: marketShareTrendStr,
                trendType: marketShareChange >= 0 ? "positive" : "negative",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: marketShareChart,
                labels: chartLabels
            },
        ];

        // 4. Platform Overview Calculation
        const platformDefinitions = [
            { key: 'zepto', label: 'Zepto', type: 'Q-commerce', logo: "https://upload.wikimedia.org/wikipedia/en/7/7d/Logo_of_Zepto.png" },
            { key: 'blinkit', label: 'Blinkit', type: 'Q-commerce', logo: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Blinkit-yellow-rounded.svg" },
            { key: 'swiggy', label: 'Swiggy', type: 'Marketplace', logo: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Swiggy_Logo_2024.webp" },
            { key: 'amazon', label: 'Amazon', type: 'Marketplace', logo: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" }
        ];

        const platformOverview = [];

        // Helper to generate columns structure
        const generateColumns = (offtake, availability, sos, marketShare = 0, spend = 0, roas = 0, inorgSales = 0, conversion = 0, cpm = 0, cpc = 0) => [
            { title: "Offtakes", value: formatCurrency(offtake), change: { text: "0%", positive: true }, meta: { units: "units", change: "0%" } },
            { title: "Spend", value: formatCurrency(spend), change: { text: "0%", positive: true }, meta: { units: "₹0", change: "0%" } },
            { title: "ROAS", value: `${roas.toFixed(2)}x`, change: { text: "0%", positive: true }, meta: { units: "₹0 return", change: "0%" } },
            { title: "Inorg Sales", value: formatCurrency(inorgSales), change: { text: "0%", positive: true }, meta: { units: "0 units", change: "0%" } },
            { title: "Conversion", value: `${conversion.toFixed(1)}%`, change: { text: "0 pp", positive: true }, meta: { units: "0 conversions", change: "0 pp" } },
            { title: "Availability", value: `${availability.toFixed(1)}%`, change: { text: "0 pp", positive: true }, meta: { units: "stores", change: "0 pp" } },
            { title: "SOS", value: `${sos.toFixed(1)}%`, change: { text: "0 pp", positive: true }, meta: { units: "index", change: "0 pp" } },
            { title: "Market Share", value: `${(parseFloat(marketShare) || 0).toFixed(1)}%`, change: { text: "0 pp", positive: true }, meta: { units: "Category", change: "0 pp" } },
            { title: "Promo My Brand", value: "0%", change: { text: "0 pp", positive: true }, meta: { units: "Depth", change: "0 pp" } },
            { title: "Promo Compete", value: "0%", change: { text: "0 pp", positive: true }, meta: { units: "Depth", change: "0 pp" } },
            { title: "CPM", value: `₹${Math.round(cpm)}`, change: { text: "0%", positive: true }, meta: { units: "impressions", change: "0%" } },
            { title: "CPC", value: `₹${Math.round(cpc)}`, change: { text: "0%", positive: true }, meta: { units: "clicks", change: "0%" } },
        ];

        // Calculate "All" Metrics (Global Aggregate)
        // Note: For "All", we ignore the specific platform loop but respect the global filters (Brand, Location, Date)
        // However, if the user *selected* a platform in the main filter, "All" usually means "All Platforms" ignoring the platform filter?
        // Or does it mean "All Platforms" *within* the selected context?
        // Usually "Platform Overview" shows comparison across platforms, so "All" should likely be the aggregate of ALL platforms, regardless of the single platform filter.
        // But if the user selected "Zepto", the "All" column in a table comparing Zepto vs Blinkit vs Swiggy usually represents the Total of those rows.
        // Let's assume "All" means "All Platforms" (ignoring the platform filter for this specific column calculation).

        let allOfftake = 0;
        let allAvailability = 0;
        let allSos = 0;
        let allMarketShare = 0;

        try {
            // 1. All Offtake
            const allOfftakeWhere = {
                DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
            };
            if (brand && brand !== 'All') allOfftakeWhere.Brand = { [Op.like]: `%${brand}%` };
            if (location && location !== 'All') allOfftakeWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
            if (category && category !== 'All') allOfftakeWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());
            // Intentionally NOT filtering by Platform here to get the "All Platforms" total

            const allOfftakeResult = await RbPdpOlap.findOne({
                attributes: [[Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']],
                where: allOfftakeWhere,
                raw: true
            });
            allOfftake = parseFloat(allOfftakeResult?.total_sales || 0);

            // 2. All Availability
            allAvailability = await getAvailability(startDate, endDate, brand, null, location, category); // Pass null for platform to get aggregate

            // 3. All SOS
            allSos = await getShareOfSearch(startDate, endDate, brand, null, location, category); // Pass null for platform

            // 4. All Market Share
            const allMsResult = await RbBrandMs.findOne({
                attributes: [[Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                where: {
                    created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                    ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                    ...(category && category !== 'All' && { category: sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), category.toLowerCase()) })
                    // No Platform filter
                },
                raw: true
            });
            allMarketShare = parseFloat(allMsResult?.avg_ms || 0);

        } catch (err) {
            console.error("Error calculating All metrics:", err);
        }

        platformOverview.push({
            key: 'all',
            label: 'All',
            type: 'Overall',
            logo: "https://cdn-icons-png.flaticon.com/512/711/711284.png",
            columns: generateColumns(allOfftake, allAvailability, allSos, allMarketShare) // All metrics for "All" platform might need separate calculation if we want to show aggregates there too, but for now keeping basic
        });

        const platformOverviewPromises = platformDefinitions.map(async (p) => {
            try {
                let offtake = 0;

                // Define platformOfftakeWhere for RbPdpOlap (used for Ad Metrics and non-Zepto Offtake)
                const platformOfftakeWhere = {
                    DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                    Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), p.label.toLowerCase())
                };
                if (brand && brand !== 'All') platformOfftakeWhere.Brand = { [Op.like]: `%${brand}%` };
                if (location && location !== 'All') platformOfftakeWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
                if (category && category !== 'All') platformOfftakeWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());

                // Calculate Offtake (Unified using RbPdpOlap, except Zepto)
                // Always use rb_pdp_olap Sales column for all platforms
                const platformOfftakeResult = await RbPdpOlap.findOne({
                    attributes: [[Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']],
                    where: platformOfftakeWhere,
                    raw: true
                });
                offtake = parseFloat(platformOfftakeResult?.total_sales || 0);

                // Execute other metrics concurrently
                const [availability, sos, msResult, adMetrics] = await Promise.all([
                    getAvailability(startDate, endDate, brand, p.label, location, category),
                    getShareOfSearch(startDate, endDate, brand, p.label, location, category),
                    RbBrandMs.findOne({
                        attributes: [[Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                        where: {
                            created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                            Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), p.label.toLowerCase()),
                            ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                            ...(category && category !== 'All' && { category: sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), category.toLowerCase()) })
                        },
                        raw: true
                    }),
                    RbPdpOlap.findOne({
                        attributes: [
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions']
                        ],
                        where: platformOfftakeWhere,
                        raw: true
                    })
                ]);

                const marketShare = parseFloat(msResult?.avg_ms || 0);

                const totalSpend = parseFloat(adMetrics?.total_spend || 0);
                const totalAdSales = parseFloat(adMetrics?.total_ad_sales || 0);
                const totalClicks = parseFloat(adMetrics?.total_clicks || 0);
                const totalImpressions = parseFloat(adMetrics?.total_impressions || 0);

                // Calculate ROAS: Total Ad Sales / Total Spend
                const roas = totalSpend > 0 ? totalAdSales / totalSpend : 0;

                // Calculate Conversion: (Total Ad Clicks / Total Ad Impressions) * 100
                const conversion = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

                // Calculate CPM: (Total Ad Spend / Total Ad Impressions) * 1000
                const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

                // Calculate CPC: Total Ad Spend / Total Ad Clicks
                const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

                return {
                    key: p.key,
                    label: p.label,
                    type: p.type,
                    logo: p.logo,
                    columns: generateColumns(offtake, availability, sos, marketShare, totalSpend, roas, totalAdSales, conversion, cpm, cpc)
                };
            } catch (err) {
                console.error(`Error processing platform ${p.key}:`, err);
                return {
                    key: p.key,
                    label: p.label,
                    type: p.type,
                    logo: p.logo,
                    columns: generateColumns(0, 0, 0, 0) // Fallback
                };
            }
        });

        platformOverview.push(...(await Promise.all(platformOverviewPromises)));

        // 5. Performance Marketing Metrics (SOS Focus)
        const performanceMarketing = [];

        try {
            // Current SOS
            const currentSosVal = currentShareOfSearch || 0;

            // MoM SOS
            const momStartDate = startDate.clone().subtract(1, 'month');
            const momEndDate = endDate.clone().subtract(1, 'month');
            const momSos = await getShareOfSearch(momStartDate, momEndDate, brand, selectedPlatform, location, category);
            const momChange = momSos > 0 ? ((currentSosVal - momSos) / momSos) * 100 : 0;

            // YoY SOS
            const yoyStartDate = startDate.clone().subtract(1, 'year');
            const yoyEndDate = endDate.clone().subtract(1, 'year');
            const yoySos = await getShareOfSearch(yoyStartDate, yoyEndDate, brand, selectedPlatform, location, category);
            const yoyChange = yoySos > 0 ? ((currentSosVal - yoySos) / yoySos) * 100 : 0;

            // Trend (Last 6 Months ending at endDate)
            const sosTrendPromises = [];
            for (let i = 6; i >= 0; i--) {
                const mStart = endDate.clone().subtract(i, 'month').startOf('month');
                const mEnd = endDate.clone().subtract(i, 'month').endOf('month');
                sosTrendPromises.push(getShareOfSearch(mStart, mEnd, brand, selectedPlatform, location, category));
            }
            const sosTrendData = await Promise.all(sosTrendPromises);

            performanceMarketing.push({
                title: "Share of Search",
                value: `${currentSosVal.toFixed(1)}%`,
                mom: `${momChange.toFixed(1)}%`,
                momUp: momChange >= 0,
                yoy: `${yoyChange.toFixed(1)}%`,
                yoyUp: yoyChange >= 0,
                data: sosTrendData
            });

            // ROAS for Performance Marketing Section
            // Calculate Current ROAS using Average of ROAS column
            const currentRoasResult = await RbPdpOlap.findOne({
                attributes: [
                    [Sequelize.fn('AVG', Sequelize.col('ROAS')), 'avg_roas']
                ],
                where: offtakeWhereClause,
                raw: true
            });
            const currentRoas = parseFloat(currentRoasResult?.avg_roas || 0);


            // MoM ROAS
            const momRoasResult = await RbPdpOlap.findOne({
                attributes: [
                    [Sequelize.fn('AVG', Sequelize.col('ROAS')), 'avg_roas']
                ],
                where: {
                    DATE: { [Op.between]: [momStartDate.toDate(), momEndDate.toDate()] },
                    ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                    ...(selectedPlatform && selectedPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase()) })
                },
                raw: true
            });
            const momRoas = parseFloat(momRoasResult?.avg_roas || 0);
            const momRoasChange = momRoas > 0 ? ((currentRoas - momRoas) / momRoas) * 100 : 0;


            // YoY ROAS
            const yoyRoasResult = await RbPdpOlap.findOne({
                attributes: [
                    [Sequelize.fn('AVG', Sequelize.col('ROAS')), 'avg_roas']
                ],
                where: {
                    DATE: { [Op.between]: [yoyStartDate.toDate(), yoyEndDate.toDate()] },
                    ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                    ...(selectedPlatform && selectedPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase()) })
                },
                raw: true
            });
            const yoyRoas = parseFloat(yoyRoasResult?.avg_roas || 0);
            const yoyRoasChange = yoyRoas > 0 ? ((currentRoas - yoyRoas) / yoyRoas) * 100 : 0;


            // Trend (Last 6 Months) - Optimized to use AVG(ROAS) per month
            const trendStartDate = endDate.clone().subtract(6, 'month').startOf('month');
            const roasTrendResult = await RbPdpOlap.findAll({
                attributes: [
                    [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01'), 'month_date'],
                    [Sequelize.fn('AVG', Sequelize.col('ROAS')), 'avg_roas']
                ],
                where: {
                    DATE: { [Op.between]: [trendStartDate.toDate(), endDate.toDate()] },
                    ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                    ...(selectedPlatform && selectedPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase()) })
                },
                group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01')],
                raw: true
            });

            const roasTrendData = monthBuckets.map(bucket => {
                const match = roasTrendResult.find(d => dayjs(d.month_date).isSame(dayjs(bucket.date), 'month'));
                return match ? parseFloat(match.avg_roas || 0) : 0;
            });

            performanceMarketing.push({
                title: "ROAS",
                value: `${currentRoas.toFixed(2)}x`,
                mom: `${momRoasChange.toFixed(1)}%`,
                momUp: momRoasChange >= 0,
                yoy: `${yoyRoasChange.toFixed(1)}%`,
                yoyUp: yoyRoasChange >= 0,
                data: roasTrendData
            });

            // --- Conversion (CTR) ---
            // Formula: (Total Ad_Clicks / Total Ad_Impressions) * 100
            const getConversionMetrics = async (start, end) => {
                const where = {
                    DATE: { [Op.between]: [start.toDate(), end.toDate()] },
                    ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                    ...(selectedPlatform && selectedPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase()) })
                };
                const result = await RbPdpOlap.findOne({
                    attributes: [
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions']
                    ],
                    where,
                    raw: true
                });
                const clicks = parseFloat(result?.total_clicks || 0);
                const impressions = parseFloat(result?.total_impressions || 0);
                return impressions > 0 ? (clicks / impressions) * 100 : 0;
            };

            const currentConv = await getConversionMetrics(startDate, endDate);
            const momConv = await getConversionMetrics(momStartDate, momEndDate);
            const yoyConv = await getConversionMetrics(yoyStartDate, yoyEndDate);

            const momConvChange = momConv > 0 ? ((currentConv - momConv) / momConv) * 100 : 0;
            const yoyConvChange = yoyConv > 0 ? ((currentConv - yoyConv) / yoyConv) * 100 : 0;

            // Trend for Conversion
            const convTrendPromises = monthBuckets.map(async (bucket) => {
                const mStart = dayjs(bucket.date).startOf('month');
                const mEnd = dayjs(bucket.date).endOf('month');
                return await getConversionMetrics(mStart, mEnd);
            });
            const convTrendData = await Promise.all(convTrendPromises);

            performanceMarketing.push({
                title: "Conversion", // User requested label "Conversion" for CTR formula
                value: `${currentConv.toFixed(1)}%`,
                mom: `${momConvChange.toFixed(1)}%`,
                momUp: momConvChange >= 0,
                yoy: `${yoyConvChange.toFixed(1)}%`,
                yoyUp: yoyConvChange >= 0,
                data: convTrendData
            });


            // --- Inorganic Sales (Percentage) ---
            // Formula: (Total Sales - Total Ad_sales) / Total Sales * 100
            const getInorganicSalesMetrics = async (start, end) => {
                const where = {
                    DATE: { [Op.between]: [start.toDate(), end.toDate()] },
                    ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                    ...(selectedPlatform && selectedPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase()) })
                };
                const result = await RbPdpOlap.findOne({
                    attributes: [
                        [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales']
                    ],
                    where,
                    raw: true
                });
                const totalSales = parseFloat(result?.total_sales || 0);
                const totalAdSales = parseFloat(result?.total_ad_sales || 0);

                // Calculate Inorganic Sales Percentage
                if (totalSales > 0) {
                    return ((totalSales - totalAdSales) / totalSales) * 100;
                }
                return 0;
            };

            const currentInorg = await getInorganicSalesMetrics(startDate, endDate);
            const momInorg = await getInorganicSalesMetrics(momStartDate, momEndDate);
            const yoyInorg = await getInorganicSalesMetrics(yoyStartDate, yoyEndDate);

            const momInorgChange = momInorg > 0 ? ((currentInorg - momInorg) / momInorg) * 100 : 0;
            const yoyInorgChange = yoyInorg > 0 ? ((currentInorg - yoyInorg) / yoyInorg) * 100 : 0;

            // Trend for Inorganic Sales
            const inorgTrendPromises = monthBuckets.map(async (bucket) => {
                const mStart = dayjs(bucket.date).startOf('month');
                const mEnd = dayjs(bucket.date).endOf('month');
                return await getInorganicSalesMetrics(mStart, mEnd);
            });
            const inorgTrendData = await Promise.all(inorgTrendPromises);

            performanceMarketing.push({
                title: "Inorganic Sales",
                value: `${currentInorg.toFixed(1)}%`, // Formatted as percentage
                mom: `${momInorgChange.toFixed(1)}%`,
                momUp: momInorgChange >= 0,
                yoy: `${yoyInorgChange.toFixed(1)}%`,
                yoyUp: yoyInorgChange >= 0,
                data: inorgTrendData
            });

            // --- BMI/Sales Ratio ---
            // Formula: Total Sales / Total Ad_Spend
            const getBmiSalesRatio = async (start, end) => {
                const where = {
                    DATE: { [Op.between]: [start.toDate(), end.toDate()] },
                    ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                    ...(selectedPlatform && selectedPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), selectedPlatform.toLowerCase()) })
                };
                const result = await RbPdpOlap.findOne({
                    attributes: [
                        [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_ad_spend']
                    ],
                    where,
                    raw: true
                });
                const totalSales = parseFloat(result?.total_sales || 0);
                const totalAdSpend = parseFloat(result?.total_ad_spend || 0);

                // Calculate BMI/Sales Ratio: Sales / Ad_Spend
                if (totalAdSpend > 0) {
                    return totalSales / totalAdSpend;
                }
                return 0;
            };

            const currentBmiSales = await getBmiSalesRatio(startDate, endDate);
            const momBmiSales = await getBmiSalesRatio(momStartDate, momEndDate);
            const yoyBmiSales = await getBmiSalesRatio(yoyStartDate, yoyEndDate);

            const momBmiSalesChange = momBmiSales > 0 ? ((currentBmiSales - momBmiSales) / momBmiSales) * 100 : 0;
            const yoyBmiSalesChange = yoyBmiSales > 0 ? ((currentBmiSales - yoyBmiSales) / yoyBmiSales) * 100 : 0;

            // Trend for BMI/Sales Ratio
            const bmiSalesTrendPromises = monthBuckets.map(async (bucket) => {
                const mStart = dayjs(bucket.date).startOf('month');
                const mEnd = dayjs(bucket.date).endOf('month');
                return await getBmiSalesRatio(mStart, mEnd);
            });
            const bmiSalesTrendData = await Promise.all(bmiSalesTrendPromises);

            performanceMarketing.push({
                title: "BMI/Sales Ratio",
                value: currentBmiSales > 0 ? `${currentBmiSales.toFixed(2)}x` : '0.00x',
                mom: `${momBmiSalesChange.toFixed(1)}%`,
                momUp: momBmiSalesChange >= 0,
                yoy: `${yoyBmiSalesChange.toFixed(1)}%`,
                yoyUp: yoyBmiSalesChange >= 0,
                data: bmiSalesTrendData
            });

        } catch (err) {
            console.error("Error calculating Performance Marketing metrics:", err);
        }

        // 6. Month Overview Calculation
        // const monthOverview = []; // Removed sequential array
        const moPlatform = filters.monthOverviewPlatform || 'Blinkit';
        console.log("Calculating Month Overview for Platform:", moPlatform);

        // Generate columns helper for Month Overview (similar to generateColumns but for a single month row)
        // Generate columns helper for Month Overview (similar to generateColumns but for a single month row)
        const generateMonthColumns = (offtake, availability, sos, marketShare, spend = 0, roas = 0, inorgSales = 0, conversion = 0, cpm = 0, cpc = 0) => [
            { title: "Offtakes", value: formatCurrency(offtake), meta: { units: "", change: "▲0.0%" } },
            { title: "Spend", value: formatCurrency(spend), meta: { units: "", change: "▲0.0%" } },
            { title: "ROAS", value: `${roas.toFixed(2)}x`, meta: { units: "", change: "▲0.0%" } },
            { title: "Inorg Sales", value: formatCurrency(inorgSales), meta: { units: "", change: "▲0.0%" } },
            { title: "Conversion", value: `${conversion.toFixed(1)}%`, meta: { units: "", change: "▲0.0 pp" } },
            { title: "Availability", value: `${availability.toFixed(1)}%`, meta: { units: "", change: "▲0.0 pp" } },
            { title: "SOS", value: `${sos.toFixed(1)}%`, meta: { units: "", change: "▲0.0 pp" } },
            { title: "Market Share", value: `${marketShare.toFixed(1)}%`, meta: { units: "", change: "▲0.0 pp" } },
            { title: "Promo My Brand", value: "0%", meta: { units: "", change: "▲0.0 pp" } }, // Mock
            { title: "Promo Compete", value: "0%", meta: { units: "", change: "▲0.0 pp" } }, // Mock
            { title: "CPM", value: `₹${Math.round(cpm)}`, meta: { units: "", change: "▲0.0%" } },
            { title: "CPC", value: `₹${Math.round(cpc)}`, meta: { units: "", change: "▲0.0%" } }
        ];

        const monthOverviewPromises = monthBuckets.map(async (bucket) => {
            try {
                const mStart = dayjs(bucket.date).startOf('month');
                const mEnd = dayjs(bucket.date).endOf('month');

                // Offtake
                const moOfftakeWhere = {
                    DATE: { [Op.between]: [mStart.toDate(), mEnd.toDate()] },
                    Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), moPlatform.toLowerCase())
                };
                if (brand && brand !== 'All') moOfftakeWhere.Brand = { [Op.like]: `%${brand}%` };
                if (location && location !== 'All') moOfftakeWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
                if (category && category !== 'All') moOfftakeWhere.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase());

                const moOfftakeResult = await RbPdpOlap.findOne({
                    attributes: [
                        [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                        [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions']
                    ],
                    where: moOfftakeWhere,
                    raw: true
                });
                const moOfftake = parseFloat(moOfftakeResult?.total_sales || 0);
                const moSpend = parseFloat(moOfftakeResult?.total_spend || 0);
                const moAdSales = parseFloat(moOfftakeResult?.total_ad_sales || 0);
                const moClicks = parseFloat(moOfftakeResult?.total_clicks || 0);
                const moImpressions = parseFloat(moOfftakeResult?.total_impressions || 0);

                // Calculate Metrics
                const moRoas = moSpend > 0 ? moAdSales / moSpend : 0;
                const moConversion = moImpressions > 0 ? (moClicks / moImpressions) * 100 : 0;
                const moCpm = moImpressions > 0 ? (moSpend / moImpressions) * 1000 : 0;
                const moCpc = moClicks > 0 ? moSpend / moClicks : 0;

                // Availability
                const moAvailability = await getAvailability(mStart, mEnd, brand, moPlatform, location);

                // SOS
                const moSos = await getShareOfSearch(mStart, mEnd, brand, moPlatform, location, category);

                // Market Share
                let moMarketShare = 0;
                const moMsResult = await RbBrandMs.findOne({
                    attributes: [[Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                    where: {
                        created_on: { [Op.between]: [mStart.toDate(), mEnd.toDate()] },
                        Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), moPlatform.toLowerCase()),
                        ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                        ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
                    },
                    raw: true
                });
                moMarketShare = parseFloat(moMsResult?.avg_ms || 0);

                return {
                    key: bucket.label,
                    label: bucket.label, // e.g. "Nov"
                    date: bucket.date,   // Add date for frontend context
                    type: bucket.label,  // Reuse label as type for UI consistency
                    logo: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png", // Generic calendar icon
                    columns: generateMonthColumns(moOfftake, moAvailability, moSos, moMarketShare, moSpend, moRoas, moAdSales, moConversion, moCpm, moCpc)
                };

            } catch (err) {
                console.error(`Error calculating Month Overview for ${bucket.label}:`, err);
                return {
                    key: bucket.label,
                    label: bucket.label,
                    type: bucket.label,
                    logo: "",
                    columns: generateMonthColumns(0, 0, 0, 0)
                };
            }
        });

        const monthOverview = await Promise.all(monthOverviewPromises);
        // monthOverview.push(...monthOverviewResults); // Removed push to undefined variable

        // 13. Category Overview Logic
        const categoryOverviewPlatform = filters.categoryOverviewPlatform || filters.platform || 'Zepto';

        // Fetch unique categories based on filters from RcaSkuDim
        const categoryWhere = {};

        if (categoryOverviewPlatform && categoryOverviewPlatform !== 'All') {
            categoryWhere.platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform')), categoryOverviewPlatform.toLowerCase());
        }
        if (brand && brand !== 'All') {
            categoryWhere.brand_name = { [Op.like]: `%${brand}%` };
        }
        // Note: RcaSkuDim might not have location, or it might be 'location' column. 
        // Assuming location filter is not strictly needed for category listing, or we check if column exists.
        // Based on model, it has 'location'.
        if (location && location !== 'All') {
            categoryWhere.location = sequelize.where(sequelize.fn('LOWER', sequelize.col('location')), location.toLowerCase());
        }

        const distinctCategories = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_category')), 'brand_category']],
            where: categoryWhere,
            raw: true
        });

        const categories = distinctCategories.map(c => c.brand_category).filter(Boolean);
        console.log(`[Category Overview] Platform: ${categoryOverviewPlatform}, Found ${categories.length} categories:`, categories);

        const categoryOverviewPromises = categories.map(async (catName) => {
            try {
                // Filter for this specific category
                const catWhere = {
                    ...offtakeWhereClause, // Reuse date/brand/location filters
                    Category: catName, // Filter by Category in RbPdpOlap
                    Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), categoryOverviewPlatform.toLowerCase())
                };

                // Calculate Metrics for this Category
                const [
                    catOfftakeResult,
                    catAvailability,
                    catSos,
                    catMsResult,
                    catPromoMyBrandResult,
                    catPromoCompeteResult
                ] = await Promise.all([
                    // Offtake (Sales) & Ad Metrics
                    RbPdpOlap.findOne({
                        attributes: [
                            [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                            [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions']
                        ],
                        where: catWhere,
                        raw: true
                    }),
                    // Availability (OSA)
                    getAvailability(startDate, endDate, brand, categoryOverviewPlatform, location, catName),
                    // SOS
                    getShareOfSearch(startDate, endDate, brand, categoryOverviewPlatform, location, catName),
                    // Market Share
                    RbBrandMs.findOne({
                        attributes: [[Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                        where: {
                            created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                            Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), categoryOverviewPlatform.toLowerCase()),
                            ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                            category: sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), catName.toLowerCase())
                        },
                        raw: true
                    }),
                    // Promo My Brand (Comp_flag = 0)
                    RbPdpOlap.findOne({
                        attributes: [
                            [Sequelize.fn('AVG', Sequelize.literal('CASE WHEN MRP > 0 THEN (MRP - Selling_Price) / MRP ELSE 0 END')), 'avg_promo_depth']
                        ],
                        where: {
                            ...catWhere,
                            Comp_flag: 0
                        },
                        raw: true
                    }),
                    // Promo Compete (Comp_flag = 1)
                    RbPdpOlap.findOne({
                        attributes: [
                            [Sequelize.fn('AVG', Sequelize.literal('CASE WHEN MRP > 0 THEN (MRP - Selling_Price) / MRP ELSE 0 END')), 'avg_promo_depth']
                        ],
                        where: {
                            ...catWhere,
                            Comp_flag: 1
                        },
                        raw: true
                    })
                ]);

                const catOfftake = parseFloat(catOfftakeResult?.total_sales || 0);
                const catSpend = parseFloat(catOfftakeResult?.total_spend || 0);
                const catAdSales = parseFloat(catOfftakeResult?.total_ad_sales || 0); // Inorg Sales
                const catClicks = parseFloat(catOfftakeResult?.total_clicks || 0);
                const catImpressions = parseFloat(catOfftakeResult?.total_ad_impressions || 0);
                const catMarketShare = parseFloat(catMsResult?.avg_ms || 0);
                const catPromoMyBrand = parseFloat(catPromoMyBrandResult?.avg_promo_depth || 0) * 100;
                const catPromoCompete = parseFloat(catPromoCompeteResult?.avg_promo_depth || 0) * 100;

                // Calculate Metrics
                const catRoas = catSpend > 0 ? catAdSales / catSpend : 0;
                const catConversion = catImpressions > 0 ? (catClicks / catImpressions) * 100 : 0;
                const catCpm = catImpressions > 0 ? (catSpend / catImpressions) * 1000 : 0;
                const catCpc = catClicks > 0 ? catSpend / catClicks : 0;

                return {
                    key: catName,
                    label: catName,
                    type: catName,
                    logo: "https://cdn-icons-png.flaticon.com/512/3502/3502685.png",
                    columns: [
                        {
                            title: "Offtakes",
                            value: formatCurrency(catOfftake),
                            change: { text: "▲0.0%", positive: true }, // Placeholder for change
                            meta: { units: "units", change: "▲0.0%" }
                        },
                        {
                            title: "Spend",
                            value: formatCurrency(catSpend),
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "currency", change: "▲0.0%" }
                        },
                        {
                            title: "ROAS",
                            value: `${catRoas.toFixed(1)}x`,
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "return", change: "▲0.0%" }
                        },
                        {
                            title: "Inorg Sales",
                            value: formatCurrency(catAdSales),
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "units", change: "▲0.0%" }
                        },
                        {
                            title: "Conversion",
                            value: `${catConversion.toFixed(1)}%`,
                            change: { text: "▲0.0 pp", positive: true },
                            meta: { units: "conversions", change: "▲0.0 pp" }
                        },
                        {
                            title: "Availability",
                            value: `${catAvailability.toFixed(1)}%`,
                            change: { text: "▲0.0 pp", positive: true },
                            meta: { units: "stores", change: "▲0.0 pp" }
                        },
                        {
                            title: "SOS",
                            value: `${catSos.toFixed(1)}%`,
                            change: { text: "▲0.0 pp", positive: true },
                            meta: { units: "index", change: "▲0.0 pp" }
                        },
                        {
                            title: "Market Share",
                            value: `${catMarketShare.toFixed(1)}%`,
                            change: { text: "▲0.0 pp", positive: true },
                            meta: { units: "share", change: "▲0.0 pp" }
                        },
                        {
                            title: "Promo My Brand",
                            value: `${catPromoMyBrand.toFixed(1)}%`,
                            change: { text: "▲0.0 pp", positive: true },
                            meta: { units: "depth", change: "▲0.0 pp" }
                        },
                        {
                            title: "Promo Compete",
                            value: `${catPromoCompete.toFixed(1)}%`,
                            change: { text: "▲0.0 pp", positive: true },
                            meta: { units: "depth", change: "▲0.0 pp" }
                        },
                        {
                            title: "CPM",
                            value: formatCurrency(catCpm),
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "impressions", change: "▲0.0%" }
                        },
                        {
                            title: "CPC",
                            value: formatCurrency(catCpc),
                            change: { text: "▲0.0%", positive: true },
                            meta: { units: "clicks", change: "▲0.0%" }
                        }
                    ]
                };

            } catch (err) {
                console.error(`Error calculating Category Overview for ${catName}:`, err);
                return {
                    key: catName,
                    label: catName,
                    type: "Category",
                    logo: "",
                    columns: generateMonthColumns(0, 0, 0, 0)
                };
            }
        });

        const categoryOverview = await Promise.all(categoryOverviewPromises);

        // 14. Brands Overview Logic
        const brandsOverviewPlatform = filters.brandsOverviewPlatform || filters.platform || 'All';
        const brandsOverviewCategory = filters.brandsOverviewCategory || filters.category || 'All';

        // Define Where Clauses
        const boBrandWhere = {};
        if (brandsOverviewPlatform && brandsOverviewPlatform !== 'All') boBrandWhere.platform = brandsOverviewPlatform;
        if (brandsOverviewCategory && brandsOverviewCategory !== 'All') boBrandWhere.brand_category = brandsOverviewCategory;
        if (location && location !== 'All') boBrandWhere.location = location;

        const boOfftakeWhere = {
            DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), brandsOverviewPlatform.toLowerCase()) }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { Category: sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), brandsOverviewCategory.toLowerCase()) }),
            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
        };

        const boPrevStartDate = startDate.clone().subtract(1, 'month');
        const boPrevEndDate = endDate.clone().subtract(1, 'month');

        const boPrevOfftakeWhere = {
            DATE: { [Op.between]: [boPrevStartDate.toDate(), boPrevEndDate.toDate()] },
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), brandsOverviewPlatform.toLowerCase()) }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { Category: sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), brandsOverviewCategory.toLowerCase()) }),
            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
        };

        const boSosWhere = {
            kw_crawl_date: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), brandsOverviewPlatform.toLowerCase()) }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { keyword_category: sequelize.where(sequelize.fn('LOWER', sequelize.col('keyword_category')), brandsOverviewCategory.toLowerCase()) }),
            ...(location && location !== 'All' && { location_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase()) })
        };

        const boPrevSosWhere = {
            kw_crawl_date: { [Op.between]: [boPrevStartDate.toDate(), boPrevEndDate.toDate()] },
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), brandsOverviewPlatform.toLowerCase()) }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { keyword_category: brandsOverviewCategory }),
            ...(location && location !== 'All' && { location_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase()) })
        };

        const boMsWhere = {
            created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), brandsOverviewPlatform.toLowerCase()) }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { category: sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), brandsOverviewCategory.toLowerCase()) }),
            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
        };

        const boPrevMsWhere = {
            created_on: { [Op.between]: [boPrevStartDate.toDate(), boPrevEndDate.toDate()] },
            ...(brandsOverviewPlatform && brandsOverviewPlatform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), brandsOverviewPlatform.toLowerCase()) }),
            ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { category: brandsOverviewCategory }),
            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
        };

        const rcaBrandWhere = {};
        if (brandsOverviewPlatform && brandsOverviewPlatform !== 'All') {
            rcaBrandWhere.platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform')), brandsOverviewPlatform.toLowerCase());
        }
        if (brandsOverviewCategory && brandsOverviewCategory !== 'All') {
            rcaBrandWhere.brand_category = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_category')), brandsOverviewCategory.toLowerCase());
        }



        // 1. Offtake Current (Conditional Logic)
        let boOfftakePromise;
        const lowerPlatform = (brandsOverviewPlatform || '').toLowerCase();

        if (lowerPlatform === 'zepto') {
            const zeptoWhere = {
                sales_date: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { sku_category: sequelize.where(sequelize.fn('LOWER', sequelize.col('sku_category')), brandsOverviewCategory.toLowerCase()) }),
                ...(location && location !== 'All' && { city: sequelize.where(sequelize.fn('LOWER', sequelize.col('city')), location.toLowerCase()) })
            };
            // Use rb_pdp_olap Sales column for Zepto (same as other platforms)
            boOfftakePromise = RbPdpOlap.findAll({
                attributes: [
                    'Brand',
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Orders')), 'total_ad_orders'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_ad_clicks'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_ad_impressions'],
                    [Sequelize.fn('AVG', Sequelize.col('Discount')), 'avg_discount'],
                    [Sequelize.fn('AVG', Sequelize.col('ROAS')), 'avg_roas'],
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: {
                    DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                    Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), lowerPlatform),
                    ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
                    ...(brandsOverviewCategory && brandsOverviewCategory !== 'All' && { Category: sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), brandsOverviewCategory.toLowerCase()) })
                },
                group: ['Brand'],
                raw: true
            });
        } else if (lowerPlatform === 'blinkit') {
            const blinkitWhere = {
                created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                // Removed category filter due to mismatch with RcaSkuDim categories
                ...(location && location !== 'All' && { city_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('city_name')), location.toLowerCase()) })
            };
            boOfftakePromise = TbBlinkitSalesData.findAll({
                attributes: [
                    [Sequelize.literal("SUBSTRING_INDEX(item_name, ' ', 1)"), 'Brand'], // Extract Brand proxy from item_name? Or use manufacturer_name? Using manufacturer_name is safer if available.
                    // Actually, let's check if we can use manufacturer_name or if we need to extract.
                    // Model has manufacturer_name. Let's use that as Brand for now.
                    // [Sequelize.col('manufacturer_name'), 'Brand'], 
                    // Wait, user wants "Brand" columns. manufacturer_name might be "Godrej Consumer Products Ltd".
                    // Let's stick to existing pattern if possible. 
                    // But for now, let's use manufacturer_name as 'Brand' alias.
                    ['manufacturer_name', 'Brand'],
                    [Sequelize.fn('SUM', Sequelize.literal('CAST(qty_sold AS DECIMAL(10,2)) * CAST(mrp AS DECIMAL(10,2))')), 'total_sales'],
                    [Sequelize.literal('0'), 'total_spend'],
                    [Sequelize.literal('0'), 'total_ad_sales'],
                    [Sequelize.literal('0'), 'total_ad_orders'],
                    [Sequelize.literal('0'), 'total_ad_clicks'],
                    [Sequelize.literal('0'), 'total_ad_impressions'],
                    [Sequelize.literal('0'), 'avg_discount'],
                    [Sequelize.literal('0'), 'avg_roas'],
                    [Sequelize.literal('0'), 'total_neno'],
                    [Sequelize.literal('0'), 'total_deno']
                ],
                where: blinkitWhere,
                group: ['manufacturer_name'],
                raw: true
            });
        } else {
            // Fallback to RbPdpOlap for 'All' or other platforms
            boOfftakePromise = RbPdpOlap.findAll({
                attributes: [
                    'Brand',
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Orders')), 'total_ad_orders'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_ad_clicks'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_ad_impressions'],
                    [Sequelize.fn('AVG', Sequelize.col('Discount')), 'avg_discount'],
                    [Sequelize.fn('AVG', Sequelize.col('ROAS')), 'avg_roas'],
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: boOfftakeWhere,
                group: ['Brand'],
                raw: true
            });
        }

        const [
            boOfftakeData,
            boPrevOfftakeData,
            boSosBrandCounts,
            boSosSponsoredCounts,
            boSosDenominator,
            boPrevSosBrandCounts,
            boPrevSosSponsoredCounts,
            boPrevSosDenominator,
            boMsData,
            boPrevMsData,
            rcaBrandsData
        ] = await Promise.all([
            // 1. Offtake Current
            boOfftakePromise,
            // 2. Offtake Previous
            RbPdpOlap.findAll({
                attributes: [
                    'Brand',
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Orders')), 'total_ad_orders'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_ad_clicks'],
                    [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_ad_impressions'],
                    [Sequelize.fn('AVG', Sequelize.col('Discount')), 'avg_discount'],
                    [Sequelize.fn('AVG', Sequelize.col('ROAS')), 'avg_roas'],
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: boPrevOfftakeWhere,
                group: ['Brand'],
                raw: true
            }),
            // 3. SOS Current
            RbKw.findAll({
                attributes: ['brand_name', [Sequelize.fn('COUNT', Sequelize.col('kw_data_id')), 'count']],
                where: boSosWhere,
                group: ['brand_name'],
                raw: true
            }),
            RbKw.findAll({
                attributes: ['brand_name', [Sequelize.fn('COUNT', Sequelize.col('kw_data_id')), 'count']],
                where: { ...boSosWhere, spons_flag: 1 },
                group: ['brand_name'],
                raw: true
            }),
            RbKw.count({ where: boSosWhere }),
            // 4. SOS Previous
            RbKw.findAll({
                attributes: ['brand_name', [Sequelize.fn('COUNT', Sequelize.col('kw_data_id')), 'count']],
                where: boPrevSosWhere,
                group: ['brand_name'],
                raw: true
            }),
            RbKw.findAll({
                attributes: ['brand_name', [Sequelize.fn('COUNT', Sequelize.col('kw_data_id')), 'count']],
                where: { ...boPrevSosWhere, spons_flag: 1 },
                group: ['brand_name'],
                raw: true
            }),
            RbKw.count({ where: boPrevSosWhere }),
            // 5. Market Share Current
            RbBrandMs.findAll({
                attributes: ['brand', [Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                where: boMsWhere,
                group: ['brand'],
                raw: true
            }),
            // 6. Market Share Previous
            RbBrandMs.findAll({
                attributes: ['brand', [Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                where: boPrevMsWhere,
                group: ['brand'],
                raw: true
            }),
            // 7. Brand List
            RcaSkuDim.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
                where: rcaBrandWhere,
                raw: true
            })
        ]);



        // Optimization: Create Maps for O(1) Access
        const toMap = (arr) => new Map(arr.map(i => [(i.Brand || i.brand_name || i.brand || '').toLowerCase(), i]));

        const boOfftakeMap = toMap(boOfftakeData);
        const boPrevOfftakeMap = toMap(boPrevOfftakeData);
        const boSosBrandMap = toMap(boSosBrandCounts);
        const boSosSponsoredMap = toMap(boSosSponsoredCounts);
        const boPrevSosBrandMap = toMap(boPrevSosBrandCounts);
        const boPrevSosSponsoredMap = toMap(boPrevSosSponsoredCounts);
        const boMsMap = toMap(boMsData);
        const boPrevMsMap = toMap(boPrevMsData);

        const findMetric = (map, brandName, key) => {
            const lowerBrand = brandName.toLowerCase();
            let item = map.get(lowerBrand);

            // Fuzzy Match if exact match fails
            if (!item) {
                for (const [mapKey, mapValue] of map.entries()) {
                    if (mapKey.includes(lowerBrand) || lowerBrand.includes(mapKey)) {
                        item = mapValue;
                        break; // Take first match
                    }
                }
            }

            return item ? parseFloat(item[key] || 0) : 0;
        };

        const calcTrend = (curr, prev) => {
            if (prev > 0) return ((curr - prev) / prev) * 100;
            if (curr > 0) return 100;
            return 0;
        };

        const calcTrendPp = (curr, prev) => curr - prev;

        const boBrands = rcaBrandsData.map(d => d.brand_name).filter(Boolean);

        // Pre-calculate totals for Promo Compete (Avg Discount of ALL brands)
        const totalDiscountSum = boOfftakeData.reduce((sum, d) => sum + parseFloat(d.avg_discount || 0), 0);
        const totalDiscountCount = boOfftakeData.length;

        const prevTotalDiscountSum = boPrevOfftakeData.reduce((sum, d) => sum + parseFloat(d.avg_discount || 0), 0);
        const prevTotalDiscountCount = boPrevOfftakeData.length;


        const brandsOverview = boBrands.map(brandName => {
            // Offtake
            const currSales = findMetric(boOfftakeMap, brandName, 'total_sales');
            const prevSales = findMetric(boPrevOfftakeMap, brandName, 'total_sales');
            const salesTrend = calcTrend(currSales, prevSales);

            // Spend
            const currSpend = findMetric(boOfftakeMap, brandName, 'total_spend');
            const prevSpend = findMetric(boPrevOfftakeMap, brandName, 'total_spend');
            const spendTrend = calcTrend(currSpend, prevSpend);

            // ROAS
            const currAdSales = findMetric(boOfftakeMap, brandName, 'total_ad_sales');
            const prevAdSales = findMetric(boPrevOfftakeMap, brandName, 'total_ad_sales');
            const currRoas = currSpend > 0 ? currAdSales / currSpend : 0;
            const prevRoas = prevSpend > 0 ? prevAdSales / prevSpend : 0;
            const roasTrend = calcTrend(currRoas, prevRoas);

            // Inorg Sales
            const inorgSalesTrend = calcTrend(currAdSales, prevAdSales);

            // Conversion
            const currOrders = findMetric(boOfftakeMap, brandName, 'total_ad_orders');
            const prevOrders = findMetric(boPrevOfftakeMap, brandName, 'total_ad_orders');
            const currClicks = findMetric(boOfftakeMap, brandName, 'total_ad_clicks');
            const prevClicks = findMetric(boPrevOfftakeMap, brandName, 'total_ad_clicks');
            const currConv = currClicks > 0 ? (currOrders / currClicks) * 100 : 0;
            const prevConv = prevClicks > 0 ? (prevOrders / prevClicks) * 100 : 0;
            const convTrend = calcTrendPp(currConv, prevConv);

            // Availability
            const currNeno = findMetric(boOfftakeMap, brandName, 'total_neno');
            const prevNeno = findMetric(boPrevOfftakeMap, brandName, 'total_neno');
            const currDeno = findMetric(boOfftakeMap, brandName, 'total_deno');
            const prevDeno = findMetric(boPrevOfftakeMap, brandName, 'total_deno');
            const currAvail = currDeno > 0 ? (currNeno / currDeno) * 100 : 0;
            const prevAvail = prevDeno > 0 ? (prevNeno / prevDeno) * 100 : 0;
            const availTrend = calcTrendPp(currAvail, prevAvail);

            // SOS
            const currSosCount = findMetric(boSosBrandMap, brandName, 'count');
            const currSosSpons = findMetric(boSosSponsoredMap, brandName, 'count');
            const currSos = boSosDenominator > 0 ? ((currSosCount - currSosSpons) / boSosDenominator) * 100 : 0;

            const prevSosCount = findMetric(boPrevSosBrandMap, brandName, 'count');
            const prevSosSpons = findMetric(boPrevSosSponsoredMap, brandName, 'count');
            const prevSos = boPrevSosDenominator > 0 ? ((prevSosCount - prevSosSpons) / boPrevSosDenominator) * 100 : 0;
            const sosTrend = calcTrendPp(currSos, prevSos);

            // Market Share
            const currMs = findMetric(boMsMap, brandName, 'avg_ms');
            const prevMs = findMetric(boPrevMsMap, brandName, 'avg_ms');
            const msTrend = calcTrendPp(currMs, prevMs);

            // Promo My Brand
            const currDisc = findMetric(boOfftakeMap, brandName, 'avg_discount');
            const prevDisc = findMetric(boPrevOfftakeMap, brandName, 'avg_discount');
            const discTrend = calcTrendPp(currDisc, prevDisc);

            // Promo Compete (Avg Discount of ALL OTHER brands)
            let otherBrandsAvgDisc = 0;
            if (totalDiscountCount > 1) {
                const myDisc = boOfftakeMap.has(brandName.toLowerCase()) ? parseFloat(boOfftakeMap.get(brandName.toLowerCase()).avg_discount || 0) : 0;
                const isPresent = boOfftakeMap.has(brandName.toLowerCase());
                const otherSum = isPresent ? totalDiscountSum - myDisc : totalDiscountSum;
                const otherCount = isPresent ? totalDiscountCount - 1 : totalDiscountCount;
                otherBrandsAvgDisc = otherCount > 0 ? otherSum / otherCount : 0;
            }

            let prevOtherBrandsAvgDisc = 0;
            if (prevTotalDiscountCount > 1) {
                const myPrevDisc = boPrevOfftakeMap.has(brandName.toLowerCase()) ? parseFloat(boPrevOfftakeMap.get(brandName.toLowerCase()).avg_discount || 0) : 0;
                const isPresent = boPrevOfftakeMap.has(brandName.toLowerCase());
                const otherSum = isPresent ? prevTotalDiscountSum - myPrevDisc : prevTotalDiscountSum;
                const otherCount = isPresent ? prevTotalDiscountCount - 1 : prevTotalDiscountCount;
                prevOtherBrandsAvgDisc = otherCount > 0 ? otherSum / otherCount : 0;
            }

            const promoCompeteTrend = calcTrendPp(otherBrandsAvgDisc, prevOtherBrandsAvgDisc);

            // CPM
            const currImp = findMetric(boOfftakeMap, brandName, 'total_ad_impressions');
            const prevImp = findMetric(boPrevOfftakeMap, brandName, 'total_ad_impressions');
            const currCpm = currImp > 0 ? (currSpend / currImp) * 1000 : 0;
            const prevCpm = prevImp > 0 ? (prevSpend / prevImp) * 1000 : 0;
            const cpmTrend = calcTrend(currCpm, prevCpm);

            // CPC
            const currCpc = currClicks > 0 ? currSpend / currClicks : 0;
            const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;
            const cpcTrend = calcTrend(currCpc, prevCpc);

            // Transform to match PlatformOverview structure
            return {
                key: brandName.toLowerCase().replace(/\s+/g, '_'),
                label: brandName,
                type: "Brand",
                columns: [
                    { title: "Offtakes", value: formatCurrency(currSales), meta: { units: `${(currSales / 100000).toFixed(2)} L`, change: `${salesTrend >= 0 ? '▲' : '▼'}${Math.abs(salesTrend).toFixed(1)}%` } },
                    { title: "Spend", value: formatCurrency(currSpend), meta: { units: formatCurrency(currSpend), change: `${spendTrend >= 0 ? '▲' : '▼'}${Math.abs(spendTrend).toFixed(1)}%` } },
                    { title: "ROAS", value: `${currRoas.toFixed(1)}x`, meta: { units: `${formatCurrency(currAdSales)}`, change: `${roasTrend >= 0 ? '▲' : '▼'}${Math.abs(roasTrend).toFixed(1)}%` } },
                    { title: "Inorg Sales", value: formatCurrency(currAdSales), meta: { units: `${(currAdSales / 100000).toFixed(2)} L`, change: `${inorgSalesTrend >= 0 ? '▲' : '▼'}${Math.abs(inorgSalesTrend).toFixed(1)}%` } },
                    { title: "Conversion", value: `${currConv.toFixed(1)}%`, meta: { units: `${(currOrders / 1000).toFixed(1)}k`, change: `${convTrend >= 0 ? '▲' : '▼'}${Math.abs(convTrend).toFixed(1)} pp` } },
                    { title: "Availability", value: `${currAvail.toFixed(1)}%`, meta: { units: `${currDeno}`, change: `${availTrend >= 0 ? '▲' : '▼'}${Math.abs(availTrend).toFixed(1)} pp` } },
                    { title: "SOS", value: `${currSos.toFixed(1)}%`, meta: { units: `${currSos.toFixed(1)}`, change: `${sosTrend >= 0 ? '▲' : '▼'}${Math.abs(sosTrend).toFixed(1)} pp` } },
                    { title: "Market Share", value: `${currMs.toFixed(1)}%`, meta: { units: formatCurrency(currSales * (100 / currMs) || 0), change: `${msTrend >= 0 ? '▲' : '▼'}${Math.abs(msTrend).toFixed(1)} pp` } },
                    { title: "Promo My Brand", value: `${currDisc.toFixed(1)}%`, meta: { units: `${currDisc.toFixed(1)}%`, change: `${discTrend >= 0 ? '▲' : '▼'}${Math.abs(discTrend).toFixed(1)} pp` } },
                    { title: "Promo Compete", value: `${otherBrandsAvgDisc.toFixed(1)}%`, meta: { units: `${otherBrandsAvgDisc.toFixed(1)}%`, change: `${promoCompeteTrend >= 0 ? '▲' : '▼'}${Math.abs(promoCompeteTrend).toFixed(1)} pp` } },
                    { title: "CPM", value: formatCurrency(currCpm), meta: { units: formatCurrency(currCpm), change: `${cpmTrend >= 0 ? '▲' : '▼'}${Math.abs(cpmTrend).toFixed(1)}%` } },
                    { title: "CPC", value: formatCurrency(currCpc), meta: { units: formatCurrency(currCpc), change: `${cpcTrend >= 0 ? '▲' : '▼'}${Math.abs(cpcTrend).toFixed(1)}%` } }
                ]
            };
        });

        console.log(`[Watch Tower Service] Returning categoryOverview with ${categoryOverview?.length || 0} items`);
        return {
            topMetrics,
            summaryMetrics,
            skuTable: skuTableData,
            platformOverview,
            performanceMarketing,
            monthOverview,
            categoryOverview,
            brandsOverview
        };

    } catch (error) {
        console.error("Error in watchTowerService:", error);
        throw error;
    }
};

const getPlatforms = async () => {
    try {
        const platforms = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('platform')), 'platform']],
            raw: true
        });
        return platforms.map(p => p.platform).filter(Boolean).sort();
    } catch (error) {
        console.error("Error fetching platforms:", error);
        throw error;
    }
};

// Exported function with caching layer
const getSummaryMetrics = async (filters) => {
    // Generate cache key from filters
    const cacheKey = generateCacheKey('summary', filters);

    // Get from cache or compute
    return await getCachedOrCompute(cacheKey, async () => {
        return await computeSummaryMetrics(filters);
    }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800')); // 30 minutes default TTL
};

const getBrands = async (platform) => {
    try {
        const where = {};
        if (platform && platform !== 'All') {
            where.platform = platform;
        }

        const result = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            where: where,
            order: [['brand_name', 'ASC']],
            raw: true
        });
        return result.map(b => b.brand_name).filter(Boolean);
    } catch (error) {
        console.error("Error fetching brands:", error);
        throw error;
    }
};

const getKeywords = async (brand) => {
    try {
        const where = {};
        if (brand) {
            where.brand_name = brand;
        }

        const keywords = await RbKw.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('keyword')), 'keyword']],
            where: where,
            raw: true
        });
        return keywords.map(k => k.keyword).filter(Boolean).sort();
    } catch (error) {
        console.error("Error fetching keywords:", error);
        throw error;
    }
};

const getLocations = async (platform, brand) => {
    try {
        const where = {};
        if (platform && platform !== 'All') {
            where.platform = platform;
        }
        if (brand && brand !== 'All') {
            where.brand_name = brand;
        }

        const result = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('location')), 'location']],
            where: where,
            order: [['location', 'ASC']],
            raw: true
        });
        return result.map(l => l.location).filter(Boolean);
    } catch (error) {
        console.error("Error fetching locations:", error);
        throw error;
    }
};

/**
 * Generate time buckets based on start/end date and time step
 */
const generateTimeBuckets = (startDate, endDate, timeStep) => {
    const buckets = [];
    let current = startDate.clone();

    // Remove strict startOf alignment to respect user's "today to 1M back" request
    // But we still need to align Daily to start of day
    current = current.startOf('day');

    const end = endDate.clone().endOf('day');

    while (current.isBefore(end) || current.isSame(end, 'day')) {
        let label;
        let groupKey;

        if (timeStep === 'Monthly') {
            // Label: DD MMM YY to show exact date (e.g., 08 Nov 25)
            label = current.format('DD MMM YY');
            groupKey = current.format('YYYY-MM-01'); // Matches DB DATE_FORMAT (Calendar Month)
            current = current.add(1, 'month');
        } else if (timeStep === 'Weekly') {
            label = current.format('DD MMM');
            // Matches DB YEARWEEK mode 1
            const year = current.year();
            const week = current.isoWeek();
            groupKey = year * 100 + week;
            current = current.add(1, 'week');
        } else { // Daily
            label = current.format('DD MMM');
            groupKey = current.format('YYYY-MM-DD'); // Matches DB DATE
            current = current.add(1, 'day');
        }

        buckets.push({
            label,
            groupKey,
            date: current.clone().subtract(1, timeStep === 'Daily' ? 'day' : timeStep === 'Weekly' ? 'week' : 'month').toDate()
        });
    }

    // Ensure the last bucket covers the endDate
    // If the loop finished but the last bucket's interval doesn't include endDate, add one more.
    // Actually, we can check if the last bucket's groupKey matches the endDate's groupKey.
    // If not, we add the endDate's bucket.

    if (buckets.length > 0) {
        const lastBucket = buckets[buckets.length - 1];
        let endGroupKey;
        let endLabel;

        if (timeStep === 'Monthly') {
            endGroupKey = endDate.format('YYYY-MM-01');
            endLabel = endDate.format('DD MMM YY');
        } else if (timeStep === 'Weekly') {
            const year = endDate.year();
            const week = endDate.isoWeek();
            endGroupKey = year * 100 + week;
            endLabel = endDate.format('DD MMM');
        } else {
            endGroupKey = endDate.format('YYYY-MM-DD');
            endLabel = endDate.format('DD MMM');
        }

        // If the last bucket is NOT the same group as the end date, add the end date bucket
        if (String(lastBucket.groupKey) !== String(endGroupKey)) {
            buckets.push({
                label: endLabel,
                groupKey: endGroupKey,
                date: endDate.toDate()
            });
        }
    }

    return buckets;
};
// Internal implementation with all the compute logic
const computeTrendData = async (filters) => {
    try {
        const { brand, location, platform, period, timeStep, category, startDate: customStart, endDate: customEnd } = filters;

        // 1. Determine Date Range
        let endDate = dayjs();
        let startDate = dayjs();

        if (period === 'Custom' && customStart && customEnd) {
            startDate = dayjs(customStart);
            endDate = dayjs(customEnd);
        } else {
            switch (period) {
                case '1M': startDate = startDate.subtract(1, 'month'); break;
                case '3M': startDate = startDate.subtract(3, 'month'); break;
                case '6M': startDate = startDate.subtract(6, 'month'); break;
                case '1Y': startDate = startDate.subtract(1, 'year'); break;
                default: startDate = startDate.subtract(3, 'month'); // Default 3M
            }
        }

        console.log(`computeTrendData: period=${period}, start=${startDate.format()}, end=${endDate.format()}`);

        // 2. Determine Grouping
        let groupCol;
        let groupColMs; // For RbBrandMs
        let groupColKw; // For RbKw
        let dateFormat;

        if (timeStep === 'Monthly') {
            groupCol = sequelize.fn('DATE_FORMAT', sequelize.col('DATE'), '%Y-%m-01');
            groupColMs = sequelize.fn('DATE_FORMAT', sequelize.col('created_on'), '%Y-%m-01');
            groupColKw = sequelize.fn('DATE_FORMAT', sequelize.col('kw_crawl_date'), '%Y-%m-01');
            dateFormat = 'MMM YY';
        } else if (timeStep === 'Weekly') {
            // MySQL YEARWEEK mode 1 (Monday first)
            groupCol = sequelize.fn('YEARWEEK', sequelize.col('DATE'), 1);
            groupColMs = sequelize.fn('YEARWEEK', sequelize.col('created_on'), 1);
            groupColKw = sequelize.fn('YEARWEEK', sequelize.col('kw_crawl_date'), 1);
            dateFormat = 'Week';
        } else { // Daily
            // Use simple column reference for Daily grouping as verified by debug script
            groupCol = sequelize.col('DATE');
            groupColMs = sequelize.col('created_on');
            groupColKw = sequelize.col('kw_crawl_date');
            dateFormat = 'DD MMM';
        }

        // 3. Query Data - Offtake, OSA, Discount
        const whereClause = {
            DATE: {
                [Op.between]: [
                    sequelize.literal(`'${startDate.format('YYYY-MM-DD')}'`),
                    sequelize.literal(`'${endDate.format('YYYY-MM-DD')}'`)
                ]
            },
            ...(category && { Category: category }),
            ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
            ...(platform && platform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase()) })
        };

        const trendResults = await RbPdpOlap.findAll({
            attributes: [
                [groupCol, 'date_group'],
                [sequelize.fn('MAX', sequelize.col('DATE')), 'ref_date'], // To help formatting
                [sequelize.fn('SUM', sequelize.col('Sales')), 'offtake'],
                [sequelize.fn('SUM', sequelize.col('neno_osa')), 'total_neno'],
                [sequelize.fn('SUM', sequelize.col('deno_osa')), 'total_deno'],
                // Calculate Discount components only for valid MRP rows
                [sequelize.fn('SUM', sequelize.literal('CASE WHEN CAST(REPLACE(MRP, ",", "") AS DECIMAL(10,2)) > 0 THEN Sales ELSE 0 END')), 'sales_with_mrp'],
                [sequelize.fn('SUM', sequelize.literal('CASE WHEN CAST(REPLACE(MRP, ",", "") AS DECIMAL(10,2)) > 0 THEN CAST(REPLACE(MRP, ",", "") AS DECIMAL(10,2)) * Qty_Sold ELSE 0 END')), 'mrp_sales_valid']
            ],
            where: whereClause,
            group: [groupCol],
            order: [[sequelize.col('ref_date'), 'ASC']],
            raw: true
        });

        // 4. Query Market Share (Est. Category Share)
        const msWhereClause = {
            created_on: {
                [Op.between]: [
                    sequelize.literal(`'${startDate.format('YYYY-MM-DD')}'`),
                    sequelize.literal(`'${endDate.format('YYYY-MM-DD')}'`)
                ]
            },
            ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
            ...(category && { category: category }),
            ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
            ...(platform && platform !== 'All' && { Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase()) })
        };

        const msResults = await RbBrandMs.findAll({
            attributes: [
                [groupColMs, 'date_group'],
                [sequelize.fn('AVG', sequelize.col('market_share')), 'avg_ms']
            ],
            where: msWhereClause,
            group: [groupColMs],
            raw: true
        });

        // 5. Query Share of Search (SOV)
        // Numerator: Brand matches + Not Sponsored
        const sosNumWhere = {
            kw_crawl_date: {
                [Op.between]: [
                    sequelize.literal(`'${startDate.format('YYYY-MM-DD')}'`),
                    sequelize.literal(`'${endDate.format('YYYY-MM-DD')}'`)
                ]
            },
            spons_flag: { [Op.ne]: 1 },
            ...(category && { keyword_category: category }),
            ...(brand && brand !== 'All' && { brand_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), brand.toLowerCase()) }),
            ...(location && location !== 'All' && { location_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase()) }),
            ...(platform && platform !== 'All' && { platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), platform.toLowerCase()) })
        };

        const sosNumerator = await RbKw.findAll({
            attributes: [
                [groupColKw, 'date_group'],
                [sequelize.fn('COUNT', sequelize.col('keyword')), 'count']
            ],
            where: sosNumWhere,
            group: [groupColKw],
            raw: true
        });

        // Denominator: All Brands (No Brand Filter) + Not Sponsored
        const sosDenomWhere = {
            kw_crawl_date: {
                [Op.between]: [
                    sequelize.literal(`'${startDate.format('YYYY-MM-DD')}'`),
                    sequelize.literal(`'${endDate.format('YYYY-MM-DD')}'`)
                ]
            },
            spons_flag: { [Op.ne]: 1 },
            ...(category && { keyword_category: category }),
            ...(location && location !== 'All' && { location_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), location.toLowerCase()) }),
            ...(platform && platform !== 'All' && { platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), platform.toLowerCase()) })
        };

        const sosDenominator = await RbKw.findAll({
            attributes: [
                [groupColKw, 'date_group'],
                [sequelize.fn('COUNT', sequelize.col('keyword')), 'count']
            ],
            where: sosDenomWhere,
            group: [groupColKw],
            raw: true
        });


        // 6. Merge and Format Data
        const buckets = generateTimeBuckets(startDate, endDate, timeStep);

        const timeSeries = buckets.map(bucket => {
            // Find matching data in results
            // We need to match bucket.groupKey with row.date_group
            // For Weekly: bucket.groupKey is int (202548), row.date_group is int
            // For Monthly: bucket.groupKey is string (2025-11-01), row.date_group is string
            // For Daily: bucket.groupKey is string (2025-11-25), row.date_group is string

            const row = trendResults.find(r => String(r.date_group) === String(bucket.groupKey)) || {};

            // OSA
            const neno = parseFloat(row.total_neno || 0);
            const deno = parseFloat(row.total_deno || 0);
            const osa = deno > 0 ? (neno / deno) * 100 : 0;

            // Discount
            const salesWithMrp = parseFloat(row.sales_with_mrp || 0);
            const mrpSalesValid = parseFloat(row.mrp_sales_valid || 0);
            let discount = 0;
            if (mrpSalesValid > 0) {
                discount = (1 - (salesWithMrp / mrpSalesValid)) * 100;
            }
            discount = Math.max(0, Math.min(100, discount));

            // Market Share
            const msMatch = msResults.find(m => String(m.date_group) === String(bucket.groupKey));
            const categoryShare = parseFloat(msMatch?.avg_ms || 0);

            // SOV
            const sosNum = sosNumerator.find(s => String(s.date_group) === String(bucket.groupKey));
            const sosDen = sosDenominator.find(s => String(s.date_group) === String(bucket.groupKey));
            const numCount = parseInt(sosNum?.count || 0, 10);
            const denCount = parseInt(sosDen?.count || 0, 10);
            const sov = denCount > 0 ? (numCount / denCount) * 100 : 0;

            return {
                date: bucket.label,
                offtake: parseFloat(row.offtake || 0),
                osa: parseFloat(osa.toFixed(1)),
                categoryShare: parseFloat(categoryShare.toFixed(1)),
                discount: parseFloat(discount.toFixed(1)),
                sov: parseFloat(sov.toFixed(1))
            };
        });

        // If timeStep is Monthly, we might want to ensure all months in range are present?
        // But for now, returning what we have is fine.

        return {
            timeSeries,
            metrics: {
                offtake: true,
                estCategoryShare: true,
                osa: true,
                discount: true,
                overallSOV: true
            }
        };

    } catch (error) {
        console.error("Error in computeTrendData:", error);
        throw error;
    }
};

// Exported function with caching layer
const getTrendData = async (filters) => {
    // Generate cache key from filters
    const cacheKey = generateCacheKey('trend', filters);

    // Get from cache or compute
    return await getCachedOrCompute(cacheKey, async () => {
        return await computeTrendData(filters);
    }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800')); // 30 minutes default TTL
};

const getBrandCategories = async (platform) => {
    try {
        const where = {};
        if (platform && platform !== 'All') {
            where.platform = platform;
        }

        const result = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_category')), 'brand_category']],
            where: where,
            order: [['brand_category', 'ASC']],
            raw: true
        });
        return result.map(c => c.brand_category).filter(Boolean);
    } catch (error) {
        console.error("Error fetching brand categories:", error);
        throw error;
    }
};

/**
 * Optimized Summary Metrics with parallel section-wise cachi ng
 * Fetches all sections (platformOverview, monthOverview, categoryOverview, brandsOverview) in parallel
 * Each section is cached independently for better performance
 */
const getSummaryMetricsOptimized = async (filters) => {
    try {
        console.log('[Optimized] Fetching all sections in parallel with filters:', filters);

        // Prepare all filter combinations for different sections
        const baseFilters = { ...filters };

        // Create specific filter sets for each section
        const monthFilters = { ...baseFilters, monthOverviewPlatform: filters.monthOverviewPlatform || filters.platform || 'Blinkit' };
        const categoryFilters = { ...baseFilters, categoryOverviewPlatform: filters.categoryOverviewPlatform || filters.platform || 'Zepto' };
        const brandsFilters = {
            ...baseFilters,
            brandsOverviewPlatform: filters.brandsOverviewPlatform || filters.platform || 'Zepto',
            brandsOverviewCategory: filters.brandsOverviewCategory || 'All'
        };

        // Generate cache keys for each section
        const mainCacheKey = generateCacheKey('main', baseFilters);
        const monthCacheKey = generateCacheKey('month_overview', monthFilters);
        const categoryCacheKey = generateCacheKey('category_overview', categoryFilters);
        const brandsCacheKey = generateCacheKey('brands_overview', brandsFilters);

        console.log('[Optimized] Cache keys generated:', {
            main: mainCacheKey,
            month: monthCacheKey,
            category: categoryCacheKey,
            brands: brandsCacheKey
        });

        // Fetch all sections in parallel with individual caching
        const [mainData, monthOverviewExtra, categoryOverviewExtra, brandsOverviewExtra] = await Promise.all([
            // Main data (topMetrics, platformOverview, performanceMarketing, skuTable)
            getCachedOrCompute(mainCacheKey, async () => {
                console.log('[Optimized] Computing main data...');
                const result = await computeSummaryMetrics(baseFilters);
                return {
                    topMetrics: result.topMetrics,
                    summaryMetrics: result.summaryMetrics,
                    skuTable: result.skuTable,
                    platformOverview: result.platformOverview,
                    performanceMarketing: result.performanceMarketing
                };
            }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800')),

            // Month Overview (conditional on monthOverviewPlatform)
            getCachedOrCompute(monthCacheKey, async () => {
                console.log('[Optimized] Computing month overview...');
                const result = await computeSummaryMetrics(monthFilters);
                return result.monthOverview;
            }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800')),

            // Category Overview (conditional on categoryOverviewPlatform)
            getCachedOrCompute(categoryCacheKey, async () => {
                console.log('[Optimized] Computing category overview...');
                const result = await computeSummaryMetrics(categoryFilters);
                return result.categoryOverview;
            }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800')),

            // Brands Overview (conditional on brandsOverviewPlatform and brandsOverviewCategory)
            getCachedOrCompute(brandsCacheKey, async () => {
                console.log('[Optimized] Computing brands overview...');
                const result = await computeSummaryMetrics(brandsFilters);
                return result.brandsOverview;
            }, parseInt(process.env.REDIS_DEFAULT_TTL || '1800'))
        ]);

        console.log('[Optimized] All sections fetched successfully');
        console.log('[Optimized] Sections available:', {
            topMetrics: !!mainData.topMetrics,
            platformOverview: !!mainData.platformOverview,
            performanceMarketing: !!mainData.performanceMarketing,
            monthOverview: !!monthOverviewExtra,
            categoryOverview: !!categoryOverviewExtra,
            brandsOverview: !!brandsOverviewExtra
        });

        // Combine all data
        return {
            ...mainData,
            monthOverview: monthOverviewExtra,
            categoryOverview: categoryOverviewExtra,
            brandsOverview: brandsOverviewExtra
        };
    } catch (error) {
        console.error('[Optimized] Error fetching summary metrics:', error);
        throw error;
    }
};



export default {
    getSummaryMetrics,
    getSummaryMetricsOptimized,
    getBrands,
    getKeywords,
    getLocations,
    getPlatforms,
    getTrendData,
    getBrandCategories
};
