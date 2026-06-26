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

const formatOrNA = (val, formatter = (v) => v) => {
    if (val === null || val === undefined || val === "") {
        return "N/A";
    }
    return formatter(val);
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
        platform,
    } = useContext(FilterContext);

    useEffect(() => {
        if (typeof refreshFilters === "function") {
            refreshFilters();
        }
    }, [refreshFilters]);

    // Sync global sidebar platform selection to page-specific platform filter
    useEffect(() => {
        if (platform) {
            setSelectedPlatform(platform);
        } else {
            setSelectedPlatform("All");
        }
    }, [platform, setSelectedPlatform]);

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

    const [activePO, setActivePO] = useState(null);
    const [activePODetail, setActivePODetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

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
                const params = {};
                if (searchTerm) params.search = searchTerm;
                if (selectedStatus !== "All") params.status = selectedStatus;
                if (selectedPlatform !== "All") params.platform = selectedPlatform;
                if (selectedBrand !== "All") params.brand = selectedBrand;
                if (selectedCategory !== "All") params.category = selectedCategory;
                if (selectedCity !== "All") params.city = selectedCity;
                if (timeStart) params.startDate = timeStart;
                if (timeEnd) params.endDate = timeEnd;

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
    }, [activeTab, searchTerm, selectedStatus, selectedPlatform, selectedBrand, selectedCategory, selectedCity, timeStart, timeEnd]);

    // Fetch Surplus data from backend with debounced search
    useEffect(() => {
        if (activeTab !== "manage-surplus") return;

        const fetchSurplusData = async () => {
            setLoading(true);
            try {
                const params = {};
                if (searchTerm) params.search = searchTerm;
                if (selectedPlatform !== "All") params.platform = selectedPlatform;
                if (selectedBrand !== "All") params.brand = selectedBrand;
                if (selectedCategory !== "All") params.category = selectedCategory;
                if (selectedCity !== "All") params.city = selectedCity;
                if (timeStart) params.startDate = timeStart;
                if (timeEnd) params.endDate = timeEnd;

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
    }, [activeTab, searchTerm, selectedPlatform, selectedBrand, selectedCategory, selectedCity, timeStart, timeEnd]);

    // Fetch Stock Transfer data from backend with debounced search
    useEffect(() => {
        if (activeTab !== "stock-transfer") return;

        const fetchStockTransferData = async () => {
            setLoading(true);
            try {
                const params = {};
                if (searchTerm) params.search = searchTerm;
                if (selectedPlatform !== "All") params.platform = selectedPlatform;
                if (selectedBrand !== "All") params.brand = selectedBrand;
                if (selectedCategory !== "All") params.category = selectedCategory;
                if (selectedCity !== "All") params.city = selectedCity;
                if (timeStart) params.startDate = timeStart;
                if (timeEnd) params.endDate = timeEnd;

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
    }, [activeTab, searchTerm, selectedPlatform, selectedBrand, selectedCategory, selectedCity, timeStart, timeEnd]);

    // Handle Know More modal click to fetch SKU level details dynamically
    const handleKnowMore = async (po) => {
        setActivePO(po);
        setActivePODetail(null);
        setLoadingDetail(true);
        try {
            const params = {
                poNumber: po.poNumber,
                ...(po.facilityName ? { facilityName: po.facilityName } : {})
            };
            if (searchTerm) params.search = searchTerm;
            if (selectedStatus !== "All") params.status = selectedStatus;
            if (selectedPlatform !== "All") params.platform = selectedPlatform;
            if (selectedBrand !== "All") params.brand = selectedBrand;
            if (selectedCategory !== "All") params.category = selectedCategory;
            if (selectedCity !== "All") params.city = selectedCity;
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
                return selectedPriority === "All" || po.priority === selectedPriority;
            });
        } else if (activeTab === "stock-transfer") {
            return stockTransferData.filter(item => {
                const matchesSearch = !searchTerm ||
                    item.skuName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (item.fromCfa || '').toLowerCase().includes(searchTerm.toLowerCase());
                return matchesSearch;
            }).sort((a, b) => {
                const aSurplus = ((a.doiFe || 0) + (a.doiBe || 0)) > 30 ? 1 : 0;
                const bSurplus = ((b.doiFe || 0) + (b.doiBe || 0)) > 30 ? 1 : 0;
                if (bSurplus !== aSurplus) return bSurplus - aSurplus;
                return ((b.doiFe || 0) + (b.doiBe || 0)) - ((a.doiFe || 0) + (a.doiBe || 0));
            });
        } else {
            return surplusData.filter(item => {
                const matchesSearch = !searchTerm ||
                    item.skuName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.warehouse.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesPriority = selectedPriority === "All" || item.priority === selectedPriority;
                return matchesSearch && matchesPriority;
            });
        }
    };

    const filteredData = getFilteredData();

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
                }
                .insight-grid td {
                    padding: 12px;
                    font-size: 11px;
                    color: #334155;
                    vertical-align: middle;
                    border-bottom: 1px solid #e2e8f0;
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

            <div className="space-y-6 animate-in fade-in duration-500 pb-12">
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
                            <table className="insight-grid w-full text-sm" style={{ borderCollapse: "collapse" }}>
                                <thead>
                                    <TableRow style={{ borderBottom: "2px solid #cbd5e1" }}>
                                        <TableHead className="px-3 py-3 text-left">PO Number</TableHead>
                                        <TableHead className="px-3 py-3 text-left">Priority</TableHead>
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
                                        <TableHead className="px-3 py-3 text-left">Status</TableHead>
                                        <TableHead className="px-3 py-3 text-right">Order Value</TableHead>
                                        <TableHead className="px-3 py-3 text-left">Raised On</TableHead>
                                        <TableHead className="px-3 py-3 text-left">Appt Date</TableHead>
                                        <TableHead className="px-3 py-3 text-left">Expiry</TableHead>
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
                                        <TableHead className="px-3 py-3 text-right">LT (days)</TableHead>
                                        <TableHead className="px-3 py-3 text-right">Fill Rate</TableHead>
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
                                        filteredData.map((po) => (
                                            <TableRow key={`${po.poNumber}-${po.facilityName}`} className="hover:bg-blue-50/30 transition-colors duration-200">
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
                                                                flexShrink: 0,
                                                                whiteSpace: "nowrap"
                                                        >
                                                            <BoxIcon size={7} />
                                                            Show SKUs
                                                        </button>
                                                    </div>
                                                </TableCell>

                                                {/* Priority */}
                                                <TableCell className="px-3 py-3">
                                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md ${po.priority === "High" ? "priority-badge-high" :
                                                        po.priority === "Medium" ? "priority-badge-medium" : "priority-badge-low"
                                                        }`}>
                                                        {po.priority}
                                                    </span>
                                                </TableCell>

                                                {/* Projected Sales at Risk */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-red-600">
                                                    {formatOrNA(po.projectedSalesAtRisk, formatINR)}
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

                                                {/* Order Value */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-900">
                                                    {formatOrNA(po.orderValue, formatINR)}
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

                                                {/* Fill Rate */}
                                                <TableCell className={`px-3 py-3 text-right text-[11px] font-bold ${po.fillRate >= 95 ? "text-emerald-600" : po.fillRate >= 90 ? "text-amber-600" : "text-red-600"}`}>
                                                    {formatOrNA(po.fillRate, (v) => `${v}%`)}
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
                            <table className="insight-grid w-full text-sm" style={{ borderCollapse: "collapse" }}>
                                <thead>
                                    <TableRow style={{ borderBottom: "2px solid #cbd5e1" }}>
                                        <TableHead className="px-3 py-3 text-left">SKU Name</TableHead>
                                        <TableHead className="px-3 py-3 text-left">CFA (Surplus)</TableHead>

                                        <TableHead className="px-3 py-3 text-right">City OSA %</TableHead>
                                        <TableHead className="px-3 py-3 text-right">DOI (FE)</TableHead>
                                        <TableHead className="px-3 py-3 text-right">DOI (BE)</TableHead>
                                        <TableHead className="px-3 py-3 text-right">SOH (FE)</TableHead>
                                        <TableHead className="px-3 py-3 text-right">SOH (BE)</TableHead>

                                        <TableHead className="px-3 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>CPD</span>
                                                <Tooltip title="Consumption Per Day (CPD) in units." arrow placement="top">
                                                    <span className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
                                                        <Info size={12} className="inline-block" />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </TableHead>
                                        <TableHead className="px-3 py-3 text-right">PSL Recovery</TableHead>

                                    </TableRow>
                                </thead>
                                <TableBody>
                                    {filteredData.length === 0 ? (
                                        <TableRow>
<<<<<<< HEAD
                                            <TableCell colSpan={10} className="text-center py-12 text-slate-400 text-[11px] font-semibold">
=======
                                            </TableCell>
                                    ) : (
<<<<<<< HEAD
                                        paginatedData.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-blue-50/30 transition-colors duration-200">
                                                {/* SKU Name */}
                                                <TableCell className="px-3 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-slate-900">{item.skuName}</span>
                                                        {item.sapCode && <span className="text-[9px] text-slate-500 font-normal">SAP: {item.sapCode}</span>}
                                                    </div>
=======
                                        filteredData.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-blue-50/30 transition-colors duration-200">
                                                {/* SKU Name */}
                                                <TableCell className="px-3 py-3">
                                                    <span className="text-[11px] font-bold text-slate-900">{item.skuName}</span>
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                                </TableCell>

                                                {/* From CFA */}
                                                <TableCell className="px-3 py-3 text-[11px] font-medium text-slate-800">
<<<<<<< HEAD
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
=======
                                                    <div className="flex items-center gap-1.5">
                                                        {formatOrNA(item.fromCfa)}
                                                        {((item.doiFe || 0) + (item.doiBe || 0)) > 30 && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                                                                Surplus
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>



                                                {/* City OSA % */}
                                                <TableCell className={`px-3 py-3 text-right text-[11px] font-bold ${item.cityOsa < 80 ? "text-red-500" : "text-emerald-600"}`}>
                                                    {formatOrNA(item.cityOsa, (v) => `${v}%`)}
                                                </TableCell>

                                                {/* DOI (FE) */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {formatOrNA(item.doiFe, (v) => `${v} days`)}
                                                </TableCell>

                                                {/* DOI (BE) */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {formatOrNA(item.doiBe, (v) => `${v} days`)}
                                                </TableCell>

                                                {/* SOH (FE) */}
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-medium text-slate-800">
                                                    {formatOrNA(item.sohFe)}
                                                </TableCell>

<<<<<<< HEAD
                                                {/* SOH Surplus */}
=======
                                                {/* SOH (BE) */}
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-medium text-slate-800">
                                                    {formatOrNA(item.sohBe)}
                                                </TableCell>

<<<<<<< HEAD
                                                {/* CPD Deficit */}
=======


                                                {/* CPD */}
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {formatOrNA(item.cpd)}
                                                </TableCell>

<<<<<<< HEAD
                                                {/* Transfer Qty */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-bold text-indigo-600">
                                                    {formatOrNA(item.transferQty, (v) => `${v} units`)}
                                                </TableCell>
=======
                                                {/* PSL Recovery */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-bold text-indigo-600">
                                                    {formatOrNA(item.pslRecovery, (v) => formatINR(v * 1000))}
                                                </TableCell>


>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </table>
                        )}

                        {activeTab === "manage-surplus" && (
<<<<<<< HEAD
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
=======
                            <table className="insight-grid w-full text-sm" style={{ borderCollapse: "collapse" }}>
                                <thead>
                                    <TableRow style={{ borderBottom: "2px solid #cbd5e1" }}>
                                        <TableHead className="px-3 py-3 text-left">SKU Name</TableHead>
                                        <TableHead className="px-3 py-3 text-left">Platform</TableHead>
                                        <TableHead className="px-3 py-3 text-left">Warehouse</TableHead>
                                        <TableHead className="px-3 py-3 text-left">Priority</TableHead>
                                        <TableHead className="px-3 py-3 text-right">SOH (BE)</TableHead>
                                        <TableHead className="px-3 py-3 text-right">SOH (FE)</TableHead>
                                        <TableHead className="px-3 py-3 text-right">DOI</TableHead>
                                        <TableHead className="px-3 py-3 text-right">CPD</TableHead>
                                        <TableHead className="px-3 py-3 text-right">City OSA</TableHead>
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
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
<<<<<<< HEAD
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
=======
                                        filteredData.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-blue-50/30 transition-colors duration-200">
                                                {/* SKU Name */}
                                                <TableCell className="px-3 py-3">
                                                    <span className="text-[11px] font-bold text-slate-900">{item.skuName}</span>
                                                </TableCell>

                                                {/* Platform */}
                                                <TableCell className="px-3 py-3 text-[11px] font-medium text-slate-500">
                                                    {formatOrNA(item.platform)}
                                                </TableCell>

                                                {/* Warehouse */}
                                                <TableCell className="px-3 py-3 text-[11px] font-medium text-slate-800">
                                                    {formatOrNA(item.warehouse)}
                                                </TableCell>

                                                {/* Priority */}
                                                <TableCell className="px-3 py-3">
                                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md ${item.priority === "High" ? "priority-badge-high" :
                                                        item.priority === "Medium" ? "priority-badge-medium" : "priority-badge-low"
                                                        }`}>
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                                        {formatOrNA(item.priority)}
                                                    </span>
                                                </TableCell>

<<<<<<< HEAD
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
=======
                                                {/* SOH (BE) */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-medium text-slate-800">
                                                    {formatOrNA(item.sohBe)}
                                                </TableCell>

                                                {/* SOH (FE) */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-medium text-slate-800">
                                                    {formatOrNA(item.sohFe)}
                                                </TableCell>

                                                {/* DOI */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {formatOrNA(item.doi, (v) => `${Math.round(Number(v))} days`)}
                                                </TableCell>

                                                {/* CPD */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {formatOrNA(item.cpd, (v) => Math.round(Number(v)))}
                                                </TableCell>

                                                {/* City OSA */}
                                                <TableCell className={`px-3 py-3 text-right text-[11px] font-bold ${item.cityOsa < 80 ? "text-red-500" : "text-emerald-600"}`}>
                                                    {formatOrNA(item.cityOsa, (v) => `${v}%`)}
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </table>
                        )}
                    </div>
<<<<<<< HEAD

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
=======
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                </div>
            </div>

            {/* ─── Show SKUs Modal ─── */}
            <Dialog open={activePO !== null} onOpenChange={(open) => { if (!open) setActivePO(null); }}>
<<<<<<< HEAD
                <DialogContent hideCloseButton className="p-0 overflow-hidden rounded-[18px] border-none shadow-2xl transition-all duration-300 max-h-[85vh] flex flex-col sm:max-w-3xl top-[50%] translate-y-[-50%]">
                    {activePO && (
                        <div className="flex flex-col bg-white overflow-hidden max-h-full">
=======
                <DialogContent className={`p-0 overflow-hidden rounded-[18px] border-none shadow-2xl transition-all duration-300 ${trendSku ? 'sm:max-w-5xl' : 'sm:max-w-2xl'}`}>
                    {activePO && (
                        <div className="flex flex-col bg-white">
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
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
<<<<<<< HEAD
                            <div style={{ overflowY: "auto", transition: "max-height 0.3s ease", paddingBottom: "10px" }}>
=======
                            <div style={{ maxHeight: trendSku ? "280px" : "520px", overflowY: "auto", transition: "max-height 0.3s ease" }}>
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
                                    <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                                        <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                                            <th style={{ padding: "10px 16px", fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>SKU Name</th>
                                            <th style={{ padding: "10px 12px", fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>Units Ordered</th>
                                            <th style={{ padding: "10px 12px", fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>Units Delivered</th>
                                            <th style={{ padding: "10px 12px", fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>Fill Rate</th>
<<<<<<< HEAD
=======
                                            <th style={{ padding: "10px 8px", fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center", width: "44px" }}>Trend</th>
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingDetail ? (
                                            <tr>
<<<<<<< HEAD
                                                <td colSpan={4} style={{ padding: "32px 16px", textAlign: "center" }}>
=======
                                                <td colSpan={5} style={{ padding: "32px 16px", textAlign: "center" }}>
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                                    <div className="flex justify-center items-center gap-2">
                                                        <RefreshCw size={16} className="animate-spin text-indigo-600" />
                                                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Loading SKUs...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : activePODetail?.skus?.length > 0 ? (
                                            activePODetail.skus.map((sku, sIdx) => {
<<<<<<< HEAD
=======
                                                const isActiveTrend = trendSku?.webPid === sku.webPid;
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                                return (
                                                    <tr key={sIdx} style={{
                                                        borderBottom: "1px solid #f1f5f9",
                                                        transition: "background 0.15s",
<<<<<<< HEAD
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
=======
                                                        background: isActiveTrend ? "#eff6ff" : undefined
                                                    }} className={isActiveTrend ? "" : "hover:bg-blue-50/40"}>
                                                        <td style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 600, color: "#1e293b", maxWidth: "220px" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                                {sku.imageUrl && (
                                                                    <img src={sku.imageUrl} alt="" style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #e2e8f0", objectFit: "contain", background: "#fff", flexShrink: 0 }} />
                                                                )}
                                                                <span className="line-clamp-2">{sku.skuName}</span>
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 600, color: "#475569", textAlign: "right" }}>
                                                            {formatOrNA(sku.unitsOrdered, (v) => v.toLocaleString())}
                                                        </td>
                                                        <td style={{ padding: "10px 12px", fontSize: "11px", fontWeight: 600, color: "#475569", textAlign: "right" }}>
                                                            {formatOrNA(sku.unitsDelivered, (v) => v.toLocaleString())}
                                                        </td>
<<<<<<< HEAD
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
=======
                                                        <td style={{
                                                            padding: "10px 12px", fontSize: "11px", fontWeight: 700, textAlign: "right",
                                                            color: !sku.fillRate ? "#64748b" : sku.fillRate >= 95 ? "#16a34a" : sku.fillRate >= 50 ? "#d97706" : "#dc2626"
                                                        }}>
                                                            {formatOrNA(sku.fillRate, (v) => `${v}%`)}
                                                        </td>
                                                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                                                            <button
                                                                onClick={() => fetchSKUTrend(sku.webPid, sku.skuName)}
                                                                disabled={!sku.webPid}
                                                                title={sku.webPid ? "View KPI Trends" : "No web_pid available"}
                                                                style={{
                                                                    background: isActiveTrend ? "#2563eb" : "#f1f5f9",
                                                                    border: "none",
                                                                    borderRadius: "6px",
                                                                    padding: "5px",
                                                                    cursor: sku.webPid ? "pointer" : "not-allowed",
                                                                    display: "inline-flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    transition: "all 0.2s",
                                                                    opacity: sku.webPid ? 1 : 0.35,
                                                                }}
                                                            >
                                                                <BarChart3 size={14} color={isActiveTrend ? "#fff" : "#64748b"} />
                                                            </button>
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
<<<<<<< HEAD
                                                <td colSpan={4} style={{ padding: "24px 16px", textAlign: "center", fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
=======
                                                <td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
                                                    No SKU data available for this PO.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

<<<<<<< HEAD
=======
                            {/* ─── SKU Trend Panel (Multi-KPI) ─── */}
                            {trendSku && (
                                <div style={{
                                    borderTop: "2px solid #e2e8f0",
                                    background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
                                    padding: "16px 20px 18px",
                                    animation: "fadeIn 0.25s ease-out",
                                }}>
                                    {/* Trend Header */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "12px" }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                                                <BarChart3 size={14} color="#2563eb" />
                                                <span style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>KPI Trend</span>
                                            </div>
                                            <p style={{ fontSize: "10px", color: "#64748b", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {trendSku.skuName}
                                            </p>
                                        </div>

                                        {/* Time Step Segmented Controls */}
                                        <div style={{ display: "flex", background: "#f1f5f9", borderRadius: "8px", padding: "2px", gap: "2px", flexShrink: 0 }}>
                                            {['daily', 'weekly', 'monthly'].map(step => (
                                                <button
                                                    key={step}
                                                    onClick={() => setTimeStep(step)}
                                                    style={{
                                                        padding: "4px 10px",
                                                        borderRadius: "6px",
                                                        border: "none",
                                                        background: timeStep === step ? "#fff" : "transparent",
                                                        color: timeStep === step ? "#1e293b" : "#64748b",
                                                        fontSize: "10px",
                                                        fontWeight: 700,
                                                        cursor: "pointer",
                                                        boxShadow: timeStep === step ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                                                        textTransform: "capitalize",
                                                        transition: "all 0.15s ease",
                                                    }}
                                                >
                                                    {step}
                                                </button>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => { setTrendSku(null); setTrendData(null); }}
                                            style={{
                                                background: "#f1f5f9",
                                                border: "none",
                                                borderRadius: "6px",
                                                padding: "4px",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <X size={12} color="#64748b" />
                                        </button>
                                    </div>

                                    {/* Multi-Select KPI Toggle Buttons */}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                                        {Object.entries(KPI_CONFIG).map(([key, cfg]) => {
                                            const isActive = activeKpis.has(key);
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => toggleKpi(key)}
                                                    style={{
                                                        padding: "5px 14px",
                                                        borderRadius: "20px",
                                                        border: isActive ? `1.5px solid ${cfg.color}` : "1.5px solid #e2e8f0",
                                                        background: isActive ? cfg.color : "#fff",
                                                        color: isActive ? "#fff" : "#64748b",
                                                        fontSize: "11px",
                                                        fontWeight: 700,
                                                        cursor: "pointer",
                                                        transition: "all 0.2s",
                                                        letterSpacing: "0.01em",
                                                        boxShadow: isActive ? `0 2px 8px ${cfg.color}40` : "none",
                                                    }}
                                                >
                                                    {cfg.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Chart Area */}
                                    {trendLoading ? (
                                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "220px", gap: "8px" }}>
                                            <RefreshCw size={16} className="animate-spin text-indigo-600" />
                                            <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Loading trend data...</span>
                                        </div>
                                    ) : trendData?.dates?.length > 0 ? (() => {
                                        // Build chart data with all active KPIs as separate keys
                                        const activeList = [...activeKpis];
                                        const chartData = trendData.dates.map((date, i) => {
                                            const d = new Date(date);
                                            let labelDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                                            let tooltipDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                                            if (timeStep === 'monthly') {
                                                labelDate = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                                                tooltipDate = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                                            } else if (timeStep === 'weekly') {
                                                labelDate = 'W/C ' + d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                                                const nextWeek = new Date(d);
                                                nextWeek.setDate(nextWeek.getDate() + 6);
                                                tooltipDate = `Week of ${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${nextWeek.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
                                            }

                                            const point = {
                                                date: labelDate,
                                                fullDate: tooltipDate,
                                            };
                                            activeList.forEach(key => {
                                                point[key] = trendData.kpis[key]?.[i] ?? null;
                                            });
                                            return point;
                                        });

                                        // Determine if we need dual Y-axis
                                        const hasLeftAxis = activeList.some(k => KPI_CONFIG[k].axis === 'left');
                                        const hasRightAxis = activeList.some(k => KPI_CONFIG[k].axis === 'right');

                                        // Custom tooltip
                                        const CustomTooltip = ({ active, payload, label }) => {
                                            if (!active || !payload?.length) return null;
                                            return (
                                                <div style={{
                                                    background: "#fff",
                                                    border: "1px solid #e2e8f0",
                                                    borderRadius: "10px",
                                                    padding: "10px 14px",
                                                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                                                    minWidth: "140px",
                                                }}>
                                                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", marginBottom: "6px", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px" }}>
                                                        {payload[0]?.payload?.fullDate || label}
                                                    </p>
                                                    {payload.map((entry, idx) => {
                                                        const cfg = KPI_CONFIG[entry.dataKey];
                                                        if (!cfg) return null;
                                                        return (
                                                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "2px 0" }}>
                                                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                                                                <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", flex: 1 }}>{cfg.label}</span>
                                                                <span style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                                                                    {entry.value !== null && entry.value !== undefined ? cfg.format(entry.value) : 'N/A'}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        };

                                        return (
                                            <div style={{ width: "100%", height: "240px" }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={chartData} margin={{ top: 8, right: hasRightAxis ? 10 : 12, left: 0, bottom: 4 }}>
                                                        <defs>
                                                            {activeList.map(key => (
                                                                <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor={KPI_CONFIG[key].gradient[0]} stopOpacity={0.2} />
                                                                    <stop offset="95%" stopColor={KPI_CONFIG[key].gradient[1]} stopOpacity={0.02} />
                                                                </linearGradient>
                                                            ))}
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                        <XAxis
                                                            dataKey="date"
                                                            tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }}
                                                            tickLine={false}
                                                            axisLine={{ stroke: "#e2e8f0" }}
                                                            interval={Math.max(0, Math.floor(chartData.length / 7) - 1)}
                                                        />
                                                        {hasLeftAxis && (
                                                            <YAxis
                                                                yAxisId="left"
                                                                orientation="left"
                                                                tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }}
                                                                tickLine={false}
                                                                axisLine={false}
                                                                width={48}
                                                                tickFormatter={(v) => {
                                                                    const activeLeftKpis = activeList.filter(k => KPI_CONFIG[k].axis === 'left');
                                                                    const isCurrencyOnly = activeLeftKpis.length > 0 && activeLeftKpis.every(k => k === 'offtake' || k === 'drr' || k === 'price');
                                                                    const formatted = formatK_Lac_Cr(v);
                                                                    if (formatted === "N/A") return "";
                                                                    return isCurrencyOnly ? `₹${formatted}` : formatted;
                                                                }}
                                                            />
                                                        )}
                                                        {hasRightAxis && (
                                                            <YAxis
                                                                yAxisId="right"
                                                                orientation="right"
                                                                tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }}
                                                                tickLine={false}
                                                                axisLine={false}
                                                                width={40}
                                                                domain={[0, 100]}
                                                                tickFormatter={(v) => `${v}%`}
                                                            />
                                                        )}
                                                        <RechartsTooltip content={<CustomTooltip />} />
                                                        {activeList.map(key => {
                                                            const cfg = KPI_CONFIG[key];
                                                            const yId = cfg.axis === 'right' && hasRightAxis ? 'right'
                                                                : cfg.axis === 'left' && hasLeftAxis ? 'left'
                                                                    : hasLeftAxis ? 'left' : 'right';
                                                            return (
                                                                <Area
                                                                    key={key}
                                                                    type="monotone"
                                                                    dataKey={key}
                                                                    yAxisId={yId}
                                                                    stroke={cfg.color}
                                                                    strokeWidth={2.5}
                                                                    fill={`url(#gradient-${key})`}
                                                                    dot={false}
                                                                    activeDot={{ r: 4, fill: cfg.color, stroke: "#fff", strokeWidth: 2 }}
                                                                />
                                                            );
                                                        })}
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        );
                                    })() : (
                                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "220px" }}>
                                            <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8" }}>No trend data available for this SKU.</span>
                                        </div>
                                    )}
                                </div>
                            )}

>>>>>>> a99f57ee9b9a2917531132e38ce846e365fb7ec8
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
