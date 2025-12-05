import React, { useState, useEffect, useRef } from "react";
import axiosInstance from "../../api/axiosInstance";
import Insights from "../../components/Analytics/CategoryRca/Insights";
import InsightsDrawer from "../../components/Analytics/CategoryRca/InsightsDrawer";
import Sidebar from "../../components/CommonLayout/Sidebar";
import { Box, Container } from "@mui/material";
import CategoryPlatformOverview from "../../components/Analytics/CategoryRca/CategoryPlatformOverview";
import RCACardMetric from "../../components/Analytics/CategoryRca/RCACardMetric";
import RCAHeader from "../../components/Analytics/CategoryRca/RCAHeader";

import CommonContainer from "../../components/CommonLayout/CommonContainer";
import SkuLevelBreakdown from "../../components/Analytics/CategoryRca/SkuLevelBreakdown";
import CategoryTrendsDrawer from "../../components/Analytics/CategoryTrendsDrawer";
import RCADashboard from "../../components/Analytics/CategoryRca/RCADashboard";
import Dashboard from "../../components/Analytics/CategoryRca/SkuLevelBreakdown";

export default function CategoryRca() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const calledOnce = useRef(false);

  useEffect(() => {
    if (calledOnce.current) return;
    calledOnce.current = true;

    const fetchCategoryData = async () => {
      try {
        const response = await axiosInstance.get('/category-rca', {
          params: { platform: 'Blinkit' } // Default filter
        });
        console.log("Category RCA Data:", response.data);
      } catch (error) {
        console.error("Error fetching Category RCA data:", error);
      }
    };

    fetchCategoryData();
  }, []);
  const [showTrends, setShowTrends] = useState(false);

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Monthly",
    cat: "All",
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
          date = d.toLocaleString("default", { month: "short", year: "2-digit" });
        } else if (trendParams.timeStep === "Weekly") {
          const d = new Date();
          d.setDate(d.getDate() - 7 * (card.chart.length - 1 - i));
          date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        } else {
          const d = new Date();
          d.setDate(d.getDate() - (card.chart.length - 1 - i));
          date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        }

        return { date, offtake: v };
      }) ?? [];

    setTrendData({
      timeSeries: series,
      metrics: {},
    });

    setTrendParams((prev) => ({
      ...prev,
      cat: card.name ?? "All",
    }));

    setShowTrends(true);
  };

  const [filters, setFilters] = useState({
    cat: "All",
    months: 6,
    timeStep: "Monthly",
  });
  const products = [
    {
      id: 1,
      rank: "01",
      name: "Colgate Total Advanced Health Toothpaste",
      weight: "80 g",
      growth: "4.2 %",
      category: "Toothpaste",
      offtake: "₹71.3 K",
      offtakeChange: "-73.6% (₹2.0 lac)",
      cities: [
        {
          name: "Delhi-NCR",
          offtake: "₹71.3 K",
          offtakeChange: "-73.6%",
          catShare: "0.7%",
          catShareChange: "-2.2%",
          wtOsa: "30.9%",
          wtOsaChange: "-63.8%",
          overallSov: "0.8%",
          overallSovChange: "-6.1%",
          adSov: "NA",
          wtDisc: "10.1%",
          wtDiscChange: "10.1%",
        },
        {
          name: "Others",
          offtake: "₹3.3 lac",
          offtakeChange: "-9.2%",
          catShare: "2.3%",
          catShareChange: "-0.4%",
          wtOsa: "70.6%",
          wtOsaChange: "-11.4%",
          overallSov: "6.0%",
          overallSovChange: "-1.4%",
          adSov: "NA",
          wtDisc: "9.8%",
          wtDiscChange: "9.8%",
        },
        {
          name: "Kolkata",
          offtake: "₹14.6 K",
          offtakeChange: "-68.5%",
          catShare: "0.6%",
          catShareChange: "-1.2%",
          wtOsa: "35.6%",
          wtOsaChange: "-61.6%",
          overallSov: "0.1%",
          overallSovChange: "-4.0%",
          adSov: "NA",
          wtDisc: "11.1%",
          wtDiscChange: "11.1%",
        },
        {
          name: "Chennai",
          offtake: "₹10.3 K",
          offtakeChange: "-40.5%",
          catShare: "1.1%",
          catShareChange: "-1.0%",
          wtOsa: "33.7%",
          wtOsaChange: "-28.5%",
          overallSov: "1.9%",
          overallSovChange: "-1.9%",
          adSov: "NA",
          wtDisc: "11.1%",
          wtDiscChange: "11.1%",
        },
        {
          name: "Pune",
          offtake: "₹44.8 K",
          offtakeChange: "-12.5%",
          catShare: "3.0%",
          catShareChange: "-0.8%",
          wtOsa: "75.8%",
          wtOsaChange: "-20.6%",
          overallSov: "5.3%",
          overallSovChange: "-1.5%",
          adSov: "NA",
          wtDisc: "11.1%",
          wtDiscChange: "11.1%",
        },
        {
          name: "Mumbai",
          offtake: "₹1.1 lac",
          offtakeChange: "2.0%",
          catShare: "3.8%",
          catShareChange: "-0.6%",
          wtOsa: "95.9%",
          wtOsaChange: "0.1%",
          overallSov: "8.2%",
          overallSovChange: "-0.2%",
          adSov: "NA",
          wtDisc: "9.1%",
          wtDiscChange: "9.1%",
        },
        {
          name: "Hyderabad",
          offtake: "₹12.0 K",
          offtakeChange: "102.9%",
          catShare: "0.6%",
          catShareChange: "0.3%",
          wtOsa: "35.1%",
          wtOsaChange: "14.8%",
          overallSov: "0.2%",
          overallSovChange: "-0.1%",
          adSov: "NA",
          wtDisc: "11.1%",
          wtDiscChange: "11.1%",
        },
        {
          name: "Bangalore",
          offtake: "₹78.7 K",
          offtakeChange: "-",
          catShare: "2.5%",
          catShareChange: "-",
          wtOsa: "60.5%",
          wtOsaChange: "-",
          overallSov: "3.3%",
          overallSovChange: "-",
          adSov: "NA",
          wtDisc: "11.1%",
          wtDiscChange: "11.1%",
        },
      ],
      overall: {
        offtake: "₹6.7 lac",
        offtakeChange: "-27.6%",
        catShare: "1.8%",
        catShareChange: "-0.8%",
        wtOsa: "61.1%",
        wtOsaChange: "-22.7%",
        overallSov: "3.1%",
        overallSovChange: "-3.3%",
        adSov: "NA",
        wtDisc: "10.0%",
        wtDiscChange: "10.0%",
      },
    },
    {
      id: 2,
      rank: "02",
      name: "Colgate MaxFresh Spicy Fresh Gel",
      weight: "150 g",
      growth: "5.1 %",
      category: "Toothpaste",
      offtake: "₹1.5 lac",
      offtakeChange: "-53.4% (₹1.7 lac)",
      cities: [
        {
          name: "Delhi-NCR",
          offtake: "₹1.5 lac",
          offtakeChange: "-53.4%",
          catShare: "1.4%",
          catShareChange: "-1.7%",
          wtOsa: "45.2%",
          wtOsaChange: "-52.1%",
          overallSov: "1.2%",
          overallSovChange: "-5.8%",
          adSov: "NA",
          wtDisc: "8.5%",
          wtDiscChange: "8.5%",
        },
        {
          name: "Others",
          offtake: "₹3.4 lac",
          offtakeChange: "-29.1%",
          catShare: "2.8%",
          catShareChange: "-0.9%",
          wtOsa: "68.3%",
          wtOsaChange: "-18.2%",
          overallSov: "7.1%",
          overallSovChange: "-2.1%",
          adSov: "NA",
          wtDisc: "7.9%",
          wtDiscChange: "7.9%",
        },
      ],
    },
    {
      id: 3,
      rank: "03",
      name: "Colgate Visible White",
      weight: "120 g",
      growth: "5.5 %",
      category: "Toothpaste",
      cities: [
        {
          name: "Kolkata",
          offtake: "₹2.1 lac",
          offtakeChange: "-35.2%",
          catShare: "0.9%",
          catShareChange: "-0.8%",
          wtOsa: "52.4%",
          wtOsaChange: "-31.5%",
          overallSov: "1.8%",
          overallSovChange: "-3.2%",
          adSov: "NA",
          wtDisc: "9.2%",
          wtDiscChange: "9.2%",
        },
      ],
    },
  ];

  return (
    <>
      <CommonContainer
        title="Category Rca"
        filters={filters}
        onFiltersChange={setFilters}
      >
        {/* <Insights products={products} onKnowMore={setSelectedProduct} /> */}
        <Insights />
        <RCACardMetric />
        <CategoryPlatformOverview onViewTrends={handleViewTrends} />
        <SkuLevelBreakdown />
        <RCADashboard />

      </CommonContainer>

      <InsightsDrawer
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        totalProducts={products.length}
      />
      <CategoryTrendsDrawer
        open={showTrends}
        onClose={() => setShowTrends(false)}
        trendData={trendData}
        trendParams={trendParams}
      />
    </>
  );
}
