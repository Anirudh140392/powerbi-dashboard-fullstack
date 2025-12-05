const PRODUCT_MATRIX = {
  formatColumns: ["Blinkit", "Instamart", "Virtual Store", "Zepto"],
  data: [
    {
      format: "Cassata",
      products: [
        {
          sku: "85123",
          name: "KW Cassatta",
          values: {
            Blinkit: 55,
            Instamart: 81,
            "Virtual Store": 0,
            Zepto: 88,
          },
          losses: {
            Blinkit: 18.42,
            Instamart: 0.0,
            "Virtual Store": 0.0,
            Zepto: 1.12,
          },
        },
      ],
    },

    {
      format: "Core Tub",
      products: [
        {
          sku: "85656",
          name: "KW Dairy Factory Vanilla Ice Cream TUB",
          values: {
            Blinkit: 96,
            Instamart: 84,
            "Virtual Store": 75,
            Zepto: 99,
          },
          losses: {
            Blinkit: 1.08,
            Instamart: 4.79,
            "Virtual Store": 0,
            Zepto: 23.19,
          },
        },
        {
          sku: "85657",
          name: "KW Dairy Factory Mango Ice Cream TUB",
          values: {
            Blinkit: 98,
            Instamart: 83,
            "Virtual Store": 76,
            Zepto: 99,
          },
          losses: {
            Blinkit: 2.39,
            Instamart: 70.21,
            "Virtual Store": 0,
            Zepto: 0,
          },
        },
        {
          sku: "85658",
          name: "KW Dairy Factory Choco Chip Ice Cream TUB",
          values: {
            Blinkit: 97,
            Instamart: 83,
            "Virtual Store": 68,
            Zepto: 99,
          },
          losses: {
            Blinkit: 3.12,
            Instamart: 51.25,
            "Virtual Store": 0,
            Zepto: 1.22,
          },
        },
        {
          sku: "85659",
          name: "KW Dairy Factory Butterscotch Ice Cream TUB",
          values: {
            Blinkit: 96,
            Instamart: 83,
            "Virtual Store": 70,
            Zepto: 100,
          },
          losses: {
            Blinkit: 2.26,
            Instamart: 104.82,
            "Virtual Store": 0,
            Zepto: 0,
          },
        },
      ],
    },

    {
      format: "Cornetto",
      products: [
        {
          sku: "85045",
          name: "KW CORNETTO - DOUBLE CHOCOLATE",
          values: {
            Blinkit: 98,
            Instamart: 85,
            "Virtual Store": 78,
            Zepto: 100,
          },
          losses: {
            Blinkit: 0,
            Instamart: 153.2,
            "Virtual Store": 0,
            Zepto: 0,
          },
        },
      ],
    },
  ],
};

const OLA_Detailed = [
  {
    platform: "Blinkit",
    ola: 90, // auto-calculated below
    zones: [
      {
        zone: "East",
        ola: 95,
        cities: []
      },
      {
        zone: "North 1",
        ola: 95,
        cities: []
      },
      {
        zone: "North 2",
        ola: 89,
        cities: []
      },
      {
        zone: "South",
        ola: 87,
        cities: []
      },
      {
        zone: "West",
        ola: 84, // average of cities below
        cities: [
          { city: "Ahmedabad", ola: 89 },
          { city: "Mumbai", ola: 79 },
          { city: "Nagpur", ola: 82 },
          { city: "Nashik", ola: 79 },
          { city: "Panaji", ola: 75 },
          { city: "Pune", ola: 87 },
          { city: "Rajkot", ola: 90 },
          { city: "Surat", ola: 90 },
          { city: "Vadodara", ola: 86 }
        ]
      }
    ]
  },

  {
    platform: "Instamart",
    ola: 82, // same as its only zone
    zones: [
      {
        zone: "All",
        ola: 82,
        cities: []
      }
    ]
  },

  {
    platform: "Virtual Store",
    ola: 72, // same as its only zone
    zones: [
      {
        zone: "East",
        ola: 72,
        cities: []
      }
    ]
  }
];

