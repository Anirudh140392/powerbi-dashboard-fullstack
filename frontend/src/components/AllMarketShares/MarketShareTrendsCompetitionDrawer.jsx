import React, {
  useState,
  useMemo,
  useEffect,
  useContext,
} from "react";
import {
  Box,
  Typography,
  IconButton,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
  Popover,
  List,
  MenuItem,
  ListItemIcon,
  Checkbox,
  ListItemText
} from "@mui/material";
import { ChevronDown, X, Search, Filter, SlidersHorizontal, BarChart3, TrendingUp } from "lucide-react";
import ReactECharts from "echarts-for-react";
import axiosInstance from "../../api/axiosInstance";
import { FilterContext } from "../../utils/FilterContext";
import dayjs from "dayjs";

/**
 * ---------------------------------------------------------------------------
 * FILTER DROPDOWN COMPONENT
 * ---------------------------------------------------------------------------
 */
const FilterDropdown = ({ title, value, options, onChange, searchable = true, formatter }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [search, setSearch] = useState("");

  const handleClick = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => {
    setAnchorEl(null);
    setSearch("");
  };

  const filteredOptions = searchable 
    ? options.filter(o => String(o).toLowerCase().includes(search.toLowerCase()))
    : options;

  const isActive = value && value !== "All";

  const displayValue = formatter ? formatter(value) : value;

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
            {displayValue}
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
                <ListItemText primary={formatter ? formatter(opt) : opt} primaryTypographyProps={{ fontSize: '13px', fontWeight: value === opt ? 600 : 400 }} />
              </MenuItem>
            ))
          )}
        </List>
      </Popover>
    </>
  );
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

const MetricChip = ({ label, color, active, onClick, disabled }) => (
  <Box
    onClick={disabled ? undefined : onClick}
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 0.8,
      px: 1.5,
      py: 0.6,
      borderRadius: "999px",
      cursor: disabled ? "not-allowed" : "pointer",
      border: `1px solid ${disabled ? "#E5E7EB" : (active ? color : "#E5E7EB")}`,
      backgroundColor: disabled ? "#F3F4F6" : (active ? `${color}20` : "white"),
      color: disabled ? "#9CA3AF" : (active ? color : "#0f172a"),
      fontSize: "12px",
      fontWeight: 600,
      userSelect: "none",
      transition: "all 0.15s ease",
      opacity: disabled ? 0.6 : 1,
    }}
  >
    <Box
      sx={{
        width: 14,
        height: 14,
        borderRadius: 3,
        border: `2px solid ${disabled ? "#D1D5DB" : (active ? color : "#CBD5E1")}`,
        backgroundColor: disabled ? "transparent" : (active ? color : "transparent"),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: 10,
        lineHeight: 1,
      }}
    >
      {active && !disabled && "✓"}
    </Box>
    {label}
  </Box>
);

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

const capitalize = (s) => (s && s !== 'All') ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

