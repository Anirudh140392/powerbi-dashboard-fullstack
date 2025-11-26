const performanceData = {
  last_updated: "13/11/2025",

  filters: {
    date_range: "01/06/2025 – 13/11/2025",
    campaign: "All Campaigns",
  },

  kpi_cards: [
    {
      label: "Impressions",
      value: "1.2M",
      change: "+3.5%",
      positive: true,
      icon: "BarChart3",
    },
    {
      label: "Direct Conv.",
      value: "3.5%",
      change: "+0.8%",
      positive: true,
      icon: "TrendingUp",
    },
    {
      label: "Spend",
      value: "₹9.4M",
      change: "-1.2%",
      positive: false,
      icon: "ShoppingCart",
    },
    {
      label: "New Users",
      value: "22.9k",
      change: "+4.1%",
      positive: true,
      icon: "Users",
    },
  ],

  insights_summary: [
    { label: "Q1 · Perform Well – Continue", value: 73 },
    { label: "Q2 · Need Attention – Optimize", value: 134 },
    { label: "Q3 · Experiment – Optimize then Scale", value: 166 },
    { label: "Q4 · Opportunity – Scale Up Spends", value: 181 },
  ],

  // ---- YOUR HEATMAP DATA (converted to JSX-friendly) ----
  heatmapData: {
    title: "Format Performance (Heatmap)",
    duration: "Last 3 Months",
    headers: [
      "Format / Region / City",
      "Spend",
      "M-1 Spend",
      "M-2 Spend",
      "Conversion",
      "M-1 Conv",
      "M-2 Conv",
    ],
    rows: [
      {
        label: "Magnum",
        values: [164, 203.2, 256.3, "3%", "3.3%", "3.2%"],
        children: [
          {
            label: "North",
            values: [60, 72, 81, "3%", "3.1%", "3.2%"],
            children: [
              {
                label: "Delhi",
                values: [25, 30, 34, "3%", "3.1%", "3.2%"],
                children: [],
              },
              {
                label: "Lucknow",
                values: [20, 24, 27, "3%", "3.0%", "3.1%"],
                children: [],
              },
              {
                label: "Jaipur",
                values: [15, 18, 20, "3%", "3.1%", "3.2%"],
                children: [],
              },
            ],
          },
          {
            label: "South",
            values: [45, 62, 70, "2%", "2.4%", "2.3%"],
            children: [
              {
                label: "Bengaluru",
                values: [18, 24, 27, "2%", "2.3%", "2.2%"],
                children: [],
              },
              {
                label: "Chennai",
                values: [14, 20, 23, "2%", "2.5%", "2.4%"],
                children: [],
              },
              {
                label: "Hyderabad",
                values: [13, 18, 20, "2%", "2.4%", "2.3%"],
                children: [],
              },
            ],
          },
          {
            label: "East",
            values: [30, 41, 55, "4%", "3.9%", "4.1%"],
            children: [
              {
                label: "Kolkata",
                values: [15, 20, 27, "4%", "3.8%", "4.0%"],
                children: [],
              },
              {
                label: "Patna",
                values: [8, 11, 15, "4%", "4.0%", "4.2%"],
                children: [],
              },
              {
                label: "Bhubaneswar",
                values: [7, 10, 13, "4%", "3.9%", "4.1%"],
                children: [],
              },
            ],
          },
          {
            label: "West",
            values: [29, 28, 50, "3%", "3.4%", "3.3%"],
            children: [
              {
                label: "Mumbai",
                values: [12, 11, 20, "3%", "3.4%", "3.3%"],
                children: [],
              },
              {
                label: "Pune",
                values: [10, 9, 16, "3%", "3.5%", "3.4%"],
                children: [],
              },
              {
                label: "Ahmedabad",
                values: [7, 8, 14, "3%", "3.3%", "3.2%"],
                children: [],
              },
            ],
          },
        ],
      },
      {
        label: "Core Tub",
        values: [151, 199, 224.1, "2%", "2.4%", "2.9%"],
        children: [
          {
            label: "North",
            values: [55, 76, 85, "2%", "2.3%", "2.5%"],
            children: [
              {
                label: "Delhi",
                values: [22, 30, 34, "2%", "2.3%", "2.5%"],
                children: [],
              },
              {
                label: "Chandigarh",
                values: [18, 25, 28, "2%", "2.4%", "2.6%"],
                children: [],
              },
              {
                label: "Jaipur",
                values: [15, 21, 23, "2%", "2.2%", "2.4%"],
                children: [],
              },
            ],
          },
          {
            label: "South",
            values: [40, 56, 63, "1%", "1.4%", "1.7%"],
            children: [
              {
                label: "Chennai",
                values: [16, 22, 25, "1%", "1.4%", "1.6%"],
                children: [],
              },
              {
                label: "Bengaluru",
                values: [14, 20, 22, "1%", "1.5%", "1.7%"],
                children: [],
              },
              {
                label: "Hyderabad",
                values: [10, 14, 16, "1%", "1.3%", "1.6%"],
                children: [],
              },
            ],
          },
        ],
      },
      {
        label: "Premium Tub",
        values: [134, 178.9, 208.9, "1%", "0.7%", "0.7%"],
        children: [
          {
            label: "National",
            values: [134, 178.9, 208.9, "1%", "0.7%", "0.7%"],
            children: [
              {
                label: "Metro Cities",
                values: [80, 108, 124, "1%", "0.7%", "0.7%"],
                children: [],
              },
              {
                label: "Tier 1",
                values: [34, 45, 53, "1%", "0.8%", "0.7%"],
                children: [],
              },
              {
                label: "Tier 2 & 3",
                values: [20, 25, 31, "1%", "0.7%", "0.7%"],
                children: [],
              },
            ],
          },
        ],
      },
      {
        label: "Cornetto",
        values: [87, 117.6, 151, "2%", "1.7%", "1.8%"],
        children: [
          {
            label: "North",
            values: [34, 48, 57, "2%", "1.6%", "1.7%"],
            children: [
              {
                label: "Delhi",
                values: [15, 22, 26, "2%", "1.6%", "1.7%"],
                children: [],
              },
              {
                label: "Lucknow",
                values: [10, 14, 17, "2%", "1.7%", "1.8%"],
                children: [],
              },
              {
                label: "Jaipur",
                values: [9, 12, 14, "2%", "1.5%", "1.7%"],
                children: [],
              },
            ],
          },
          {
            label: "South",
            values: [22, 33, 45, "1%", "1.2%", "1.3%"],
            children: [
              {
                label: "Bengaluru",
                values: [9, 14, 19, "1%", "1.2%", "1.3%"],
                children: [],
              },
              {
                label: "Chennai",
                values: [7, 10, 14, "1%", "1.2%", "1.3%"],
                children: [],
              },
              {
                label: "Hyderabad",
                values: [6, 9, 12, "1%", "1.1%", "1.2%"],
                children: [],
              },
            ],
          },
          {
            label: "West",
            values: [31, 36, 49, "3%", "2.9%", "3.2%"],
            children: [
              {
                label: "Mumbai",
                values: [14, 16, 23, "3%", "2.9%", "3.1%"],
                children: [],
              },
              {
                label: "Pune",
                values: [9, 11, 14, "3%", "3.0%", "3.2%"],
                children: [],
              },
              {
                label: "Surat",
                values: [8, 9, 12, "3%", "2.8%", "3.1%"],
                children: [],
              },
            ],
          },
        ],
      },
      {
        label: "Slow Churn",
        values: [35, 42.4, 40.3, "2%", "1.5%", "1.5%"],
        children: [
          {
            label: "National",
            values: [35, 42.4, 40.3, "2%", "1.5%", "1.5%"],
            children: [
              {
                label: "Metro Cities",
                values: [18, 22, 20, "2%", "1.5%", "1.5%"],
                children: [],
              },
              {
                label: "Tier 1",
                values: [10, 12, 11, "2%", "1.5%", "1.5%"],
                children: [],
              },
              {
                label: "Tier 2 & 3",
                values: [7, 8.4, 9.3, "2%", "1.4%", "1.5%"],
                children: [],
              },
            ],
          },
        ],
      },
      {
        label: "Cassata",
        values: [8, 15.6, 24.2, "3%", "2.4%", "2.6%"],
        children: [
          {
            label: "North",
            values: [4, 8, 10, "3%", "2.6%", "2.7%"],
            children: [
              {
                label: "Delhi",
                values: [2, 4, 5, "3%", "2.6%", "2.7%"],
                children: [],
              },
              {
                label: "Lucknow",
                values: [1.2, 2.4, 3, "3%", "2.5%", "2.6%"],
                children: [],
              },
              {
                label: "Jaipur",
                values: [0.8, 1.6, 2, "3%", "2.7%", "2.8%"],
                children: [],
              },
            ],
          },
        ],
      },
    ],
    total: ["Total", 587, 771, 924.4, "3%", "3.1%", "3.5%"],
  },

  mom_analysis: {
    title: "MOM Analysis",
    headers: [
      "Year",
      "Quarter",
      "Impressions",
      "Conversion",
      "Spend",
      "CPM",
      "ROAS",
      "Sales",
      "Inorganic Sales",
    ],
    rows: [
      [2025, "Qtr 2", 604, "3%", 291, 482, 3, "2,559", "31%"],
      [2025, "Qtr 3", 405, "3%", 240, 593, 3, "5,240", "12%"],
      [2025, "Qtr 4", 104, "4%", 56, 539, 3, "1,899", "7%"],
    ],
  },

  keyword_analysis: {
    title: "Keyword Analysis",
    headers: ["Keyword", "Impressions", "Conversion", "Spend", "CPM", "ROAS"],
    rows: [
      ["Ice cream", 498, "3%", 313, 628, 2],
      ["Tubs", 152, "2%", 106, 327, 2],
      ["Cornetto", 59, "1%", 27, 465, 1],
      ["Cones", 61, "3%", 23, 380, 3],
      ["Frozen Dessert", 24, "2%", 17, 243, 3],
    ],
  },

  trend_chart: {
    title: "MOM Trend",
    x_key: "month",
    bars: ["cpm"],
    lines: ["conv", "roas"],
    rows: [
      { month: "Jul", cpm: 480, conv: 3, roas: 2.1 },
      { month: "Aug", cpm: 520, conv: 3.2, roas: 2.4 },
      { month: "Sep", cpm: 510, conv: 2.9, roas: 2.2 },
      { month: "Oct", cpm: 560, conv: 3.4, roas: 2.8 },
      { month: "Nov", cpm: 530, conv: 3.1, roas: 2.5 },
    ],
  },
};

export default performanceData;
