
const generateDenseData = (dimensions, measureGenerators) => {
    const keys = Object.keys(dimensions);
    const arrays = keys.map(k => dimensions[k]);

    // Helper to generate cartesian product
    const cartesian = (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())), [[]]);

    const combinations = cartesian(...arrays);

    return combinations.map(combo => {
        const row = {};
        // Assign dimension values
        keys.forEach((key, index) => {
            row[key] = combo[index];
        });

        // Assign measure values
        Object.entries(measureGenerators).forEach(([key, generator]) => {
            row[key] = generator(row);
        });

        return row;
    });
};

// Data Generators
const platforms = ["Blinkit", "Zepto", "Swiggy Instamart", "Flipkart", "Amazon", "Bigbasket"];
const cities = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Pune", "Kolkata"];
const categories = ["Ice Cream", "Snacks", "Beverages", "Pantry", "Dairy", "Personal Care"];
const brands = ["Kwality Wall's", "Amul", "Vadilal", "Mother Dairy", "Havmor", "Baskin Robbins"];
const zones = ["North", "South", "East", "West"];
const skus = ["Cornetto Double Choc", "Magnum Classic", "Tubs Vanilla", "Choco Bar", "Cone Butterscotch"];
const timeSlots = ["Morning", "Afternoon", "Evening"];
const warehouses = ["WH-Bhiwandi", "WH-Bilaspur", "WH-Farukhnagar", "WH-Dankuni"];
const stockStatuses = ["Available", "Reserved", "Damaged", "In-Transit"];
const campaigns = ["Brand Search", "Retargeting", "Competitor Conquesting", "Category Generic", "Festive Sale"];

// Sales Performance Data dimensions (India Specific)
const states = ["Maharashtra", "Delhi", "Karnataka", "Telangana", "Tamil Nadu", "Gujarat", "West Bengal"];
const products = ["Shampoo", "Lotion", "Ice Cream", "Electronics", "Apparel"];
const orderSources = ["Distributor", "Store", "Web", "Direct"];
const years = ["FY 2022", "FY 2023", "FY 2024", "FY 2025"];

