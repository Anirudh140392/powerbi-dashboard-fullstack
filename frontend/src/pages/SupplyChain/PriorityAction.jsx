import React, { useEffect, useContext, useState } from "react";
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
    ArrowLeftRight
} from "lucide-react";
import { Tooltip } from "@mui/material";

// Helper to format currency in INR style
const formatINR = (n) => {
    if (typeof n !== "number") return "N/A";
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(n);
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

    // Mock data for Fix Stock Transfer
    const initialStockTransferData = [
        {
            id: "ST-001",
            skuName: "Almond Milk 1L",
            fromCfa: "Mumbai CFA (Surplus)",
            toCfa: "Delhi CFA (Shortage)",
            cityOsa: 78,
            doiFe: 3.5,
            doiBe: 12.2,
            sohFe: 420,
            sohBe: 1450,
            runRate: 120,
            cpd: 110,
            pslRecovery: 85,
            skus: [
                { name: "Almond Milk 1L", qty: 500, value: 75000, fill: "100%" }
            ]
        },
        {
            id: "ST-002",
            skuName: "Oat Milk Barista 1L",
            fromCfa: "Bangalore CFA (Surplus)",
            toCfa: "Chennai CFA (Shortage)",
            cityOsa: 82,
            doiFe: 4.1,
            doiBe: 15.0,
            sohFe: 310,
            sohBe: 1120,
            runRate: 75,
            cpd: 70,
            pslRecovery: 90,
            skus: [
                { name: "Oat Milk Barista 1L", qty: 300, value: 54000, fill: "100%" }
            ]
        },
        {
            id: "ST-003",
            skuName: "Chocolate Protein Shake 330ml",
            fromCfa: "Kolkata CFA (Surplus)",
            toCfa: "Patna CFA (Shortage)",
            cityOsa: 65,
            doiFe: 1.8,
            doiBe: 8.5,
            sohFe: 120,
            sohBe: 580,
            runRate: 65,
            cpd: 65,
            pslRecovery: 72,
            skus: [
                { name: "Chocolate Protein Shake 330ml", qty: 250, value: 18750, fill: "100%" }
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

    // API Data States
    const [poData, setPoData] = useState([]);
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

    // Handle Know More modal click to fetch SKU level details dynamically
    const handleKnowMore = async (po) => {
        setActivePO(po);
        setActivePODetail(null);
        setLoadingDetail(true);
        try {
            const response = await axiosInstance.get('/supply-chain/po-detail', {
                params: { poNumber: po.poNumber }
            });
            if (response.data) {
                setActivePODetail(response.data);
            }
        } catch (err) {
            console.error('[PriorityAction] Error fetching PO detail:', err);
        } finally {
            setLoadingDetail(false);
        }
    };

    // Apply filtering based on active tab
    const getFilteredData = () => {
        if (activeTab === "prioritize-po") {
            // Apply priority client-side so it's super snappy
            return poData.filter(po => {
                return selectedPriority === "All" || po.priority === selectedPriority;
            });
        } else if (activeTab === "stock-transfer") {
            return initialStockTransferData.filter(item => {
                const matchesSearch = item.skuName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                      item.fromCfa.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                      item.toCfa.toLowerCase().includes(searchTerm.toLowerCase());
                return matchesSearch;
            });
        } else {
            return initialSurplusData.filter(item => {
                const matchesSearch = item.skuName.toLowerCase().includes(searchTerm.toLowerCase()) || 
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
            <style dangerouslySetInnerHTML={{ __html: `
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
                                61
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
                                839
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
                                        <TableHead className="px-3 py-3 text-center">Actions</TableHead>
                                    </TableRow>
                                </thead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={14} className="text-center py-16">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <RefreshCw size={24} className="animate-spin text-indigo-600" />
                                                    <span className="text-[11px] font-bold text-slate-500">Querying ClickHouse DB (Mars)...</span>
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
                                            <TableRow key={po.poNumber} className="hover:bg-blue-50/30 transition-colors duration-200">
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
                                                                fontSize: "9px",
                                                                textTransform: "uppercase",
                                                                border: "1px solid rgba(99, 102, 241, 0.2)", 
                                                                borderRadius: "6px",
                                                                padding: "4px 10px", cursor: "pointer",
                                                                display: "inline-flex", alignItems: "center", gap: "4px",
                                                                transition: "all 0.2s ease",
                                                                letterSpacing: "0.01em",
                                                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                                                minWidth: "max-content",
                                                                flexShrink: 0,
                                                                whiteSpace: "nowrap"
                                                            }}
                                                        >
                                                            <Sparkles size={10} color="#4f46e5" />
                                                            Know More
                                                        </button>
                                                    </div>
                                                </TableCell>
                                                
                                                {/* Priority */}
                                                <TableCell className="px-3 py-3">
                                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md ${
                                                        po.priority === "High" ? "priority-badge-high" : 
                                                        po.priority === "Medium" ? "priority-badge-medium" : "priority-badge-low"
                                                    }`}>
                                                        {po.priority}
                                                    </span>
                                                </TableCell>
 
                                                {/* Projected Sales at Risk */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-red-600">
                                                    {formatINR(po.projectedSalesAtRisk)}
                                                </TableCell>
 
                                                {/* Platform Warehouse */}
                                                <TableCell className="px-3 py-3 text-[11px] text-slate-800 font-medium">
                                                    {po.platformWarehouse}
                                                </TableCell>
 
                                                {/* Status */}
                                                <TableCell className="px-3 py-3">
                                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full ${
                                                        po.rawStatus === "delayed" ? "status-badge-delayed" :
                                                        po.rawStatus === "in_transit" || po.rawStatus === "in transit" ? "status-badge-intransit" :
                                                        po.rawStatus === "pending" ? "status-badge-pending" : "status-badge-appointed"
                                                    }`}>
                                                        {po.status}
                                                    </span>
                                                </TableCell>
 
                                                {/* Order Value */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-900">
                                                    {formatINR(po.orderValue)}
                                                </TableCell>
 
                                                {/* Raised On */}
                                                <TableCell className="px-3 py-3 text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                                    {po.raisedOn}
                                                </TableCell>
 
                                                {/* Appt Date */}
                                                <TableCell className="px-3 py-3 text-[11px] text-slate-800 font-semibold whitespace-nowrap">
                                                    {po.apptDate || "-"}
                                                </TableCell>
 
                                                {/* Expiry */}
                                                <TableCell className="px-3 py-3 text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                                    {po.expiry}
                                                </TableCell>
 
                                                {/* AVG DOI */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {po.avgDoi} days
                                                </TableCell>
 
                                                {/* LT */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] text-slate-600 font-medium">
                                                    {po.lt} days
                                                </TableCell>
 
                                                {/* Fill Rate */}
                                                <TableCell className={`px-3 py-3 text-right text-[11px] font-bold ${po.fillRate >= 95 ? "text-emerald-600" : po.fillRate >= 90 ? "text-amber-600" : "text-red-600"}`}>
                                                    {po.fillRate}%
                                                </TableCell>
 
                                                {/* Consumption per Day */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {po.consumptionPerDay} units
                                                </TableCell>
 
                                                {/* Actions */}
                                                <TableCell className="px-3 py-3 text-center">
                                                    <button
                                                        onClick={() => handleKnowMore(po)}
                                                        className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
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
                                        <TableHead className="px-3 py-3 text-left">From CFA (Surplus)</TableHead>
                                        <TableHead className="px-3 py-3 text-left">To CFA (Shortage)</TableHead>
                                        <TableHead className="px-3 py-3 text-right">City OSA %</TableHead>
                                        <TableHead className="px-3 py-3 text-right">DOI (FE)</TableHead>
                                        <TableHead className="px-3 py-3 text-right">DOI (BE)</TableHead>
                                        <TableHead className="px-3 py-3 text-right">SOH (FE)</TableHead>
                                        <TableHead className="px-3 py-3 text-right">SOH (BE)</TableHead>
                                        <TableHead className="px-3 py-3 text-right">Run Rate</TableHead>
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
                                        <TableHead className="px-3 py-3 text-center">Actions</TableHead>
                                    </TableRow>
                                </thead>
                                <TableBody>
                                    {filteredData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={12} className="text-center py-12 text-slate-400 text-[11px] font-semibold">
                                                No stock transfers matching search found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredData.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-blue-50/30 transition-colors duration-200">
                                                {/* SKU Name with Know More button */}
                                                <TableCell className="px-3 py-3">
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
                                                        <span className="text-[11px] font-bold text-slate-900">{item.skuName}</span>
                                                        <button
                                                            onClick={() => setActivePO(item)}
                                                            style={{
                                                                background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                                                                color: "#4f46e5",
                                                                fontWeight: 700,
                                                                fontSize: "9px",
                                                                textTransform: "uppercase",
                                                                border: "1px solid rgba(99, 102, 241, 0.2)", 
                                                                borderRadius: "6px",
                                                                padding: "4px 10px", cursor: "pointer",
                                                                display: "inline-flex", alignItems: "center", gap: "4px",
                                                                transition: "all 0.2s ease",
                                                                letterSpacing: "0.01em",
                                                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                                                minWidth: "max-content",
                                                                flexShrink: 0,
                                                                whiteSpace: "nowrap"
                                                            }}
                                                        >
                                                            <Sparkles size={10} color="#4f46e5" />
                                                            Know More
                                                        </button>
                                                    </div>
                                                </TableCell>

                                                {/* From CFA */}
                                                <TableCell className="px-3 py-3 text-[11px] font-medium text-slate-800">
                                                    {item.fromCfa}
                                                </TableCell>

                                                {/* To CFA */}
                                                <TableCell className="px-3 py-3 text-[11px] font-medium text-slate-800">
                                                    {item.toCfa}
                                                </TableCell>

                                                {/* City OSA % */}
                                                <TableCell className={`px-3 py-3 text-right text-[11px] font-bold ${item.cityOsa < 80 ? "text-red-500" : "text-emerald-600"}`}>
                                                    {item.cityOsa}%
                                                </TableCell>

                                                {/* DOI (FE) */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {item.doiFe} days
                                                </TableCell>

                                                {/* DOI (BE) */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {item.doiBe} days
                                                </TableCell>

                                                {/* SOH (FE) */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-medium text-slate-800">
                                                    {item.sohFe}
                                                </TableCell>

                                                {/* SOH (BE) */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-medium text-slate-800">
                                                    {item.sohBe}
                                                </TableCell>

                                                {/* Run Rate */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {item.runRate}
                                                </TableCell>

                                                {/* CPD */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {item.cpd}
                                                </TableCell>

                                                {/* PSL Recovery */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-bold text-indigo-600">
                                                    {formatINR(item.pslRecovery * 1000)}
                                                </TableCell>

                                                {/* Actions */}
                                                <TableCell className="px-3 py-3 text-center">
                                                    <button
                                                        onClick={() => setActivePO(item)}
                                                        className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </table>
                        )}

                        {activeTab === "manage-surplus" && (
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
                                        <TableHead className="px-3 py-3 text-center">Actions</TableHead>
                                    </TableRow>
                                </thead>
                                <TableBody>
                                    {filteredData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-12 text-slate-400 text-[11px] font-semibold">
                                                No surplus items matching filters found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredData.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-blue-50/30 transition-colors duration-200">
                                                {/* SKU Name with Know More button */}
                                                <TableCell className="px-3 py-3">
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
                                                        <span className="text-[11px] font-bold text-slate-900">{item.skuName}</span>
                                                        <button
                                                            onClick={() => setActivePO(item)}
                                                            style={{
                                                                background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                                                                color: "#4f46e5",
                                                                fontWeight: 700,
                                                                fontSize: "9px",
                                                                textTransform: "uppercase",
                                                                border: "1px solid rgba(99, 102, 241, 0.2)", 
                                                                borderRadius: "6px",
                                                                padding: "4px 10px", cursor: "pointer",
                                                                display: "inline-flex", alignItems: "center", gap: "4px",
                                                                transition: "all 0.2s ease",
                                                                letterSpacing: "0.01em",
                                                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                                                minWidth: "max-content",
                                                                flexShrink: 0,
                                                                whiteSpace: "nowrap"
                                                            }}
                                                        >
                                                            <Sparkles size={10} color="#4f46e5" />
                                                            Know More
                                                        </button>
                                                    </div>
                                                </TableCell>

                                                {/* Platform */}
                                                <TableCell className="px-3 py-3 text-[11px] font-medium text-slate-500">
                                                    {item.platform}
                                                </TableCell>

                                                {/* Warehouse */}
                                                <TableCell className="px-3 py-3 text-[11px] font-medium text-slate-800">
                                                    {item.warehouse}
                                                </TableCell>

                                                {/* Priority */}
                                                <TableCell className="px-3 py-3">
                                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md ${
                                                        item.priority === "High" ? "priority-badge-high" : 
                                                        item.priority === "Medium" ? "priority-badge-medium" : "priority-badge-low"
                                                    }`}>
                                                        {item.priority}
                                                    </span>
                                                </TableCell>

                                                {/* SOH (BE) */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-medium text-slate-800">
                                                    {item.sohBe}
                                                </TableCell>

                                                {/* SOH (FE) */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-medium text-slate-800">
                                                    {item.sohFe}
                                                </TableCell>

                                                {/* DOI */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {item.doi} days
                                                </TableCell>

                                                {/* CPD */}
                                                <TableCell className="px-3 py-3 text-right text-[11px] font-semibold text-slate-700">
                                                    {item.cpd}
                                                </TableCell>

                                                {/* City OSA */}
                                                <TableCell className={`px-3 py-3 text-right text-[11px] font-bold ${item.cityOsa < 80 ? "text-red-500" : "text-emerald-600"}`}>
                                                    {item.cityOsa}%
                                                </TableCell>

                                                {/* Actions */}
                                                <TableCell className="px-3 py-3 text-center">
                                                    <button
                                                        onClick={() => setActivePO(item)}
                                                        className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── PO/SKU Details Modal / Dialog (Gorgeously Designed) ─── */}
            <Dialog open={activePO !== null} onOpenChange={(open) => { if (!open) setActivePO(null); }}>
                <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-[24px] border-none shadow-2xl">
                    {activePO && (
                        <div className="flex flex-col bg-white">
                            {/* Header (with platform background and item info) */}
                            <div className="bg-gradient-to-r from-indigo-500 to-indigo-700 p-6 text-white relative">
                                <button
                                    onClick={() => setActivePO(null)}
                                    className="absolute right-4 top-4 p-1 hover:bg-white/10 rounded-full transition-all text-white/80 hover:text-white"
                                >
                                    <X size={18} />
                                </button>
                                <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-white/20 text-white border border-white/30 mr-2`}>
                                    {activePO.priority || "Standard"} Action
                                </span>
                                <h3 className="text-lg font-extrabold mt-2 tracking-tight">
                                    {activePO.skuName || activePO.poNumber}
                                </h3>
                                <p className="text-white/80 text-xs mt-1 font-medium">
                                    {activePO.platformWarehouse || activePO.warehouse || `${activePO.fromCfa} ➔ ${activePO.toCfa}`}
                                </p>
                            </div>

                            {/* Details Body */}
                            <div className="p-6 space-y-6">
                                {/* Details KPI Overview */}
                                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div className="text-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                            {activeTab === "prioritize-po" ? "Sales At Risk" : "City OSA"}
                                        </span>
                                        <p className={`text-[13px] font-black mt-1 ${activeTab === "prioritize-po" ? "text-red-600" : "text-emerald-600"}`}>
                                            {activeTab === "prioritize-po" ? formatINR(activePO.projectedSalesAtRisk) : `${activePO.cityOsa}%`}
                                        </p>
                                    </div>
                                    <div className="text-center border-x border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                            {activeTab === "prioritize-po" ? "Order Value" : "Daily Consumption"}
                                        </span>
                                        <p className="text-[13px] font-black text-slate-800 mt-1">
                                            {activeTab === "prioritize-po" ? formatINR(activePO.orderValue) : activePO.cpd} units
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                            {activeTab === "prioritize-po" ? "Fill Rate" : "Stock SOH (FE)"}
                                        </span>
                                        <p className="text-[13px] font-black text-indigo-600 mt-1">
                                            {activeTab === "prioritize-po" ? `${activePO.fillRate}%` : activePO.sohFe}
                                        </p>
                                    </div>
                                </div>

                                {/* Scheduling / CFA Logistics */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <Calendar size={14} className="text-indigo-600" />
                                        Logistics & Storage Context
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100">
                                            <span className="text-slate-400 font-medium">Platform / Location</span>
                                            <span className="font-semibold text-slate-700">{activePO.platform || "CFA Node"}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100">
                                            <span className="text-slate-400 font-medium">Stock SOH (BE)</span>
                                            <span className="font-semibold text-slate-800">{activePO.sohBe || "N/A"}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100">
                                            <span className="text-slate-400 font-medium">Coverage DOI</span>
                                            <span className="font-semibold text-slate-700">{activePO.doi || activePO.doiFe || activePO.avgDoi} days</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100">
                                            <span className="text-slate-400 font-medium">Lead Time (LT)</span>
                                            <span className="font-semibold text-slate-700">{activePO.lt || 5} days</span>
                                        </div>
                                    </div>
                                </div>

                                {/* SKU Item List */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <Package size={14} className="text-indigo-600" />
                                        SKU Specific Details
                                    </h4>
                                    <div className="border border-slate-150 rounded-xl overflow-hidden">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Item Name</th>
                                                    <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">Qty</th>
                                                    <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">Value</th>
                                                    <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">Fill Rate</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {loadingDetail ? (
                                                    <tr>
                                                        <td colSpan={4} className="px-3 py-6 text-center">
                                                            <div className="flex justify-center items-center gap-2">
                                                                <RefreshCw size={16} className="animate-spin text-indigo-600" />
                                                                <span className="text-[11px] font-bold text-slate-500">Loading SKU-level details...</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : activeTab === "prioritize-po" ? (
                                                    activePODetail?.skus?.map((sku, sIdx) => (
                                                        <tr key={sIdx} className="hover:bg-slate-50">
                                                            <td className="px-3 py-2.5 text-[11px] font-semibold text-slate-700 flex items-center gap-2">
                                                                {sku.imageUrl && (
                                                                    <img src={sku.imageUrl} alt={sku.skuName} className="w-8 h-8 rounded border object-contain bg-white" />
                                                                )}
                                                                <span className="line-clamp-2">{sku.skuName}</span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-[11px] text-slate-600 text-right font-medium">{sku.unitsOrdered}</td>
                                                            <td className="px-3 py-2.5 text-[11px] text-slate-900 font-bold text-right">
                                                                {formatINR(sku.totalValue)}
                                                            </td>
                                                            <td className={`px-3 py-2.5 text-[11px] text-right font-bold ${sku.fillRate >= 95 ? "text-emerald-600" : "text-amber-600"}`}>{sku.fillRate}%</td>
                                                        </tr>
                                                    )) || (
                                                        <tr>
                                                            <td colSpan={4} className="px-3 py-4 text-center text-slate-400 text-[11px]">No SKU data available.</td>
                                                        </tr>
                                                    )
                                                ) : activePO.skus ? activePO.skus.map((sku, sIdx) => (
                                                    <tr key={sIdx} className="hover:bg-slate-50">
                                                        <td className="px-3 py-2.5 text-[11px] font-semibold text-slate-700">{sku.name}</td>
                                                        <td className="px-3 py-2.5 text-[11px] text-slate-600 text-right font-medium">{sku.qty}</td>
                                                        <td className="px-3 py-2.5 text-[11px] text-slate-900 font-bold text-right">
                                                            {sku.value ? formatINR(sku.value) : "N/A"}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-[11px] text-indigo-600 text-right font-bold">{sku.fill}</td>
                                                    </tr>
                                                )) : (
                                                    <tr className="hover:bg-slate-50">
                                                        <td className="px-3 py-2.5 text-[11px] font-semibold text-slate-700">{activePO.skuName}</td>
                                                        <td className="px-3 py-2.5 text-[11px] text-slate-600 text-right font-medium">1</td>
                                                        <td className="px-3 py-2.5 text-[11px] text-slate-900 font-bold text-right">N/A</td>
                                                        <td className="px-3 py-2.5 text-[11px] text-indigo-600 text-right font-bold">100%</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Call to action buttons */}
                                <div className="flex gap-3 pt-3">
                                    <button 
                                        onClick={() => {
                                            alert(`Actioning priority item: ${activePO.skuName || activePO.poNumber}...`);
                                            setActivePO(null);
                                        }}
                                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <Truck size={14} />
                                        Initiate Action
                                    </button>
                                    <button 
                                        onClick={() => setActivePO(null)}
                                        className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </CommonContainer>
    );
}
