import { useState, useMemo, useContext, useEffect, useCallback, useRef } from 'react'
import axiosInstance from '../../../api/axiosInstance'
import { motion } from 'framer-motion'
import { FilterContext } from '../../../utils/FilterContext'
import {
    TrendingUp,
    TrendingDown,
    Monitor,
    Tag,
    Calendar,
    Grid3X3,
    Package,
    LineChart,
    MapPin,
    SlidersHorizontal,
    Scale,
    PieChart,
    ChevronDown,
    ExternalLink
} from 'lucide-react'
import AdvancedFilterModal from './AdvancedFilterModal'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../../lib/utils'
import FlipkartLogo from '@/lib/Flipkart logo.png'
import { copyToClipboard } from '../../../utils/clipboard'

/* --- HELPER COMPONENTS & UTILS --- */
const isEcomChannel = (chan) => chan && chan.toLowerCase().includes('ecom');

// Platform classification helpers for KPI visibility
const QCOM_PLATFORM_NAMES = ['blinkit', 'zepto', 'swiggy', 'instamart', 'bbnow', 'minutes', 'quickcomm', 'quick commerce'];
const isQcomPlatform = (name) => {
    if (!name) return false;
    const n = name.toLowerCase();
    return QCOM_PLATFORM_NAMES.some(p => n.includes(p));
};

const isEcomPlatform = (name) => {
    if (!name) return false;
    if (isQcomPlatform(name)) return false; // Prevent 'flipkart minutes' from matching ecom
    const n = name.toLowerCase();
    return ['amazon', 'flipkart', 'myntra', 'nykaa', 'jiomart', 'ecom'].some(p => n.includes(p));
};

const isBuyBoxPlatform = (name) => {
    if (!name || name === 'All') return false;
    if (isQcomPlatform(name)) return false;
    const n = name.toLowerCase().trim();
    return n.includes('amazon') || n.includes('flipkart');
};