function generateTrend(base, points = 8, variance = 8) {
  return Array.from({ length: points }, (_, i) =>
    Math.max(
      0,
      Math.min(100, Math.round(base + Math.sin(i / 2) * variance + (Math.random() * 6 - 3)))
    )
  );
}

    const FORMAT_MATRIX = {
  PlatformColumns: ["Blinkit", "Zepto", "Instamart", "Virtual Store", "Swiggy"],

  formatColumns: [
    "Cassata", "Core Tub", "Cornetto", "Magnum",
    "Premium Tub", "KW Sticks", "Sandwich"
  ],

  CityColumns: [
    "Ajmer", "Amritsar", "Bathinda", "Bhopal",
    "Chandigarh", "Gwalior", "Indore", "Jaipur"
  ],

  PlatformData: [
    { kpi: "Osa", values: { Blinkit: 82, Zepto: 78, Instamart: 65, "Virtual Store": 74, Swiggy: 70 }, trend: generateTrend(78) },
    { kpi: "Doi", values: { Blinkit: 45, Zepto: 52, Instamart: 48, "Virtual Store": 50, Swiggy: 47 }, trend: generateTrend(48) },
    { kpi: "Fillrate", values: { Blinkit: 91, Zepto: 84, Instamart: 79, "Virtual Store": 87, Swiggy: 81 }, trend: generateTrend(85) },
    { kpi: "Assortment", values: { Blinkit: 72, Zepto: 69, Instamart: 61, "Virtual Store": 66, Swiggy: 64 }, trend: generateTrend(66) }
  ],

  FormatData: [
    { kpi: "Osa", values: { Cassata: 7, "Core Tub": 81, Cornetto: 90, Magnum: 91, "KW Sticks": 97, "Premium Tub": 85, Sandwich: 82 }, trend: generateTrend(75) },
    { kpi: "Doi", values: { Cassata: 13, "Core Tub": 87, Cornetto: 98, Magnum: 100, "KW Sticks": 100, "Premium Tub": 78, Sandwich: 95 }, trend: generateTrend(85) },
    { kpi: "Fillrate", values: { Cassata: 17, "Core Tub": 99, Cornetto: 99, Magnum: 100, "KW Sticks": 100, "Premium Tub": 99, Sandwich: 100 }, trend: generateTrend(95) },
    { kpi: "Assortment", values: { Cassata: 72, "Core Tub": 96, Cornetto: 82, Magnum: 91, "KW Sticks": 94, "Premium Tub": 88, Sandwich: 55 }, trend: generateTrend(85) }
  ],

  CityData: [
    { kpi: "Osa", values: { Ajmer: 72, Amritsar: 85, Bathinda: 79, Bhopal: 88, Chandigarh: 81, Gwalior: 75, Indore: 92, Jaipur: 69 }, trend: generateTrend(80) },
    { kpi: "Doi", values: { Ajmer: 42, Amritsar: 55, Bathinda: 49, Bhopal: 60, Chandigarh: 53, Gwalior: 44, Indore: 67, Jaipur: 51 }, trend: generateTrend(52) },
    { kpi: "Fillrate", values: { Ajmer: 91, Amritsar: 88, Bathinda: 84, Bhopal: 94, Chandigarh: 92, Gwalior: 76, Indore: 90, Jaipur: 82 }, trend: generateTrend(88) },
    { kpi: "Assortment", values: { Ajmer: 73, Amritsar: 69, Bathinda: 71, Bhopal: 82, Chandigarh: 80, Gwalior: 63, Indore: 87, Jaipur: 78 }, trend: generateTrend(76) }
  ]
};



const FORMAT_ROWS = [
  {
    name: "Cassata",
    offtakes: 4,
    spend: 0,
    roas: 3.2,
    inorgSalesPct: 19,
    conversionPct: 2.3,
    marketSharePct: 23,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 384,
    cpc: 4736,
  },
  {
    name: "Core Tub",
    offtakes: 61,
    spend: 2,
    roas: 5.5,
    inorgSalesPct: 18,
    conversionPct: 2.6,
    marketSharePct: 16,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 404,
    cpc: 51,
  },
  {
    name: "Cornetto",
    offtakes: 48,
    spend: 1,
    roas: 7.4,
    inorgSalesPct: 12,
    conversionPct: 10.7,
    marketSharePct: 8,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 456,
    cpc: 71,
  },
  {
    name: "Cup",
    offtakes: 4,
    spend: 0,
    roas: 5.2,
    inorgSalesPct: 2,
    conversionPct: 1.9,
    marketSharePct: 3,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 210,
    cpc: 15,
  },
  {
    name: "KW Sticks",
    offtakes: 9,
    spend: 0,
    roas: 5.7,
    inorgSalesPct: 13,
    conversionPct: 4.1,
    marketSharePct: 22,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 402,
    cpc: 96,
  },
  {
    name: "Magnum",
    offtakes: 14,
    spend: 0,
    roas: 9.9,
    inorgSalesPct: 35,
    conversionPct: 5.6,
    marketSharePct: 22,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 428,
    cpc: 169,
  },
  {
    name: "Others",
    offtakes: 0,
    spend: 0,
    roas: 14.2,
    inorgSalesPct: 100,
    conversionPct: 1.4,
    marketSharePct: 0,
    promoMyBrandPct: 100,
    promoCompetePct: 100,
    cpm: 337,
    cpc: 16,
  },
];

