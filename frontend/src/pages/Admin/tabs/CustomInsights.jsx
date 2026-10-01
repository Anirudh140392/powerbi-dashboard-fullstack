import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
    CheckCircle,
    AlertCircle,
    RefreshCw,
    Database,
    Sparkles,
    Activity
} from "lucide-react";

// Map of insight keys from the backend JSON to human-readable titles
const INSIGHTS_CARDS = [
    { key: "share_headroom_hotspots", label: "Share Headroom Hotspots" },
    { key: "price_parity_radar", label: "Price Parity Radar" },
    { key: "ds_listing_summary", label: "DS Listing Summary" },
    { key: "competitor_osa_weak_spots", label: "Competitor OSA Weak Spots" },
    { key: "remove_ad_low_osa", label: "Remove Ad Low OSA" },
    { key: "surplus_stock", label: "Surplus Stock" },
    { key: "prioritise_po", label: "Prioritise PO" },
    { key: "transfer_issue", label: "Transfer Issue" },
    { key: "new_market_entry", label: "New Market Entry" },
    { key: "dark_store_coverage_gaps", label: "Dark Store Coverage Gaps" },
    { key: "new_dark_store_expansion", label: "New Dark Store Expansion" },
    { key: "co_relations", label: "Co-Relations" }
];

