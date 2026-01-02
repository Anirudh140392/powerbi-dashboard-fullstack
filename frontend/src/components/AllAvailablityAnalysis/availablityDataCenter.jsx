// Helper function to apply variance for weighted data
function applyWeightedVariance(value, variancePercent = 12) {
  if (typeof value !== 'number') return value;
  const variance = (Math.random() - 0.5) * 2 * variancePercent;
  const newValue = Math.round(value * (1 + variance / 100));
  return Math.max(0, Math.min(100, newValue)); // Clamp between 0-100
}

// Helper to create weighted variant of product matrix data
function createWeightedProductMatrix(absolute) {
  return {
    formatColumns: absolute.formatColumns,
    data: absolute.data.map(format => ({
      format: format.format,
      products: format.products.map(product => ({
        sku: product.sku,
        name: product.name,
        values: Object.fromEntries(
          Object.entries(product.values).map(([key, val]) => [key, applyWeightedVariance(val)])
        ),
        losses: Object.fromEntries(
          Object.entries(product.losses).map(([key, val]) => [key, parseFloat((val * (0.9 + Math.random() * 0.2)).toFixed(2))])
        )
      }))
    }))
  };
}

const PRODUCT_MATRIX_ABSOLUTE = {
  formatColumns: ["Blinkit", "Blinkit (2)", "Blinkit (Virtual)", "Blinkit (Sub)"],
  data: [
    {
      format: "Cassata",
      products: [
        {
          sku: "85123",
          name: "KW Cassatta",
          values: {
            Blinkit: 55,
            Zepto: 81,
            "Virtual Store": 0,
            Instamart: 88,
          },
          losses: {
            Blinkit: 18.42,
            Zepto: 0.0,
            "Virtual Store": 0.0,
            Instamart: 1.12,
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

const PRODUCT_MATRIX = {
  absolute: PRODUCT_MATRIX_ABSOLUTE,
  weighted: createWeightedProductMatrix(PRODUCT_MATRIX_ABSOLUTE)
};

// Helper to create weighted variant of OLA_Detailed
function createWeightedOLADetailed(absolute) {
  return absolute.map(platform => ({
    platform: platform.platform,
    ola: applyWeightedVariance(platform.ola),
    zones: platform.zones.map(zone => ({
      zone: zone.zone,
      ola: applyWeightedVariance(zone.ola),
      cities: zone.cities.map(city => ({
        city: city.city,
        ola: applyWeightedVariance(city.ola)
      }))
    }))
  }));
}

const OLA_Detailed_ABSOLUTE = [
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
    platform: "Blinkit (2)",
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
    platform: "Blinkit (Virtual)",
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

const OLA_Detailed = {
  absolute: OLA_Detailed_ABSOLUTE,
  weighted: createWeightedOLADetailed(OLA_Detailed_ABSOLUTE)
};

function generateTrend(base, points = 8, variance = 8) {
  return Array.from({ length: points }, (_, i) =>
    Math.max(
      0,
      Math.min(100, Math.round(base + Math.sin(i / 2) * variance + (Math.random() * 6 - 3)))
    )
  );
}

function generateTrendMulti(base) {
  return {
    Spend: generateTrend(base),
    "M-1 Spend": generateTrend(base - 5),
    "M-2 Spend": generateTrend(base - 10),
    Conversion: generateTrend(Math.round(base / 2)),
    "M-1 Conv": generateTrend(Math.round(base / 2) - 3),
    "M-2 Conv": generateTrend(Math.round(base / 2) - 6),
    ROAS: generateTrend(Math.round(base / 3)),
    CPM: generateTrend(Math.round(base / 4))
  };
}

// Helper to create weighted variant of FORMAT_MATRIX
function createWeightedFormatMatrix(absolute) {
  return {
    PlatformColumns: absolute.PlatformColumns,
    formatColumns: absolute.formatColumns,
    CityColumns: absolute.CityColumns,
    PlatformData: absolute.PlatformData.map(item => ({
      kpi: item.kpi,
      values: Object.fromEntries(
        Object.entries(item.values).map(([key, val]) => [key, applyWeightedVariance(val)])
      ),
      trend: item.trend
    })),
    FormatData: absolute.FormatData.map(item => ({
      kpi: item.kpi,
      values: Object.fromEntries(
        Object.entries(item.values).map(([key, val]) => [key, applyWeightedVariance(val)])
      ),
      trend: item.trend
    })),
    CityData: absolute.CityData.map(item => ({
      kpi: item.kpi,
      values: Object.fromEntries(
        Object.entries(item.values).map(([key, val]) => [key, applyWeightedVariance(val)])
      ),
      trend: item.trend
    }))
  };
}

const FORMAT_MATRIX_ABSOLUTE = {
  PlatformColumns: ["Blinkit", "Blinkit (Sub)", "Blinkit (2)", "Blinkit (Amz)", "Blinkit (Swg)"],

  formatColumns: [
    "Cassata", "Core Tub", "Cornetto", "Magnum",
    "Premium Tub", "KW Sticks", "Sandwich"
  ],

  CityColumns: [
    "Ajmer", "Amritsar", "Bathinda", "Bhopal",
    "Chandigarh", "Gwalior", "Indore", "Jaipur"
  ],

  // ------------------------------------------------------------
  // PLATFORM LEVEL – upgraded trend
  // ------------------------------------------------------------
  PlatformData: [
    {
      kpi: "Osa",
      values: {
        Blinkit: 82, "Blinkit (Sub)": 78, "Blinkit (2)": 65, "Blinkit (Amz)": 75, "Blinkit (Swg)": 70
      },
      trend: generateTrendMulti(78)
    },
    {
      kpi: "Doi",
      values: {
        Blinkit: 45, "Blinkit (Sub)": 52, "Blinkit (2)": 48, "Blinkit (Amz)": 49, "Blinkit (Swg)": 47
      },
      trend: generateTrendMulti(48)
    },
    {
      kpi: "Fillrate",
      values: {
        Blinkit: 91, "Blinkit (Sub)": 84, "Blinkit (2)": 79, "Blinkit (Amz)": 86, "Blinkit (Swg)": 81
      },
      trend: generateTrendMulti(85)
    },
    {
      kpi: "Assortment",
      values: {
        Blinkit: 142, "Blinkit (Sub)": 138, "Blinkit (2)": 122, "Blinkit (Amz)": 135, "Blinkit (Swg)": 128
      },
      trend: generateTrendMulti(66)
    },
    {
      kpi: "PSL",
      values: {
        Blinkit: 18, "Blinkit (Sub)": 12, "Blinkit (2)": 25, "Blinkit (Amz)": 11, "Blinkit (Swg)": 20
      },
      trend: generateTrendMulti(15)
    }
  ],

  // ------------------------------------------------------------
  // FORMAT LEVEL – upgraded trend
  // ------------------------------------------------------------
  FormatData: [
    {
      kpi: "Osa",
      values: {
        Cassata: 7, "Core Tub": 81, Cornetto: 90, Magnum: 91,
        "KW Sticks": 97, "Premium Tub": 85, Sandwich: 82
      },
      trend: generateTrendMulti(75)
    },
    {
      kpi: "Doi",
      values: {
        Cassata: 13, "Core Tub": 87, Cornetto: 98, Magnum: 100,
        "KW Sticks": 100, "Premium Tub": 78, Sandwich: 95
      },
      trend: generateTrendMulti(85)
    },
    {
      kpi: "Fillrate",
      values: {
        Cassata: 17, "Core Tub": 99, Cornetto: 99, Magnum: 100,
        "KW Sticks": 100, "Premium Tub": 99, Sandwich: 100
      },
      trend: generateTrendMulti(95)
    },
    {
      kpi: "Assortment",
      values: {
        Cassata: 72, "Core Tub": 96, Cornetto: 82, Magnum: 91,
        "KW Sticks": 94, "Premium Tub": 88, Sandwich: 55
      },
      trend: generateTrendMulti(85)
    },
    {
      kpi: "PSL",
      values: {
        Cassata: 28, "Core Tub": 4, Cornetto: 10, Magnum: 9,
        "KW Sticks": 6, "Premium Tub": 12, Sandwich: 45
      },
      trend: generateTrendMulti(20)
    }
  ],

  // ------------------------------------------------------------
  // CITY LEVEL – upgraded trend
  // ------------------------------------------------------------
  CityData: [
    {
      kpi: "Osa",
      values: {
        Ajmer: 72, Amritsar: 85, Bathinda: 79, Bhopal: 88,
        Chandigarh: 81, Gwalior: 75, Indore: 92, Jaipur: 69
      },
      trend: generateTrendMulti(80)
    },
    {
      kpi: "Doi",
      values: {
        Ajmer: 42, Amritsar: 55, Bathinda: 49, Bhopal: 60,
        Chandigarh: 53, Gwalior: 44, Indore: 67, Jaipur: 51
      },
      trend: generateTrendMulti(52)
    },
    {
      kpi: "Fillrate",
      values: {
        Ajmer: 91, Amritsar: 88, Bathinda: 84, Bhopal: 94,
        Chandigarh: 92, Gwalior: 76, Indore: 90, Jaipur: 82
      },
      trend: generateTrendMulti(88)
    },
    {
      kpi: "Assortment",
      values: {
        Ajmer: 73, Amritsar: 69, Bathinda: 71, Bhopal: 82,
        Chandigarh: 80, Gwalior: 63, Indore: 87, Jaipur: 78
      },
      trend: generateTrendMulti(76)
    },
    {
      kpi: "PSL",
      values: {
        Ajmer: 27, Amritsar: 15, Bathinda: 21, Bhopal: 12,
        Chandigarh: 19, Gwalior: 37, Indore: 8, Jaipur: 22
      },
      trend: generateTrendMulti(25)
    }
  ]
};

const FORMAT_MATRIX = {
  absolute: FORMAT_MATRIX_ABSOLUTE,
  weighted: createWeightedFormatMatrix(FORMAT_MATRIX_ABSOLUTE)
};


const FORMAT_MATRIX_Visibility = {
  PlatformColumns: ["Blinkit", "Blinkit (Sub)", "Blinkit (2)", "Blinkit (Amz)", "Blinkit (Swg)"],

  formatColumns: [
    "Cassata", "Core Tub", "Cornetto", "Magnum",
    "Premium Tub", "KW Sticks", "Sandwich"
  ],

  CityColumns: [
    "Mumbai", "Delhi", "Bangalore", "Hyderabad",
    "Chennai", "Kolkata", "Pune", "Ahmedabad"
  ],

  // -----------------------------------------
  // PLATFORM LEVEL – NEW KPIs
  // -----------------------------------------
  PlatformData: [
    {
      kpi: "Overall SOS",
      values: { Blinkit: 92, "Blinkit (Sub)": 88, "Blinkit (2)": 85, "Blinkit (Amz)": 87, "Blinkit (Swg)": 90 },
      trend: generateTrendMulti(88)
    },
    {
      kpi: "Sponsored SOS",
      values: { Blinkit: 12, "Blinkit (Sub)": 15, "Blinkit (2)": 10, "Blinkit (Amz)": 16, "Blinkit (Swg)": 14 },
      trend: generateTrendMulti(14)
    },
    {
      kpi: "Organic SOS",
      values: { Blinkit: 96, "Blinkit (Sub)": 94, "Blinkit (2)": 92, "Blinkit (Amz)": 91, "Blinkit (Swg)": 89 },
      trend: generateTrendMulti(92)
    },
    {
      kpi: "Display SOS",
      values: { Blinkit: 89, "Blinkit (Sub)": 91, "Blinkit (2)": 85, "Blinkit (Amz)": 88, "Blinkit (Swg)": 86 },
      trend: generateTrendMulti(88)
    }
  ],

  // -----------------------------------------
  // FORMAT LEVEL – NEW KPIs
  // -----------------------------------------
  FormatData: [
    {
      kpi: "Overall SOS",
      values: { Cassata: 75, "Core Tub": 82, Cornetto: 90, Magnum: 87, "KW Sticks": 95, "Premium Tub": 80, Sandwich: 76 },
      trend: generateTrendMulti(82)
    },
    {
      kpi: "Sponsored SOS",
      values: { Cassata: 18, "Core Tub": 12, Cornetto: 14, Magnum: 16, "KW Sticks": 10, "Premium Tub": 20, Sandwich: 22 },
      trend: generateTrendMulti(15)
    },
    {
      kpi: "Organic SOS",
      values: { Cassata: 92, "Core Tub": 95, Cornetto: 98, Magnum: 99, "KW Sticks": 100, "Premium Tub": 93, Sandwich: 91 },
      trend: generateTrendMulti(95)
    },
    {
      kpi: "Display SOS",
      values: { Cassata: 70, "Core Tub": 88, Cornetto: 90, Magnum: 92, "KW Sticks": 96, "Premium Tub": 85, Sandwich: 82 },
      trend: generateTrendMulti(86)
    }
  ],

  // -----------------------------------------
  // CITY LEVEL – NEW KPIs (Metro Cities)
  // -----------------------------------------
  CityData: [
    {
      kpi: "Overall SOS",
      values: { Mumbai: 88, Delhi: 90, Bangalore: 85, Hyderabad: 83, Chennai: 82, Kolkata: 86, Pune: 89, Ahmedabad: 84 },
      trend: generateTrendMulti(86)
    },
    {
      kpi: "Sponsored SOS",
      values: { Mumbai: 14, Delhi: 12, Bangalore: 15, Hyderabad: 11, Chennai: 16, Kolkata: 13, Pune: 14, Ahmedabad: 18 },
      trend: generateTrendMulti(14)
    },
    {
      kpi: "Organic SOS",
      values: { Mumbai: 95, Delhi: 94, Bangalore: 93, Hyderabad: 90, Chennai: 92, Kolkata: 91, Pune: 96, Ahmedabad: 89 },
      trend: generateTrendMulti(93)
    },
    {
      kpi: "Display SOS",
      values: { Mumbai: 90, Delhi: 92, Bangalore: 88, Hyderabad: 87, Chennai: 85, Kolkata: 86, Pune: 91, Ahmedabad: 84 },
      trend: generateTrendMulti(88)
    }
  ]
};


// Helper to create weighted variant of FORMAT_ROWS
function createWeightedFormatRows(absolute) {
  return absolute.map(row => ({
    ...row,
    offtakes: Math.max(0, Math.round(row.offtakes * (0.9 + Math.random() * 0.2))),
    spend: Math.max(0, Math.round(row.spend * (0.9 + Math.random() * 0.2))),
    roas: Math.max(0, parseFloat((row.roas * (0.9 + Math.random() * 0.2)).toFixed(1))),
    inorgSalesPct: applyWeightedVariance(row.inorgSalesPct),
    conversionPct: Math.max(0, parseFloat((row.conversionPct * (0.9 + Math.random() * 0.2)).toFixed(1))),
    marketSharePct: applyWeightedVariance(row.marketSharePct),
    cpm: Math.max(0, Math.round(row.cpm * (0.9 + Math.random() * 0.2))),
    cpc: Math.max(0, Math.round(row.cpc * (0.9 + Math.random() * 0.2)))
  }));
}

const FORMAT_ROWS_ABSOLUTE = [
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

const FORMAT_ROWS = {
  absolute: FORMAT_ROWS_ABSOLUTE,
  weighted: createWeightedFormatRows(FORMAT_ROWS_ABSOLUTE)
};

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
    label: "Blinkit (Sub)",
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



export { FORMAT_MATRIX, FORMAT_ROWS, PRODUCT_MATRIX, OLA_Detailed, ONE_VIEW_DRILL_DATA, DRILL_COLUMNS, FORMAT_MATRIX_Visibility };
