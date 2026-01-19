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

  heatmapData: {
    title: "Format Performance (Heatmap)",
    duration: "Last 3 Months",
    headers: [
      "Keyword Type / Keyword / City",
      "Spend",
      "M-1 Spend",
      "M-2 Spend",
      "Conversion",
      "M-1 Conv",
      "M-2 Conv",
    ],

    rows: [
      /* --------------------------------------------------------------------------------------
       MAGNUM
    -------------------------------------------------------------------------------------- */
      {
        label: "Branded",
        values: [164, 203.2, 256.3, "3%", "3.3%", "3.2%"],
        children: [
          {
            label: "ice cream",
            isKeyword: true,
            values: [80, 95, 110, "3%", "3.2%", "3.1%"],
            children: [
              { label: "Delhi", values: [30, 35, 40, "3.1%", "3.3%", "3.2%"] },
              { label: "Mumbai", values: [25, 30, 35, "2.9%", "3.1%", "3.0%"] },
              { label: "Bangalore", values: [25, 30, 35, "3.0%", "3.2%", "3.1%"] },
            ],
          },
          {
            label: "Gourmet",
            isKeyword: true,
            values: [50, 60, 70, "3.5%", "3.6%", "3.4%"],
            children: [
              { label: "Delhi", values: [20, 25, 30, "3.6%", "3.7%", "3.5%"] },
              { label: "Mumbai", values: [15, 18, 20, "3.4%", "3.5%", "3.3%"] },
              { label: "Bangalore", values: [15, 17, 20, "3.5%", "3.6%", "3.4%"] },
            ],
          },
          {
            label: "cassata ice cream",
            isKeyword: true,
            values: [34, 48.2, 76.3, "2.8%", "3.0%", "2.9%"],
            children: [
              { label: "Delhi", values: [14, 18, 26, "2.9%", "3.1%", "3.0%"] },
              { label: "Mumbai", values: [10, 15, 25, "2.7%", "2.9%", "2.8%"] },
              { label: "Bangalore", values: [10, 15.2, 25.3, "2.8%", "3.0%", "2.9%"] },
            ],
          },
        ],
      },

      /* --------------------------------------------------------------------------------------
       CORE TUB
    -------------------------------------------------------------------------------------- */
      {
        label: "Browse",
        values: [151, 199, 224.1, "2%", "2.4%", "2.9%"],
        children: [
          {
            label: "Tubs",
            isKeyword: true,
            values: [100, 120, 140, "2.2%", "2.6%", "3.1%"],
            children: [
              { label: "Delhi", values: [40, 50, 60, "2.3%", "2.7%", "3.2%"] },
              { label: "Pune", values: [30, 35, 40, "2.1%", "2.5%", "3.0%"] },
              { label: "Hyderabad", values: [30, 35, 40, "2.2%", "2.6%", "3.1%"] },
            ],
          },
          {
            label: "Family Pack",
            isKeyword: true,
            values: [51, 79, 84.1, "1.8%", "2.2%", "2.7%"],
            children: [
              { label: "Delhi", values: [21, 30, 34, "1.9%", "2.3%", "2.8%"] },
              { label: "Pune", values: [15, 25, 25, "1.7%", "2.1%", "2.6%"] },
              { label: "Hyderabad", values: [15, 24, 25.1, "1.8%", "2.2%", "2.7%"] },
            ],
          },
        ],
      },
      {
        label: "Competition",
        values: [90, 110, 130, "3.5%", "3.8%", "4.0%"],
        children: [
          {
            label: "Double Chocolate",
            isKeyword: true,
            values: [40, 50, 60, "3.6%", "3.9%", "4.1%"],
            children: [
              { label: "Delhi", values: [15, 20, 25, "3.7%", "4.0%", "4.2%"] },
              { label: "Mumbai", values: [12, 15, 18, "3.5%", "3.8%", "4.0%"] },
              { label: "Bangalore", values: [13, 15, 17, "3.6%", "3.9%", "4.1%"] },
            ],
          },
          {
            label: "Disc",
            isKeyword: true,
            values: [50, 60, 70, "3.4%", "3.7%", "3.9%"],
            children: [
              { label: "Delhi", values: [20, 25, 30, "3.5%", "3.8%", "4.0%"] },
              { label: "Mumbai", values: [15, 18, 20, "3.3%", "3.6%", "3.8%"] },
              { label: "Bangalore", values: [15, 17, 20, "3.4%", "3.7%", "3.9%"] },
            ],
          },
        ],
      },
      {
        label: "Generic",
        values: [60, 75, 85, "2.5%", "2.8%", "3.0%"],
        children: [
          {
            label: "Mini Sticks",
            isKeyword: true,
            values: [40, 50, 55, "2.6%", "2.9%", "3.1%"],
            children: [
              { label: "Delhi", values: [15, 20, 22, "2.7%", "3.0%", "3.2%"] },
              { label: "Mumbai", values: [12, 15, 16, "2.5%", "2.8%", "3.0%"] },
              { label: "Bangalore", values: [13, 15, 17, "2.6%", "2.9%", "3.1%"] },
            ],
          },
          {
            label: "Mini Cups",
            isKeyword: true,
            values: [20, 25, 30, "2.4%", "2.7%", "2.9%"],
            children: [
              { label: "Delhi", values: [8, 10, 12, "2.5%", "2.8%", "3.0%"] },
              { label: "Mumbai", values: [6, 8, 9, "2.3%", "2.6%", "2.8%"] },
              { label: "Bangalore", values: [6, 7, 9, "2.4%", "2.7%", "2.9%"] },
            ],
          },
        ],
      },
    ],
  },
  
  heatmapDataSecond: {
      title: "Q1 - Performing Well",
      duration: "Last 3 Months",
      headers: [
        "Keyword Type / Keyword / City",
        "Spend",
        "M-1 Spend",
        "M-2 Spend",
        "Conversion",
        "M-1 Conv",
        "M-2 Conv",
      ],
      rows: [],
    },
    heatmapDataThird: {
      title: "Q2 - Need Attention",
      duration: "Last 3 Months",
      headers: [
        "Keyword Type / Keyword / City",
        "Spend",
        "M-1 Spend",
        "M-2 Spend",
        "Conversion",
        "M-1 Conv",
        "M-2 Conv",
      ],
      rows: [],
    },
    heatmapDataFourth: {
      title: "Q3 - Experiment",
      duration: "Last 3 Months",
      headers: [
        "Keyword Type / Keyword / City",
        "Spend",
        "M-1 Spend",
        "M-2 Spend",
        "Conversion",
        "M-1 Conv",
        "M-2 Conv",
      ],
      rows: [],
    },
    heatmapDataFifth: {
      title: "Q4 - Opportunity",
      duration: "Last 3 Months",
      headers: [
        "Keyword Type / Keyword / City",
        "Spend",
        "M-1 Spend",
        "M-2 Spend",
        "Conversion",
        "M-1 Conv",
        "M-2 Conv",
      ],
      rows: [],
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

  // ⭐ NEW: Insight mapping → filters
  insightFilters: {
    "All Campaign Summary": "all",
    "Q1 · Perform Well – Continue": "performing",
    "Q2 · Need Attention – Optimize": "attention",
    "Q3 · Experiment – Optimize then Scale": "experiment",
    "Q4 · Opportunity – Scale Up Spends": "opportunity",
  },

  // ⭐ NEW: Filtering logic
  filterRules: {
    all: () => true,

    performing: (row) => parseFloat(row.values[3]) >= 3.0,

    attention: (row) => parseFloat(row.values[3]) < 2.0,

    experiment: (row) =>
      parseFloat(row.values[3]) >= 2.0 && parseFloat(row.values[3]) < 3.0,

    opportunity: (row) => Number(row.values[0]) > 50, // spend > 50
  },
};

export default performanceData;
