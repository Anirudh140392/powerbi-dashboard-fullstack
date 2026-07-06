import React, { useEffect, useContext, useState, useCallback } from "react";
import CommonContainer from "@/components/CommonLayout/CommonContainer";
import { FilterContext } from "@/utils/FilterContext";
import axiosInstance from "../../api/axiosInstance";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";

import {
    Info,
    Search,
    Eye,
    CheckCircle2,
    Clock,
    AlertTriangle,
    TrendingUp,
    Calendar,
    DollarSign,
    Box as BoxIcon,
    RefreshCw,
    X,
    FileText,
    Truck,
    Package,
    Sparkles,
    Zap,
    ArrowLeftRight,
    BarChart3
} from "lucide-react";
import { Tooltip } from "@mui/material";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart
} from "recharts";

// Helper to format currency in INR style
const formatINR = (n) => {
    if (n === null || n === undefined || n === "") return "N/A";
    const num = Number(n);
    if (isNaN(num)) return "N/A";
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(num);
};

const formatLakhs = (n) => {
    if (n === null || n === undefined || n === "") return "N/A";
    const num = Number(n);
    if (isNaN(num)) return "N/A";
    const lakhs = num / 100000;
    return `₹${lakhs.toFixed(2)} L`;
};

const FillWaterfall = ({ confirm, pick, bill, grn }) => {
    const getBadgeStyle = (val) => {
        if (val === null || val === undefined) return { bg: "bg-slate-50", text: "text-slate-400" };
        if (val >= 95) return { bg: "bg-emerald-50", text: "text-emerald-700" };
        if (val >= 90) return { bg: "bg-amber-50", text: "text-amber-700" };
        return { bg: "bg-red-50", text: "text-red-700" };
    };

    const items = [
        { label: "C", value: confirm, title: "Confirm Fill" },
        { label: "P", value: pick, title: "Pick Fill" },
        { label: "B", value: bill, title: "Bill Fill" },
        { label: "G", value: grn, title: "GRN Fill" }
    ];

    return (
        <div className="flex items-center justify-end gap-0.5 mt-0.5">
            {items.map((item, idx) => {
                const style = getBadgeStyle(item.value);
                return (
                    <React.Fragment key={item.label}>
                        {idx > 0 && <span className="text-slate-300 text-[8px] mx-0.5">›</span>}
                        <Tooltip title={`${item.title}: ${formatOrNA(item.value, (v) => `${v}%`)}`} arrow placement="top">
                            <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${style.bg} ${style.text} cursor-help border border-slate-100`}>
                                {item.label}:{formatOrNA(item.value, (v) => `${Math.round(v)}%`)}
                            </span>
                        </Tooltip>
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const formatOrNA = (val, formatter = (v) => v) => {
    if (val === null || val === undefined || val === "") {
        return "N/A";
    }
    return formatter(val);
};

const formatFilterParam = (val) => {
    if (val === "All") return undefined;
    return Array.isArray(val) ? val.join(",") : val;
};

export default function PriorityAction() {
    const {
        refreshFilters,
        paPriority: selectedPriority,
        setPaPriority: setSelectedPriority,
        paStatus: selectedStatus,
        setPaStatus: setSelectedStatus,
        paPlatform: selectedPlatform,
        setPaPlatform: setSelectedPlatform,
        paBrand: selectedBrand,
        setPaBrand: setSelectedBrand,
        paCity: selectedCity,
        setPaCity: setSelectedCity,
        setPaFilters,
        timeStart,
        timeEnd,
    } = useContext(FilterContext);

    useEffect(() => {
        if (typeof refreshFilters === "function") {
            refreshFilters();
        }
    }, [refreshFilters]);

    // NOTE: No global platform sync here — Priority Action page uses its own
    // PriorityActionFilterModal (with paPlatform state) which is independent of
    // the global sidebar platform dropdown. paPlatform is initialized to "All"
    // in FilterContext and only changed by the modal's Apply button.

    // Active tab: prioritize-po, stock-transfer, manage-surplus
    const [activeTab, setActiveTab] = useState("prioritize-po");

    // Mock data for Prioritize PO
    const initialPOData = [
        {
            id: "PO-2026-08912",
            poNumber: "PO-2026-08912",
            priority: "High",
            salesAtRisk: 125000,
            platformWarehouse: "Zepto - Bangalore Central DC",
            status: "Delayed",
            orderValue: 450000,
            raisedOn: "10 May 2026",
            apptDate: "18 May 2026",
            expiry: "25 May 2026",
            avgDoi: 4.5,
            lt: 8,
            fillRate: 88,
            consumptionPerDay: 120,
            skus: [
                { name: "Almond Milk 1L", qty: 1200, value: 180000, fill: "85%" },
                { name: "Oat Milk Barista 1L", qty: 1500, value: 270000, fill: "90%" }
            ]
        },
        {
            id: "PO-2026-08913",
            poNumber: "PO-2026-08913",
            priority: "Medium",
            salesAtRisk: 42000,
            platformWarehouse: "Blinkit - Gurgaon Sector 45 DC",
            status: "In Transit",
            orderValue: 180000,
            raisedOn: "12 May 2026",
            apptDate: "20 May 2026",
            expiry: "01 Jun 2026",
            avgDoi: 12.0,
            lt: 6,
            fillRate: 95,
            consumptionPerDay: 65,
            skus: [
                { name: "Chocolate Protein Shake 330ml", qty: 2400, value: 180000, fill: "95%" }
            ]
        },
        {
            id: "PO-2026-08914",
            poNumber: "PO-2026-08914",
            priority: "High",
            salesAtRisk: 210000,
            platformWarehouse: "Instamart - Mumbai West DC",
            status: "Pending",
            orderValue: 820000,
            raisedOn: "14 May 2026",
            apptDate: "22 May 2026",
            expiry: "28 May 2026",
            avgDoi: 2.1,
            lt: 7,
            fillRate: 82,
            consumptionPerDay: 240,
            skus: [
                { name: "Unsweetened Peanut Butter 1kg", qty: 800, value: 320000, fill: "80%" },
                { name: "Crunchy Peanut Butter 1kg", qty: 1200, value: 500000, fill: "83%" }
            ]
        },
        {
            id: "PO-2026-08915",
            poNumber: "PO-2026-08915",
            priority: "Low",
            salesAtRisk: 8500,
            platformWarehouse: "BigBasket - Delhi Okhla FC",
            status: "Appointed",
            orderValue: 95000,
            raisedOn: "15 May 2026",
            apptDate: "21 May 2026",
            expiry: "15 Jun 2026",
            avgDoi: 18.5,
            lt: 5,
            fillRate: 98,
            consumptionPerDay: 30,
            skus: [
                { name: "Organic Honey 500g", qty: 300, value: 95000, fill: "98%" }
            ]
        },
        {
            id: "PO-2026-08916",
            poNumber: "PO-2026-08916",
            priority: "High",
            salesAtRisk: 95000,
            platformWarehouse: "Zepto - Mumbai East DC",
            status: "Appointed",
            orderValue: 310000,
            raisedOn: "16 May 2026",
            apptDate: "20 May 2026",
            expiry: "30 May 2026",
            avgDoi: 3.8,
            lt: 4,
            fillRate: 91,
            consumptionPerDay: 150,
            skus: [
                { name: "Rolled Oats 1kg", qty: 1000, value: 150000, fill: "92%" },
                { name: "Muesli Fruit & Nut 1kg", qty: 800, value: 160000, fill: "90%" }
            ]
        }
    ];



    // Mock data for Manage Surplus
    const initialSurplusData = [
        {
            id: "MS-001",
            skuName: "Rolled Oats 1kg",
            platform: "Zepto",
            warehouse: "Bangalore Central DC",
            priority: "High",
            sohBe: 2400,
            sohFe: 850,
            doi: 45.5,
            cpd: 18,
            cityOsa: 96,
            skus: [
                { name: "Rolled Oats 1kg", qty: 800, value: 120000, fill: "100%" }
            ]
        },
        {
            id: "MS-002",
            skuName: "Unsweetened Peanut Butter 1kg",
            platform: "Blinkit",
            warehouse: "Gurgaon Sector 45 DC",
            priority: "Medium",
            sohBe: 1800,
            sohFe: 620,
            doi: 32.0,
            cpd: 22,
            cityOsa: 94,
            skus: [
                { name: "Unsweetened Peanut Butter 1kg", qty: 500, value: 200000, fill: "100%" }
            ]
        },
        {
            id: "MS-003",
            skuName: "Crunchy Peanut Butter 1kg",
            platform: "Instamart",
            warehouse: "Mumbai West DC",
            priority: "Low",
            sohBe: 950,
            sohFe: 410,
            doi: 18.2,
            cpd: 26,
            cityOsa: 91,
            skus: [
                { name: "Crunchy Peanut Butter 1kg", qty: 300, value: 125000, fill: "100%" }
            ]
        }
    ];

    // State for search (filters come from FilterContext)
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const version = "v2";

    const [activePO, setActivePO] = useState(null);
    const [activePODetail, setActivePODetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchTerm, selectedCategory, selectedPriority, selectedStatus, selectedPlatform, selectedBrand, selectedCity, timeStart, timeEnd]);

    // SKU Trend states
    const [trendSku, setTrendSku] = useState(null); // { webPid, skuName }
    const [trendData, setTrendData] = useState(null);
    const [trendLoading, setTrendLoading] = useState(false);
    const [activeKpis, setActiveKpis] = useState(new Set(['offtake']));
    const [timeStep, setTimeStep] = useState('daily');

    // API Data States
    const [poData, setPoData] = useState([]);
    const [surplusData, setSurplusData] = useState([]);
    const [stockTransferData, setStockTransferData] = useState([]);
    const [poSummary, setPoSummary] = useState({
        totalPOs: 0,
        totalSalesAtRisk: 0,
        avgFillRate: 0,
        highPriority: 0,
        mediumPriority: 0,
        lowPriority: 0
    });
    const [poFilters, setPoFilters] = useState({
        platforms: [],
        brands: [],
        categories: [],
        cities: [],
        statuses: []
    });

    // Sync poFilters to context so Header's PriorityActionFilterModal can use them
    useEffect(() => {
        if (setPaFilters) {
            setPaFilters(poFilters);
        }
    }, [poFilters, setPaFilters]);

    const [loading, setLoading] = useState(false);

    // Fetch PO dynamic filter options from backend
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const response = await axiosInstance.get('/supply-chain/po-filters');
                if (response.data) {
                    setPoFilters(response.data);
                }
            } catch (err) {
                console.error('[PriorityAction] Error fetching PO filters:', err);
            }
        };
        fetchFilters();
    }, []);

    // Fetch PO main table data from backend with debounced search
    useEffect(() => {
        if (activeTab !== "prioritize-po") return;

        const fetchPOData = async () => {
            setLoading(true);
            try {
                const params = { version };
                if (searchTerm) params.search = searchTerm;
                
                const statusParam = formatFilterParam(selectedStatus);
                if (statusParam) params.status = statusParam;
                
                const platformParam = formatFilterParam(selectedPlatform);
                if (platformParam) params.platform = platformParam;
                
                const brandParam = formatFilterParam(selectedBrand);
                if (brandParam) params.brand = brandParam;
                
                const categoryParam = formatFilterParam(selectedCategory);
                if (categoryParam) params.category = categoryParam;
                
                const cityParam = formatFilterParam(selectedCity);
                if (cityParam) params.city = cityParam;
                
                if (timeStart) params.startDate = typeof timeStart.format === 'function' ? timeStart.format('YYYY-MM-DD') : timeStart;
                if (timeEnd) params.endDate = typeof timeEnd.format === 'function' ? timeEnd.format('YYYY-MM-DD') : timeEnd;

                const response = await axiosInstance.get('/supply-chain/prioritize-po', { params });
                if (response.data) {
                    setPoData(response.data.data || []);
                    setPoSummary(response.data.summary || {
                        totalPOs: 0,
                        totalSalesAtRisk: 0,
                        avgFillRate: 0,
                        highPriority: 0,
                        mediumPriority: 0,
                        lowPriority: 0
                    });
                }
            } catch (err) {
                console.error('[PriorityAction] Error fetching prioritize PO data:', err);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(() => {
            fetchPOData();
        }, 300);

        return () => clearTimeout(timer);
    }, [activeTab, searchTerm, selectedStatus, selectedPlatform, selectedBrand, selectedCategory, selectedCity, timeStart, timeEnd, version]);

    // Fetch Surplus data from backend with debounced search
    useEffect(() => {
        if (activeTab !== "manage-surplus") return;

        const fetchSurplusData = async () => {
            setLoading(true);
            try {
                const params = { version };
                if (searchTerm) params.search = searchTerm;
                
                const platformParam = formatFilterParam(selectedPlatform);
                if (platformParam) params.platform = platformParam;
                
                const brandParam = formatFilterParam(selectedBrand);
                if (brandParam) params.brand = brandParam;
                
                const categoryParam = formatFilterParam(selectedCategory);
                if (categoryParam) params.category = categoryParam;
                
                const cityParam = formatFilterParam(selectedCity);
                if (cityParam) params.city = cityParam;
                
                if (timeStart) params.startDate = typeof timeStart.format === 'function' ? timeStart.format('YYYY-MM-DD') : timeStart;
                if (timeEnd) params.endDate = typeof timeEnd.format === 'function' ? timeEnd.format('YYYY-MM-DD') : timeEnd;

                const response = await axiosInstance.get('/supply-chain/manage-surplus', { params });
                if (response.data) {
                    setSurplusData(response.data || []);
                }
            } catch (err) {
                console.error('[PriorityAction] Error fetching manage surplus data:', err);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(() => {
            fetchSurplusData();
        }, 300);

        return () => clearTimeout(timer);
    }, [activeTab, searchTerm, selectedPlatform, selectedBrand, selectedCategory, selectedCity, timeStart, timeEnd, version]);

    // Fetch Stock Transfer data from backend with debounced search
    useEffect(() => {
        if (activeTab !== "stock-transfer") return;

        const fetchStockTransferData = async () => {
            setLoading(true);
            try {
                const params = { version };
                if (searchTerm) params.search = searchTerm;
                
                const platformParam = formatFilterParam(selectedPlatform);
                if (platformParam) params.platform = platformParam;
                
                const brandParam = formatFilterParam(selectedBrand);
                if (brandParam) params.brand = brandParam;
                
                const categoryParam = formatFilterParam(selectedCategory);
                if (categoryParam) params.category = categoryParam;
                
                const cityParam = formatFilterParam(selectedCity);
                if (cityParam) params.city = cityParam;
                
                if (timeStart) params.startDate = typeof timeStart.format === 'function' ? timeStart.format('YYYY-MM-DD') : timeStart;
                if (timeEnd) params.endDate = typeof timeEnd.format === 'function' ? timeEnd.format('YYYY-MM-DD') : timeEnd;

                const response = await axiosInstance.get('/supply-chain/stock-transfer', { params });
                if (response.data) {
                    setStockTransferData(response.data || []);
                }
            } catch (err) {
                console.error('[PriorityAction] Error fetching stock transfer data:', err);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(() => {
            fetchStockTransferData();
        }, 300);

        return () => clearTimeout(timer);
    }, [activeTab, searchTerm, selectedPlatform, selectedBrand, selectedCategory, selectedCity, timeStart, timeEnd, version]);

    // Handle Know More modal click to fetch SKU level details dynamically
    const handleKnowMore = async (po) => {
        setActivePO(po);
        setActivePODetail(null);
        setLoadingDetail(true);
        try {
            const params = {
                poNumber: po.poNumber,
                version,
                ...(po.facilityName ? { facilityName: po.facilityName } : {})
            };
            if (searchTerm) params.search = searchTerm;
            
            const statusParam = formatFilterParam(selectedStatus);
            if (statusParam) params.status = statusParam;
            
            const platformParam = formatFilterParam(selectedPlatform);
            if (platformParam) params.platform = platformParam;
            
            const brandParam = formatFilterParam(selectedBrand);
            if (brandParam) params.brand = brandParam;
            
            const categoryParam = formatFilterParam(selectedCategory);
            if (categoryParam) params.category = categoryParam;
            
            const cityParam = formatFilterParam(selectedCity);
            if (cityParam) params.city = cityParam;
            
            if (timeStart) params.startDate = timeStart;
            if (timeEnd) params.endDate = timeEnd;

            const response = await axiosInstance.get('/supply-chain/po-detail', { params });
            if (response.data) {
                setActivePODetail(response.data);
            }
        } catch (err) {
            console.error('[PriorityAction] Error fetching PO detail:', err);
        } finally {
            setLoadingDetail(false);
        }
    };

    const formatK_Lac_Cr = (val) => {
        if (val === null || val === undefined || val === "") return "N/A";
        const num = Number(val);
        if (isNaN(num)) return "N/A";

        const sign = num < 0 ? "-" : "";
        const absNum = Math.abs(num);

        if (absNum < 1000) {
            return sign + (absNum % 1 === 0 ? absNum.toFixed(0) : absNum.toFixed(1));
        } else if (absNum < 100000) {
            const kVal = absNum / 1000;
            return sign + (kVal % 1 === 0 ? kVal.toFixed(0) : kVal.toFixed(1)) + "K";
        } else if (absNum < 10000000) {
            const lacVal = absNum / 100000;
            return sign + (lacVal % 1 === 0 ? lacVal.toFixed(0) : lacVal.toFixed(1)) + " lac";
        } else {
            const crVal = absNum / 10000000;
            return sign + (crVal % 1 === 0 ? crVal.toFixed(0) : crVal.toFixed(2)) + " Cr";
        }
    };

    // KPI configuration for the trend chart — axis: 'left' for absolute values, 'right' for percentage
    const KPI_CONFIG = {
        offtake: {
            label: 'Offtake',
            format: (v) => `₹${formatK_Lac_Cr(v)}`,
            color: '#2563eb',
            gradient: ['#2563eb', '#bfdbfe'],
            axis: 'left'
        },
        drr: {
            label: 'DRR',
            format: (v) => `₹${formatK_Lac_Cr(v)}/day`,
            color: '#7c3aed',
            gradient: ['#7c3aed', '#ddd6fe'],
            axis: 'left'
        },
        price: {
            label: 'Price',
            format: (v) => `₹${formatK_Lac_Cr(v)}`,
            color: '#ea580c',
            gradient: ['#ea580c', '#fed7aa'],
            axis: 'left'
        },
        doi: {
            label: 'DOI',
            format: (v) => `${Number(v).toFixed(1)} days`,
            color: '#0891b2',
            gradient: ['#0891b2', '#a5f3fc'],
            axis: 'left'
        },
        osa: {
            label: 'OSA',
            format: (v) => `${Number(v).toFixed(0)}%`,
            color: '#16a34a',
            gradient: ['#16a34a', '#bbf7d0'],
            axis: 'right'
        },
        promo: {
            label: 'Promo %',
            format: (v) => `${Number(v).toFixed(1)}%`,
            color: '#db2777',
            gradient: ['#db2777', '#fbcfe8'],
            axis: 'right'
        },
    };

    // Toggle a KPI on/off (multi-select)
    const toggleKpi = (key) => {
        setActiveKpis(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                if (next.size > 1) next.delete(key); // keep at least one active
            } else {
                next.add(key);
            }
            return next;
        });
    };

    // Fetch SKU trend data
    const fetchSKUTrend = useCallback((webPid, skuName) => {
        if (!webPid) return;
        // If clicking the same SKU, toggle off
        if (trendSku?.webPid === webPid) {
            setTrendSku(null);
            setTrendData(null);
            return;
        }
        setTrendSku({ webPid, skuName });
    }, [trendSku]);

    // Reactively fetch SKU trend data when active SKU or timeStep changes
    useEffect(() => {
        if (!trendSku?.webPid) return;

        let isMounted = true;
        const loadTrend = async () => {
            setTrendLoading(true);
            try {
                const response = await axiosInstance.get('/supply-chain/sku-trend', {
                    params: { webPid: trendSku.webPid, timeStep }
                });
                if (isMounted && response.data) {
                    setTrendData(response.data);
                }
            } catch (err) {
                console.error('[PriorityAction] Error fetching SKU trend:', err);
            } finally {
                if (isMounted) {
                    setTrendLoading(false);
                }
            }
        };

        loadTrend();

        return () => {
            isMounted = false;
        };
    }, [trendSku?.webPid, timeStep]);

    // Reset trend when modal closes
    useEffect(() => {
        if (!activePO) {
            setTrendSku(null);
            setTrendData(null);
        }
    }, [activePO]);

    const getFilteredData = () => {
        if (activeTab === "prioritize-po") {
            // Apply priority client-side so it's super snappy
            return poData.filter(po => {
                if (!po) return false;
                return selectedPriority === "All" || po.priority === selectedPriority;
            });
        } else if (activeTab === "stock-transfer") {
            return stockTransferData.filter(item => {
                if (!item) return false;
                const matchesSearch = !searchTerm ||
                    (item.skuName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (item.fromCfa || '').toLowerCase().includes(searchTerm.toLowerCase());
                return matchesSearch;
            });
        } else {
            return surplusData.filter(item => {
                if (!item) return false;
                const skuSearchStr = item.sku || item.skuName || '';
                const warehouseSearchStr = item.warehouse || '';
                const matchesSearch = !searchTerm ||
                    skuSearchStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    warehouseSearchStr.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesPriority = selectedPriority === "All" || item.priority === selectedPriority;
                return matchesSearch && matchesPriority;
            });
        }
    };

    const filteredData = getFilteredData();


    // Paginated subset calculations
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    return (
        <CommonContainer title="Priority Action">
            {/* Shimmer / Animation Keyframes and Table grid CSS */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .insight-grid th:not(:last-child),
                .insight-grid td:not(:last-child) {
                    border-right: 1px solid #e2e8f0;
                }
                .insight-grid tbody tr:nth-child(even) {
                    background-color: #f8fafc;
                }
                .insight-grid thead th {
                    background: #f1f5f9;
                    font-weight: 600;
                    font-size: 10px !important;
                    letter-spacing: 0.03em;
                    position: sticky;
                    top: 0;
                    z-index: 20;
                    box-shadow: 0 1px 0 #e2e8f0;
                    text-transform: uppercase;
                    color: #64748b;
                    border-bottom: 2px solid #cbd5e1;
                    height: 38px;
                    padding: 0 12px;
                    white-space: nowrap;
                }
                .insight-grid td {
                    padding: 12px;
                    font-size: 11px;
                    color: #334155;
                    vertical-align: middle;
                    border-bottom: 1px solid #e2e8f0;
                    white-space: nowrap;
                }
                .priority-badge-critical {
                    background-color: #ffe4e6;
                    color: #9f1239;
                    border: 1px solid #fecdd3;
                    animation: pulse-border 2s infinite;
                }
                @keyframes pulse-border {
                    0%, 100% { border-color: #fecdd3; }
                    50% { border-color: #f43f5e; }
                }
                .priority-badge-high {
                    background-color: #fef2f2;
                    color: #ef4444;
                    border: 1px solid #fee2e2;
                }
                .priority-badge-medium {
                    background-color: #fffbeb;
                    color: #d97706;
                    border: 1px solid #fef3c7;
                }
                .priority-badge-low {
                    background-color: #f0fdf4;
                    color: #16a34a;
                    border: 1px solid #dcfce7;
                }
                .status-badge-delayed {
                    background-color: #fef2f2;
                    color: #dc2626;
                }
                .status-badge-intransit {
                    background-color: #eff6ff;
                    color: #2563eb;
                }
                .status-badge-pending {
                    background-color: #fff7ed;
                    color: #ea580c;
                }
                .status-badge-appointed {
                    background-color: #f5f3ff;
                    color: #7c3aed;
                }
                .custom-tab-button {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 18px;
                    font-size: 11px;
                    font-weight: 700;
                    border-radius: 12px;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }
                .custom-tab-active {
                    border: 1.5px solid #0284c7;
                    color: #0284c7;
                    background-color: #f0f9ff;
                    box-shadow: 0 2px 4px rgba(2, 132, 199, 0.08);
                }
                .custom-tab-inactive {
                    border: 1px solid #e2e8f0;
                    color: #475569;
                    background-color: #ffffff;
                }
                .custom-tab-inactive:hover {
                    background-color: #f8fafc;
                    border-color: #cbd5e1;
                    color: #1e293b;
                }
                .badge-pill {
                    font-size: 9px;
                    font-weight: 800;
                    padding: 1.5px 6px;
                    border-radius: 9999px;
                }
                .badge-pill-active {
                    background-color: #e0f2fe;
                    color: #0369a1;
                }
                .badge-pill-inactive {
                    background-color: #f1f5f9;
                    color: #64748b;
                }
            `}} />

            <div className="space-y-6 animate-in fade-in duration-500 pb-12" style={{ marginTop: "24px" }}>
                {/* ─── Premium Tab Navigation Switch with Filters on Top ─── */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Prioritize PO Tab */}
                        <button
                            onClick={() => { setActiveTab("prioritize-po"); setSearchTerm(""); }}
                            className={`custom-tab-button ${activeTab === "prioritize-po" ? "custom-tab-active" : "custom-tab-inactive"}`}
                        >
                            <Zap size={13} className={activeTab === "prioritize-po" ? "text-[#0284c7]" : "text-slate-500"} />
                            <span>Prioritize PO</span>
                            <span className={`badge-pill ${activeTab === "prioritize-po" ? "badge-pill-active" : "badge-pill-inactive"}`}>
                                {poSummary.totalPOs || 0}
                            </span>
                        </button>

                        {/* Fix Stock Transfer Tab */}
                        <button
                            onClick={() => { setActiveTab("stock-transfer"); setSearchTerm(""); }}
                            className={`custom-tab-button ${activeTab === "stock-transfer" ? "custom-tab-active" : "custom-tab-inactive"}`}
                        >
                            <ArrowLeftRight size={13} className={activeTab === "stock-transfer" ? "text-[#0284c7]" : "text-slate-500"} />
                            <span>Fix Stock Transfer</span>
                            <span className={`badge-pill ${activeTab === "stock-transfer" ? "badge-pill-active" : "badge-pill-inactive"}`}>
                                {stockTransferData.length}
                            </span>
                        </button>

                        {/* Manage Surplus Tab */}
                        <button
                            onClick={() => { setActiveTab("manage-surplus"); setSearchTerm(""); }}
                            className={`custom-tab-button ${activeTab === "manage-surplus" ? "custom-tab-active" : "custom-tab-inactive"}`}
                        >
                            <Package size={13} className={activeTab === "manage-surplus" ? "text-[#0284c7]" : "text-slate-500"} />
                            <span>Manage Surplus</span>
                            <span className={`badge-pill ${activeTab === "manage-surplus" ? "badge-pill-active" : "badge-pill-inactive"}`}>
                                {surplusData.length}
                            </span>
                        </button>
                    </div>

                </div>

                {/* ─── Evidence Table Box Container ─── */}
                <div style={{
                    display: "flex", flexDirection: "column", width: "100%",
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px",
                    overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    outline: "none"
                }}>
                    {/* Table Header Bar matching Insights style exactly */}
                    <div className="evidence-header" style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 16px",
                        borderBottom: "1px solid #e2e8f0",
                        background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
                    }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e3a5f", letterSpacing: "0.02em", textTransform: "uppercase" }}>
                            {activeTab === "prioritize-po" && "Prioritize PO Actions"}
                            {activeTab === "stock-transfer" && "Fix Stock Transfer Actions"}
                            {activeTab === "manage-surplus" && "Manage Surplus Inventory"}
                        </span>

                        <div className="evidence-actions-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Search Input */}
                            <div className="evidence-search-container" style={{ position: "relative" }}>
                                <Search size={11} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search..."
                                    style={{
                                        paddingLeft: "26px", paddingRight: "8px", paddingTop: "5px", paddingBottom: "5px",
                                        fontSize: "11px", border: "1px solid #bfdbfe", borderRadius: "6px",
                                        background: "#fff", outline: "none", width: "180px", color: "#1e3a5f",
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="w-full overflow-auto max-h-[600px] scrollbar-thin">
                        {activeTab === "prioritize-po" && (
                            <table className="insight-grid w-full text-sm" style={{ borderCollapse: "collapse", minWidth: "1550px" }}>
                                <thead>
                                    <TableRow style={{ borderBottom: "2px solid #cbd5e1" }}>
                                        <TableHead className="px-3 py-3 text-left">
                                            <div className="flex items-center gap-1">
                                                <span>PO Number</span>
                                                <Tooltip title="Unique identifier for the Purchase Order raised by the platform." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-left">
                                            <div className="flex items-center gap-1">
                                                <span>Priority</span>
                                                <Tooltip title="Calculated priority level (Critical, High, Medium, Low) based on stockout risk and expiry." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Projected Sales At Risk</span>
                                                <Tooltip title="Projected revenue loss if the inventory deficit is not filled within the lead time." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-left">
                                            <div className="flex items-center gap-1">
                                                <span>Platform Warehouse</span>
                                                <Tooltip title="Fulfillment Center where stock needs to be checked in." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-left">
                                            <div className="flex items-center gap-1">
                                                <span>Status</span>
                                                <Tooltip title="Current logistical status of the Purchase Order (e.g. Delayed, In Transit, Appointed, Pending)." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Billed Value</span>
                                                <Tooltip title="The total value of the items in this PO that have already been billed (in Lakhs)." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Order Value</span>
                                                <Tooltip title="The total ordered value of the PO when it was raised (in Lakhs)." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-left">
                                            <div className="flex items-center gap-1">
                                                <span>Raised On</span>
                                                <Tooltip title="The date when the platform raised the Purchase Order." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-left">
                                            <div className="flex items-center gap-1">
                                                <span>Appt Date</span>
                                                <Tooltip title="Appointment date and time confirmed for delivery at the warehouse." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-left">
                                            <div className="flex items-center gap-1">
                                                <span>Expiry</span>
                                                <Tooltip title="The expiry date/cancellation date of the Purchase Order set by the platform." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Avg DOI</span>
                                                <Tooltip title="Days of Inventory (DOI) measures average stock coverage on platform warehouse." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>LT (days)</span>
                                                <Tooltip title="Lead Time (LT) is the number of days taken from PO creation to GRN delivery." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Fill C·P·B·G</span>
                                                <Tooltip title="Reconciliation Waterfall: Confirm Fill -> Pick Fill -> Bill Fill -> GRN Fill percentages." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Consumption/Day</span>
                                                <Tooltip title="Average daily consumer consumption quantity of this PO SKU set." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                    </TableRow>
                                </thead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={14} className="text-center py-16">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <RefreshCw size={24} className="animate-spin text-indigo-600" />
                                                    <span className="text-[11px] font-bold text-slate-500">Loading Prioritize PO Actions Data...</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={14} className="text-center py-12 text-slate-400 text-[11px] font-semibold">
                                                No POs matching filters found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedData.map((po) => (
                                            <TableRow key={`${po.poNumber}-${po.facilityName}`} className="hover:bg-blue-50/30 transition-colors duration-200 whitespace-nowrap">
                                                {/* PO Number */}
                                                <TableCell className="px-3 py-3">
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
                                                        <span className="text-[11px] font-bold text-slate-900">{po.poNumber}</span>
                                                        <button
                                                            onClick={() => handleKnowMore(po)}
                                                            style={{
                                                                background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                                                                color: "#4f46e5",
                                                                fontWeight: 700,
                                                                fontSize: "8px",
                                                                textTransform: "uppercase",
                                                                border: "1px solid rgba(99, 102, 241, 0.2)",
                                                                borderRadius: "4px",
                                                                padding: "2px 6px", cursor: "pointer",
                                                                display: "inline-flex", alignItems: "center", gap: "3px",
                                                                transition: "all 0.2s ease",
                                                                letterSpacing: "0.01em",
                                                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                                                minWidth: "max-content",
                                                                flexShrink: 0,
                                                                whiteSpace: "nowrap"
                                                            }}
                                                        >
                                                            <BoxIcon size={7} />
                                                            Show SKUs
                                                        </button>
                                                    </div>
                                                </TableCell>

                                                {/* Priority */}
                                                <TableCell className="px-3 py-3">
                                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md ${
                                                        po.priority === "Critical" ? "priority-badge-critical" :
                                                        po.priority === "High" ? "priority-badge-high" :
                                                        po.priority === "Medium" ? "priority-badge-medium" : "priority-badge-low"
                                                    }`}>
                                                        {po.priority}
                                                    </span>
                                                </TableCell>

                                                {/* Projected Sales at Risk */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-red-600">
                                                    {formatOrNA(po.projectedSalesAtRisk, formatLakhs)}
                                                </TableCell>

                                                {/* Platform Warehouse */}
                                                <TableCell className="px-3 py-3 text-[11px] text-slate-800 font-medium">
                                                    {formatOrNA(po.platformWarehouse)}
                                                </TableCell>

                                                {/* Status */}
                                                <TableCell className="px-3 py-3">
                                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full ${po.rawStatus === "delayed" ? "status-badge-delayed" :
                                                        po.rawStatus === "in_transit" || po.rawStatus === "in transit" ? "status-badge-intransit" :
                                                            po.rawStatus === "pending" ? "status-badge-pending" : "status-badge-appointed"
                                                        }`}>
                                                        {formatOrNA(po.status)}
                                                    </span>
                                                </TableCell>

                                                {/* Billed Value */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-900">
                                                    {formatOrNA(po.billedValue, formatLakhs)}
                                                </TableCell>

                                                {/* Order Value */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-900">
                                                    {formatOrNA(po.orderValue, formatLakhs)}
                                                </TableCell>

                                                {/* Raised On */}
                                                <TableCell className="px-3 py-3 text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                                    {formatOrNA(po.raisedOn)}
                                                </TableCell>

                                                {/* Appt Date */}
                                                <TableCell className="px-3 py-3 text-[11px] text-slate-800 font-semibold whitespace-nowrap">
                                                    {formatOrNA(po.apptDate)}
                                                </TableCell>

                                                {/* Expiry */}
                                                <TableCell className="px-3 py-3 text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                                    {formatOrNA(po.expiry)}
                                                </TableCell>

                                                {/* AVG DOI */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {formatOrNA(po.avgDoi, (v) => `${Math.round(Number(v))} days`)}
                                                </TableCell>

                                                {/* LT */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] text-slate-600 font-medium">
                                                    {formatOrNA(po.lt, (v) => `${v} days`)}
                                                </TableCell>

                                                {/* Fill Rate / Recon Waterfall */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-bold">
                                                    <FillWaterfall confirm={po.confirmFill} pick={po.pickFill} bill={po.billFill} grn={po.grnFill} />
                                                </TableCell>

                                                {/* Consumption per Day */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {formatOrNA(po.consumptionPerDay, (v) => `${Math.round(Number(v))} units`)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </table>
                        )}

                        {activeTab === "stock-transfer" && (
                            <table className="insight-grid w-full text-sm" style={{ borderCollapse: "collapse", minWidth: "1200px" }}>
                                <thead>
                                    <TableRow style={{ borderBottom: "2px solid #cbd5e1" }}>
                                        <TableHead className="px-3 py-3 text-left">
                                            <div className="flex items-center gap-1">
                                                <span>SKU Name</span>
                                                <Tooltip title="Name and SAP code of the SKU recommended for stock transfer." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-left">
                                            <div className="flex items-center gap-1">
                                                <span>From CFA (Surplus)</span>
                                                <Tooltip title="Source CFA warehouse containing excess inventory." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-left">
                                            <div className="flex items-center gap-1">
                                                <span>To CFA (Deficit)</span>
                                                <Tooltip title="Destination CFA warehouse facing inventory shortage." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Distance (km)</span>
                                                <Tooltip title="Straight-line geographic distance between source and destination warehouses." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>DOI (Deficit)</span>
                                                <Tooltip title="Days of Inventory (DOI) coverage at the destination warehouse before transfer." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>DOI (Surplus)</span>
                                                <Tooltip title="Days of Inventory (DOI) coverage at the source warehouse before transfer." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>SOH (Deficit)</span>
                                                <Tooltip title="Stock On Hand (SOH) quantity currently at the destination warehouse (in Units)." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>SOH (Surplus)</span>
                                                <Tooltip title="Stock On Hand (SOH) quantity currently at the source warehouse (in Units)." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>CPD (Deficit)</span>
                                                <Tooltip title="Cases/Units Per Day sold on average at the destination warehouse." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Transfer Qty</span>
                                                <Tooltip title="Recommended transfer quantity (Units) to bring the destination to a safe 7-day cover." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                    </TableRow>
                                </thead>
                                <TableBody>
                                    {filteredData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-12 text-slate-400 text-[11px] font-semibold">
                                                No stock transfers matching search found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedData.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-blue-50/30 transition-colors duration-200">
                                                {/* SKU Name */}
                                                <TableCell className="px-3 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-slate-900">{item.skuName}</span>
                                                        {item.sapCode && <span className="text-[9px] text-slate-500 font-normal">SAP: {item.sapCode}</span>}
                                                    </div>
                                                </TableCell>

                                                {/* From CFA */}
                                                <TableCell className="px-3 py-3 text-[11px] font-medium text-slate-800">
                                                    {formatOrNA(item.fromCfa)}
                                                </TableCell>

                                                {/* To CFA */}
                                                <TableCell className="px-3 py-3 text-[11px] font-medium text-slate-800">
                                                    {formatOrNA(item.toCfa)}
                                                </TableCell>

                                                {/* Distance */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {formatOrNA(item.distanceKm, (v) => `${v} km`)}
                                                </TableCell>

                                                {/* DOI Deficit */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {formatOrNA(item.doiFe, (v) => `${Math.round(v)} days`)}
                                                </TableCell>

                                                {/* DOI Surplus */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {formatOrNA(item.doiBe, (v) => `${Math.round(v)} days`)}
                                                </TableCell>

                                                {/* SOH Deficit */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-medium text-slate-800">
                                                    {formatOrNA(item.sohFe)}
                                                </TableCell>

                                                {/* SOH Surplus */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-medium text-slate-800">
                                                    {formatOrNA(item.sohBe)}
                                                </TableCell>

                                                {/* CPD Deficit */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {formatOrNA(item.cpd)}
                                                </TableCell>

                                                {/* Transfer Qty */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-bold text-indigo-600">
                                                    {formatOrNA(item.transferQty, (v) => `${v} units`)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </table>
                        )}

                        {activeTab === "manage-surplus" && (
                            <table className="insight-grid w-full text-sm" style={{ borderCollapse: "collapse", minWidth: "1200px" }}>
                                <thead>
                                    <TableRow style={{ borderBottom: "2px solid #cbd5e1" }}>
                                        <TableHead className="px-3 py-3 text-left">
                                            <div className="flex items-center gap-1">
                                                <span>SKU (SAP Code)</span>
                                                <Tooltip title="Name and unique SAP identifier of the overstocked SKU." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-left">
                                            <div className="flex items-center gap-1">
                                                <span>Severity</span>
                                                <Tooltip title="Calculated priority level (Critical, High, Medium, Low) based on inventory cover and expiry." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Surplus (EA)</span>
                                                <Tooltip title="Total excess stock quantity (in Units) across all warehouses." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Net DOI</span>
                                                <Tooltip title="Combined Days of Inventory (DOI) coverage across the entire network." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>CFAs Count</span>
                                                <Tooltip title="Total number of active warehouses (CFAs) holding stock of this SKU." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Dead CFAs</span>
                                                <Tooltip title="Number of warehouses holding stock of this SKU that have had zero sales for >30 days." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Min Expiry</span>
                                                <Tooltip title="Minimum days remaining until the nearest batch of this product expires." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Value at Risk</span>
                                                <Tooltip title="Total financial value of the surplus stock that is at risk of expiry or stagnation (in Lakhs)." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-left">
                                            <div className="flex items-center gap-1">
                                                <span>Team / Action Recommendation</span>
                                                <Tooltip title="The department responsible and their recommended immediate corrective action." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                    </TableRow>
                                </thead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-16">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <RefreshCw size={24} className="animate-spin text-indigo-600" />
                                                    <span className="text-[11px] font-bold text-slate-500">Loading Manage Surplus Data...</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-12 text-slate-400 text-[11px] font-semibold">
                                                No surplus items matching filters found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedData.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-blue-50/30 transition-colors duration-200">
                                                {/* SKU Name */}
                                                <TableCell className="px-3 py-3 font-bold text-slate-900">
                                                    {formatOrNA(item.sku)}
                                                </TableCell>

                                                {/* Severity */}
                                                <TableCell className="px-3 py-3">
                                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md ${
                                                        item.priority === "Critical" ? "priority-badge-critical" :
                                                        item.priority === "High" ? "priority-badge-high" :
                                                        item.priority === "Medium" ? "priority-badge-medium" : "priority-badge-low"
                                                    }`}>
                                                        {formatOrNA(item.priority)}
                                                    </span>
                                                </TableCell>

                                                {/* Surplus (EA) */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-800">
                                                    {formatOrNA(item.surplusEa)}
                                                </TableCell>

                                                {/* Net DOI */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {formatOrNA(item.netDoi)}
                                                </TableCell>

                                                {/* CFAs Count */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] text-slate-600 font-medium">
                                                    {formatOrNA(item.cfasCount)}
                                                </TableCell>

                                                {/* Dead CFAs */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] text-slate-600 font-medium">
                                                    {formatOrNA(item.deadCfaCount)}
                                                </TableCell>

                                                {/* Min Expiry */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] text-slate-600 font-semibold">
                                                    {formatOrNA(item.expiry)}
                                                </TableCell>

                                                {/* Value at Risk */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-bold text-red-600">
                                                    {formatOrNA(item.valueAtRisk)}
                                                </TableCell>

                                                {/* Team / Action */}
                                                <TableCell className="px-3 py-3 text-left text-[11px] text-slate-700 font-semibold whitespace-normal">
                                                    {formatOrNA(item.teamAction)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </table>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
                            <div className="text-[11px] font-semibold text-slate-500">
                                Showing <span className="text-slate-800">{startIndex + 1}</span> to{" "}
                                <span className="text-slate-800">{Math.min(endIndex, filteredData.length)}</span> of{" "}
                                <span className="text-slate-800">{filteredData.length}</span> items
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                                        currentPage === 1
                                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                            : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 active:bg-slate-100"
                                    }`}
                                >
                                    Previous
                                </button>
                                
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                        .map((p, idx, arr) => {
                                            const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                                            return (
                                                <React.Fragment key={p}>
                                                    {showEllipsis && <span className="text-slate-400 text-xs px-1">...</span>}
                                                    <button
                                                        onClick={() => setCurrentPage(p)}
                                                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                                                            currentPage === p
                                                                ? "bg-[#0284c7] text-white border-[#0284c7] shadow-sm"
                                                                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300"
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                </React.Fragment>
                                            );
                                        })}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                                        currentPage === totalPages
                                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                            : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 active:bg-slate-100"
                                    }`}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Show SKUs Modal ─── */}
            <Dialog open={activePO !== null} onOpenChange={(open) => { if (!open) setActivePO(null); }}>
                <DialogContent hideCloseButton className="p-0 overflow-hidden rounded-[18px] border-none shadow-2xl transition-all duration-300 max-h-[85vh] flex flex-col sm:max-w-3xl top-[50%] translate-y-[-50%]">
                    {activePO && (
                        <div className="flex flex-col bg-white overflow-hidden max-h-full">
                            {/* Header */}
                            <div style={{
                                background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
                                padding: "16px 20px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}>
                                <div>
                                    <p style={{ fontSize: "13px", fontWeight: 800, color: "white", letterSpacing: "-0.01em" }}>
                                        {activePO.poNumber}
                                    </p>
                                    <p style={{ fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.7)", marginTop: "2px" }}>
                                        {activePO.platformWarehouse} • {activePO.skuCount || "—"} SKUs
                                    </p>
                                </div>
                                <button
                                    onClick={() => setActivePO(null)}
                                    style={{
                                        background: "rgba(255,255,255,0.15)",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "6px",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <X size={16} color="white" />
                                </button>
                            </div>

                            {/* SKU Table */}
                            <div style={{ overflowY: "auto", transition: "max-height 0.3s ease", paddingBottom: "10px" }}>
                                <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
                                    <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                                        <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                                            <th style={{ padding: "10px 16px", fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>SKU Name</th>
                                            <th style={{ padding: "10px 12px", fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>Units Ordered</th>
                                            <th style={{ padding: "10px 12px", fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>Units Delivered</th>
                                            <th style={{ padding: "10px 12px", fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>Fill Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingDetail ? (
                                            <tr>
                                                <td colSpan={4} style={{ padding: "32px 16px", textAlign: "center" }}>
                                                    <div className="flex justify-center items-center gap-2">
                                                        <RefreshCw size={16} className="animate-spin text-indigo-600" />
                                                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Loading SKUs...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : activePODetail?.skus?.length > 0 ? (
                                            activePODetail.skus.map((sku, sIdx) => {
                                                return (
                                                    <tr key={sIdx} style={{
                                                        borderBottom: "1px solid #f1f5f9",
                                                        transition: "background 0.15s",
                                                    }} className="hover:bg-blue-50/40">
                                                        <td style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 600, color: "#1e293b", maxWidth: "220px" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                                <div style={{ display: "flex", flexDirection: "column" }}>
                                                                    <span className="line-clamp-2">{sku.skuName}</span>
                                                                    {sku.rejectReason && (
                                                                        <div className="flex items-center gap-1 mt-0.5 text-[9px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-100 w-max">
                                                                            <AlertTriangle size={9} className="text-red-500 flex-shrink-0" />
                                                                            <span>Rejected: {sku.rejectBucket} ({sku.rejectReason})</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 600, color: "#475569", textAlign: "right" }}>
                                                            {formatOrNA(sku.unitsOrdered, (v) => v.toLocaleString())}
                                                        </td>
                                                        <td style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 600, color: "#475569", textAlign: "right" }}>
                                                            {formatOrNA(sku.unitsDelivered, (v) => v.toLocaleString())}
                                                        </td>
                                                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                                            <div className="flex flex-col items-end">
                                                                <span style={{
                                                                    fontSize: "11px",
                                                                    fontWeight: 700,
                                                                    color: !sku.fillRate ? "#64748b" : sku.fillRate >= 95 ? "#16a34a" : sku.fillRate >= 50 ? "#d97706" : "#dc2626"
                                                                }}>
                                                                    {formatOrNA(sku.fillRate, (v) => `${v}%`)}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={4} style={{ padding: "24px 16px", textAlign: "center", fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
                                                    No SKU data available for this PO.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer summary */}
                            {activePODetail?.skus?.length > 0 && (
                                <div style={{
                                    padding: "12px 20px",
                                    borderTop: "1px solid #e2e8f0",
                                    background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}>
                                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#94a3b8" }}>
                                        {activePODetail.skus.length} SKU{activePODetail.skus.length !== 1 ? "s" : ""}
                                    </span>
                                    <div style={{ display: "flex", gap: "16px" }}>
                                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#475569" }}>
                                            Total Ordered: {(() => {
                                                const total = activePODetail.skus.reduce((s, sk) => s + (sk.unitsOrdered || 0), 0);
                                                return total === 0 ? "N/A" : total.toLocaleString();
                                            })()}
                                        </span>
                                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#475569" }}>
                                            Total Delivered: {(() => {
                                                const total = activePODetail.skus.reduce((s, sk) => s + (sk.unitsDelivered || 0), 0);
                                                return total === 0 ? "N/A" : total.toLocaleString();
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </CommonContainer>
    );
}
