import CommonContainer from "@/components/CommonLayout/CommonContainer";
import InventeryConceptMain from "@/components/InventeryConcept/InventeryConceptMain";
import React, { useState, useEffect, useContext } from "react";
import { FilterContext } from "@/utils/FilterContext";

export default function InventeryConceptMains() {
  const { refreshFilters, platform } = useContext(FilterContext);

  // Restore comprehensive platform list from rca_sku_dim on mount
  // (Prevents subsetting from other pages like Performance Marketing)
  useEffect(() => {
    if (typeof refreshFilters === 'function') {
      refreshFilters();
    }
  }, [refreshFilters]);

  const [showTrends, setShowTrends] = useState(false);

  const [filters, setFilters] = useState({
    platform: platform || "",
    months: 6,
    timeStep: "Monthly",
  });

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Monthly",
    platform: platform || "",
  });

  useEffect(() => {
    setFilters(prev => ({ ...prev, platform: platform || prev.platform }));
    setTrendParams(prev => ({ ...prev, platform: platform || prev.platform }));
  }, [platform]);

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
      platform: card.name ?? filters.platform ?? platform ?? "",
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
