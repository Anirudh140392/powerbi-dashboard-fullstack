import xlsx from 'xlsx';
import fs from 'fs';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

let cachedData = null;

/**
 * Load Excel data into memory
 * @param {string} filePath - Path to the excel file
 */
export const loadExcelData = (filePath = process.env.EXCEL_DATA_PATH || './data/olap_mars_petcare.xlsx') => {
    try {
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

        if (!fs.existsSync(absolutePath)) {
            console.error(`❌ Excel file not found at: ${absolutePath}`);
            return null;
        }

        console.log(`📂 Loading Excel data from: ${absolutePath}`);
        const workbook = xlsx.readFile(absolutePath, { cellDates: true, dateNF: 'yyyy-mm-dd' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = xlsx.utils.sheet_to_json(sheet);

        const rows = xlsx.utils.sheet_to_json(sheet);

        cachedData = rows.map((row, index) => {
            // Helper to find value regardless of case or spaces in keys
            const getVal = (key) => {
                const actualKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
                return (actualKey !== undefined && row[actualKey] !== null) ? row[actualKey] : null;
            };

            const platformId = getVal('Platform_id');
            const locationId = getVal('Location_id');
            
            // Robust date parsing
            let rawDate = getVal('DATE');
            let parsedDate = dayjs(rawDate);
            
            // If common parsing fails, try specific formats
            if (!parsedDate.isValid() && typeof rawDate === 'string') {
                parsedDate = dayjs(rawDate, ['DD-MM-YYYY', 'YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY']);
            }
            
            const dateStr = parsedDate.isValid() ? parsedDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

            return {
                DATE: dateStr,
                Platform: String(getVal('Platform') || mapPlatform(platformId) || 'Unknown'),
                Location: String(getVal('Location') || locationId || 'Unknown'),
                Brand: String(getVal('Brand') || 'Unknown'),
                Category: String(getVal('Category') || 'Unknown'),
                Medal_Category: String(getVal('medal_category') || 'Unknown'),
                Product: String(getVal('Product') || 'Unknown'),
                Web_Pid: getVal('Web_Pid'),
                Comp_flag: Number(getVal('Comp_flag') || 0),
                Sales: parseFloat(getVal('Sales') || 0),
                Qty_Sold: parseFloat(getVal('Quantity_Sold') || 0),
                Ad_Spend: parseFloat(getVal('Spend') || 0),
                Ad_sales: parseFloat(getVal('Ad_Sales') || 0),
                Ad_Impressions: parseFloat(getVal('Impressions') || 0),
                Ad_Clicks: parseFloat(getVal('Clicks') || 0),
                Ad_Orders: parseFloat(getVal('Ad_Quantity_Sold') || 0),
                neno_osa: parseFloat(getVal('neno_osa') || 0),
                deno_osa: parseFloat(getVal('deno_osa') || 1),
                MRP: parseFloat(getVal('MRP') || 0),
                Selling_Price: parseFloat(getVal('Selling_Price') || 0)
            };
        });
        console.log(`✅ Loaded ${cachedData.length} rows from Excel`);
        return cachedData;
    } catch (err) {
        console.error("❌ Failed to load excel data:", err);
        return null;
    }
};

/**
 * Helper to map pf_id to Platform name
 */
const mapPlatform = (pf_id) => {
    if (!pf_id) return null;
    const maps = {
        1: 'Amazon',
        2: 'Blinkit',
        7: 'Zepto',
        11: 'BigBasket',
        26: 'Instamart'
    };
    const id = Number(pf_id);
    return maps[id] || 'Other';
};

/**
 * Perform a filter query on the cached Excel data
 */
/**
 * Filter the cached Excel data based on frontend selections
 * @param {Object} filters - Filter criteria from the frontend
 */
export const queryExcelData = (filters = {}) => {
    let result = [...(cachedData || [])];

    // Helper to check if a filter value is an actual selection 
    // This prevents "undefined" strings or "All" from wiping out data
    const isSelected = (val) => {
        if (!val || val === 'All' || val === 'undefined') return false;
        if (Array.isArray(val)) {
            return val.length > 0 && !val.includes('All') && !val.includes('undefined');
        }
        return val !== '';
    };

    // 1. Platform Filter
    if (isSelected(filters.platform)) {
        const platforms = Array.isArray(filters.platform) ? filters.platform : [filters.platform];
        result = result.filter(r => platforms.includes(r.Platform));
    }

    // 2. Brand Filter
    if (isSelected(filters.brand)) {
        const brands = Array.isArray(filters.brand) ? filters.brand : [filters.brand];
        result = result.filter(r => brands.includes(r.Brand));
    }

    // 3. Category Filter
    if (isSelected(filters.category)) {
        const cats = Array.isArray(filters.category) ? filters.category : [filters.category];
        result = result.filter(r => cats.includes(r.Category));
    }

    // 4. Date Range Filter (Fixes the 1970-01-01 issue)
    if (isSelected(filters.startDate)) {
        const start = dayjs(filters.startDate);
        // Only apply if it's a valid recent date, not the Unix Epoch
        if (start.year() > 1970) {
            result = result.filter(r => dayjs(r.DATE).isAfter(start) || dayjs(r.DATE).isSame(start, 'day'));
        }
    }

    if (isSelected(filters.endDate)) {
        const end = dayjs(filters.endDate);
        result = result.filter(r => dayjs(r.DATE).isBefore(end) || dayjs(r.DATE).isSame(end, 'day'));
    }

    // 5. Share of Search / Competitor Filter
    if (filters.is_rb_product !== undefined && filters.is_rb_product !== 'All') {
        // Comp_flag 0 represents your own brand (RB products)
        const targetFlag = filters.is_rb_product === true || filters.is_rb_product === 'true' ? 0 : 1;
        result = result.filter(r => r.Comp_flag === targetFlag);
    }

    // 6. SKU Name Search
    if (isSelected(filters.skuName)) {
        const skus = Array.isArray(filters.skuName) ? filters.skuName : [filters.skuName];
        result = result.filter(r =>
            skus.some(s => r.Product.toLowerCase().includes(s.toLowerCase()))
        );
    }

    // 7. SKU Code / Web PID Filter
    if (isSelected(filters.skuCode)) {
        const codes = Array.isArray(filters.skuCode) ? filters.skuCode : [filters.skuCode];
        result = result.filter(r =>
            codes.some(c => String(r.Web_Pid).includes(String(c)))
        );
    }

    // 8. Location Filter
    if (isSelected(filters.location)) {
        const locations = Array.isArray(filters.location) ? filters.location : [filters.location];
        result = result.filter(r => locations.includes(r.Location));
    }

    return result;
};

/**
 * Aggregate metrics from filtered data
 */
export const aggregateExcelMetrics = (data) => {
    return data.reduce((acc, row) => {
        acc.offtakes += row.Sales || 0;
        acc.sales += row.Sales || 0;
        acc.spends += row.Ad_Spend || 0;
        acc.adSales += row.Ad_sales || 0;
        acc.impressions += row.Ad_Impressions || 0;
        acc.clicks += row.Ad_Clicks || 0;
        acc.adOrders += row.Ad_Orders || 0; // Explicitly track ad orders for CVR
        acc.totalQty += row.Qty_Sold || 0;

        // Availability components
        acc.neno_osa += row.neno_osa || 0;
        acc.deno_osa += row.deno_osa || 0;

        // Promo components (averaging logic)
        if (row.MRP > 0) {
            const discount = (row.MRP - row.Selling_Price) / row.MRP;
            if (row.Comp_flag === 0) {
                acc.promoMySum += discount;
                acc.promoMyCount++;
            } else {
                acc.promoCompSum += discount;
                acc.promoCompCount++;
            }
        }
        return acc;
    }, {
        offtakes: 0, sales: 0, spends: 0, adSales: 0, impressions: 0,
        clicks: 0, adOrders: 0, totalQty: 0, neno_osa: 0, deno_osa: 0,
        promoMySum: 0, promoMyCount: 0, promoCompSum: 0, promoCompCount: 0
    });
};

export default {
    loadExcelData,
    queryExcelData,
    aggregateExcelMetrics
};

// Auto-load if path is provided in ENV
if (process.env.EXCEL_DATA_PATH) {
    loadExcelData();
}
