import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ChevronDown, 
    X, 
    Plus, 
    TrendingUp, 
    TrendingDown, 
    Package,
    Scale,
    Award,
    Filter,
    Calendar,
    Loader2,
    RefreshCw,
    AlertTriangle
} from 'lucide-react';
import dayjs from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { cn } from '../../../lib/utils';
import AddSkuDrawer from './AddSkuDrawer';
import CompareSkuFilterModal from './CompareSkuFilterModal';
import axiosInstance from '../../../api/axiosInstance';
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    Legend,
    Area
} from 'recharts';

const CompareSkuMatrix = ({ onClose }) => {
    const navigate = useNavigate();

    // Filter and Date states
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
    const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
    const [startDate, setStartDate] = useState(dayjs().subtract(1, 'month'));
    const [endDate, setEndDate] = useState(dayjs());
    const [dateRange, setDateRange] = useState({ minDate: null, maxDate: null });
    const [isLoadingDate, setIsLoadingDate] = useState(true);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
    const [appliedFilters, setAppliedFilters] = useState({
        brands: [],
        categories: [],
        platforms: [],
        skus: [],
        dateFrom: null,
        dateTo: null,
        kpis: ['offtakes', 'availability', 'shareOfVolume', 'ad_sov', 'organic_sos', 'spend', 'conversion', 'marketShare', 'categorySize'],
    });
    
    // Full metrics list — sections and KPI items
    const allMetricsList = [
        { id: 'offtake', label: 'Offtake', section: null, kpiKey: 'offtakes' },
        { id: 'est_cat_share', label: 'Cat Share', section: null, kpiKey: 'categorySize' },
        { id: 'availability', label: 'Availability', type: 'section' },
        { id: 'ds_listing', label: 'DS Listing%', section: 'availability', kpiKey: 'availability' },
        { id: 'visibility', label: 'Visibility', type: 'section' },
        { id: 'overall_sov', label: 'Overall SOS', section: 'visibility', kpiKey: 'shareOfVolume' },
        { id: 'ad_sov', label: 'Ad. SOS', section: 'visibility', kpiKey: 'ad_sov' },
        { id: 'organic_sos', label: 'Organic SOS', section: 'visibility', kpiKey: 'organic_sos' },
        { id: 'discounting', label: 'Discounting', type: 'section' },
        { id: 'wt_discount', label: 'Wt. Discount%', section: 'discounting', kpiKey: 'discounting' },
        { id: 'wt_ppu', label: 'Wt. PPU(x100)', section: 'discounting', kpiKey: 'ppu' },
        { id: 'spend', label: 'Spend', section: null, kpiKey: 'spend' },
        { id: 'inorg_sales', label: 'Inorg Sales', section: null, kpiKey: 'inorgSales' },
        { id: 'conversion', label: 'Conversion', section: null, kpiKey: 'conversion' },
        { id: 'market_share', label: 'Est Market share', section: null, kpiKey: 'marketShare' },
        { id: 'cpm', label: 'CPM', section: null, kpiKey: 'cpm' },
        { id: 'cpc', label: 'CPC', section: null, kpiKey: 'cpc' },
    ];

    // Dynamic metricsList: filter based on applied KPI selection
    const metricsList = allMetricsList.filter(m => {
        if (m.type === 'section') return true; // Keep section headers, will be filtered later
        if (!appliedFilters.kpis || appliedFilters.kpis.length === 0) return true; // Show all if no filter
        return appliedFilters.kpis.some(k => m.kpiKey === k);
    });

    // Start with an empty list so the user must add SKUs
    const initialSkus = [];

    const [skus, setSkus] = useState(initialSkus);
    const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
    const [activeView, setActiveView] = useState('cross-sku');
    const metricDropdownRef = useRef(null);
    
    // Trend Data State
    const [realTrendData, setRealTrendData] = useState([]);
    const [trendSkus, setTrendSkus] = useState([]);
    const [trendSummary, setTrendSummary] = useState({ avgDsListing: '0', weightedDiscount: '0', catShare: '0' });
    const [isLoadingTrends, setIsLoadingTrends] = useState(false);

    // Error states for retry
    const [initError, setInitError] = useState(false);
    const [metricsError, setMetricsError] = useState(false);
    const [trendError, setTrendError] = useState(false);

    const colorPalette = [
        '#3b82f6', // blue-500
        '#818cf8', // indigo-400
        '#2dd4bf', // teal-400
        '#f59e0b', // amber-500
        '#ef4444', // red-500
        '#8b5cf6', // violet-500
        '#ec4899', // pink-500
        '#10b981', // emerald-500
    ];
    
    // Trend Data Mockup (Old Mock)
    const mockTrendData = [
        { date: "18 Feb'26", v1: 0, v2: 0, s: 0 },
        // ... rest of mock removed
    ];
    
    // Metric selection state - synchronize with metricsList when it changes
    const [selectedMetricIds, setSelectedMetricIds] = useState(['offtake']); // Single select initialized
    const [isMetricDropdownOpen, setIsMetricDropdownOpen] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ platforms: [], categories: [], brands: [], locations: [] });

    // Fetch date range and filter options on mount
    useEffect(() => {
        const initData = async () => {
            try {
                setIsLoadingDate(true);
                setInitError(false);
                const [dateRes, filtersRes] = await Promise.all([
                    axiosInstance.get('/watchtower/compare-sku/date-range').catch(e => ({ data: {} })),
                    axiosInstance.get('/watchtower/compare-sku/filters').catch(e => ({ data: { platforms: [], categories: [], brands: [], locations: [] } }))
                ]);
                
                const dateData = dateRes.data || {};
                const filterData = filtersRes.data || { platforms: [], categories: [], brands: [], locations: [] };
                
                if (filterData) {
                    setFilterOptions({
                        platforms: (filterData.platforms || []).filter(p => p && p.name).map(p => ({ id: p.id, name: String(p.name) })),
                        categories: (filterData.categories || []).filter(c => c && c.name).map(c => ({ id: c.id, name: String(c.name) })),
                        brands: (filterData.brands || []).filter(b => b && b.name).map(b => ({ id: b.id, name: String(b.name) })),
                        locations: (filterData.locations || []).filter(l => l && l.name).map(l => ({ id: l.id, name: String(l.name) }))
                    });
                }

                if (dateData.maxDate) {
                    const maxD = dayjs(dateData.maxDate);
                    setEndDate(maxD);
                    setStartDate(maxD.subtract(1, 'month'));
                    setDateRange({
                        minDate: dateData.minDate ? dayjs(dateData.minDate) : null,
                        maxDate: maxD,
                    });
                }
            } catch (e) {
                console.error('[CompareSkuMatrix] Error initializing data:', e);
                setInitError(true);
            } finally {
                setIsLoadingDate(false);
            }
        };
        initData();
    }, []);

    // Fetch metrics for SKUs when date or filters change
    const fetchSkuMetrics = useCallback(async (skuNames, skuPlatforms = []) => {
        if (!skuNames || skuNames.length === 0) return {};
        try {
            setIsLoadingMetrics(true);
            setMetricsError(false);
            const params = new URLSearchParams();
            skuNames.forEach(name => params.append('skuNames[]', name));
            if (skuPlatforms.length > 0) skuPlatforms.forEach(p => params.append('skuPlatforms[]', p || ''));
            params.set('startDate', startDate.format('YYYY-MM-DD'));
            params.set('endDate', endDate.format('YYYY-MM-DD'));
            if (appliedFilters.platforms?.length) appliedFilters.platforms.forEach(p => params.append('platforms[]', p));
            if (appliedFilters.brands?.length) appliedFilters.brands.forEach(b => params.append('brands[]', b));
            if (appliedFilters.categories?.length) appliedFilters.categories.forEach(c => params.append('categories[]', c));
            if (appliedFilters.locations?.length) appliedFilters.locations.forEach(l => params.append('locations[]', l));
            
            const { data } = await axiosInstance.get(`/watchtower/compare-sku/metrics?${params.toString()}`);
            return data;
        } catch (e) {
            console.error('[CompareSkuMatrix] Error fetching SKU metrics:', e);
            setMetricsError(true);
            return { skus: [] };
        } finally {
            setIsLoadingMetrics(false);
        }
    }, [startDate, endDate, appliedFilters]);

    // Refetch existing SKUs when date or filters change
    useEffect(() => {
        if (skus.length === 0) return;
        let isMounted = true;
        
        const updateMetrics = async () => {
            const skuNames = skus.map(s => s.name);
            const skuPlatforms = skus.map(s => s.platform || '');
            const metricsData = await fetchSkuMetrics(skuNames, skuPlatforms);
            if (!isMounted) return;
            
            const metricsMap = new Map((metricsData?.skus || []).map(s => [s.name, s.metrics]));
            
            setSkus(prevSkus => prevSkus.map(sku => {
                const dbMetrics = metricsMap.get(sku.name) || {};
                return {
                    ...sku,
                    metrics: {
                        offtake: dbMetrics.offtake || { value: '--', delta: 0, deltaAbs: '0' },
                        est_cat_share: dbMetrics.est_cat_share || { value: '--', delta: 0, deltaAbs: '0' },
                        ds_listing: dbMetrics.ds_listing || dbMetrics.availability || { value: '--', delta: 0, deltaAbs: '0' },
                        overall_sov: dbMetrics.overall_sov || { value: '--', delta: 0, deltaAbs: '0' },
                        ad_sov: dbMetrics.ad_sov || { value: '--', delta: 0, deltaAbs: '0' },
                        organic_sos: dbMetrics.organic_sos || { value: '--', delta: 0, deltaAbs: '0' },
                        wt_discount: dbMetrics.wt_discount || { value: '--', delta: 0, deltaAbs: '0' },
                        wt_ppu: dbMetrics.wt_ppu || { value: '--', delta: 0, deltaAbs: '0' },
                        spend: dbMetrics.spend || { value: '--', delta: 0, deltaAbs: '0' },
                        inorg_sales: dbMetrics.inorg_sales || { value: '--', delta: 0, deltaAbs: '0' },
                        conversion: dbMetrics.conversion || { value: '--', delta: 0, deltaAbs: '0' },
                        market_share: dbMetrics.market_share || { value: '--', delta: 0, deltaAbs: '0' },
                        cpm: dbMetrics.cpm || { value: '--', delta: 0, deltaAbs: '0' },
                        cpc: dbMetrics.cpc || { value: '--', delta: 0, deltaAbs: '0' },
                    }
                };
            }));
        };
        
        updateMetrics();
        
        return () => { isMounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate, appliedFilters, fetchSkuMetrics]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (metricDropdownRef.current && !metricDropdownRef.current.contains(event.target)) {
                setIsMetricDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleMetric = (id) => {
        setSelectedMetricIds([id]); // Single select logic
        setIsMetricDropdownOpen(false); // Auto close dropdown on select
    };

    const handleRemove = (idToRemove) => {
        setSkus(prev => prev.filter(sku => sku.id !== idToRemove));
    };

    // ═══════════════════════════════════════════════════════════════════
    // Trend Data Fetching
    // ═══════════════════════════════════════════════════════════════════
    const fetchTrendData = useCallback(async () => {
        if (activeView !== 'trends') return;
        
        try {
            setIsLoadingTrends(true);
            setTrendError(false);
            const activeMetricId = selectedMetricIds.length > 0 ? selectedMetricIds[0] : 'offtake';
            const { data } = await axiosInstance.get('/watchtower/compare-sku/trend', {
                params: {
                    startDate: startDate.format('YYYY-MM-DD'),
                    endDate: endDate.format('YYYY-MM-DD'),
                    metricId: activeMetricId,
                    platforms: appliedFilters.platforms,
                    brands: appliedFilters.brands,
                    categories: appliedFilters.categories,
                    locations: appliedFilters.locations,
                    skuNames: skus.map(s => s.name),
                    skuPlatforms: skus.map(s => s.platform || '')
                }
            });
            
            if (data) {
                setRealTrendData(data.trendData || []);
                setTrendSkus(data.skus || []);
                setTrendSummary(data.summary || { avgDsListing: '0', weightedDiscount: '0', catShare: '0' });
            }
        } catch (e) {
            console.error('[CompareSkuMatrix] Error fetching trend data:', e);
            setTrendError(true);
        } finally {
            setIsLoadingTrends(false);
        }
    }, [activeView, startDate, endDate, appliedFilters, selectedMetricIds, skus]);

    useEffect(() => {
        fetchTrendData();
    }, [fetchTrendData]);

    const handleAddNewSkus = async (products) => {
        const skuNames = products.map(p => p.name);
        const skuPlatforms = products.map(p => p.platform || '');
        const metricsData = await fetchSkuMetrics(skuNames, skuPlatforms);
        const metricsMap = new Map((metricsData?.skus || []).map(s => [s.name, s.metrics]));

        const newSkus = products.map((product, idx) => {
            const nextIdx = skus.length + idx + 1;
            const dbMetrics = metricsMap.get(product.name) || {};
            return {
                id: nextIdx,
                platform: product.platform || '',
                name: product.name,
                imageUrl: product.imageUrl || '',
                isSelected: false,
                tags: [product.size, product.category].filter(Boolean),
                metrics: {
                    offtake: dbMetrics.offtake || { value: '--', delta: 0, deltaAbs: '0' },
                    est_cat_share: dbMetrics.est_cat_share || { value: '--', delta: 0, deltaAbs: '0' },
                    ds_listing: dbMetrics.ds_listing || dbMetrics.availability || { value: '--', delta: 0, deltaAbs: '0' },
                    overall_sov: dbMetrics.overall_sov || { value: '--', delta: 0, deltaAbs: '0' },
                    ad_sov: dbMetrics.ad_sov || { value: '--', delta: 0, deltaAbs: '0' },
                    organic_sos: dbMetrics.organic_sos || { value: '--', delta: 0, deltaAbs: '0' },
                    wt_discount: dbMetrics.wt_discount || { value: '--', delta: 0, deltaAbs: '0' },
                    wt_ppu: dbMetrics.wt_ppu || { value: '--', delta: 0, deltaAbs: '0' },
                    spend: dbMetrics.spend || { value: '--', delta: 0, deltaAbs: '0' },
                    inorg_sales: dbMetrics.inorg_sales || { value: '--', delta: 0, deltaAbs: '0' },
                    conversion: dbMetrics.conversion || { value: '--', delta: 0, deltaAbs: '0' },
                    market_share: dbMetrics.market_share || { value: '--', delta: 0, deltaAbs: '0' },
                    cpm: dbMetrics.cpm || { value: '--', delta: 0, deltaAbs: '0' },
                    cpc: dbMetrics.cpc || { value: '--', delta: 0, deltaAbs: '0' },
                }
            };
        });
        
        setSkus(prev => [...prev, ...newSkus]);
        setIsAddDrawerOpen(false);
    };

    const handleClose = () => {
        if (onClose) {
            onClose();
        } else {
            navigate(-1);
        }
    };

    // Retry handlers
    const retryInit = () => {
        setInitError(false);
        setIsLoadingDate(true);
        const initData = async () => {
            try {
                const [dateRes, filtersRes] = await Promise.all([
                    axiosInstance.get('/watchtower/compare-sku/date-range').catch(e => ({ data: {} })),
                    axiosInstance.get('/watchtower/compare-sku/filters').catch(e => ({ data: { platforms: [], categories: [], brands: [], locations: [] } }))
                ]);
                const dateData = dateRes.data || {};
                const filterData = filtersRes.data || { platforms: [], categories: [], brands: [], locations: [] };
                if (filterData) {
                    setFilterOptions({
                        platforms: (filterData.platforms || []).filter(p => p && p.name).map(p => ({ id: p.id, name: String(p.name) })),
                        categories: (filterData.categories || []).filter(c => c && c.name).map(c => ({ id: c.id, name: String(c.name) })),
                        brands: (filterData.brands || []).filter(b => b && b.name).map(b => ({ id: b.id, name: String(b.name) })),
                        locations: (filterData.locations || []).filter(l => l && l.name).map(l => ({ id: l.id, name: String(l.name) }))
                    });
                }
                if (dateData.maxDate) {
                    const maxD = dayjs(dateData.maxDate);
                    setEndDate(maxD);
                    setStartDate(maxD.subtract(1, 'month'));
                    setDateRange({ minDate: dateData.minDate ? dayjs(dateData.minDate) : null, maxDate: maxD });
                }
            } catch (e) {
                console.error('[CompareSkuMatrix] Retry init error:', e);
                setInitError(true);
            } finally {
                setIsLoadingDate(false);
            }
        };
        initData();
    };

    const retryMetrics = () => {
        if (skus.length === 0) return;
        fetchSkuMetrics(skus.map(s => s.name)).then(metricsData => {
            const metricsMap = new Map((metricsData?.skus || []).map(s => [s.name, s.metrics]));
            setSkus(prev => prev.map(sku => {
                const dbMetrics = metricsMap.get(sku.name) || {};
                return { ...sku, metrics: { ...sku.metrics, ...dbMetrics } };
            }));
        });
    };

    const retryTrends = () => {
        setTrendError(false);
        fetchTrendData();
    };

    // Reusable Error Retry UI
    const ErrorRetryCard = ({ message, onRetry }) => (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                <AlertTriangle size={28} className="text-rose-400" />
            </div>
            <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">{message || 'Something went wrong'}</p>
                <p className="text-xs text-slate-400 mt-1">Please try again</p>
            </div>
            <button
                onClick={onRetry}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-[12px] font-bold rounded-xl shadow-lg shadow-slate-900/10 hover:bg-slate-800 hover:-translate-y-0.5 transition-all active:scale-95"
            >
                <RefreshCw size={14} strokeWidth={2.5} />
                Refresh
            </button>
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-[#f1f5f9] font-sans w-full p-4 overflow-hidden">
            <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 flex flex-col h-full w-full overflow-hidden max-w-[1600px] mx-auto">
                {/* Top Bar Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 relative z-10 w-full bg-white">
                    <div className="flex items-center gap-4">
                        {/* Close Button on Left */}
                        <button 
                            onClick={handleClose}
                            className="h-9 w-9 flex flex-shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-slate-200 transition-all text-slate-400 hover:text-slate-700"
                            title="Close Compare UI"
                        >
                            <X size={18} strokeWidth={2.5} />
                        </button>

                        {/* Title */}
                        <div className="flex items-center gap-3 border-l border-slate-200 pl-5">
                            <span className="text-[20px] font-semibold text-[#0f172a] tracking-tight">
                                Compare SKUs <span className="text-slate-400 font-medium ml-1">at</span>
                            </span>
                            <span className="bg-emerald-50 text-emerald-600 text-[10px] uppercase font-bold px-2 py-1 rounded-md tracking-widest leading-none mt-0.5 border border-emerald-100/50">
                                MRP
                            </span>
                        </div>

                        {/* Filters Button */}
                        <button 
                            onClick={() => setIsFilterModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[12px] font-bold border border-blue-100/50 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm transition-all ml-3 group"
                        >
                            <Filter size={14} strokeWidth={2.5} className="group-hover:scale-110 transition-transform"/>
                            Filters
                            <ChevronDown size={14} strokeWidth={2.5} className="opacity-50 group-hover:opacity-100 transition-opacity"/>
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            {/* Data from label */}
                            <div 
                                onClick={() => setIsStartDatePickerOpen(true)}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white border border-slate-100 shadow-sm text-[11.5px] font-semibold text-slate-400 cursor-pointer hover:border-blue-200 hover:bg-slate-50 transition-all relative"
                            >
                                <Calendar size={14} className="text-slate-300" strokeWidth={2.5}/>
                                Data from <span className="text-slate-900 ml-0.5">{startDate.format('DD MMM \'YY')}</span>
                                
                                {/* Hidden DatePicker Trigger */}
                                <div className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden">
                                    <DatePicker 
                                        open={isStartDatePickerOpen}
                                        onClose={() => setIsStartDatePickerOpen(false)}
                                        value={startDate}
                                        minDate={dateRange.minDate || undefined}
                                        maxDate={endDate || dateRange.maxDate || undefined}
                                        onChange={(newValue) => {
                                            if (newValue) {
                                                setStartDate(newValue);
                                            }
                                            setIsStartDatePickerOpen(false);
                                        }}
                                        slotProps={{ textField: { size: 'small' } }}
                                    />
                                </div>
                            </div>

                            {/* Data till label */}
                            <div 
                                onClick={() => setIsEndDatePickerOpen(true)}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white border border-slate-100 shadow-sm text-[11.5px] font-semibold text-slate-400 cursor-pointer hover:border-blue-200 hover:bg-slate-50 transition-all relative"
                            >
                                <Calendar size={14} className="text-slate-300" strokeWidth={2.5}/>
                                Data till <span className="text-slate-900 ml-0.5">{endDate.format('DD MMM \'YY')}</span>
                                
                                {/* Hidden DatePicker Trigger */}
                                <div className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden">
                                    <DatePicker 
                                        open={isEndDatePickerOpen}
                                        onClose={() => setIsEndDatePickerOpen(false)}
                                        value={endDate}
                                        minDate={startDate || dateRange.minDate || undefined}
                                        maxDate={dateRange.maxDate || undefined}
                                        onChange={(newValue) => {
                                            if (newValue) {
                                                setEndDate(newValue);
                                            }
                                            setIsEndDatePickerOpen(false);
                                        }}
                                        slotProps={{ textField: { size: 'small' } }}
                                    />
                                </div>
                            </div>
                        </div>
                        {/* Metric Dropdown - Only show in Trends View per user request */}
                        {activeView === 'trends' && (
                            <div className="relative" ref={metricDropdownRef}>
                                <div 
                                    onClick={() => setIsMetricDropdownOpen(!isMetricDropdownOpen)}
                                    className="flex items-center gap-2 text-[12px] font-semibold text-slate-400 cursor-pointer hover:text-slate-900 transition-all bg-slate-50/50 px-4 py-1.5 rounded-xl border border-slate-100"
                                >
                                    Metric: 
                                    <span className="text-slate-900 tracking-tight ml-0.5 flex items-center font-bold">
                                        {selectedMetricIds.length > 0 ? metricsList.find(m => m.id === selectedMetricIds[0])?.label : 'None'}
                                        <ChevronDown size={14} className="text-blue-500 ml-2 group-hover:translate-y-0.5 transition-transform" strokeWidth={2.5}/>
                                    </span>
                                </div>

                                {isMetricDropdownOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-slate-100 z-[100] py-3 overflow-hidden">
                                        <div className="px-4 pb-2 mb-2 border-b border-slate-50 flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Select Metric</span>
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto px-2 custom-scrollbar-sm">
                                            {metricsList.map(m => (
                                                m.type === 'section' 
                                                ? <div key={`dd-sec-${m.id}`} className="px-3 py-1.5 mt-2 bg-slate-50 rounded-lg">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{m.label}</span>
                                                  </div>
                                                : <div 
                                                    key={`dd-item-${m.id}`}
                                                    onClick={() => toggleMetric(m.id)}
                                                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                                                  >
                                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${selectedMetricIds.includes(m.id) ? 'bg-blue-500 border-blue-500 shadow-[0_2px_8px_rgba(59,130,246,0.4)]' : 'bg-white border-slate-200 group-hover:border-blue-300'}`}>
                                                        {selectedMetricIds.includes(m.id) && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                    </div>
                                                    <span className={`text-[12px] font-semibold transition-colors ${selectedMetricIds.includes(m.id) ? 'text-slate-900' : 'text-slate-500'}`}>
                                                        {m.label}
                                                    </span>
                                                  </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* View Toggles */}
                        <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50">
                            <button 
                                onClick={() => setActiveView('cross-sku')}
                                className={cn(
                                    "text-[10px] font-bold px-6 py-2 rounded-xl transition-all uppercase tracking-[0.12em]",
                                    activeView === 'cross-sku' 
                                        ? "bg-blue-600 text-white shadow-xl shadow-blue-500/20" 
                                        : "text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
                                )}
                            >
                                CROSS-SKU VIEW
                            </button>
                            <button 
                                onClick={() => setActiveView('trends')}
                                className={cn(
                                    "text-[10px] font-bold px-6 py-2 rounded-xl transition-all uppercase tracking-[0.12em]",
                                    activeView === 'trends' 
                                        ? "bg-blue-600 text-white shadow-xl shadow-blue-500/20" 
                                        : "text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
                                )}
                            >
                                TRENDS VIEW
                            </button>
                        </div>
                    </div>
                </div>

                {/* Secondary Tabs */}
                <div className="flex items-center gap-3 px-8 py-4 border-b border-slate-100 bg-slate-50/30">
                    <button className="flex items-center gap-2 px-5 py-2 rounded-full text-[12px] font-semibold border border-orange-100 text-orange-700 bg-orange-50/50 shadow-sm hover:bg-orange-100/50 transition-all active:scale-95 group">
                        <Scale size={14} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform"/>
                        Grammage
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2 rounded-full text-[12px] font-semibold border border-yellow-100 text-yellow-700 bg-yellow-50/50 shadow-sm hover:bg-yellow-100/50 transition-all active:scale-95 group">
                        <Award size={14} strokeWidth={2.5} className="group-hover:scale-110 transition-transform"/>
                        Top Selling
                    </button>
                </div>

                {/* Main Content Area */}
                {initError ? (
                    <div className="flex-1 flex items-center justify-center bg-white">
                        <ErrorRetryCard message="Failed to load Compare SKU data" onRetry={retryInit} />
                    </div>
                ) : activeView === 'cross-sku' ? (
                    <div className="flex-1 overflow-auto bg-white p-6 custom-scrollbar relative">
                        {/* Metrics Error Overlay */}
                        {metricsError && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex items-center justify-center">
                                <ErrorRetryCard message="Failed to fetch SKU metrics" onRetry={retryMetrics} />
                            </div>
                        )}
                        <div className="inline-flex min-w-full bg-white rounded-2xl shadow-[0_0_0_1px_rgba(226,232,240,1)] overflow-hidden">
                            
                            {/* Row Headers (Left Fixed Column) */}
                            <div className="w-[180px] sm:w-[220px] flex-shrink-0 border-r border-[#e2e8f0] bg-white flex flex-col z-20 sticky left-0 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                                {/* Top-Left empty space placeholder logo/branding */}
                                <div className="h-[120px] p-3 border-b border-[#e2e8f0] bg-gradient-to-b from-slate-50 to-white flex items-center justify-center relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100/30 rounded-bl-[60px] -z-10"></div>
                                    <div className="flex flex-col items-center justify-center text-center gap-1.5">
                                        <div className="w-10 h-10 bg-white rounded-[12px] shadow-sm border border-slate-100 flex items-center justify-center">
                                            <Package size={20} className="text-blue-500" strokeWidth={1.5} />
                                        </div>
                                        <div>
                                            <h3 className="text-[13px] font-semibold text-slate-800 tracking-tight">Compare SKUs</h3>
                                            <p className="text-[10px] font-medium text-slate-500 mt-0.5">Metrics Overview</p>
                                        </div>
                                    </div>
                                </div>
                                {metricsList.filter(m => m.type === 'section' || activeView === 'cross-sku' || selectedMetricIds.includes(m.id)).map((m, idx) => {
                                    // Don't show section if none of its sub-metrics are selected (unless in cross-sku view where all are shown)
                                    if (m.type === 'section') {
                                        const hasVisibleSubmetrics = metricsList.some(sm => 
                                            sm.section === m.id && (activeView === 'cross-sku' || selectedMetricIds.includes(sm.id))
                                        );
                                        if (!hasVisibleSubmetrics) return null;

                                        return (
                                            <div key={`hdr-${idx}`} className="px-4 py-1.5 flex items-center h-[32px] border-b border-[#e2e8f0] bg-white relative">
                                                <div className="bg-[#f3e8ff] px-2.5 py-0.5 rounded-lg w-fit">
                                                    <span className="text-[10px] font-semibold text-[#7e22ce] tracking-widest uppercase">
                                                        {m.label}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={`hdr-${idx}`} className="px-5 py-2 border-b border-[#e2e8f0]/80 flex items-center h-[44px] text-[12px] font-semibold text-slate-600 tracking-tight">
                                            {m.label}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* SKU Columns */}
                            {skus.map((sku, index) => (
                                <div key={`sku-${sku.id}`} className="w-[260px] flex-shrink-0 border-r border-[#e2e8f0] flex flex-col bg-white">
                                    {/* SKU Card */}
                                    <div className="h-[120px] p-2.5 border-b border-[#e2e8f0] flex flex-col items-center relative group">
                                        {/* Top Labels Row */}
                                        <div className="w-full flex justify-between items-start mb-1.5 relative z-10">
                                            <div className="flex items-center gap-1.5 bg-[#fef08a]/60 px-1.5 py-0.5 rounded-md text-[9px] font-semibold text-[#854d0e] tracking-tight border border-[#fef08a]">
                                                <div className="w-2.5 h-2.5 flex items-center justify-center bg-[#facc15] rounded-[2px] text-white">
                                                    <div className="w-1 h-1 bg-white rounded-[1px]"></div>
                                                </div>
                                                {sku.platform}
                                            </div>
                                            {/* Remove button appears on hover */}
                                            <button 
                                                onClick={() => handleRemove(sku.id)}
                                                className="opacity-0 group-hover:opacity-100 bg-white shadow-sm border border-slate-200 text-[#ef4444] hover:bg-[#fef2f2] hover:border-[#fecaca] p-1 rounded-lg flex items-center justify-center transition-all absolute right-0"
                                                title="Remove SKU"
                                            >
                                                <X size={12} strokeWidth={2.5}/>
                                            </button>
                                        </div>
                                        
                                        {/* Product Image */}
                                        <div className="h-[36px] w-[36px] flex-shrink-0 rounded-lg border border-slate-100 p-1 mb-1.5 bg-white flex items-center justify-center shadow-[0_1px_4px_rgb(0,0,0,0.04)] relative z-10 overflow-hidden">
                                            {sku.imageUrl ? (
                                                <img src={sku.imageUrl} alt={sku.name} className="w-full h-full object-contain mix-blend-multiply" />
                                            ) : (
                                                <Package size={18} className="text-[#3b82f6]/30" strokeWidth={1.5} />
                                            )}
                                        </div>

                                        {/* Product Title */}
                                        <div className="text-[11px] font-semibold text-slate-800 text-center leading-[1.2] mb-1.5 h-[26px] line-clamp-2 px-1 tracking-tight" title={sku.name}>
                                            {sku.name}
                                        </div>

                                        {/* Selected Badge */}
                                        {sku.isSelected && (
                                            <div className="absolute top-[45px] -right-1 bg-[#d1fae5] text-[#059669] text-[7px] font-semibold px-1.5 py-0.5 rounded shadow-sm border border-[#a7f3d0] uppercase tracking-widest z-20 translate-x-1">
                                                SELECTED
                                            </div>
                                        )}
                                    </div>

                                    {/* Metric Cells */}
                                    {metricsList.filter(m => m.type === 'section' || activeView === 'cross-sku' || selectedMetricIds.includes(m.id)).map((m, idx) => {
                                        if (m.type === 'section') {
                                            const hasVisibleSubmetrics = metricsList.some(sm => 
                                                sm.section === m.id && (activeView === 'cross-sku' || selectedMetricIds.includes(sm.id))
                                            );
                                            if (!hasVisibleSubmetrics) return null;
                                            return <div key={`cell-${idx}`} className="h-[32px] border-b border-[#e2e8f0] bg-white"></div>;
                                        }
                                        const data = sku.metrics[m.id];
                                        if (!data) {
                                            return (
                                                <div key={`cell-${idx}`} className="h-[44px] px-5 py-1 border-b border-[#e2e8f0]/80 flex items-center justify-between text-[12px]">
                                                    <span className="font-semibold text-slate-400">--</span>
                                                    <span className="text-[#94a3b8] text-[10px] font-semibold uppercase">NA</span>
                                                </div>
                                            );
                                        }

                                        const isPositive = data.delta > 0;
                                        const hasDelta = data.delta !== null;
                                        
                                        return (
                                            <div key={`cell-${idx}`} className="h-[44px] px-5 py-1 border-b border-[#e2e8f0]/80 flex items-center justify-between text-[12px] hover:bg-slate-50/50 transition-colors">
                                                <span className="font-semibold text-slate-800 text-[13px]">{data.value}</span>
                                                {hasDelta ? (
                                                    <div className={`flex items-center gap-1 font-semibold ${isPositive ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                                                        {isPositive ? <TrendingUp size={12} strokeWidth={2.5}/> : <TrendingDown size={12} strokeWidth={2.5}/>}
                                                        <span className="tracking-tight text-[11px]">{isPositive ? '+' : ''}{data.delta}%</span>
                                                        <span className="opacity-60 font-medium tracking-tighter text-[10px] ml-0.5">({data.deltaAbs})</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[#94a3b8] text-[10px] font-semibold uppercase">NA</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                            
                            {/* Add SKU Column Placeholder - Only show if less than 5 SKUs perhaps, but let's always show it */}
                            <div className="w-[260px] flex-shrink-0 p-6 flex flex-col items-center justify-center bg-white">
                                <div className="w-full bg-[#f8fafc] rounded-2xl border-2 border-slate-200/80 border-dashed h-full flex flex-col items-center justify-center p-6 transition-all hover:bg-slate-50 hover:border-[#93c5fd] group">
                                    <div className="h-16 w-16 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-6 text-[#cbd5e1] group-hover:text-[#3b82f6] transition-colors">
                                        <Package size={28} strokeWidth={1.5} />
                                    </div>
                                    <div className="text-[14px] font-semibold text-slate-500 text-center leading-[1.4] mb-8 tracking-tight group-hover:text-slate-800 transition-colors">
                                        Select or Search SKU<br/>for comparison
                                    </div>
                                    <button 
                                        onClick={() => setIsAddDrawerOpen(true)}
                                        className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white w-full rounded-xl py-3 text-[13px] font-semibold flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 active:translate-y-0"
                                    >
                                        <Plus size={18} strokeWidth={2.5}/> Add SKUs
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto bg-[#f8fafc] p-6 custom-scrollbar pb-12 relative">
                        {/* Loading Overlay for Trends */}
                        {isLoadingTrends && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="animate-spin text-blue-500" size={32} />
                                    <span className="text-slate-500 font-semibold text-sm">Fetching trend data...</span>
                                </div>
                            </div>
                        )}

                        {/* Trend Error Overlay */}
                        {trendError && !isLoadingTrends && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex items-center justify-center">
                                <ErrorRetryCard message="Failed to fetch trend data" onRetry={retryTrends} />
                            </div>
                        )}

                        {/* Trends View Content */}
                        <div className="max-w-6xl mx-auto space-y-6">
                            {/* Top Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                    { title: 'Cat Share', metric: `${trendSummary.catShare}%`, delta: '---', up: true, subtitle: 'Selected Period Avg', color: 'blue' },
                                    { title: 'Avg. DS Listing%', metric: `${trendSummary.avgDsListing}%`, delta: '---', up: true, subtitle: 'Across Selected Brands', color: 'indigo' },
                                    { title: 'Weighted Discount', metric: `${trendSummary.weightedDiscount}%`, delta: '---', up: true, subtitle: 'Weighted by Sales', color: 'purple' }
                                ].map((card, i) => (
                                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition-all">
                                        <span className="text-slate-500 font-medium text-[12px] uppercase tracking-wider mb-2">{card.title}</span>
                                        <div className="flex items-end justify-between mt-auto">
                                            <div>
                                                <div className="text-3xl font-semibold text-slate-800 tracking-tight">{card.metric}</div>
                                                <div className="text-slate-400 text-[11px] font-medium mt-1">{card.subtitle}</div>
                                            </div>
                                            <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold text-[13px] bg-slate-50 text-slate-400 opacity-50`}>
                                                ---
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Main Chart Area */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[450px] flex flex-col">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="space-y-1">
                                        <h3 className="text-[17px] font-bold text-slate-800">
                                            {allMetricsList.find(m => m.id === (selectedMetricIds[0] || 'offtake'))?.label} Trend by SKU
                                        </h3>
                                        <p className="text-sm font-medium text-slate-400">
                                            Performance from {startDate.format('DD MMM')} to {endDate.format('DD MMM \'YY')}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 max-w-[50%] justify-end">
                                        {trendSkus.map((sku, idx) => (
                                            <span key={sku} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorPalette[idx % colorPalette.length] }}></div> 
                                                {sku.length > 30 ? sku.substring(0, 30) + '...' : sku}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="h-[350px] w-full mt-2">
                                    {realTrendData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={realTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis 
                                                    dataKey="date" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                                    dy={12}
                                                />
                                                <YAxis 
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tickFormatter={(val) => {
                                                        const mId = selectedMetricIds[0] || 'offtake';
                                                        if (['offtake', 'offtakes', 'spend', 'inorg_sales', 'inorgSales'].includes(mId)) {
                                                            if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}cr`;
                                                            if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
                                                            if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
                                                            return `₹${val}`;
                                                        }
                                                        if (['availability', 'ds_listing', 'conversion', 'wt_discount', 'market_share'].includes(mId)) {
                                                            return `${val}%`;
                                                        }
                                                        return val;
                                                    }}
                                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                                />
                                                <Tooltip 
                                                    contentStyle={{ 
                                                        borderRadius: '16px', 
                                                        border: '1px solid #f1f5f9', 
                                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                                                        padding: '12px'
                                                    }}
                                                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                                    labelStyle={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: '800' }}
                                                    formatter={(value, name) => {
                                                        const mId = selectedMetricIds[0] || 'offtake';
                                                        if (['offtake', 'offtakes', 'spend', 'inorg_sales', 'inorgSales'].includes(mId)) {
                                                            if (value >= 10000000) return [`₹${(value / 10000000).toFixed(2)} Cr`, name];
                                                            if (value >= 100000) return [`₹${(value / 100000).toFixed(2)} Lac`, name];
                                                            if (value >= 1000) return [`₹${(value / 1000).toFixed(1)} K`, name];
                                                            return [`₹${value}`, name];
                                                        }
                                                        if (['availability', 'ds_listing', 'conversion', 'wt_discount', 'market_share'].includes(mId)) {
                                                            return [`${value}%`, name];
                                                        }
                                                        return [value, name];
                                                    }}
                                                />
                                                {trendSkus.map((sku, idx) => (
                                                    <Line 
                                                        key={sku}
                                                        type="monotone" 
                                                        dataKey={sku} 
                                                        stroke={colorPalette[idx % colorPalette.length]} 
                                                        strokeWidth={3} 
                                                        dot={{ r: 0 }}
                                                        activeDot={{ r: 6, strokeWidth: 0, fill: colorPalette[idx % colorPalette.length] }}
                                                        name={sku.length > 30 ? sku.substring(0, 30) + '...' : sku}
                                                        animationDuration={1500}
                                                    />
                                                ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                            <TrendingUp size={48} className="text-slate-200 mb-4" />
                                            <span className="text-slate-400 font-bold text-sm">No trend data available for current filters</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Advanced Filter Modal */}
            <CompareSkuFilterModal 
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                filters={appliedFilters}
                platforms={filterOptions.platforms}
                categories={filterOptions.categories}
                brands={filterOptions.brands}
                locations={filterOptions.locations}
                onApply={(newFilters) => {
                    setAppliedFilters(newFilters);
                    // Make sure the selected metric ID is still valid, else default to first available
                    if (newFilters.kpis && newFilters.kpis.length > 0) {
                        const validIds = allMetricsList
                            .filter(m => m.type !== 'section' && newFilters.kpis.some(k => m.kpiKey === k))
                            .map(m => m.id);
                        
                        setSelectedMetricIds(prev => {
                            if (!validIds.includes(prev[0]) && validIds.length > 0) {
                                return [validIds[0]];
                            }
                            return prev;
                        });
                    }
                    // Re-fetch metrics for existing SKUs with new filters
                    if (skus.length > 0) {
                        fetchSkuMetrics(skus.map(s => s.name), skus.map(s => s.platform || '')).then(metricsData => {
                            const metricsMap = new Map((metricsData?.skus || []).map(s => [s.name, s.metrics]));
                            setSkus(prev => prev.map(sku => {
                                const dbMetrics = metricsMap.get(sku.name) || {};
                                return { ...sku, metrics: { ...sku.metrics, ...dbMetrics } };
                            }));
                        });
                    }
                }}
            />

            {/* Add SKU Sliding Drawer */}
            <AddSkuDrawer 
                isOpen={isAddDrawerOpen} 
                onClose={() => setIsAddDrawerOpen(false)} 
                onAddSkus={handleAddNewSkus}
            />

            {/* Custom scrollbar styles */}
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    height: 12px;
                    width: 12px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 8px;
                    margin: 0 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 8px;
                    border: 3px solid #f1f5f9;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #94a3b8;
                }
            `}</style>
        </div>
    );
};

export default CompareSkuMatrix;
