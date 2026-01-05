import RbPdpOlap from '../models/RbPdpOlap.js';
import { Op, Sequelize } from 'sequelize';
import dayjs from 'dayjs';

export const getSalesOverview = async (req, res) => {
    try {
        const { platform, brand, location, startDate, endDate, compareStartDate, compareEndDate } = req.query;
        console.log('[getSalesOverview] API call received with filters:', { platform, brand, location, startDate, endDate, compareStartDate, compareEndDate });

        const baseWhere = {};

        // Platform Filter
        if (platform && platform !== 'All') {
            baseWhere.Platform = platform;
        }

        // Brand Filter
        if (brand && brand !== 'All') {
            baseWhere.Brand = { [Op.like]: `%${brand}%` };
        } else {
            baseWhere.Comp_flag = 0;
        }

        // Location Filter
        if (location && location !== 'All') {
            baseWhere.Location = location;
        }

        // 1. Primary Period Sales (Overall)
        const overallWhere = { ...baseWhere };
        if (startDate && endDate) {
            overallWhere.DATE = { [Op.between]: [new Date(startDate), new Date(endDate)] };
        }

        const overallResult = await RbPdpOlap.findOne({
            attributes: [[Sequelize.fn('SUM', Sequelize.col('Sales')), 'total']],
            where: overallWhere,
            raw: true
        });
        const overallSales = parseFloat(overallResult?.total || 0);

        // 2. Comparison Period Sales
        let comparisonSales = 0;
        let changePercentage = null;
        if (compareStartDate && compareEndDate) {
            const comparisonWhere = { ...baseWhere };
            comparisonWhere.DATE = { [Op.between]: [new Date(compareStartDate), new Date(compareEndDate)] };

            const comparisonResult = await RbPdpOlap.findOne({
                attributes: [[Sequelize.fn('SUM', Sequelize.col('Sales')), 'total']],
                where: comparisonWhere,
                raw: true
            });
            comparisonSales = parseFloat(comparisonResult?.total || 0);

            if (comparisonSales > 0) {
                changePercentage = ((overallSales - comparisonSales) / comparisonSales) * 100;
            } else if (overallSales > 0) {
                changePercentage = 100; // 100% grow if comparison was 0
            }
        }

        // 3. Daily Trend Data (Primary Period)
        const trendData = await RbPdpOlap.findAll({
            attributes: [
                'DATE',
                [Sequelize.fn('SUM', Sequelize.col('Sales')), 'dailyTotal']
            ],
            where: overallWhere,
            group: ['DATE'],
            order: [['DATE', 'ASC']],
            raw: true
        });

        const formattedTrend = trendData.map(t => ({
            date: dayjs(t.DATE).format('MMM DD'),
            value: parseFloat(t.dailyTotal || 0)
        }));

        // 4. MTD Sales (1st of selected month to selected endDate)
        const primaryEndDate = endDate ? dayjs(endDate) : dayjs();
        const mtdStart = primaryEndDate.startOf('month').toDate();
        const mtdEnd = primaryEndDate.toDate();

        const mtdWhere = { ...baseWhere, DATE: { [Op.between]: [mtdStart, mtdEnd] } };

        const mtdResult = await RbPdpOlap.findOne({
            attributes: [[Sequelize.fn('SUM', Sequelize.col('Sales')), 'total']],
            where: mtdWhere,
            raw: true
        });
        const mtdSales = parseFloat(mtdResult?.total || 0);

        // 5. MTD Comparison (Previous Month, same relative days)
        const prevMonthEnd = primaryEndDate.subtract(1, 'month');
        const prevMonthStart = prevMonthEnd.startOf('month').toDate();
        const prevMonthEndRange = prevMonthEnd.toDate();

        const mtdPrevWhere = { ...baseWhere, DATE: { [Op.between]: [prevMonthStart, prevMonthEndRange] } };
        const mtdPrevResult = await RbPdpOlap.findOne({
            attributes: [[Sequelize.fn('SUM', Sequelize.col('Sales')), 'total']],
            where: mtdPrevWhere,
            raw: true
        });
        const mtdPrevSales = parseFloat(mtdPrevResult?.total || 0);

        let mtdChangePercentage = null;
        if (mtdPrevSales > 0) {
            mtdChangePercentage = ((mtdSales - mtdPrevSales) / mtdPrevSales) * 100;
        } else if (mtdSales > 0) {
            mtdChangePercentage = 100;
        }

        // 6. MTD Daily Trend
        const mtdTrendData = await RbPdpOlap.findAll({
            attributes: [
                'DATE',
                [Sequelize.fn('SUM', Sequelize.col('Sales')), 'dailyTotal']
            ],
            where: mtdWhere,
            group: ['DATE'],
            order: [['DATE', 'ASC']],
            raw: true
        });

        const mtdTrend = mtdTrendData.map(t => ({
            date: dayjs(t.DATE).format('MMM DD'),
            value: parseFloat(t.dailyTotal || 0)
        }));

        // 7. DRR and Projections based on MTD
        const daysInMonth = primaryEndDate.daysInMonth();
        const daysElapsed = primaryEndDate.date();
        const drr = mtdSales / daysElapsed;
        const projectedSales = drr * daysInMonth;

        res.json({
            overallSales,
            comparisonSales,
            changePercentage,
            trend: formattedTrend,
            mtdSales,
            mtdChangePercentage,
            mtdTrend,
            drr,
            projectedSales
        });
    } catch (error) {
        console.error('Error fetching sales overview:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
