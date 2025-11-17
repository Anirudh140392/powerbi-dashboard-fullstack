import TrendController from "../helper/TrendController.js";
import ServiceResponse from "../helper/ServiceResponse.js";

export const getDashboardData = async (req, res) => {
  try {
    // incoming query params from MyTrendsDrawer
    const months = parseInt(req.query.months) || 6;
    const timeStep = req.query.timeStep || "Monthly";

    const ctrl = new TrendController();

    // synthetic time-series + metric generation
    const chartData = ctrl.generateData(months, timeStep);
    const generatedMetrics = ctrl.getMetrics(chartData);

    // hardcoded backend dashboard blocks
    const dashboardData = {
      summaryMetrics: {
        offtakes: "211.78M",
        offtakesTrend: "+1060.81%",
        shareOfSearch: "58.32%",
        shareOfSearchTrend: "+12.11%",
        stockAvailability: "96.32%",
        stockAvailabilityTrend: "+4.2%",
        marketShare: "32.12%",
      },

      locations: [
        {
          title: "All",
          sales: "211.78M",
          salesGrowth: "1060.81",
          salesGrowthValue: "18.24M",
          units: "1.17M",
          unitsGrowth: "985.49",
          unitsGrowthValue: "108.16K",
          impressions: "4.36M",
          conversion: "26.93%",
          conversionGrowth: "26.93",
        },
        {
          title: "Bangalore",
          sales: "60.90M",
          salesGrowth: "1062.71",
          salesGrowthValue: "5.24M",
          units: "354.87K",
          unitsGrowth: "972.64",
          unitsGrowthValue: "33.08K",
          impressions: "1.19M",
          conversion: "29.89%",
          conversionGrowth: "29.89",
        },
        {
          title: "Mumbai",
          sales: "32.21M",
          salesGrowth: "1053.87",
          salesGrowthValue: "2.79M",
          units: "165.20K",
          unitsGrowth: "975.64",
          unitsGrowthValue: "15.36K",
          impressions: "481.89K",
          conversion: "34.28%",
          conversionGrowth: "34.28",
        },
        {
          title: "Delhi - NCR",
          sales: "49.30M",
          salesGrowth: "1067.45",
          salesGrowthValue: "4.22M",
          units: "264.99K",
          unitsGrowth: "1009.24",
          unitsGrowthValue: "23.89K",
          impressions: "997.38K",
          conversion: "26.57%",
          conversionGrowth: "26.57",
        },
      ],

      skuTable: [
        {
          productName: "Product A",
          productId: "A123",
          itemId: "ITM001",
          osa: "58.06%",
          asp: "₹189.38",
          discount: "12%",
        },
        {
          productName: "Product B",
          productId: "B456",
          itemId: "ITM002",
          osa: "62.12%",
          asp: "₹210.00",
          discount: "10%",
        },
      ],

      // synthetic chart + KPI data
      timeSeries: chartData,
      generatedMetrics: generatedMetrics,
    };

    return res.status(200).json(
      ServiceResponse.success(
        "✅ Dashboard data fetched successfully",
        dashboardData
      )
    );
  } catch (error) {
    return res
      .status(500)
      .json(
        ServiceResponse.error(
          "❌ Failed to fetch dashboard data",
          error.message
        )
      );
  }
};
