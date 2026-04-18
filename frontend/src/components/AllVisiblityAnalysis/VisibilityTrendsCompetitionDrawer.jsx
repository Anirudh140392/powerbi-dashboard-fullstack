// TrendsCompetitionDrawer.jsx
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useLayoutEffect,
  useContext,
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
  Skeleton,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
} from "@mui/material";
import { ChevronDown, X, Search, Plus, Filter, SlidersHorizontal } from "lucide-react";
import ReactECharts from "echarts-for-react";
import KpiTrendShowcase from "../AllAvailablityAnalysis/KpiTrendShowcase";
import AddSkuDrawer from "../AllAvailablityAnalysis/AddSkuDrawer";
import VisibilityPlatformOverviewKpiShowcase from "./VisibilityPlatformOverviewKpiShowcase";
import axiosInstance from "../../api/axiosInstance";
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
          backgroundColor: isActive ? "#EFF6FF" : "white",
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
            <MenuItem disabled sx={{ fontSize: '13px', py: 1.5 }}>No data is available</MenuItem>
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
                    icon={<Box sx={{ width: 14, height: 14, borderRadius: '4px', border: '1.5px solid #CBD5E1' }} />}
                    checkedIcon={<Box sx={{ width: 14, height: 14, borderRadius: '4px', bgcolor: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={10} color="white" style={{ transform: 'rotate(45deg)' }} /></Box>}
                    sx={{ p: 0 }}
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
};

function makeSkuTrend(osaOffset, doiOffset, fillOffset, assOffset) {
  return {
    Osa: BASE_COMPARE_TRENDS.Osa.map((v) => v + osaOffset),
    Doi: BASE_COMPARE_TRENDS.Doi.map((v) => v + doiOffset),
    Fillrate: BASE_COMPARE_TRENDS.Fillrate.map((v) => v + fillOffset),
    Assortment: BASE_COMPARE_TRENDS.Assortment.map((v) => v + assOffset),
  };
}

const DASHBOARD_DATA = {
  trends: {
    context: {
      level: "MRP",
      audience: "All",
    },

    rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
    defaultRange: "1M",

    timeSteps: ["Daily", "Weekly", "Monthly"],
    defaultTimeStep: "Daily",

    // ⭐ Your New KPI Set
    metrics: [
      {
        id: "overall_sos",
        label: "Overall SOS",
        color: "#F97316",
        axis: "left",
        default: true,
      },
      {
        id: "sponsored_sos",
        label: "Sponsored SOS",
        color: "#7C3AED",
        axis: "right",
        default: true,
      },
      {
        id: "organic_sos",
        label: "Organic SOS",
        color: "#6366F1",
        axis: "left",
        default: false,
      },
    ],

    // ⭐ All trend points now contain SOS metrics instead of old KPIs
    points: [
      {
        date: "06 Sep'25",
        overall_sos: 57,
        sponsored_sos: 41,
        organic_sos: 72,
        display_sos: 65,
      },
      {
        date: "07 Sep'25",
        overall_sos: 54,
        sponsored_sos: 42,
        organic_sos: 70,
        display_sos: 66,
      },
      {
        date: "08 Sep'25",
        overall_sos: 53,
        sponsored_sos: 40,
        organic_sos: 69,
        display_sos: 64,
      },
      {
        date: "09 Sep'25",
        overall_sos: 53,
        sponsored_sos: 39,
        organic_sos: 68,
        display_sos: 63,
      },
      {
        date: "10 Sep'25",
        overall_sos: 52,
        sponsored_sos: 37,
        organic_sos: 66,
        display_sos: 62,
      },
      {
        date: "11 Sep'25",
        overall_sos: 52,
        sponsored_sos: 36,
        organic_sos: 67,
        display_sos: 62,
      },
      {
        date: "12 Sep'25",
        overall_sos: 52,
        sponsored_sos: 35,
        organic_sos: 68,
        display_sos: 61,
      },
      {
        date: "13 Sep'25",
        overall_sos: 52,
        sponsored_sos: 34,
        organic_sos: 69,
        display_sos: 60,
      },
      {
        date: "14 Sep'25",
        overall_sos: 52,
        sponsored_sos: 33,
        organic_sos: 70,
        display_sos: 60,
      },
      {
        date: "15 Sep'25",
        overall_sos: 52,
        sponsored_sos: 32,
        organic_sos: 70,
        display_sos: 59,
      },
      {
        date: "16 Sep'25",
        overall_sos: 52,
        sponsored_sos: 32,
        organic_sos: 69,
        display_sos: 59,
      },
      {
        date: "17 Sep'25",
        overall_sos: 51,
        sponsored_sos: 31,
        organic_sos: 68,
        display_sos: 58,
      },
      {
        date: "18 Sep'25",
        overall_sos: 51,
        sponsored_sos: 31,
        organic_sos: 67,
        display_sos: 58,
      },
      {
        date: "19 Sep'25",
        overall_sos: 51,
        sponsored_sos: 32,
        organic_sos: 66,
        display_sos: 57,
      },
      {
        date: "20 Sep'25",
        overall_sos: 56,
        sponsored_sos: 50,
        organic_sos: 75,
        display_sos: 68,
      },
      {
        date: "21 Sep'25",
        overall_sos: 50,
        sponsored_sos: 34,
        organic_sos: 67,
        display_sos: 55,
      },
      {
        date: "22 Sep'25",
        overall_sos: 49,
        sponsored_sos: 33,
        organic_sos: 66,
        display_sos: 54,
      },
      {
        date: "23 Sep'25",
        overall_sos: 48,
        sponsored_sos: 32,
        organic_sos: 65,
        display_sos: 54,
      },
      {
        date: "24 Sep'25",
        overall_sos: 47,
        sponsored_sos: 31,
        organic_sos: 64,
        display_sos: 53,
      },
      {
        date: "25 Sep'25",
        overall_sos: 46,
        sponsored_sos: 30,
        organic_sos: 63,
        display_sos: 52,
      },
      {
        date: "26 Sep'25",
        overall_sos: 45,
        sponsored_sos: 30,
        organic_sos: 62,
        display_sos: 52,
      },
      {
        date: "27 Sep'25",
        overall_sos: 44,
        sponsored_sos: 31,
        organic_sos: 63,
        display_sos: 51,
      },
      {
        date: "28 Sep'25",
        overall_sos: 44,
        sponsored_sos: 31,
        organic_sos: 62,
        display_sos: 51,
      },
      {
        date: "29 Sep'25",
        overall_sos: 43,
        sponsored_sos: 32,
        organic_sos: 61,
        display_sos: 50,
      },
      {
        date: "30 Sep'25",
        overall_sos: 43,
        sponsored_sos: 34,
        organic_sos: 60,
        display_sos: 49,
      },
      {
        date: "01 Oct'25",
        overall_sos: 44,
        sponsored_sos: 36,
        organic_sos: 61,
        display_sos: 50,
      },
      {
        date: "02 Oct'25",
        overall_sos: 45,
        sponsored_sos: 37,
        organic_sos: 62,
        display_sos: 51,
      },
      {
        date: "03 Oct'25",
        overall_sos: 46,
        sponsored_sos: 39,
        organic_sos: 63,
        display_sos: 52,
      },
      {
        date: "04 Oct'25",
        overall_sos: 46,
        sponsored_sos: 40,
        organic_sos: 65,
        display_sos: 53,
      },
    ],
  },

  // ⭐ UPDATED Compare SKUs using NEW KPIs
  compareSkus: {
    context: { level: "MRP" },
    rangeOptions: ["Custom", "1M", "3M", "6M", "1Y"],
    defaultRange: "1M",
    timeSteps: ["Daily", "Weekly", "Monthly"],
    defaultTimeStep: "Daily",

    metrics: [
      {
        id: "overall_sos",
        label: "Overall SOS",
        color: "#F97316",
        default: true,
      },
      {
        id: "sponsored_sos",
        label: "Sponsored SOS",
        color: "#7C3AED",
        default: true,
      },
      {
        id: "organic_sos",
        label: "Organic SOS",
        color: "#6366F1",
        default: false,
      },
    ],

    x: COMPARE_X,

    trendsBySku: {
      1: makeSkuTrend(0, 0, 0, 0),
      2: makeSkuTrend(-2, -1, -1, 0),
      3: makeSkuTrend(-3, -2, -2, -1),
      4: makeSkuTrend(-4, -3, -3, -1),
      5: makeSkuTrend(+2, +3, +2, +2),
      6: makeSkuTrend(+1, +2, +1, +1),
      7: makeSkuTrend(-1, -2, -1, -1),
      8: makeSkuTrend(+3, +1, +2, +1),
    },
  },

  // ⭐ COMPETITION VIEW UPDATED TO NEW KPIs
  competition: {
    context: { level: "MRP", region: "All × Chennai" },

    tabs: ["Brands", "SKUs"],

    periodToggle: {
      primary: "MTD",
      compare: "Previous Month",
    },

    columns: [
      { id: "brand", label: "Brand", type: "text" },
      { id: "overall_sos", label: "Overall SOS", type: "metric" },
      { id: "sponsored_sos", label: "Sponsored SOS", type: "metric" },
      { id: "organic_sos", label: "Organic SOS", type: "metric" },
    ],

    brands: [
      {
        brand: "Colgate",
        overall_sos: { value: 32.9, delta: -4.5 },
        sponsored_sos: { value: 74.6, delta: -16.3 },
        organic_sos: { value: 20.0, delta: -8.5 },
        display_sos: { value: 18.8, delta: 0.4 },
      },
      {
        brand: "Sensodyne",
        overall_sos: { value: 19.6, delta: 2.2 },
        sponsored_sos: { value: 94.2, delta: 3.9 },
        organic_sos: { value: 19.3, delta: 2.7 },
        display_sos: { value: 18.5, delta: -3.1 },
      },
    ],

    skus: [
      {
        brand: "Colgate Strong Teeth 100g",
        overall_sos: { value: 8.2, delta: -1.0 },
        sponsored_sos: { value: 76.1, delta: -8.0 },
        organic_sos: { value: 4.5, delta: -0.9 },
        display_sos: { value: 3.2, delta: 0.2 },
      },
    ],
  },
};

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
      width: { xs: "100%", sm: "auto" },
      display: "flex",
      "& .MuiToggleButton-root": {
        textTransform: "none",
        border: "none",
        px: { xs: 1.5, sm: 2.5 },
        py: 0.5,
        flex: { xs: 1, sm: "initial" },
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
        <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{opt}</Typography>
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
);

const MetricChip = ({ label, color, active, onClick }) => {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.8,
        px: 1.5,
        py: 0.6,
        borderRadius: "999px",
        cursor: "pointer",
        border: `1px solid ${active ? color : "#E5E7EB"}`,
        backgroundColor: active ? `${color}20` : "white",
        color: active ? color : "#0f172a",
        fontSize: "12px",
        fontWeight: 600,
        userSelect: "none",
        transition: "all 0.15s ease",
      }}
    >
      {/* CHECKBOX ICON */}
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `2px solid ${active ? color : "#CBD5E1"}`,
          backgroundColor: active ? color : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 10,
          lineHeight: 1,
        }}
      >
        {active && "✓"}
      </Box>

      {label}
    </Box>
  );
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

