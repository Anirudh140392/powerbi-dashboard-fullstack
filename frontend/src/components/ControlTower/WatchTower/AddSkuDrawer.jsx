import React, { useState, useEffect, useCallback } from 'react';
import { 
    X, 
    Search, 
    ChevronUp,
    ChevronDown,
    Plus,
    Award,
    Check,
    Loader2,
    RefreshCw,
    AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import axiosInstance from '../../../api/axiosInstance';

// Mock Data
const MOCK_PLATFORMS = [
    { id: 'instamart', name: 'Instamart', color: '#f97316' }, // Orange
    { id: 'zepto', name: 'Zepto', color: '#d946ef' }, // Fuchsia
    { id: 'blinkit', name: 'Blinkit', color: '#eab308' }, // Yellow
];

const MOCK_CATEGORIES = [
    { id: 'all', name: 'All' },
    { id: 'body_lotion', name: 'Body Lotion' },
    { id: 'body_oil', name: 'Body Oil' },
    { id: 'conditioner', name: 'Conditioner' },
    { id: 'eyeliner', name: 'Eyeliner' },
    { id: 'face_mask', name: 'Face Mask' },
    { id: 'face_wash', name: 'Face Wash' },
    { id: 'hair_mask', name: 'Hair Mask' },
    { id: 'moisturizer', name: 'Moisturizer' },
    { id: 'shampoo', name: 'Shampoo' },
    { id: 'serum', name: 'Serum' },
    { id: 'toner', name: 'Toner' },
    { id: 'sunscreen', name: 'Sunscreen' },
    { id: 'soap', name: 'Soap' },
];

const MOCK_BRANDS = [
    { id: 'all', name: 'All' },
    { id: '8x', name: '8X' },
    { id: '8x_kt', name: '8X Kt' },
    { id: 'a_ret', name: 'A Ret' },
    { id: 'aaa', name: 'Aaa' },
    { id: 'aclind', name: 'Aclind Bp' },
    { id: 'acnestar', name: 'Acnestar' },
    { id: 'beardo', name: 'Beardo' },
    { id: 'biotique', name: 'Biotique' },
    { id: 'cetaphil', name: 'Cetaphil' },
    { id: 'dove', name: 'Dove' },
    { id: 'himalaya', name: 'Himalaya' },
    { id: 'loreal', name: "L'Oreal" },
    { id: 'mamaearth', name: 'Mamaearth' },
    { id: 'nivea', name: 'Nivea' },
    { id: 'ponds', name: "Pond's" },
];



const FilterSection = ({ title, expanded, onToggle, children }) => (
    <div className="border-b border-slate-100/60 py-4">
        <button 
            onClick={onToggle}
            className="flex items-center justify-between w-full text-left mb-1.5 group select-none"
        >
            <span className="text-[12px] font-bold text-slate-800 uppercase tracking-[0.15em] opacity-80 group-hover:opacity-100 transition-opacity">{title}</span>
            <div className="text-slate-300 group-hover:text-blue-500 transition-all duration-300 transform group-hover:scale-110">
                {expanded ? <ChevronUp size={14} strokeWidth={3} /> : <ChevronDown size={14} strokeWidth={3} />}
            </div>
        </button>
        {expanded && (
            <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 space-y-1"
            >
                {children}
            </motion.div>
        )}
    </div>
);

const PriceRangeSlider = ({ min, max, onChange }) => {
    const [minValue, setMinValue] = useState(min);
    const [maxValue, setMaxValue] = useState(max);

    const handleMinChange = (e) => {
        const value = Math.min(Number(e.target.value), maxValue - 100);
        setMinValue(value);
        onChange?.({ min: value, max: maxValue });
    };

    const handleMaxChange = (e) => {
        const value = Math.max(Number(e.target.value), minValue + 100);
        setMaxValue(value);
        onChange?.({ min: minValue, max: value });
    };

    const minPos = ((minValue - min) / (max - min)) * 100;
    const maxPos = ((maxValue - min) / (max - min)) * 100;

    return (
        <div className="px-1 pt-8 pb-6">
            <div className="relative w-full h-2 bg-slate-100 rounded-full border border-slate-200/50">
                {/* Track highlight */}
                <div 
                    className="absolute h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                    style={{ left: `${minPos}%`, right: `${100 - maxPos}%` }}
                />
                
                {/* Custom inputs */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={minValue}
                    onChange={handleMinChange}
                    className="absolute w-full h-2 opacity-0 cursor-pointer z-30 pointer-events-auto"
                    style={{ appearance: 'none' }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={maxValue}
                    onChange={handleMaxChange}
                    className="absolute w-full h-2 opacity-0 cursor-pointer z-30 pointer-events-auto"
                    style={{ appearance: 'none' }}
                />

                {/* Visible Handles */}
                <div 
                    className="absolute w-5 h-5 bg-white border-[3px] border-blue-600 rounded-full shadow-lg shadow-blue-500/20 top-1/2 -translate-y-1/2 z-20 transition-transform active:scale-125 hover:scale-110"
                    style={{ left: `${minPos}%`, transform: 'translate(-50%, -50%)' }}
                >
                    <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping"></div>
                </div>
                <div 
                    className="absolute w-5 h-5 bg-white border-[3px] border-indigo-600 rounded-full shadow-lg shadow-indigo-500/20 top-1/2 -translate-y-1/2 z-20 transition-transform active:scale-125 hover:scale-110"
                    style={{ left: `${maxPos}%`, transform: 'translate(-50%, -50%)' }}
                >
                    <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping"></div>
                </div>

                {/* Tooltip for Current Range */}
                <div 
                    className="absolute -top-10 bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-2xl z-40 whitespace-nowrap flex items-center gap-2 border border-white/10"
                    style={{ left: `${(minPos + maxPos) / 2}%`, transform: 'translateX(-50%)' }}
                >
                    <span className="text-blue-400">₹{minValue.toLocaleString()}</span>
                    <span className="text-slate-500">—</span>
                    <span className="text-indigo-400">₹{maxValue.toLocaleString()}</span>
                    {/* Arrow */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-white/5"></div>
                </div>
            </div>
        </div>
    );
};

const CheckboxItem = ({ label, count, color, icon, defaultChecked = false }) => {
    const [checked, setChecked] = useState(defaultChecked);
    return (
        <div 
            className="flex items-center justify-between py-1.5 cursor-pointer group"
            onClick={() => setChecked(!checked)}
        >
            <div className="flex items-center gap-2.5">
                <div className={`w-3.5 h-3.5 rounded-[3px] border transition-colors relative flex items-center justify-center ${checked ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}>
                    {checked && <Check size={10} strokeWidth={4} className="text-white" />}
                </div>
                {icon && (
                    <div className="w-[14px] h-[14px] flex items-center justify-center rounded-[3px] text-white" style={{ backgroundColor: color }}>
                        <div className="w-1.5 h-1.5 bg-white rounded-[2px]"></div>
                    </div>
                )}
                <span className={`text-[12px] transition-colors ${checked ? 'font-bold text-slate-800' : 'font-medium text-[#475569] group-hover:text-[#0f172a]'}`}>{label}</span>
            </div>
        </div>
    );
};

const ProductImage = ({ imageUrl, productName }) => {
    const [hasError, setHasError] = useState(false);

    if (!imageUrl || hasError) {
        return (
            <div className="w-8 h-12 bg-white rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 relative flex flex-col items-center justify-center p-1">
                <div className="w-4 h-4 text-slate-300 opacity-60">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                </div>
            </div>
        );
    }

    return (
        <img 
            src={imageUrl} 
            alt={productName} 
            className="w-24 h-24 object-contain mix-blend-multiply drop-shadow-sm transition-opacity duration-300"
            onError={() => setHasError(true)}
            loading="lazy"
        />
    );
};

const AddSkuDrawer = ({ isOpen, onClose, onAddSkus }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    // Filter collapse states
    const [openFilters, setOpenFilters] = useState({
        platforms: true,
        category: true,
        brands: true,
        asp: true,
        grammage: true
    });
    
    // List expansion states (Show More)
    const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
    const [isBrandsExpanded, setIsBrandsExpanded] = useState(false);

    // Filter Options from API
    const [filterOptions, setFilterOptions] = useState({ platforms: [], categories: [], brands: [] });
    
    // Filter States
    const [selectedPlatforms, setSelectedPlatforms] = useState([]); 
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedBrands, setSelectedBrands] = useState([]);
    const [selectedGrammages, setSelectedGrammages] = useState([]);
    const [aspRange, setAspRange] = useState({ min: 0, max: 10000 });
    const [categorySearch, setCategorySearch] = useState('');
    const [brandSearch, setBrandSearch] = useState('');

    const [products, setProducts] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [totalProducts, setTotalProducts] = useState(0);
    const [productsError, setProductsError] = useState(false);

    // Fetch filter options on mount
    useEffect(() => {
        const fetchFilterOptions = async () => {
            if (!isOpen) return;
            try {
                const { data } = await axiosInstance.get('/watchtower/compare-sku/filters');
                setFilterOptions({
                    platforms: data.platforms || [],
                    categories: data.categories || [],
                    brands: data.brands || []
                });
            } catch (error) {
                console.error('[AddSkuDrawer] Error fetching filters:', error);
            }
        };
        fetchFilterOptions();
    }, [isOpen]);

    // Fetch products based on filters
    useEffect(() => {
        const fetchProducts = async () => {
            if (!isOpen) return;
            try {
                setIsLoadingProducts(true);
                setProductsError(false);
                const params = new URLSearchParams();
                if (searchQuery) params.set('search', searchQuery);
                if (selectedPlatforms.length) selectedPlatforms.forEach(p => params.append('platform[]', p));
                if (selectedBrands.length) selectedBrands.forEach(b => params.append('brand[]', b));
                if (selectedCategories.length) selectedCategories.forEach(c => params.append('category[]', c));
                
                // Add ASP Range Filter
                if (aspRange.min !== 0 || aspRange.max !== 10000) {
                    params.set('minAsp', aspRange.min);
                    params.set('maxAsp', aspRange.max);
                }

                params.set('limit', '20000'); // User requested no limit

                const { data } = await axiosInstance.get(`/watchtower/compare-sku/products?${params.toString()}`);
                setProducts(data.products || []);
                setTotalProducts(data.total || 0);
            } catch (error) {
                console.error('[AddSkuDrawer] Error fetching products:', error);
                setProductsError(true);
            } finally {
                setIsLoadingProducts(false);
            }
        };

        const timeout = setTimeout(fetchProducts, 300); // debounce API calls
        return () => clearTimeout(timeout);
    }, [isOpen, searchQuery, selectedPlatforms, selectedBrands, selectedCategories, aspRange]);

    const togglePlatform = (id) => {
        setSelectedPlatforms(prev => 
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const toggleCategory = (id) => {
        setSelectedCategories(prev => 
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const toggleBrand = (id) => {
        setSelectedBrands(prev => 
            prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
        );
    };

    const toggleGrammage = (id) => {
        setSelectedGrammages(prev => 
            prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
        );
    };

    const toggleFilter = (key) => {
        setOpenFilters(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleProductSelection = (product) => {
        setSelectedItems(prev => {
            const exists = prev.some(p => p.id === product.id);
            if (exists) {
                return prev.filter(p => p.id !== product.id);
            } else {
                return [...prev, product];
            }
        });
    };

    const handleBulkAdd = () => {
        if (selectedItems.length > 0) {
            onAddSkus(selectedItems);
            setSelectedItems([]);
        }
    };

    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm"
                    />
                    {/* Drawer */}
                    <motion.div 
                        initial={{ x: '100%', opacity: 0.5 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0.5 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
                        className="fixed top-2 bottom-2 right-2 w-[1400px] max-w-[calc(100vw-32px)] z-[1001] bg-[#f8fafc] rounded-[40px] shadow-[0_32px_80px_rgba(15,23,42,0.25)] flex flex-col overflow-hidden border border-white/40"
                    >
                        <div className="flex items-center justify-between px-10 py-7 bg-white/95 backdrop-blur-xl border-b border-slate-100/80 flex-shrink-0 z-20">
                            <div>
                                <h2 className="text-[22px] font-semibold text-[#0f172a] tracking-tight flex items-center gap-4">
                                    Add SKUs 
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50/50 border border-blue-100/30 text-blue-600 shadow-sm shadow-blue-500/5">
                                        <Plus size={14} strokeWidth={3} />
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{totalProducts > 1000 ? '1000+' : totalProducts} Items</span>
                                    </div>
                                </h2>
                                <p className="text-[12.5px] text-slate-400 font-medium mt-1 tracking-tight">Curate and compare products in real-time</p>
                            </div>
                            
                            <div className="flex items-center gap-6 flex-1 max-w-xl mx-12">
                                <div className="relative w-full group">
                                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                    <input 
                                        type="text" 
                                        placeholder="Search by SKU name..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-slate-50/80 border border-slate-100/80 text-[#1e293b] text-[13.5px] font-medium rounded-2xl pl-11 pr-5 py-3 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400/50 transition-all placeholder:text-slate-300 shadow-sm"
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-rose-500 text-slate-400 hover:text-white transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-rose-200 group"
                            >
                                <X size={20} strokeWidth={2.5} className="group-hover:rotate-180 transition-transform duration-500" />
                            </button>
                        </div>

                        {/* Main Body - Sidebar + Grid */}
                        <div className="flex-1 flex overflow-hidden bg-[#f8fafc]">
                            
                            {/* Filter Sidebar - Non-Parallel/Modular Design */}
                            <div className="w-[320px] bg-white border-r border-slate-100/80 overflow-y-auto custom-scrollbar-sm flex flex-col p-7 gap-8 relative z-10">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.25em]">Filters</span>
                                    <button onClick={() => {
                                        setSelectedPlatforms([]);
                                        setSelectedCategories([]);
                                        setSelectedBrands([]);
                                        setSelectedGrammages([]);
                                        setPpuRange({ min: 3, max: 631696 });
                                    }} className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-4 decoration-blue-200">Clear All</button>
                                </div>

                                {/* Platform Section - Interactive Brand Chips */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between group cursor-pointer" onClick={() => toggleFilter('platforms')}>
                                        <h3 className="text-[13px] font-bold text-slate-800 tracking-tight">Platforms</h3>
                                        <ChevronDown size={14} className={cn("text-slate-400 transition-transform", openFilters.platforms && "rotate-180")} />
                                    </div>
                                    <AnimatePresence>
                                        {openFilters.platforms && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden space-y-2 pt-1"
                                            >
                                                {filterOptions.platforms.map(p => (
                                                    <button 
                                                        key={p.id}
                                                        onClick={() => togglePlatform(p.id)}
                                                        className={cn(
                                                            "w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 group active:scale-[0.98]",
                                                            selectedPlatforms.includes(p.id)
                                                                ? "bg-white border-blue-500 shadow-[0_8px_20px_-4px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/10"
                                                                : "bg-slate-50/50 border-transparent hover:border-slate-200 hover:bg-white"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
                                                                selectedPlatforms.includes(p.id) ? "bg-blue-600 border-blue-600 shadow-sm" : "bg-white border-slate-200"
                                                            )}>
                                                                {selectedPlatforms.includes(p.id) && <Check size={12} strokeWidth={4} className="text-white" />}
                                                            </div>
                                                            <span className={cn("text-[12px] font-semibold transition-colors", selectedPlatforms.includes(p.id) ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700")}>
                                                                {p.name}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-300 group-hover:text-slate-400">{p.count}</span>
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Category Section - Chip Grid */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between group cursor-pointer" onClick={() => toggleFilter('category')}>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-[13px] font-semibold text-slate-800 tracking-tight">Category</h3>
                                            <div className="w-1 w-1 bg-slate-200 rounded-full"></div>
                                            <div className={cn("flex items-center justify-center bg-blue-50 text-blue-600 w-6 h-6 rounded-lg transition-transform", isCategoriesExpanded && "bg-slate-100 text-slate-400 w-auto px-2")}>
                                                <Search size={12} strokeWidth={3} onClick={(e) => { e.stopPropagation(); setIsCategoriesExpanded(true); }} />
                                            </div>
                                        </div>
                                        <ChevronDown size={14} className={cn("text-slate-400 transition-transform", openFilters.category && "rotate-180")} />
                                    </div>
                                    <AnimatePresence>
                                        {openFilters.category && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden space-y-3 pt-1"
                                            >
                                                {isCategoriesExpanded && (
                                                    <div className="relative mb-2">
                                                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
                                                        <input 
                                                            type="text" 
                                                            placeholder="Search categories..." 
                                                            value={categorySearch}
                                                            onChange={(e) => setCategorySearch(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-100 text-[11px] font-semibold rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-blue-300 transition-all"
                                                            autoFocus
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(isCategoriesExpanded ? filterOptions.categories : filterOptions.categories.slice(0, 8)).filter(c => !categorySearch || c.name.toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                                                        <button 
                                                            key={c.id}
                                                            onClick={() => toggleCategory(c.id)}
                                                            className={cn(
                                                                "px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all active:scale-95",
                                                                selectedCategories.includes(c.id)
                                                                    ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-200"
                                                                    : "bg-white border-slate-100 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                                                            )}
                                                        >
                                                            {c.name}
                                                        </button>
                                                    ))}
                                                    {!isCategoriesExpanded && filterOptions.categories.length > 8 && (
                                                        <button 
                                                            onClick={() => setIsCategoriesExpanded(true)}
                                                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                        >
                                                            +{filterOptions.categories.length - 8} More
                                                        </button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Brands Section - List with Search */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between group cursor-pointer" onClick={() => toggleFilter('brands')}>
                                        <h3 className="text-[13px] font-semibold text-slate-800 tracking-tight">Brands</h3>
                                        <ChevronDown size={14} className={cn("text-slate-400 transition-transform", openFilters.brands && "rotate-180")} />
                                    </div>
                                    <AnimatePresence>
                                        {openFilters.brands && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden space-y-3 pt-1"
                                            >
                                                <div className="relative">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Search brands..." 
                                                        value={brandSearch}
                                                        onChange={(e) => setBrandSearch(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-100 text-[12px] font-semibold rounded-2xl pl-9 pr-3 py-2 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 transition-all"
                                                    />
                                                </div>
                                                <div className="max-h-[220px] overflow-y-auto no-scrollbar pr-1 space-y-1">
                                                    {(isBrandsExpanded ? filterOptions.brands : filterOptions.brands.slice(0, 6)).filter(b => !brandSearch || b.name.toLowerCase().includes(brandSearch.toLowerCase())).map(b => (
                                                        <div 
                                                            key={b.id} 
                                                            onClick={() => toggleBrand(b.id)}
                                                            className={cn(
                                                                "flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer group/item",
                                                                selectedBrands.includes(b.id) ? "bg-blue-50/50 border-blue-200" : "bg-white border-transparent hover:bg-slate-50"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn(
                                                                    "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                                    selectedBrands.includes(b.id) ? "bg-blue-600 border-blue-600 shadow-sm" : "bg-white border-slate-200 group-hover/item:border-slate-300"
                                                                )}>
                                                                    {selectedBrands.includes(b.id) && <Check size={10} strokeWidth={4} className="text-white" />}
                                                                </div>
                                                                <span className={cn("text-[12px] font-semibold transition-colors", selectedBrands.includes(b.id) ? "text-slate-900" : "text-slate-500")}>
                                                                    {b.name}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-slate-300">{b.count}</span>
                                                        </div>
                                                    ))}
                                                    {!isBrandsExpanded && filterOptions.brands.length > 6 && (
                                                        <button 
                                                            onClick={() => setIsBrandsExpanded(true)}
                                                            className="w-full p-2 text-center text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors mt-1"
                                                        >
                                                            + {filterOptions.brands.length - 6} More
                                                        </button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* ASP Section - Professional Slider */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between group cursor-pointer" onClick={() => toggleFilter('asp')}>
                                        <h3 className="text-[13px] font-bold text-slate-800 tracking-tight">ASP Range</h3>
                                        <ChevronDown size={14} className={cn("text-slate-400 transition-transform", openFilters.asp && "rotate-180")} />
                                    </div>
                                    <AnimatePresence>
                                        {openFilters.asp && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden space-y-4 pt-4 px-2"
                                            >
                                                <PriceRangeSlider 
                                                    min={0} 
                                                    max={10000} 
                                                    onChange={setAspRange} 
                                                />
                                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase pt-2">
                                                    <span>₹0</span>
                                                    <span>₹10,000</span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Empty space for bottom padding */}
                                <div className="pb-8"></div>
                            </div>

                            {/* Main Content Area - Grid Results (6 Columns) */}
                            <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar bg-[#f8fafc] pb-32">
                                {isLoadingProducts ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                        <Loader2 size={32} className="animate-spin mb-4 text-blue-500" />
                                        <p className="font-semibold">Loading SKUs...</p>
                                    </div>
                                ) : productsError ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                                            <AlertTriangle size={28} className="text-rose-400" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-semibold text-slate-700">Failed to load SKUs</p>
                                            <p className="text-xs text-slate-400 mt-1">Please try again</p>
                                        </div>
                                        <button
                                            onClick={() => { setProductsError(false); }}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-[12px] font-bold rounded-xl shadow-lg shadow-slate-900/10 hover:bg-slate-800 hover:-translate-y-0.5 transition-all active:scale-95"
                                        >
                                            <RefreshCw size={14} strokeWidth={2.5} />
                                            Refresh
                                        </button>
                                    </div>
                                ) : products.length === 0 ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                                            <Search size={24} className="text-slate-300" />
                                        </div>
                                        <p className="font-semibold text-slate-500">No SKUs found</p>
                                        <p className="text-sm mt-1">Try adjusting your filters</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                                        {products.map((product, idx) => {
                                            const isSelected = selectedItems.some(item => item.id === product.id);
                                            return (
                                                <motion.div 
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                                                    key={product.id}
                                                    onClick={() => toggleProductSelection(product)}
                                                    className={cn(
                                                        "group relative bg-white rounded-2xl p-4 border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col active:scale-[0.97]",
                                                        isSelected 
                                                            ? "border-blue-500 ring-4 ring-blue-500/10 shadow-lg shadow-blue-500/5 translate-y-[-2px]" 
                                                            : "border-slate-100 hover:border-blue-300 hover:shadow-xl hover:shadow-slate-200/50 hover:translate-y-[-2px]"
                                                    )}
                                                >
                                                    {/* Selection Indicator */}
                                                    <div className="absolute top-3 right-3 z-20">
                                                        <div className={cn(
                                                            "w-6 h-6 rounded-lg border flex items-center justify-center transition-all",
                                                            isSelected ? "bg-blue-600 border-blue-600 shadow-md shadow-blue-500/30" : "bg-slate-50 border-slate-100 group-hover:border-blue-200"
                                                        )}>
                                                            {isSelected && <Check size={12} strokeWidth={4} className="text-white" />}
                                                        </div>
                                                    </div>

                                                    {/* Product Visual Area */}
                                                    <div className="w-full aspect-square bg-[#f1f5f9]/50 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden transition-all duration-500 group-hover:bg-blue-50/50">
                                                        <div className="relative z-10 scale-90 group-hover:scale-105 transition-transform duration-500">
                                                            <ProductImage imageUrl={product.imageUrl} productName={product.name} />
                                                        </div>
                                                        
                                                        {/* Badge on Card */}
                                                        {product.size && (
                                                            <div className="absolute bottom-2 left-2">
                                                                <span className="px-1.5 py-0.5 rounded-lg bg-white/80 backdrop-blur-sm border border-slate-100 shadow-sm text-[8px] font-bold text-slate-800 tracking-tighter uppercase whitespace-nowrap">
                                                                    {product.size}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Details */}
                                                    <div className="flex-1 flex flex-col gap-2 min-w-0 px-1">
                                                        <div className={cn(
                                                            "text-[13px] font-semibold leading-[1.4] line-clamp-2 h-9 transition-colors duration-500 tracking-tight",
                                                            isSelected ? "text-blue-600" : "text-slate-700 group-hover:text-blue-600"
                                                        )}>
                                                            {product.name}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-[8px] font-medium text-slate-400 uppercase tracking-[0.1em] border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-500 group-hover:border-blue-100 transition-all duration-300">
                                                                {product.category || 'NA'}
                                                            </div>
                                                            <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                                                            <span className="text-[11px] font-medium text-slate-400 tabular-nums">₹{product.ppu || '--'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Card Action */}
                                                    <div className={cn(
                                                        "mt-5 py-2.5 w-full rounded-2xl text-[12px] font-medium transition-all duration-500 border flex items-center justify-center gap-2 shadow-sm active:scale-95 group-hover:shadow-[0_20px_40px_-15px_rgba(37,99,235,0.2)]",
                                                        isSelected 
                                                            ? "bg-blue-600 border-blue-600 text-white shadow-blue-500/20" 
                                                            : "bg-white border-slate-200 text-blue-600 group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white"
                                                    )}>
                                                        {isSelected ? "Selected" : "Add Sku"}
                                                        {isSelected ? <Check size={14} strokeWidth={4} /> : <Plus size={14} strokeWidth={3} className="opacity-40 group-hover:opacity-100 transition-all group-hover:translate-x-0.5" />}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Floating Action Menu */}
                        <AnimatePresence>
                            {selectedItems.length > 0 && (
                                <motion.div 
                                    initial={{ y: 150, opacity: 0, scale: 0.9 }}
                                    animate={{ y: 0, opacity: 1, scale: 1 }}
                                    exit={{ y: 150, opacity: 0, scale: 0.9 }}
                                    className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[30] w-auto"
                                >
                                    <div className="bg-slate-950/95 backdrop-blur-xl p-2.5 rounded-[32px] border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.5)] flex items-center gap-4 pr-4">
                                        <div className="flex -space-x-3 pl-3">
                                            {[...Array(Math.min(3, selectedItems.length))].map((_, i) => (
                                                <div key={i} className="w-10 h-10 rounded-xl bg-white border-2 border-slate-900 flex items-center justify-center shadow-lg transform rotate-[-3deg]">
                                                    <div className="w-4 h-8 bg-blue-500 rounded-sm"></div>
                                                </div>
                                            ))}
                                            {selectedItems.length > 3 && (
                                                <div className="w-10 h-10 rounded-xl bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-white text-[10px] font-bold shadow-lg">
                                                    +{selectedItems.length - 3}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="h-8 w-px bg-white/10"></div>

                                        <button 
                                            onClick={handleBulkAdd}
                                            className="bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white pl-8 pr-10 py-3.5 rounded-[22px] text-[14px] font-bold shadow-xl flex items-center gap-3 transition-all group relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none"></div>
                                            Add {selectedItems.length} SKUs
                                            <Check size={18} strokeWidth={4} className="text-white bg-white/20 p-0.5 rounded-full" />
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </>
            )}


            <style jsx>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border: 4px solid #f8fafc;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #94a3b8;
                }
                .custom-scrollbar-sm::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar-sm::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar-sm::-webkit-scrollbar-thumb {
                    background-color: #e2e8f0;
                    border-radius: 4px;
                }
            `}</style>
        </AnimatePresence>
    );
};

export default AddSkuDrawer;
