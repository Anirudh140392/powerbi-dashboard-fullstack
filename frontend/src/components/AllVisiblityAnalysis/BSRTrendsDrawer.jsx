import React, {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
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
  Select,
  MenuItem,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  CircularProgress,
  Drawer as MuiDrawer
} from "@mui/material";
import { ChevronDown, X, Search, Filter, SlidersHorizontal, Check } from "lucide-react";
import ReactECharts from "echarts-for-react";
import api from "../../api/axiosInstance";
import { FilterContext } from "../../utils/FilterContext";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);

/**
 * ---------------------------------------------------------------------------
 * FILTER DROPDOWN COMPONENT (Copied directly for exact UI match)
 * ---------------------------------------------------------------------------
 */
const FilterDropdown = ({ title, value, options, onChange, searchable = true }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tempSelection, setTempSelection] = useState(value);

  const handleClick = (e) => {
    setTempSelection(value);
    setSearch("");
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };
  
  const handleApply = () => {
    onChange(tempSelection);
    setOpen(false);
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

      <MuiDrawer 
        anchor="right" 
        open={open} 
        onClose={handleClose} 
        PaperProps={{ sx: { width: 400, maxWidth: '90vw', bgcolor: '#F8FAFC' } }}
      >
         <Box display="flex" flexDirection="column" height="100%">
            <Box p={3} bgcolor="white" borderBottom="1px solid #E2E8F0" display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={700} color="#0F172A">{title} Selection</Typography>
              <IconButton onClick={handleClose} size="small" sx={{ color: '#64748b' }}><X size={20}/></IconButton>
            </Box>
            
            <Box p={3} flex={1} overflow="auto" display="flex" flexDirection="column" gap={2.5}>
              {searchable && (
                <TextField 
                  fullWidth placeholder={`Search ${title}s...`} value={search} onChange={e => setSearch(e.target.value)}
                  InputProps={{ startAdornment: <Box mt={0.5} mr={1}><Search size={16} color="#94A3B8"/></Box> }}
                  size="small"
                  sx={{ bgcolor: 'white', '& fieldset': { borderRadius: '10px', borderColor: '#E2E8F0' }, '& input': { fontSize: '14px', py: 1.2 } }}
                />
              )}
              
              <List sx={{ bgcolor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', p: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                 <ListItem button onClick={() => setTempSelection('All')} sx={{ py: 1.5, borderBottom: '1px solid #F1F5F9', bgcolor: tempSelection === 'All' ? '#F0F9FF' : 'transparent' }}>
                   <ListItemIcon sx={{ minWidth: 36 }}>
                     <Checkbox 
                       checked={tempSelection === 'All'}
                       icon={<Box sx={{ width: 16, height: 16, borderRadius: '4px', border: '1.5px solid #CBD5E1' }} />}
                       checkedIcon={<Box sx={{ width: 16, height: 16, borderRadius: '4px', bgcolor: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="white" strokeWidth={3} /></Box>}
                       sx={{ p: 0 }}
                     />
                   </ListItemIcon>
                   <ListItemText primary={`All ${title}s`} primaryTypographyProps={{ fontSize: 14, fontWeight: tempSelection === 'All' ? 700 : 600, color: '#0F172A' }} />
                 </ListItem>

                 {filteredOptions.length === 0 ? (
                   <ListItem sx={{ py: 3, justifyContent: 'center' }}>
                      <Typography fontSize={13} color="#94A3B8">No results found.</Typography>
                   </ListItem>
                 ) : (
                   filteredOptions.map(opt => (
                     <ListItem button key={opt} onClick={() => setTempSelection(opt)} sx={{ py: 1.5, borderBottom: '1px solid #F1F5F9', bgcolor: tempSelection === opt ? '#F0F9FF' : 'transparent' }}>
                       <ListItemIcon sx={{ minWidth: 36 }}>
                         <Checkbox 
                           checked={tempSelection === opt}
                           icon={<Box sx={{ width: 16, height: 16, borderRadius: '4px', border: '1.5px solid #CBD5E1' }} />}
                           checkedIcon={<Box sx={{ width: 16, height: 16, borderRadius: '4px', bgcolor: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="white" strokeWidth={3} /></Box>}
                           sx={{ p: 0 }}
                         />
                       </ListItemIcon>
                       <ListItemText primary={opt} primaryTypographyProps={{ fontSize: 13, fontWeight: tempSelection === opt ? 600 : 500, color: '#334155' }} />
                     </ListItem>
                   ))
                 )}
              </List>
            </Box>

            <Box p={2.5} bgcolor="white" borderTop="1px solid #E2E8F0" display="flex" gap={2} justifyContent="flex-end">
               <Button onClick={handleClose} sx={{ textTransform: 'none', borderRadius: '10px', px: 3, fontWeight: 700, color: '#475569', border: '1px solid #E2E8F0', bgcolor: 'white', '&:hover': { bgcolor: '#F8FAFC' } }}>Cancel</Button>
               <Button variant="contained" onClick={handleApply} sx={{ textTransform: 'none', borderRadius: '10px', px: 4, fontWeight: 700, bgcolor: '#0F172A', '&:hover': { bgcolor: '#1E293B' }, boxShadow: 'none' }}>Apply Filters</Button>
            </Box>
         </Box>
      </MuiDrawer>
    </>
  );
};

/**
 * ---------------------------------------------------------------------------
 * UNIFIED MORE FILTERS DRAWER
 * ---------------------------------------------------------------------------
 */
const MoreFiltersDrawer = ({ open, onClose, filters, setFilters, filterOptions }) => {
  const [tempFilters, setTempFilters] = useState(filters);

  useEffect(() => {
    if (open) {
      setTempFilters(filters);
    }
  }, [open, filters]);

  const handleApply = () => {
    setFilters(prev => ({ ...prev, ...tempFilters }));
    onClose();
  };

  const FilterSection = ({ title, field, options }) => {
    const [search, setSearch] = useState("");
    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

    return (
      <Box mb={4}>
        <Typography variant="subtitle2" sx={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
          {title}
        </Typography>
        <TextField 
          fullWidth placeholder={`Search ${title}s...`} value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Box mt={0.5} mr={1}><Search size={14} color="#94A3B8"/></Box> }}
          size="small"
          sx={{ mb: 1.5, bgcolor: 'white', '& fieldset': { borderRadius: '8px', borderColor: '#E2E8F0' }, '& input': { fontSize: '13px', py: 1 } }}
        />
        <List sx={{ bgcolor: 'white', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', p: 0, maxHeight: 220, overflowY: 'auto' }}>
           <ListItem button onClick={() => setTempFilters(prev => ({...prev, [field]: 'All'}))} sx={{ py: 1, borderBottom: '1px solid #F1F5F9', bgcolor: tempFilters[field] === 'All' ? '#F0F9FF' : 'transparent' }}>
             <ListItemIcon sx={{ minWidth: 32 }}>
               <Checkbox 
                 checked={tempFilters[field] === 'All'}
                 icon={<Box sx={{ width: 16, height: 16, borderRadius: '4px', border: '1.5px solid #CBD5E1' }} />}
                 checkedIcon={<Box sx={{ width: 16, height: 16, borderRadius: '4px', bgcolor: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="white" strokeWidth={3} /></Box>}
                 sx={{ p: 0 }}
               />
             </ListItemIcon>
             <ListItemText primary={`All ${title}s`} primaryTypographyProps={{ fontSize: 13, fontWeight: tempFilters[field] === 'All' ? 700 : 600, color: '#0F172A' }} />
           </ListItem>

           {filtered.length === 0 ? (
             <ListItem sx={{ py: 2, justifyContent: 'center' }}>
                <Typography fontSize={12} color="#94A3B8">No results found.</Typography>
             </ListItem>
           ) : (
             filtered.map(opt => (
               <ListItem button key={opt} onClick={() => setTempFilters(prev => ({...prev, [field]: opt}))} sx={{ py: 1, borderBottom: '1px solid #F1F5F9', bgcolor: tempFilters[field] === opt ? '#F0F9FF' : 'transparent' }}>
                 <ListItemIcon sx={{ minWidth: 32 }}>
                   <Checkbox 
                     checked={tempFilters[field] === opt}
                     icon={<Box sx={{ width: 16, height: 16, borderRadius: '4px', border: '1.5px solid #CBD5E1' }} />}
                     checkedIcon={<Box sx={{ width: 16, height: 16, borderRadius: '4px', bgcolor: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="white" strokeWidth={3} /></Box>}
                     sx={{ p: 0 }}
                   />
                 </ListItemIcon>
                 <ListItemText primary={opt} primaryTypographyProps={{ fontSize: 13, fontWeight: tempFilters[field] === opt ? 600 : 500, color: '#334155' }} />
               </ListItem>
             ))
           )}
        </List>
      </Box>
    );
  };

  return (
    <MuiDrawer 
      anchor="right" 
      open={open} 
      onClose={onClose} 
      sx={{ zIndex: 1400 }}
      PaperProps={{ sx: { width: 420, maxWidth: '100vw', bgcolor: '#F8FAFC' } }}
    >
      <Box display="flex" flexDirection="column" height="100%">
        <Box p={3} bgcolor="white" borderBottom="1px solid #E2E8F0" display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={800} color="#0F172A">More Filters</Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: '#64748b' }}><X size={20}/></IconButton>
        </Box>
        
        <Box p={3} flex={1} overflow="auto" display="flex" flexDirection="column">
          <FilterSection title="Category" field="Format" options={filterOptions.formats.length > 0 ? filterOptions.formats : ['All']} />
          <FilterSection title="Brand" field="Brand" options={filterOptions.brands.length > 0 ? filterOptions.brands : ['All']} />
          <FilterSection title="SKU" field="SKU" options={filterOptions.skus.length > 0 ? filterOptions.skus : ['All']} />
        </Box>

        <Box p={2.5} bgcolor="white" borderTop="1px solid #E2E8F0" display="flex" gap={2} justifyContent="flex-end">
           <Button onClick={onClose} sx={{ textTransform: 'none', borderRadius: '10px', px: 3, fontWeight: 700, color: '#475569', border: '1px solid #E2E8F0', bgcolor: 'white', '&:hover': { bgcolor: '#F8FAFC' } }}>Cancel</Button>
           <Button variant="contained" onClick={handleApply} sx={{ textTransform: 'none', borderRadius: '10px', px: 4, fontWeight: 700, bgcolor: '#0F172A', '&:hover': { bgcolor: '#1E293B' }, boxShadow: 'none' }}>Apply Filters</Button>
        </Box>
      </Box>
    </MuiDrawer>
  );
};

const MetricChip = ({ label, color, active, onClick }) => {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex", alignItems: "center", gap: 0.8,
        px: 1.5, py: 0.6, borderRadius: "999px", cursor: "pointer",
        border: `1px solid ${active ? color : "#E5E7EB"}`,
        backgroundColor: active ? `${color}20` : "white",
        color: active ? color : "#0f172a",
        fontSize: "12px", fontWeight: 600, userSelect: "none",
        transition: "all 0.15s ease",
      }}
    >
      <Box
        sx={{
          width: 14, height: 14, borderRadius: 3,
          border: `2px solid ${active ? color : "#CBD5E1"}`,
          backgroundColor: active ? color : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontSize: 10, lineHeight: 1,
        }}
      >
        {active && "✓"}
      </Box>
      {label}
    </Box>
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

const SelectedFilterChip = ({ label, value, color = "#3B82F6" }) => (
  <Box
    sx={{
      display: "inline-flex", alignItems: "center", gap: 1,
      px: 1.5, py: 0.5, borderRadius: "999px",
      border: "1px solid #E2E8F0", backgroundColor: "#F8FAFC",
      fontSize: "12px", fontWeight: 500,
    }}
  >
    <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600 }}>{label}:</Typography>
    <Typography variant="caption" sx={{ color: color, fontWeight: 700 }}>{value}</Typography>
  </Box>
);

// Constants for BSR
const BSR_KPI_KEYS = [
    { id: 'products_in_bsr', label: 'Products in BSR', color: '#6366f1', unit: '' },
    { id: 'avg_position', label: 'Avg. Position', color: '#14b8a6', unit: '' },
    { id: 'bsr_sos_pct', label: 'BSR SOS %', color: '#f43f5e', unit: '%' },
    { id: 'top_10_count', label: 'Top 10 BSR Products', color: '#f59e0b', unit: '' },
];

export default function BSRTrendsDrawer({
  open = true,
  onClose = () => {},
  selectedCategory = 'All'
}) {
  const { 
    platform: globalPlatform, selectedBrand, selectedLocation, selectedChannel, timeStart, timeEnd 
  } = useContext(FilterContext);

  const [view, setView] = useState("Trends");
  const [range, setRange] = useState("1M");
  const [timeStep, setTimeStep] = useState("Daily");
  const [activeMetrics, setActiveMetrics] = useState([BSR_KPI_KEYS[0].id]);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);

  // ===================== DYNAMIC FILTER OPTIONS STATE =====================
  const [filterOptions, setFilterOptions] = useState({
    platforms: [],
    formats: [],
    cities: [],
    brands: [],
    skus: [],
    loading: true
  });

  // ===================== FETCH FILTER OPTIONS =====================
  useEffect(() => {
    if (!open) return;

    const fetchFilterOptions = async () => {
      try {
        const [platformsRes, formatsRes, citiesRes, brandsRes, skusRes] = await Promise.all([
          api.get('/visibility-analysis/filter-options', { params: { filterType: 'platforms', channel: selectedChannel || 'All' } }),
          api.get('/visibility-analysis/filter-options', { params: { filterType: 'formats', channel: selectedChannel || 'All' } }),
          api.get('/visibility-analysis/filter-options', { params: { filterType: 'cities', channel: selectedChannel || 'All' } }),
          api.get('/visibility-analysis/filter-options', { params: { filterType: 'brands', channel: selectedChannel || 'All', ownBrandsOnly: true } }),
          api.get('/visibility-analysis/filter-options', { params: { filterType: 'skus', channel: selectedChannel || 'All', ownBrandsOnly: true } })
        ]);

        const platforms = (platformsRes.data?.options || []).filter(p => p !== 'All');
        const formats = (formatsRes.data?.options || []).filter(f => f !== 'All');
        const brands = (brandsRes.data?.options || []).filter(b => b !== 'All');
        const skus = (skusRes.data?.options || []).filter(s => s !== 'All');
        const cities = (citiesRes.data?.options || []).filter(c => c !== 'All');

        setFilterOptions({
          platforms,
          formats,
          cities,
          brands,
          skus,
          loading: false
        });
      } catch (error) {
        console.error("[BSRTrendsDrawer] Error fetching filter options:", error);
        setFilterOptions(prev => ({ ...prev, loading: false }));
      }
    };

    fetchFilterOptions();
  }, [open, selectedChannel]);

  // Filters within drawer
  const [drawerFilters, setDrawerFilters] = useState({
    Platform: globalPlatform || "All",
    Format: selectedCategory || "All",
    Brand: selectedBrand || "All",
    City: selectedLocation || "All",
    Channel: selectedChannel || "All",
    SKU: "All"
  });

  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState({ days: [], categories: {} });

  useEffect(() => {
     if (open && selectedCategory) {
        setDrawerFilters(prev => ({ ...prev, Format: selectedCategory }));
     }
  }, [open, selectedCategory]);

  const RANGE_TO_DAYS = {
    "1M": 30,
    "3M": 90,
    "6M": 180,
  };

  const getEffectiveDates = () => {
    if (range === 'Custom' || !timeEnd) return { start: timeStart, end: timeEnd };
    const days = RANGE_TO_DAYS[range] || 30;
    return {
      start: timeEnd.subtract(days, 'day'),
      end: timeEnd
    };
  };

  useEffect(() => {
    if (!open || !timeStart || !timeEnd) return;
    const fetchTrends = async () => {
        setLoading(true);
        try {
            const { start, end } = getEffectiveDates();
            const res = await api.get('/visibility-analysis/bsr-trends', {
                params: {
                    platform: drawerFilters.Platform,
                    brand: drawerFilters.Brand,
                    city: drawerFilters.City,
                    format: drawerFilters.Format,
                    channel: drawerFilters.Channel,
                    sku: drawerFilters.SKU,
                    startDate: start.format('YYYY-MM-DD'),
                    endDate: end.format('YYYY-MM-DD'),
                }
            });
            setTrendData(res.data || { days: [], categories: {} });
        } catch (err) {
            console.error('[BSRTrendsDrawer] Error:', err);
        } finally {
            setLoading(false);
        }
    };
    fetchTrends();
  }, [open, drawerFilters, timeStart, timeEnd, range]);

  // Transform data for ECharts based on selected category lines & metrics
  const chartOption = useMemo(() => {
    const { days, categories } = trendData;
    if (!days || days.length === 0) return {};

    const aggregatedCategoryData = Object.values(categories)[0];
    if (!aggregatedCategoryData || !aggregatedCategoryData.timeSeries) return {};

    // Form flat daily data array
    const dailyDataRaw = days.map(d => {
        const dayItem = aggregatedCategoryData.timeSeries.find(ts => ts.date === d);
        return { date: d, ...dayItem };
    });

    let groupedData = [];
    if (timeStep === 'Weekly') {
         const weeks = {};
         dailyDataRaw.forEach(item => {
             const wStart = dayjs(item.date).startOf('isoWeek').format('YYYY-MM-DD');
             if (!weeks[wStart]) weeks[wStart] = { date: wStart, count: 0, sum: {} };
             weeks[wStart].count += 1;
             activeMetrics.forEach(m => {
                 weeks[wStart].sum[m] = (weeks[wStart].sum[m] || 0) + (item[m] || 0);
             });
         });
         groupedData = Object.keys(weeks).sort().map(w => {
             const res = { date: w };
             activeMetrics.forEach(m => {
                 res[m] = weeks[w].sum[m] / weeks[w].count;
             });
             return res;
         });
    } else if (timeStep === 'Monthly') {
         const months = {};
         dailyDataRaw.forEach(item => {
             const mStart = dayjs(item.date).startOf('month').format('YYYY-MM-DD');
             if (!months[mStart]) months[mStart] = { date: mStart, count: 0, sum: {} };
             months[mStart].count += 1;
             activeMetrics.forEach(m => {
                 months[mStart].sum[m] = (months[mStart].sum[m] || 0) + (item[m] || 0);
             });
         });
         groupedData = Object.keys(months).sort().map(m => {
             const res = { date: m };
             activeMetrics.forEach(met => {
                 res[met] = months[m].sum[met] / months[m].count;
             });
             return res;
         });
    } else {
         groupedData = dailyDataRaw;
    }

    const xAxisLabels = groupedData.map(d => {
        const [y,m,day] = d.date.split('-');
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        if (timeStep === 'Monthly') return `${monthNames[parseInt(m)-1]} ${y}`;
        if (timeStep === 'Weekly') return `Wk of ${day} ${monthNames[parseInt(m)-1]}`;
        return `${day} ${monthNames[parseInt(m)-1]}`;
    });

    const series = [];

    if (aggregatedCategoryData && aggregatedCategoryData.timeSeries) {
        activeMetrics.forEach((metricId) => {
            const metricMeta = BSR_KPI_KEYS.find(m => m.id === metricId);
            const dataPts = groupedData.map(item => item[metricId] || 0);

            series.push({
                name: metricMeta.label,
                type: 'line',
                smooth: true,
                symbol: "circle",
                symbolSize: timeStep !== 'Daily' ? 8 : 4,
                lineStyle: { width: 2 },
                itemStyle: { color: metricMeta.color },
                data: dataPts,
                yAxisIndex: metricId === 'bsr_sos_pct' ? 1 : 0,
                tooltip: {
                    valueFormatter: (value) => `${Number(value).toFixed(1)}${metricMeta.unit}`
                }
            });
        });
    }

    return {
        tooltip: {
            trigger: "axis",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderColor: "#E2E8F0",
            borderWidth: 1,
            textStyle: { color: "#1E293B", fontSize: 12 },
            padding: [10, 15],
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        },
        legend: {
            bottom: 0,
            type: "scroll",
            itemGap: 20,
            itemWidth: 12,
            itemHeight: 12,
            textStyle: { color: "#64748b", fontSize: 12, fontWeight: 500 },
        },
        grid: { left: 40, right: 30, top: 20, bottom: 60, containLabel: true },
        xAxis: {
            type: "category",
            boundaryGap: false,
            data: xAxisLabels,
            axisLine: { lineStyle: { color: "#E2E8F0" } },
            axisLabel: { color: "#64748B", fontSize: 11, margin: 12 },
            splitLine: { show: false },
        },
        yAxis: [
            {
                type: "value",
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: "#94A3B8", fontSize: 11 },
                splitLine: { lineStyle: { color: "#F1F5F9", type: "dashed" } },
            },
            {
                type: "value",
                position: "right",
                show: activeMetrics.includes('bsr_sos_pct'),
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: "#94A3B8", fontSize: 11, formatter: "{value}%" },
                splitLine: { show: false },
            }
        ],
        series,
        animationDuration: 1000,
    animationEasing: "cubicOut",
  };
}, [trendData, activeMetrics, timeStep]);

  if (!open) return null;

  return (
    <Box
      sx={{
        position: "fixed", inset: 0, bgcolor: "rgba(15,23,42,0.32)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        p: { xs: 1, md: 2 }, zIndex: 1300, overflow: "auto",
      }}
    >
      <Box
        sx={{
          position: "relative", overflow: "hidden", mt: { xs: 2, md: 4 },
          width: "min(1200px, 100%)", bgcolor: "white", borderRadius: 3,
          boxShadow: "0 24px 60px rgba(15,23,42,0.35)", p: { xs: 2, md: 3 },
          display: "flex", flexDirection: "column", gap: 2,
        }}
      >
        {/* Header row */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <ToggleButtonGroup
            exclusive
            value={view}
            onChange={(_, v) => v && setView(v)}
            sx={{
              backgroundColor: "#F3F4F6", borderRadius: "999px", p: "3px",
              "& .MuiToggleButton-root": {
                textTransform: "none", border: "none", borderRadius: "999px",
                px: { xs: 2, sm: 2.5 }, py: { xs: 0.5, sm: 0.75 }, fontSize: { xs: 13, sm: 14 },
                "&.Mui-selected": { backgroundColor: "#0F172A", color: "#fff" },
              },
            }}
          >
            <ToggleButton value="Trends">Trends</ToggleButton>
          </ToggleButtonGroup>

          <IconButton onClick={onClose} size="small" sx={{ color: "#64748b" }}>
            <X size={20} />
          </IconButton>
        </Box>

        {/* EFFECTIVE FILTERS SUMMARY BAR */}
        <Box
          sx={{
            display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap",
            py: 1.2, px: 2, borderRadius: "12px", backgroundColor: "#F8FAFC",
            border: "1px solid #E2E8F0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <Filter size={14} color="#64748B" />
            <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Effective Filters:
            </Typography>
          </Box>
          <SelectedFilterChip label="Platform" value={drawerFilters.Platform} color={drawerFilters.Platform !== 'All' ? "#0ea5e9" : "#64748B"} />
          <SelectedFilterChip label="Brand" value={drawerFilters.Brand} color={drawerFilters.Brand !== 'All' ? "#0ea5e9" : "#64748B"} />
          <SelectedFilterChip label="Category" value={drawerFilters.Format} color={drawerFilters.Format !== 'All' ? "#0ea5e9" : "#64748B"} />
          <SelectedFilterChip label="SKU" value={drawerFilters.SKU} color={drawerFilters.SKU !== 'All' ? "#0ea5e9" : "#64748B"} />
          <SelectedFilterChip label="Date" value={range} />
        </Box>

        {/* TRENDS VIEW */}
        {view === "Trends" && (
          <Box display="flex" flexDirection="column" gap={0}>
            <Typography variant="h5" fontWeight={800} sx={{ color: '#0f172a', lineHeight: 1.2, mb: 2 }}>
              {drawerFilters.Format === 'All' ? 'All Categories trends' : `${drawerFilters.Format} trends`}
            </Typography>

            {/* HEADER FILTER CONTAINER */}
            <Box display="flex" flexDirection="column" gap={2} mb={3}>
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Button 
                    onClick={() => setIsMoreFiltersOpen(true)}
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
                  <MoreFiltersDrawer 
                    open={isMoreFiltersOpen} 
                    onClose={() => setIsMoreFiltersOpen(false)} 
                    filters={drawerFilters} 
                    setFilters={setDrawerFilters} 
                    filterOptions={filterOptions} 
                  />
                </Box>

                <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Range</Typography>
                    <PillToggleGroup value={range} onChange={setRange} options={["Custom", "1M", "3M", "6M"]} />
                  </Box>
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step Size</Typography>
                    <PillToggleGroup value={timeStep} onChange={setTimeStep} options={["Daily", "Weekly", "Monthly"]} />
                  </Box>
                </Box>
              </Box>


            </Box>

            {/* CHART */}
            <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid #E5E7EB", mt: 1, p: { xs: 1.5, md: 2.5 } }}>
              <Box display="flex" flexDirection="column" gap={2} mb={2}>
                <Box display="flex" gap={1.5} flexWrap="wrap">
                  {BSR_KPI_KEYS.map((m) => (
                    <MetricChip
                      key={m.id} label={m.label} color={m.color} active={activeMetrics.includes(m.id)}
                      onClick={() => setActiveMetrics((prev) => prev.includes(m.id) && prev.length > 1 ? prev.filter((x) => x !== m.id) : [...new Set([...prev, m.id])])}
                    />
                  ))}
                </Box>
              </Box>

              <Box sx={{ width: "100%", height: 380, position: "relative" }}>
                 {loading ? (
                    <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
                        <CircularProgress />
                    </Box>
                 ) : (
                    <ReactECharts
                        option={chartOption}
                        style={{ height: "100%", width: "100%" }}
                        notMerge={true}
                        lazyUpdate={true}
                    />
                 )}
              </Box>
            </Paper>
          </Box>
        )}
      </Box>
    </Box>
  );
}
