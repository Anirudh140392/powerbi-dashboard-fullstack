import React from "react";
import MetricCardContainer from "../../components/CommonLayout/MetricCardContainer";
import { SALES_SUMMARY_DATA } from "./SalesData";

export default function SalesSummaryCards() {
    const { overallSales, mtd, currentDRR, projectedSales } = SALES_SUMMARY_DATA;

    // Format cards to match MetricCard props
    const cards = [
        {
            title: "Overall Sales",
            value: `₹${overallSales.toLocaleString()}`,
            sub: "Cr",
            change: "Stable", // No explicit change data for overall sales distinct from MTD
            changeColor: "#6c757d",
            prevText: "",
            extra: "New launches contributing: 7 SKUs",
            extraChange: "▲12.5%",
            extraChangeColor: "#28a745",
        },
        {
            title: "MTD Sales",
            value: `₹${mtd.value.toLocaleString()}`,
            sub: "Cr",
            change: `${mtd.change}%`,
            changeColor: mtd.change >= 0 ? "#28a745" : "#dc3545",
            prevText: mtd.comparison,
            extra: "Daily Average: ₹35 Cr",
            extraChange: "",
            extraChangeColor: "",
        },
        {
            title: "Current DRR",
            value: `₹${currentDRR}`,
            sub: "Cr",
            change: "Stable",
            changeColor: "#6c757d",
            prevText: "",
            extra: "Req. Run Rate: ₹80 Cr",
            extraChange: "▼5%",
            extraChangeColor: "#dc3545",
        },
        {
            title: "Projected Sales",
            value: `₹${projectedSales.value.toLocaleString()}`,
            sub: "Cr",
            change: `${projectedSales.change}%`,
            changeColor: projectedSales.change >= 0 ? "#28a745" : "#dc3545",
            prevText: projectedSales.comparison,
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