const MarketShareTrendsCompetitionDrawer = ({ open, onClose, subCategory }) => {
  const { platform: globalPlatform, selectedCategory, timeStart, timeEnd } = useContext(FilterContext);

  const [range, setRange] = useState("1M");
  const [timeStep, setTimeStep] = useState("Daily");
  const [isTimeStepManuallySet, setIsTimeStepManuallySet] = useState(false);
  const [activeMetrics, setActiveMetrics] = useState(["MWMarketShare", "OverallSov", "PaidSov"]);
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ platforms: [], categories: [], brands: [], skus: [] });
  
  const [drawerFilters, setDrawerFilters] = useState({
    Platform: globalPlatform || "All",
    Category: selectedCategory || "All",
    Brand: "All",
    City: "All"
  });

  const metrics = [
    { id: "MWMarketShare", label: "Market Share %", color: "#2563eb", unit: "%" },
    { id: "OverallSov", label: "Overall SOV", color: "#8b5cf6", unit: "%" },
    { id: "PaidSov", label: "Paid SOV", color: "#f59e0b", unit: "%" },
    { id: "CategorySize", label: "Category Size", color: "#64748b", prefix: "₹", unit: " Cr" },
  ];

  useEffect(() => {
    if (open) {
      setDrawerFilters(prev => ({
        ...prev,
        Platform: (globalPlatform && globalPlatform !== 'All') ? globalPlatform.toLowerCase() : "All",
        Category: (selectedCategory && selectedCategory !== 'All') ? selectedCategory.toLowerCase() : "All",
        Brand: "All"
      }));
      // Reset manual override when opening drawer with a new global platform
      setIsTimeStepManuallySet(false);
      setTimeStep("Daily");
    }
  }, [open, globalPlatform, selectedCategory]);

  useEffect(() => {
    if (open) {
      fetchTrends();
      fetchFilterOptions();
    }
  }, [open, range, timeStep, drawerFilters]);

  const fetchTrends = async () => {
    setLoading(true);
    try {
      const isAmazon = drawerFilters.Platform?.toLowerCase() === 'amazon';
      
      const baseParams = {
        platform: drawerFilters.Platform === 'All' ? undefined : drawerFilters.Platform,
        category: drawerFilters.Category === 'All' ? undefined : drawerFilters.Category,
        brand: drawerFilters.Brand === 'All' ? undefined : drawerFilters.Brand,
        period: range,
        startDate: timeStart ? timeStart.format('YYYY-MM-DD') : undefined,
        endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : undefined
      };

      if (isAmazon && !isTimeStepManuallySet) {
        // Intelligent default for Amazon: Daily for non-Market Share, Monthly for Market Share
        const [dailyRes, monthlyRes] = await Promise.all([
          axiosInstance.get('/market-share/trends', { params: { ...baseParams, timeStep: 'Daily' } }),
          axiosInstance.get('/market-share/trends', { params: { ...baseParams, timeStep: 'Monthly' } })
        ]);

        const dailyData = dailyRes.data.timeSeries || [];
        const monthlyData = monthlyRes.data.timeSeries || [];

        // Map monthly data by Month-Year for lookup
        const monthlyMap = new Map();
        monthlyData.forEach(d => {
          // Extract Month and Year from "MMM YYYY" (e.g. "Jan 2023")
          monthlyMap.set(d.date, d);
        });

        const seenMonths = new Set();

        const mergedData = dailyData.map(dDaily => {
          // dDaily.date is "DD MMM YYYY" (e.g. "01 Jan 2023"). Extract "MMM YYYY"
          const parts = dDaily.date.split(' ');
          if (parts.length === 3) {
            const monthYear = `${parts[1]} ${parts[2]}`;
            if (!seenMonths.has(monthYear)) {
              seenMonths.add(monthYear);
              const mPoint = monthlyMap.get(monthYear);
              if (mPoint) {
                return {
                  ...dDaily,
                  MWMarketShare: mPoint.MWMarketShare,
                  CategorySize: mPoint.CategorySize
                };
              }
            }
          }
          // For non-first points of the month, leave them as null to prevent dropping to 0
          return {
            ...dDaily,
            MWMarketShare: null,
            CategorySize: null
          };
        });

        setTrendData(mergedData);
      } else {
        const response = await axiosInstance.get('/market-share/trends', { 
          params: { ...baseParams, timeStep: timeStep } 
        });
        setTrendData(response.data.timeSeries || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await axiosInstance.get('/market-share/competition-filter-options', {
        params: {
          platformFilter: drawerFilters.Platform,
          categoryFilter: drawerFilters.Category,
          brandFilter: drawerFilters.Brand
        }
      });
      
      const newOptions = {
        platforms: response.data.platforms || [],
        categories: response.data.categories || [],
        brands: response.data.brands || [],
        skus: response.data.skus || []
      };
      
      setFilterOptions(newOptions);

      // Validate current selections against new options
      setDrawerFilters(prev => {
        let updated = false;
        const next = { ...prev };

        // If Category is selected but not in the new list, reset to All
        if (next.Category !== "All" && !newOptions.categories.some(c => c.toLowerCase() === next.Category.toLowerCase())) {
          next.Category = "All";
          updated = true;
        }

        // If Brand is selected but not in the new list, reset to All
        if (next.Brand !== "All" && !newOptions.brands.some(b => b.toLowerCase() === next.Brand.toLowerCase())) {
          next.Brand = "All";
          updated = true;
        }

        return updated ? next : prev;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const chartOption = useMemo(() => {
    const series = metrics
      .filter(m => activeMetrics.includes(m.id))
      .map(m => ({
        name: m.label,
        type: 'line',
        yAxisIndex: m.id === "CategorySize" ? 1 : 0,
        smooth: true,
        connectNulls: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3 },
        itemStyle: { color: m.color },
        data: trendData.map(d => (d[m.id] !== undefined && d[m.id] !== null) ? d[m.id] : null)
      }));

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderWidth: 0,
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
        padding: 12,
        textStyle: { color: '#0f172a', fontWeight: 600 },
        formatter: (params) => {
          let res = `<div style="font-weight: 800; margin-bottom: 8px;">${params[0].name}</div>`;
          params.forEach(p => {
            const m = metrics.find(metric => metric.label === p.seriesName);
            const val = p.value;
            let displayVal;
            if (val === null || val === undefined) {
              displayVal = 'N/A';
            } else {
              displayVal = m.prefix ? `${m.prefix}${val}${m.unit}` : `${val}${m.unit}`;
            }
            res += `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${p.color};"></div>
              <div style="flex: 1;">${p.seriesName}</div>
              <div style="font-weight: 700;">${displayVal}</div>
            </div>`;
          });
          return res;
        }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: trendData.map(d => d.date),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontWeight: 600, fontSize: 11, margin: 15 }
      },
      yAxis: [
        {
          type: 'value',
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } },
          axisLabel: { 
            color: '#64748b', 
            fontWeight: 600, 
            fontSize: 11,
            formatter: '{value}%'
          }
        },
        {
          type: 'value',
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { 
            color: '#64748b', 
            fontWeight: 600, 
            fontSize: 11,
            formatter: '₹{value}Cr'
          }
        }
      ],
      series
    };
  }, [trendData, activeMetrics]);

  if (!open) return null;

  return (
    <Box sx={{
      position: "fixed", inset: 0, bgcolor: "rgba(15,23,42,0.32)",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      p: { xs: 1, md: 2 }, zIndex: 1300, overflow: "auto"
    }}>
      <Box sx={{
        position: "relative", overflow: "hidden", mt: { xs: 2, md: 4 },
        width: "min(1200px, 100%)", bgcolor: "white", borderRadius: 4,
        boxShadow: "0 24px 60px rgba(15,23,42,0.35)", p: { xs: 2, md: 4 },
        display: "flex", flexDirection: "column", gap: 3
      }}>
        {/* Top Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1.5}>
            <TrendingUp size={24} color="#0F172A" />
            <Typography variant="h5" fontWeight={900} color="#0F172A">Trend Analysis</Typography>
          </Box>

          <IconButton onClick={onClose} size="small" sx={{ bgcolor: '#f1f5f9', '&:hover': { bgcolor: '#e2e8f0' } }}>
            <X size={20} />
          </IconButton>
        </Box>

        {/* Effective Filters Bar */}
        <Box sx={{
          display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap",
          py: 1.5, px: 2.5, borderRadius: 3, backgroundColor: "#F8FAFC",
          border: "1px solid #E2E8F0"
        }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Filter size={16} color="#64748B" />
            <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Effective Filters:
            </Typography>
          </Box>
          <SelectedFilterChip label="Platform" value={capitalize(drawerFilters.Platform)} />
          <SelectedFilterChip label="Category" value={capitalize(drawerFilters.Category)} />
          <SelectedFilterChip label="Brand" value={capitalize(drawerFilters.Brand)} />
          <SelectedFilterChip label="Range" value={range} />
          
          <Button
            size="small"
            onClick={() => setDrawerFilters({ Platform: "All", Category: "All", Brand: "All", City: "All" })}
            sx={{ ml: 'auto', fontSize: '11px', textTransform: 'none', color: '#ef4444', fontWeight: 700 }}
          >
            Clear Drawer Filters
          </Button>
        </Box>

        <Box display="flex" flexDirection="column" gap={3}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-end">
            <Box display="flex" flexDirection="column" gap={2}>
              <Typography variant="h4" fontWeight={900} sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
                {capitalize(drawerFilters.Category)}
              </Typography>
              <Box display="flex" gap={1}>
                <FilterDropdown 
                  title="Platform" 
                  value={drawerFilters.Platform} 
                  options={filterOptions.platforms} 
                  onChange={(v) => {
                    setDrawerFilters(p => ({...p, Platform: v === 'All' ? 'All' : v.toLowerCase()}));
                    setIsTimeStepManuallySet(false); // Reset manual override when changing platform
                    setTimeStep("Daily");
                  }} 
                  formatter={capitalize}
                />
                <FilterDropdown 
                  title="Category" 
                  value={drawerFilters.Category} 
                  options={filterOptions.categories} 
                  onChange={(v) => setDrawerFilters(p => ({...p, Category: v === 'All' ? 'All' : v.toLowerCase()}))} 
                  formatter={capitalize}
                />
                <FilterDropdown 
                  title="Brand" 
                  value={drawerFilters.Brand} 
                  options={filterOptions.brands} 
                  onChange={(v) => setDrawerFilters(p => ({...p, Brand: v === 'All' ? 'All' : v.toLowerCase()}))} 
                  formatter={capitalize}
                />
              </Box>
            </Box>

            <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1.5}>
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>Range</Typography>
                <PillToggleGroup value={range} onChange={setRange} options={["1M", "3M", "6M", "1Y"]} />
              </Box>
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>Time Step</Typography>
                <PillToggleGroup 
                  value={timeStep} 
                  onChange={(val) => {
                    setIsTimeStepManuallySet(true);
                    setTimeStep(val);
                  }} 
                  options={["Daily", "Weekly", "Monthly"]} 
                />
              </Box>
            </Box>
          </Box>

          <Paper elevation={0} sx={{ borderRadius: 4, border: "1px solid #E5E7EB", p: 4, bgcolor: '#f8fafc' }}>
            <Box display="flex" gap={1.5} mb={4} flexWrap="wrap">
              {metrics.map(m => (
                <MetricChip
                  key={m.id} label={m.label} color={m.color}
                  active={activeMetrics.includes(m.id)}
                  onClick={() => setActiveMetrics(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                />
              ))}
            </Box>
            <Box sx={{ height: 450 }}>
              {loading ? <Skeleton variant="rectangular" height="100%" sx={{ borderRadius: 3 }} /> : (
                <ReactECharts option={chartOption} notMerge={true} style={{ height: '100%', width: '100%' }} />
              )}
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default MarketShareTrendsCompetitionDrawer;
