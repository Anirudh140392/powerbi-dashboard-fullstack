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

        let comparisonDrr = 0;
        if (compareStartDate && compareEndDate) {
            const cStart = dayjs(compareStartDate);
            const cEnd = dayjs(compareEndDate);
            const cDays = cEnd.diff(cStart, 'day') + 1;
            if (cDays > 0) {
                comparisonDrr = comparisonSales / cDays;
            }
        }

        // 3. Trend Data (Daily or Monthly)
        let daysInInterval = 0;
        if (startDate && endDate) {
            daysInInterval = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
        }

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

        let formattedTrend = [];
        if (daysInInterval > 35) {
            // Aggregate by Month
            const monthMap = {};
            trendData.forEach(t => {
                const monthKey = dayjs(t.DATE).format('MMM YY');
                if (!monthMap[monthKey]) monthMap[monthKey] = 0;
                monthMap[monthKey] += parseFloat(t.dailyTotal || 0);
            });
            formattedTrend = Object.keys(monthMap).map(key => ({
                date: key,
                value: monthMap[key]
            }));
        } else {
            formattedTrend = trendData.map(t => ({
                date: dayjs(t.DATE).format('MMM DD'),
                value: parseFloat(t.dailyTotal || 0)
            }));
        }

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
        // 7. DRR and Projected Sales Calculation
        // DRR = Overall Sales / No of days in selected date interval
        let drr = 0;
        // daysInInterval already calculated above
        if (daysInInterval > 0) {
            drr = overallSales / daysInInterval;
        } else if (!startDate && !endDate) {
            // Fallback if no specific interval provided: use MTD logic
            const daysElapsed = primaryEndDate.date();
            if (daysElapsed > 0) {
                drr = mtdSales / daysElapsed;
            }
        }

        // Projected Sales = (MTD Sales / Days in MTD interval) * Total Days in MTD Month
        const mtdDaysElapsed = primaryEndDate.date();
        const totalDaysInMtdMonth = primaryEndDate.daysInMonth();
        let projectedSales = 0;
        if (mtdDaysElapsed > 0) {
            projectedSales = (mtdSales / mtdDaysElapsed) * totalDaysInMtdMonth;
        }

        // Percentage Changes for DRR and Projected
        let drrChangePercentage = null;
        if (comparisonDrr > 0) {
            drrChangePercentage = ((drr - comparisonDrr) / comparisonDrr) * 100;
        } else if (drr > 0) {
            drrChangePercentage = 100; // if comparison was 0
        }

        let projectedComparison = 0;
        const prevMonthTotalDays = prevMonthEnd.daysInMonth();
        if (mtdDaysElapsed > 0) { // reuse relative days
            projectedComparison = (mtdPrevSales / mtdDaysElapsed) * prevMonthTotalDays;
        }

        let projectedChangePercentage = null;
        if (projectedComparison > 0) {
            projectedChangePercentage = ((projectedSales - projectedComparison) / projectedComparison) * 100;
        } else if (projectedSales > 0) {
            projectedChangePercentage = 100;
        }

        res.json({
            overallSales,
            comparisonSales,
            changePercentage,
            trend: formattedTrend,
            mtdSales,
            mtdChangePercentage,
            mtdTrend,
            drr,
            drrChangePercentage,
            projectedSales,
            projectedChangePercentage
        });
    } catch (error) {
        console.error('Error fetching sales overview:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
