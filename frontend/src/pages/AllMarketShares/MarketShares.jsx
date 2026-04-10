import React, { useState, useEffect, useContext } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import MarketShareAnalysis from "../../components/AllMarketShares/MarketShareAnalysis";
import { FilterContext } from "../../utils/FilterContext";

export default function MarketShares() {
  const { refreshFilters, refreshDates } = useContext(FilterContext);
  const [showTrends, setShowTrends] = useState(false);

  // Restore comprehensive platform list and refresh latest dates
  useEffect(() => {
    if (typeof refreshFilters === 'function') {
      refreshFilters();
    }
    if (typeof refreshDates === 'function') {
      refreshDates();
    }
  }, [refreshFilters, refreshDates]);

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
        title="Market Share"
        filters={filters}
        onFiltersChange={setFilters}
      >
        <MarketShareAnalysis />
      </CommonContainer>
    </>
  );
}