export const datasets = {
    salesPerformance: {
        label: "Sales Performance",
        fields: [
            { key: "state", label: "State", type: "dimension", description: "Geography Name" },
            { key: "product", label: "Product", type: "dimension", description: "Product Category" },
            { key: "orderSource", label: "Order Source", type: "dimension", description: "Sales Channel" },
            { key: "year", label: "Fiscal Year", type: "dimension", description: "Financial Year" },
            { key: "unitsSold", label: "Units Sold", type: "measure", description: "Volume" },
            { key: "inStock", label: "In Stock", type: "measure", description: "Inventory Level" },
            { key: "soldAmount", label: "Sold Amount", type: "measure", description: "Revenue" },
        ],
        initialConfig: {
            rows: ["state", "product"],
            columns: ["year"],
            values: [
                { id: "units-sum", key: "unitsSold", label: "Units Sold", agg: "sum", format: "number" },
                { id: "amount-sum", key: "soldAmount", label: "Revenue", agg: "sum", format: "currency" },
            ],
            filters: {},
        },
        data: generateDenseData(
            { state: states, product: products, year: years, orderSource: orderSources },
            {
                unitsSold: () => Math.floor(Math.random() * 500) + 100,
                inStock: () => Math.floor(Math.random() * 1000) + 200,
                soldAmount: (row) => (Math.floor(Math.random() * 500) + 100) * (Math.random() * 20 + 10), // correlates loosely with units
            }
        )
    },
    visibility: {
        label: "Visibility Analysis",
        fields: [
            { key: "platform", label: "Platform", type: "dimension", description: "E-commerce Platform" },
            { key: "city", label: "City", type: "dimension", description: "Metro City" },
            { key: "category", label: "Category", type: "dimension", description: "Product Category" },
            { key: "brand", label: "Brand", type: "dimension", description: "Brand Name" },
            { key: "sos_weighted", label: "Weighted SOS", type: "measure", description: "Share of Shelf (Weighted)" },
            { key: "facings", label: "Total Facings", type: "measure", description: "Number of visual facings" },
            { key: "compliance", label: "Compliance Score", type: "measure", description: "Planogram Compliance" },
        ],
        initialConfig: {
            rows: ["city", "platform"],
            columns: ["category"],
            values: [
                { id: "sos-avg", key: "sos_weighted", label: "Avg SOS %", agg: "avg", format: "percent" },
                { id: "facings-sum", key: "facings", label: "Total Facings", agg: "sum", format: "compact" },
            ],
            filters: {},
        },
        data: generateDenseData(
            { platform: platforms.slice(0, 4), city: cities.slice(0, 4), category: categories.slice(0, 3), brand: brands.slice(0, 3) },
            {
                sos_weighted: () => Math.random() * 0.4 + 0.1, // 10% to 50%
                facings: () => Math.floor(Math.random() * 100) + 20,
                compliance: () => Math.floor(Math.random() * 30) + 70, // 70-100
            }
        )
    },
    availability: {
        label: "Availability Analysis",
        fields: [
            { key: "platform", label: "Platform", type: "dimension", description: "Platform Name" },
            { key: "zone", label: "Zone", type: "dimension", description: "Geographic Zone" },
            { key: "sku", label: "SKU Name", type: "dimension", description: "Product SKU" },
            { key: "time_slot", label: "Time Slot", type: "dimension", description: "Time of Day" },
            { key: "total_pings", label: "Total Checks", type: "measure", description: "Availability Pings" },
            { key: "available_pings", label: "Available Pings", type: "measure", description: "Successful Pings" },
            { key: "lost_revenue", label: "Lost Revenue", type: "measure", description: "Revenue Opportunity Lost" },
        ],
        initialConfig: {
            rows: ["platform", "sku"],
            columns: ["zone"],
            values: [
                {
                    id: "osa-calc",
                    key: "available_pings",
                    denominatorKey: "total_pings",
                    label: "OSA %",
                    agg: "sum",
                    calc: "ratio",
                },
                { id: "lost_revenue-sum", key: "lost_revenue", label: "Lost Revenue", agg: "sum", format: "currency" },
            ],
            filters: {},
        },
        data: generateDenseData(
            { platform: platforms.slice(0, 3), zone: zones, sku: skus.slice(0, 4), time_slot: timeSlots },
            {
                total_pings: () => 100,
                available_pings: () => Math.floor(Math.random() * 20) + 80, // 80-100
                lost_revenue: (row) => Math.floor(Math.random() * 5000),
            }
        )
    },
    sales: {
        label: "Domestic Sales",
        fields: [
            { key: "platform", label: "Platform", type: "dimension", description: "Sales Channel" },
            { key: "city", label: "City", type: "dimension", description: "City" },
            { key: "category", label: "Category", type: "dimension", description: "Product Category" },
            { key: "mtd_sales", label: "MTD Sales", type: "measure", description: "Month to Date Sales (INR)" },
            { key: "target", label: "Target Sales", type: "measure", description: "Sales Target" },
        ],
        initialConfig: {
            rows: ["platform", "city"],
            columns: ["category"],
            values: [
                { id: "mtd_sales-sum", key: "mtd_sales", label: "MTD Sales", agg: "sum", format: "compact" },
                {
                    id: "achievement-calc",
                    key: "mtd_sales",
                    denominatorKey: "target",
                    label: "Achievement",
                    agg: "sum",
                    calc: "ratio",
                },
            ],
            filters: {},
        },
        data: generateDenseData(
            { platform: platforms.slice(0, 4), city: cities.slice(0, 5), category: categories },
            {
                mtd_sales: () => Math.floor(Math.random() * 1000000) + 200000,
                target: () => Math.floor(Math.random() * 1000000) + 250000,
            }
        )
    },
    inventory: {
        label: "Inventory Management",
        fields: [
            { key: "warehouse", label: "Warehouse", type: "dimension", description: "Warehouse Location" },
            { key: "stock_status", label: "Stock Status", type: "dimension", description: "Availability Status" },
            { key: "stock_value", label: "Stock Value", type: "measure", description: "Value of Stock (INR)" },
            { key: "sku_id", label: "SKU ID", type: "dimension", description: "Unique Product ID" },
        ],
        initialConfig: {
            rows: ["warehouse"],
            columns: ["stock_status"],
            values: [
                { id: "stock_value-sum", key: "stock_value", label: "Total Value", agg: "sum", format: "currency" },
                { id: "sku-unique", key: "sku_id", label: "Unique SKUs", agg: "distinctCount", format: "number" },
            ],
            filters: {},
        },
        data: generateDenseData(
            { warehouse: warehouses, stock_status: stockStatuses, sku_id: ["SKU-001", "SKU-002", "SKU-003", "SKU-004", "SKU-005"] },
            {
                stock_value: () => Math.floor(Math.random() * 5000000) + 100000,
            }
        )
    },
    performanceMarketing: {
        label: "Performance Marketing",
        fields: [
            { key: "platform", label: "Platform", type: "dimension", description: "Ad Platform" },
            { key: "campaign", label: "Campaign", type: "dimension", description: "Campaign Name" },
            { key: "spend", label: "Spend", type: "measure", description: "Ad Spend" },
            { key: "revenue", label: "Revenue", type: "measure", description: "Ad Revenue" },
            { key: "clicks", label: "Clicks", type: "measure", description: "Ad Clicks" },
            { key: "impressions", label: "Impressions", type: "measure", description: "Ad Impressions" },
            { key: "order_id", label: "Order ID", type: "dimension", description: "Unique Order" },
        ],
        initialConfig: {
            rows: ["platform", "campaign"],
            columns: [],
            values: [
                { id: "spend-sum", key: "spend", label: "Spend", agg: "sum", format: "currency" },
                {
                    id: "roas-calc",
                    key: "revenue",
                    denominatorKey: "spend",
                    label: "ROAS",
                    agg: "sum",
                    calc: "ratio",
                },
                { id: "orders-unique", key: "order_id", label: "Distinct Orders", agg: "distinctCount", format: "number" },
            ],
            filters: {},
        },
        data: generateDenseData(
            { platform: ["Google", "Meta", "Amazon Ads", "Criteo"], campaign: campaigns },
            {
                spend: () => Math.floor(Math.random() * 50000) + 5000,
                revenue: (row) => (Math.floor(Math.random() * 50000) + 5000) * (Math.random() * 4 + 1), // ROAS 1-5
                clicks: () => Math.floor(Math.random() * 5000) + 500,
                impressions: () => Math.floor(Math.random() * 100000) + 10000,
                order_id: () => `ORD-${Math.floor(Math.random() * 900) + 100}`,
            }
        )
    },
};