// KPIs that are ecom-only at SKU level (not shown for qcom platforms)
const SKU_ECOM_ONLY_KPIS = ['spend', 'conversion', 'cpc', 'roas_x'];
const BrandLogo = ({ name, src, className, imgClassName }) => {
    const [error, setError] = useState(false);

    if (error || !src) {
        return (
            <div className={cn("flex items-center justify-center font-bold text-white uppercase", className)}
                style={{ fontSize: '10px' }}>
                {name?.slice(0, 1) || '?'}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={name}
            className={cn(className, "object-contain")}
            onError={() => setError(true)}
        />
    );
};

const getStatusText = (delta) => {
    if (!delta) return "text-slate-500";
    return delta.dir === 'up' ? "text-emerald-500" : "text-rose-500";
};


// Truncate text to a given number of words, appending "..." if truncated
const truncateToWords = (text, maxWords = 5) => {
    if (!text) return '';
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
};

const cardSize = {
    minW: 'min-w-[100px] sm:min-w-[125px]',
    py: 'py-2 sm:py-2.5',
    text: 'text-[13px] sm:text-[15px]',
    delta: 'text-[9px] sm:text-[10px]'
};

const kpiLabels = {
    offtakes: 'Offtakes',
    quantitySold: 'Quantity Sold',
    spend: 'Spend',
    tacos: 'TACoS',
    roas_x: 'ROAS',
    availability: 'Availability',
    marketShare: 'Market share',
    conversion: 'Conversion',
    shareOfVolume: 'SHARE OF SEARCH',
    ad_sov: 'Ad SOV',
    organic_sov: 'Organic SOV',
    inorgSales: 'Inorganic Sales',
    asp: 'ASP',
    categorySize: 'Category Size',
    discount: 'Promo',
    deliveryTime: 'Delivery Time',
    aov: 'AOV'
};

// Map backend KPI title → frontend kpiKey
const BACKEND_TITLE_TO_KEY = {
    'Offtakes': 'offtakes',
    'Quantity Sold': 'quantitySold',
    'Spend': 'spend',
    'TACoS': 'tacos',
    'ROAS': 'roas_x',
    'Inorg Sales': 'inorgSales',
    'Conversion': 'conversion',
    'Availability': 'availability',
    'SOS': 'shareOfVolume',
    'Share of Search': 'shareOfVolume',
    'Ad SOV': 'ad_sov',
    'Organic SOV': 'organic_sov',
    'Market Share': 'marketShare',
    'Category Size': 'categorySize',
    'CPM': 'cpm',
    'CPC': 'cpc',
    'ASP': 'asp',
    'Promo': 'discount',
    'Promo-My': 'discount',
    'Promo Compete': 'promoCompete',
    'Buy Box %': 'buyBoxPct',
    'Delivery Time': 'deliveryTime',
    'AOV': 'aov'
}

// Map backend API response entity → frontend entity format
const mapApiEntityToFrontend = (apiEntity) => {
    const data = {}
    if (apiEntity.columns && Array.isArray(apiEntity.columns)) {
        apiEntity.columns.forEach(col => {
            const key = BACKEND_TITLE_TO_KEY[col.title]
            if (key) {
                const changeText = col.change?.text || '0%'
                const isPositive = col.change?.positive !== false
                data[key] = {
                    value: col.value || '0',
                    rawVal: col.rawVal ?? col.rawValue ?? null,
                    meta: col.meta || null,
                    delta: {
                        value: changeText.replace(/^[+-]/, ''),
                        dir: isPositive ? 'up' : 'down'
                    }
                }
            }
        })
    }
    return data
}

const getFullDisplayValue = (kpiKey, cell) => {
    if (!cell || cell?.value === 'N/A' || cell?.value === undefined) return 'N/A';
    if (kpiKey === 'quantitySold' || kpiKey === 'offtakes') {
        if (cell.rawVal !== undefined && cell.rawVal !== null && !isNaN(cell.rawVal)) {
            return Math.round(Number(cell.rawVal)).toLocaleString('en-IN');
        }
        const cleanStr = String(cell.value).replace(/,/g, '').trim();
        const numMatch = cleanStr.match(/-?[\d.]+/);
        if (numMatch) {
            let val = parseFloat(numMatch[0]);
            if (!isNaN(val)) {
                const lower = cleanStr.toLowerCase();
                if (lower.includes('cr')) val *= 10000000;
                else if (lower.includes('lac') || lower.includes('lak') || lower.includes('lakh')) val *= 100000;
                else if (lower.includes('m')) val *= 1000000;
                else if (lower.includes('k')) val *= 1000;

                return Math.round(val).toLocaleString('en-IN');
            }
        }
    }
    return cell?.value || '0';
};

// Dimension → API endpoint mapping
const DIMENSION_API_MAP = {
    platform: '/watchtower/platform-overview',
    brand: '/watchtower/brands-overview',
    month: '/watchtower/month-overview',
    category: '/watchtower/category-overview',
    sku: '/watchtower/sku-overview',
}

// Color palette for dynamically created entities
const ENTITY_COLORS = ['#6366f1', '#8b5cf6', '#f97316', '#14b8a6', '#e11d48', '#06b6d4', '#0ea5e9', '#22c55e', '#eab308', '#ec4899', '#a855f7', '#f43f5e']

const PlatformOverviewNew = ({
    onViewTrends = () => { },
    onViewRca = () => { },
}) => {
    const {
        platform: globalPlatform,
        setPlatform,
        selectedBrand,
        setSelectedBrand,
        brands: globalBrands,
        selectedCategory,
        setSelectedCategory,
        categories: globalCategories,
        selectedLocation,
        selectedChannel,
        platforms: globalPlatforms,
        timeStart,
        timeEnd,
        compareStart,
        compareEnd,
        datesFetched,
        platformsFetched,
        selectedMsl,
        setSelectedMsl
    } = useContext(FilterContext);

    const kpis = [
        { key: 'offtakes', label: 'Offtakes' },
        { key: 'quantitySold', label: 'Quantity Sold' },
        { key: 'spend', label: 'Spend' },
        { key: 'tacos', label: 'TACoS' },
        { key: 'roas_x', label: 'ROAS' },
        { key: 'inorgSales', label: 'Inorg Sales' },
        { key: 'conversion', label: 'Conversion' },
        { key: 'availability', label: 'Availability' },
        { key: 'shareOfVolume', label: 'Share of Search' },
        { key: 'ad_sov', label: 'Ad SOV' },
        { key: 'organic_sov', label: 'Organic SOV' },
        { key: 'cpm', label: 'CPM' },
        { key: 'cpc', label: 'CPC' },
        { key: 'asp', label: 'ASP' },
        { key: 'marketShare', label: 'Market Share' },
        { key: 'categorySize', label: 'Category Size' },
        { key: 'buyBoxPct', label: 'Buy Box %' },
        { key: 'deliveryTime', label: 'Delivery Time' },
        { key: 'aov', label: 'AOV' },
    ]
    const [dimension, setDimension] = useState('platform')
    const [localPlatformFilter, setLocalPlatformFilter] = useState('All')
    const [skuPlatformFilter, setSkuPlatformFilter] = useState('All')
    const [toastMessage, setToastMessage] = useState('');

    const handleCopy = async (title, value) => {
        try {
            await copyToClipboard(`${title}: ${value}`);
            setToastMessage(`Copied: ${value}`);
            setTimeout(() => setToastMessage(''), 2500);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    // Initialize default local platform filters to 'All' ONCE on mount
    const isInitializedRef = useRef(false);
    useEffect(() => {
        if (!isInitializedRef.current && globalPlatforms?.length > 0) {
            isInitializedRef.current = true;
            setLocalPlatformFilter('All');
            setSkuPlatformFilter('All');
        }
    }, [globalPlatforms]);

    // Determine the active platform filter for non-platform, non-sku dimensions
    // (Brand, Category, Month now use a platform dropdown instead of channel)
    const activePlatformFilter = (dimension !== 'platform' && dimension !== 'sku')
        ? (localPlatformFilter || 'All')
        : 'All';

    // Derive isEcom / isQuick from the selected platform name
    const isEcom = activePlatformFilter !== 'All' && isEcomPlatform(activePlatformFilter);
    const isQuick = activePlatformFilter !== 'All' && isQcomPlatform(activePlatformFilter);

    // For SKU dimension: determine if selected platform is qcom
    const isSkuQcom = dimension === 'sku' && skuPlatformFilter !== 'All' && isQcomPlatform(skuPlatformFilter);
    const isSkuEcom = dimension === 'sku' && skuPlatformFilter !== 'All' && isEcomPlatform(skuPlatformFilter);

    // Filter out unwanted KPIs
    const filteredKpis = useMemo(() => {
        let baseKpis = kpis;
        const activePlat = dimension === 'sku' ? skuPlatformFilter : activePlatformFilter;
        const allowBuyBox = isBuyBoxPlatform(activePlat);

        if (dimension === 'platform' || !allowBuyBox) {
            baseKpis = baseKpis.filter(k => k.key !== 'buyBoxPct');
        }
        if (dimension === 'platform') {
            baseKpis = baseKpis.filter(k => k.key !== 'deliveryTime');
        }

        if (isEcom) {
            baseKpis = baseKpis.filter(k => k.key !== 'categorySize' && k.key !== 'marketShare' && k.key !== 'cpm');
        } else if (isQuick) {
            baseKpis = baseKpis.filter(k => k.key !== 'buyBoxPct' && k.key !== 'deliveryTime' && k.key !== 'cpc');
        } else {
            baseKpis = baseKpis.filter(k => k.key !== 'buyBoxPct' && k.key !== 'deliveryTime');
        }

        if (dimension === 'sku') {
            return baseKpis.filter(k => {
                if (k.key === 'categorySize' || k.key === 'shareOfVolume' || k.key === 'ad_sov' || k.key === 'organic_sov') return false;
                // CPM is never shown at SKU level
                if (k.key === 'cpm') return false;
                // Spend/Conversion/CPC are ecom-only at SKU level
                if (isSkuQcom && SKU_ECOM_ONLY_KPIS.includes(k.key)) return false;
                return true;
            });
        }
        if (dimension === 'brand') return baseKpis.filter(k => k.key !== 'categorySize' && k.key !== 'marketShare');
        return baseKpis;
    }, [dimension, activePlatformFilter, skuPlatformFilter, isEcom, isQuick, isSkuQcom]);

    const defaultKpiKeys = useMemo(() => {
        let base = ['offtakes', 'quantitySold', 'spend', 'tacos', 'roas_x', 'availability', 'conversion', 'aov'];
        const activePlat = dimension === 'sku' ? skuPlatformFilter : activePlatformFilter;
        const allowBuyBox = isBuyBoxPlatform(activePlat);

        if (dimension === 'platform') {
            base.push('marketShare', 'categorySize');
            if (isEcom) base.push('cpc');
            else if (isQuick) base.push('cpm');
            else base.push('cpc', 'cpm');
        } else {
            if (isEcom) {
                if (allowBuyBox) base.push('buyBoxPct');
                base.push('deliveryTime', 'cpc');
            } else if (isQuick) {
                base.push('marketShare', 'categorySize', 'cpm');
            } else {
                if (allowBuyBox) base.push('buyBoxPct');
                base.push('marketShare', 'categorySize', 'cpc', 'cpm');
            }
        }

        if (dimension === 'sku') {
            let skuBase = base.filter(k => k !== 'categorySize' && k !== 'shareOfVolume' && k !== 'ad_sov' && k !== 'organic_sov' && k !== 'cpm');
            if (!allowBuyBox) skuBase = skuBase.filter(k => k !== 'buyBoxPct');
            if (isSkuQcom) {
                skuBase = skuBase.filter(k => !SKU_ECOM_ONLY_KPIS.includes(k));
            }
            return skuBase;
        }
        if (dimension === 'brand') {
            let brandBase = base.filter(k => k !== 'categorySize' && k !== 'marketShare');
            if (!allowBuyBox) brandBase = brandBase.filter(k => k !== 'buyBoxPct');
            return brandBase;
        }
        if (!allowBuyBox) base = base.filter(k => k !== 'buyBoxPct');
        return base;
    }, [dimension, activePlatformFilter, skuPlatformFilter, isEcom, isQuick, isSkuQcom]);

    const [glanceKpis, setGlanceKpis] = useState(['offtakes', 'quantitySold', 'spend', 'tacos', 'roas_x', 'availability', 'marketShare', 'categorySize', 'conversion', 'cpc'])
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
    const navigate = useNavigate()
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(50)
    const [apiData, setApiData] = useState({})
    const [apiLoading, setApiLoading] = useState(true)
    const [apiError, setApiError] = useState(null)
    const [isRetrying, setIsRetrying] = useState(false)
    const [productOptions, setProductOptions] = useState([])
    const [advancedFilters, setAdvancedFilters] = useState({
        brands: [],
        categories: [],
        platforms: [],
        skus: [],
        skuName: '',
        skuCode: '',
        dateFrom: '',
        dateTo: '',
        msl: '0',
        kpis: defaultKpiKeys,
        filterLogic: 'OR',
    })
    const fetchIdRef = useRef(0)

    // Reset advanced filters when global filters are reset to defaults
    useEffect(() => {
        const isGlobalPlatformReset = globalPlatform === "All" || (Array.isArray(globalPlatform) && globalPlatform.includes("All")) || globalPlatform === "";
        const isGlobalBrandReset = selectedBrand === "All";
        const isGlobalCategoryReset = selectedCategory === "All";
        const isGlobalLocationReset = selectedLocation === "All";

        if (isGlobalPlatformReset && isGlobalBrandReset && isGlobalCategoryReset && isGlobalLocationReset) {
            setAdvancedFilters({
                brands: [],
                categories: [],
                platforms: [],
                skus: [],
                skuName: '',
                skuCode: '',
                dateFrom: '',
                dateTo: '',
                msl: '0',
                kpis: defaultKpiKeys,
                filterLogic: 'OR',
            });
        }
    }, [globalPlatform, selectedBrand, selectedCategory, selectedLocation, defaultKpiKeys]);

    // Re-sync glanceKpis when dimension changes or channel/platform changes
    useEffect(() => {
        const activePlat = dimension === 'sku' ? skuPlatformFilter : activePlatformFilter;
        const allowBuyBox = isBuyBoxPlatform(activePlat);

        if (dimension === 'sku') {
            setGlanceKpis(prev => {
                let next = prev.filter(k => {
                    if (k === 'categorySize' || k === 'shareOfVolume' || k === 'ad_sov' || k === 'organic_sov') return false;
                    // CPM never shown at SKU level
                    if (k === 'cpm') return false;
                    if (!allowBuyBox && k === 'buyBoxPct') return false;
                    // Spend/Conversion/CPC are ecom-only at SKU level
                    if (isSkuQcom && SKU_ECOM_ONLY_KPIS.includes(k)) return false;
                    return true;
                });
                // Ensure ecom-only KPIs are added back when switching to ecom/All
                if (!isSkuQcom) {
                    SKU_ECOM_ONLY_KPIS.forEach(k => {
                        if (!next.includes(k)) next.push(k);
                    });
                }
                return next;
            });
        } else if (dimension === 'brand') {
            setGlanceKpis(prev => {
                let next = prev.filter(k => k !== 'categorySize' && k !== 'marketShare');
                if (!next.includes('spend')) next.push('spend');
                if (!next.includes('conversion')) next.push('conversion');
                if (isEcom) {
                    next = next.filter(k => k !== 'cpm');
                    if (allowBuyBox) {
                        if (!next.includes('buyBoxPct')) next.push('buyBoxPct');
                    } else {
                        next = next.filter(k => k !== 'buyBoxPct');
                    }
                    if (!next.includes('deliveryTime')) next.push('deliveryTime');
                    if (!next.includes('cpc')) next.push('cpc');
                } else if (isQuick) {
                    next = next.filter(k => k !== 'buyBoxPct' && k !== 'deliveryTime' && k !== 'cpc');
                    if (!next.includes('cpm')) next.push('cpm');
                } else {
                    next = next.filter(k => k !== 'deliveryTime');
                    if (allowBuyBox) {
                        if (!next.includes('buyBoxPct')) next.push('buyBoxPct');
                    } else {
                        next = next.filter(k => k !== 'buyBoxPct');
                    }
                    if (!next.includes('cpc')) next.push('cpc');
                    if (!next.includes('cpm')) next.push('cpm');
                }
                return next;
            });
        } else if (dimension === 'platform') {
            setGlanceKpis(prev => {
                let next = prev.filter(k => k !== 'buyBoxPct' && k !== 'deliveryTime');
                if (!next.includes('categorySize')) next.push('categorySize');
                if (!next.includes('spend')) next.push('spend');
                if (!next.includes('conversion')) next.push('conversion');
                if (!next.includes('marketShare')) next.push('marketShare');
                if (isEcom) {
                    next = next.filter(k => k !== 'cpm');
                    if (!next.includes('cpc')) next.push('cpc');
                } else if (isQuick) {
                    next = next.filter(k => k !== 'cpc');
                    if (!next.includes('cpm')) next.push('cpm');
                } else {
                    if (!next.includes('cpc')) next.push('cpc');
                    if (!next.includes('cpm')) next.push('cpm');
                }
                return next;
            });
        } else {
            // month, category
            setGlanceKpis(prev => {
                let next = [...prev];
                if (isEcom) {
                    next = next.filter(k => k !== 'categorySize' && k !== 'marketShare' && k !== 'cpm');
                    if (!next.includes('spend')) next.push('spend');
                    if (!next.includes('conversion')) next.push('conversion');
                    if (allowBuyBox) {
                        if (!next.includes('buyBoxPct')) next.push('buyBoxPct');
                    } else {
                        next = next.filter(k => k !== 'buyBoxPct');
                    }
                    if (!next.includes('deliveryTime')) next.push('deliveryTime');
                    if (!next.includes('cpc')) next.push('cpc');
                } else if (isQuick) {
                    next = next.filter(k => k !== 'buyBoxPct' && k !== 'deliveryTime' && k !== 'cpc');
                    if (!next.includes('categorySize')) next.push('categorySize');
                    if (!next.includes('spend')) next.push('spend');
                    if (!next.includes('conversion')) next.push('conversion');
                    if (!next.includes('marketShare')) next.push('marketShare');
                    if (!next.includes('cpm')) next.push('cpm');
                } else {
                    next = next.filter(k => k !== 'deliveryTime');
                    if (allowBuyBox) {
                        if (!next.includes('buyBoxPct')) next.push('buyBoxPct');
                    } else {
                        next = next.filter(k => k !== 'buyBoxPct');
                    }
                    if (!next.includes('categorySize')) next.push('categorySize');
                    if (!next.includes('spend')) next.push('spend');
                    if (!next.includes('conversion')) next.push('conversion');
                    if (!next.includes('marketShare')) next.push('marketShare');
                    if (!next.includes('cpc')) next.push('cpc');
                    if (!next.includes('cpm')) next.push('cpm');
                }
                return next;
            });
        }
    }, [dimension, activePlatformFilter, skuPlatformFilter]);



    // Static dimension metadata (icons, logos for known platforms)
    const dimensionMeta = {
        platform: { label: 'Platform', icon: Monitor },
        brand: { label: 'Brand', icon: Tag },
        month: { label: 'Month', icon: Calendar },
        category: { label: 'Category', icon: Grid3X3 },
        sku: { label: 'SKU', icon: Package },
    }

    // Known platform logos for enriching API data
    const platformLogos = {
        'blinkit': 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Blinkit-yellow-app-icon.svg',
        'instamart': '\instamart_photo.png',
        'swiggy instamart': '\instamart_photo.png',
        'swiggy': '\instamart_photo.png',
        'zepto': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Zepto_Logo.svg',
        'flipkart': FlipkartLogo,
        'amazon': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
    }
    const platformColors = {
        'blinkit': '#fbbf24', 'instamart': '#f97316', 'swiggy instamart': '#f97316', 'swiggy': '#f97316',
        'zepto': '#8b5cf6', 'flipkart': '#2874f0', 'amazon': '#f59e0b',
    }

    const filterKey = useMemo(() => {
        // For SKU dimension, use the local skuPlatformFilter to override platform
        // For Brand/Category/Month, use localPlatformFilter to override platform
        let reqPlatform;
        if (dimension === 'sku') {
            reqPlatform = skuPlatformFilter || 'All';
        } else if (dimension !== 'platform') {
            reqPlatform = localPlatformFilter || 'All';
        } else {
            reqPlatform = advancedFilters.platforms?.length > 0 ? advancedFilters.platforms.join(',')
                : 'All';
        }
        const reqBrand = advancedFilters.brands?.length > 0 ? advancedFilters.brands.join(',')
            : (selectedBrand && selectedBrand !== 'All' ? (Array.isArray(selectedBrand) ? selectedBrand.join(',') : selectedBrand) : '');
        const reqCategory = advancedFilters.categories?.length > 0 ? advancedFilters.categories.join(',')
            : (selectedCategory === 'All' ? 'All' : (Array.isArray(selectedCategory) ? selectedCategory.join(',') : selectedCategory));
        const reqStartDate = advancedFilters.dateFrom || (timeStart ? timeStart.format('YYYY-MM-DD') : '');
        const reqEndDate = advancedFilters.dateTo || (timeEnd ? timeEnd.format('YYYY-MM-DD') : '');
        const reqCompareStart = compareStart ? compareStart.format('YYYY-MM-DD') : '';
        const reqCompareEnd = compareEnd ? compareEnd.format('YYYY-MM-DD') : '';
        const reqLocation = selectedLocation === 'All' ? 'All' : (Array.isArray(selectedLocation) ? selectedLocation.join(',') : selectedLocation);

        const reqChannel = selectedChannel === 'All' ? undefined : selectedChannel;

        return JSON.stringify({
            dimension,
            reqPlatform,
            reqBrand,
            reqCategory,
            reqLocation,
            reqChannel,
            reqStartDate,
            reqEndDate,
            reqCompareStart,
            reqCompareEnd,
            skuPlatformFilter: dimension === 'sku' ? skuPlatformFilter : undefined,
            localPlatformFilter: (dimension !== 'platform' && dimension !== 'sku') ? localPlatformFilter : undefined,
            advancedFilters: {
                skuName: advancedFilters.skuName,
                skuCode: advancedFilters.skuCode,
                filterLogic: advancedFilters.filterLogic,
                msl: advancedFilters.msl
            },
            selectedMsl
        });
    }, [dimension, globalPlatform, selectedBrand, selectedCategory, selectedLocation, selectedChannel, timeStart, timeEnd, compareStart, compareEnd, localPlatformFilter, advancedFilters, skuPlatformFilter, selectedMsl]);

    // Fetch data from backend API when filters change (stable version)
    const fetchDimensionData = useCallback(async (currentFetchId) => {
        const endpoint = DIMENSION_API_MAP[dimension]
        if (!endpoint) return

        setApiError(null)
        try {
            const parsed = JSON.parse(filterKey);
            const params = {
                platform: parsed.reqPlatform === 'All' ? undefined : parsed.reqPlatform,
                brand: parsed.reqBrand || undefined,
                category: parsed.reqCategory === 'All' ? undefined : parsed.reqCategory,
                channel: parsed.reqChannel || undefined,
                location: parsed.reqLocation === 'All' ? undefined : parsed.reqLocation,
                startDate: parsed.reqStartDate || undefined,
                endDate: parsed.reqEndDate || undefined,
                compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : undefined,
                compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : undefined,
                skuName: parsed.advancedFilters.skuName || undefined,
                skuCode: parsed.advancedFilters.skuCode || undefined,
                filterLogic: parsed.advancedFilters.filterLogic || 'OR',
                msl: (parsed.selectedMsl && parsed.selectedMsl !== 'All') ? (Array.isArray(parsed.selectedMsl) ? parsed.selectedMsl.join(',') : parsed.selectedMsl) : (parsed.advancedFilters.msl === '1' ? '1' : undefined)
            };

            console.log(`[PlatformOverviewNew] Fetching ${dimension} data`, params)
            const res = await axiosInstance.get(endpoint, { params, timeout: 60000 })

            // Only update state if this is still the most recent fetch
            if (currentFetchId !== fetchIdRef.current) return;

            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                console.log(`[PlatformOverviewNew] Got ${res.data.length} ${dimension} entities`)
                setApiData(prev => ({ ...prev, [dimension]: res.data }))
            } else {
                setApiData(prev => ({ ...prev, [dimension]: [] }))
            }
        } catch (err) {
            if (currentFetchId === fetchIdRef.current) {
                console.error(`[PlatformOverviewNew] API error:`, err.message)
                setApiError(err.message || `Failed to load ${dimension} data`)
                setApiData(prev => ({ ...prev, [dimension]: null }))
            }
        } finally {
            if (currentFetchId === fetchIdRef.current) {
                setApiLoading(false)
            }
        }
    }, [dimension, filterKey, compareStart, compareEnd]);

    // Use a ref so the effect doesn't re-fire when fetchDimensionData is recreated
    const fetchDimensionDataRef = useRef(fetchDimensionData);
    fetchDimensionDataRef.current = fetchDimensionData;

    // Sync loading state with filterKey changes to prevent flicker
    const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
    if (prevFilterKey !== filterKey) {
        setPrevFilterKey(filterKey);
        setApiLoading(true);
        setApiError(null);
        setCurrentPage(1);
    }

    const lastFetchedKey = useRef(null);

    useEffect(() => {
        // Wait for essential context data
        if (!datesFetched || !platformsFetched) return;

        if (lastFetchedKey.current === filterKey) {
            setApiLoading(false);
            return;
        }

        const currentFetchId = ++fetchIdRef.current;

        const debounceTimer = setTimeout(() => {
            if (currentFetchId !== fetchIdRef.current) {
                setApiLoading(false);
                return;
            }
            lastFetchedKey.current = filterKey;
            fetchDimensionDataRef.current(currentFetchId);
        }, 50);

        return () => clearTimeout(debounceTimer);
    }, [filterKey, datesFetched, platformsFetched]);

    // Fetch product/SKU options from DB for the filter dropdown
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const params = {};
                if (globalPlatform && globalPlatform !== 'All') {
                    params.platform = Array.isArray(globalPlatform) ? globalPlatform[0] : globalPlatform;
                }
                const res = await axiosInstance.get('/watchtower/products', { params });
                if (res.data && Array.isArray(res.data)) {
                    setProductOptions(res.data.map(p => ({ id: p, name: p })));
                }
            } catch (err) {
                console.warn('[PlatformOverviewNew] Failed to fetch products for filter:', err.message);
            }
        };
        if (datesFetched) {
            fetchProducts();
        }
    }, [datesFetched, globalPlatform])

    // Retry function for error state
    const retryFetch = async () => {
        setIsRetrying(true)
        setApiLoading(true)
        setApiError(null)
        // Reset lastFetchedKey so the effect will re-trigger the fetch
        lastFetchedKey.current = null;
        const currentFetchId = ++fetchIdRef.current;
        await fetchDimensionDataRef.current(currentFetchId)
        setIsRetrying(false)
    }

    // Handle filter apply from modal
    const handleApplyFilters = (filters) => {
        setAdvancedFilters(filters);
        setGlanceKpis(filters.kpis);

        // Synchronize back to global FilterContext so top blue filter button stays in 2-way sync
        if (filters.categories && filters.categories.length > 0) {
            setSelectedCategory(filters.categories.length === 1 ? filters.categories[0] : filters.categories);
        } else if (filters.categories && filters.categories.length === 0) {
            setSelectedCategory('All');
        }

        if (filters.brands && filters.brands.length > 0) {
            setSelectedBrand(filters.brands.length === 1 ? filters.brands[0] : filters.brands);
        } else if (filters.brands && filters.brands.length === 0) {
            setSelectedBrand('All');
        }

        if (filters.platforms && filters.platforms.length > 0) {
            setPlatform(filters.platforms.length === 1 ? filters.platforms[0] : filters.platforms);
        } else if (filters.platforms && filters.platforms.length === 0) {
            setPlatform('All');
        }

        if (filters.msl !== undefined && setSelectedMsl) {
            setSelectedMsl(filters.msl);
        }
    };
    // Count active dimension filters
    const activeDimensionFilters = [
        advancedFilters.brands?.length > 0,
        advancedFilters.categories?.length > 0,
        advancedFilters.platforms?.length > 0,
        advancedFilters.skuName?.length > 0,
        advancedFilters.skuCode?.length > 0,
        advancedFilters.msl === '1',
    ].filter(Boolean).length

    const currentDimension = dimensionMeta[dimension] || dimensionMeta.platform
    // Get selected KPIs in order
    const selectedKpis = filteredKpis.filter(k => glanceKpis.includes(k.key))
    const kpiCount = selectedKpis.length

    // Build entities from API data only — NO hardcoded fallback
    const entities = useMemo(() => {
        const rawApiEntities = apiData[dimension]

        let result = []
        if (rawApiEntities && rawApiEntities.length > 0) {
            // Use real API data
            result = rawApiEntities.map((apiEntity, idx) => {
                const key = (apiEntity.key || apiEntity.label || `entity-${idx}`).toLowerCase()
                const name = apiEntity.label || apiEntity.key || `Entity ${idx + 1}`
                const logoSrc = apiEntity.logo || platformLogos[key] || null
                const color = platformColors[key] || ENTITY_COLORS[idx % ENTITY_COLORS.length]
                return {
                    key,
                    name,
                    logoSrc,
                    color,
                    offtakeShare: apiEntity.offtakeShare,
                    page_url: apiEntity.page_url || null,
                    data: mapApiEntityToFrontend(apiEntity)
                }
            })
        }

        // Check if user has any platform restriction in their tabPermissions
        const ALL_ROW_IDENTIFIERS = ['all', 'overall', 'odd_overall'];
        let hasRestrictedPlatforms = false;
        try {
            const storedUser = JSON.parse(sessionStorage.getItem('user') || sessionStorage.getItem('kiryana_user') || '{}');
            const tabPerms = storedUser?.tabPermissions || {};
            hasRestrictedPlatforms = Object.keys(tabPerms).some(
                key => key.startsWith('platform_') && tabPerms[key] === false
            );
        } catch (_) { /* ignore */ }

        // When dimension is 'platform', show all platform rows (remove the 'All' aggregate row when filtered)
        if (dimension === 'platform' && ((globalPlatform && globalPlatform !== 'All') || hasRestrictedPlatforms)) {
            result = result.filter(e => {
                const entityKey = e.key.toLowerCase()
                const entityName = e.name.toLowerCase()
                return !ALL_ROW_IDENTIFIERS.includes(entityKey) && !ALL_ROW_IDENTIFIERS.includes(entityName)
            })
        }

        // Sort platform overview list in order: Blinkit, Instamart, Zepto, Flipkart, Amazon
        if (dimension === 'platform') {
            const getPlatformOrderIndex = (key) => {
                const k = (key || '').toLowerCase();
                if (k.includes('blinkit')) return 1;
                if (k.includes('instamart') || k.includes('swiggy')) return 2;
                if (k.includes('zepto')) return 3;
                if (k.includes('flipkart')) return 4;
                if (k.includes('amazon')) return 5;
                if (k.includes('myntra')) return 6;
                if (k.includes('nykaa')) return 7;
                if (k.includes('jiomart')) return 8;
                if (k.includes('bbnow')) return 9;
                return 100;
            };
            result.sort((a, b) => getPlatformOrderIndex(a.key || a.name) - getPlatformOrderIndex(b.key || b.name));
        }

        // Sort by market share descending if dimension is brand
        if (dimension === 'brand') {
            result.sort((a, b) => {
                const parsePct = (s) => parseFloat(String(s || '0').replace(/[^\d.]/g, '')) || 0;
                const valA = parsePct(a.data?.marketShare?.value);
                const valB = parsePct(b.data?.marketShare?.value);
                return valB - valA;
            });
        }

        return result
    }, [apiData, dimension, globalPlatform, localPlatformFilter, skuPlatformFilter])


    // Pagination logic
    const totalPages = Math.ceil(entities.length / pageSize)
    const paginatedEntities = useMemo(() => {
        return entities.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    }, [entities, currentPage, pageSize])

    const SectionWrapper = ({
        title,
        icon: Icon,
        children,
        className = '',
        chip,
        headerRight
    }) => {
        return (
            <motion.div
                className={`bg-white rounded-3xl shadow-lg border border-slate-100/60 ${className}`}
                style={{ boxShadow: '0 2px 0px rgba(0, 0, 0, 0.04)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                {/* Header */}
                <div className="px-3 py-3 sm:px-6 sm:py-4 border-b border-slate-100/60">
                    <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
                        {/* Left: Icon + Title + Chip */}
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                <Icon size={18} className="text-blue-600 sm:w-5 sm:h-5" />
                            </div>
                            <span className="text-[14px] sm:text-[17px] font-bold text-slate-900" style={{ fontFamily: 'Roboto, sans-serif' }}>{title}</span>
                            {/* {chip && (
                                <span className="px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-full border border-slate-200">
                                    {chip}
                                </span>
                            )} */}
                        </div>

                        {/* Right: Custom Actions */}
                        {headerRight && (
                            <div className="flex items-center gap-3">
                                {headerRight}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-3 sm:p-6">
                    {children}
                </div>
            </motion.div>
        )
    }
    return (
        <>
            <div>
                {/* SECTION 2: Performance Matrix - Wrapped in PowerBI Container */}
                <SectionWrapper
                    title="Platform Overview"
                    icon={currentDimension.icon}
                    chip={`${entities.length} ${currentDimension.label} × ${kpiCount} KPIs`}
                    headerRight={
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            {/* SKU dimension: Platform dropdown (single-select) instead of Channel */}
                            {dimension === 'sku' && (
                                <div className="relative flex items-center">
                                    <select
                                        value={skuPlatformFilter === 'All' ? 'All' : (globalPlatforms?.find(p => p.toLowerCase() === (skuPlatformFilter || '').toLowerCase()) || skuPlatformFilter || 'All')}
                                        onChange={(e) => setSkuPlatformFilter(e.target.value)}
                                        className="appearance-none bg-indigo-50 border border-indigo-100 text-indigo-700 py-1.5 pl-3 pr-8 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-xs shadow-sm cursor-pointer transition-all hover:bg-indigo-100/50"
                                        style={{ fontFamily: 'Roboto, sans-serif' }}
                                    >
                                        <option value="All">All Platforms</option>
                                        {globalPlatforms?.filter(p => p !== 'All').map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" size={14} />
                                </div>
                            )}
                            {/* Platform Dropdown for non-platform, non-sku dimensions (Brand, Category, Month) */}
                            {dimension !== 'platform' && dimension !== 'sku' && (
                                <div className="relative flex items-center">
                                    <select
                                        value={localPlatformFilter === 'All' ? 'All' : (globalPlatforms?.find(p => p.toLowerCase() === (localPlatformFilter || '').toLowerCase()) || localPlatformFilter || 'All')}
                                        onChange={(e) => setLocalPlatformFilter(e.target.value)}
                                        className="appearance-none bg-blue-50 border border-blue-100 text-blue-700 py-1.5 pl-3 pr-8 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-xs shadow-sm cursor-pointer transition-all hover:bg-blue-100/50"
                                        style={{ fontFamily: 'Roboto, sans-serif' }}
                                    >
                                        <option value="All">All Platforms</option>
                                        {globalPlatforms?.filter(p => p !== 'All').map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" size={14} />
                                </div>
                            )}

                            {/* Dimension Tabs */}
                            <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/50 overflow-x-auto no-scrollbar max-w-full">
                                {Object.entries(dimensionMeta).map(([key, dim]) => {
                                    const isSelected = dimension === key
                                    const DimIcon = dim.icon
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                if (key !== 'sku') setSkuPlatformFilter('All');
                                                setDimension(key);
                                            }}
                                            className={cn(
                                                'flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-bold transition-all whitespace-nowrap cursor-pointer',
                                                isSelected
                                                    ? 'bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            )}
                                            style={{ fontFamily: 'Roboto, sans-serif' }}
                                        >
                                            <DimIcon size={13} className="flex-shrink-0" />
                                            <span className="hidden xs:inline sm:inline">{dim.label}</span>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Advanced Filter Modal Trigger */}
                            <motion.button
                                onClick={() => setIsFilterModalOpen(true)}
                                className={cn(
                                    'hidden sm:flex',
                                    'items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border',
                                    activeDimensionFilters > 0
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                )}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <SlidersHorizontal size={14} />
                                <span>Filters</span>
                                {activeDimensionFilters > 0 && (
                                    <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                        {activeDimensionFilters}
                                    </span>
                                )}
                                <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full">
                                    {kpiCount} KPIs
                                </span>
                            </motion.button>

                            {/* Mobile-only compact filter trigger */}
                            <motion.button
                                onClick={() => setIsFilterModalOpen(true)}
                                className={cn(
                                    'flex sm:hidden items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 border',
                                    activeDimensionFilters > 0
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-slate-600 border-slate-200'
                                )}
                                whileTap={{ scale: 0.95 }}
                            >
                                <SlidersHorizontal size={12} />
                                {activeDimensionFilters > 0 && (
                                    <span className="bg-emerald-500 text-white text-[9px] px-1 py-0.5 rounded-full">
                                        {activeDimensionFilters}
                                    </span>
                                )}
                            </motion.button>

                            {/* Legend indicators */}
                            <div className="hidden sm:flex items-center gap-2">
                                <span className="flex items-center gap-1.5 text-[9px] text-emerald-600 bg-emerald-50/50 px-2 py-0.5 rounded-full font-bold border border-emerald-100/50 uppercase tracking-tight">
                                    <span className="w-1 h-1 rounded-full bg-emerald-500"></span> Growth
                                </span>
                                <span className="flex items-center gap-1.5 text-[9px] text-rose-600 bg-rose-50/50 px-2 py-0.5 rounded-full font-bold border border-rose-100/50 uppercase tracking-tight">
                                    <span className="w-1 h-1 rounded-full bg-rose-500"></span> Decline
                                </span>
                            </div>
                        </div>
                    }
                >
                    {/* Grid Content - Or Error/Loading State */}
                    {apiLoading ? (
                        /* Loading skeleton rows */
                        <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="flex items-center gap-2 sm:gap-3 px-1 sm:px-2">
                                    <div className="w-36 sm:w-56 flex-shrink-0 flex items-center gap-2 sm:gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-slate-100 animate-pulse" />
                                        <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                                    </div>
                                    {selectedKpis.map(kpi => (
                                        <div key={kpi.key} className="flex-1 min-w-[125px] px-3 py-4 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="h-4 w-16 mx-auto bg-slate-100 rounded animate-pulse mb-1" />
                                            <div className="h-3 w-10 mx-auto bg-slate-100 rounded animate-pulse" />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ) : apiError && entities.length === 0 ? (
                        /* Error state with Refresh button */
                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-8 flex flex-col items-center justify-center min-h-[200px] gap-4">
                            <div className="h-12 w-12 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-semibold text-slate-800 mb-1">Failed to load Platform Overview</h3>
                                <p className="text-sm text-slate-500 mb-4">{apiError}</p>
                            </div>
                            <button
                                onClick={retryFetch}
                                disabled={isRetrying}
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all
                                    ${isRetrying
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-slate-700 text-white hover:bg-slate-800 shadow-md hover:shadow-lg'
                                    }`}
                            >
                                {isRetrying ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-500" />
                                        <span>Retrying...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>Refresh</span>
                                    </>
                                )}
                            </button>
                        </div>
                    ) : entities.length === 0 && apiData[dimension] !== undefined ? (
                        /* No data state - only show if fetch completed and returned nothing */
                        <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 flex flex-col items-center justify-center min-h-[150px] gap-2">
                            <p className="text-sm text-slate-400 font-medium">No data available for the current selection</p>
                        </div>
                    ) : (
                        /* Normal data grid */
                        <div className="overflow-x-auto no-scrollbar pb-2">
                            <div className="min-w-max pb-2">
                                {/* KPI Labels Header - Premium */}
                                <div className="flex items-center gap-2 mb-3 sm:mb-4 px-1">
                                    <div className={cn("w-36 flex-shrink-0 sticky left-0 bg-white z-20 pr-2 sm:pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50 flex items-center justify-between", dimension === 'sku' ? 'sm:w-72' : 'sm:w-56')}>
                                        <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">Entity</span>
                                        {dimension === 'sku' && (
                                            <motion.button
                                                onClick={() => navigate('/compare-skus')}
                                                className="px-3 py-1.5 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-600 to-blue-500 text-[10px] sm:text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 transition-all uppercase tracking-wider flex items-center gap-1.5 relative overflow-hidden group"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-[-20deg]"></div>
                                                <Scale size={13} className="text-blue-100" strokeWidth={2.5} />
                                                <span>Compare SKU</span>
                                            </motion.button>
                                        )}
                                    </div>
                                    {selectedKpis.map(kpi => (
                                        <div key={kpi.key} className={cn('flex-1 text-center py-2 px-2 rounded-lg bg-white border border-slate-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]', cardSize.minW)}>
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em]">
                                                {kpiLabels[kpi.key] || kpi.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Entity Rows */}
                                <div className="space-y-2 sm:space-y-3 px-1">
                                    {paginatedEntities.map((e) => (
                                        <motion.div
                                            key={e.key}
                                            className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl hover:bg-slate-50/50 transition-colors"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            {/* Entity with Trend & RCA buttons - Sticky */}
                                            <div className={cn("flex-shrink-0 flex items-center gap-1.5 sm:gap-2 sticky left-0 bg-white z-20 pr-2 sm:pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50", dimension === 'sku' ? 'w-44 sm:w-72' : 'w-36 sm:w-56')}>
                                                {e.logoSrc ? (
                                                    <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-white shadow-sm ring-1 ring-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                        <BrandLogo name={e.name} src={e.logoSrc} className="h-7 w-7 sm:h-9 sm:w-9" imgClassName="h-5 w-5 sm:h-6 sm:w-6" />
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white shadow-sm flex-shrink-0"
                                                        style={{ background: `linear-gradient(135deg, ${e.color || '#6366f1'}, ${e.color || '#6366f1'}dd)` }}
                                                    >
                                                        {e.name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="flex flex-col flex-1 overflow-hidden justify-center">
                                                    <span
                                                        className="text-[11px] sm:text-[13px] font-bold text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis"
                                                        style={{ fontFamily: 'Roboto, sans-serif', maxWidth: dimension === 'sku' ? '150px' : undefined, textTransform: 'capitalize' }}
                                                        title={e.name}
                                                    >
                                                        {dimension === 'sku' ? truncateToWords(e.name, 5) : e.name}
                                                    </span>
                                                    {dimension === 'sku' && e.offtakeShare !== undefined && (
                                                        <div className="flex items-center gap-1 mt-0.5" title="Offtake Share">
                                                            <div className="flex items-center gap-1 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200/50 text-sky-600 font-bold" style={{ fontSize: '9px' }}>
                                                                <PieChart size={10} className="text-sky-500" />
                                                                {e.offtakeShare}% Share
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Trend & RCA buttons */}
                                                <div className="hidden sm:flex items-center gap-1">
                                                    {dimension === 'sku' && e.page_url && (
                                                        <a
                                                            href={e.page_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(evt) => evt.stopPropagation()}
                                                            className="h-6.5 w-6.5 rounded-md bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:text-blue-600 text-slate-400"
                                                            title="Open product page"
                                                        >
                                                            <ExternalLink size={13} />
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={(evt) => {
                                                            evt.stopPropagation();
                                                            onViewTrends(e.name || e.label, currentDimension.label);
                                                        }}
                                                        className="h-6.5 w-6.5 rounded-md bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                                                        title={`View ${e.name} Trend`}
                                                    >
                                                        <LineChart size={13} className="text-slate-400" />
                                                    </button>
                                                    {(() => {
                                                        const entityNameLower = (e.name || e.label || '').toLowerCase().trim();
                                                        const isEcomEntity = isEcomPlatform(entityNameLower) || (selectedChannel && (selectedChannel.toLowerCase().includes('ecom') || selectedChannel.toLowerCase().includes('e-commerce')));
                                                        const isAmazonEntity = entityNameLower.includes('amazon') || (globalPlatform && globalPlatform.toLowerCase().includes('amazon'));

                                                        // For e-commerce, ONLY show RCA button for Amazon; hide for all other e-commerce platforms
                                                        if (isEcomEntity && !isAmazonEntity) {
                                                            return null;
                                                        }

                                                        return (
                                                            <button
                                                                onClick={(evt) => {
                                                                    evt.stopPropagation();
                                                                    onViewRca(e.name || e.label);
                                                                }}
                                                                className="h-6.5 w-6.5 rounded-md bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                                                                title={`View ${e.name} RCA`}
                                                            >
                                                                <MapPin size={13} className="text-slate-400" />
                                                            </button>
                                                        );
                                                    })()}
                                                </div>
                                            </div>


                                            {/* KPI Cards - Enhanced with gradient glow */}
                                            {selectedKpis.map(kpi => {
                                                let cell = e.data[kpi.key]

                                                if (dimension === 'platform') {
                                                    const platformName = e.name.toLowerCase();
                                                    const isEcomRow = isEcomPlatform(platformName);
                                                    const isQuickRow = isQcomPlatform(platformName);

                                                    if (isEcomRow && kpi.key === 'cpm') {
                                                        cell = null;
                                                    } else if (isQuickRow && kpi.key === 'cpc') {
                                                        cell = null;
                                                    }
                                                }

                                                const isNA = !cell || cell?.value === 'N/A' || cell?.value === undefined
                                                const textColor = isNA ? 'text-slate-400' : getStatusText(cell?.delta)
                                                const isUp = cell?.delta?.dir === 'up'
                                                const hoverVal = getFullDisplayValue(kpi.key, cell)

                                                return (
                                                    <motion.button
                                                        key={kpi.key}
                                                        onClick={() => { if (!isNA) handleCopy(`${e.name} ${kpi.label}`, hoverVal) }}
                                                        className={cn(
                                                            'flex-1 px-3 rounded-xl text-center transition-all duration-200 relative overflow-hidden',
                                                            'bg-gradient-to-br from-white to-slate-50',
                                                            'border',
                                                            isNA ? 'border-slate-100 cursor-not-allowed cursor-not-allowed opacity-80' : isUp ? 'border-emerald-100' : 'border-rose-100',
                                                            'shadow-[0_4px_16px_rgba(0,0,0,0.06)]',
                                                            !isNA && 'hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:-translate-y-1 active:scale-[0.98]',
                                                            cardSize.minW, cardSize.py
                                                        )}
                                                        title={isNA ? `${kpi.label}: N/A (Data Not Available)` : `${kpi.label}: ${hoverVal} (${cell?.delta?.dir === 'up' ? '▲' : '▼'} ${cell?.delta?.value})`}
                                                        whileHover={isNA ? {} : { scale: 1.02 }}
                                                        whileTap={isNA ? {} : { scale: 0.98 }}
                                                    >
                                                        {/* Subtle glow effect */}
                                                        {!isNA && (
                                                            <div className={cn(
                                                                'absolute inset-0 opacity-10 rounded-xl',
                                                                isUp ? 'bg-gradient-to-br from-emerald-100 to-transparent' : 'bg-gradient-to-br from-rose-100 to-transparent'
                                                            )} />
                                                        )}
                                                        <div className={cn('font-bold tabular-nums relative z-10 leading-tight', isNA ? 'text-slate-400' : 'text-slate-900', cardSize.text)} style={{ fontFamily: 'Roboto, sans-serif' }}>
                                                            {isNA ? 'N/A' : cell?.value}
                                                        </div>
                                                        <div className={cn('font-bold flex items-center justify-center gap-0.5 mt-0.5 relative z-10', textColor, cardSize.delta)}>
                                                            {isNA ? (
                                                                <span className="opacity-60">-</span>
                                                            ) : (
                                                                <>
                                                                    <span className="opacity-80">{isUp ? '↑' : '↓'}</span>
                                                                    <span>{cell?.delta?.value?.replace(/[+-]/, '')}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </motion.button>
                                                )
                                            })}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Generic Pagination Controls */}
                    {entities.length > pageSize && (
                        <div className="mt-4 pt-3 sm:pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <span className="text-xs sm:text-sm text-slate-500">
                                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, entities.length)} of {entities.length} entries
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="text-xs font-bold text-slate-700 px-2">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Footer - Summary Stats */}
                    <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <div className="flex items-center gap-1.5 sm:gap-2 bg-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-200 shadow-sm">
                                <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-lg bg-slate-900 flex items-center justify-center">
                                    <TrendingUp size={14} className="text-white" />
                                </div>
                                <span className="text-slate-800 text-xs sm:text-sm font-bold">
                                    {entities.reduce((sum, e) => sum + selectedKpis.filter(k => e.data[k.key]?.delta?.dir === 'up').length, 0)}
                                </span>
                                <span className="text-slate-500 text-xs">positive</span>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 bg-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-200 shadow-sm">
                                <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-lg bg-slate-400 flex items-center justify-center">
                                    <TrendingDown size={14} className="text-white" />
                                </div>
                                <span className="text-slate-800 text-xs sm:text-sm font-bold">
                                    {entities.reduce((sum, e) => sum + selectedKpis.filter(k => e.data[k.key]?.delta?.dir === 'down').length, 0)}
                                </span>
                                <span className="text-slate-500 text-xs">negative</span>
                            </div>
                        </div>
                        <span className="text-[10px] sm:text-xs text-slate-500 font-medium text-center">Click any card to copy • Select KPIs above</span>
                    </div>
                </SectionWrapper>
            </div>

            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl z-50 text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                        <span className="text-white text-[10px]">✓</span>
                    </div>
                    {toastMessage}
                </div>
            )}

            {/* Prepare options for advanced filter dropdowns */}
            {(() => {
                const brandOptions = globalBrands.map(b => ({ id: b, name: b }))
                const categoryOptions = globalCategories.map(c => ({ id: c, name: c }))
                const platformOptions = globalPlatforms.map(p => ({ id: p, name: p }))
                // SKUs: if current dimension is sku, use them, else empty (fetching all SKUs is too heavy)
                const skuOptions = productOptions.length > 0 ? productOptions
                    : (dimension === 'sku' ? entities.map(e => ({ id: e.key, name: e.name })) : [])

                return (
                    <AdvancedFilterModal
                        isOpen={isFilterModalOpen}
                        onClose={() => setIsFilterModalOpen(false)}
                        filters={advancedFilters}
                        onApply={handleApplyFilters}
                        currentDimension={dimension}
                        brands={brandOptions}
                        categories={categoryOptions}
                        platforms={platformOptions}
                        skus={skuOptions}
                        kpiOptions={filteredKpis}
                    />
                )
            })()}
        </>
    )
}

export default PlatformOverviewNew