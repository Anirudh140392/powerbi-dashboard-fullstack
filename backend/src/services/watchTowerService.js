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

const getSummaryMetrics = async (filters) => {
    try {
        console.log("Processing Watch Tower request with filters:", filters);

        const { months = 1, startDate: qStartDate, endDate: qEndDate, brand: rawBrand, location: rawLocation } = filters;
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
        const getAvailability = async (start, end, brandFilter, platformFilter, locationFilter) => {
            const where = {
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
        const getShareOfSearch = async (start, end, brandFilter, platformFilter, locationFilter) => {
            try {
                // Common where clause
                const baseWhere = {
                    kw_crawl_date: {
                        [Op.between]: [start.toDate(), end.toDate()]
                    }
                };

                if (locationFilter) {
                    baseWhere.location_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('location_name')), locationFilter.toLowerCase());
                }

                if (platformFilter && platformFilter !== 'All') {
                    baseWhere.platform_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), platformFilter.toLowerCase());
                }

                // Numerator: Filtered rows (brand + other filters) excluding sponsored
                const numeratorWhere = { ...baseWhere };
                if (brandFilter) {
                    numeratorWhere.brand_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), brandFilter.toLowerCase());
                }
                // Exclude sponsored (spons_flag = 1)
                numeratorWhere.spons_flag = { [Op.ne]: 1 };

                const numeratorCount = await RbKw.count({ where: numeratorWhere });

                // Denominator: Total rows for all brands (ignoring brand filter)
                const denominatorWhere = { ...baseWhere };

                const denominatorCount = await RbKw.count({ where: denominatorWhere });

                return denominatorCount > 0 ? (numeratorCount / denominatorCount) * 100 : 0;
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
            // 1. Total Offtake (Sales) & Chart Data (Using RbPdpOlap for ALL)
            RbPdpOlap.findAll({
                attributes: [
                    [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01'), 'month_date'],
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']
                ],
                where: offtakeWhereClause,
                group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01')],
                raw: true
            }),
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
            // 3. Top SKUs by GMV (Using RbPdpOlap for ALL)
            RbPdpOlap.findAll({
                attributes: [
                    ['Product', 'sku_name'],
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'sku_gmv']
                ],
                where: offtakeWhereClause,
                group: ['Product'],
                order: [[Sequelize.literal('sku_gmv'), 'DESC']],
                limit: 10,
                raw: true
            }),
            // 4. Current Availability
            getAvailability(startDate, endDate, brand, selectedPlatform, location),
            // 5. Previous Availability (if compare dates exist)
            (filters.compareStartDate && filters.compareEndDate)
                ? getAvailability(dayjs(filters.compareStartDate), dayjs(filters.compareEndDate), brand, selectedPlatform, location)
                : Promise.resolve(0),
            // 6. Current Share of Search
            getShareOfSearch(startDate, endDate, brand, selectedPlatform, location),
            // 7. Previous Share of Search
            (filters.compareStartDate && filters.compareEndDate)
                ? getShareOfSearch(dayjs(filters.compareStartDate), dayjs(filters.compareEndDate), brand, selectedPlatform, location)
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
                const trendBuckets = [];
                // We need to loop through buckets because doing a single GroupBy query for SOS 
                // with complex numerator/denominator logic in one go is tricky in Sequelize without raw SQL.
                // To be safe and accurate, we'll iterate over the month buckets.
                for (const bucket of monthBuckets) {
                    const mStart = dayjs(bucket.date).startOf('month');
                    const mEnd = dayjs(bucket.date).endOf('month');
                    const val = await getShareOfSearch(mStart, mEnd, brand, selectedPlatform, location);
                    trendBuckets.push({ month_date: bucket.date, value: val });
                }
                return trendBuckets;
            })(),
            // 10. Previous Offtake (Total Sales)
            (filters.compareStartDate && filters.compareEndDate)
                ? RbPdpOlap.sum('Sales', {
                    where: {
                        DATE: { [Op.between]: [dayjs(filters.compareStartDate).toDate(), dayjs(filters.compareEndDate).toDate()] },
                        ...(brand && brand !== 'All' && { Brand: { [Op.like]: `%${brand}%` } }),
                        ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) }),
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
        const generateColumns = (offtake, availability, sos, marketShare = 0) => [
            { title: "Offtakes", value: formatCurrency(offtake), change: { text: "0%", positive: true }, meta: { units: "units", change: "0%" } },
            { title: "Spend", value: "₹0 Cr", change: { text: "0%", positive: true }, meta: { units: "₹0", change: "0%" } },
            { title: "ROAS", value: "0x", change: { text: "0%", positive: true }, meta: { units: "₹0 return", change: "0%" } },
            { title: "Inorg Sales", value: "₹0 Cr", change: { text: "0%", positive: true }, meta: { units: "0 units", change: "0%" } },
            { title: "Conversion", value: "0%", change: { text: "0 pp", positive: true }, meta: { units: "0 conversions", change: "0 pp" } },
            { title: "Availability", value: `${availability.toFixed(1)}%`, change: { text: "0 pp", positive: true }, meta: { units: "stores", change: "0 pp" } },
            { title: "SOS", value: `${sos.toFixed(1)}%`, change: { text: "0 pp", positive: true }, meta: { units: "index", change: "0 pp" } },
            { title: "Market Share", value: `${(parseFloat(marketShare) || 0).toFixed(1)}%`, change: { text: "0 pp", positive: true }, meta: { units: "Category", change: "0 pp" } },
            { title: "Promo My Brand", value: "0%", change: { text: "0 pp", positive: true }, meta: { units: "Depth", change: "0 pp" } },
            { title: "Promo Compete", value: "0%", change: { text: "0 pp", positive: true }, meta: { units: "Depth", change: "0 pp" } },
            { title: "CPM", value: "₹0", change: { text: "0%", positive: true }, meta: { units: "impressions", change: "0%" } },
            { title: "CPC", value: "₹0", change: { text: "0%", positive: true }, meta: { units: "clicks", change: "0%" } },
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
            // Intentionally NOT filtering by Platform here to get the "All Platforms" total

            const allOfftakeResult = await RbPdpOlap.findOne({
                attributes: [[Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']],
                where: allOfftakeWhere,
                raw: true
            });
            allOfftake = parseFloat(allOfftakeResult?.total_sales || 0);

            // 2. All Availability
            allAvailability = await getAvailability(startDate, endDate, brand, null, location); // Pass null for platform to get aggregate

            // 3. All SOS
            allSos = await getShareOfSearch(startDate, endDate, brand, null, location); // Pass null for platform

            // 4. All Market Share
            const allMsResult = await RbBrandMs.findOne({
                attributes: [[Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                where: {
                    created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                    ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
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
            columns: generateColumns(allOfftake, allAvailability, allSos, allMarketShare)
        });

        for (const p of platformDefinitions) {
            try {
                let offtake = 0;

                // Calculate Offtake (Unified using RbPdpOlap)
                const platformOfftakeWhere = {
                    DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                    Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), p.label.toLowerCase())
                };
                if (brand && brand !== 'All') platformOfftakeWhere.Brand = { [Op.like]: `%${brand}%` };
                if (location && location !== 'All') platformOfftakeWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());

                const platformOfftakeResult = await RbPdpOlap.findOne({
                    attributes: [[Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']],
                    where: platformOfftakeWhere,
                    raw: true
                });
                offtake = parseFloat(platformOfftakeResult?.total_sales || 0);

                // Calculate Availability
                let availability = await getAvailability(startDate, endDate, brand, p.label, location);

                // Calculate Share of Search
                let sos = await getShareOfSearch(startDate, endDate, brand, p.label, location);

                // Calculate Market Share
                let marketShare = 0;
                const msResult = await RbBrandMs.findOne({
                    attributes: [[Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
                    where: {
                        created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                        Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), p.label.toLowerCase()),
                        ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                        ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
                    },
                    raw: true
                });
                marketShare = parseFloat(msResult?.avg_ms || 0);

                platformOverview.push({
                    key: p.key,
                    label: p.label,
                    type: p.type,
                    logo: p.logo,
                    columns: generateColumns(offtake, availability, sos, marketShare)
                });
            } catch (err) {
                console.error(`Error processing platform ${p.key}:`, err);
                // Push error state or skip
                platformOverview.push({
                    key: p.key,
                    label: p.label,
                    type: p.type,
                    logo: p.logo,
                    columns: generateColumns(0, 0, 0, 0) // Fallback
                });
            }
        }

        // 5. Performance Marketing Metrics (SOS Focus)
        const performanceMarketing = [];

        try {
            // Current SOS
            const currentSosVal = currentShareOfSearch || 0;

            // MoM SOS
            const momStartDate = startDate.clone().subtract(1, 'month');
            const momEndDate = endDate.clone().subtract(1, 'month');
            const momSos = await getShareOfSearch(momStartDate, momEndDate, brand, selectedPlatform, location);
            const momChange = momSos > 0 ? ((currentSosVal - momSos) / momSos) * 100 : 0;

            // YoY SOS
            const yoyStartDate = startDate.clone().subtract(1, 'year');
            const yoyEndDate = endDate.clone().subtract(1, 'year');
            const yoySos = await getShareOfSearch(yoyStartDate, yoyEndDate, brand, selectedPlatform, location);
            const yoyChange = yoySos > 0 ? ((currentSosVal - yoySos) / yoySos) * 100 : 0;

            // Trend (Last 6 Months ending at endDate)
            const sosTrendData = [];
            for (let i = 6; i >= 0; i--) {
                const mStart = endDate.clone().subtract(i, 'month').startOf('month');
                const mEnd = endDate.clone().subtract(i, 'month').endOf('month');
                const val = await getShareOfSearch(mStart, mEnd, brand, selectedPlatform, location);
                sosTrendData.push(val);
            }

            performanceMarketing.push({
                title: "Share of Search",
                value: `${currentSosVal.toFixed(1)}%`,
                mom: `${momChange.toFixed(1)}%`,
                momUp: momChange >= 0,
                yoy: `${yoyChange.toFixed(1)}%`,
                yoyUp: yoyChange >= 0,
                data: sosTrendData
            });

        } catch (err) {
            console.error("Error calculating Performance Marketing metrics:", err);
        }

        // 6. Month Overview Calculation
        // const monthOverview = []; // Removed sequential array
        const moPlatform = filters.monthOverviewPlatform || 'Blinkit';
        console.log("Calculating Month Overview for Platform:", moPlatform);

        // Generate columns helper for Month Overview (similar to generateColumns but for a single month row)
        const generateMonthColumns = (offtake, availability, sos, marketShare) => [
            { title: "Offtakes", value: formatCurrency(offtake), meta: { units: "", change: "▲0.0%" } },
            { title: "Spend", value: "₹0", meta: { units: "", change: "▲0.0%" } }, // Mock
            { title: "ROAS", value: "0x", meta: { units: "", change: "▲0.0%" } }, // Mock
            { title: "Inorg Sales", value: "₹0", meta: { units: "", change: "▲0.0%" } }, // Mock
            { title: "Conversion", value: "0%", meta: { units: "", change: "▲0.0 pp" } }, // Mock
            { title: "Availability", value: `${availability.toFixed(1)}%`, meta: { units: "", change: "▲0.0 pp" } },
            { title: "SOS", value: `${sos.toFixed(1)}%`, meta: { units: "", change: "▲0.0 pp" } },
            { title: "Market Share", value: `${marketShare.toFixed(1)}%`, meta: { units: "", change: "▲0.0 pp" } },
            { title: "Promo My Brand", value: "0%", meta: { units: "", change: "▲0.0 pp" } }, // Mock
            { title: "Promo Compete", value: "0%", meta: { units: "", change: "▲0.0 pp" } }, // Mock
            { title: "CPM", value: "₹0", meta: { units: "", change: "▲0.0%" } }, // Mock
            { title: "CPC", value: "₹0", meta: { units: "", change: "▲0.0%" } }  // Mock
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

                const moOfftakeResult = await RbPdpOlap.findOne({
                    attributes: [[Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']],
                    where: moOfftakeWhere,
                    raw: true
                });
                const moOfftake = parseFloat(moOfftakeResult?.total_sales || 0);

                // Availability
                const moAvailability = await getAvailability(mStart, mEnd, brand, moPlatform, location);

                // SOS
                const moSos = await getShareOfSearch(mStart, mEnd, brand, moPlatform, location);

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
                    type: bucket.label,  // Reuse label as type for UI consistency
                    logo: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png", // Generic calendar icon
                    columns: generateMonthColumns(moOfftake, moAvailability, moSos, moMarketShare)
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

        return {
            topMetrics,
            summaryMetrics,
            skuTable: skuTableData,
            platformOverview,
            performanceMarketing,
            monthOverview // Add this
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
const getTrendData = async (filters) => {
    try {
        const { brand, location, platform, period, timeStep, startDate: customStart, endDate: customEnd } = filters;

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

        console.log(`getTrendData: period=${period}, start=${startDate.format()}, end=${endDate.format()}`);

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
        console.error("Error in getTrendData:", error);
        throw error;
    }
};

export default {
    getSummaryMetrics,
    getBrands,
    getKeywords,
    getLocations,
    getPlatforms,
    getTrendData
};