const ONE_VIEW_DRILL_DATA = [
  {
    label: "Blinkit",                               // PLATFORM
    values: {},                                     // platform has no direct values
    children: [
      {
        label: "East",                               // ZONE
        values: {},
        children: [
          {
            label: "Kolkata",                        // CITY
            values: {},
            children: [
              {
                label: "Cassata",                    // PRODUCT
                values: {
                  "Tdp-1": 82,
                  "Tdp-2": 78,
                  "Tdp-3": 80
                },
                trend: [72, 74, 77, 80, 82, 81],
                children: [
                  {
                    label: "ID: P001",               // PRODUCT ID
                    values: {
                      "Tdp-1": 82,
                      "Tdp-2": 78,
                      "Tdp-3": 80
                    },
                    trend: [72, 74, 77, 80, 82, 81],
                    children: []
                  }
                ]
              },
              {
                label: "Cornetto",
                values: {
                  "Tdp-1": 91,
                  "Tdp-2": 88,
                  "Tdp-3": 92
                },
                trend: [85, 87, 88, 90, 91, 92],
                children: [
                  {
                    label: "ID: P002",
                    values: {
                      "Tdp-1": 91,
                      "Tdp-2": 88,
                      "Tdp-3": 92
                    },
                    trend: [85, 87, 88, 90, 91, 92],
                    children: []
                  }
                ]
              }
            ]
          },

          {
            label: "Patna",
            values: {},
            children: [
              {
                label: "Cassata",
                values: {
                  "Tdp-1": 76,
                  "Tdp-2": 73,
                  "Tdp-3": 75
                },
                trend: [70, 72, 74, 76, 75, 75],
                children: [
                  {
                    label: "ID: P001",
                    values: {
                      "Tdp-1": 76,
                      "Tdp-2": 73,
                      "Tdp-3": 75
                    },
                    trend: [70, 72, 74, 76, 75, 75],
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      },

      {
        label: "West",
        values: {},
        children: [
          {
            label: "Mumbai",
            values: {},
            children: [
              {
                label: "Cornetto",
                values: {
                  "Tdp-1": 88,
                  "Tdp-2": 85,
                  "Tdp-3": 89
                },
                trend: [80, 82, 84, 86, 88, 89],
                children: [
                  {
                    label: "ID: P002",
                    values: {
                      "Tdp-1": 88,
                      "Tdp-2": 85,
                      "Tdp-3": 89
                    },
                    trend: [80, 82, 84, 86, 88, 89],
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  // ---------------- ZEPTO ----------------
  {
    label: "Zepto",
    values: {},
    children: [
      {
        label: "South",
        values: {},
        children: [
          {
            label: "Bengaluru",
            values: {},
            children: [
              {
                label: "Cassata",
                values: {
                  "Tdp-1": 91,
                  "Tdp-2": 93,
                  "Tdp-3": 94
                },
                trend: [84, 86, 89, 91, 93, 94],
                children: [
                  {
                    label: "ID: P001",
                    values: {
                      "Tdp-1": 91,
                      "Tdp-2": 93,
                      "Tdp-3": 94
                    },
                    trend: [84, 86, 89, 91, 93, 94],
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  // ---------------- INSTAMART ----------------
  {
    label: "Instamart",
    values: {},
    children: [
      {
        label: "South",
        values: {},
        children: [
          {
            label: "Hyderabad",
            values: {},
            children: [
              {
                label: "Premium Tub",
                values: {
                  "Tdp-1": 82,
                  "Tdp-2": 84,
                  "Tdp-3": 83
                },
                trend: [75, 78, 80, 81, 82, 83],
                children: [
                  {
                    label: "ID: P003",
                    values: {
                      "Tdp-1": 82,
                      "Tdp-2": 84,
                      "Tdp-3": 83
                    },
                    trend: [75, 78, 80, 81, 82, 83],
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
];

const DRILL_COLUMNS = [
  { key: "Tdp-1", label: "Tdp-1", isPercent: true },
  { key: "Tdp-2", label: "Tdp-2", isPercent: true },
  { key: "Tdp-3", label: "Tdp-3", isPercent: true }
];



export { FORMAT_MATRIX, FORMAT_ROWS, PRODUCT_MATRIX, OLA_Detailed, ONE_VIEW_DRILL_DATA, DRILL_COLUMNS };
