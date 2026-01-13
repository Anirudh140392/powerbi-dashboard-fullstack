import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SlidersHorizontal, X, Plus, Minus } from 'lucide-react'
import { Box, Button, Typography, Select, MenuItem } from '@mui/material'
import { KpiFilterPanel } from '../KpiFilterPanel'
import PaginationFooter from '../CommonLayout/PaginationFooter'
import { FilterContext } from '../../utils/FilterContext'
import axiosInstance from '../../api/axiosInstance'
import dayjs from 'dayjs'

const KPI_LABELS = {
  impressions: 'Impressions',
  conversion: 'Conversion',
  spend: 'Spend',
  cpm: 'CPM',
  roas: 'ROAS',
  sales: 'Sales',
  inorganic: 'Inorganic Sales',
}



// Format numbers in Indian format (K, Lacs, Crores)
const formatIndianNumber = (num) => {
  if (num === null || num === undefined) return '–';
  const val = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num);
  if (!Number.isFinite(val)) return '–';

  const absVal = Math.abs(val);
  if (absVal >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
  if (absVal >= 100000) return `${(val / 100000).toFixed(2)} L`;
  if (absVal >= 1000) return `${(val / 1000).toFixed(1)} K`;
  return val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const kpiModes = {
  impressions: {
    label: 'Impressions',
    description: 'Total impressions. Higher is better vs benchmark.',
    formatter: (v) => formatIndianNumber(v),
    heat: (v) =>
      v >= 200
        ? 'bg-emerald-50 text-emerald-700'
        : v >= 50
          ? 'bg-amber-50 text-amber-700'
          : 'bg-rose-50 text-rose-700',
  },
  conversion: {
    label: 'Conversion',
    description: 'Conversion rate or count.',
    formatter: (v) => (Number.isFinite(v) ? v.toFixed(2) + '%' : ''),
    heat: (v) =>
      v >= 0.05
        ? 'bg-emerald-50 text-emerald-700'
        : v >= 0.02
          ? 'bg-amber-50 text-amber-700'
          : 'bg-rose-50 text-rose-700',
  },
  spend: {
    label: 'Spend',
    description: 'Ad spend for the period.',
    formatter: (v) => formatIndianNumber(v),
    heat: () => 'bg-white text-slate-700',
  },
  cpm: {
    label: 'CPM',
    description: 'Cost per 1000 impressions.',
    formatter: (v) => formatIndianNumber(v),
    heat: (v) =>
      v <= 300
        ? 'bg-emerald-50 text-emerald-700'
        : v <= 400
          ? 'bg-amber-50 text-amber-700'
          : 'bg-rose-50 text-rose-700',
  },
  roas: {
    label: 'ROAS',
    description: 'Return on ad spend.',
    formatter: (v) => (Number.isFinite(v) ? v.toFixed(2) : ''),
    heat: (v) =>
      v >= 4
        ? 'bg-emerald-50 text-emerald-700'
        : v >= 2
          ? 'bg-amber-50 text-amber-700'
          : 'bg-rose-50 text-rose-700',
  },
  sales: {
    label: 'Sales',
    description: 'Total Sales (Organic + Ad)',
    formatter: (v) => formatIndianNumber(v),
    heat: (v) => 'bg-white text-slate-700',
  },
  inorganic: {
    label: 'Inorganic Sales',
    description: 'Ad Sales (Sum of Ad_Sales)',
    formatter: (v) => formatIndianNumber(v),
    heat: () => 'bg-white text-slate-700',
  },
}

// ---------------- SAMPLE DATA ----------------
const sampleData = [
  {
    format: 'Cassata',
    days: [
      {
        day: 1,
        weekendFlag: 'Weekday',
        tdp: 'TDP1',
        month: 'Oct',
        year: 2025,
        quarters: {
          Q3: { impressions: 0.9, conversion: 0.01, spend: 0.2, cpm: 460, roas: 1.5, sales: 4.0, inorganic: 0.19 },
          Q4: { impressions: 0.8, conversion: 0.01, spend: 0, cpm: 440, roas: 1.67, sales: 4.33, inorganic: 0.17 },
        },
      },
      {
        day: 2,
        weekendFlag: 'Weekday',
        tdp: 'TDP1',
        month: 'Oct',
        year: 2025,
        quarters: {
          Q3: { impressions: 1.0, conversion: 0.02, spend: 0.3, cpm: 450, roas: 1.6, sales: 4.2, inorganic: 0.2 },
          Q4: { impressions: 1.1, conversion: 0.01, spend: 0, cpm: 435, roas: 1.7, sales: 4.1, inorganic: 0.18 },
        },
      },
      {
        day: 3,
        weekendFlag: 'Weekday',
        tdp: 'TDP1',
        month: 'Oct',
        year: 2025,
        quarters: {
          Q3: { impressions: 1.3, conversion: 0.03, spend: 0.4, cpm: 480, roas: 1.8, sales: 4.8, inorganic: 0.22 },
          Q4: { impressions: 1.2, conversion: 0.02, spend: 0.1, cpm: 450, roas: 1.9, sales: 5.0, inorganic: 0.20 },
        },
      },
      {
        day: 4,
        weekendFlag: 'Weekend',
        tdp: 'TDP1',
        month: 'Oct',
        year: 2025,
        quarters: {
          Q3: { impressions: 1.6, conversion: 0.04, spend: 0.5, cpm: 490, roas: 2.2, sales: 5.8, inorganic: 0.26 },
          Q4: { impressions: 1.4, conversion: 0.03, spend: 0.15, cpm: 455, roas: 2.0, sales: 5.5, inorganic: 0.22 },
        },
      },
    ],
  },
  {
    format: 'Core Tub',
    days: [
      {
        day: 1,
        weekendFlag: 'Weekday',
        tdp: 'TDP1',
        month: 'Oct',
        year: 2025,
        quarters: {
          Q3: { impressions: 1.1, conversion: 0.02, spend: 0.5, cpm: 410, roas: 3.1, sales: 6.5, inorganic: 0.25 },
          Q4: { impressions: 1.0, conversion: 0.04, spend: 0, cpm: 417, roas: 5.0, sales: 7.6, inorganic: 0.23 },
        },
      },
      {
        day: 2,
        weekendFlag: 'Weekday',
        tdp: 'TDP1',
        month: 'Oct',
        year: 2025,
        quarters: {
          Q3: { impressions: 1.3, conversion: 0.03, spend: 0.6, cpm: 425, roas: 3.3, sales: 7.0, inorganic: 0.3 },
          Q4: { impressions: 1.2, conversion: 0.05, spend: 0.1, cpm: 420, roas: 5.2, sales: 8.0, inorganic: 0.25 },
        },
      },
      {
        day: 3,
        weekendFlag: 'Weekend',
        tdp: 'TDP1',
        month: 'Oct',
        year: 2025,
        quarters: {
          Q3: { impressions: 1.5, conversion: 0.04, spend: 0.7, cpm: 430, roas: 3.5, sales: 7.5, inorganic: 0.35 },
          Q4: { impressions: 1.4, conversion: 0.06, spend: 0.2, cpm: 425, roas: 5.5, sales: 8.5, inorganic: 0.28 },
        },
      },
    ],
  },
  {
    format: 'Kw Sticks',
    days: [
      {
        day: 1,
        weekendFlag: 'Weekday',
        tdp: 'TDP2',
        month: 'Oct',
        year: 2025,
        quarters: {
          Q3: { impressions: 0.5, conversion: 0.02, spend: 0.2, cpm: 380, roas: 6.0, sales: 2.0, inorganic: 0.1 },
          Q4: { impressions: 1.8, conversion: 0.02, spend: 0.8, cpm: 350, roas: 4.5, sales: 9.0, inorganic: 0.25 },
        },
      },
      {
        day: 2,
        weekendFlag: 'Weekday',
        tdp: 'TDP2',
        month: 'Oct',
        year: 2025,
        quarters: {
          Q3: { impressions: 1.5, conversion: 0.01, spend: 0.4, cpm: 350, roas: 4.0, sales: 8.0, inorganic: 0.2 },
          Q4: { impressions: 2.0, conversion: 0.01, spend: 1.0, cpm: 340, roas: 4.0, sales: 10.0, inorganic: 0.29 },
        },
      },
    ],
  },
  {
    format: 'Magnum',
    days: [
      {
        day: 1,
        weekendFlag: 'Weekday',
        tdp: 'TDP3',
        month: 'Oct',
        year: 2025,
        quarters: {
          Q3: { impressions: 1.5, conversion: 0.01, spend: 0.6, cpm: 300, roas: 3.2, sales: 9.0, inorganic: 0.2 },
          Q4: { impressions: 2.2, conversion: 0.02, spend: 1.1, cpm: 350, roas: 3.1, sales: 9.2, inorganic: 0.29 },
        },
      },
      {
        day: 2,
        weekendFlag: 'Weekend',
        tdp: 'TDP3',
        month: 'Oct',
        year: 2025,
        quarters: {
          Q3: { impressions: 2.0, conversion: 0.02, spend: 0.8, cpm: 310, roas: 3.8, sales: 10.0, inorganic: 0.25 },
          Q4: { impressions: 2.5, conversion: 0.02, spend: 1.2, cpm: 360, roas: 3.5, sales: 9.8, inorganic: 0.35 },
        },
      },
    ],
  },
]

// ---------------- FILTER OPTIONS ----------------
const weekendOptions = ['All', 'Weekend', 'Weekday']
const tdpOptions = ['All', 'TDP1', 'TDP2', 'TDP3']
const monthOptions = ['All', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const yearOptions = ['All', '2024', '2025']

const monthToQuarter = {
  Jan: 'Q1',
  Feb: 'Q1',
  Mar: 'Q1',
  Apr: 'Q2',
  May: 'Q2',
  Jun: 'Q2',
  Jul: 'Q3',
  Aug: 'Q3',
  Sep: 'Q3',
  Oct: 'Q4',
  Nov: 'Q4',
  Dec: 'Q4',
}

const quarterMonths = {
  Q1: ['Jan', 'Feb', 'Mar'],
  Q2: ['Apr', 'May', 'Jun'],
  Q3: ['Jul', 'Aug', 'Sep'],
  Q4: ['Oct', 'Nov', 'Dec'],
}

const FROZEN_WIDTHS = {
  format: 110,
  day: 80,
}

const LEFT_DAY = FROZEN_WIDTHS.format

// ---------------- FILTER COMPONENT ----------------
const FilterSelect = ({ label, value, options, onChange }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[11px] text-slate-500">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </div>
)

// ------------------- AGGREGATORS -------------------
const getSafe = (val) => Number.isFinite(val) ? val : 0;

function aggregateQuarterKpis(rows) {
  const aggs = {};

  rows.forEach((row) => {
    if (!row.quarters) return;
    Object.entries(row.quarters).forEach(([q, metrics]) => {
      if (!metrics) return;
      if (!aggs[q]) {
        aggs[q] = {
          impressions: 0,
          spend: 0,
          clicks: 0,
          orders: 0, // Init orders
          adSales: 0,
          totalSales: 0
        };
      }
      aggs[q].impressions += getSafe(metrics.impressions);
      aggs[q].spend += getSafe(metrics.spend);
      aggs[q].clicks += getSafe(metrics.clicks);
      aggs[q].orders += getSafe(metrics.orders); // Add orders aggregation
      aggs[q].adSales += getSafe(metrics.adSales);
      aggs[q].totalSales += getSafe(metrics.totalSales);
    });
  });

  const result = {};
  Object.keys(aggs).forEach(q => {
    const a = aggs[q];
    result[q] = {
      impressions: a.impressions,
      spend: a.spend,
      conversion: a.clicks ? (a.orders / a.clicks) : 0, // Orders / Clicks
      cpm: a.impressions ? ((a.spend / a.impressions) * 1000) : 0,
      roas: a.spend ? (a.adSales / a.spend) : 0,
      sales: a.totalSales,       // Total Sales
      inorganic: a.adSales,      // Ad Sales Value
    };
  });
  return result;
}

function aggregateMonthKpis(rows) {
  const aggs = {};
  rows.forEach((row) => {
    // Row has month property?
    const m = row.month;
    if (!m) return;
    if (!aggs[m]) aggs[m] = { impressions: 0, spend: 0, clicks: 0, orders: 0, adSales: 0, totalSales: 0 };

    // We need to access the metrics for this row.
    // The row itself represents a day or category. 
    // If row is a Day (leaf), it has its own metrics.
    // Where are they stored? in row.quarters? 
    // The transformation logic puts metrics in `quarters`.
    // Let's assume we aggregate ALL quarters data for the month row?
    // Or we look at specific quarter?
    // Actually, simpler: The DrilldownTable column logic iterates `quarters`. 
    // `aggregateMonthKpis` is used to create the "Header Row" for the Category, aggregating all its children (Days).
    const qData = Object.values(row.quarters || {})[0]; // Take first quarter data found
    if (qData) {
      aggs[m].impressions += getSafe(qData.impressions);
      aggs[m].spend += getSafe(qData.spend);
      aggs[m].clicks += getSafe(qData.clicks);
      aggs[m].orders += getSafe(qData.orders); // Track orders
      aggs[m].adSales += getSafe(qData.adSales);
      aggs[m].totalSales += getSafe(qData.totalSales);
    }
  });

  const result = {};
  Object.keys(aggs).forEach(m => {
    const a = aggs[m];
    result[m] = {
      impressions: a.impressions,
      spend: a.spend,
      conversion: a.clicks ? (a.orders / a.clicks) : 0, // Orders / Clicks (Conversion Rate)
      cpm: a.impressions ? ((a.spend / a.impressions) * 1000) : 0,
      roas: a.spend ? (a.adSales / a.spend) : 0,
      sales: a.totalSales,
      inorganic: a.adSales,
    };
  });
  return result;
}


// -------------------------------------------------------------
// ---------------------- MAIN COMPONENT ------------------------
// -------------------------------------------------------------
export default function DrilldownLatestTable() {
  console.log("DrilldownLatestTable loaded - Version 2 (APIData)")
  const [activeKpi, setActiveKpi] = useState('roas')
  const [visibleKpis, setVisibleKpis] = useState({
    impressions: true,
    conversion: true,
    spend: true,
    cpm: true,
    roas: true,
    sales: true,
    inorganic: true,
  })
  const [expandedRows, setExpandedRows] = useState(new Set())
  const visibleKpiKeys = useMemo(
    () => Object.keys(KPI_LABELS).filter((k) => visibleKpis[k]),
    [visibleKpis]
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  // Use FilterContext values - PM specific
  const { pmSelectedPlatform, pmSelectedBrand, selectedZone, timeStart, timeEnd } = React.useContext(FilterContext);

  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState([]);

  // ---------- FILTERS STATE ----------
  const [activeFilters, setActiveFilters] = useState({
    brands: [],
    categories: [],
    zones: [],
    keywords: [],
    skus: [],
    platforms: [],
    kpiRules: null,
    weekendFlag: [],
  });

  // Filter Options State
  const [filterOptionsData, setFilterOptionsData] = useState({
    brands: [],
    categories: [],
    zones: [],
    keywords: [],
  });

  const [localFilters, setLocalFilters] = useState({
    weekendFlag: 'All',
    tdp: 'All',
    month: 'All',
    year: 'All',
    format: 'All', // This will filter the Categories if needed
    day: '',
  });

  const [sortField, setSortField] = useState('format')
  const [sortDir, setSortDir] = useState('asc')

  // Dynamically determine quarters AND months from data
  const { quarters, quarterMonths } = useMemo(() => {
    if (!apiData || apiData.length === 0) return { quarters: [], quarterMonths: {} };

    // Extract unique quarters from dates
    const uniqueQuarters = new Set();
    const monthsByQuarter = {};

    apiData.forEach(item => {
      const d = dayjs(item.date);
      const mIdx = d.month(); // 0-11
      const mName = d.format('MMM'); // Jan, Feb...

      let q = '';
      if (mIdx < 3) q = 'Q1';
      else if (mIdx < 6) q = 'Q2';
      else if (mIdx < 9) q = 'Q3';
      else q = 'Q4';

      if (q) {
        uniqueQuarters.add(q);
        if (!monthsByQuarter[q]) monthsByQuarter[q] = new Set();
        monthsByQuarter[q].add(mName);
      }
    });

    const sortedQuarters = Array.from(uniqueQuarters).sort();

    // Month order for sorting
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const sortedQuarterMonths = {};

    sortedQuarters.forEach(q => {
      if (monthsByQuarter[q]) {
        sortedQuarterMonths[q] = Array.from(monthsByQuarter[q]).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
      } else {
        sortedQuarterMonths[q] = [];
      }
    });

    return { quarters: sortedQuarters, quarterMonths: sortedQuarterMonths };
  }, [apiData]);

  const [expandedQuarters, setExpandedQuarters] = useState(new Set(quarters))

  // Make sure to update expanded quarters when quarters change (e.g. initial load)
  useEffect(() => {
    if (quarters.length > 0) {
      setExpandedQuarters(new Set(quarters));
    }
  }, [quarters.join(',')]);

  // Fetch Filter Options (Initial)
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [brandsRes, zonesRes, catsRes] = await Promise.all([
          axiosInstance.get('/performance-marketing/brands', { params: { platform: Array.isArray(pmSelectedPlatform) ? pmSelectedPlatform.join(',') : pmSelectedPlatform } }),
          axiosInstance.get('/performance-marketing/zones'),
          axiosInstance.get('/performance-marketing/categories')
        ]);

        const formatOptions = (list) => list.map(item => ({ id: item, label: item, value: item }));

        setFilterOptionsData(prev => ({
          ...prev,
          brands: formatOptions(brandsRes.data || []),
          zones: formatOptions(zonesRes.data || []),
          categories: formatOptions(catsRes.data || [])
        }));
      } catch (error) {
        console.error("Error fetching filter options:", error);
      }
    };
    fetchOptions();
  }, [pmSelectedPlatform]);

  // Fetch Keywords when Categories change
  useEffect(() => {
    const fetchKeywords = async () => {
      try {
        const categories = activeFilters.categories.length > 0 ? activeFilters.categories.join(',') : '';
        const response = await axiosInstance.get('/performance-marketing/keywords', { params: { category: categories } });

        const formatOptions = (list) => list.map(item => ({ id: item, label: item, value: item }));

        setFilterOptionsData(prev => ({
          ...prev,
          keywords: formatOptions(response.data || [])
        }));
      } catch (error) {
        console.error("Error fetching keywords:", error);
      }
    };
    fetchKeywords();
  }, [activeFilters.categories]);

  // Fetch Data with date filter support
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {
          platform: Array.isArray(pmSelectedPlatform) ? pmSelectedPlatform.join(',') : (pmSelectedPlatform || 'All'),
          brand: activeFilters.brands.length > 0 ? activeFilters.brands.join(',') : (Array.isArray(pmSelectedBrand) ? pmSelectedBrand.join(',') : pmSelectedBrand),
          zone: activeFilters.zones.length > 0 ? activeFilters.zones.join(',') : (Array.isArray(selectedZone) ? selectedZone.join(',') : selectedZone),
          category: activeFilters.categories.length > 0 ? activeFilters.categories.join(',') : '',
          keywords: activeFilters.keywords.length > 0 ? activeFilters.keywords.join(',') : '',
          weekendFlag: activeFilters.weekendFlag?.length > 0 ? activeFilters.weekendFlag.join(',') : (localFilters.weekendFlag === 'All' ? '' : localFilters.weekendFlag),
          startDate: timeStart?.format?.("YYYY-MM-DD"),
          endDate: timeEnd?.format?.("YYYY-MM-DD")
        };

        const response = await axiosInstance.get('/performance-marketing/format-performance', { params });
        setApiData(response.data);

      } catch (error) {
        console.error("Error fetching format performance:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pmSelectedPlatform, pmSelectedBrand, selectedZone, localFilters.weekendFlag, timeStart, timeEnd, activeFilters]);


  // --------------- TRANSFORM API DATA ---------------
  const hierarchy = useMemo(() => {
    if (!apiData || apiData.length === 0) return [];

    // Group by Category
    const byCategory = new Map();

    apiData.forEach(item => {
      const cat = item.Category || 'Other';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(item);
    });

    const rows = [];

    // Helper helpers
    const getMonthName = (dateStr) => dayjs(dateStr).format('MMM');
    const getQuarter = (dateStr) => {
      const m = dayjs(dateStr).month(); // 0-11
      if (m < 3) return 'Q1';
      if (m < 6) return 'Q2';
      if (m < 9) return 'Q3';
      return 'Q4';
    };

    // Process each Category
    byCategory.forEach((items, category) => {
      const catId = category; // unique ID

      console.log(`📊 [DrilldownTable] Processing category: ${category}, Items count: ${items.length}`);

      // We need to bucket items by Quarter/Month/Day
      const transformedItems = items.map(item => {
        const d = dayjs(item.date);
        const q = getQuarter(item.date);
        const m = getMonthName(item.date); // Nov, Dec, etc.

        // Calculate metrics from tb_zepto_pm_keyword_rca columns
        const imps = Number(item.impressions) || 0;
        const clicks = Number(item.clicks) || 0;
        const spend = Number(item.spend) || 0;
        const orders = Number(item.orders) || 0; // Get orders
        const revenue = Number(item.sales) || Number(item.total_sales) || 0; // revenue column

        const transformed = {
          format: category,
          date: item.date,  // Store actual date string
          day: d.date(), // 1-31
          month: m,
          year: d.year(),
          quarters: {
            [q]: { // Use QUARTER as key again
              impressions: imps,
              spend: spend,
              clicks: clicks,
              orders: orders, // Pass orders
              adSales: revenue,
              totalSales: revenue,
            }
          }
        };

        console.log(`  📅 Date: ${item.date} → Day: ${d.date()}, Q: ${q}, Imps: ${imps}, Spend: ${spend}`);
        return transformed;
      });

      rows.push({
        id: catId,
        depth: 0,
        label: category,
        level: 'format',
        format: category,
        quarters: aggregateQuarterKpis(transformedItems),
        months: aggregateMonthKpis(transformedItems),
        hasChildren: true
      });

      // Direct drilldown: expand Category -> Individual Dates
      if (expandedRows.has(catId)) {
        console.log(`🔽 [DrilldownTable] Expanding category: ${category}`);

        // Aggregate by day to prevent duplicates, BUT keep quarters separate
        const dayAggs = new Map();

        transformedItems.forEach(item => {
          if (item.day < 1 || item.day > 31) return;

          if (!dayAggs.has(item.day)) {
            dayAggs.set(item.day, {
              day: item.day,
              date: item.date,  // Store actual date
              quarters: {}
            });
          }

          const agg = dayAggs.get(item.day);
          const q = Object.keys(item.quarters)[0];
          const metrics = item.quarters[q];

          if (metrics) {
            if (!agg.quarters[q]) {
              agg.quarters[q] = {
                impressions: 0, spend: 0, clicks: 0, orders: 0, adSales: 0, totalSales: 0
              };
            }
            agg.quarters[q].impressions += getSafe(metrics.impressions);
            agg.quarters[q].spend += getSafe(metrics.spend);
            agg.quarters[q].clicks += getSafe(metrics.clicks);
            agg.quarters[q].orders += getSafe(metrics.orders);
            agg.quarters[q].adSales += getSafe(metrics.adSales);
            agg.quarters[q].totalSales += getSafe(metrics.totalSales);
          }
        });

        console.log(`  📊 Days with data for ${category}:`, Array.from(dayAggs.keys()).sort((a, b) => a - b));

        // Create rows from aggregated day data - only for days with actual data
        Array.from(dayAggs.values())
          .filter(aggItem => {
            const hasData = Object.keys(aggItem.quarters).length > 0;
            if (!hasData) {
              console.log(`  ⚠️ Day ${aggItem.day} has no quarter data, skipping`);
            }
            return hasData;
          })
          .sort((a, b) => a.day - b.day)
          .forEach((aggItem) => {
            const dayId = `${catId}-d-${aggItem.day}`;
            const quartersData = {};

            // Calculate Key Metrics per Quarter
            Object.entries(aggItem.quarters).forEach(([q, raw]) => {
              const imps = raw.impressions;
              const clicks = raw.clicks;
              const spend = raw.spend;
              const orders = raw.orders;
              const sales = raw.totalSales;
              const adSales = raw.adSales;

              quartersData[q] = {
                impressions: imps,
                spend: spend,
                conversion: clicks ? (orders / clicks) * 100 : 0, // Multiply by 100 for percentage
                cpm: imps ? ((spend / imps) * 1000) : 0,
                roas: spend ? (adSales / spend) : 0,
                sales: sales,
                inorganic: adSales
              };

              console.log(`    ✅ Day ${aggItem.day} (${aggItem.date}) - Q${q}: Imps=${imps}, Spend=${spend}, Sales=${sales}`);
            });

            rows.push({
              id: dayId,
              depth: 1,
              label: aggItem.date || '',  // Show actual date as label
              level: 'day',
              format: category,
              day: aggItem.day,
              quarters: quartersData,
              months: {},
              hasChildren: false
            });
          });
      }

    });

    return rows;
  }, [apiData, expandedRows]); // filtered by api response directly

  // Reset page when data changes
  useEffect(() => {
    setPage(1)
  }, [apiData, pageSize])

  const totalPages = Math.max(1, Math.ceil(hierarchy.length / pageSize))
  const pageRows = hierarchy.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)

  const toggleSort = (field) => {
    setSortField(field)
    setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
  }

  const toggleKpiVisibility = (k) =>
    setVisibleKpis((prev) => ({ ...prev, [k]: !prev[k] }))

  const resetFilters = () =>
    setLocalFilters({
      weekendFlag: 'All',
      tdp: 'All',
      month: 'All',
      year: 'All',
      format: 'All',
      day: '',
    })

  const activeMeta = kpiModes[activeKpi]



  return (
    <div className="rounded-3xl flex-col bg-slate-50 relative">
      {/* ------------------ KPI FILTER MODAL ------------------ */}
      {filterPanelOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-900/40 px-4 pb-4 pt-24 transition-all backdrop-blur-sm">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl h-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Advanced Filters</h2>
                <p className="text-sm text-slate-500">Configure data visibility and rules</p>
              </div>
              <button
                onClick={() => setFilterPanelOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-hidden bg-slate-50/30 px-6 pt-6 pb-6">
              <KpiFilterPanel
                sectionConfig={[
                  { id: "keywords", label: "Keywords" },
                  { id: "brands", label: "Brands" },
                  { id: "categories", label: "Categories" },
                  { id: "weekendFlag", label: "Weekend Flag" },
                  { id: "platforms", label: "Platform" },
                  { id: "zones", label: "Zone" },
                  { id: "kpiRules", label: "KPI Rules" },
                ]}
                keywords={filterOptionsData.keywords} // Keywords support linked to Category
                brands={filterOptionsData.brands}
                categories={filterOptionsData.categories}
                zones={filterOptionsData.zones}
                platforms={[]}
                kpiFields={Object.keys(KPI_LABELS).map(key => ({
                  id: key,
                  label: KPI_LABELS[key],
                  type: 'number'
                }))}
                onKeywordChange={(ids) => setActiveFilters(prev => ({ ...prev, keywords: ids }))}
                onBrandChange={(ids) => setActiveFilters(prev => ({ ...prev, brands: ids }))}
                onCategoryChange={(ids) => setActiveFilters(prev => ({ ...prev, categories: ids }))}
                onWeekendChange={(vals) => {
                  const sel = (vals || []);
                  let wf = 'All';
                  if (sel.length === 1) wf = sel[0] === 'Weekend' ? 'Weekend' : sel[0] === 'Weekday' ? 'Weekday' : 'All';
                  if (sel.length >= 2) wf = 'All';
                  setLocalFilters((prev) => ({ ...prev, weekendFlag: wf }));
                  setActiveFilters(prev => ({ ...prev, weekendFlag: vals || [] }));
                }}
                onZoneChange={(ids) => setActiveFilters(prev => ({ ...prev, zones: ids }))}
                onPlatformChange={(ids) => setActiveFilters(prev => ({ ...prev, platforms: ids }))}
                onRulesChange={(tree) => setActiveFilters(prev => ({ ...prev, kpiRules: tree }))}
                sectionValues={activeFilters}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
              <button
                onClick={() => setFilterPanelOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setFilterPanelOpen(false)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-0 pr-0">
          <div className="rounded-3xl border bg-white p-4 shadow">

            {/* HEADLINE */}
            <Box mb={2} display="flex" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                  Format Performance (Heatmap)
                </Typography>
                <Typography sx={{ fontSize: 11, color: "#94a3b8" }}>
                  Category → Day
                </Typography>
              </Box>
            </Box>

            {/* KPI TOGGLES AND FILTERS */}
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2 text-[11px]">
                {Object.keys(KPI_LABELS).map((k) => {
                  const isActive = visibleKpis[k];

                  return (
                    <button
                      key={k}
                      onClick={() => toggleKpiVisibility(k)}
                      className={`
                        flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold transition-all
                        ${isActive
                          ? "bg-slate-200 text-slate-900 border-slate-300"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }
                      `}
                    >
                      {isActive ? (
                        <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-900">
                          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="h-2 w-2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      ) : (
                        <div className="h-3.5 w-3.5 rounded-full border border-slate-300"></div>
                      )}
                      <span>{KPI_LABELS[k]}</span>
                    </button>
                  );
                })}
              </div>

              {/* FILTER BUTTON MOVED HERE */}
              <button
                onClick={() => setFilterPanelOpen(true)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-white hover:shadow transition-all"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Filters</span>
              </button>
            </div>



            {/* PATH LEGEND */}
            <div className="mb-4 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="px-2 py-1 rounded-full bg-slate-50 border">Path</span>
              Category → Day
            </div>

            {/* TABLE WRAPPER WITH FULL BORDER */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-[11px] border-separate border-spacing-0">
                  <thead className="sticky top-0 z-30">
                    {/* TOP HEADER ROW */}
                    <tr className="bg-white">
                      <th
                        rowSpan={expandedQuarters.size ? 3 : 2}
                        className="px-3 py-2 text-left font-bold align-bottom border-b border-r border-slate-200 text-slate-800"
                        style={{
                          left: 0,
                          top: 0,
                          background: 'white',
                          width: FROZEN_WIDTHS.format,
                          zIndex: 40
                        }}
                      >
                        Category
                      </th>

                      {expandedRows.size > 0 && (
                        <th
                          rowSpan={expandedQuarters.size ? 3 : 2}
                          className="px-2 py-2 text-left font-bold align-bottom border-b border-r border-slate-200 text-slate-800"
                          style={{
                            left: LEFT_DAY,
                            top: 0,
                            background: 'white',
                            width: FROZEN_WIDTHS.day,
                            zIndex: 40
                          }}
                        >
                          Day
                        </th>
                      )}

                      {quarters.map((q) => {
                        const colCount = visibleKpiKeys.length
                        const isExpanded = expandedQuarters.has(q)
                        const span = isExpanded
                          ? quarterMonths[q].length * colCount
                          : colCount

                        return (
                          <th
                            key={q}
                            colSpan={span}
                            className="px-3 py-3 text-center border-b border-r border-slate-200 last:border-r-0"
                          >
                            <button
                              onClick={() =>
                                setExpandedQuarters((prev) => {
                                  const next = new Set(prev)
                                  next.has(q) ? next.delete(q) : next.add(q)
                                  return next
                                })
                              }
                              className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold text-slate-700 transition-all hover:bg-slate-50 hover:shadow-sm active:scale-95`}
                            >
                              <span className={`flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[8px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                ▶
                              </span>
                              {q}
                            </button>
                          </th>
                        )
                      })}
                    </tr>

                    {/* MONTH HEADER ROW - Only show when quarters are expanded */}
                    {expandedQuarters.size > 0 && (
                      <tr className="bg-white">
                        {quarters.flatMap((q, qi) => {
                          const isExpanded = expandedQuarters.has(q)

                          if (isExpanded) {
                            return quarterMonths[q].map((m, mi) => (
                              <th
                                key={`${q}-${m}`}
                                colSpan={visibleKpiKeys.length}
                                className={`px-2 py-1.5 text-center text-slate-600 font-semibold border-b border-r border-slate-200 ${mi % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'
                                  }`}
                              >
                                {m}
                              </th>
                            ))
                          }

                          // When this quarter is not expanded but others are, show placeholder cells
                          return visibleKpiKeys.map((k, ki) => (
                            <th key={`${q}-${k}-placeholder`}
                              className={`px-2 py-1.5 text-center text-slate-400 border-b border-r border-slate-200 ${qi % 2 === 0 ? 'bg-slate-50/30' : 'bg-white'}`}
                            >
                              –
                            </th>
                          ))
                        })}
                      </tr>
                    )}

                    {/* KPI SUB-HEADER ROW */}
                    <tr className="bg-white">
                      {quarters.flatMap((q) => {
                        const isExpanded = expandedQuarters.has(q)

                        // If expanded, show KPIs per month
                        if (isExpanded) {
                          return quarterMonths[q].flatMap((m) =>
                            visibleKpiKeys.map((k) => (
                              <th
                                key={`${q}-${m}-${k}`}
                                className="px-2 py-1 text-center text-[9px] text-slate-500 font-medium border-b border-r border-slate-200"
                              >
                                {KPI_LABELS[k]}
                              </th>
                            ))
                          )
                        }

                        // If NOT expanded (default view), show KPIs per Quarter
                        return visibleKpiKeys.map((k) => (
                          <th
                            key={`${q}-${k}`}
                            className="px-2 py-1 text-center text-[9px] text-slate-500 font-medium border-b border-r border-slate-200"
                          >
                            {KPI_LABELS[k]}
                          </th>
                        ))
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {pageRows.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0 hover:bg-slate-50/30 transition-colors">
                        {/* FORMAT CELL */}
                        <td
                          className="px-3 py-2 border-r border-slate-100"
                          style={{
                            position: 'sticky',
                            left: 0,
                            background: '#fff',
                            width: FROZEN_WIDTHS.format,
                            zIndex: 10
                          }}
                        >
                          <div className="flex items-center gap-2" style={{ paddingLeft: row.depth * 18 }}>
                            <button
                              onClick={() =>
                                setExpandedRows((prev) => {
                                  const next = new Set(prev)
                                  next.has(row.id) ? next.delete(row.id) : next.add(row.id)
                                  return next
                                })
                              }
                              className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${row.hasChildren
                                ? 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'
                                : 'border-transparent text-transparent'
                                }`}
                              disabled={!row.hasChildren}
                            >
                              {row.hasChildren && (expandedRows.has(row.id) ? <Minus size={12} /> : <Plus size={12} />)}
                            </button>

                            <span className={`${row.hasChildren ? 'font-bold text-slate-800' : 'font-normal text-slate-500'} whitespace-nowrap`}>
                              {row.label}
                            </span>
                          </div>
                        </td>

                        {/* DAY CELL */}
                        {expandedRows.size > 0 && (
                          <td
                            className="px-2 py-2 text-center border-r border-slate-100"
                            style={{
                              position: 'sticky',
                              left: LEFT_DAY,
                              background: '#fff',
                              zIndex: 10
                            }}
                          >
                            {(() => {
                              if (row.level === 'format') return ''
                              return row.day ?? 'All days'
                            })()}
                          </td>
                        )}

                        {/* DATA CELLS */}
                        {quarters.flatMap((q) => {
                          const isExpanded = expandedQuarters.has(q)
                          if (isExpanded) {
                            return quarterMonths[q].flatMap((m, mi) =>
                              visibleKpiKeys.map((k) => {
                                // For day-level rows, use quarter data mapped to the row's month
                                // For category rows, use aggregated month data
                                let v;
                                if (row.level === 'day') {
                                  // Day rows: check if THIS month matches the row's month property
                                  // If yes, use the quarter data. If no, show dash.
                                  if (row.month === m) {
                                    v = row.quarters[q]?.[k] ?? NaN;
                                  } else {
                                    v = NaN; // This day doesn't belong to this month
                                  }
                                } else {
                                  // Category rows: use aggregated months data
                                  v = row.months[m]?.[k] ?? NaN;
                                }

                                const meta = kpiModes[k]
                                const heatClass = activeKpi === k ? activeMeta.heat(v) : 'bg-slate-50 text-slate-700'
                                const display = Number.isFinite(v) ? meta.formatter(v) : '—'
                                return (
                                  <td
                                    key={`${row.id}-${m}-${k}`}
                                    className={`px-1.5 py-2 text-center border-r border-slate-100 last:border-r-0 ${mi % 2 ? 'bg-white' : 'bg-slate-50/30'}`}
                                  >
                                    <span className={`block rounded-md px-2 py-1 text-center ${heatClass}`}>
                                      {display}
                                    </span>
                                  </td>
                                )
                              })
                            )
                          }

                          return visibleKpiKeys.map((k) => {
                            const v = row.quarters[q]?.[k] ?? NaN
                            const meta = kpiModes[k]
                            const heatClass = activeKpi === k ? activeMeta.heat(v) : 'bg-slate-50 text-slate-700'
                            const display = Number.isFinite(v) ? meta.formatter(v) : '—'
                            return (
                              <td
                                key={`${row.id}-${q}-${k}`}
                                className="px-1.5 py-2 text-center bg-slate-50 border-r border-slate-100 last:border-r-0"
                              >
                                <span className={`block rounded-md px-2 py-1 text-center ${heatClass}`}>
                                  {display}
                                </span>
                              </td>
                            )
                          })
                        })}
                      </tr>
                    ))}

                    {pageRows.length === 0 && (
                      <tr>
                        <td colSpan={50} className="px-3 py-10 text-center text-slate-400">
                          No data available for the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAGINATION */}
            <div className="mt-2 border-t border-slate-100">
              <PaginationFooter
                isVisible={true}
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={(newPageSize) => {
                  setPageSize(newPageSize);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>

        {/* FILTER SIDEBAR */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              className="flex h-full w-80 flex-col border-l bg-white p-4 shadow-xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Filters</h3>
                <button onClick={resetFilters} className="rounded-full border bg-slate-50 px-3 py-1 text-[11px] text-slate-600 hover:bg-slate-100">Reset</button>
              </div>
              <div className="flex flex-col gap-4">
                <FilterSelect label="Weekend" value={filters.weekendFlag} options={weekendOptions} onChange={(v) => setFilters(p => ({ ...p, weekendFlag: v }))} />
                <FilterSelect label="TDP" value={filters.tdp} options={tdpOptions} onChange={(v) => setFilters(p => ({ ...p, tdp: v }))} />
                <FilterSelect label="Month" value={filters.month} options={monthOptions} onChange={(v) => setFilters(p => ({ ...p, month: v }))} />
                <FilterSelect label="Year" value={filters.year} options={yearOptions} onChange={(v) => setFilters(p => ({ ...p, year: v }))} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