export default function VisibilityTrendsCompetitionDrawer({
  dynamicKey,
  open = true,
  onClose = () => { },
  selectedColumn,
  initialAudience,
}) {
  const { platform: globalPlatform, selectedBrand, selectedLocation, selectedCategory, selectedChannel } = useContext(FilterContext);

  const [view, setView] = useState("Trends");
  const [allTrendMeta, allSetTrendMeta] = useState({
    context: {
      audience: "Platform", // default value
    },
  });
  useLayoutEffect(() => {
    if (open) {
      const audienceToSet = initialAudience || "Platform";
      allSetTrendMeta((prev) => ({
        ...prev,
        context: { ...prev.context, audience: audienceToSet },
      }));
      setShowPlatformPills(true);
    }
  }, [open, initialAudience]);
  const [range, setRange] = useState(DASHBOARD_DATA.trends.defaultRange);
  const [timeStep, setTimeStep] = useState(
    DASHBOARD_DATA.trends.defaultTimeStep
  );
  const [activeMetrics, setActiveMetrics] = useState(
    DASHBOARD_DATA.trends.metrics.filter((m) => m.default).map((m) => m.id)
  );
  const [compTab, setCompTab] = useState("Brands");
  const [search, setSearch] = useState("");
  const [periodMode, setPeriodMode] = useState("primary");
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [skuSearchTerm, setSkuSearchTerm] = useState("");

  const [addSkuOpen, setAddSkuOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("Blinkit");
  const [showPlatformPills, setShowPlatformPills] = useState(false);

  // Drawer-specific filters for the Effective Filters bar
  const [drawerFilters, setDrawerFilters] = useState({
    Platform: globalPlatform || "All",
    Format: selectedCategory || "All",
    Brand: selectedBrand || "All",
    City: selectedLocation || "All",
    SKU: "All"
  });

  // Sync selectedPlatform and drawerFilters with selectedColumn ONLY ONCE when drawer opens
  useEffect(() => {
    if (selectedColumn && open) {
      setSelectedPlatform(selectedColumn);

      // Initialize ONLY the current audience type filter
      const currentAudience = initialAudience || allTrendMeta.context.audience;
      setDrawerFilters(prev => ({
        ...prev,
        [currentAudience]: selectedColumn
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColumn, open]); // Removed allTrendMeta.context.audience

  const platformRef = useRef(null);

  // close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (platformRef.current && !platformRef.current.contains(e.target)) {
        setShowPlatformPills(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [selectedCompareSkus, setSelectedCompareSkus] = useState([]);
  const [compareInitialized, setCompareInitialized] = useState(false);

  const trendMeta = DASHBOARD_DATA.trends;
  const compMeta = DASHBOARD_DATA.competition;
  const compareMeta = DASHBOARD_DATA.compareSkus;

  // ⭐ Auto-select first SKU + only Osa when opening Compare SKUs first time
  useEffect(() => {
    if (view === "compare skus" && !compareInitialized) {
      const firstSku = SKU_DATA && SKU_DATA.length > 0 ? SKU_DATA[0] : null;
      if (firstSku) {
        setSelectedCompareSkus([firstSku]);
      }
      setActiveMetrics(["overall_sos"]);
      setCompareInitialized(true);
    }
  }, [view, compareInitialized]);

  // ===================== API STATE =====================
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [competitionData, setCompetitionData] = useState({ brands: [], skus: [] });
  const [competitionLoading, setCompetitionLoading] = useState(true);

  // ===================== DYNAMIC FILTER OPTIONS STATE =====================
  const [filterOptions, setFilterOptions] = useState({
    platforms: [],
    formats: [],
    cities: [],
    brands: [],
    loading: true
  });

  // ===================== FETCH FILTER OPTIONS =====================
  useEffect(() => {
    if (!open) return;

    const fetchFilterOptions = async () => {
      try {
        console.log("[VisibilityTrendsDrawer] Fetching filter options");
        const [platformsRes, formatsRes, citiesRes, brandsRes, skusRes] = await Promise.all([
          axiosInstance.get('/visibility-analysis/filter-options', { params: { filterType: 'platforms', channel: selectedChannel || 'All' } }),
          axiosInstance.get('/visibility-analysis/filter-options', { params: { filterType: 'formats', channel: selectedChannel || 'All' } }),
          axiosInstance.get('/visibility-analysis/filter-options', { params: { filterType: 'cities', channel: selectedChannel || 'All' } }),
          axiosInstance.get('/visibility-analysis/filter-options', { params: { filterType: 'brands', channel: selectedChannel || 'All', ownBrandsOnly: true } }),
          axiosInstance.get('/visibility-analysis/filter-options', { params: { filterType: 'skus', channel: selectedChannel || 'All', ownBrandsOnly: true } })
        ]);

        const platforms = (platformsRes.data?.options || []).filter(p => p !== 'All');
        const formats = (formatsRes.data?.options || []).filter(f => f !== 'All');
        const brands = (brandsRes.data?.options || []).filter(b => b !== 'All');
        const skus = (skusRes.data?.options || []).filter(s => s !== 'All');

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

        console.log("[VisibilityTrendsDrawer] Filter options fetched:", { platforms: platforms.length, formats: formats.length, cities: cities.length, brands: brands.length, skus: skus.length });

        setFilterOptions({
          platforms: platforms.length > 0 ? platforms : ["Blinkit", "Zepto", "Instamart"],
          formats: formats.length > 0 ? formats : ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"],
          cities: cities.length > 0 ? cities : ["Delhi", "Mumbai", "Bangalore", "Chennai"],
          brands: brands.length > 0 ? brands : [],
          skus: skus.length > 0 ? skus : [],
          loading: false
        });

        // Set default selected platform to first available
        if (platforms.length > 0) {
          setSelectedPlatform(platforms[0]);
        }
      } catch (error) {
        console.error("[VisibilityTrendsDrawer] Error fetching filter options:", error);
        setFilterOptions({
          platforms: ["Blinkit", "Zepto", "Instamart"],
          formats: ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"],
          cities: ["Delhi", "Mumbai", "Bangalore", "Chennai"],
          brands: [],
          skus: [],
          loading: false
        });
      }
    };

    fetchFilterOptions();
  }, [open, selectedChannel]);

  // ===================== FETCH TREND DATA =====================
  useEffect(() => {
    if (view !== "Trends" || !open) return;

    let cancelled = false;
    const fetchTrendData = async () => {
      setLoading(true);
      try {
        const params = {
          period: range,
          timeStep: timeStep,
          platform: drawerFilters.Platform !== 'All' ? drawerFilters.Platform : undefined,
          format: drawerFilters.Format !== 'All' ? drawerFilters.Format : undefined,
          location: drawerFilters.City !== 'All' && drawerFilters.City !== 'All India' ? drawerFilters.City : undefined,
          brand: drawerFilters.Brand !== 'All' ? drawerFilters.Brand : undefined,
          sku: drawerFilters.SKU !== 'All' ? drawerFilters.SKU : undefined,
          channel: selectedChannel || 'All'
        };

        // Determine which pivot filter to apply based on the selected audience
        // Wait, drawerFilters already reflects the audience because it is synced in useEffect!
        // So we just send drawerFilters directly.

        console.log("[VisibilityTrendsDrawer] Fetching trend data:", params);
        const response = await axiosInstance.get('/visibility-analysis/kpi-trends', { params });

        if (cancelled) return;

        if (response.data?.timeSeries?.length > 0) {
          console.log("[VisibilityTrendsDrawer] Received", response.data.timeSeries.length, "points");
          setChartData(response.data.timeSeries);
        } else {
          console.log("[VisibilityTrendsDrawer] No data, using hardcoded fallback");
          setChartData([]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[VisibilityTrendsDrawer] Error fetching trends:", error);
          setChartData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Small delay to avoid blocking main UI
    const timeoutId = setTimeout(fetchTrendData, 500);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [view, range, selectedPlatform, timeStep, allTrendMeta.context.audience, open, drawerFilters, selectedChannel]);

  // ===================== FETCH COMPETITION DATA =====================
  // Fetch competition data when drawer opens (not just when Competition view is selected)
  // This ensures data is ready when user clicks Competition tab
  // IMPORTANT: Use selectedColumn (from main page filter click) NOT selectedPlatform (internal dropdown)
  useEffect(() => {
    // Wait for filter options to finish loading to avoid race conditions
    if (!open || filterOptions.loading) return;

    let cancelled = false;
    const fetchCompetitionData = async () => {
      console.log("[VisibilityTrendsDrawer] Starting fetchCompetitionData...");
      setCompetitionLoading(true);
      try {
        const params = {
          period: '1M',
          platform: drawerFilters.Platform !== 'All' ? drawerFilters.Platform : undefined,
          format: drawerFilters.Format !== 'All' ? drawerFilters.Format : undefined,
          location: drawerFilters.City !== 'All' && drawerFilters.City !== 'All India' ? drawerFilters.City : undefined,
          brand: drawerFilters.Brand !== 'All' ? drawerFilters.Brand : undefined,
          sku: drawerFilters.SKU !== 'All' ? drawerFilters.SKU : undefined,
          channel: selectedChannel || 'All'
        };

        console.log("[VisibilityTrendsDrawer] Fetching competition data with params:", params);
        const response = await axiosInstance.get('/visibility-analysis/competition', { params });

        if (cancelled) {
          console.log("[VisibilityTrendsDrawer] Request was cancelled, not setting state");
          return;
        }

        console.log("[VisibilityTrendsDrawer] API response received:", response.status);

        if (response.data) {
          console.log("[VisibilityTrendsDrawer] Received", response.data.brands?.length, "brands");
          setCompetitionData({
            brands: response.data.brands || [],
            skus: response.data.skus || []
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[VisibilityTrendsDrawer] Error fetching competition:", error);
        }
      } finally {
        if (!cancelled) setCompetitionLoading(false);
      }
    };

    // Add debounce delay to avoid duplicate calls when multiple dependencies change rapidly
    const timeoutId = setTimeout(fetchCompetitionData, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [selectedColumn, open, filterOptions.loading, drawerFilters, selectedChannel]);

  const trendPoints = useMemo(() => {
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

  const trendOption = useMemo(() => {
    // Only use fetched API data. If empty, UI will show 'No data is available'
    const dataSource = chartData;
    const xData = dataSource.map((p) => p.date);

    const series = trendMeta.metrics
      .filter((m) => activeMetrics.includes(m.id))
      .map((m) => ({
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
      }));

    return {
      grid: { left: 60, right: 80, top: 32, bottom: 40 },
      tooltip: { trigger: "axis" },
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
        },
        {
          type: "value",
          position: "right",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          min: 0,
          max: 100,
        },
      ],
      legend: { show: false },
      series,
    };
  }, [trendMeta, activeMetrics, trendPoints, chartData]);

  const competitionRows = useMemo(() => {
    // Only use fetched API data
    const baseRows = compTab === "Brands" ? (competitionData.brands || []) : (competitionData.skus || []);

    return baseRows.filter((r) =>
      search.trim()
        ? r.brand.toLowerCase().includes(search.toLowerCase())
        : true
    );
  }, [compMeta, compTab, search, competitionData]);

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
            data: trend[m.id] || [],
          });
        });
    });

    return {
      tooltip: { trigger: "axis" },
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

  // Use dynamic filter options from API, with fallbacks
  const PLATFORM_OPTIONS = filterOptions.platforms.length > 0 ? filterOptions.platforms : ["Blinkit", "Zepto", "Instamart", "BigBasket"];
  const FORMAT_OPTIONS = filterOptions.formats.length > 0 ? filterOptions.formats : ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"];
  const CITY_OPTIONS = filterOptions.cities.length > 0 ? filterOptions.cities : ["Delhi", "Mumbai", "Bangalore", "Chennai"];
  const BRAND_OPTIONS = filterOptions.brands.length > 0 ? filterOptions.brands : [];
  const SKU_OPTIONS = filterOptions.skus && filterOptions.skus.length > 0 ? filterOptions.skus : [];

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
        p: { xs: 1, md: 2 },
        zIndex: 1300,
        overflow: "auto",
      }}
    >
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          mt: { xs: 2, md: 4 },
          width: "min(1200px, 100%)",
          bgcolor: "white",
          borderRadius: 3,
          boxShadow: "0 24px 60px rgba(15,23,42,0.35)",
          p: { xs: 2, md: 3 },
          display: "flex",
          flexDirection: "column",
          gap: 2,
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
                px: { xs: 2, sm: 2.5 },
                py: { xs: 0.5, sm: 0.75 },
                fontSize: { xs: 13, sm: 14 },
                "&.Mui-selected": {
                  backgroundColor: "#0F172A",
                  color: "#fff",
                },
              },
            }}
          >
            <ToggleButton value="Trends">Trends</ToggleButton>
            <ToggleButton value="Competition">Competition</ToggleButton>
            {/* <ToggleButton value="compare skus">Compare SKUs</ToggleButton> */}
          </ToggleButtonGroup>

          <IconButton onClick={onClose} size="small" sx={{ color: "#64748b" }}>
            <X size={20} />
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
            label="City"
            value={drawerFilters.City}
            color={drawerFilters.City !== 'All' ? "#0ea5e9" : "#64748B"}
          />
          <SelectedFilterChip
            label="Brand"
            value={drawerFilters.Brand}
            color={drawerFilters.Brand !== 'All' ? "#0ea5e9" : "#64748B"}
          />
          <SelectedFilterChip
            label="Category"
            value={drawerFilters.Format}
            color={drawerFilters.Format !== 'All' ? "#0ea5e9" : "#64748B"}
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
                  title="City" 
                  value={drawerFilters.City} 
                  options={CITY_OPTIONS} 
                  onChange={(v) => setDrawerFilters(prev => ({...prev, City: v}))} 
                />
                <FilterDropdown 
                  title="Brand" 
                  value={drawerFilters.Brand} 
                  options={BRAND_OPTIONS} 
                  onChange={(v) => setDrawerFilters(prev => ({...prev, Brand: v}))} 
                />
                
                <Button 
                  onClick={() => setIsMoreFiltersOpen(prev => !prev)}
                  startIcon={<SlidersHorizontal size={14} />}
                  sx={{
                    ml: 1,
                    textTransform: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: isMoreFiltersOpen ? '#1D4ED8' : '#475569',
                    backgroundColor: isMoreFiltersOpen ? '#EFF6FF' : 'transparent',
                    border: '1px solid',
                    borderColor: isMoreFiltersOpen ? '#BFDBFE' : '#E2E8F0',
                    borderRadius: '999px',
                    px: 2,
                    py: 0.5,
                    minHeight: 32,
                    '&:hover': {
                      backgroundColor: isMoreFiltersOpen ? '#DBEAFE' : '#F1F5F9',
                      borderColor: isMoreFiltersOpen ? '#93C5FD' : '#CBD5E1',
                    }
                  }}
                >
                  More Filters
                </Button>
              </Box>

              {/* RANGE + TIMESTEP — stacked vertically */}
              <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Range</Typography>
                  <PillToggleGroup value={range} onChange={setRange} options={trendMeta.rangeOptions} />
                </Box>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step Size</Typography>
                  <PillToggleGroup value={timeStep} onChange={setTimeStep} options={trendMeta.timeSteps} />
                </Box>
              </Box>
            </Box>

            {/* CHART */}
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                border: "1px solid #E5E7EB",
                mt: 1,
                p: { xs: 1.5, md: 2.5 },
              }}
            >
              {/* Metric Row */}
              <Box
                display="flex"
                flexDirection="column"
                gap={2}
                mb={2}
              >
                <Box display="flex" gap={1.5} flexWrap="wrap">
                  {trendMeta.metrics.map((m) => (
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

                <Box>
                  {trendMeta.metrics.length > 4 && (
                    <Button
                      size="small"
                      variant="outlined"
                      endIcon={<ChevronDown size={14} />}
                      sx={{
                        textTransform: "none",
                        borderRadius: "999px",
                        borderColor: "#E2E8F0",
                        color: "#3b82f6",
                        backgroundColor: "#eff6ff",
                        fontSize: "0.75rem",
                        px: 2,
                        "&:hover": {
                          borderColor: "#3b82f6",
                          backgroundColor: "#dbeafe",
                        }
                      }}
                    >
                      +{trendMeta.metrics.length - 4} more
                    </Button>
                  )}
                </Box>
              </Box>

              {/* Chart */}
              <Box sx={{ height: 340 }}>
                {loading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%', justifyContent: 'center' }}>
                    <Skeleton variant="rectangular" width="100%" height={280} animation="wave" sx={{ borderRadius: 2 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Skeleton variant="text" width="15%" height={20} animation="wave" />
                      <Skeleton variant="text" width="15%" height={20} animation="wave" />
                      <Skeleton variant="text" width="15%" height={20} animation="wave" />
                      <Skeleton variant="text" width="15%" height={20} animation="wave" />
                    </Box>
                  </Box>
                ) : chartData.length === 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: 1 }}>
                    <Typography variant="body1" fontWeight={500}>No data is available</Typography>
                    <Typography variant="body2">Try adjusting your filters to find more results</Typography>
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
        {view === "Competition" && <VisibilityPlatformOverviewKpiShowcase selectedPlatform={selectedColumn || selectedPlatform || 'All'} period={range === "Custom" ? "1M" : range} timeStep={timeStep} />}

        {/* COMPARE SKUs VIEW */}
        {view === "compare skus" && (
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Typography variant="h6" fontWeight={600}>
                Compare SKUs
              </Typography>
            </Box>

            {/* RANGE + TIMESTEP */}
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              gap={2}
              flexWrap="wrap"
            >
              <PillToggleGroup
                value={range}
                onChange={setRange}
                options={trendMeta.rangeOptions}
              />

              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="body2">Time Step:</Typography>
                <PillToggleGroup
                  value={timeStep}
                  onChange={setTimeStep}
                  options={trendMeta.timeSteps}
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
                {selectedCompareSkus.length === 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: 1 }}>
                    <Typography variant="body1" fontWeight={500}>No data is available</Typography>
                    <Typography variant="body2">Try adjusting your filters to find more results</Typography>
                  </Box>
                ) : (
                  <ReactECharts
                    key={selectedCompareSkus.map((s) => s.id).join("-")}
                    option={compareOption}
                    notMerge={true}
                    style={{ height: "100%", width: "100%" }}
                  />
                )}
              </Box>
            </Paper>
          </Box>
        )}

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
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0F172A", display: "flex", alignItems: "center", gap: 1 }}>
                <Filter size={16} /> Additional Filters
              </Typography>
              <IconButton onClick={() => setIsMoreFiltersOpen(false)} size="small" sx={{ color: "#64748B", "&:hover": { bgcolor: "#F1F5F9" } }}>
                <X size={18} />
              </IconButton>
            </Box>

            <Box flex={1} overflow="auto" sx={{ display: "flex", flexDirection: "column", gap: 3, pr: 1 }}>
              <Box>
                <Typography variant="body2" fontWeight={600} mb={1} color="#475569">Category</Typography>
                <Select
                  fullWidth
                  size="small"
                  value={drawerFilters.Format}
                  onChange={(e) => setDrawerFilters(prev => ({...prev, Format: e.target.value}))}
                  sx={{
                    fontSize: "13px",
                    borderRadius: "8px",
                    backgroundColor: "#F8FAFC",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E2E8F0" },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#CBD5E1" },
                  }}
                >
                  <MenuItem value="All">All Categories</MenuItem>
                  {FORMAT_OPTIONS.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                </Select>
              </Box>

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
                          onClick={() => setDrawerFilters(prev => ({...prev, SKU: opt}))}
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
                    <Typography sx={{ p: 2, textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>No data is available</Typography>
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
                  minWidth: 90,
                  fontSize: '13px'
                }}
              >
                Apply
              </Button>
            </Box>
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
    </Box>
  );
}
