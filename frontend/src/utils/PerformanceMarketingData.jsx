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
      "Format / Region / City / Keyword",
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
        label: "Magnum",
        values: [164, 203.2, 256.3, "3%", "3.3%", "3.2%"],
        children: [
          /* ---------------- NORTH ---------------- */
          {
            label: "North",
            values: [60, 72, 81, "3%", "3.1%", "3.2%"],
            children: [
              {
                label: "Delhi",
                values: [25, 30, 34, "3%", "3.1%", "3.2%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [25, 30, 34, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [25, 30, 34, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [25, 30, 34, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [25, 30, 34, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [25, 30, 34, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [25, 30, 34, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [25, 30, 34, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },
              {
                label: "Lucknow",
                values: [20, 24, 27, "3%", "3.0%", "3.1%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [20, 24, 27, "3%", "3.0%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [20, 24, 27, "3%", "3.0%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [20, 24, 27, "3%", "3.0%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [20, 24, 27, "3%", "3.0%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [20, 24, 27, "3%", "3.0%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [20, 24, 27, "3%", "3.0%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [20, 24, 27, "3%", "3.0%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },
              {
                label: "Jaipur",
                values: [15, 18, 20, "3%", "3.1%", "3.2%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [15, 18, 20, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [15, 18, 20, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [15, 18, 20, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [15, 18, 20, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [15, 18, 20, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [15, 18, 20, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [15, 18, 20, "3%", "3.1%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },
            ],
          },

          /* ---------------- SOUTH ---------------- */
          {
            label: "South",
            values: [45, 62, 70, "2%", "2.4%", "2.3%"],
            children: [
              {
                label: "Bengaluru",
                values: [18, 24, 27, "2%", "2.3%", "2.2%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [18, 24, 27, "2%", "2.3%", "2.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [18, 24, 27, "2%", "2.3%", "2.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [18, 24, 27, "2%", "2.3%", "2.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [18, 24, 27, "2%", "2.3%", "2.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [18, 24, 27, "2%", "2.3%", "2.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [18, 24, 27, "2%", "2.3%", "2.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [18, 24, 27, "2%", "2.3%", "2.2%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },
              {
                label: "Chennai",
                values: [14, 20, 23, "2%", "2.5%", "2.4%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [14, 20, 23, "2%", "2.5%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [14, 20, 23, "2%", "2.5%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [14, 20, 23, "2%", "2.5%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [14, 20, 23, "2%", "2.5%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [14, 20, 23, "2%", "2.5%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [14, 20, 23, "2%", "2.5%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [14, 20, 23, "2%", "2.5%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },
              {
                label: "Hyderabad",
                values: [13, 18, 20, "2%", "2.4%", "2.3%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [13, 18, 20, "2%", "2.4%", "2.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [13, 18, 20, "2%", "2.4%", "2.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [13, 18, 20, "2%", "2.4%", "2.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [13, 18, 20, "2%", "2.4%", "2.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [13, 18, 20, "2%", "2.4%", "2.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [13, 18, 20, "2%", "2.4%", "2.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [13, 18, 20, "2%", "2.4%", "2.3%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },
            ],
          },

          /* ---------------- EAST ---------------- */
          {
            label: "East",
            values: [30, 41, 55, "4%", "3.9%", "4.1%"],
            children: [
              {
                label: "Kolkata",
                values: [15, 20, 27, "4%", "3.8%", "4.0%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [15, 20, 27, "4%", "3.8%", "4.0%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [15, 20, 27, "4%", "3.8%", "4.0%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [15, 20, 27, "4%", "3.8%", "4.0%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [15, 20, 27, "4%", "3.8%", "4.0%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [15, 20, 27, "4%", "3.8%", "4.0%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [15, 20, 27, "4%", "3.8%", "4.0%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [15, 20, 27, "4%", "3.8%", "4.0%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Patna",
                values: [8, 11, 15, "4%", "4.0%", "4.2%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [8, 11, 15, "4%", "4.0%", "4.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [8, 11, 15, "4%", "4.0%", "4.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [8, 11, 15, "4%", "4.0%", "4.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [8, 11, 15, "4%", "4.0%", "4.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [8, 11, 15, "4%", "4.0%", "4.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [8, 11, 15, "4%", "4.0%", "4.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [8, 11, 15, "4%", "4.0%", "4.2%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Bhubaneswar",
                values: [7, 10, 13, "4%", "3.9%", "4.1%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [7, 10, 13, "4%", "3.9%", "4.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [7, 10, 13, "4%", "3.9%", "4.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [7, 10, 13, "4%", "3.9%", "4.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [7, 10, 13, "4%", "3.9%", "4.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [7, 10, 13, "4%", "3.9%", "4.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [7, 10, 13, "4%", "3.9%", "4.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [7, 10, 13, "4%", "3.9%", "4.1%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },
            ],
          },

          /* ---------------- WEST ---------------- */
          {
            label: "West",
            values: [29, 28, 50, "3%", "3.4%", "3.3%"],
            children: [
              {
                label: "Mumbai",
                values: [12, 11, 20, "3%", "3.4%", "3.3%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [12, 11, 20, "3%", "3.4%", "3.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [12, 11, 20, "3%", "3.4%", "3.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [12, 11, 20, "3%", "3.4%", "3.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [12, 11, 20, "3%", "3.4%", "3.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [12, 11, 20, "3%", "3.4%", "3.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [12, 11, 20, "3%", "3.4%", "3.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [12, 11, 20, "3%", "3.4%", "3.3%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Pune",
                values: [10, 9, 16, "3%", "3.5%", "3.4%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [10, 9, 16, "3%", "3.5%", "3.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [10, 9, 16, "3%", "3.5%", "3.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [10, 9, 16, "3%", "3.5%", "3.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [10, 9, 16, "3%", "3.5%", "3.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [10, 9, 16, "3%", "3.5%", "3.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [10, 9, 16, "3%", "3.5%", "3.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [10, 9, 16, "3%", "3.5%", "3.4%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Ahmedabad",
                values: [7, 8, 14, "3%", "3.3%", "3.2%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [7, 8, 14, "3%", "3.3%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [7, 8, 14, "3%", "3.3%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [7, 8, 14, "3%", "3.3%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [7, 8, 14, "3%", "3.3%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [7, 8, 14, "3%", "3.3%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [7, 8, 14, "3%", "3.3%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [7, 8, 14, "3%", "3.3%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },
            ],
          },
        ],
      },

      /* --------------------------------------------------------------------------------------
       CORE TUB
    -------------------------------------------------------------------------------------- */
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
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [22, 30, 34, "2%", "2.3%", "2.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [22, 30, 34, "2%", "2.3%", "2.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [22, 30, 34, "2%", "2.3%", "2.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [22, 30, 34, "2%", "2.3%", "2.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [22, 30, 34, "2%", "2.3%", "2.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [22, 30, 34, "2%", "2.3%", "2.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [22, 30, 34, "2%", "2.3%", "2.5%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Chandigarh",
                values: [18, 25, 28, "2%", "2.4%", "2.6%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [18, 25, 28, "2%", "2.4%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [18, 25, 28, "2%", "2.4%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [18, 25, 28, "2%", "2.4%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [18, 25, 28, "2%", "2.4%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [18, 25, 28, "2%", "2.4%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [18, 25, 28, "2%", "2.4%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [18, 25, 28, "2%", "2.4%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Jaipur",
                values: [15, 21, 23, "2%", "2.2%", "2.4%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [15, 21, 23, "2%", "2.2%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [15, 21, 23, "2%", "2.2%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [15, 21, 23, "2%", "2.2%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [15, 21, 23, "2%", "2.2%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [15, 21, 23, "2%", "2.2%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [15, 21, 23, "2%", "2.2%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [15, 21, 23, "2%", "2.2%", "2.4%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
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
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [16, 22, 25, "1%", "1.4%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [16, 22, 25, "1%", "1.4%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [16, 22, 25, "1%", "1.4%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [16, 22, 25, "1%", "1.4%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [16, 22, 25, "1%", "1.4%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [16, 22, 25, "1%", "1.4%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [16, 22, 25, "1%", "1.4%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Bengaluru",
                values: [14, 20, 22, "1%", "1.5%", "1.7%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [14, 20, 22, "1%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [14, 20, 22, "1%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [14, 20, 22, "1%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [14, 20, 22, "1%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [14, 20, 22, "1%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [14, 20, 22, "1%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [14, 20, 22, "1%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Hyderabad",
                values: [10, 14, 16, "1%", "1.3%", "1.6%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [10, 14, 16, "1%", "1.3%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [10, 14, 16, "1%", "1.3%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [10, 14, 16, "1%", "1.3%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [10, 14, 16, "1%", "1.3%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [10, 14, 16, "1%", "1.3%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [10, 14, 16, "1%", "1.3%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [10, 14, 16, "1%", "1.3%", "1.6%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },
            ],
          },
        ],
      },

      /* --------------------------------------------------------------------------------------
       PREMIUM TUB
    -------------------------------------------------------------------------------------- */
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
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [80, 108, 124, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [80, 108, 124, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [80, 108, 124, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [80, 108, 124, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [80, 108, 124, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [80, 108, 124, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [80, 108, 124, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Tier 1",
                values: [34, 45, 53, "1%", "0.8%", "0.7%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [34, 45, 53, "1%", "0.8%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [34, 45, 53, "1%", "0.8%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [34, 45, 53, "1%", "0.8%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [34, 45, 53, "1%", "0.8%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [34, 45, 53, "1%", "0.8%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [34, 45, 53, "1%", "0.8%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [34, 45, 53, "1%", "0.8%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Tier 2 & 3",
                values: [20, 25, 31, "1%", "0.7%", "0.7%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [20, 25, 31, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [20, 25, 31, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [20, 25, 31, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [20, 25, 31, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [20, 25, 31, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [20, 25, 31, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [20, 25, 31, "1%", "0.7%", "0.7%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },
            ],
          },
        ],
      },

      /* --------------------------------------------------------------------------------------
       CORNETTO
    -------------------------------------------------------------------------------------- */
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
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [15, 22, 26, "2%", "1.6%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [15, 22, 26, "2%", "1.6%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [15, 22, 26, "2%", "1.6%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [15, 22, 26, "2%", "1.6%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [15, 22, 26, "2%", "1.6%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [15, 22, 26, "2%", "1.6%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [15, 22, 26, "2%", "1.6%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Lucknow",
                values: [10, 14, 17, "2%", "1.7%", "1.8%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [10, 14, 17, "2%", "1.7%", "1.8%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [10, 14, 17, "2%", "1.7%", "1.8%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [10, 14, 17, "2%", "1.7%", "1.8%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [10, 14, 17, "2%", "1.7%", "1.8%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [10, 14, 17, "2%", "1.7%", "1.8%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [10, 14, 17, "2%", "1.7%", "1.8%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [10, 14, 17, "2%", "1.7%", "1.8%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Jaipur",
                values: [9, 12, 14, "2%", "1.5%", "1.7%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [9, 12, 14, "2%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [9, 12, 14, "2%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [9, 12, 14, "2%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [9, 12, 14, "2%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [9, 12, 14, "2%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [9, 12, 14, "2%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [9, 12, 14, "2%", "1.5%", "1.7%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
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
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [9, 14, 19, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [9, 14, 19, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [9, 14, 19, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [9, 14, 19, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [9, 14, 19, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [9, 14, 19, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [9, 14, 19, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Chennai",
                values: [7, 10, 14, "1%", "1.2%", "1.3%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [7, 10, 14, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [7, 10, 14, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [7, 10, 14, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [7, 10, 14, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [7, 10, 14, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [7, 10, 14, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [7, 10, 14, "1%", "1.2%", "1.3%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Hyderabad",
                values: [6, 9, 12, "1%", "1.1%", "1.2%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [6, 9, 12, "1%", "1.1%", "1.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [6, 9, 12, "1%", "1.1%", "1.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [6, 9, 12, "1%", "1.1%", "1.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [6, 9, 12, "1%", "1.1%", "1.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [6, 9, 12, "1%", "1.1%", "1.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [6, 9, 12, "1%", "1.1%", "1.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [6, 9, 12, "1%", "1.1%", "1.2%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
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
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [14, 16, 23, "3%", "2.9%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [14, 16, 23, "3%", "2.9%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [14, 16, 23, "3%", "2.9%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [14, 16, 23, "3%", "2.9%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [14, 16, 23, "3%", "2.9%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [14, 16, 23, "3%", "2.9%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [14, 16, 23, "3%", "2.9%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Pune",
                values: [9, 11, 14, "3%", "3.0%", "3.2%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [9, 11, 14, "3%", "3.0%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [9, 11, 14, "3%", "3.0%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [9, 11, 14, "3%", "3.0%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [9, 11, 14, "3%", "3.0%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [9, 11, 14, "3%", "3.0%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [9, 11, 14, "3%", "3.0%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [9, 11, 14, "3%", "3.0%", "3.2%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Surat",
                values: [8, 9, 12, "3%", "2.8%", "3.1%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [8, 9, 12, "3%", "2.8%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [8, 9, 12, "3%", "2.8%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [8, 9, 12, "3%", "2.8%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [8, 9, 12, "3%", "2.8%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [8, 9, 12, "3%", "2.8%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [8, 9, 12, "3%", "2.8%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [8, 9, 12, "3%", "2.8%", "3.1%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },
            ],
          },
        ],
      },

      /* --------------------------------------------------------------------------------------
       SLOW CHURN
    -------------------------------------------------------------------------------------- */
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
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [18, 22, 20, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [18, 22, 20, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [18, 22, 20, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [18, 22, 20, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [18, 22, 20, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [18, 22, 20, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [18, 22, 20, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Tier 1",
                values: [10, 12, 11, "2%", "1.5%", "1.5%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [10, 12, 11, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [10, 12, 11, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [10, 12, 11, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [10, 12, 11, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [10, 12, 11, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [10, 12, 11, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [10, 12, 11, "2%", "1.5%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Tier 2 & 3",
                values: [7, 8.4, 9.3, "2%", "1.4%", "1.5%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [7, 8.4, 9.3, "2%", "1.4%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [7, 8.4, 9.3, "2%", "1.4%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [7, 8.4, 9.3, "2%", "1.4%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [7, 8.4, 9.3, "2%", "1.4%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [7, 8.4, 9.3, "2%", "1.4%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [7, 8.4, 9.3, "2%", "1.4%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [7, 8.4, 9.3, "2%", "1.4%", "1.5%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },
            ],
          },
        ],
      },

      /* --------------------------------------------------------------------------------------
       CASSATA
    -------------------------------------------------------------------------------------- */
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
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [2, 4, 5, "3%", "2.6%", "2.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [2, 4, 5, "3%", "2.6%", "2.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [2, 4, 5, "3%", "2.6%", "2.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [2, 4, 5, "3%", "2.6%", "2.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [2, 4, 5, "3%", "2.6%", "2.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [2, 4, 5, "3%", "2.6%", "2.7%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [2, 4, 5, "3%", "2.6%", "2.7%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Lucknow",
                values: [1.2, 2.4, 3, "3%", "2.5%", "2.6%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [1.2, 2.4, 3, "3%", "2.5%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [1.2, 2.4, 3, "3%", "2.5%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [1.2, 2.4, 3, "3%", "2.5%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [1.2, 2.4, 3, "3%", "2.5%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [1.2, 2.4, 3, "3%", "2.5%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [1.2, 2.4, 3, "3%", "2.5%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [1.2, 2.4, 3, "3%", "2.5%", "2.6%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },

              {
                label: "Jaipur",
                values: [0.8, 1.6, 2, "3%", "2.7%", "2.8%"],
                children: [
                  {
                    label: "Sandwich, Cakes & Others",
                    values: [0.8, 1.6, 2, "3%", "2.7%", "2.8%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream cake",
                    values: [0.8, 1.6, 2, "3%", "2.7%", "2.8%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "ice cream",
                    values: [0.8, 1.6, 2, "3%", "2.7%", "2.8%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Gourmet",
                    values: [0.8, 1.6, 2, "3%", "2.7%", "2.8%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cassata ice cream",
                    values: [0.8, 1.6, 2, "3%", "2.7%", "2.8%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "cas",
                    values: [0.8, 1.6, 2, "3%", "2.7%", "2.8%"],
                    children: [],
                    isKeyword: true,
                  },
                  {
                    label: "Ice Cream & Frozen Dessert",
                    values: [0.8, 1.6, 2, "3%", "2.7%", "2.8%"],
                    children: [],
                    isKeyword: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],

    total: ["Total", 587, 771, 924.4, "3%", "3.1%", "3.5%"],
  },

  heatmapDataSecond: {
    title: "Ad Property Performance (Heatmap)",
    duration: "Last 3 Months",

    headers: [
      "AD Property / Group / Keyword",
      "Spend",
      "M-1 Spend",
      "M-2 Spend",
      "Conversion",
      "M-1 Conv",
      "M-2 Conv",
    ],

    rows: [
      /* ---------------------------------------------------------
       1) KEYWORD BASED ADS
    --------------------------------------------------------- */
      {
        label: "Keyword Based Ads",
        values: [3, 0.4, 0.1, "3%", "0%", "0%"],
        children: [
          {
            label: "KW_Core Tubs_Generic Keywords_Nov25 North",
            values: [3, 0.2, 0.0, "3%", "0%", "0%"],
            children: [
              {
                label: "ice creams",
                values: [0, 0, 0, "5.0%", "0%", "0%"],
                isKeyword: true,
              },
              {
                label: "ice cream tubs",
                values: [0, 0, 0, "7.5%", "0%", "0%"],
                isKeyword: true,
              },
              {
                label: "chocolate ice cream",
                values: [0, 0, 0, "4.7%", "0%", "0%"],
                isKeyword: true,
              },
              {
                label: "family pack",
                values: [0, 0, 0, "4.4%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },

          {
            label: "KW_Core Tubs_Generic Keywords_Nov25 East",
            values: [0, 0.2, 0.1, "3%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       2) BROWSE BOOST ITEM ADS
    --------------------------------------------------------- */
      {
        label: "Browse Boost Item Ads",
        values: [3, 0, 0, "2%", "0%", "0%"],
        children: [
          {
            label: "KW_Core Tub_Category_Nov_25_South",
            values: [1, 0, 0, "2%", "0%", "0%"],
            children: [],
          },
          {
            label: "KW_Core Tub_Category_Nov_25_North",
            values: [1, 0, 0, "2%", "0%", "0%"],
            children: [],
          },
          {
            label: "KW_Core Tub_Category_Nov_25_West",
            values: [0, 0, 0, "2%", "0%", "0%"],
            children: [],
          },
          {
            label: "KW_Core Tub_Category_Nov_25_East",
            values: [0, 0, 0, "3%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       3) BRAND CAMPAIGNS (NEW)
    --------------------------------------------------------- */
      {
        label: "Brand Campaigns",
        values: [5, 1, 0.5, "4%", "0%", "0%"],
        children: [
          {
            label: "Brand_Awareness_North",
            values: [2, 0.4, 0.2, "4%", "0%", "0%"],
            children: [
              {
                label: "brand search",
                values: [0, 0, 0, "6%", "0%", "0%"],
                isKeyword: true,
              },
              {
                label: "brand ice cream",
                values: [0, 0, 0, "5%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "Brand_Awareness_South",
            values: [3, 0.6, 0.3, "4%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       4) CATEGORY BOOST ADS (NEW)
    --------------------------------------------------------- */
      {
        label: "Category Boost Ads",
        values: [4, 0.8, 0.3, "2%", "0%", "0%"],
        children: [
          {
            label: "IceCream_Category_North",
            values: [2, 0.4, 0.1, "2%", "0%", "0%"],
            children: [
              {
                label: "vanilla ice cream",
                values: [0, 0, 0, "3%", "0%", "0%"],
                isKeyword: true,
              },
              {
                label: "butterscotch ice cream",
                values: [0, 0, 0, "2%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "IceCream_Category_West",
            values: [2, 0.4, 0.2, "2%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       5) COMPETITION DEFENSE ADS (NEW)
    --------------------------------------------------------- */
      {
        label: "Competition Defense Ads",
        values: [2, 0.3, 0.2, "1%", "0%", "0%"],
        children: [
          {
            label: "Comp_Defense_North",
            values: [1, 0.1, 0.1, "1%", "0%", "0%"],
            children: [
              {
                label: "competitor ice cream",
                values: [0, 0, 0, "2%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "Comp_Defense_South",
            values: [1, 0.2, 0.1, "1%", "0%", "0%"],
            children: [],
          },
        ],
      },
    ],

    /* ---------------------------------------------------------
     TOTAL ROW
  --------------------------------------------------------- */
    total: [
      "Total",
      3 + 3 + 5 + 4 + 2,
      0.4 + 0 + 1 + 0.8 + 0.3,
      0.1 + 0 + 0.5 + 0.3 + 0.2,
      "3%",
      "0%",
      "0%",
    ],
  },

  heatmapDataThird: {
    title: "Ad Property Performance (Heatmap)",
    duration: "Last 3 Months",

    headers: [
      "AD Property / Group / Keyword",
      "Spend",
      "M-1 Spend",
      "M-2 Spend",
      "Conversion",
      "M-1 Conv",
      "M-2 Conv",
    ],

    rows: [
      {
        label: "Deals & Offers Push",
        values: [32, 4.4, 2.5, "6.5%", "0%", "0%"],
        children: [
          {
            label: "DealPush_Metro",
            values: [15, 2.0, 1.2, "6.8%", "0%", "0%"],
            children: [
              {
                label: "discount ice cream tub",
                values: [0, 0, 0, "7.2%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "DealPush_Tier1",
            values: [10, 1.6, 0.9, "6.3%", "0%", "0%"],
            children: [],
          },
          {
            label: "DealPush_Tier2",
            values: [7, 0.8, 0.4, "6.1%", "0%", "0%"],
            children: [],
          },
        ],
      },

      {
        label: "Always-On Performance Ads",
        values: [29, 3.6, 1.9, "3.8%", "0%", "0%"],
        children: [
          {
            label: "AlwaysOn_North",
            values: [13, 1.8, 1.0, "3.9%", "0%", "0%"],
            children: [
              {
                label: "performance keyword north",
                values: [0, 0, 0, "4.2%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "AlwaysOn_South",
            values: [9, 1.1, 0.5, "3.7%", "0%", "0%"],
            children: [],
          },
          {
            label: "AlwaysOn_West",
            values: [7, 0.7, 0.4, "3.8%", "0%", "0%"],
            children: [],
          },
        ],
      },

      {
        label: "Category Takeover Ads",
        values: [22, 3.4, 1.8, "4.4%", "0%", "0%"],
        children: [
          {
            label: "Takeover_North",
            values: [10, 1.5, 0.8, "4.5%", "0%", "0%"],
            children: [
              {
                label: "takeover keyword 1",
                values: [0, 0, 0, "4.9%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "Takeover_South",
            values: [7, 1.0, 0.5, "4.2%", "0%", "0%"],
            children: [],
          },
          {
            label: "Takeover_West",
            values: [5, 0.9, 0.5, "4.3%", "0%", "0%"],
            children: [],
          },
        ],
      },

      {
        label: "Display Boost Ads",
        values: [13, 1.7, 0.9, "1.9%", "0%", "0%"],
        children: [
          {
            label: "Display_Metro",
            values: [6, 0.8, 0.4, "2%", "0%", "0%"],
            children: [
              {
                label: "banner ice cream",
                values: [0, 0, 0, "2.5%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "Display_Tier1",
            values: [4, 0.6, 0.3, "1.8%", "0%", "0%"],
            children: [],
          },
          {
            label: "Display_Tier2",
            values: [3, 0.3, 0.2, "1.7%", "0%", "0%"],
            children: [],
          },
        ],
      },

      {
        label: "Competition Defense Ads",
        values: [8, 1.0, 0.5, "1.4%", "0%", "0%"],
        children: [
          {
            label: "Comp_Defense_North",
            values: [4, 0.5, 0.2, "1.3%", "0%", "0%"],
            children: [
              {
                label: "competitor ice cream",
                values: [0, 0, 0, "2%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "Comp_Defense_South",
            values: [3, 0.4, 0.2, "1.5%", "0%", "0%"],
            children: [],
          },
          {
            label: "Comp_Defense_West",
            values: [1, 0.1, 0.1, "1.2%", "0%", "0%"],
            children: [],
          },
        ],
      },

      {
        label: "Retargeting Ads",
        values: [14, 2.1, 1.1, "5%", "0%", "0%"],
        children: [
          {
            label: "Retargeting_HighIntent",
            values: [8, 1.2, 0.6, "5%", "0%", "0%"],
            children: [
              {
                label: "visited ice cream",
                values: [0, 0, 0, "6%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "Retargeting_MediumIntent",
            values: [4, 0.6, 0.3, "4.8%", "0%", "0%"],
            children: [],
          },
          {
            label: "Retargeting_LowIntent",
            values: [2, 0.3, 0.2, "4.5%", "0%", "0%"],
            children: [],
          },
        ],
      },

      {
        label: "SKU Boost Ads",
        values: [11, 1.4, 0.8, "2.8%", "0%", "0%"],
        children: [
          {
            label: "SKU_Chocolate_1L",
            values: [5, 0.6, 0.3, "2.9%", "0%", "0%"],
            children: [
              {
                label: "1L chocolate tub",
                values: [0, 0, 0, "3.5%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "SKU_Vanilla_1L",
            values: [4, 0.5, 0.3, "2.7%", "0%", "0%"],
            children: [],
          },
          {
            label: "SKU_Butterscotch_1L",
            values: [2, 0.3, 0.2, "3%", "0%", "0%"],
            children: [],
          },
        ],
      },

      {
        label: "Total",
        values: [84, 10.1, 5.7, "3.2%", "0%", "0%"],
        isTotal: true,
      },
    ],
  },

  heatmapDataFourth: {
    title: "Ad Property Performance (Heatmap)",
    duration: "Last 3 Months",

    headers: [
      "AD Property / Group / Keyword",
      "Spend",
      "M-1 Spend",
      "M-2 Spend",
      "Conversion",
      "M-1 Conv",
      "M-2 Conv",
    ],

    rows: [
      /* ---------------------------------------------------------
       8) HIGH INTENT KEYWORD ADS
    --------------------------------------------------------- */
      {
        label: "High Intent Keyword Ads",
        values: [18, 2.4, 1.2, "4.5%", "0%", "0%"],
        children: [
          {
            label: "HighIntent_North",
            values: [7, 1.0, 0.5, "4.6%", "0%", "0%"],
            children: [
              {
                label: "best ice cream tubs",
                values: [0, 0, 0, "6%", "0%", "0%"],
                isKeyword: true,
              },
              {
                label: "premium ice cream",
                values: [0, 0, 0, "5%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "HighIntent_South",
            values: [6, 0.8, 0.4, "4.2%", "0%", "0%"],
            children: [],
          },
          {
            label: "HighIntent_West",
            values: [5, 0.6, 0.3, "4.3%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       9) LOW INTENT KEYWORD ADS
    --------------------------------------------------------- */
      {
        label: "Low Intent Keyword Ads",
        values: [9, 1.3, 0.7, "1.8%", "0%", "0%"],
        children: [
          {
            label: "LowIntent_North",
            values: [4, 0.5, 0.3, "1.7%", "0%", "0%"],
            children: [
              {
                label: "dessert items",
                values: [0, 0, 0, "1.8%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "LowIntent_South",
            values: [3, 0.4, 0.2, "1.9%", "0%", "0%"],
            children: [],
          },
          {
            label: "LowIntent_East",
            values: [2, 0.4, 0.2, "2.0%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       10) STORE VISIBILITY ADS
    --------------------------------------------------------- */
      {
        label: "Store Visibility Ads",
        values: [14, 2.2, 1.1, "2.7%", "0%", "0%"],
        children: [
          {
            label: "Visibility_TopCities",
            values: [7, 1.0, 0.6, "2.8%", "0%", "0%"],
            children: [
              {
                label: "metro visibility",
                values: [0, 0, 0, "3%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "Visibility_Tier1",
            values: [4, 0.7, 0.3, "2.6%", "0%", "0%"],
            children: [],
          },
          {
            label: "Visibility_Tier2",
            values: [3, 0.5, 0.2, "2.5%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       11) SEASONAL PROMOTION ADS
    --------------------------------------------------------- */
      {
        label: "Seasonal Promotion Ads",
        values: [20, 3.0, 1.5, "5.2%", "0%", "0%"],
        children: [
          {
            label: "SummerCampaign",
            values: [10, 1.5, 0.7, "5.4%", "0%", "0%"],
            children: [
              {
                label: "summer ice cream",
                values: [0, 0, 0, "6.2%", "0%", "0%"],
                isKeyword: true,
              },
              {
                label: "cold desserts",
                values: [0, 0, 0, "5.1%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "FestiveCampaign",
            values: [6, 0.9, 0.4, "5.0%", "0%", "0%"],
            children: [],
          },
          {
            label: "NewYearPush",
            values: [4, 0.6, 0.4, "5.3%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       12) NEW LAUNCH PROMOTION ADS
    --------------------------------------------------------- */
      {
        label: "New Launch Promotion Ads",
        values: [16, 2.5, 1.3, "3.9%", "0%", "0%"],
        children: [
          {
            label: "NewLaunch_ChocolateTruffle",
            values: [7, 1.0, 0.5, "4.2%", "0%", "0%"],
            children: [
              {
                label: "truffle ice cream",
                values: [0, 0, 0, "4.8%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "NewLaunch_AlmondCrunch",
            values: [5, 0.8, 0.4, "3.8%", "0%", "0%"],
            children: [],
          },
          {
            label: "NewLaunch_MixedBerry",
            values: [4, 0.7, 0.4, "3.7%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       13) CATEGORY TAKEOVER ADS
    --------------------------------------------------------- */
      {
        label: "Category Takeover Ads",
        values: [22, 3.4, 1.8, "4.4%", "0%", "0%"],
        children: [
          {
            label: "Takeover_North",
            values: [10, 1.5, 0.8, "4.5%", "0%", "0%"],
            children: [
              {
                label: "takeover keyword 1",
                values: [0, 0, 0, "4.9%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "Takeover_South",
            values: [7, 1.0, 0.5, "4.2%", "0%", "0%"],
            children: [],
          },
          {
            label: "Takeover_West",
            values: [5, 0.9, 0.5, "4.3%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       14) DISPLAY BOOST ADS
    --------------------------------------------------------- */
      {
        label: "Display Boost Ads",
        values: [13, 1.7, 0.9, "1.9%", "0%", "0%"],
        children: [
          {
            label: "Display_Metro",
            values: [6, 0.8, 0.4, "2%", "0%", "0%"],
            children: [
              {
                label: "banner ice cream",
                values: [0, 0, 0, "2.5%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "Display_Tier1",
            values: [4, 0.6, 0.3, "1.8%", "0%", "0%"],
            children: [],
          },
          {
            label: "Display_Tier2",
            values: [3, 0.3, 0.2, "1.7%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       TOTAL ROW (STATIC)
    --------------------------------------------------------- */
      {
        label: "Total",
        values: [84, 10.1, 5.7, "3.2%", "0%", "0%"],
        isTotal: true,
      },
    ],
  },

  heatmapDataFifth: {
    title: "Ad Property Performance (Heatmap)",
    duration: "Last 3 Months",

    headers: [
      "AD Property / Group / Keyword",
      "Spend",
      "M-1 Spend",
      "M-2 Spend",
      "Conversion",
      "M-1 Conv",
      "M-2 Conv",
    ],

    rows: [
      /* ---------------------------------------------------------
       BRAND CAMPAIGN ADS
    --------------------------------------------------------- */
      {
        label: "Brand Campaign Ads",
        values: [28, 4.5, 2.1, "3.3%", "0%", "0%"],
        children: [
          {
            label: "Brand_North",
            values: [12, 1.8, 0.9, "3.4%", "0%", "0%"],
            children: [
              {
                label: "brand search north",
                values: [0, 0, 0, "4.0%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "Brand_South",
            values: [9, 1.5, 0.7, "3.1%", "0%", "0%"],
            children: [],
          },
          {
            label: "Brand_West",
            values: [7, 1.2, 0.5, "3.3%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       16) CART RECOVERY ADS
    --------------------------------------------------------- */
      {
        label: "Cart Recovery Ads",
        values: [19, 2.4, 1.1, "6.2%", "0%", "0%"],
        children: [
          {
            label: "CartRecovery_Metro",
            values: [9, 1.2, 0.6, "6.5%", "0%", "0%"],
            children: [
              {
                label: "recover cart ice cream",
                values: [0, 0, 0, "7.2%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "CartRecovery_Tier1",
            values: [6, 0.8, 0.3, "6.1%", "0%", "0%"],
            children: [],
          },
          {
            label: "CartRecovery_Tier2",
            values: [4, 0.4, 0.2, "5.9%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       17) RETARGETING – VIEWED PRODUCTS
    --------------------------------------------------------- */
      {
        label: "Retargeting – Viewed Products",
        values: [21, 3.1, 1.4, "4.8%", "0%", "0%"],
        children: [
          {
            label: "View_RT_North",
            values: [9, 1.4, 0.7, "4.9%", "0%", "0%"],
            children: [
              {
                label: "viewed chocolate delights",
                values: [0, 0, 0, "5.4%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "View_RT_South",
            values: [7, 1.0, 0.4, "4.6%", "0%", "0%"],
            children: [],
          },
          {
            label: "View_RT_West",
            values: [5, 0.7, 0.3, "4.7%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       18) RETARGETING – ADD TO CART
    --------------------------------------------------------- */
      {
        label: "Retargeting – Add To Cart",
        values: [23, 3.2, 1.8, "7.2%", "0%", "0%"],
        children: [
          {
            label: "ATC_RT_North",
            values: [11, 1.6, 0.9, "7.5%", "0%", "0%"],
            children: [
              {
                label: "atc truffle",
                values: [0, 0, 0, "8.1%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "ATC_RT_South",
            values: [7, 1.0, 0.5, "7.2%", "0%", "0%"],
            children: [],
          },
          {
            label: "ATC_RT_West",
            values: [5, 0.6, 0.4, "7.0%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       19) SKU BOOST CAMPAIGN
    --------------------------------------------------------- */
      {
        label: "SKU Boost Campaign",
        values: [26, 3.9, 2.0, "3.9%", "0%", "0%"],
        children: [
          {
            label: "Boost_Chocolate",
            values: [12, 1.7, 1.0, "4.0%", "0%", "0%"],
            children: [
              {
                label: "boost chocolate keyword",
                values: [0, 0, 0, "4.5%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "Boost_Strawberry",
            values: [8, 1.2, 0.5, "3.8%", "0%", "0%"],
            children: [],
          },
          {
            label: "Boost_Vanilla",
            values: [6, 1.0, 0.5, "3.7%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       20) DEALS & OFFERS PUSH
    --------------------------------------------------------- */
      {
        label: "Deals & Offers Push",
        values: [32, 4.4, 2.5, "6.5%", "0%", "0%"],
        children: [
          {
            label: "DealPush_Metro",
            values: [15, 2.0, 1.2, "6.8%", "0%", "0%"],
            children: [
              {
                label: "discount ice cream tub",
                values: [0, 0, 0, "7.2%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "DealPush_Tier1",
            values: [10, 1.6, 0.9, "6.3%", "0%", "0%"],
            children: [],
          },
          {
            label: "DealPush_Tier2",
            values: [7, 0.8, 0.4, "6.1%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       21) ALWAYS-ON PERFORMANCE ADS
    --------------------------------------------------------- */
      {
        label: "Always-On Performance Ads",
        values: [29, 3.6, 1.9, "3.8%", "0%", "0%"],
        children: [
          {
            label: "AlwaysOn_North",
            values: [13, 1.8, 1.0, "3.9%", "0%", "0%"],
            children: [
              {
                label: "performance keyword north",
                values: [0, 0, 0, "4.2%", "0%", "0%"],
                isKeyword: true,
              },
            ],
          },
          {
            label: "AlwaysOn_South",
            values: [9, 1.1, 0.5, "3.7%", "0%", "0%"],
            children: [],
          },
          {
            label: "AlwaysOn_West",
            values: [7, 0.7, 0.4, "3.8%", "0%", "0%"],
            children: [],
          },
        ],
      },

      /* ---------------------------------------------------------
       TOTAL ROW
    --------------------------------------------------------- */
      {
        label: "Total",
        values: [84, 10.1, 5.7, "3.2%", "0%", "0%"],
        isTotal: true,
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
