// TrendsCompetitionDrawer.jsx
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react";
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  InputAdornment,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Drawer as MuiDrawer,
} from "@mui/material";
import { ChevronDown, X, Search, Plus, Filter, BarChart3, SlidersHorizontal } from "lucide-react";
import ReactECharts from "echarts-for-react";
import AddSkuDrawer, { SKU_DATA } from "./AddSkuDrawer";
import KpiTrendShowcase from "./KpiTrendShowcase";
import PlatformOverviewKpiShowcase from "../ControlTower/WatchTower/PlatformOverviewKpiShowcase";
import { AvailabilityCompetitionKpiShowcase } from "./AvailabilityCompetitionKpiShowcase";
import axiosInstance from "../../api/axiosInstance";
import ErrorRetryOverlay from "../CommonLayout/ErrorRetryOverlay";
import { FilterContext } from "../../utils/FilterContext";

/**
 * ---------------------------------------------------------------------------
 * FILTER DROPDOWN COMPONENT
 * ---------------------------------------------------------------------------
 */
const FilterDropdown = ({ title, value, options, onChange, searchable = true }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [search, setSearch] = useState("");

  const handleClick = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => {
    setAnchorEl(null);
    setSearch("");
  };

  const filteredOptions = searchable 
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const isActive = value && value !== "All";

  return (
    <>
      <Button
        onClick={handleClick}
        endIcon={<ChevronDown size={14} color={isActive ? "#1D4ED8" : "#94A3B8"} />}
        sx={{
          borderRadius: "999px",
          border: "1px solid",
          borderColor: isActive ? "#3B82F6" : "#E2E8F0",
          backgroundColor: "white",
          color: "#0F172A",
          textTransform: "none",
          fontSize: "13px",
          fontWeight: 600,
          px: 1.5,
          py: 0.5,
          minHeight: 32,
          "&:hover": {
            backgroundColor: "#F8FAFC",
            borderColor: isActive ? "#3B82F6" : "#CBD5E1",
          }
        }}
      >
        {isActive ? (
          <Box display="flex" alignItems="center" gap={0.5}>
            {value}
            <Box 
              component="span" 
              onClick={(e) => {
                e.stopPropagation();
                onChange("All");
              }}
              sx={{ display: 'flex', alignItems: 'center', ml: 0.5, color: '#94A3B8', '&:hover': { color: '#ef4444' } }}
            >
              <X size={14} />
            </Box>
          </Box>
        ) : (
          <Typography sx={{ color: "#64748B", fontSize: "13px", fontWeight: 500 }}>
            {title}
          </Typography>
        )}
      </Button>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: { mt: 1, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', minWidth: 220, maxHeight: 320 }
        }}
      >
        {searchable && (
          <Box p={1} sx={{ position: 'sticky', top: 0, bgcolor: 'white', zIndex: 1, borderBottom: '1px solid #F1F5F9' }}>
            <TextField
              fullWidth
              size="small"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={14} color="#94A3B8" />
                  </InputAdornment>
                ),
                sx: { fontSize: '13px', borderRadius: '6px', '& fieldset': { borderColor: '#E2E8F0' } }
              }}
            />
          </Box>
        )}
        <List sx={{ p: 0 }}>
          {filteredOptions.length === 0 ? (
            <MenuItem disabled sx={{ fontSize: '13px', py: 1.5 }}>No results found</MenuItem>
          ) : (
            filteredOptions.map((opt) => (
              <MenuItem
                key={opt}
                onClick={() => {
                  onChange(opt);
                  handleClose();
                }}
                sx={{ 
                  fontSize: '13px', 
                  py: 0.75,
                  backgroundColor: value === opt ? "#F8FAFC" : "transparent"
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Checkbox
                    checked={value === opt}
                    size="small"
                    sx={{ p: 0, color: '#CBD5E1', '&.Mui-checked': { color: '#3B82F6' } }}
                  />
                </ListItemIcon>
                <ListItemText primary={opt} primaryTypographyProps={{ fontSize: '13px', fontWeight: value === opt ? 600 : 400 }} />
              </MenuItem>
            ))
          )}
        </List>
      </Popover>
    </>
  );
};

/**
 * ---------------------------------------------------------------------------
 * JSON DATA (mocked but realistic, drives the whole UI)
 * ---------------------------------------------------------------------------
 */

// brand colors for SKU pills
const BRAND_COLORS = {
  Colgate: "#EF4444",
  Sensodyne: "#8B5CF6",
  Dabur: "#22C55E",
  Pepsodent: "#0EA5E9",
  Closeup: "#F97316",
};

// base compare-SKU X axis + base trend (we'll offset per SKU)
const COMPARE_X = [
  "01 Sep",
  "02 Sep",
  "03 Sep",
  "04 Sep",
  "05 Sep",
  "06 Sep",
  "07 Sep",
  "08 Sep",
  "09 Sep",
  "10 Sep",
];

const BASE_COMPARE_TRENDS = {
  Osa: [100, 100, 100, 99, 99, 98, 98, 97, 97, 96],
  Doi: [80, 81, 79, 80, 79, 78, 78, 77, 76, 77],
  Fillrate: [92, 92, 91, 91, 90, 90, 89, 89, 88, 88],
  Assortment: [55, 55, 54, 54, 53, 53, 52, 52, 51, 51],
  Listing: [85, 86, 84, 85, 83, 84, 82, 83, 81, 82],
};

function makeSkuTrend(osaOffset, doiOffset, fillOffset, assOffset, listingOffset = 0) {
  return {
    Osa: BASE_COMPARE_TRENDS.Osa.map((v) => v + osaOffset),
    Doi: BASE_COMPARE_TRENDS.Doi.map((v) => v + doiOffset),
    Fillrate: BASE_COMPARE_TRENDS.Fillrate.map((v) => v + fillOffset),
    Assortment: BASE_COMPARE_TRENDS.Assortment.map((v) => v + assOffset),
    Listing: BASE_COMPARE_TRENDS.Listing.map((v) => v + listingOffset),
  };
}

// const DASHBOARD_DATA = {
//   trends: {
//     context: {
//       level: "MRP",
//       audience: "Platform",
//     },

//     rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
//     defaultRange: "1M",

//     timeSteps: ["Daily", "Weekly", "Monthly"],
//     defaultTimeStep: "Daily",

//     metrics: [
//       {
//         id: "Osa",
//         label: "Osa",
//         color: "#F97316",
//         axis: "left",
//         default: true,
//       },
//       {
//         id: "Doi",
//         label: "Doi",
//         color: "#7C3AED",
//         axis: "right",
//         default: true,
//       },
//       {
//         id: "Fillrate",
//         label: "Fillrate",
//         color: "#6366F1",
//         axis: "left",
//         default: false,
//       },
//       {
//         id: "Assortment",
//         label: "Assortment",
//         color: "#22C55E",
//         axis: "left",
//         default: false,
//       },
//     ],

//     points: [
//       { date: "06 Sep'25", Osa: 57, Doi: 41, Fillrate: 72, Assortment: 65 },
//       { date: "07 Sep'25", Osa: 54, Doi: 42, Fillrate: 70, Assortment: 66 },
//       { date: "08 Sep'25", Osa: 53, Doi: 40, Fillrate: 69, Assortment: 64 },
//       { date: "09 Sep'25", Osa: 53, Doi: 39, Fillrate: 68, Assortment: 63 },
//       { date: "10 Sep'25", Osa: 52, Doi: 37, Fillrate: 66, Assortment: 62 },
//       { date: "11 Sep'25", Osa: 52, Doi: 36, Fillrate: 67, Assortment: 62 },
//       { date: "12 Sep'25", Osa: 52, Doi: 35, Fillrate: 68, Assortment: 61 },
//       { date: "13 Sep'25", Osa: 52, Doi: 34, Fillrate: 69, Assortment: 60 },
//       { date: "14 Sep'25", Osa: 52, Doi: 33, Fillrate: 70, Assortment: 60 },
//       { date: "15 Sep'25", Osa: 52, Doi: 32, Fillrate: 70, Assortment: 59 },
//       { date: "16 Sep'25", Osa: 52, Doi: 32, Fillrate: 69, Assortment: 59 },
//       { date: "17 Sep'25", Osa: 51, Doi: 31, Fillrate: 68, Assortment: 58 },
//       { date: "18 Sep'25", Osa: 51, Doi: 31, Fillrate: 67, Assortment: 58 },
//       { date: "19 Sep'25", Osa: 51, Doi: 32, Fillrate: 66, Assortment: 57 },
//       { date: "20 Sep'25", Osa: 56, Doi: 50, Fillrate: 75, Assortment: 68 },
//       { date: "21 Sep'25", Osa: 50, Doi: 34, Fillrate: 67, Assortment: 55 },
//       { date: "22 Sep'25", Osa: 49, Doi: 33, Fillrate: 66, Assortment: 54 },
//       { date: "23 Sep'25", Osa: 48, Doi: 32, Fillrate: 65, Assortment: 54 },
//       { date: "24 Sep'25", Osa: 47, Doi: 31, Fillrate: 64, Assortment: 53 },
//       { date: "25 Sep'25", Osa: 46, Doi: 30, Fillrate: 63, Assortment: 52 },
//       { date: "26 Sep'25", Osa: 45, Doi: 30, Fillrate: 62, Assortment: 52 },
//       { date: "27 Sep'25", Osa: 44, Doi: 31, Fillrate: 63, Assortment: 51 },
//       { date: "28 Sep'25", Osa: 44, Doi: 31, Fillrate: 62, Assortment: 51 },
//       { date: "29 Sep'25", Osa: 43, Doi: 32, Fillrate: 61, Assortment: 50 },
//       { date: "30 Sep'25", Osa: 43, Doi: 34, Fillrate: 60, Assortment: 49 },
//       { date: "01 Oct'25", Osa: 44, Doi: 36, Fillrate: 61, Assortment: 50 },
//       { date: "02 Oct'25", Osa: 45, Doi: 37, Fillrate: 62, Assortment: 51 },
//       { date: "03 Oct'25", Osa: 46, Doi: 39, Fillrate: 63, Assortment: 52 },
//       { date: "04 Oct'25", Osa: 46, Doi: 40, Fillrate: 65, Assortment: 53 },
//     ],
//   },

//   // compare SKUs with per-SKU trend
//   compareSkus: {
//     context: {
//       level: "MRP",
//     },
//     rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
//     defaultRange: "1M",
//     timeSteps: ["Daily", "Weekly", "Monthly"],
//     defaultTimeStep: "Daily",

//     metrics: [
//       { id: "Osa", label: "Osa", color: "#F97316", default: true },
//       { id: "Doi", label: "Doi", color: "#7C3AED", default: true },
//       { id: "Fillrate", label: "Fillrate", color: "#6366F1", default: false },
//       {
//         id: "Assortment",
//         label: "Assortment",
//         color: "#22C55E",
//         default: false,
//       },
//     ],

//     x: COMPARE_X,

//     // keyed by SKU_DATA IDs (1..8)
//     trendsBySku: {
//       1: makeSkuTrend(0, 0, 0, 0),
//       2: makeSkuTrend(-2, -1, -1, 0),
//       3: makeSkuTrend(-3, -2, -2, -1),
//       4: makeSkuTrend(-4, -3, -3, -1),
//       5: makeSkuTrend(+2, +3, +2, +2),
//       6: makeSkuTrend(+1, +2, +1, +1),
//       7: makeSkuTrend(-1, -2, -1, -1),
//       8: makeSkuTrend(+3, +1, +2, +1),
//     },
//   },

//   competition: {
//     context: {
//       level: "MRP",
//       region: "All × Chennai",
//     },

//     tabs: ["Brands", "SKUs"],

//     periodToggle: {
//       primary: "MTD",
//       compare: "Previous Month",
//     },

//     columns: [
//       { id: "brand", label: "Brand", type: "text" },
//       { id: "Osa", label: "Osa", type: "metric" },
//       { id: "Doi", label: "Doi", type: "metric" },
//       { id: "Fillrate", label: "Fillrate", type: "metric" },
//       { id: "Assortment", label: "Assortment", type: "metric" },
//     ],

