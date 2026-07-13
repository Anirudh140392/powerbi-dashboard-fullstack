import React from "react";
import useKpiPermissions from "../../hooks/useKpiPermissions";
import MetricCardContainer from "../../components/CommonLayout/MetricCardContainer";
import dayjs from "dayjs";

export default function SalesSummaryCards({ data, loading, startDate, endDate }) {
    const { isKpiEnabled } = useKpiPermissions("Sales Data");
    const isSalesRevenueEnabled = isKpiEnabled("sales_revenue");
    // Treat data values as 0 when not loaded or not provided, instead of hardcoded data
    const overallValue = data?.overallSales ?? 0;
    const mtdValue = data?.mtdSales ?? 0;
    const drrValue = data?.drr ?? 0;
    const projectedValue = data?.projectedSales ?? 0;

    const changePerc = data?.changePercentage;
    const isPositive = changePerc >= 0;
    const changeText = changePerc !== null && changePerc !== undefined
        ? `${isPositive ? "▲" : "▼"}${Math.abs(changePerc).toFixed(1)}%`
        : "Stable";
    const changeColor = changePerc !== null && changePerc !== undefined
        ? (isPositive ? "#28a745" : "#dc3545")
        : "#6c757d";

    // Generate date labels based on selected date range
    const generateDateLabels = () => {
        const start = startDate ? dayjs(startDate) : dayjs().subtract(30, 'days');
        const end = endDate ? dayjs(endDate) : dayjs();
        const labels = [];
        const daysDiff = end.diff(start, 'day');

        // Generate 7 evenly spaced points
        for (let i = 0; i < 7; i++) {
            const point = start.add(Math.floor((daysDiff * i) / 6), 'day');
            labels.push(point.format('DD MMM'));
        }
        return labels;
    };

    const defaultMonths = generateDateLabels();

    const generateDefaultSparkline = (baseValue, variance = 0.15) => {
        return Array(7).fill(baseValue || 0); // Flat-line when there is no data
    };

    const sparklineData = (data?.trend?.length >= 1) ? data.trend.map(t => t.value) : generateDefaultSparkline(overallValue / 100000);
    const sparklineMonths = (data?.trend?.length >= 1) ? data.trend.map(t => t.date) : defaultMonths;

    const mtdSparklineData = (data?.mtdTrend?.length >= 1) ? data.mtdTrend.map(t => t.value) : generateDefaultSparkline(mtdValue / 100000);
    const mtdSparklineMonths = (data?.mtdTrend?.length >= 1) ? data.mtdTrend.map(t => t.date) : defaultMonths;

    const drrSparklineData = (data?.drrTrend?.length >= 1) ? data.drrTrend.map(t => t.value) : generateDefaultSparkline(drrValue / 100000);
    const drrSparklineMonths = (data?.drrTrend?.length >= 1) ? data.drrTrend.map(t => t.date) : defaultMonths;

    const projSparklineData = (data?.projectedTrend?.length >= 1) ? data.projectedTrend.map(t => t.value) : generateDefaultSparkline(projectedValue / 100000);
    const projSparklineMonths = (data?.projectedTrend?.length >= 1) ? data.projectedTrend.map(t => t.date) : defaultMonths;

    // Helper for formatting large numbers in Indian system (Lakh/Crore)
    const formatValue = (val) => {
        if (val === undefined || val === null || isNaN(val)) return "0";

        if (val >= 10000000) {
            return (val / 10000000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " Cr";
        } else if (val >= 100000) {
            return (val / 100000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " L";
        } else {
            return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
        }
    };

    const mtdChangePerc = data?.mtdChangePercentage;
    const isMtdPositive = mtdChangePerc >= 0;
    const mtdChangeText = mtdChangePerc !== null && mtdChangePerc !== undefined
        ? `${isMtdPositive ? "▲" : "▼"}${Math.abs(mtdChangePerc).toFixed(1)}%`
        : "Stable";
    const mtdChangeColor = mtdChangePerc !== null && mtdChangePerc !== undefined
        ? (isMtdPositive ? "#28a745" : "#dc3545")
        : "#6c757d";

    // DRR Change Logic
    const drrChangePerc = data?.drrChangePercentage;
    const isDrrPositive = drrChangePerc >= 0;
    const drrChangeText = drrChangePerc !== null && drrChangePerc !== undefined
        ? `${isDrrPositive ? "▲" : "▼"}${Math.abs(drrChangePerc).toFixed(1)}%`
        : "Stable";
    const drrChangeColor = drrChangePerc !== null && drrChangePerc !== undefined
        ? (isDrrPositive ? "#28a745" : "#dc3545")
        : "#6c757d";

    // Projected Change Logic
    const projChangePerc = data?.projectedChangePercentage;
    const isProjPositive = projChangePerc >= 0;
    const projChangeText = projChangePerc !== null && projChangePerc !== undefined
        ? `${isProjPositive ? "▲" : "▼"}${Math.abs(projChangePerc).toFixed(1)}%`
        : "Stable";
    const projChangeColor = projChangePerc !== null && projChangePerc !== undefined
        ? (isProjPositive ? "#28a745" : "#dc3545")
        : "#6c757d";

    const cards = [
        {
            title: "Overall Sales",
            value: `₹${formatValue(overallValue)}`,
            change: changeText,
            changeColor: changeColor,
            prevText: changePerc !== null && changePerc !== undefined ? "vs Prev Period" : "",
            extra: data?.actualDataDays ? `${data.actualDataDays} days with data` : "",
            sparklineData: sparklineData,
            months: sparklineMonths
        },
        {
            title: "MTD Sales",
            value: `₹${formatValue(mtdValue)}`,
            change: mtdChangeText,
            changeColor: mtdChangeColor,
            prevText: mtdChangePerc !== null && mtdChangePerc !== undefined ? "vs Prev Period" : "",
            extra: `Daily Average: ₹${formatValue(drrValue)}`,
            extraChange: "",
            extraChangeColor: "",
            sparklineData: mtdSparklineData,
            months: mtdSparklineMonths
        },
        {
            title: "Current DRR",
            value: `₹${formatValue(drrValue)}`,
            change: drrChangeText,
            changeColor: drrChangeColor,
            prevText: drrChangePerc !== null && drrChangePerc !== undefined ? "vs Prev Period" : "",
            extra: data?.reqRunRate ? `Req. Run Rate: ₹${formatValue(data.reqRunRate)}` : "",
            extraChange: data?.reqRunRateGap !== null && data?.reqRunRateGap !== undefined
                ? `${data.reqRunRateGap >= 0 ? '▲' : '▼'}${Math.abs(data.reqRunRateGap).toFixed(0)}%`
                : "",
            extraChangeColor: data?.reqRunRateGap >= 0 ? "#dc3545" : "#28a745",
            sparklineData: drrSparklineData,
            months: drrSparklineMonths
        },
        {
            title: "Projected Sales",
            value: `₹${formatValue(projectedValue)}`,
            change: projChangeText,
            changeColor: projChangeColor,
            prevText: projChangePerc !== null && projChangePerc !== undefined ? "vs Last Month" : "",
            extra: "Forecast Accuracy",
            extraChange: data?.forecastAccuracy !== null && data?.forecastAccuracy !== undefined
                ? `${data.forecastAccuracy.toFixed(0)}%`
                : "",
            extraChangeColor: data?.forecastAccuracy >= 90 && data?.forecastAccuracy <= 110 ? "#28a745" : "#dc3545",
            sparklineData: projSparklineData,
            months: projSparklineMonths
        }
    ];

    const filteredCards = isSalesRevenueEnabled ? cards : [];

    return (
        <MetricCardContainer
            title="Sales Overview"
            cards={filteredCards}
            loading={loading}
            helpMenu="Business Overview"
        />
    );
}