const CustomInsights = () => {
    const [databases, setDatabases] = useState([]);
    const [selectedDb, setSelectedDb] = useState(null);
    const [insightsKpi, setInsightsKpi] = useState({});
    
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingConfig, setIsFetchingConfig] = useState(false);
    const [toast, setToast] = useState(null);

    // Show toast message helper
    const showToast = (message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Fetch available databases on mount
    useEffect(() => {
        const fetchDatabases = async () => {
            try {
                setIsLoading(true);
                const token = sessionStorage.getItem("token");
                const res = await axios.get("/api/admin/databases", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success && res.data.data.length > 0) {
                    setDatabases(res.data.data);
                    
                    const savedDbId = sessionStorage.getItem("customInsightsDbId");
                    let defaultDb = null;

                    if (savedDbId) {
                        defaultDb = res.data.data.find(d => String(d.db_id) === savedDbId);
                    }

                    if (!defaultDb) {
                        const currentUserStr = sessionStorage.getItem("user");
                        if (currentUserStr) {
                            const currentUser = JSON.parse(currentUserStr);
                            defaultDb = res.data.data.find(d => d.db_name === currentUser.dbName);
                        }
                    }
                    
                    if (!defaultDb) {
                        defaultDb = res.data.data[0];
                    }
                    
                    setSelectedDb(defaultDb);
                }
            } catch (err) {
                console.error("[CustomInsights] Failed to fetch databases:", err);
                showToast("Failed to load database client list", "error");
            } finally {
                setIsLoading(false);
            }
        };

        fetchDatabases();
    }, []);

    // Fetch insights configuration when selected database changes
    useEffect(() => {
        if (!selectedDb) return;

        const fetchInsightsConfig = async () => {
            setIsFetchingConfig(true);
            try {
                const token = sessionStorage.getItem("token");
                const res = await axios.get(`/api/admin/databases/insights?db_id=${selectedDb.db_id}&t=${Date.now()}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (res.data.success) {
                    // Start with all true by default
                    const newKpi = {};
                    INSIGHTS_CARDS.forEach(card => {
                        // If it exists in the fetched data, use that, else default to true
                        if (res.data.data && typeof res.data.data[card.key] !== 'undefined') {
                            newKpi[card.key] = res.data.data[card.key];
                        } else {
                            newKpi[card.key] = true;
                        }
                    });
                    setInsightsKpi(newKpi);
                }
            } catch (err) {
                console.error("[CustomInsights] Failed to fetch insights config:", err);
                showToast("Failed to load insights configuration", "error");
            } finally {
                setIsFetchingConfig(false);
            }
        };

        fetchInsightsConfig();
    }, [selectedDb]);

    const handleSave = async () => {
        if (!selectedDb) {
            showToast("No database selected.", "error");
            return;
        }

        setIsSaving(true);
        try {
            const token = sessionStorage.getItem("token");
            const res = await axios.patch("/api/admin/databases/insights", {
                db_id: selectedDb.db_id,
                insights: insightsKpi
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                showToast(`Insights configuration updated for ${selectedDb.db_name}`, "success");
            } else {
                showToast(res.data.error || "Failed to save configuration", "error");
            }
        } catch (err) {
            console.error("[CustomInsights] Save config failed:", err);
            showToast("Server error saving configuration.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDbChange = (e) => {
        const dbId = e.target.value;
        const db = databases.find(d => String(d.db_id) === String(dbId));
        if (db) {
            setSelectedDb(db);
            sessionStorage.setItem("customInsightsDbId", db.db_id);
        }
    };

    const toggleCard = (key) => {
        setInsightsKpi(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const enableAll = () => {
        const newKpi = {};
        INSIGHTS_CARDS.forEach(card => newKpi[card.key] = true);
        setInsightsKpi(newKpi);
    };

    const disableAll = () => {
        const newKpi = {};
        INSIGHTS_CARDS.forEach(card => newKpi[card.key] = false);
        setInsightsKpi(newKpi);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                <span className="ml-3 text-sm text-slate-500 font-medium">Loading database clients...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center h-10">
                <div>
                    <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-1">Custom Insights</h2>
                    <p className="text-slate-500 text-xs">Configure which AI insight cards are visible for this client.</p>
                </div>
                <AnimatePresence mode="wait">
                    {toast && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm ${
                                toast.type === "success"
                                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                    : toast.type === "error"
                                    ? "bg-rose-50 text-rose-600 border border-rose-100"
                                    : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                            }`}
                        >
                            {toast.type === "error" ? (
                                <AlertCircle className="w-3.5 h-3.5" />
                            ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            {toast.message}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Dropdown Selector */}
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                    <Database className="w-4 h-4" />
                </div>
                <div className="flex-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Select Client Database</label>
                    <select
                        value={selectedDb?.db_id || ""}
                        onChange={handleDbChange}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer transition-all"
                    >
                        {databases.map(db => (
                            <option key={db.db_id} value={db.db_id}>
                                {db.db_name.toUpperCase().replace(/_/g, " ")}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Configuration Area */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col space-y-6">
                <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Insights Configuration</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={enableAll}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-[10px] font-bold transition-all"
                        >
                            Enable All
                        </button>
                        <button
                            onClick={disableAll}
                            className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-[10px] font-bold transition-all"
                        >
                            Disable All
                        </button>
                    </div>
                </div>

                {isFetchingConfig ? (
                    <div className="flex items-center justify-center py-10">
                        <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                        <span className="ml-3 text-xs text-slate-500 font-medium">Loading configuration...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {INSIGHTS_CARDS.map(card => {
                            const isEnabled = insightsKpi[card.key] === true;
                            return (
                                <div 
                                    key={card.key}
                                    onClick={() => toggleCard(card.key)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                                        isEnabled 
                                        ? "bg-indigo-50/50 border-indigo-200 shadow-sm" 
                                        : "bg-slate-50 border-slate-200 opacity-60 hover:opacity-100"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                            isEnabled ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-400"
                                        }`}>
                                            <Activity className="w-4 h-4" />
                                        </div>
                                        <span className={`text-xs font-bold ${isEnabled ? "text-indigo-900" : "text-slate-500"}`}>
                                            {card.label}
                                        </span>
                                    </div>
                                    
                                    {/* Custom Toggle UI */}
                                    <div className={`relative w-10 h-5 rounded-full transition-colors ${isEnabled ? "bg-indigo-500" : "bg-slate-300"}`}>
                                        <div className={`absolute top-0.5 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${isEnabled ? "left-[22px]" : "left-1"}`} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Control Action Buttons */}
                <div className="flex items-center justify-end w-full pt-4 border-t border-slate-100">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isFetchingConfig}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-100 disabled:shadow-none cursor-pointer"
                    >
                        {isSaving ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        {isSaving ? "Saving Configuration..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomInsights;