//     brands: [
//       {
//         brand: "Colgate",
//         Osa: { value: 32.9, delta: -4.5 },
//         Doi: { value: 74.6, delta: -16.3 },
//         Fillrate: { value: 20.0, delta: -8.5 },
//         Assortment: { value: 18.8, delta: 0.4 },
//       },
//       {
//         brand: "Sensodyne",
//         Osa: { value: 19.6, delta: 2.2 },
//         Doi: { value: 94.2, delta: 3.9 },
//         Fillrate: { value: 19.3, delta: 2.7 },
//         Assortment: { value: 18.5, delta: -3.1 },
//       },
//       {
//         brand: "Oral-B",
//         Osa: { value: 11.7, delta: -0.9 },
//         Doi: { value: 86.7, delta: -4.2 },
//         Fillrate: { value: 16.2, delta: -2.9 },
//         Assortment: { value: 20.8, delta: -5.6 },
//       },
//       {
//         brand: "Dabur",
//         Osa: { value: 8.6, delta: 0.2 },
//         Doi: { value: 90.6, delta: -1.2 },
//         Fillrate: { value: 7.2, delta: 0.3 },
//         Assortment: { value: 7.4, delta: 2.9 },
//       },
//     ],

//     skus: [
//       {
//         brand: "Colgate Strong Teeth 100g",
//         Osa: { value: 8.2, delta: -1.0 },
//         Doi: { value: 76.1, delta: -8.0 },
//         Fillrate: { value: 4.5, delta: -0.9 },
//         Assortment: { value: 3.2, delta: 0.2 },
//       },
//       {
//         brand: "Sensodyne Rapid Relief 40g",
//         Osa: { value: 4.4, delta: 0.7 },
//         Doi: { value: 95.0, delta: 2.0 },
//         Fillrate: { value: 5.1, delta: 1.3 },
//         Assortment: { value: 4.9, delta: -0.5 },
//       },
//     ],
//   },
// };

/**
 * ---------------------------------------------------------------------------
 * HELPERS
 * ---------------------------------------------------------------------------
 */

const MONTH_MAP = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const RANGE_TO_DAYS = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
};

const parseTrendDate = (label) => {
  try {
    const [dayStr, monthYear] = label.split(" ");
    const day = parseInt(dayStr, 10);
    const [monthStr, yearStr] = monthYear.split("'");
    const month = MONTH_MAP[monthStr];
    const year = 2000 + parseInt(yearStr, 10);
    return new Date(year, month, day);
  } catch {
    return new Date();
  }
};

const PillToggleGroup = ({ value, onChange, options }) => (
  <ToggleButtonGroup
    exclusive
    value={value}
    onChange={(_, val) => val && onChange(val)}
    sx={{
      backgroundColor: "#F3F4F6",
      borderRadius: "999px",
      p: "2px",
      "& .MuiToggleButton-root": {
        textTransform: "none",
        border: "none",
        px: 2.5,
        py: 0.5,
        borderRadius: "999px",
        "&.Mui-selected": {
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 3px rgba(15,23,42,0.15)",
        },
      },
    }}
  >
    {options.map((opt) => (
      <ToggleButton key={opt} value={opt}>
        <Typography variant="body2">{opt}</Typography>
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
);

const MetricChip = ({ label, color, active, onClick, isNA }) => {
  return (
    <Box
      onClick={isNA ? undefined : onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.8,
        px: 2,
        py: 0.8,
        borderRadius: "999px",
        cursor: isNA ? "not-allowed" : "pointer",
        border: `1px solid ${isNA ? "#E5E7EB" : active ? color : "#E2E8F0"}`,
        backgroundColor: isNA ? "#F8FAFC" : active ? color : "white",
        color: isNA ? "#94A3B8" : active ? "white" : "#475569",
        fontSize: "13px",
        fontWeight: 600,
        userSelect: "none",
        transition: "all 0.15s ease",
        opacity: isNA ? 0.7 : 1,
        whiteSpace: "nowrap",
        "&:hover": {
          backgroundColor: isNA ? "#F8FAFC" : active ? color : "#F8FAFC",
        }
      }}
    >
      {label}
      {isNA && (
        <Box
          component="span"
          sx={{
            ml: 0.5,
            px: 0.8,
            py: 0.1,
            borderRadius: "4px",
            backgroundColor: "#FEF3C7",
            color: "#92400E",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.05em",
          }}
        >
          N/A
        </Box>
      )}
    </Box>
  );
};

// Map metric IDs to their data source group for N/A detection
const KPI_SOURCE_MAP = {
  // PDP table KPIs
  Offtakes: 'pdp', Offtake: 'pdp', offtake: 'pdp',
  Availability: 'pdp', Osa: 'pdp', osa: 'pdp',
  'Promo-My': 'pdp', PromoMyBrand: 'pdp',
  Assortment: 'pdp', Listing: 'pdp',
  // PM table KPIs
  InorganicSales: 'pm', InorgSales: 'pm',
  Conversion: 'pm', Roas: 'pm', ROAS: 'pm',
  BmiSalesRatio: 'pm', Spend: 'pm',
  CPM: 'pm', CPC: 'pm',
  // KW table KPIs
  ShareOfSearch: 'kw', SOS: 'kw', Sos: 'kw',
  // MS table KPIs
  MarketShare: 'ms', CategoryShare: 'ms',
  marketShare: 'ms', categoryShare: 'ms',
  // Pricing-specific KPIs (per-KPI granularity from pricing backend)
  Discount: 'Discount', discount: 'Discount',
  PricePerUnit: 'PricePerUnit',
  ASP: 'ASP',
  RPI: 'ASP',  // RPI depends on ASP (selling price) data
};


const SelectedFilterChip = ({ label, value, color = "#3B82F6" }) => (
  <Box
    sx={{
      display: "inline-flex",
      alignItems: "center",
      gap: 1,
      px: 1.5,
      py: 0.5,
      borderRadius: "999px",
      border: "1px solid #E2E8F0",
      backgroundColor: "#F8FAFC",
      fontSize: "12px",
      fontWeight: 500,
    }}
  >
    <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600 }}>
      {label}:
    </Typography>
    <Typography variant="caption" sx={{ color: color, fontWeight: 700 }}>
      {value}
    </Typography>
  </Box>
);

/**
 * ---------------------------------------------------------------------------
 * MAIN COMPONENT
 * ---------------------------------------------------------------------------
 */

