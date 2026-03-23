import React, { useState, useEffect, useRef } from 'react';
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
    Calendar
} from 'lucide-react';
import dayjs from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { cn } from '../../../lib/utils';
import AddSkuDrawer from './AddSkuDrawer';
import AdvancedFilterModal from './AdvancedFilterModal';
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
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(dayjs('2026-03-18'));
    const [appliedFilters, setAppliedFilters] = useState({
        brands: [],
        categories: [],
        platforms: [],
        skus: [],
        dateFrom: null,
        dateTo: null,
    });
    
    // Mock metrics based on the screenshot
    const metricsList = [
        { id: 'offtake', label: 'Offtake', section: null },
        { id: 'est_cat_share', label: 'Est. Cat Share', section: null },
        { id: 'availability', label: 'Availability', type: 'section' },
        { id: 'ds_listing', label: 'DS Listing%', section: 'availability' },
        { id: 'visibility', label: 'Visibility', type: 'section' },
        { id: 'overall_sov', label: 'Overall SOV', section: 'visibility' },
        { id: 'ad_sov', label: 'Ad. SOV', section: 'visibility' },
        { id: 'discounting', label: 'Discounting', type: 'section' },
        { id: 'wt_discount', label: 'Wt. Discount%', section: 'discounting' },
        { id: 'wt_ppu', label: 'Wt. PPU(x100)', section: 'discounting' }
    ];

    // Start with an empty list so the user must add SKUs
    const initialSkus = [];

    const [skus, setSkus] = useState(initialSkus);
    const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
    const [activeView, setActiveView] = useState('cross-sku');
    const metricDropdownRef = useRef(null);
    
    // Trend Data Mockup (Matching Screenshot: 18 Feb - 18 Mar)
    const trendData = [
        { date: "18 Feb'26", v1: 0, v2: 0, s: 0 },
        { date: "20 Feb'26", v1: 0, v2: 0, s: 0 },
        { date: "22 Feb'26", v1: 0, v2: 0, s: 0 },
        { date: "24 Feb'26", v1: 0, v2: 0, s: 0 },
        { date: "26 Feb'26", v1: 0, v2: 0, s: 0 },
        { date: "28 Feb'26", v1: 0, v2: 0, s: 0 },
        { date: "01 Mar'26", v1: 32, v2: 28, s: 0.3 },
        { date: "02 Mar'26", v1: 30, v2: 24, s: 0.25 },
        { date: "03 Mar'26", v1: 31, v2: 24, s: 0.28 },
        { date: "04 Mar'26", v1: 29, v2: 21, s: 0.22 },
        { date: "05 Mar'26", v1: 33, v2: 24, s: 0.20 },
        { date: "06 Mar'26", v1: 32, v2: 24, s: 0.18 },
        { date: "07 Mar'26", v1: 32.5, v2: 27, s: 0.22 },
        { date: "08 Mar'26", v1: 32.8, v2: 31, s: 0.25 },
        { date: "09 Mar'26", v1: 34, v2: 25, s: 0.21 },
        { date: "10 Mar'26", v1: 30, v2: 27, s: 0.25 },
        { date: "11 Mar'26", v1: 29, v2: 26.8, s: 0.28 },
        { date: "12 Mar'26", v1: 28.5, v2: 26.3, s: 0.25 },
        { date: "13 Mar'26", v1: 25, v2: 26.1, s: 0.22 },
        { date: "14 Mar'26", v1: 29, v2: 28, s: 0.28 },
        { date: "15 Mar'26", v1: 30, v2: 31, s: 0.3 },
        { date: "16 Mar'26", v1: 28, v2: 24, s: 0.25 },
        { date: "17 Mar'26", v1: 25, v2: 25, s: 0.28 },
        { date: "18 Mar'26", v1: 0, v2: 0, s: 0 }
    ];
    
    // Metric selection state
    const [selectedMetricIds, setSelectedMetricIds] = useState(metricsList.filter(m => m.type !== 'section').map(m => m.id));
    const [isMetricDropdownOpen, setIsMetricDropdownOpen] = useState(false);

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
        setSelectedMetricIds(prev => 
            prev.includes(id) 
                ? prev.filter(mId => mId !== id) 
                : [...prev, id]
        );
    };

    const handleRemove = (idToRemove) => {
        setSkus(prev => prev.filter(sku => sku.id !== idToRemove));
    };

    const handleAddNewSkus = (products) => {
        const newSkus = products.map((product, idx) => {
            const nextIdx = skus.length + idx + 1;
            return {
                id: nextIdx,
                platform: 'Zepto', // Just mocking platform
                name: product.name,
                isSelected: false,
                tags: [product.size, product.category],
                metrics: {
                    offtake: { value: `${(Math.random() * 10).toFixed(1)} lac`, delta: (Math.random() * 5).toFixed(1), deltaAbs: `${(Math.random() * 2).toFixed(1)} lac` },
                    est_cat_share: { value: (Math.random() * 0.5).toFixed(2), delta: (Math.random() * 10).toFixed(1), deltaAbs: '0.0' },
                    ds_listing: { value: (Math.random() * 20 + 80).toFixed(1), delta: (Math.random() * 10 - 5).toFixed(1), deltaAbs: '2.0' },
                    overall_sov: { value: (Math.random() * 0.2).toFixed(2), delta: (Math.random() * 20).toFixed(1), deltaAbs: '0.0' },
                    ad_sov: { value: '0.0', delta: 0.0, deltaAbs: '0.0' },
                    wt_discount: { value: (Math.random() * 15).toFixed(1), delta: (Math.random() * 10).toFixed(1), deltaAbs: '1.0' },
                    wt_ppu: { value: (Math.random() * 100 + 100).toFixed(1), delta: (Math.random() * 10 - 5).toFixed(1), deltaAbs: '5.0' }
                }
            };
        });
        
        setSkus(prev => [...prev, ...newSkus]);
        setIsAddDrawerOpen(false); // Close drawer after adding
    };

    const handleClose = () => {
        if (onClose) {
            onClose();
        } else {
            navigate(-1);
        }
    };

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
                        {/* Data till label */}
                        <div 
                            onClick={() => setIsDatePickerOpen(true)}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white border border-slate-100 shadow-sm text-[11.5px] font-semibold text-slate-400 cursor-pointer hover:border-blue-200 hover:bg-slate-50 transition-all relative"
                        >
                            <Calendar size={14} className="text-slate-300" strokeWidth={2.5}/>
                            Data till <span className="text-slate-900 ml-0.5">{selectedDate.format('DD MMM \'YY')}</span>
                            
                            {/* Hidden DatePicker Trigger */}
                            <div className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden">
                                <DatePicker 
                                    open={isDatePickerOpen}
                                    onClose={() => setIsDatePickerOpen(false)}
                                    value={selectedDate}
                                    onChange={(newValue) => {
                                        setSelectedDate(newValue);
                                        setIsDatePickerOpen(false);
                                    }}
                                    slotProps={{ textField: { size: 'small' } }}
                                />
                            </div>
                        </div>
                        {/* Metric Dropdown */}
                        <div className="relative" ref={metricDropdownRef}>
                            <div 
                                onClick={() => setIsMetricDropdownOpen(!isMetricDropdownOpen)}
                                className="flex items-center gap-2 text-[12px] font-semibold text-slate-400 cursor-pointer hover:text-slate-900 transition-all bg-slate-50/50 px-4 py-1.5 rounded-xl border border-slate-100"
                            >
                                Metric: 
                                <span className="text-slate-900 tracking-tight ml-0.5 flex items-center font-bold">
                                    {selectedMetricIds.length > 0 ? metricsList.find(m => m.id === selectedMetricIds[0])?.label : 'None'}
                                    {selectedMetricIds.length > 1 && <span className="text-blue-500 ml-1.5 px-1.5 py-0.5 bg-blue-50 rounded-lg text-[10px] whitespace-nowrap">+{selectedMetricIds.length - 1} more</span>}
                                    <ChevronDown size={14} className="text-blue-500 ml-2 group-hover:translate-y-0.5 transition-transform" strokeWidth={2.5}/>
                                </span>
                            </div>

                            {isMetricDropdownOpen && (
                                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-slate-100 z-[100] py-3 overflow-hidden">
                                    <div className="px-4 pb-2 mb-2 border-b border-slate-50 flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Select Metrics</span>
                                        <button 
                                            onClick={() => setSelectedMetricIds(metricsList.filter(m => m.type !== 'section').map(m => m.id))}
                                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                                        >
                                            Reset
                                        </button>
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
                                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${selectedMetricIds.includes(m.id) ? 'bg-blue-500 border-blue-500 shadow-[0_2px_8px_rgba(59,130,246,0.4)]' : 'bg-white border-slate-200 group-hover:border-blue-300'}`}>
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
                {activeView === 'cross-sku' ? (
                    <div className="flex-1 overflow-auto bg-white p-6 custom-scrollbar">
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
                                {metricsList.filter(m => m.type === 'section' || selectedMetricIds.includes(m.id)).map((m, idx) => {
                                    // Don't show section if none of its sub-metrics are selected
                                    if (m.type === 'section') {
                                        const hasVisibleSubmetrics = metricsList.some(sm => sm.section === m.id && selectedMetricIds.includes(sm.id));
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
                                        
                                        {/* Product Image Placeholder */}
                                        <div className="h-[36px] w-[36px] flex-shrink-0 rounded-lg border border-slate-100 p-1 mb-1.5 bg-white flex items-center justify-center shadow-[0_1px_4px_rgb(0,0,0,0.04)] relative z-10">
                                            <Package size={18} className="text-[#3b82f6]/30" strokeWidth={1.5} />
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
                                    {metricsList.filter(m => m.type === 'section' || selectedMetricIds.includes(m.id)).map((m, idx) => {
                                        if (m.type === 'section') {
                                            const hasVisibleSubmetrics = metricsList.some(sm => sm.section === m.id && selectedMetricIds.includes(sm.id));
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
                    <div className="flex-1 overflow-auto bg-[#f8fafc] p-6 custom-scrollbar pb-12">
                        {/* Trends View Mockup Dashboard */}
                        <div className="max-w-6xl mx-auto space-y-6">
                            {/* Top Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                    { title: 'Est. Cat Share Trend', metric: '10.8%', delta: '+2.4%', up: true, subtitle: 'Vs last 30 days', color: 'blue' },
                                    { title: 'Avg. DS Listing%', metric: '94.2%', delta: '-1.2%', up: false, subtitle: 'Across all selected SKUs', color: 'indigo' },
                                    { title: 'Weighted Discount', metric: '21.5%', delta: '+5.1%', up: true, subtitle: 'Target threshold 20%', color: 'purple' }
                                ].map((card, i) => (
                                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition-all">
                                        <span className="text-slate-500 font-medium text-[12px] uppercase tracking-wider mb-2">{card.title}</span>
                                        <div className="flex items-end justify-between mt-auto">
                                            <div>
                                                <div className="text-3xl font-semibold text-slate-800 tracking-tight">{card.metric}</div>
                                                <div className="text-slate-400 text-[11px] font-medium mt-1">{card.subtitle}</div>
                                            </div>
                                            <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold text-[13px] ${card.up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                {card.up ? <TrendingUp size={14} strokeWidth={3}/> : <TrendingDown size={14} strokeWidth={3}/>}
                                                {card.delta}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Main Chart Area Mockup */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="space-y-1">
                                        <h3 className="text-[16px] font-semibold text-slate-800">Offtake Volumetric Trend (12 Months)</h3>
                                        <p className="text-sm font-medium text-slate-500">Comparing selected SKUs across main platforms</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500"></div> Biotique</span>
                                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><div className="w-2.5 h-2.5 rounded-sm bg-indigo-400"></div> L'Oreal</span>
                                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><div className="w-2.5 h-2.5 rounded-sm bg-teal-400"></div> Nat Habit</span>
                                    </div>
                                </div>
                                
                                {/* Recharts Spline Graph */}
                                <div className="h-[300px] w-full mt-6">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={trendData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis 
                                                dataKey="date" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                                dy={10}
                                            />
                                            <YAxis 
                                                yAxisId="left"
                                                orientation="left"
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(val) => `₹ ${val} lac`}
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                            />
                                            <YAxis 
                                                yAxisId="right"
                                                orientation="right"
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(val) => `${val} %`}
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                            />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Line 
                                                yAxisId="left"
                                                type="monotone" 
                                                dataKey="v1" 
                                                stroke="#10b981" 
                                                strokeWidth={2.5} 
                                                dot={{ r: 3, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                                                activeDot={{ r: 5, strokeWidth: 0 }}
                                                name="Biotique"
                                            />
                                            <Line 
                                                yAxisId="left"
                                                type="monotone" 
                                                dataKey="v2" 
                                                stroke="#3b82f6" 
                                                strokeWidth={2.5} 
                                                dot={{ r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                                                activeDot={{ r: 5, strokeWidth: 0 }}
                                                name="L'Oreal"
                                            />
                                            <Line 
                                                yAxisId="right"
                                                type="monotone" 
                                                dataKey="s" 
                                                stroke="#ef4444" 
                                                strokeWidth={2.5} 
                                                dot={{ r: 3, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }}
                                                activeDot={{ r: 5, strokeWidth: 0 }}
                                                name="Share%"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Advanced Filter Modal */}
            <AdvancedFilterModal 
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                filters={appliedFilters}
                onApply={(newFilters) => {
                    setAppliedFilters(newFilters);
                    // Filter logic would go here to refresh the comparison data
                }}
                currentDimension="sku"
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
