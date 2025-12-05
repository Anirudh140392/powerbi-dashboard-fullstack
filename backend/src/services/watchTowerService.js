import TbZeptoBrandSalesAnalytics from '../models/TbZeptoBrandSalesAnalytics.js';
import TbZeptoInventoryData from '../models/TbZeptoInventoryData.js';
import TbBlinkitSalesData from '../models/TbBlinkitSalesData.js';
import RbPdpOlap from '../models/RbPdpOlap.js';
import RbKw from '../models/RbKw.js';
import ZeptoMarketShare from '../models/ZeptoMarketShare.js';
import RcaSkuDim from '../models/RcaSkuDim.js';
import { Op, Sequelize } from 'sequelize';
import sequelize from '../config/db.js';
import dayjs from 'dayjs';

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
            offtakeWhereClause.Platform = selectedPlatform;
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
            if (platformFilter && platformFilter !== 'All') where.Platform = platformFilter;
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
            shareOfSearchTrendData
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
            // 2. Total Market Share & Chart Data (Keep ZeptoMarketShare for now as requested only Offtake/Availability change)
            ZeptoMarketShare.findAll({
                attributes: [
                    [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01'), 'month_date'],
                    [Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_market_share']
                ],
                where: {
                    created_on: {
                        [Op.between]: [startDate.toDate(), endDate.toDate()]
                    },
                    ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
                },
                group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01')],
                raw: true
            }),
            // Total Market Share Average
            ZeptoMarketShare.findOne({
                attributes: [
                    [Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_market_share']
                ],
                where: {
                    created_on: {
                        [Op.between]: [startDate.toDate(), endDate.toDate()]
                    },
                    ...(brand && brand !== 'All' && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                    ...(location && location !== 'All' && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
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
            })()
        ]);

        // Process Offtake Data
        const offtakeChart = monthBuckets.map(bucket => {
            const match = offtakeData.find(d => {
                return dayjs(d.month_date).isSame(dayjs(bucket.date), 'month');
            });
            return match ? parseFloat(match.total_sales) / 10000000 : 0; // Convert to Cr
        });

        // Helper for currency formatting
        const formatCurrency = (value) => {
            const val = parseFloat(value);
            if (isNaN(val)) return "0";

            if (val >= 1000000000) {
                return (val / 1000000000).toFixed(2) + " B";
            } else if (val >= 10000000) {
                return (val / 10000000).toFixed(2) + " Cr";
            } else if (val >= 1000000) {
                return (val / 1000000).toFixed(2) + " M";
            } else if (val >= 1000) {
                return (val / 1000).toFixed(2) + " K";
            } else {
                return val.toFixed(0);
            }
        };

        const totalOfftake = offtakeData.reduce((sum, d) => sum + parseFloat(d.total_sales), 0);
        const formattedOfftake = formatCurrency(totalOfftake);

        // Process Market Share Data
        const marketShareChart = monthBuckets.map(bucket => {
            const match = marketShareData.find(d => dayjs(d.month_date).isSame(dayjs(bucket.date), 'month'));
            return match ? parseFloat(match.avg_market_share) : 0;
        });

        const totalMarketShare = totalMarketShareResult?.avg_market_share || 0;
        const formattedMarketShare = parseFloat(totalMarketShare).toFixed(1) + "%";

        // Process Availability Data
        const formattedAvailability = currentAvailability.toFixed(1) + "%";

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
            offtakesTrend: "+0.0%", // Placeholder
            shareOfSearch: formattedShareOfSearch,
            shareOfSearchTrend: "0%",
            stockAvailability: formattedAvailability,
            stockAvailabilityTrend: "0%",
            marketShare: formattedMarketShare,
        };

        // Prepare Top Metrics Array (Cards with Charts)
        const chartLabels = monthBuckets.map(b => b.label);

        const topMetrics = [
            {
                name: "Offtake",
                label: formattedOfftake,
                subtitle: `last ${monthsBack} months`,
                trend: "0%",
                trendType: "neutral",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: offtakeChart,
                labels: chartLabels
            },
            {
                name: "Availability",
                label: formattedAvailability,
                subtitle: `last ${monthsBack} months`,
                trend: "0%",
                trendType: "neutral",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: availabilityChart,
                labels: chartLabels
            },
            {
                name: "Share of Search",
                label: formattedShareOfSearch,
                subtitle: `last ${monthsBack} months`,
                trend: "0%",
                trendType: "neutral",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: shareOfSearchChart,
                labels: chartLabels
            },
            {
                name: "Market Share",
                label: formattedMarketShare,
                subtitle: `last ${monthsBack} months`,
                trend: "0%",
                trendType: "neutral",
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
        let allOfftake = 0;
        let allAvailabilitySum = 0;
        let allAvailabilityCount = 0;
        let allSosSum = 0;
        let allSosCount = 0;

        // Helper to generate columns structure
        const generateColumns = (offtake, availability, sos) => [
            { title: "Offtakes", value: `₹${(offtake / 10000000).toFixed(2)} Cr`, change: { text: "0%", positive: true }, meta: { units: "units", change: "0%" } },
            { title: "Spend", value: "₹0 Cr", change: { text: "0%", positive: true }, meta: { units: "₹0", change: "0%" } },
            { title: "ROAS", value: "0x", change: { text: "0%", positive: true }, meta: { units: "₹0 return", change: "0%" } },
            { title: "Inorg Sales", value: "₹0 Cr", change: { text: "0%", positive: true }, meta: { units: "0 units", change: "0%" } },
            { title: "Conversion", value: "0%", change: { text: "0 pp", positive: true }, meta: { units: "0 conversions", change: "0 pp" } },
            { title: "Availability", value: `${availability.toFixed(1)}%`, change: { text: "0 pp", positive: true }, meta: { units: "stores", change: "0 pp" } },
            { title: "SOS", value: `${sos.toFixed(1)}%`, change: { text: "0 pp", positive: true }, meta: { units: "index", change: "0 pp" } },
            { title: "Market Share", value: "0%", change: { text: "0 pp", positive: true }, meta: { units: "Category", change: "0 pp" } },
            { title: "Promo My Brand", value: "0%", change: { text: "0 pp", positive: true }, meta: { units: "Depth", change: "0 pp" } },
            { title: "Promo Compete", value: "0%", change: { text: "0 pp", positive: true }, meta: { units: "Depth", change: "0 pp" } },
            { title: "CPM", value: "₹0", change: { text: "0%", positive: true }, meta: { units: "impressions", change: "0%" } },
            { title: "CPC", value: "₹0", change: { text: "0%", positive: true }, meta: { units: "clicks", change: "0%" } },
        ];

        for (const p of platformDefinitions) {
            try {
                let offtake = 0;

                // Calculate Offtake (Unified using RbPdpOlap)
                const platformOfftakeWhere = {
                    DATE: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
                    Platform: p.label
                };
                if (brand) platformOfftakeWhere.Brand = { [Op.like]: `%${brand}%` };
                if (location) platformOfftakeWhere.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());

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

                // Accumulate
                allOfftake += offtake;
                if (availability > 0) {
                    allAvailabilitySum += availability;
                    allAvailabilityCount++;
                }
                if (sos > 0) {
                    allSosSum += sos;
                    allSosCount++;
                }

                platformOverview.push({
                    key: p.key,
                    label: p.label,
                    type: p.type,
                    logo: p.logo,
                    columns: generateColumns(offtake, availability, sos)
                });
            } catch (err) {
                console.error(`Error processing platform ${p.key}:`, err);
                // Push error state or skip
                platformOverview.push({
                    key: p.key,
                    label: p.label,
                    type: p.type,
                    logo: p.logo,
                    columns: generateColumns(0, 0, 0) // Fallback
                });
            }
        }

        // Add "All" platform
        const allAvailability = allAvailabilityCount > 0 ? allAvailabilitySum / allAvailabilityCount : 0;
        const allSos = allSosCount > 0 ? allSosSum / allSosCount : 0;

        platformOverview.unshift({
            key: 'all',
            label: 'All',
            type: 'Overall',
            logo: "https://cdn-icons-png.flaticon.com/512/711/711284.png",
            columns: generateColumns(allOfftake, allAvailability, allSos)
        });

        return {
            topMetrics,
            summaryMetrics,
            skuTable: skuTableData,
            platformOverview
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

export default {
    getSummaryMetrics,
    getBrands,
    getKeywords,
    getLocations,
    getPlatforms
};
