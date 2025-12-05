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
        console.log("Processing Watch Tower request for Zepto with filters:", filters);

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

        // Build Where Clause for TbZeptoBrandSalesAnalytics
        const whereClause = {
            sales_date: {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
            }
        };

        if (brand) {
            whereClause.brand_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), brand.toLowerCase());
        }
        if (location) {
            whereClause.city = sequelize.where(sequelize.fn('LOWER', sequelize.col('city')), location.toLowerCase());
        }

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

        // Build Where Clause for RbPdpOlap
        const offtakeWhereClause = {
            DATE: {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
            }
        };

        if (brand) {
            offtakeWhereClause.Brand = sequelize.where(sequelize.fn('LOWER', sequelize.col('Brand')), brand.toLowerCase());
        }
        if (location) {
            offtakeWhereClause.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase());
        }

        // Default to Zepto if no platform is selected, or use the selected platform
        const selectedPlatform = filters.platform || 'Zepto';
        offtakeWhereClause.Platform = selectedPlatform;

        // 3. Availability Calculation Helper
        const getAvailability = async (start, end, brandFilter, platformFilter, locationFilter) => {
            // If Zepto, use TbZeptoInventoryData
            if (!platformFilter || platformFilter === 'Zepto') {
                const where = {
                    created_on: {
                        [Op.between]: [start.toDate(), end.toDate()]
                    }
                };
                if (brandFilter) {
                    where.brand_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), brandFilter.toLowerCase());
                }
                if (locationFilter) {
                    where.city = sequelize.where(sequelize.fn('LOWER', sequelize.col('city')), locationFilter.toLowerCase());
                }

                const result = await TbZeptoInventoryData.findOne({
                    attributes: [
                        [Sequelize.fn('COUNT', Sequelize.col('id')), 'total_count'],
                        [Sequelize.literal("SUM(CASE WHEN unit > 0 THEN 1 ELSE 0 END)"), 'available_count']
                    ],
                    where: where,
                    raw: true
                });

                const totalCount = parseFloat(result?.total_count || 0);
                const availableCount = parseFloat(result?.available_count || 0);

                return totalCount > 0 ? (availableCount / totalCount) * 100 : 0;
            }

            // Fallback to RbPdpOlap for other platforms
            const where = {
                DATE: {
                    [Op.between]: [start.toDate(), end.toDate()]
                }
            };
            // Use LIKE for brand to handle sub-brands (e.g. Godrej -> Godrej No.1)
            if (brandFilter) {
                where.Brand = {
                    [Op.like]: `%${brandFilter}%`
                };
            }
            if (platformFilter) where.Platform = platformFilter;
            if (locationFilter) where.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), locationFilter.toLowerCase());

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

                // Map platform names if necessary. RbKw might use different names.
                // Assuming direct match for now or simple mapping.
                if (platformFilter) {
                    // Adjust platform name matching if needed based on RbKw data
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
                // The user said "total count of rows for all brands", which implies we should NOT filter by brand here.
                // But we should still respect location/platform/time filters.
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
            prevShareOfSearch
        ] = await Promise.all([
            // 1. Total Offtake (Sales) & Chart Data
            (selectedPlatform === 'Zepto') ?
                TbZeptoBrandSalesAnalytics.findAll({
                    attributes: [
                        [Sequelize.fn('DATE_FORMAT', Sequelize.col('sales_date'), '%Y-%m-01'), 'month_date'],
                        [Sequelize.fn('SUM', Sequelize.col('gmv')), 'total_sales']
                    ],
                    where: whereClause,
                    group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('sales_date'), '%Y-%m-01')],
                    raw: true
                }) :
                RbPdpOlap.findAll({
                    attributes: [
                        [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01'), 'month_date'],
                        [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']
                    ],
                    where: offtakeWhereClause,
                    group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01')],
                    raw: true
                }),
            // 2. Total Market Share & Chart Data
            ZeptoMarketShare.findAll({
                attributes: [
                    [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01'), 'month_date'],
                    [Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_market_share']
                ],
                where: {
                    created_on: {
                        [Op.between]: [startDate.toDate(), endDate.toDate()]
                    },
                    ...(brand && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                    ...(location && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
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
                    ...(brand && { brand: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand')), brand.toLowerCase()) }),
                    ...(location && { Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), location.toLowerCase()) })
                },
                raw: true
            }),
            // 3. Top SKUs by GMV
            TbZeptoBrandSalesAnalytics.findAll({
                attributes: [
                    'sku_name',
                    [Sequelize.fn('SUM', Sequelize.col('gmv')), 'sku_gmv']
                ],
                where: whereClause,
                group: ['sku_name'],
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
                : Promise.resolve(0)
        ]);

        // Process Offtake Data
        const offtakeChart = monthBuckets.map(bucket => {
            const match = offtakeData.find(d => dayjs(d.month_date).isSame(dayjs(bucket.date), 'month'));
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

        // Calculate Previous Availability for Trend
        let availabilityTrend = "0%";
        let availabilityTrendType = "neutral";

        if (filters.compareStartDate && filters.compareEndDate) {
            const diff = currentAvailability - prevAvailability;
            const sign = diff >= 0 ? "+" : "";
            availabilityTrend = `${sign}${diff.toFixed(1)}%`;
            availabilityTrendType = diff >= 0 ? "up" : "down";
        }

        // Process Share of Search Data
        const formattedShareOfSearch = currentShareOfSearch.toFixed(1) + "%";
        let shareOfSearchTrend = "0%";
        let shareOfSearchTrendType = "neutral";

        if (filters.compareStartDate && filters.compareEndDate) {
            const diff = currentShareOfSearch - prevShareOfSearch;
            const sign = diff >= 0 ? "+" : "";
            shareOfSearchTrend = `${sign}${diff.toFixed(1)}%`;
            shareOfSearchTrendType = diff >= 0 ? "up" : "down";
        }

        // Map SKUs to frontend format
        const skuTableData = topSkus.map(sku => ({
            sku: sku.sku_name,
            all: { offtake: `₹${formatCurrency(sku.sku_gmv)}`, trend: "0%" }, // Mock trend for now
            blinkit: { offtake: "NA", trend: "NA" },
            zepto: { offtake: `₹${formatCurrency(sku.sku_gmv)}`, trend: "0%" },
            instamart: { offtake: "NA", trend: "NA" }
        }));

        // Construct Response
        const summaryMetrics = {
            offtakes: `₹${formattedOfftake}`,
            offtakesTrend: "+0.0%", // Placeholder
            shareOfSearch: formattedShareOfSearch,
            shareOfSearchTrend: shareOfSearchTrend,
            stockAvailability: formattedAvailability,
            stockAvailabilityTrend: availabilityTrend,
            marketShare: formattedMarketShare,
        };

        const topMetrics = [
            {
                name: "Offtake",
                label: `₹${formattedOfftake}`,
                subtitle: `last ${monthsBack} months`,
                trend: "+0.0%",
                trendType: "neutral",
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: offtakeChart,
            },
            {
                name: "Availability",
                label: formattedAvailability,
                subtitle: "MTD Coverage",
                trend: availabilityTrend,
                trendType: availabilityTrendType,
                comparison: "vs Previous Period",
                units: "",
                unitsTrend: "",
                chart: [],
            },
            {
                name: "Share of Search",
                label: formattedShareOfSearch,
                subtitle: "for MTD",
                trend: shareOfSearchTrend,
                trendType: shareOfSearchTrendType,
                comparison: "vs Previous Month",
                units: "",
                unitsTrend: "",
                chart: [],
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

                // Calculate Offtake
                if (p.key === 'zepto') {
                    // Use TbZeptoBrandSalesAnalytics
                    const zeptoWhere = {
                        sales_date: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
                    };
                    if (brand) zeptoWhere.brand_name = { [Op.like]: `%${brand}%` };
                    if (location) zeptoWhere.city = { [Op.like]: `%${location}%` };

                    const zeptoResult = await TbZeptoBrandSalesAnalytics.sum('gmv', { where: zeptoWhere });
                    offtake = zeptoResult || 0;

                } else if (p.key === 'blinkit') {
                    // Use TbBlinkitSalesData
                    const blinkitWhere = {
                        created_on: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
                    };
                    // Use item_name for brand matching on Blinkit as it lacks brand_name column
                    if (brand) blinkitWhere.item_name = { [Op.like]: `%${brand}%` };
                    if (location) blinkitWhere.city_name = { [Op.like]: `%${location}%` };

                    // Calculate GMV = qty_sold * mrp
                    const blinkitResult = await TbBlinkitSalesData.findOne({
                        attributes: [
                            [Sequelize.literal('SUM(CAST(qty_sold AS UNSIGNED) * mrp)'), 'total_gmv']
                        ],
                        where: blinkitWhere,
                        raw: true
                    });
                    offtake = parseFloat(blinkitResult?.total_gmv || 0);

                } else {
                    // Fallback to RbPdpOlap (if available)
                    offtake = 0;
                }

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
        let brands = [];
        // Prioritize TbZeptoBrandSalesAnalytics for Zepto to ensure data consistency
        if (!platform || platform === 'Zepto') {
            const result = await TbZeptoBrandSalesAnalytics.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
                order: [['brand_name', 'ASC']],
                raw: true
            });
            brands = result.map(b => b.brand_name);
        } else {
            // Fallback to RcaSkuDim for other platforms
            const where = {};
            if (platform) {
                where.platform = platform;
            }
            const result = await RcaSkuDim.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
                where: where,
                order: [['brand_name', 'ASC']],
                raw: true
            });
            brands = result.map(b => b.brand_name);
        }
        return brands.filter(Boolean);
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
        let locations = [];
        // Prioritize TbZeptoBrandSalesAnalytics for Zepto
        if (!platform || platform === 'Zepto') {
            const where = {};
            if (brand) {
                where.brand_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), brand.toLowerCase());
            }
            const result = await TbZeptoBrandSalesAnalytics.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('city')), 'city']],
                where: where,
                order: [['city', 'ASC']],
                raw: true
            });
            locations = result.map(l => l.city);
        } else {
            const where = {};
            if (platform) {
                where.platform = platform;
            }
            if (brand) {
                where.brand_name = brand;
            }
            const result = await RcaSkuDim.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('location')), 'location']],
                where: where,
                order: [['location', 'ASC']],
                raw: true
            });
            locations = result.map(l => l.location);
        }
        return locations.filter(Boolean);
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
