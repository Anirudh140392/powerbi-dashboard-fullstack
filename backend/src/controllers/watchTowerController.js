import watchTowerService from '../services/watchTowerService.js';
import RbPdpOlap from '../models/RbPdpOlap.js';
import TbZeptoInventoryData from '../models/TbZeptoInventoryData.js';
import { Op } from 'sequelize';
import sequelize from '../config/db.js';

export const watchTowerOverview = async (req, res) => {
    {
        try {
            const filters = req.query;
            console.log("watch tower api call received", filters);
            const data = await watchTowerService.getSummaryMetrics(filters);
            res.json(data);
        } catch (error) {
            console.error('Error fetching summary metrics:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

export const getTrendData = async (req, res) => {
    try {
        const filters = req.query;
        console.log("trend data api call received", filters);
        const data = await watchTowerService.getTrendData(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching trend data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getPlatforms = async (req, res) => {
    try {
        const platforms = await watchTowerService.getPlatforms();
        res.json(platforms);
    } catch (error) {
        console.error('Error fetching platforms:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getBrands = async (req, res) => {
    try {
        const { platform } = req.query;
        const brands = await watchTowerService.getBrands(platform);
        res.json(brands);
    } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getKeywords = async (req, res) => {
    try {
        const { brand } = req.query;
        const keywords = await watchTowerService.getKeywords(brand);
        res.json(keywords);
    } catch (error) {
        console.error('Error fetching keywords:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getLocations = async (req, res) => {
    try {
        const { platform, brand } = req.query;
        const locations = await watchTowerService.getLocations(platform, brand);
        res.json(locations);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getBrandCategories = async (req, res) => {
    try {
        const { platform } = req.query;
        const categories = await watchTowerService.getBrandCategories(platform);
        res.json(categories);
    } catch (error) {
        console.error('Error fetching brand categories:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getMetrics = async (req, res) => {
    try {
        const { getAllMetricKeys } = await import('../services/keyMetricsService.js');
        const metrics = await getAllMetricKeys();
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getWatchTowerData = async (req, res) => {
    try {
        const {
            platform,
            months,
            timeStep,
            brand,
            location,
            keyword,
            startDate,
            endDate,
            compareStartDate,
            compareEndDate,
            monthOverviewPlatform, // Extract it
            categoryOverviewPlatform,
            brandsOverviewPlatform,
            brandsOverviewCategory
        } = req.query;

        console.log("Processing Watch Tower request with filters:", req.query);

        // Use optimized function for parallel fetching with section-wise caching
        const data = await watchTowerService.getSummaryMetricsOptimized({
            platform,
            months,
            timeStep,
            brand,
            location,
            keyword,
            startDate,
            endDate,
            compareStartDate,
            compareEndDate,
            monthOverviewPlatform,
            categoryOverviewPlatform,
            brandsOverviewPlatform,
            brandsOverviewCategory
        });
        res.json(data);
    } catch (error) {
        console.error('Error fetching watch tower data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const debugAvailability = async (req, res) => {
    try {
        const { brand, location, platform, startDate, endDate } = req.query;

        const results = {};

        // 1. Check Brand Matches
        if (brand) {
            results.brandExact = await RbPdpOlap.count({ where: { Brand: brand } });
            results.brandLike = await RbPdpOlap.count({ where: { Brand: { [Op.like]: `%${brand}%` } } });
            results.brandSamples = await RbPdpOlap.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('Brand')), 'Brand']],
                where: { Brand: { [Op.like]: `%${brand}%` } },
                raw: true
            });
        }

        // 2. Check Location Matches
        if (location) {
            results.locationExact = await RbPdpOlap.count({ where: { Location: location } });
            results.locationLike = await RbPdpOlap.count({ where: { Location: { [Op.like]: `%${location}%` } } });
            results.locationSamples = await RbPdpOlap.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('Location')), 'Location']],
                where: { Location: { [Op.like]: `%${location}%` } },
                raw: true
            });
        }

        // 3. Check Platform Matches
        if (platform) {
            results.platformExact = await RbPdpOlap.count({ where: { Platform: platform } });
        }
        results.platformSamples = await RbPdpOlap.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Platform')), 'Platform']],
            raw: true
        });

        // 4. Combined Check
        const where = {};
        if (brand) where.Brand = { [Op.like]: `%${brand}%` };
        if (location) where.Location = { [Op.like]: `%${location}%` }; // Try loose match for location too
        if (platform) where.Platform = platform;

        results.combinedCount = await RbPdpOlap.count({ where });

        // 5. Data with Date
        if (startDate && endDate) {
            where.DATE = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            results.combinedWithDateCount = await RbPdpOlap.count({ where });

            // Get a sample record
            results.sampleRecord = await RbPdpOlap.findOne({ where, raw: true });
        }

        // 6. Get All Distinct Brands and Locations (Limit 10) - REMOVED
        // results.allBrands = ...
        // results.allLocations = ...

        // 7. Check TbZeptoInventoryData
        if (brand && location) {
            results.zeptoInventoryCount = await TbZeptoInventoryData.count({
                where: {
                    brand_name: brand,
                    city: location
                }
            });
            results.zeptoInventorySample = await TbZeptoInventoryData.findOne({
                where: {
                    brand_name: brand,
                    city: location
                },
                raw: true
            });
        }

        res.json(results);
    } catch (error) {
        console.error('Debug Error:', error);
        res.status(500).json({ error: error.message });
    }
};
