import React from "react";
import MetricCardContainer from "../../components/CommonLayout/MetricCardContainer";
import { SALES_SUMMARY_DATA } from "./SalesData";

export default function SalesSummaryCards({ data, loading }) {
    const { mtd, currentDRR, projectedSales: mockProjected } = SALES_SUMMARY_DATA;

    // Fallback values if data is missing
    const overallValue = data?.overallSales ?? SALES_SUMMARY_DATA.overallSales;
    const mtdValue = data?.mtdSales ?? mtd.value;
    const drrValue = data?.drr ?? currentDRR;
    const projectedValue = data?.projectedSales ?? mockProjected.value;

    const changePerc = data?.changePercentage;
    const isPositive = changePerc >= 0;
    const changeText = changePerc !== null && changePerc !== undefined
        ? `${isPositive ? "▲" : "▼"}${Math.abs(changePerc).toFixed(1)}%`
        : "Stable";
    const changeColor = changePerc !== null && changePerc !== undefined
        ? (isPositive ? "#28a745" : "#dc3545")
        : "#6c757d";

    // Trend data for sparkline
    const sparklineData = data?.trend?.map(t => t.value) || [];
    const sparklineMonths = data?.trend?.map(t => t.date) || [];

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

    const mtdSparklineData = data?.mtdTrend?.map(t => t.value) || [];
    const mtdSparklineMonths = data?.mtdTrend?.map(t => t.date) || [];

    const cards = [
        {
            title: "Overall Sales",
            value: loading ? "Loading..." : `₹${formatValue(overallValue)}`,
            sub: "",
            change: changeText,
            changeColor: changeColor,
            prevText: changePerc !== null ? "vs Prev Period" : "",
            sparklineData: sparklineData,
            months: sparklineMonths
        },
        {
            title: "MTD Sales",
            value: loading ? "Loading..." : `₹${formatValue(mtdValue)}`,
            sub: "",
            change: mtdChangeText,
            changeColor: mtdChangeColor,
            prevText: mtdChangePerc !== null ? "vs Last Month" : "",
            extra: `Daily Average: ₹${formatValue(drrValue)}`,
            extraChange: "",
            extraChangeColor: "",
            sparklineData: mtdSparklineData,
            months: mtdSparklineMonths
        },
        {
            title: "Current DRR",
            value: loading ? "Loading..." : `₹${formatValue(drrValue)}`,
            sub: "",
            change: "Stable",
            changeColor: "#6c757d",
            prevText: "",
            extra: "Req. Run Rate: ₹80 Cr",
            extraChange: "▼5%",
            extraChangeColor: "#dc3545",
        },
        {
            title: "Projected Sales",
            value: loading ? "Loading..." : `₹${formatValue(projectedValue)}`,
            sub: "",
            change: `${mockProjected.change}%`,
            changeColor: mockProjected.change >= 0 ? "#28a745" : "#dc3545",
            prevText: mockProjected.comparison,
            extra: "Forecast Accuracy",
            extraChange: "98%",
            extraChangeColor: "#28a745",
        }
    ];

    return (
        <MetricCardContainer
            title="Sales Overview"
            cards={cards}
        />
    );
}
