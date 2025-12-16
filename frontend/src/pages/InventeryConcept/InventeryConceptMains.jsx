import CommonContainer from "@/components/CommonLayout/CommonContainer";
import InventeryConceptMain from "@/components/InventeryConcept/InventeryConceptMain";
import React, { useState } from "react";

export default function InventeryConceptMains() {
  const [showTrends, setShowTrends] = useState(false);

  const [filters, setFilters] = useState({
    platform: "Blinkit",
    months: 6,
    timeStep: "Monthly",
  });

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Monthly",
    platform: "Blinkit",
  });

  const [trendData, setTrendData] = useState({
    timeSeries: [],
    metrics: {},
  });

  const handleViewTrends = (card) => {
    console.log("card clicked", card);

    const series =
      card.chart?.map((v, i) => {
        let date;

        if (trendParams.timeStep === "Monthly") {
          const d = new Date();
          d.setMonth(d.getMonth() - (card.chart.length - 1 - i));
          date = d.toLocaleString("default", {
            month: "short",
            year: "2-digit",
          });
        } else if (trendParams.timeStep === "Weekly") {
          const d = new Date();
          d.setDate(d.getDate() - 7 * (card.chart.length - 1 - i));
          date = d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          });
        } else {
          const d = new Date();
          d.setDate(d.getDate() - (card.chart.length - 1 - i));
          date = d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          });
        }

        return { date, offtake: v };
      }) ?? [];

    setTrendData({
      timeSeries: series,
      metrics: {},
    });

    setTrendParams((prev) => ({
      ...prev,
      platform: card.name ?? "Blinkit",
    }));

    setShowTrends(true);
  };

  return (
    <>
      <CommonContainer
        title="Inventory Analysis"
        filters={filters}
        onFiltersChange={setFilters}
      >
        <InventeryConceptMain />
      </CommonContainer>
    </>
  );
}
