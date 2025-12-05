import React, { useState } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import AvailablityAnalysisData from "../../components/AllAvailablityAnalysis/AvailablityAnalysisData";

export default function AvailablityAnalysis() {
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

  const [apiData, setApiData] = useState(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const queryParams = new URLSearchParams(filters).toString();
        const response = await fetch(`http://localhost:5000/api/availability-analysis?${queryParams}`);
        const data = await response.json();
        setApiData(data);
      } catch (error) {
        console.error("Error fetching availability data:", error);
      }
    };

    fetchData();
  }, [filters]);

  return (
    <>
      <CommonContainer
        title="Availability Analysis"
        filters={filters}
        onFiltersChange={setFilters}
      >
        <AvailablityAnalysisData apiData={apiData} />
      </CommonContainer>
    </>
  );
}
