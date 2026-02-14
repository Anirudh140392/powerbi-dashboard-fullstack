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
      rows: [
        {
          label: "Branded",
          values: [189, 233.7, 294.7, "3.3%", "3.6%", "3.5%"],
          children: [
            {
              label: "ice cream",
              isKeyword: true,
              values: [92, 109, 126, "3.3%", "3.5%", "3.4%"],
              children: [
                { label: "Delhi", values: [35, 40, 48, "3.4%", "3.6%", "3.5%"] },
                { label: "Mumbai", values: [29, 35, 40, "3.2%", "3.4%", "3.3%"] },
                { label: "Bangalore", values: [28, 34, 38, "3.3%", "3.5%", "3.4%"] },
              ],
            },
            {
              label: "Gourmet",
              isKeyword: true,
              values: [57, 69, 81, "3.8%", "3.9%", "3.7%"],
              children: [
                { label: "Delhi", values: [22, 27, 32, "3.9%", "4.0%", "3.8%"] },
                { label: "Mumbai", values: [18, 21, 25, "3.7%", "3.8%", "3.6%"] },
                { label: "Bangalore", values: [17, 21, 24, "3.8%", "3.9%", "3.7%"] },
              ],
            },
            {
              label: "cassata ice cream",
              isKeyword: true,
              values: [40, 55.4, 87.7, "3.1%", "3.3%", "3.2%"],
              children: [
                { label: "Delhi", values: [16, 22, 35, "3.2%", "3.4%", "3.3%"] },
                { label: "Mumbai", values: [12, 17, 27, "3.0%", "3.2%", "3.1%"] },
                { label: "Bangalore", values: [12, 16.4, 25.7, "3.1%", "3.3%", "3.2%"] },
              ],
            },
          ],
        },
        {
          label: "Browse",
          values: [174, 229, 257.7, "2.3%", "2.7%", "3.2%"],
          children: [
            {
              label: "Tubs",
              isKeyword: true,
              values: [115, 138, 162, "2.5%", "2.9%", "3.4%"],
              children: [
                { label: "Delhi", values: [46, 57, 69, "2.6%", "3.0%", "3.5%"] },
                { label: "Pune", values: [35, 41, 47, "2.4%", "2.8%", "3.3%"] },
                { label: "Hyderabad", values: [34, 40, 46, "2.5%", "2.9%", "3.4%"] },
              ],
            },
            {
              label: "Family Pack",
              isKeyword: true,
              values: [59, 91, 95.7, "2.1%", "2.5%", "3.0%"],
              children: [
                { label: "Delhi", values: [24, 34, 39, "2.2%", "2.6%", "3.1%"] },
                { label: "Pune", values: [17, 29, 28, "2.0%", "2.4%", "2.9%"] },
                { label: "Hyderabad", values: [18, 28, 28.7, "2.1%", "2.5%", "3.0%"] },
              ],
            },
          ],
        },
        {
          label: "Competition",
          values: [103, 126, 150, "3.8%", "4.1%", "4.3%"],
          children: [
            {
              label: "Double Chocolate",
              isKeyword: true,
              values: [46, 57, 69, "3.9%", "4.2%", "4.4%"],
              children: [
                { label: "Delhi", values: [17, 23, 29, "4.0%", "4.3%", "4.5%"] },
                { label: "Mumbai", values: [14, 17, 21, "3.8%", "4.1%", "4.3%"] },
                { label: "Bangalore", values: [15, 17, 19, "3.9%", "4.2%", "4.4%"] },
              ],
            },
            {
              label: "Disc",
              isKeyword: true,
              values: [57, 69, 81, "3.7%", "4.0%", "4.2%"],
              children: [
                { label: "Delhi", values: [23, 29, 35, "3.8%", "4.1%", "4.3%"] },
                { label: "Mumbai", values: [17, 21, 23, "3.6%", "3.9%", "4.1%"] },
                { label: "Bangalore", values: [17, 19, 23, "3.7%", "4.0%", "4.2%"] },
              ],
            },
          ],
        },
        {
          label: "Generic",
          values: [69, 86, 98, "2.8%", "3.1%", "3.3%"],
          children: [
            {
              label: "Mini Sticks",
              isKeyword: true,
              values: [46, 57, 63, "2.9%", "3.2%", "3.4%"],
              children: [
                { label: "Delhi", values: [17, 23, 25, "3.0%", "3.3%", "3.5%"] },
                { label: "Mumbai", values: [14, 17, 19, "2.8%", "3.1%", "3.3%"] },
                { label: "Bangalore", values: [15, 17, 19, "2.9%", "3.2%", "3.4%"] },
              ],
            },
            {
              label: "Mini Cups",
              isKeyword: true,
              values: [23, 29, 35, "2.7%", "3.0%", "3.2%"],
              children: [
                { label: "Delhi", values: [9, 12, 14, "2.8%", "3.1%", "3.3%"] },
                { label: "Mumbai", values: [7, 9, 10, "2.6%", "2.9%", "3.1%"] },
                { label: "Bangalore", values: [7, 8, 11, "2.7%", "3.0%", "3.2%"] },
              ],
            },
          ],
        },
      ],
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
      rows: [
        {
          label: "Branded",
          values: [210, 245, 312, "1.5%", "1.8%", "1.6%"],
          children: [
            {
              label: "Premium Bars",
              isKeyword: true,
              values: [98, 115, 142, "1.4%", "1.7%", "1.5%"],
              children: [
                { label: "Chennai", values: [38, 45, 55, "1.5%", "1.8%", "1.6%"] },
                { label: "Kolkata", values: [32, 38, 48, "1.3%", "1.6%", "1.4%"] },
                { label: "Ahmedabad", values: [28, 32, 39, "1.4%", "1.7%", "1.5%"] },
              ],
            },
            {
              label: "Chocolate Range",
              isKeyword: true,
              values: [67, 78, 98, "1.6%", "1.9%", "1.7%"],
              children: [
                { label: "Chennai", values: [26, 31, 39, "1.7%", "2.0%", "1.8%"] },
                { label: "Kolkata", values: [22, 26, 33, "1.5%", "1.8%", "1.6%"] },
                { label: "Ahmedabad", values: [19, 21, 26, "1.6%", "1.9%", "1.7%"] },
              ],
            },
            {
              label: "Vanilla Classic",
              isKeyword: true,
              values: [45, 52, 72, "1.5%", "1.8%", "1.6%"],
              children: [
                { label: "Chennai", values: [18, 21, 29, "1.6%", "1.9%", "1.7%"] },
                { label: "Kolkata", values: [15, 17, 24, "1.4%", "1.7%", "1.5%"] },
                { label: "Ahmedabad", values: [12, 14, 19, "1.5%", "1.8%", "1.6%"] },
              ],
            },
          ],
        },
        {
          label: "Browse",
          values: [185, 215, 268, "1.2%", "1.5%", "1.3%"],
          children: [
            {
              label: "Kulfi",
              isKeyword: true,
              values: [89, 103, 129, "1.3%", "1.6%", "1.4%"],
              children: [
                { label: "Chennai", values: [35, 41, 52, "1.4%", "1.7%", "1.5%"] },
                { label: "Kolkata", values: [29, 34, 42, "1.2%", "1.5%", "1.3%"] },
                { label: "Ahmedabad", values: [25, 28, 35, "1.3%", "1.6%", "1.4%"] },
              ],
            },
            {
              label: "Candy Sticks",
              isKeyword: true,
              values: [56, 65, 82, "1.1%", "1.4%", "1.2%"],
              children: [
                { label: "Chennai", values: [22, 26, 33, "1.2%", "1.5%", "1.3%"] },
                { label: "Kolkata", values: [19, 22, 28, "1.0%", "1.3%", "1.1%"] },
                { label: "Ahmedabad", values: [15, 17, 21, "1.1%", "1.4%", "1.2%"] },
              ],
            },
            {
              label: "Fruit Bars",
              isKeyword: true,
              values: [40, 47, 57, "1.2%", "1.5%", "1.3%"],
              children: [
                { label: "Chennai", values: [16, 19, 23, "1.3%", "1.6%", "1.4%"] },
                { label: "Kolkata", values: [13, 15, 19, "1.1%", "1.4%", "1.2%"] },
                { label: "Ahmedabad", values: [11, 13, 15, "1.2%", "1.5%", "1.3%"] },
              ],
            },
          ],
        },
        {
          label: "Competition",
          values: [145, 168, 210, "1.8%", "2.1%", "1.9%"],
          children: [
            {
              label: "Sundae",
              isKeyword: true,
              values: [72, 84, 105, "1.9%", "2.2%", "2.0%"],
              children: [
                { label: "Chennai", values: [29, 34, 42, "2.0%", "2.3%", "2.1%"] },
                { label: "Kolkata", values: [24, 28, 35, "1.8%", "2.1%", "1.9%"] },
                { label: "Ahmedabad", values: [19, 22, 28, "1.9%", "2.2%", "2.0%"] },
              ],
            },
            {
              label: "Cone Variety",
              isKeyword: true,
              values: [73, 84, 105, "1.7%", "2.0%", "1.8%"],
              children: [
                { label: "Chennai", values: [29, 34, 42, "1.8%", "2.1%", "1.9%"] },
                { label: "Kolkata", values: [24, 28, 35, "1.6%", "1.9%", "1.7%"] },
                { label: "Ahmedabad", values: [20, 22, 28, "1.7%", "2.0%", "1.8%"] },
              ],
            },
          ],
        },
        {
          label: "Generic",
          values: [95, 112, 138, "1.4%", "1.7%", "1.5%"],
          children: [
            {
              label: "Budget Cups",
              isKeyword: true,
              values: [52, 61, 76, "1.5%", "1.8%", "1.6%"],
              children: [
                { label: "Chennai", values: [21, 25, 31, "1.6%", "1.9%", "1.7%"] },
                { label: "Kolkata", values: [17, 20, 25, "1.4%", "1.7%", "1.5%"] },
                { label: "Ahmedabad", values: [14, 16, 20, "1.5%", "1.8%", "1.6%"] },
              ],
            },
            {
              label: "Value Bars",
              isKeyword: true,
              values: [43, 51, 62, "1.3%", "1.6%", "1.4%"],
              children: [
                { label: "Chennai", values: [17, 21, 25, "1.4%", "1.7%", "1.5%"] },
                { label: "Kolkata", values: [14, 17, 21, "1.2%", "1.5%", "1.3%"] },
                { label: "Ahmedabad", values: [12, 13, 16, "1.3%", "1.6%", "1.4%"] },
              ],
            },
          ],
        },
      ],
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
      rows: [
        {
          label: "Branded",
          values: [156, 182, 228, "2.4%", "2.7%", "2.5%"],
          children: [
            {
              label: "Mango Delight",
              isKeyword: true,
              values: [72, 84, 105, "2.5%", "2.8%", "2.6%"],
              children: [
                { label: "Jaipur", values: [28, 33, 42, "2.6%", "2.9%", "2.7%"] },
                { label: "Lucknow", values: [24, 28, 35, "2.4%", "2.7%", "2.5%"] },
                { label: "Chandigarh", values: [20, 23, 28, "2.5%", "2.8%", "2.6%"] },
              ],
            },
            {
              label: "Butterscotch",
              isKeyword: true,
              values: [48, 56, 70, "2.3%", "2.6%", "2.4%"],
              children: [
                { label: "Jaipur", values: [19, 22, 28, "2.4%", "2.7%", "2.5%"] },
                { label: "Lucknow", values: [16, 19, 24, "2.2%", "2.5%", "2.3%"] },
                { label: "Chandigarh", values: [13, 15, 18, "2.3%", "2.6%", "2.4%"] },
              ],
            },
            {
              label: "Strawberry Swirl",
              isKeyword: true,
              values: [36, 42, 53, "2.4%", "2.7%", "2.5%"],
              children: [
                { label: "Jaipur", values: [14, 17, 21, "2.5%", "2.8%", "2.6%"] },
                { label: "Lucknow", values: [12, 14, 18, "2.3%", "2.6%", "2.4%"] },
                { label: "Chandigarh", values: [10, 11, 14, "2.4%", "2.7%", "2.5%"] },
              ],
            },
          ],
        },
        {
          label: "Browse",
          values: [132, 154, 193, "2.6%", "2.9%", "2.7%"],
          children: [
            {
              label: "Novelty Items",
              isKeyword: true,
              values: [65, 76, 95, "2.7%", "3.0%", "2.8%"],
              children: [
                { label: "Jaipur", values: [26, 30, 38, "2.8%", "3.1%", "2.9%"] },
                { label: "Lucknow", values: [22, 26, 32, "2.6%", "2.9%", "2.7%"] },
                { label: "Chandigarh", values: [17, 20, 25, "2.7%", "3.0%", "2.8%"] },
              ],
            },
            {
              label: "Party Packs",
              isKeyword: true,
              values: [42, 49, 61, "2.5%", "2.8%", "2.6%"],
              children: [
                { label: "Jaipur", values: [17, 20, 25, "2.6%", "2.9%", "2.7%"] },
                { label: "Lucknow", values: [14, 16, 20, "2.4%", "2.7%", "2.5%"] },
                { label: "Chandigarh", values: [11, 13, 16, "2.5%", "2.8%", "2.6%"] },
              ],
            },
            {
              label: "Seasonal Specials",
              isKeyword: true,
              values: [25, 29, 37, "2.6%", "2.9%", "2.7%"],
              children: [
                { label: "Jaipur", values: [10, 12, 15, "2.7%", "3.0%", "2.8%"] },
                { label: "Lucknow", values: [8, 10, 12, "2.5%", "2.8%", "2.6%"] },
                { label: "Chandigarh", values: [7, 7, 10, "2.6%", "2.9%", "2.7%"] },
              ],
            },
          ],
        },
        {
          label: "Competition",
          values: [118, 138, 172, "2.2%", "2.5%", "2.3%"],
          children: [
            {
              label: "Sorbet Range",
              isKeyword: true,
              values: [58, 68, 85, "2.3%", "2.6%", "2.4%"],
              children: [
                { label: "Jaipur", values: [23, 27, 34, "2.4%", "2.7%", "2.5%"] },
                { label: "Lucknow", values: [20, 23, 29, "2.2%", "2.5%", "2.3%"] },
                { label: "Chandigarh", values: [15, 18, 22, "2.3%", "2.6%", "2.4%"] },
              ],
            },
            {
              label: "Frozen Yogurt",
              isKeyword: true,
              values: [60, 70, 87, "2.1%", "2.4%", "2.2%"],
              children: [
                { label: "Jaipur", values: [24, 28, 35, "2.2%", "2.5%", "2.3%"] },
                { label: "Lucknow", values: [20, 24, 29, "2.0%", "2.3%", "2.1%"] },
                { label: "Chandigarh", values: [16, 18, 23, "2.1%", "2.4%", "2.2%"] },
              ],
            },
          ],
        },
        {
          label: "Generic",
          values: [78, 91, 114, "2.8%", "3.1%", "2.9%"],
          children: [
            {
              label: "Economy Range",
              isKeyword: true,
              values: [42, 49, 62, "2.9%", "3.2%", "3.0%"],
              children: [
                { label: "Jaipur", values: [17, 20, 25, "3.0%", "3.3%", "3.1%"] },
                { label: "Lucknow", values: [14, 16, 21, "2.8%", "3.1%", "2.9%"] },
                { label: "Chandigarh", values: [11, 13, 16, "2.9%", "3.2%", "3.0%"] },
              ],
            },
            {
              label: "Family Favorites",
              isKeyword: true,
              values: [36, 42, 52, "2.7%", "3.0%", "2.8%"],
              children: [
                { label: "Jaipur", values: [14, 17, 21, "2.8%", "3.1%", "2.9%"] },
                { label: "Lucknow", values: [12, 14, 17, "2.6%", "2.9%", "2.7%"] },
                { label: "Chandigarh", values: [10, 11, 14, "2.7%", "3.0%", "2.8%"] },
              ],
            },
          ],
        },
      ],
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
      rows: [
        {
          label: "Branded",
          values: [245, 285, 358, "3.8%", "4.1%", "3.9%"],
          children: [
            {
              label: "Premium Collection",
              isKeyword: true,
              values: [112, 130, 164, "3.9%", "4.2%", "4.0%"],
              children: [
                { label: "Surat", values: [44, 52, 66, "4.0%", "4.3%", "4.1%"] },
                { label: "Nagpur", values: [38, 44, 55, "3.8%", "4.1%", "3.9%"] },
                { label: "Indore", values: [30, 34, 43, "3.9%", "4.2%", "4.0%"] },
              ],
            },
            {
              label: "Artisan Flavors",
              isKeyword: true,
              values: [78, 91, 114, "3.7%", "4.0%", "3.8%"],
              children: [
                { label: "Surat", values: [31, 36, 46, "3.8%", "4.1%", "3.9%"] },
                { label: "Nagpur", values: [26, 31, 38, "3.6%", "3.9%", "3.7%"] },
                { label: "Indore", values: [21, 24, 30, "3.7%", "4.0%", "3.8%"] },
              ],
            },
            {
              label: "Signature Series",
              isKeyword: true,
              values: [55, 64, 80, "3.8%", "4.1%", "3.9%"],
              children: [
                { label: "Surat", values: [22, 26, 32, "3.9%", "4.2%", "4.0%"] },
                { label: "Nagpur", values: [18, 21, 27, "3.7%", "4.0%", "3.8%"] },
                { label: "Indore", values: [15, 17, 21, "3.8%", "4.1%", "3.9%"] },
              ],
            },
          ],
        },
        {
          label: "Browse",
          values: [198, 231, 289, "4.2%", "4.5%", "4.3%"],
          children: [
            {
              label: "Healthy Options",
              isKeyword: true,
              values: [95, 111, 139, "4.3%", "4.6%", "4.4%"],
              children: [
                { label: "Surat", values: [38, 44, 56, "4.4%", "4.7%", "4.5%"] },
                { label: "Nagpur", values: [32, 37, 47, "4.2%", "4.5%", "4.3%"] },
                { label: "Indore", values: [25, 30, 36, "4.3%", "4.6%", "4.4%"] },
              ],
            },
            {
              label: "Sugar-Free Line",
              isKeyword: true,
              values: [62, 72, 90, "4.1%", "4.4%", "4.2%"],
              children: [
                { label: "Surat", values: [25, 29, 36, "4.2%", "4.5%", "4.3%"] },
                { label: "Nagpur", values: [21, 24, 31, "4.0%", "4.3%", "4.1%"] },
                { label: "Indore", values: [16, 19, 23, "4.1%", "4.4%", "4.2%"] },
              ],
            },
            {
              label: "Protein Rich",
              isKeyword: true,
              values: [41, 48, 60, "4.2%", "4.5%", "4.3%"],
              children: [
                { label: "Surat", values: [16, 19, 24, "4.3%", "4.6%", "4.4%"] },
                { label: "Nagpur", values: [14, 16, 20, "4.1%", "4.4%", "4.2%"] },
                { label: "Indore", values: [11, 13, 16, "4.2%", "4.5%", "4.3%"] },
              ],
            },
          ],
        },
        {
          label: "Competition",
          values: [167, 194, 243, "3.5%", "3.8%", "3.6%"],
          children: [
            {
              label: "Premium Cones",
              isKeyword: true,
              values: [82, 96, 120, "3.6%", "3.9%", "3.7%"],
              children: [
                { label: "Surat", values: [33, 38, 48, "3.7%", "4.0%", "3.8%"] },
                { label: "Nagpur", values: [28, 32, 41, "3.5%", "3.8%", "3.6%"] },
                { label: "Indore", values: [21, 26, 31, "3.6%", "3.9%", "3.7%"] },
              ],
            },
            {
              label: "Luxury Tubs",
              isKeyword: true,
              values: [85, 98, 123, "3.4%", "3.7%", "3.5%"],
              children: [
                { label: "Surat", values: [34, 39, 49, "3.5%", "3.8%", "3.6%"] },
                { label: "Nagpur", values: [29, 33, 42, "3.3%", "3.6%", "3.4%"] },
                { label: "Indore", values: [22, 26, 32, "3.4%", "3.7%", "3.5%"] },
              ],
            },
          ],
        },
        {
          label: "Generic",
          values: [112, 130, 163, "4.5%", "4.8%", "4.6%"],
          children: [
            {
              label: "Classic Favorites",
              isKeyword: true,
              values: [62, 72, 90, "4.6%", "4.9%", "4.7%"],
              children: [
                { label: "Surat", values: [25, 29, 36, "4.7%", "5.0%", "4.8%"] },
                { label: "Nagpur", values: [21, 24, 31, "4.5%", "4.8%", "4.6%"] },
                { label: "Indore", values: [16, 19, 23, "4.6%", "4.9%", "4.7%"] },
              ],
            },
            {
              label: "Best Sellers",
              isKeyword: true,
              values: [50, 58, 73, "4.4%", "4.7%", "4.5%"],
              children: [
                { label: "Surat", values: [20, 23, 29, "4.5%", "4.8%", "4.6%"] },
                { label: "Nagpur", values: [17, 20, 25, "4.3%", "4.6%", "4.4%"] },
                { label: "Indore", values: [13, 15, 19, "4.4%", "4.7%", "4.5%"] },
              ],
            },
          ],
        },
      ],
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
