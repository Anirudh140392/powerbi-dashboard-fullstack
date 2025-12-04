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

const FORMAT_MATRIX = {
  formatColumns: [
    "Cassata",
    "Core Tub",
    "Cornetto",
    "Magnum",
    "Premium Tub",
    "KW Sticks",
    "Sandwich",
  ],
  cityFormatData: [
    {
      platform: "Blinkit",
      region: "East",
      city: "Kolkata",
      values: {
        Cassata: 7,
        "Core Tub": 81,
        Cornetto: 90,
        "KW Sticks": 97,
        Magnum: 91,
        "Premium Tub": 85,
        Sandwich: 82,
      },
    },
    {
      platform: "Blinkit",
      region: "East",
      city: "Patna",
      values: {
        Cassata: 13,
        "Core Tub": 87,
        Cornetto: 98,
        "KW Sticks": 100,
        Magnum: 100,
        "Premium Tub": 78,
        Sandwich: 95,
      },
    },
    {
      platform: "Blinkit",
      region: "East",
      city: "Ranchi",
      values: {
        Cassata: 17,
        "Core Tub": 99,
        Cornetto: 99,
        "KW Sticks": 100,
        Magnum: 100,
        "Premium Tub": 99,
        Sandwich: 100,
      },
    },
    {
      platform: "Blinkit",
      region: "West",
      city: "Mumbai",
      values: {
        Cassata: 72,
        "Core Tub": 96,
        Cornetto: 82,
        "KW Sticks": 94,
        Magnum: 91,
        "Premium Tub": 88,
        Sandwich: 55,
      },
    },
    {
      platform: "Zepto",
      region: "South",
      city: "Bengaluru",
      values: {
        Cassata: 91,
        "Core Tub": 93,
        Cornetto: 88,
        "KW Sticks": 90,
        Magnum: 92,
        "Premium Tub": 86,
        Sandwich: 73,
      },
    },
    {
      platform: "Instamart",
      region: "South",
      city: "Hyderabad",
      values: {
        Cassata: 84,
        "Core Tub": 89,
        Cornetto: 90,
        "KW Sticks": 87,
        Magnum: 90,
        "Premium Tub": 82,
        Sandwich: 70,
      },
    },
  ],
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

export { FORMAT_MATRIX, FORMAT_ROWS, PRODUCT_MATRIX, OLA_Detailed };
