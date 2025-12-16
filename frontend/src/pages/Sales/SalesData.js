export const SALES_SUMMARY_DATA = {
    overallSales: 1047,

    mtd: {
        value: 1047,
        change: -30,
        comparison: "vs Last Month",
    },

    currentDRR: 75,

    projectedSales: {
        value: 2318,
        change: 0,
        comparison: "vs Last Month",
    },
};

export const SALES_MATRIX_DATA = {
    columns: ["Format", "MTD Sales", "Prev Month MTD", "Current DRR", "YTD Sales", "Last Year Sales", "Projected Sales"],
    rows: [
        {
            kpi: "Magnum",
            "MTD Sales": 148.6,
            "Prev Month MTD": 156.8,
            "Current DRR": 37.1,
            "YTD Sales": 8850,
            "Last Year Sales": 358,
            "Projected Sales": 1114.2,
            trend: { "MTD Sales": -5.2, "Prev Month MTD": 0, "Current DRR": 2.1, "YTD Sales": 12.5, "Last Year Sales": 0, "Projected Sales": 5.4 },
            series: {
                "MTD Sales": [130, 140, 135, 148.6],
                "Prev Month MTD": [150, 155, 153, 156.8],
                "Current DRR": [35, 36, 36.5, 37.1],
                "YTD Sales": [8000, 8200, 8500, 8850],
                "Last Year Sales": [300, 320, 340, 358],
                "Projected Sales": [1000, 1050, 1080, 1114.2]
            }
        },
        {
            kpi: "Core Tub",
            "MTD Sales": 118.1,
            "Prev Month MTD": 119.9,
            "Current DRR": 29.5,
            "YTD Sales": 20215,
            "Last Year Sales": 352,
            "Projected Sales": 885.6,
            trend: { "MTD Sales": -1.5, "Prev Month MTD": 0, "Current DRR": 1.2, "YTD Sales": 8.3, "Last Year Sales": 0, "Projected Sales": 3.2 },
            series: {
                "MTD Sales": [120, 122, 115, 118.1],
                "Prev Month MTD": [115, 116, 118, 119.9],
                "Current DRR": [28, 28.5, 29, 29.5],
                "YTD Sales": [19000, 19500, 19800, 20215],
                "Last Year Sales": [340, 345, 350, 352],
                "Projected Sales": [850, 860, 875, 885.6]
            }
        },
        {
            kpi: "Cornetto",
            "MTD Sales": 114.5,
            "Prev Month MTD": 153.7,
            "Current DRR": 28.6,
            "YTD Sales": 11878,
            "Last Year Sales": 421,
            "Projected Sales": 858.8,
            trend: { "MTD Sales": -25.5, "Prev Month MTD": 0, "Current DRR": -5.1, "YTD Sales": -2.4, "Last Year Sales": 0, "Projected Sales": -12.1 },
            series: {
                "MTD Sales": [140, 130, 120, 114.5],
                "Prev Month MTD": [150, 152, 153, 153.7],
                "Current DRR": [30, 29, 28.8, 28.6],
                "YTD Sales": [12000, 11950, 11900, 11878],
                "Last Year Sales": [400, 410, 415, 421],
                "Projected Sales": [900, 880, 870, 858.8]
            }
        },
        {
            kpi: "Premium Tub",
            "MTD Sales": 49.8,
            "Prev Month MTD": 41.7,
            "Current DRR": 12.5,
            "YTD Sales": 5716,
            "Last Year Sales": 210,
            "Projected Sales": 373.8,
            trend: { "MTD Sales": 19.4, "Prev Month MTD": 0, "Current DRR": 4.5, "YTD Sales": 15.6, "Last Year Sales": 0, "Projected Sales": 18.2 },
            series: {
                "MTD Sales": [40, 42, 45, 49.8],
                "Prev Month MTD": [40, 40.5, 41, 41.7],
                "Current DRR": [10, 11, 11.5, 12.5],
                "YTD Sales": [5000, 5200, 5500, 5716],
                "Last Year Sales": [200, 205, 208, 210],
                "Projected Sales": [320, 340, 360, 373.8]
            }
        },
        {
            kpi: "KW Sticks",
            "MTD Sales": 16.9,
            "Prev Month MTD": 20.6,
            "Current DRR": 4.2,
            "YTD Sales": 1919,
            "Last Year Sales": 80,
            "Projected Sales": 127.1,
            trend: { "MTD Sales": -17.9, "Prev Month MTD": 0, "Current DRR": -8.2, "YTD Sales": -5.1, "Last Year Sales": 0, "Projected Sales": -10.5 },
            series: {
                "MTD Sales": [22, 20, 18, 16.9],
                "Prev Month MTD": [20, 20.2, 20.4, 20.6],
                "Current DRR": [5, 4.8, 4.5, 4.2],
                "YTD Sales": [2000, 1980, 1950, 1919],
                "Last Year Sales": [70, 75, 78, 80],
                "Projected Sales": [140, 135, 130, 127.1]
            }
        },
        {
            kpi: "Slow Churn",
            "MTD Sales": 8.8,
            "Prev Month MTD": 7.3,
            "Current DRR": 2.2,
            "YTD Sales": 793,
            "Last Year Sales": 57,
            "Projected Sales": 65.6,
            trend: { "MTD Sales": 20.5, "Prev Month MTD": 0, "Current DRR": 5.1, "YTD Sales": 10.2, "Last Year Sales": 0, "Projected Sales": 15.3 },
            series: {
                "MTD Sales": [7, 7.5, 8, 8.8],
                "Prev Month MTD": [7, 7.1, 7.2, 7.3],
                "Current DRR": [1.8, 2, 2.1, 2.2],
                "YTD Sales": [700, 730, 760, 793],
                "Last Year Sales": [50, 52, 55, 57],
                "Projected Sales": [55, 60, 62, 65.6]
            }
        },
        {
            kpi: "Total",
            "MTD Sales": 476.6,
            "Prev Month MTD": 535.6,
            "Current DRR": 119.1,
            "YTD Sales": 52082,
            "Last Year Sales": 1584,
            "Projected Sales": 3574.5,
            trend: {},
            series: {
                "MTD Sales": [450, 460, 470, 476.6],
                "Prev Month MTD": [530, 532, 534, 535.6],
                "Current DRR": [115, 117, 118, 119.1],
                "YTD Sales": [50000, 51000, 51500, 52082],
                "Last Year Sales": [1500, 1520, 1550, 1584],
                "Projected Sales": [3500, 3520, 3550, 3574.5]
            }
        }
    ]
};