export default function TrendsCompetitionDrawer({
  dynamicKey,
  open = true,
  onClose = () => { },
  selectedColumn,
  selectedLevel,
  dimensionType,
  brandOptions,
  initialPlatform = "Blinkit",
  defaultView = "Trends",
  initialAudience = "Platform",
}) {
  const [allTrendMeta, allSetTrendMeta] = useState({
    context: {
      audience: initialAudience, // default value
    },
  });

  useLayoutEffect(() => {
    if (open) {
      allSetTrendMeta((prev) => ({
        ...prev,
        context: { ...prev.context, audience: initialAudience },
      }));
      setShowPlatformPills(true);
    }
  }, [open, initialAudience]);

  const { maxDate, platform: globalPlatform, selectedBrand: globalBrand, selectedLocation: globalLocation, selectedCategory: globalCategory } = React.useContext(FilterContext);
  const maxDateStr = useMemo(() => maxDate?.format('YYYY-MM-DD'), [maxDate]);

  const [view, setView] = useState(defaultView || "Trends");
  const [range, setRange] = useState("1M");
  const [timeStep, setTimeStep] = useState("Daily");
  const [activeMetrics, setActiveMetrics] = useState([]);
  const [compTab, setCompTab] = useState("Brands");
  const [search, setSearch] = useState("");
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [skuSearchTerm, setSkuSearchTerm] = useState("");
  const [periodMode, setPeriodMode] = useState("primary");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // shared Add SKU drawer + selected SKUs (used by Compare SKUs + Competition)
  const [addSkuOpen, setAddSkuOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform || "Blinkit");
  const [showPlatformPills, setShowPlatformPills] = useState(true);
  const [showAllPills, setShowAllPills] = useState(false);
  const [selectedCompareSkus, setSelectedCompareSkus] = useState([]);
  const [compareInitialized, setCompareInitialized] = useState(false);

  const isEcom = (typeof selectedPlatform === 'string' && (selectedPlatform.toLowerCase() === "amazon" || selectedPlatform.toLowerCase() === "flipkart"));


  // Drawer-specific filters for the Effective Filters bar
  const [drawerFilters, setDrawerFilters] = useState({
    Platform: "All",
    Format: "All",
    Brand: "All",
    City: "All",
    SKU: "All"
  });

  // ===================== CONSOLIDATED DRAWER FILTER INITIALIZATION =====================
  // All filter initialization happens in ONE atomic state update to prevent
  // race conditions where multiple effects override each other.
  useEffect(() => {
    if (!open) return;

    // Set view
    setView(defaultView || "Trends");

    if (dynamicKey === "pricing") {
      setSelectedPlatform(initialPlatform || "Blinkit");
      setDrawerFilters({
        Platform: initialPlatform || "All",
        City: "All",
        Brand: "All",
        Format: "All",
        SKU: "All",
      });
    } else {
      // Determine the audience dimension being drilled into
      const currentAudience = initialAudience || allTrendMeta.context.audience;

      // Build the complete filter state atomically
      const newFilters = {
        Platform: "All",
        City: "All",
        Brand: "All",
        Format: "All",
        SKU: "All",
      };

      // 1. Apply initialPlatform if provided
      if (initialPlatform && initialPlatform !== 'All') {
        newFilters.Platform = initialPlatform;
      }

      // 2. For availability, inherit global filters from FilterContext
      if (dynamicKey === 'availability') {
        if (globalPlatform && globalPlatform !== 'All' && (!initialPlatform || initialPlatform === 'All')) {
          newFilters.Platform = globalPlatform;
        }
        if (globalBrand && globalBrand !== 'All') {
          newFilters.Brand = globalBrand;
        }
        if (globalLocation && globalLocation !== 'All') {
          newFilters.City = globalLocation;
        }
        if (globalCategory && globalCategory !== 'All') {
          newFilters.Format = globalCategory;
        }
      }

      // 3. Apply the selectedColumn to the correct dimension (this takes priority)
      if (selectedColumn && currentAudience) {
        newFilters[currentAudience] = selectedColumn;
      }

      // Set platform pill selection
      setSelectedPlatform(newFilters.Platform !== 'All' ? newFilters.Platform : (initialPlatform || selectedColumn || "Blinkit"));

      setDrawerFilters(newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColumn, open, dynamicKey, initialPlatform, defaultView, globalPlatform, globalBrand, globalLocation, globalCategory]);

  // ===================== API STATE =====================
  const [chartData, setChartData] = useState([]);
  const [competitionData, setCompetitionData] = useState([]);
  const [kpiAvailability, setKpiAvailability] = useState(null); // { pdp, pm, kw, ms } from backend
  const [loading, setLoading] = useState(true);
  const [compLoading, setCompLoading] = useState(false);

  // ===================== DYNAMIC FILTER OPTIONS STATE =====================
  const [filterOptions, setFilterOptions] = useState({
    platforms: [],
    formats: [],
    cities: [],
    brands: [],
    skus: [],
    loading: true
  });

  // ===================== PLATFORM → CHANNEL MAPPING =====================
  const [platformChannelMap, setPlatformChannelMap] = useState({});

  // Derive channel from the currently selected platform
  const derivedChannel = useMemo(() => {
    const plat = drawerFilters.Platform;
    if (!plat || plat === 'All') return '';
    return platformChannelMap[plat] || '';
  }, [drawerFilters.Platform, platformChannelMap]);

  // Whether to hide PM metrics (Spend, Conversion, ROAS, Inorganic Sales, CPC)
  const isQuickcommSku = useMemo(() => {
    const isSkuSelected = drawerFilters.SKU && drawerFilters.SKU !== 'All';
    return isSkuSelected && derivedChannel.toLowerCase() === 'quickcomm';
  }, [drawerFilters.SKU, derivedChannel]);

  const PLATFORM_OPTIONS = filterOptions.platforms.length > 0 ? filterOptions.platforms : [
    "Blinkit",
    "Zepto",
    "Instamart",
    "Swiggy",
    "Amazon",
  ];
  const FORMAT_OPTIONS = filterOptions.formats.length > 0 ? filterOptions.formats : [];
  const CITY_OPTIONS = filterOptions.cities.length > 0 ? filterOptions.cities : ["Delhi", "Mumbai", "Bangalore", "Chennai"];
  const BRAND_OPTIONS = filterOptions.brands.length > 0 ? filterOptions.brands : (brandOptions || ["Amul", "Mother Dairy", "Nestle", "Hatsun"]);
  const SKU_OPTIONS = filterOptions.skus.length > 0 ? filterOptions.skus : [];

  // ===================== FETCH FILTER OPTIONS =====================
  useEffect(() => {
    if (!open) return;

    const fetchFilterOptions = async () => {
      try {
        console.log("[TrendsDrawer] Fetching filter options");
        const [platformsRes, formatsRes, citiesRes, brandsRes, skusRes, platformChannelsRes] = await Promise.all([
          axiosInstance.get('/watchtower/trends-filter-options', { params: { filterType: 'platforms' } }),
          axiosInstance.get('/watchtower/trends-filter-options', { params: { filterType: 'categories' } }),
          axiosInstance.get('/watchtower/trends-filter-options', { params: { filterType: 'cities' } }),
          axiosInstance.get('/watchtower/trends-filter-options', { params: { filterType: 'brands' } }),
          axiosInstance.get('/watchtower/trends-filter-options', { params: { filterType: 'skus' } }),
          axiosInstance.get('/watchtower/platform-channels')
        ]);

        // Build platform → channel lookup map
        const channelMap = {};
        (platformChannelsRes.data || []).forEach(item => {
          if (item.platform && item.channel) {
            channelMap[item.platform] = item.channel;
          }
        });
        setPlatformChannelMap(channelMap);
        console.log('[TrendsDrawer] Platform→Channel map:', channelMap);

        const platforms = (platformsRes.data?.options || []).filter(p => p !== 'All');
        const formats = (formatsRes.data?.options || []).filter(f => f !== 'All');
        const TIER_1_CITIES = [
          "Ahmedabad",
          "Bangalore",
          "Chennai",
          "Delhi",
          "Hyderabad",
          "Kolkata",
          "Mumbai",
          "Lucknow",
          "Gurugram",
          "Chandigarh",
          "Faridabad",
          "Pune"
        ];
        const defaultCities = (citiesRes.data?.options || [])
          .filter(c => c !== 'All' && c !== 'All India')
          .filter(c => TIER_1_CITIES.some(t => c.toLowerCase().includes(t.toLowerCase())));
        const cities = ["All India", ...defaultCities];
        const brands = (brandsRes.data?.options || []).filter(b => b !== 'All');
        const skus = (skusRes.data?.options || []).filter(s => s !== 'All');

        setFilterOptions({
          platforms,
          formats,
          cities,
          brands,
          skus,
          loading: false
        });

      } catch (error) {
        console.error("[TrendsDrawer] Error fetching filter options:", error);
        setFilterOptions(prev => ({ ...prev, loading: false }));
      }
    };

    fetchFilterOptions();
  }, [open]);

  const [trendError, setTrendError] = useState(null);

  // ===================== FETCH TREND DATA =====================
  const fetchTrendData = useCallback(async () => {
    if (view !== "Trends" || !open) return;
    setLoading(true);
    setTrendError(null);
    try {
      // We must send `dimensionValue` (e.g. "Dental Floss" when opening the category row)
      // to serve as the BASE context for the query, UNLESS the user is using the drawer
      // filter dropdown to filter on the SAME dimension (which would create a SQL conflict,
      // e.g. Category="Dental Floss" AND Category="Toothbrush").
      const currentAudience = allTrendMeta.context.audience;
      const isSameDimensionFilter =
        ((selectedLevel === 'category' || selectedLevel === 'Category') && currentAudience === 'Format') ||
        ((selectedLevel === 'city' || selectedLevel === 'City') && currentAudience === 'City') ||
        ((selectedLevel === 'brand' || selectedLevel === 'Brand') && currentAudience === 'Brand') ||
        ((selectedLevel === 'platform' || selectedLevel === 'Platform') && currentAudience === 'Platform');

      const shouldSendDimensionValue = !isSameDimensionFilter;

      if (dynamicKey === "pricing") {
        // Use pricing-specific API
        const params = {
          period: range,
          timeStep: timeStep,
          dimension: selectedLevel?.toLowerCase(),
          dimensionValue: shouldSendDimensionValue ? (selectedColumn || undefined) : undefined,
          startDate: range === "Custom" && customStart ? customStart : undefined,
          endDate: range === "Custom" && customEnd ? customEnd : undefined,
          platform: drawerFilters.Platform !== 'All' ? drawerFilters.Platform : undefined,
          location: drawerFilters.City !== 'All' && drawerFilters.City !== 'All India' ? drawerFilters.City : undefined,
          brand: drawerFilters.Brand !== 'All' ? drawerFilters.Brand : undefined,
          category: drawerFilters.Format !== 'All' ? drawerFilters.Format : undefined,
          sku: drawerFilters.SKU !== 'All' ? drawerFilters.SKU : undefined,
          skuName: drawerFilters.SKU !== 'All' ? drawerFilters.SKU : undefined,
        };

        console.log('[TrendsDrawer] Fetching PRICING trends with params:', params);
        const response = await axiosInstance.get('/pricing-analysis/dimension-trends', { params });

        if (response.data?.timeSeries?.length > 0) {
          setChartData(response.data.timeSeries);
        } else {
          setChartData([]);
        }
        // Store KPI availability from pricing backend response
        if (response.data?.kpiAvailability) {
          setKpiAvailability(response.data.kpiAvailability);
          console.log('[TrendsDrawer] Pricing KPI Availability:', response.data.kpiAvailability);
        } else {
          setKpiAvailability(null);
        }
      } else if (dynamicKey === "marketshare") {
        const params = {
          period: range,
          timeStep: timeStep,
          dimension: selectedLevel?.toLowerCase(),
          dimensionValue: shouldSendDimensionValue ? (selectedColumn || undefined) : undefined,
          startDate: range === "Custom" && customStart ? customStart : undefined,
          endDate: range === "Custom" && customEnd ? customEnd : undefined,
          platform: drawerFilters.Platform !== 'All' ? drawerFilters.Platform : undefined,
          location: drawerFilters.City !== 'All' && drawerFilters.City !== 'All India' ? drawerFilters.City : undefined,
          brand: drawerFilters.Brand !== 'All' ? drawerFilters.Brand : undefined,
          category: drawerFilters.Format !== 'All' ? drawerFilters.Format : undefined,
          sku: drawerFilters.SKU !== 'All' ? drawerFilters.SKU : undefined,
          skuName: drawerFilters.SKU !== 'All' ? drawerFilters.SKU : undefined,
        };

        const response = await axiosInstance.get('/market-share/trends', { params });

        if (response.data?.timeSeries?.length > 0) {
          setChartData(response.data.timeSeries);
        } else {
          setChartData([]);
        }
        setKpiAvailability(null); // Market share doesn't use kpiAvailability
      } else if (dynamicKey === "availability") {
        // Use availability-specific API (includes PSL)
        const params = {
          period: range,
          timeStep: timeStep,
          dimension: selectedLevel?.toLowerCase(),
          dimensionValue: shouldSendDimensionValue ? (selectedColumn || undefined) : undefined,
          startDate: range === "Custom" && customStart ? customStart : undefined,
          endDate: range === "Custom" && customEnd ? customEnd : undefined,
          platform: drawerFilters.Platform !== 'All' ? drawerFilters.Platform : undefined,
          location: drawerFilters.City !== 'All' && drawerFilters.City !== 'All India' ? drawerFilters.City : undefined,
          brand: drawerFilters.Brand !== 'All' ? drawerFilters.Brand : undefined,
          category: drawerFilters.Format !== 'All' ? drawerFilters.Format : undefined,
          sku: drawerFilters.SKU !== 'All' ? drawerFilters.SKU : undefined,
          skuName: drawerFilters.SKU !== 'All' ? drawerFilters.SKU : undefined,
          ownBrandsOnly: 'true'
        };

        const response = await axiosInstance.get('/availability-analysis/kpi-trends', { params });

        if (response.data?.timeSeries?.length > 0) {
          setChartData(response.data.timeSeries);
        } else {
          setChartData([]);
        }
        setKpiAvailability(null); // Availability doesn't use kpiAvailability
      } else {
        // Use watchtower API for visibility/performance
        const params = {
          period: range,
          timeStep: timeStep,
          dimension: selectedLevel?.toLowerCase(),
          dimensionValue: shouldSendDimensionValue ? (selectedColumn || undefined) : undefined,
          startDate: range === "Custom" && customStart ? customStart : undefined,
          endDate: range === "Custom" && customEnd ? customEnd : undefined,
          platform: drawerFilters.Platform !== 'All' ? drawerFilters.Platform : undefined,
          location: drawerFilters.City !== 'All' && drawerFilters.City !== 'All India' ? drawerFilters.City : undefined,
          brand: drawerFilters.Brand !== 'All' ? drawerFilters.Brand : undefined,
          category: drawerFilters.Format !== 'All' ? drawerFilters.Format : undefined,
          sku: drawerFilters.SKU !== 'All' ? drawerFilters.SKU : undefined,
          skuName: drawerFilters.SKU !== 'All' ? drawerFilters.SKU : undefined,
          channel: derivedChannel || undefined,
        };

        const response = await axiosInstance.get('/watchtower/kpi-trends', { params });

        if (response.data?.timeSeries?.length > 0) {
          setChartData(response.data.timeSeries);
        } else {
          setChartData([]);
        }
        // Store KPI availability from backend response
        if (response.data?.kpiAvailability) {
          setKpiAvailability(response.data.kpiAvailability);
          console.log('[TrendsDrawer] KPI Availability:', response.data.kpiAvailability);
        } else {
          setKpiAvailability(null);
        }
      }
    } catch (error) {
      console.error("[TrendsDrawer] Error fetching trends:", error);
      setTrendError(error.message || "Failed to load trend data");
      setChartData([]);
      setKpiAvailability(null);
    } finally {
      setLoading(false);
    }
  }, [view, range, drawerFilters, timeStep, customStart, customEnd, open, dynamicKey, selectedColumn, selectedLevel, allTrendMeta, derivedChannel]);

  useEffect(() => {
    if (view !== "Trends" || !open) return;
    const timeoutId = setTimeout(fetchTrendData, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchTrendData]);

  // ===================== FETCH COMPETITION DATA =====================
  const fetchCompetitionData = useCallback(async () => {
    if (view !== "Competition" || !open) return;
    setCompLoading(true);
    try {
      const params = {
        period: range,
        platform: drawerFilters.Platform !== 'All' ? drawerFilters.Platform : undefined,
        location: drawerFilters.City !== 'All' ? drawerFilters.City : undefined,
        brand: drawerFilters.Brand !== 'All' ? drawerFilters.Brand : undefined,
        category: drawerFilters.Format !== 'All' ? drawerFilters.Format : undefined,
        sku: drawerFilters.SKU !== 'All' ? drawerFilters.SKU : undefined,
      };

      const response = await axiosInstance.get('/watchtower/competition', { params });
      if (response.data?.brands) {
        setCompetitionData(response.data.brands);
      } else {
        setCompetitionData([]);
      }
    } catch (error) {
      console.error("[TrendsDrawer] Error fetching competition data:", error);
      setCompetitionData([]);
    } finally {
      setCompLoading(false);
    }
  }, [view, open, range, drawerFilters]);
  
  const handleRowTrendClick = useCallback((target, type) => {
    setView("Trends");
    if (type === 'brand') {
      setDrawerFilters(prev => ({ ...prev, Brand: target, SKU: 'All' }));
    } else if (type === 'sku') {
      setDrawerFilters(prev => ({ ...prev, SKU: target }));
    }
  }, []);

  useEffect(() => {
    if (view !== "Competition" || !open) return;
    const timeoutId = setTimeout(fetchCompetitionData, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchCompetitionData]);

  /* ---------------------------------------------------------------------------
   * HELPERS FOR DYNAMIC DATA
   * ---------------------------------------------------------------------------
   */
  const getSeedFromStr = (str) => {
    let h = 0xdeadbeef;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
    }
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  const getVariance = (seedStr, pointSeed = "") => {
    const val = getSeedFromStr((seedStr || "default") + pointSeed);
    // More dramatic range: 0.5 to 1.5
    return 0.5 + val * 1.0;
  };


  const DASHBOARD_DATA = useMemo(() => {
    const applyVar = (val, pointSeed = "") => (typeof val === "number" ? val * getVariance(selectedPlatform, pointSeed) : val);

    if (dynamicKey === "performance_dashboard_tower") {
      return {
        trends: {
          context: {
            level: "MRP",
            audience: "Platform",
          },

          rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
          defaultRange: "1M",

          timeSteps: ["Daily", "Weekly", "Monthly"],
          defaultTimeStep: "Daily",

          metrics: [
            {
              id: "ShareOfSearch",
              label: "Share of Search",
              color: "#2563EB",
              axis: "right",
              default: true,
            },
            {
              id: "InorganicSales",
              label: "Inorganic Sales",
              color: "#16A34A",
              axis: "left",
              default: true,
            },
            {
              id: "Conversion",
              label: "Conversion",
              color: "#F97316",
              axis: "right",
              default: false,
            },
            {
              id: "Roas",
              label: "ROAS",
              color: "#7C3AED",
              axis: "right",
              default: false,
            },
            {
              id: "BmiSalesRatio",
              label: "BMI / Sales Ratio",
              color: "#DC2626",
              axis: "right",
              default: false,
            },
          ],

          points: [
            {
              date: "06 Sep'25",
              ShareOfSearch: 42,
              InorganicSales: 18,
              Conversion: 2.8,
              Roas: 3.4,
              BmiSalesRatio: 0.62,
            },
            {
              date: "10 Sep'25",
              ShareOfSearch: 40,
              InorganicSales: 17,
              Conversion: 2.6,
              Roas: 3.2,
              BmiSalesRatio: 0.6,
            },
            {
              date: "15 Sep'25",
              ShareOfSearch: 39,
              InorganicSales: 16,
              Conversion: 2.5,
              Roas: 3.1,
              BmiSalesRatio: 0.58,
            },
            {
              date: "20 Sep'25",
              ShareOfSearch: 45,
              InorganicSales: 22,
              Conversion: 3.1,
              Roas: 3.8,
              BmiSalesRatio: 0.67,
            },
            {
              date: "25 Sep'25",
              ShareOfSearch: 41,
              InorganicSales: 19,
              Conversion: 2.7,
              Roas: 3.3,
              BmiSalesRatio: 0.61,
            },
            {
              date: "30 Sep'25",
              ShareOfSearch: 38,
              InorganicSales: 15,
              Conversion: 2.4,
              Roas: 3.0,
              BmiSalesRatio: 0.56,
            },
            {
              date: "04 Oct'25",
              ShareOfSearch: 43,
              InorganicSales: 20,
              Conversion: 2.9,
              Roas: 3.6,
              BmiSalesRatio: 0.65,
            },
          ].map((p, idx) => ({
            ...p,
            ShareOfSearch: applyVar(p.ShareOfSearch, idx),
            InorganicSales: applyVar(p.InorganicSales, idx),
            Conversion: applyVar(p.Conversion, idx),
            Roas: applyVar(p.Roas, idx),
          })),
        },

        compareSkus: {
          context: {
            level: "MRP",
          },

          rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
          defaultRange: "1M",

          timeSteps: ["Daily", "Weekly", "Monthly"],
          defaultTimeStep: "Daily",

          metrics: [
            {
              id: "ShareOfSearch",
              label: "Share of Search",
              color: "#2563EB",
              default: true,
            },
            {
              id: "InorganicSales",
              label: "Inorganic Sales",
              color: "#16A34A",
              default: true,
            },
            {
              id: "Conversion",
              label: "Conversion",
              color: "#F97316",
              default: false,
            },
            { id: "Roas", label: "ROAS", color: "#7C3AED", default: false },
            {
              id: "BmiSalesRatio",
              label: "BMI / Sales Ratio",
              color: "#DC2626",
              default: false,
            },
          ],

          x: ["P1", "P2", "P3", "P4"],

          trendsBySku: {
            1: [
              {
                x: "P1",
                ShareOfSearch: 40,
                InorganicSales: 18,
                Conversion: 2.6,
                Roas: 3.2,
                BmiSalesRatio: 0.6,
              },
              {
                x: "P2",
                ShareOfSearch: 42,
                InorganicSales: 19,
                Conversion: 2.7,
                Roas: 3.3,
                BmiSalesRatio: 0.61,
              },
              {
                x: "P3",
                ShareOfSearch: 44,
                InorganicSales: 21,
                Conversion: 2.9,
                Roas: 3.5,
                BmiSalesRatio: 0.64,
              },
              {
                x: "P4",
                ShareOfSearch: 45,
                InorganicSales: 22,
                Conversion: 3.0,
                Roas: 3.7,
                BmiSalesRatio: 0.66,
              },
            ].map(p => ({
              ...p,
              ShareOfSearch: applyVar(p.ShareOfSearch),
              InorganicSales: applyVar(p.InorganicSales),
            })),
          },
        },

        competition: {
          context: {
            level: "MRP",
            region: "All × Chennai",
          },

          tabs: ["Brands", "SKUs"],

          periodToggle: {
            primary: "MTD",
            compare: "Previous Month",
          },

          columns: [
            { id: "brand", label: "Brand", type: "text" },
            { id: "ShareOfSearch", label: "Share of Search", type: "metric" },
            { id: "InorganicSales", label: "Inorganic Sales", type: "metric" },
            { id: "Conversion", label: "Conversion", type: "metric" },
            { id: "Roas", label: "ROAS", type: "metric" },
            { id: "BmiSalesRatio", label: "BMI / Sales Ratio", type: "metric" },
          ],

          brands: BRAND_OPTIONS.map((b, i) => ({
            brand: b,
            ShareOfSearch: { value: applyVar(30 + i * 2), delta: i % 2 === 0 ? 1.5 : -1.2 },
            InorganicSales: { value: applyVar(20 + i), delta: i % 2 === 0 ? 2.1 : -0.8 },
            Conversion: { value: applyVar(2.5 + i * 0.1), delta: 0.2 },
            Roas: { value: applyVar(3.5 + i * 0.2), delta: 0.4 },
            BmiSalesRatio: { value: 0.6 + i * 0.01, delta: -0.05 },
          })),
        },
      };
    } else if (dynamicKey === "availability") {
      return {
        trends: {
          context: {
            level: "MRP",
            audience: "Platform",
          },

          rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
          defaultRange: "1M",

          timeSteps: ["Daily", "Weekly", "Monthly"],
          defaultTimeStep: "Daily",

          metrics: [
            {
              id: "Osa",
              label: "Osa",
              color: "#F97316",
              axis: "right",
              default: true,
            },
            {
              id: "Listing",
              label: "Listing %",
              color: "#0EA5E9",
              axis: "right",
              default: true,
            },
            {
              id: "Assortment",
              label: "Assortment",
              color: "#22C55E",
              axis: "right",
              default: false,
            },
            {
              id: "Psl",
              label: "PSL (₹)",
              color: "#8B5CF6",
              axis: "left",
              default: false,
            },
          ],

          points: [
            { date: "06 Sep'25", Osa: 57, Doi: 41, Fillrate: 72, Assortment: 65, Listing: 88 },
            { date: "07 Sep'25", Osa: 54, Doi: 42, Fillrate: 70, Assortment: 66, Listing: 87 },
            { date: "08 Sep'25", Osa: 53, Doi: 40, Fillrate: 69, Assortment: 64, Listing: 86 },
            { date: "09 Sep'25", Osa: 53, Doi: 39, Fillrate: 68, Assortment: 63, Listing: 85 },
            { date: "10 Sep'25", Osa: 52, Doi: 37, Fillrate: 66, Assortment: 62, Listing: 84 },
            { date: "11 Sep'25", Osa: 52, Doi: 36, Fillrate: 67, Assortment: 62, Listing: 84 },
            { date: "12 Sep'25", Osa: 52, Doi: 35, Fillrate: 68, Assortment: 61, Listing: 83 },
            { date: "13 Sep'25", Osa: 52, Doi: 34, Fillrate: 69, Assortment: 60, Listing: 82 },
            { date: "14 Sep'25", Osa: 52, Doi: 33, Fillrate: 70, Assortment: 60, Listing: 81 },
            { date: "15 Sep'25", Osa: 52, Doi: 32, Fillrate: 70, Assortment: 59, Listing: 80 },
            { date: "16 Sep'25", Osa: 52, Doi: 32, Fillrate: 69, Assortment: 59, Listing: 79 },
            { date: "17 Sep'25", Osa: 51, Doi: 31, Fillrate: 68, Assortment: 58, Listing: 78 },
            { date: "18 Sep'25", Osa: 51, Doi: 31, Fillrate: 67, Assortment: 58, Listing: 77 },
            { date: "19 Sep'25", Osa: 51, Doi: 32, Fillrate: 66, Assortment: 57, Listing: 76 },
            { date: "20 Sep'25", Osa: 56, Doi: 50, Fillrate: 75, Assortment: 68, Listing: 85 },
            { date: "21 Sep'25", Osa: 50, Doi: 34, Fillrate: 67, Assortment: 55, Listing: 75 },
            { date: "22 Sep'25", Osa: 49, Doi: 33, Fillrate: 66, Assortment: 54, Listing: 74 },
            { date: "23 Sep'25", Osa: 48, Doi: 32, Fillrate: 65, Assortment: 54, Listing: 73 },
            { date: "24 Sep'25", Osa: 47, Doi: 31, Fillrate: 64, Assortment: 53, Listing: 72 },
            { date: "25 Sep'25", Osa: 46, Doi: 30, Fillrate: 63, Assortment: 52, Listing: 71 },
            { date: "26 Sep'25", Osa: 45, Doi: 30, Fillrate: 62, Assortment: 52, Listing: 70 },
            { date: "27 Sep'25", Osa: 44, Doi: 31, Fillrate: 63, Assortment: 51, Listing: 69 },
            { date: "28 Sep'25", Osa: 44, Doi: 31, Fillrate: 62, Assortment: 51, Listing: 68 },
            { date: "29 Sep'25", Osa: 43, Doi: 32, Fillrate: 61, Assortment: 50, Listing: 67 },
            { date: "30 Sep'25", Osa: 43, Doi: 34, Fillrate: 60, Assortment: 49, Listing: 66 },
            { date: "01 Oct'25", Osa: 44, Doi: 36, Fillrate: 61, Assortment: 50, Listing: 68 },
            { date: "02 Oct'25", Osa: 45, Doi: 37, Fillrate: 62, Assortment: 51, Listing: 69 },
            { date: "03 Oct'25", Osa: 46, Doi: 39, Fillrate: 63, Assortment: 52, Listing: 70 },
            { date: "04 Oct'25", Osa: 46, Doi: 40, Fillrate: 65, Assortment: 53, Listing: 71 },
          ].map((p, idx) => ({
            ...p,
            Osa: applyVar(p.Osa, idx),
            Listing: applyVar(p.Listing, idx),
            Assortment: applyVar(p.Assortment, idx),
          })),
        },

        // compare SKUs with per-SKU trend
        compareSkus: {
          context: {
            level: "MRP",
          },
          rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
          defaultRange: "1M",
          timeSteps: ["Daily", "Weekly", "Monthly"],
          defaultTimeStep: "Daily",

          metrics: [
            {
              id: "Listing",
              label: "Listing %",
              color: "#0EA5E9",
              default: true,
            },
            {
              id: "Assortment",
              label: "Assortment",
              color: "#22C55E",
              default: false,
            },
          ],

          x: COMPARE_X,

          // keyed by SKU_DATA IDs (1..8)
          trendsBySku: {
            1: makeSkuTrend(0, 0, 0, 0, 0),
            2: makeSkuTrend(-2, -1, -1, 0, 1),
            3: makeSkuTrend(-3, -2, -2, -1, 2),
            4: makeSkuTrend(-4, -3, -3, -1, 3),
            5: makeSkuTrend(+2, +3, +2, +2, 4),
            6: makeSkuTrend(+1, +2, +1, +1, 5),
            7: makeSkuTrend(-1, -2, -1, -1, 6),
            8: makeSkuTrend(+3, +1, +2, +1, 7),
          },
        },

        competition: {
          context: {
            level: "MRP",
            region: "All × Chennai",
          },

          tabs: ["Brands", "SKUs"],

          periodToggle: {
            primary: "MTD",
            compare: "Previous Month",
          },

          columns: [
            { id: "brand", label: "Brand", type: "text" },
            { id: "Osa", label: "Osa", type: "metric" },
            { id: "Listing", label: "Listing %", type: "metric" },
            { id: "Assortment", label: "Assortment", type: "metric" },
          ],

          brands: BRAND_OPTIONS.map((b, i) => ({
            brand: b,
            Osa: { value: applyVar(20 + i * 5), delta: i % 2 === 0 ? 2.5 : -1.5 },
            Doi: { value: applyVar(80 + i), delta: 5 },
            Fillrate: { value: applyVar(15 + i), delta: 2 },
            Listing: { value: applyVar(90 + i), delta: 1.5 },
            Assortment: { value: applyVar(15 + i * 2), delta: 0.5 },
          })),

          skus: [
            {
              brand: "Colgate Strong Teeth 100g",
              Osa: { value: 8.2, delta: -1.0 },
              Doi: { value: 76.1, delta: -8.0 },
              Fillrate: { value: 4.5, delta: -0.9 },
              Listing: { value: 88.0, delta: 0.5 },
              Assortment: { value: 3.2, delta: 0.2 },
            },
            {
              brand: "Sensodyne Rapid Relief 40g",
              Osa: { value: 4.4, delta: 0.7 },
              Doi: { value: 95.0, delta: 2.0 },
              Fillrate: { value: 5.1, delta: 1.3 },
              Assortment: { value: 4.9, delta: -0.5 },
            },
          ],
        },
      };

    } else if (dynamicKey === "pricing") {
      return {
        trends: {
          context: {
            level: "MRP",
            audience: "Platform",
          },
          rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
          defaultRange: "1M",
          timeSteps: ["Daily", "Weekly", "Monthly"],
          defaultTimeStep: "Daily",
          metrics: [
            {
              id: "Discount",
              label: "Promo-My %",
              color: "#6366F1",
              axis: "right",
              default: true,
            },
            {
              id: "PricePerUnit",
              label: "Price Per Unit (₹)",
              color: "#14B8A6",
              axis: "left",
              default: true,
            },
            {
              id: "ASP",
              label: "Avg Selling Price (₹)",
              color: "#8B5CF6",
              axis: "left",
              default: false,
            },
            {
              id: "Offtake",
              label: "Offtake",
              color: "#F59E0B",
              axis: "left",
              default: false,
            },
          ],
          points: [
            { date: "06 Sep'25", Discount: 10.2, PricePerUnit: 178, ASP: 190 },
            { date: "10 Sep'25", Discount: 11.4, PricePerUnit: 175, ASP: 188 },
            { date: "15 Sep'25", Discount: 12.8, PricePerUnit: 172, ASP: 186 },
            { date: "20 Sep'25", Discount: 14.5, PricePerUnit: 169, ASP: 182 },
            { date: "25 Sep'25", Discount: 13.2, PricePerUnit: 174, ASP: 185 },
            { date: "30 Sep'25", Discount: 11.9, PricePerUnit: 177, ASP: 189 },
            { date: "04 Oct'25", Discount: 12.4, PricePerUnit: 185, ASP: 198 },
          ].map((p, idx) => ({
            ...p,
            Discount: applyVar(p.Discount, idx),
            PricePerUnit: applyVar(p.PricePerUnit, idx),
            ASP: applyVar(p.ASP, idx),
          })),
        },

        compareSkus: {
          context: { level: "MRP" },
          rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
          defaultRange: "1M",
          timeSteps: ["Daily", "Weekly", "Monthly"],
          defaultTimeStep: "Daily",
          metrics: [
            { id: "Discount", label: "Promo-My %", color: "#6366F1", default: true },
            { id: "PricePerUnit", label: "Price Per Unit", color: "#14B8A6", default: true },
            { id: "ASP", label: "ASP", color: "#8B5CF6", default: false },
            { id: "Offtake", label: "Offtake", color: "#F59E0B", default: false },
          ],
          x: COMPARE_X,
          trendsBySku: {
            1: COMPARE_X.map(x => ({ x, Discount: applyVar(12, x), PricePerUnit: applyVar(180, x), ASP: applyVar(195, x) })),
            2: COMPARE_X.map(x => ({ x, Discount: applyVar(14, x), PricePerUnit: applyVar(172, x), ASP: applyVar(188, x) })),
            3: COMPARE_X.map(x => ({ x, Discount: applyVar(10, x), PricePerUnit: applyVar(190, x), ASP: applyVar(200, x) })),
          },
        },

        competition: {
          context: { level: "MRP", region: "All × Cities" },
          tabs: ["Brands", "SKUs"],
          periodToggle: { primary: "MTD", compare: "Previous Month" },
          columns: [
            { id: "brand", label: "Brand", type: "text" },
            { id: "Discount", label: "Promo-My %", type: "metric" },
            { id: "PricePerUnit", label: "Price/Unit 1g / 1 piece", type: "metric" },
            { id: "ASP", label: "ASP", type: "metric" },
          ],
          brands: BRAND_OPTIONS.map((b, i) => ({
            brand: b,
            Discount: { value: applyVar(10 + i * 1.5), delta: i % 2 === 0 ? 1.2 : -0.8 },
            PricePerUnit: { value: applyVar(175 + i * 5), delta: i % 2 === 0 ? 2.5 : -3.0 },
            ASP: { value: applyVar(190 + i * 8), delta: i % 2 === 0 ? 3.5 : -2.1 },
          })),
        },
      };
    } else if (dynamicKey === "marketshare") {
      return {
        trends: {
          context: {
            level: "MRP",
            audience: "Platform",
          },
          rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
          defaultRange: "1M",
          timeSteps: ["Daily", "Weekly", "Monthly"],
          defaultTimeStep: "Daily",
          metrics: [
            {
              id: "MWMarketShare",
              label: "MW Market Share%",
              color: "#14B8A6",
              axis: "right",
              default: true,
            },
            {
              id: "MWSales",
              label: "MW Estimated Sales (Cr)",
              color: "#F43F5E",
              axis: "left",
              default: false,
            },
            {
              id: "MLMarketShare",
              label: "ML Market Share%",
              color: "#8B5CF6",
              axis: "right",
              default: false,
            },
            {
              id: "MLSales",
              label: "ML Sales (Cr)",
              color: "#F97316",
              axis: "left",
              default: false,
            },
          ],
          points: [
            { date: "06 Sep'25", CategorySize: 210, MWMarketShare: 3.2, MWSales: 6.7, MLMarketShare: 35.0, MLSales: 73.5 },
            { date: "10 Sep'25", CategorySize: 215, MWMarketShare: 3.1, MWSales: 6.5, MLMarketShare: 34.5, MLSales: 74.2 },
            { date: "15 Sep'25", CategorySize: 218, MWMarketShare: 3.3, MWSales: 7.2, MLMarketShare: 35.2, MLSales: 76.8 },
            { date: "20 Sep'25", CategorySize: 220, MWMarketShare: 3.1, MWSales: 6.9, MLMarketShare: 35.1, MLSales: 77.5 },
            { date: "25 Sep'25", CategorySize: 225, MWMarketShare: 3.4, MWSales: 7.6, MLMarketShare: 34.8, MLSales: 78.4 },
            { date: "30 Sep'25", CategorySize: 228, MWMarketShare: 3.2, MWSales: 7.3, MLMarketShare: 35.5, MLSales: 80.9 },
            { date: "04 Oct'25", CategorySize: 232, MWMarketShare: 3.5, MWSales: 8.1, MLMarketShare: 36.0, MLSales: 83.5 },
          ].map((p, idx) => ({
            ...p,
            MWMarketShare: applyVar(p.MWMarketShare, idx),
            MWSales: applyVar(p.MWSales, idx),
            MLMarketShare: applyVar(p.MLMarketShare, idx),
            MLSales: applyVar(p.MLSales, idx),
          })),
        },

        compareSkus: {
          context: { level: "MRP" },
          rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
          defaultRange: "1M",
          timeSteps: ["Daily", "Weekly", "Monthly"],
          defaultTimeStep: "Daily",
          metrics: [
            { id: "MWMarketShare", label: "MW Market Share%", color: "#14B8A6", default: true },
            { id: "MWSales", label: "MW Estimated Sales (Cr)", color: "#F43F5E", default: false },
            { id: "MLMarketShare", label: "ML Market Share%", color: "#8B5CF6", default: false },
            { id: "MLSales", label: "ML Sales (Cr)", color: "#F97316", default: false },
          ],
          x: COMPARE_X,
          trendsBySku: {
            1: COMPARE_X.map(x => ({ x, MWMarketShare: applyVar(3.1, x), MWSales: applyVar(6.9, x), MLMarketShare: applyVar(35.2, x), MLSales: applyVar(77.5, x) })),
            2: COMPARE_X.map(x => ({ x, MWMarketShare: applyVar(2.8, x), MWSales: applyVar(5.3, x), MLMarketShare: applyVar(33.8, x), MLSales: applyVar(64.2, x) })),
            3: COMPARE_X.map(x => ({ x, MWMarketShare: applyVar(3.6, x), MWSales: applyVar(9.0, x), MLMarketShare: applyVar(36.1, x), MLSales: applyVar(90.2, x) })),
          },
        },

        competition: {
          context: { level: "MRP", region: "All × Platforms" },
          tabs: ["Brands", "SKUs"],
          periodToggle: { primary: "MTD", compare: "Previous Month" },
          columns: [
            { id: "brand", label: "Brand", type: "text" },
            { id: "MWMarketShare", label: "MW Market Share%", type: "metric" },
            { id: "MWSales", label: "MW Estimated Sales (Cr)", type: "metric" },
            { id: "MLMarketShare", label: "ML Market Share%", type: "metric" },
            { id: "MLSales", label: "ML Sales (Cr)", type: "metric" },
          ],
          brands: BRAND_OPTIONS.map((b, i) => ({
            brand: b,
            CategorySize: { value: applyVar(180 + i * 20), delta: i % 2 === 0 ? 12.5 : -8.3 },
            MWMarketShare: { value: applyVar(2.5 + i * 0.4), delta: i % 2 === 0 ? 0.3 : -0.5 },
            MWSales: { value: applyVar(5.0 + i * 1.2), delta: i % 2 === 0 ? 1.8 : -1.1 },
            MLMarketShare: { value: applyVar(30 + i * 2), delta: i % 2 === 0 ? 2.1 : -1.6 },
            MLSales: { value: applyVar(60 + i * 10), delta: i % 2 === 0 ? 8.5 : -5.2 },
          })),
        },
      };
    } else {
      return {
        /* =====================================================================
       TRENDS (MAIN LINE CHART)
    ===================================================================== */
        trends: {
          context: {
            level: "MRP",
            audience: "Platform",
          },

          rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
          defaultRange: "1M",

          timeSteps: ["Daily", "Weekly", "Monthly"],
          defaultTimeStep: "Daily",

          metrics: [
            {
              id: "Offtake",
              label: "Offtake",
              color: "#2563EB",
              axis: "left",
              default: true,
            },
            {
              id: "Spend",
              label: "Spend",
              color: "#DC2626",
              axis: "left",
              default: true,
            },
            {
              id: "ROAS",
              label: "ROAS",
              color: "#16A34A",
              axis: "right",
              default: true,
            },
            {
              id: "InorgSales",
              label: "Inorg Sales",
              color: "#7C3AED",
              axis: "left",
            },
            {
              id: "Conversion",
              label: "Conversion",
              color: "#F97316",
              axis: "right",
            },
            {
              id: "Availability",
              label: "Availability",
              color: "#22C55E",
              axis: "right",
            },
            { id: "SOS", label: "SOS", color: "#A855F7", axis: "right" },
            { id: "MarketShare", label: "Market Share", color: "#9333EA", axis: "right" },
            { id: "Discount", label: "Promo-My %", color: "#06B6D4", axis: "right" },
            { id: "CPM", label: "CPM", color: "#64748B", axis: "left" },
            { id: "CPC", label: "CPC", color: "#475569", axis: "left" },
          ],

          points: [
            {
              date: "06 Sep'25",
              Discount: 12.5,
              Offtake: 57,
              Spend: 18.4,
              ROAS: 7.1,
              InorgSales: 21,
              Conversion: 3.4,
              Availability: 84,
              SOS: 42,
              CPM: 146,
              CPC: 9.6,
            },
            {
              date: "08 Sep'25",
              Offtake: 49,
              Spend: 20.1,
              ROAS: 6.2,
              InorgSales: 17,
              Conversion: 2.9,
              Availability: 79,
              SOS: 38,
              CategorySize: 22.8,
              MarketShare: 16.9,
              PromoMyBrand: 14.8,
              PromoCompete: 11.2,
              CPM: 162,
              CPC: 10.8,
            },
            {
              date: "10 Sep'25",
              Offtake: 52,
              Spend: 17.8,
              ROAS: 6.9,
              InorgSales: 19,
              Conversion: 3.2,
              Availability: 78,
              SOS: 40,
              CategorySize: 23.5,
              MarketShare: 17.2,
              PromoMyBrand: 11.9,
              PromoCompete: 9.3,
              CPM: 142,
              CPC: 9.2,
            },
            {
              date: "13 Sep'25",
              Offtake: 44,
              Spend: 21.4,
              ROAS: 5.8,
              InorgSales: 15,
              Conversion: 2.6,
              Availability: 72,
              SOS: 35,
              CategorySize: 21.7,
              MarketShare: 16.1,
              PromoMyBrand: 15.6,
              PromoCompete: 12.9,
              CPM: 171,
              CPC: 11.6,
            },
            {
              date: "16 Sep'25",
              Offtake: 51,
              Spend: 16.9,
              ROAS: 7.3,
              InorgSales: 22,
              Conversion: 3.5,
              Availability: 82,
              SOS: 43,
              CategorySize: 24.8,
              MarketShare: 18.0,
              PromoMyBrand: 10.8,
              PromoCompete: 8.6,
              CPM: 138,
              CPC: 8.9,
            },
            {
              date: "18 Sep'25",
              Offtake: 47,
              Spend: 19.7,
              ROAS: 6.4,
              InorgSales: 18,
              Conversion: 3.0,
              Availability: 76,
              SOS: 39,
              CategorySize: 23.1,
              MarketShare: 16.8,
              PromoMyBrand: 13.9,
              PromoCompete: 10.7,
              CPM: 155,
              CPC: 10.3,
            },
            {
              date: "20 Sep'25",
              Offtake: 56,
              Spend: 19.6,
              ROAS: 7.4,
              InorgSales: 24,
              Conversion: 3.6,
              Availability: 85,
              SOS: 45,
              CategorySize: 25.6,
              MarketShare: 18.9,
              PromoMyBrand: 14.6,
              PromoCompete: 10.5,
              CPM: 151,
              CPC: 10.1,
            },
            {
              date: "23 Sep'25",
              Offtake: 42,
              Spend: 22.8,
              ROAS: 5.5,
              InorgSales: 14,
              Conversion: 2.4,
              Availability: 70,
              SOS: 33,
              CategorySize: 21.2,
              MarketShare: 15.6,
              PromoMyBrand: 16.8,
              PromoCompete: 13.5,
              CPM: 178,
              CPC: 12.2,
            },
            {
              date: "26 Sep'25",
              Offtake: 50,
              Spend: 17.2,
              ROAS: 7.0,
              InorgSales: 20,
              Conversion: 3.3,
              Availability: 81,
              SOS: 41,
              CategorySize: 24.1,
              MarketShare: 17.7,
              PromoMyBrand: 11.6,
              PromoCompete: 9.1,
              CPM: 144,
              CPC: 9.4,
            },
            {
              date: "30 Sep'25",
              Offtake: 58,
              Spend: 18.9,
              ROAS: 7.8,
              InorgSales: 26,
              Conversion: 3.9,
              Availability: 87,
              SOS: 47,
              CategorySize: 26.2,
              MarketShare: 19.4,
              PromoMyBrand: 13.2,
              PromoCompete: 9.7,
              CPM: 148,
              CPC: 9.0,
            },
          ].map((p, idx) => ({
            ...p,
            Discount: applyVar(p.Discount || p.PromoMyBrand || 10, idx),
            Offtake: applyVar(p.Offtake || p.Offtakes, idx),
            Spend: applyVar(p.Spend, idx),
            ROAS: applyVar(p.ROAS, idx),
            InorgSales: applyVar(p.InorgSales, idx),
            DspSales: applyVar(p.DspSales, idx),
            Conversion: applyVar(p.Conversion, idx),
            Availability: applyVar(p.Availability, idx),
            SOS: applyVar(p.SOS, idx),
            MarketShare: applyVar(p.MarketShare, idx),
          })),
        },

        /* =====================================================================
        COMPARE SKUs
        ===================================================================== */
        compareSkus: {
          context: { level: "MRP" },

          rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
          defaultRange: "1M",

          timeSteps: ["Daily", "Weekly", "Monthly"],
          defaultTimeStep: "Weekly",

          metrics: [
            {
              id: "Offtake",
              label: "Offtake",
              color: "#2563EB",
              default: true,
            },
            { id: "Spend", label: "Spend", color: "#DC2626", default: true },
            { id: "ROAS", label: "ROAS", color: "#16A34A", default: true },
            { id: "CategoryShare", label: "Category Share", color: "#EC4899" },
            { id: "MarketShare", label: "Market Share", color: "#9333EA" },
            { id: "Discount", label: "Promo-My %", color: "#06B6D4" },
            { id: "Conversion", label: "Conversion", color: "#F97316" },
          ],

          x: ["W1", "W2", "W3", "W4"],

          trendsBySku: {
            1: [
              {
                x: "W1",
                Offtake: 54,
                Spend: 4.2,
                ROAS: 6.8,
                CategoryShare: 23.8,
                MarketShare: 17.6,
                Conversion: 3.2,
              },
              {
                x: "W2",
                Offtake: 55,
                Spend: 4.5,
                ROAS: 7.0,
                CategoryShare: 24.2,
                MarketShare: 17.9,
                Conversion: 3.3,
              },
              {
                x: "W3",
                Offtake: 56,
                Spend: 4.8,
                ROAS: 7.2,
                CategoryShare: 24.5,
                MarketShare: 18.1,
                Conversion: 3.4,
              },
              {
                x: "W4",
                Offtake: 57,
                Spend: 5.0,
                ROAS: 7.4,
                CategoryShare: 24.9,
                MarketShare: 18.4,
                Conversion: 3.5,
              },
            ].map(p => ({
              ...p,
              Offtake: applyVar(p.Offtake || p.Offtakes),
              Spend: applyVar(p.Spend),
              ROAS: applyVar(p.ROAS),
              CategoryShare: applyVar(p.CategoryShare),
              MarketShare: applyVar(p.MarketShare),
              Conversion: applyVar(p.Conversion),
            })),
          },
        },

        /* =====================================================================
        COMPETITION TABLE
        ===================================================================== */
        competition: {
          context: {
            level: "MRP",
            region: "All × Chennai",
          },

          tabs: ["Brands", "SKUs"],

          periodToggle: {
            primary: "MTD",
            compare: "Previous Month",
          },

          columns: [
            { id: "brand", label: "Brand / SKU", type: "text" },
            { id: "SOS", label: "SOS", type: "metric" },
            { id: "CategoryShare", label: "Category Share", type: "metric" },
            { id: "MarketShare", label: "Market Share", type: "metric" },
            { id: "OSA", label: "OSA", type: "metric" },
            { id: "Discount", label: "Promo-My %", type: "metric" },
            { id: "PricePerUnit", label: "Price Per Unit", type: "metric" },
            { id: "ASP", label: "ASP", type: "metric" },
            { id: "RPI", label: "RPI", type: "metric" },
          ],

          brands: BRAND_OPTIONS.map((b, i) => ({
            brand: b,
            SOS: { value: applyVar(40 + i * 2, b), delta: 1.5 },
            CategoryShare: { value: applyVar(20 + i, b), delta: 1.2 },
            MarketShare: { value: applyVar(15 + i, b), delta: 0.8 },
            OSA: { value: applyVar(85 + i * 0.5, b), delta: 0.3 },
            Discount: { value: applyVar(10 + i * 0.2, b), delta: -0.5 },
            PricePerUnit: { value: applyVar(50 + i * 2, b), delta: 1.0 },
            ASP: { value: applyVar(45 + i * 1.5, b), delta: 0.8 },
            RPI: { value: applyVar(1.2 + i * 0.05, b), delta: 0.02 },
          })),
        },
      };
    }
    return { trends: {}, compareSkus: {}, competition: {} };
  }, [dynamicKey, selectedPlatform, brandOptions]); // end useMemo

  useLayoutEffect(() => {
    allSetTrendMeta((prev) => ({
      ...prev,
      context: { ...prev.context, audience: "Platform" },
    }));
    setShowPlatformPills(true);
  }, []);

  // Update starting states once DASHBOARD_DATA is ready
  useEffect(() => {
    if (DASHBOARD_DATA.trends?.defaultRange && range === "1M") {
      setRange(DASHBOARD_DATA.trends.defaultRange);
    }
    if (DASHBOARD_DATA.trends?.defaultTimeStep && timeStep === "Daily") {
      setTimeStep(DASHBOARD_DATA.trends.defaultTimeStep);
    }

    // Set default active metrics based on dynamicKey and the DASHBOARD_DATA config
    if (activeMetrics.length === 0) {
      if (dynamicKey === 'availability') {
        setActiveMetrics(isEcom ? ['Osa'] : ['Osa', 'Listing']);
      } else if (DASHBOARD_DATA.trends?.metrics) {
        setActiveMetrics(DASHBOARD_DATA.trends.metrics.filter(m => m.default).map(m => m.id));
      }
    }
  }, [DASHBOARD_DATA, dynamicKey, open, isEcom]);

  // Sync active metrics: remove Listing if platform becomes Ecom
  useEffect(() => {
    if (isEcom && activeMetrics.includes('Listing')) {
      setActiveMetrics(prev => prev.filter(m => m !== 'Listing'));
    }
  }, [isEcom, activeMetrics]);

  // Sync active metrics: remove PM metrics if Quickcomm + SKU selected
  useEffect(() => {
    if (isQuickcommSku) {
      const pmIds = ['Spend', 'Conversion', 'Roas', 'ROAS', 'InorgSales', 'InorganicSales', 'CPC'];
      setActiveMetrics(prev => {
        const filtered = prev.filter(m => !pmIds.includes(m));
        // If all were removed, default to first available non-PM metric
        return filtered.length > 0 ? filtered : prev.filter(m => !pmIds.includes(m));
      });
    }
  }, [isQuickcommSku]);


  const platformRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      // do nothing
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trendMetaRaw = DASHBOARD_DATA.trends || { metrics: [], points: [] };

  // Hide PM metrics from pills when Quickcomm + SKU selected
  const PM_METRIC_IDS = ['Spend', 'Conversion', 'Roas', 'ROAS', 'InorgSales', 'InorganicSales', 'CPC'];
  const trendMeta = useMemo(() => {
    if (!isQuickcommSku) return trendMetaRaw;
    return {
      ...trendMetaRaw,
      metrics: (trendMetaRaw.metrics || []).filter(m => !PM_METRIC_IDS.includes(m.id)),
    };
  }, [trendMetaRaw, isQuickcommSku]);

  const compMeta = DASHBOARD_DATA.competition || {};
  const compareMeta = DASHBOARD_DATA.compareSkus || {};

  // ⭐ Auto-select first SKU + only Osa when opening Compare SKUs first time
  useEffect(() => {
    if (view === "compare skus" && !compareInitialized) {
      const firstSku = SKU_DATA && SKU_DATA.length > 0 ? SKU_DATA[0] : null;
      if (firstSku) {
        setSelectedCompareSkus([firstSku]);
      }
      setActiveMetrics(["Osa"]);
      setCompareInitialized(true);
    }
  }, [view, compareInitialized]);

  // Sync active metrics when drawer opens from a specific RCA block
  useEffect(() => {
    if (open && selectedColumn && trendMeta?.metrics) {
      const normalizedQuery = selectedColumn.toLowerCase().trim();
      // Try to find a metric that matches
      const targetMetric = trendMeta.metrics.find(m =>
        m.label.toLowerCase().includes(normalizedQuery) ||
        m.id.toLowerCase().includes(normalizedQuery)
      );

      if (targetMetric) {
        setActiveMetrics([targetMetric.id]);
      }
    }
  }, [open, selectedColumn, trendMeta?.metrics]);

  const trendPoints = useMemo(() => {
    if (!trendMeta.points || trendMeta.points.length === 0) return [];
    const enriched = trendMeta.points.map((p) => ({
      ...p,
      _dateObj: parseTrendDate(p.date),
    }));
    const sorted = [...enriched].sort(
      (a, b) => a._dateObj.getTime() - b._dateObj.getTime()
    );

    if (range === "Custom" || !RANGE_TO_DAYS[range]) {
      return sorted.map(({ _dateObj, ...rest }) => rest);
    }

    const maxDate = sorted[sorted.length - 1]?._dateObj;
    if (!maxDate) return sorted.map(({ _dateObj, ...rest }) => rest);

    const days = RANGE_TO_DAYS[range];
    const filtered = sorted.filter((p) => {
      const diffMs = maxDate.getTime() - p._dateObj.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays <= days;
    });

    return filtered.map(({ _dateObj, ...rest }) => rest);
  }, [trendMeta, range]);

  const formatTooltipValue = (val, seriesName) => {
    if (val === undefined || val === null) return 'N/A';
    let formatted = val;
    if (typeof val === 'number') {
      const absVal = Math.abs(val);
      if (absVal >= 10000000) {
        formatted = `${(val / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
      } else if (absVal >= 100000) {
        formatted = `${(val / 100000).toFixed(2).replace(/\.00$/, '')} lac`;
      } else if (absVal >= 1000) {
        formatted = `${(val / 1000).toFixed(2).replace(/\.00$/, '')} K`;
      } else {
        formatted = val.toFixed(2).replace(/\.00$/, '');
      }
    }
    
    if (seriesName.includes('%') || seriesName.toLowerCase().includes('rate')) {
      return `${formatted}%`;
    }
    if (seriesName.includes('₹') || seriesName.toLowerCase().includes('price') || seriesName.toLowerCase().includes('sales') || seriesName.toLowerCase().includes('offtake')) {
      return `₹ ${formatted}`;
    }
    return formatted;
  };

  const createTooltipFormatter = (params) => {
    if (!params || !params.length) return '';
    // Filter out series whose value is null (unavailable KPIs) — only show visible lines
    const visibleParams = params.filter(p => p.value !== null && p.value !== undefined);
    if (!visibleParams.length) return '';
    let html = `<div style="font-weight:600;margin-bottom:4px;font-size:13px;color:#374151;">${visibleParams[0].axisValue}</div>`;
    visibleParams.forEach(param => {
      const formattedValue = formatTooltipValue(param.value, param.seriesName);
      html += `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:4px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${param.color};"></span>
            <span style="font-size:12px;color:#6B7280;">${param.seriesName}</span>
          </div>
          <span style="font-size:13px;font-weight:600;color:#111827;">${formattedValue}</span>
        </div>
      `;
    });
    return html;
  };

  const trendOption = useMemo(() => {
    const dataSource = (chartData && chartData.length > 0) ? chartData : (['availability', 'pricing', 'marketshare', 'performance_dashboard_tower'].includes(dynamicKey) ? [] : trendPoints);
    const xData = dataSource.map((p) => p.date);

    const metrics = trendMeta.metrics || [];
    const series = [];
    metrics
      .filter((m) => activeMetrics.includes(m.id))
      .forEach((m) => {
        series.push({
          name: m.label,
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: true,
          yAxisIndex: m.axis === "right" ? 1 : 0,
          lineStyle: { width: 2 },
          emphasis: { focus: "series" },
          data: dataSource.map((p) => p[m.id] ?? null),
          itemStyle: { color: m.color },
        });
      });

    return {
      grid: { left: 60, right: 80, top: 32, bottom: 40 },
      tooltip: { trigger: "axis", formatter: createTooltipFormatter },
      xAxis: {
        type: "category",
        data: xData,
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#E5E7EB" } },
        axisLabel: { fontSize: 11 },
      },
      yAxis: [
        {
          type: "value",
          position: "left",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#F3F4F6" } },
          scale: true,
          axisLabel: {
            formatter: (value) => {
              const prefix = "₹ ";
              if (value >= 10000000) return `${prefix}${(value / 10000000).toFixed(1).replace(/\.0$/, '')} Cr`;
              if (value >= 100000) return `${prefix}${(value / 100000).toFixed(1).replace(/\.0$/, '')} lac`;
              if (value >= 1000) return `${prefix}${(value / 1000).toFixed(1).replace(/\.0$/, '')} K`;
              return `${prefix}${value}`;
            }
          }
        },
        {
          type: "value",
          position: "right",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          scale: true,
          axisLabel: {
            formatter: (value) => `${value} %`
          }
        },
      ],
      legend: { show: false },
      series,
    };
  }, [trendMeta, activeMetrics, trendPoints, chartData]);
  // Compare SKUs chart option (multi-KPI, multi-SKU)
  const compareOption = useMemo(() => {
    const x = compareMeta.x;
    const series = [];

    selectedCompareSkus.forEach((sku) => {
      const trend = compareMeta.trendsBySku[sku.id];
      if (!trend) return;

      compareMeta.metrics
        .filter((m) => activeMetrics.includes(m.id))
        .forEach((m) => {
          series.push({
            name: `${sku.name} · ${m.label}`,
            type: "line",
            smooth: true,
            symbol: "circle",
            symbolSize: 6,
            lineStyle: { width: 1 },
            itemStyle: { color: m.color },
            data: trend.map((pt) => pt[m.id]) || [],
          });
        });
    });

    return {
      tooltip: { trigger: "axis", formatter: createTooltipFormatter },
      grid: { left: 40, right: 20, top: 20, bottom: 40 },
      xAxis: { type: "category", data: x },
      yAxis: {
        type: "value",
        min: 0,
        max: 120,
        axisLabel: { formatter: "{value}%" },
      },
      series,
    };
  }, [compareMeta, activeMetrics, selectedCompareSkus]);

  // keep selection fully in sync with drawer & deletion
  const handleSkuApply = (ids, skus) => {
    const mapById = Object.fromEntries(SKU_DATA.map((s) => [s.id, s]));
    const finalList = ids.map((id) => mapById[id]).filter(Boolean);
    setSelectedCompareSkus(finalList);
    setAddSkuOpen(false);
  };

  const handleAudienceChange = (e) => {
    const newAudience = e.target.value;
    allSetTrendMeta((prev) => ({
      ...prev,
      context: { ...prev.context, audience: newAudience },
    }));

    // Auto-select first item of the new group
    let firstOption = "";
    if (newAudience === "Platform") firstOption = PLATFORM_OPTIONS[0];
    else if (newAudience === "Format") firstOption = FORMAT_OPTIONS[0];
    else if (newAudience === "City") firstOption = CITY_OPTIONS[0];
    else if (newAudience === "Brand") firstOption = BRAND_OPTIONS[0];
    else if (newAudience === "SKU") firstOption = SKU_OPTIONS[0];

    const existingFilter = drawerFilters[newAudience];
    const newSelectedPill = (existingFilter && existingFilter !== "All") ? existingFilter : firstOption;

    setSelectedPlatform(newSelectedPill);

    // Sync with drawerFilters without resetting others
    setDrawerFilters(prev => ({
      ...prev,
      [newAudience]: newSelectedPill
    }));

    setShowPlatformPills(true);
    setShowAllPills(false); // Reset expand state when switching audiences
  };

  if (!open) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "rgba(15,23,42,0.32)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        p: 2,
        zIndex: 1300,
        overflow: "auto",
      }}
    >
      <Box
        sx={{
          mt: 4,
          width: "min(1200px, 100%)",
          bgcolor: "white",
          borderRadius: 3,
          boxShadow: "0 24px 60px rgba(15,23,42,0.35)",
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Header row */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <ToggleButtonGroup
            exclusive
            value={view}
            onChange={(_, v) => v && setView(v)}
            sx={{
              backgroundColor: "#F3F4F6",
              borderRadius: "999px",
              p: "3px",
              "& .MuiToggleButton-root": {
                textTransform: "none",
                border: "none",
                borderRadius: "999px",
                px: 2.5,
                py: 0.75,
                fontSize: 14,
                "&.Mui-selected": {
                  backgroundColor: "#0F172A",
                  color: "#fff",
                },
              },
            }}
          >
            <ToggleButton value="Trends">Trends</ToggleButton>
            {dynamicKey !== "Performance_marketing" &&
              dynamicKey !== "performance_dashboard_tower" && (
                <ToggleButton value="Competition">Competition</ToggleButton>
              )}
            {/* <ToggleButton value="compare skus">Compare SKUs</ToggleButton> */}
          </ToggleButtonGroup>

          <IconButton onClick={onClose} size="small">
            <X size={18} />
          </IconButton>
        </Box>

        {/* EFFECTIVE FILTERS SUMMARY BAR */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            py: 1.2,
            px: 2,
            borderRadius: "12px",
            backgroundColor: "#F8FAFC",
            border: "1px solid #E2E8F0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <Filter size={14} color="#64748B" />
            <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Effective Filters:
            </Typography>
          </Box>

          <SelectedFilterChip
            label="Platform"
            value={drawerFilters.Platform}
            color={drawerFilters.Platform !== 'All' ? "#0ea5e9" : "#64748B"}
          />
          <SelectedFilterChip
            label="Category"
            value={drawerFilters.Format}
            color={drawerFilters.Format !== 'All' ? "#0ea5e9" : "#64748B"}
          />
          <SelectedFilterChip
            label="Brand"
            value={drawerFilters.Brand}
            color={drawerFilters.Brand !== 'All' ? "#0ea5e9" : "#64748B"}
          />
          <SelectedFilterChip
            label="City"
            value={drawerFilters.City}
            color={drawerFilters.City !== 'All' ? "#0ea5e9" : "#64748B"}
          />
          <SelectedFilterChip
            label="SKU"
            value={
              drawerFilters.SKU !== 'All' && typeof drawerFilters.SKU === 'string' && drawerFilters.SKU.split(' ').length > 4
                ? drawerFilters.SKU.split(' ').slice(0, 4).join(' ') + ' ...'
                : drawerFilters.SKU
            }
            color={drawerFilters.SKU !== 'All' ? "#0ea5e9" : "#64748B"}
          />
          <SelectedFilterChip
            label="Date"
            value={range}
          />

          {/* Clear All Drawer Filters */}
          {(drawerFilters.Platform !== 'All' || drawerFilters.City !== 'All' || drawerFilters.Brand !== 'All' || drawerFilters.Format !== 'All' || drawerFilters.SKU !== 'All') && (
            <Button
              size="small"
              onClick={() => setDrawerFilters({ Platform: "All", Format: "All", Brand: "All", City: "All", SKU: "All" })}
              sx={{
                ml: 'auto',
                fontSize: '11px',
                textTransform: 'none',
                color: '#ef4444',
                '&:hover': { backgroundColor: '#fef2f2' }
              }}
            >
              Clear Drawer Filters
            </Button>
          )}
        </Box>

        {/* TRENDS VIEW */}
        {view === "Trends" && (
          <Box display="flex" flexDirection="column" gap={0}>
            {/* Title Block */}
            <Typography 
              variant="h5" 
              fontWeight={800} 
              sx={{ 
                color: '#0f172a',
                lineHeight: 1.2,
                mb: 2,
              }}
            >
              {selectedColumn || "KPI Trends"}
            </Typography>

            {/* HEADER FILTER CONTAINER */}
            <Box 
              display="flex" 
              alignItems="center" 
              justifyContent="space-between" 
              flexWrap="wrap" 
              gap={2}
              mb={3}
            >
              {/* PRIMARY FILTERS */}
              <Box display="flex" alignItems="center" gap={1}>
                <FilterDropdown 
                  title="Platform" 
                  value={drawerFilters.Platform} 
                  options={PLATFORM_OPTIONS} 
                  onChange={(v) => setDrawerFilters(prev => ({...prev, Platform: v}))} 
                />
                <FilterDropdown 
                  title="Category" 
                  value={drawerFilters.Format} 
                  options={FORMAT_OPTIONS} 
                  onChange={(v) => setDrawerFilters(prev => ({...prev, Format: v}))} 
                />
                <FilterDropdown 
                  title="Brand" 
                  value={drawerFilters.Brand} 
                  options={BRAND_OPTIONS} 
                  onChange={(v) => setDrawerFilters(prev => ({...prev, Brand: v}))} 
                />
                <FilterDropdown 
                  title="City" 
                  value={drawerFilters.City} 
                  options={CITY_OPTIONS} 
                  onChange={(v) => setDrawerFilters(prev => ({...prev, City: v}))} 
                />
                
                <Button
                  onClick={() => setIsMoreFiltersOpen(prev => !prev)}
                  startIcon={<SlidersHorizontal size={14} />}
                  sx={{
                    borderRadius: "999px",
                    border: "1px solid",
                    borderColor: isMoreFiltersOpen ? "#3B82F6" : "#E2E8F0",
                    backgroundColor: isMoreFiltersOpen ? "#EFF6FF" : "white",
                    color: "#0F172A",
                    textTransform: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                    px: 2,
                    py: 0.5,
                    minHeight: 32,
                    ml: 1,
                    "&:hover": {
                      backgroundColor: isMoreFiltersOpen ? "#DBEAFE" : "#F8FAFC",
                    }
                  }}
                >
                  SKU Filter
                </Button>
              </Box>

              {/* RANGE + TIMESTEP — stacked vertically */}
              <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
                <Box display="flex" alignItems="center" gap={1}>
                  <PillToggleGroup
                    value={range}
                    onChange={setRange}
                    options={trendMeta.rangeOptions}
                  />
                  {range === "Custom" && (
                    <Box display="flex" alignItems="center" gap={1} ml={1}>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        max={maxDateStr}
                        style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: '4px 8px', outline: 'none', fontSize: '13px', color: '#475569' }}
                      />
                      <Typography variant="body2" color="#94a3b8" sx={{ fontSize: '12px' }}>to</Typography>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        max={maxDateStr}
                        style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: '4px 8px', outline: 'none', fontSize: '13px', color: '#475569' }}
                      />
                    </Box>
                  )}
                </Box>

                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2" color="#64748B" fontWeight={500} sx={{ fontSize: '12px' }}>Time Step:</Typography>
                  <PillToggleGroup
                    value={timeStep}
                    onChange={setTimeStep}
                    options={trendMeta.timeSteps}
                  />
                </Box>
              </Box>
            </Box>

        {/* ADDITIONAL FILTERS INLINE PANEL — slides in from the right within the drawer */}
        {isMoreFiltersOpen && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 300,
              bgcolor: "white",
              borderLeft: "1px solid #E2E8F0",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.06)",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              p: 3,
              animation: "slideInRight 0.2s ease-out",
              "@keyframes slideInRight": {
                from: { transform: "translateX(100%)" },
                to: { transform: "translateX(0)" },
              },
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6" fontWeight={700} fontSize="1.05rem">SKU Selection</Typography>
              <IconButton onClick={() => setIsMoreFiltersOpen(false)} size="small">
                <X size={18} />
              </IconButton>
            </Box>

            <Box display="flex" flexDirection="column" gap={3} flex={1}>
              
              <Box>
                <Typography variant="body2" fontWeight={600} mb={1} color="#475569">SKU</Typography>
                {/* Search input */}
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search SKUs..."
                  value={skuSearchTerm || ''}
                  onChange={(e) => setSkuSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={14} color="#94A3B8" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    mb: 1,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      fontSize: '13px',
                    }
                  }}
                />
                {/* Scrollable SKU list */}
                <Box
                  sx={{
                    maxHeight: 220,
                    overflowY: 'auto',
                    border: '1px solid #E2E8F0',
                    borderRadius: 2,
                    '&::-webkit-scrollbar': { width: 6 },
                    '&::-webkit-scrollbar-thumb': { backgroundColor: '#CBD5E1', borderRadius: 3 },
                  }}
                >
                  {/* "All SKUs" option */}
                  <Box
                    onClick={() => setDrawerFilters(prev => ({...prev, SKU: 'All'}))}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.5,
                      py: 1,
                      cursor: 'pointer',
                      borderBottom: '1px solid #F1F5F9',
                      backgroundColor: drawerFilters.SKU === 'All' ? '#EFF6FF' : 'transparent',
                      '&:hover': { backgroundColor: '#F8FAFC' },
                    }}
                  >
                    <Box sx={{ width: 16, height: 16, borderRadius: '4px', border: `2px solid ${drawerFilters.SKU === 'All' ? '#3B82F6' : '#CBD5E1'}`, backgroundColor: drawerFilters.SKU === 'All' ? '#3B82F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {drawerFilters.SKU === 'All' && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                    </Box>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>All SKUs</Typography>
                  </Box>

                  {/* Filtered SKU items */}
                  {SKU_OPTIONS
                    .filter(opt => !skuSearchTerm || opt.toLowerCase().includes(skuSearchTerm.toLowerCase()))
                    .map(opt => {
                      const isSelected = drawerFilters.SKU === opt;
                      // Truncate display: show last part in parentheses as variant hint
                      const parenMatch = opt.match(/\(([^)]+)\)\s*$/);
                      const variant = parenMatch ? parenMatch[1] : '';
                      const mainName = opt.length > 60 ? opt.substring(0, 57) + '...' : opt;

                      return (
                        <Box
                          key={opt}
                          onClick={() => setDrawerFilters(prev => ({...prev, SKU: prev.SKU === opt ? 'All' : opt}))}
                          title={opt}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 1.5,
                            py: 0.8,
                            cursor: 'pointer',
                            borderBottom: '1px solid #F8FAFC',
                            backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                            transition: 'background 0.15s',
                            '&:hover': { backgroundColor: isSelected ? '#DBEAFE' : '#F8FAFC' },
                          }}
                        >
                          <Box sx={{ width: 16, height: 16, borderRadius: '4px', border: `2px solid ${isSelected ? '#3B82F6' : '#CBD5E1'}`, backgroundColor: isSelected ? '#3B82F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                          </Box>
                          <Box sx={{ overflow: 'hidden', minWidth: 0 }}>
                            <Typography sx={{
                              fontSize: '12px',
                              fontWeight: isSelected ? 600 : 400,
                              color: isSelected ? '#1E40AF' : '#334155',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 200,
                            }}>
                              {mainName}
                            </Typography>
                            {variant && (
                              <Typography sx={{ fontSize: '10px', color: '#94A3B8', mt: '-1px' }}>
                                {variant}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      );
                    })
                  }
                  {SKU_OPTIONS.filter(opt => !skuSearchTerm || opt.toLowerCase().includes(skuSearchTerm.toLowerCase())).length === 0 && (
                    <Typography sx={{ p: 2, textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>No SKUs found</Typography>
                  )}
                </Box>
              </Box>
            </Box>

            <Box display="flex" justifyContent="flex-end" gap={2} pt={3} borderTop="1px solid #F1F5F9">
              <Button 
                onClick={() => setIsMoreFiltersOpen(false)}
                variant="outlined"
                sx={{ borderRadius: 2, textTransform: 'none', borderColor: '#E2E8F0', color: '#475569', minWidth: 90, fontSize: '13px' }}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => setIsMoreFiltersOpen(false)}
                variant="contained"
                sx={{ 
                  borderRadius: 2, 
                  textTransform: 'none', 
                  boxShadow: 'none', 
                  bgcolor: '#0F172A',
                  '&:hover': { bgcolor: '#1E293B', boxShadow: 'none' },
                  minWidth: 120,
                  fontSize: '13px'
                }}
              >
                Apply Filters
              </Button>
            </Box>
          </Box>
        )}

            {/* CHART */}
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                border: "1px solid #E5E7EB",
                mt: 1,
                p: 2.5,
              }}
            >
              {/* Metric Row */}
              <Box
                display="flex"
                alignItems="center"
                gap={1.5}
                mb={3}
                sx={{
                  overflowX: "auto",
                  pb: 1,
                  "&::-webkit-scrollbar": {
                    display: "none",
                  },
                  msOverflowStyle: "none",
                  scrollbarWidth: "none",
                }}
              >
                {trendMeta.metrics
                  .filter(m => !(isEcom && m.id === 'Listing'))
                  .map((m) => {
                    // Determine if this metric's data source is unavailable
                    let sourceGroup = KPI_SOURCE_MAP[m.id];
                    // IMPORTANT FIX: In WatchTower, 'Discount' is evaluated under the 'pdp' group, not the 'Discount' flag which is pricing specific
                    if (dynamicKey !== "pricing" && (m.id === "Discount" || m.id === "discount")) {
                      sourceGroup = 'pdp';
                    }
                    
                    const isMetricNA = kpiAvailability && sourceGroup ? !kpiAvailability[sourceGroup] : false;
                    return (
                      <MetricChip
                        key={m.id}
                        label={m.label}
                        color={m.color}
                        active={activeMetrics.includes(m.id) && !isMetricNA}
                        isNA={isMetricNA}
                        onClick={() =>
                          setActiveMetrics((prev) =>
                            prev.includes(m.id)
                              ? prev.filter((x) => x !== m.id)
                              : [...prev, m.id]
                          )
                        }
                      />
                    );
                  })}
              </Box>

              {/* Chart */}
              <Box sx={{ height: 340 }}>
                {loading ? (
                  <div className="w-full h-full bg-slate-100/50 animate-pulse rounded-lg border border-slate-100 flex items-center justify-center">
                    <div className="h-full flex items-end gap-4 px-8 pb-8 w-full">
                      <div className="w-1/6 bg-slate-200/50 h-[40%] rounded-t-sm" />
                      <div className="w-1/6 bg-slate-200/50 h-[70%] rounded-t-sm" />
                      <div className="w-1/6 bg-slate-200/50 h-[50%] rounded-t-sm" />
                      <div className="w-1/6 bg-slate-200/50 h-[80%] rounded-t-sm" />
                      <div className="w-1/6 bg-slate-200/50 h-[60%] rounded-t-sm" />
                      <div className="w-1/6 bg-slate-200/50 h-[90%] rounded-t-sm" />
                    </div>
                  </div>
                ) : trendError ? (
                  <ErrorRetryOverlay onRetry={fetchTrendData} message={trendError} compact />
                ) : (!chartData || chartData.length === 0) ? (
                  <Box
                    sx={{
                      height: "100%",
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                      backgroundColor: "#F8FAFC",
                      borderRadius: 2,
                      border: "1px dashed #E2E8F0"
                    }}
                  >
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        backgroundColor: "#F1F5F9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#94A3B8"
                      }}
                    >
                      <BarChart3 size={24} />
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "#64748B",
                        fontWeight: 500
                      }}
                    >
                      No Data Available
                    </Typography>
                  </Box>
                ) : (
                  <ReactECharts
                    style={{ height: "100%", width: "100%" }}
                    option={trendOption}
                    notMerge
                  />
                )}
              </Box>
            </Paper>
          </Box>
        )}

        {/* COMPETITION VIEW */}
        {view === "Competition" && (
          <>
            {dynamicKey === "platform_overview_tower" ? (
              <PlatformOverviewKpiShowcase
                dynamicKey={dynamicKey}
                selectedItem={drawerFilters.Platform !== 'All' ? drawerFilters.Platform : 'All'}
                selectedLevel={selectedLevel}
                filterOptions={filterOptions}
                period={range}
                timeStep={timeStep}
                onTrendClick={handleRowTrendClick}
              />
            ) : dynamicKey === "availability" ? (
              <AvailabilityCompetitionKpiShowcase
                platform={drawerFilters.Platform !== 'All' ? drawerFilters.Platform : 'All'}
                globalFilters={{
                  startDate: customStart || undefined,
                  endDate: customEnd || undefined,
                }}
                period={range}
              />
            ) : (
              <KpiTrendShowcase
                dynamicKey={dynamicKey}
                period={range}
                timeStep={timeStep}
                dimensionValue={selectedColumn}
                dimensionType={
                  dimensionType || (
                    (selectedLevel?.toLowerCase() === 'city' || selectedLevel?.toLowerCase() === 'location') ? 'city' :
                      (selectedLevel?.toLowerCase() === 'platform') ? 'platform' :
                        (selectedLevel?.toLowerCase() === 'sku') ? 'sku' :
                          'category'
                  )
                }
              />
            )}
          </>
        )}

        {/* COMPARE SKUs VIEW */}
        {view === "compare skus" && (
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Typography variant="h6" fontWeight={600}>
                Compare SKUs
              </Typography>
              <Chip
                size="small"
                label={compareMeta.context.level}
                sx={{
                  borderRadius: "999px",
                  backgroundColor: "#DCFCE7",
                  color: "#166534",
                  fontWeight: 500,
                }}
              />
            </Box>

            {/* Range + Timestep */}
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <PillToggleGroup
                value={range}
                onChange={setRange}
                options={compareMeta.rangeOptions}
              />
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2">Time Step:</Typography>
                <PillToggleGroup
                  value={timeStep}
                  onChange={setTimeStep}
                  options={compareMeta.timeSteps}
                />
              </Box>
            </Box>

            {/* SKU pills + Add SKUs button row */}
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gap={2}
              flexWrap="wrap"
            >
              <Box display="flex" gap={1} flexWrap="wrap" flex={1}>
                {selectedCompareSkus.map((sku) => {
                  const color =
                    BRAND_COLORS[sku.brand] || "rgba(37,99,235,0.3)";
                  return (
                    <Chip
                      key={sku.id}
                      label={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: "999px",
                              backgroundColor: color,
                            }}
                          />
                          <Typography variant="body2" noWrap>
                            {sku.name}
                          </Typography>
                        </Box>
                      }
                      onDelete={() =>
                        setSelectedCompareSkus((prev) =>
                          prev.filter((s) => s.id !== sku.id)
                        )
                      }
                      sx={{
                        borderRadius: "999px",
                        backgroundColor: "#F9FAFB",
                        borderColor: "transparent",
                        maxWidth: 260,
                      }}
                    />
                  );
                })}
              </Box>

              <Button
                variant="contained"
                startIcon={<Plus size={14} />}
                sx={{
                  backgroundColor: "#2563EB",
                  textTransform: "none",
                  borderRadius: "999px",
                  minWidth: 140,
                }}
                onClick={() => setAddSkuOpen(true)}
              >
                Add SKUs
              </Button>
            </Box>

            {/* Metric Chips */}
            <Box display="flex" gap={1.5} flexWrap="wrap">
              {compareMeta.metrics.map((m) => (
                <MetricChip
                  key={m.id}
                  label={m.label}
                  color={m.color}
                  active={activeMetrics.includes(m.id)}
                  onClick={() =>
                    setActiveMetrics((prev) =>
                      prev.includes(m.id)
                        ? prev.filter((x) => x !== m.id)
                        : [...prev, m.id]
                    )
                  }
                />
              ))}
            </Box>

            {/* Chart */}
            <Paper sx={{ p: 2, borderRadius: 3, border: "1px solid #E5E7EB" }}>
              <Box sx={{ height: 350 }}>
                <ReactECharts
                  key={selectedCompareSkus.map((s) => s.id).join("-")}
                  option={compareOption}
                  notMerge={true}
                  style={{ height: "100%", width: "100%" }}
                />
              </Box>
            </Paper>
          </Box>
        )}

        {/* Shared Add SKU drawer for both Competition + Compare SKUs */}
        <AddSkuDrawer
          open={addSkuOpen}
          onClose={() => setAddSkuOpen(false)}
          onApply={handleSkuApply}
          selectedIds={selectedCompareSkus.map((s) => s.id)}
        />
      </Box>
    </Box >
  );
}
