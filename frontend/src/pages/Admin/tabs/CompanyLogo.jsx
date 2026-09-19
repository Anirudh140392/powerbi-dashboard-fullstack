import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
    Trash2,
    CheckCircle,
    AlertCircle,
    RefreshCw,
    Database,
    Image as ImageIcon
} from "lucide-react";

// Import system-default client logos for preview fallback
import trailLogo from "../../../assets/trailytics.png";
import marsLogo from "../../../assets/mars2.svg";
import mamaearthLogo from "../../../assets/mamaearth.jpeg";
import marsPetcareLogo from "../../../assets/Mars_Petcare_Logo.jpg";
import boatLogo from "../../../assets/Boat.png";
import zydusLogo from "../../../assets/zyduslogo.png";
import demoLogo from "../../../assets/Demo.png";
import sugarLogo from "../../../assets/sugar.png";
import pidiliteLogo from "../../../assets/pidilite.png";
import marsDmartLogo from "../../../assets/mars2.svg";
import cheffinLogo from "../../../assets/cheffin.png";
import fastrackLogo from "../../../assets/Fastrack.png";
import titanSkinLogo from "../../../assets/titanskin.png";
import titanPerfumeLogo from "../../../assets/titanperfume.jpeg";
import drlLogo from "../../../assets/drl.png";
import emamiLogo from "../../../assets/emami.jpg";

const getStaticFallbackLogo = (dbName) => {
    const name = String(dbName || '').toLowerCase().trim();
    if (name === 'mamaearth') return mamaearthLogo;
    if (name === 'mars_petcare') return marsPetcareLogo;
    if (name === 'mars_dmart') return marsDmartLogo;
    if (name === 'boat') return boatLogo;
    if (name === 'zydus' || name === 'hm_zydus') return zydusLogo;
    if (name === 'demo') return demoLogo;
    if (name === 'sugar') return sugarLogo;
    if (name === 'pidilite') return pidiliteLogo;
    if (name === 'trailytics') return trailLogo;
    if (name === 'cheffin') return cheffinLogo;
    if (name === 'hm_titan_bags') return fastrackLogo;
    if (name === 'hm_titan_skinn') return titanSkinLogo;
    if (name === 'hm_titan_perfume') return titanPerfumeLogo;
    if (name === 'drl') return drlLogo;
    if (name === 'emami') return emamiLogo;
    if (name === 'mars') return marsLogo;
    return null;
};

const CompanyLogo = () => {
    const [databases, setDatabases] = useState([]);
    const [selectedDb, setSelectedDb] = useState(null);
    const [logoUrl, setLogoUrl] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [imgError, setImgError] = useState(false);

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
                    
                    // Default to current user's DB if possible
                    const currentUserStr = sessionStorage.getItem("user");
                    let defaultDb = null;
                    if (currentUserStr) {
                        const currentUser = JSON.parse(currentUserStr);
                        defaultDb = res.data.data.find(d => d.db_name === currentUser.dbName);
                    }
                    
                    if (!defaultDb) {
                        defaultDb = res.data.data[0];
                    }
                    
                    setSelectedDb(defaultDb);
                    setLogoUrl(defaultDb.logo_url || "");
                }
            } catch (err) {
                console.error("[CompanyLogo] Failed to fetch databases:", err);
                showToast("Failed to load database client list", "error");
            } finally {
                setIsLoading(false);
            }
        };

        fetchDatabases();
    }, []);

    // Reset image error state whenever URL or database changes
    useEffect(() => {
        setImgError(false);
    }, [logoUrl, selectedDb]);

    // Show toast message helper
    const showToast = (message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Helper to get active logo image path/URL
    const getDisplayLogo = () => {
        if (logoUrl) return logoUrl;
        return getStaticFallbackLogo(selectedDb?.db_name);
    };

    const handleReset = () => {
        setLogoUrl("");
        setImgError(false);
        showToast("Logo URL cleared. Click Update Logo to save changes.", "info");
    };

    const handleSave = async () => {
        if (!selectedDb) {
            showToast("No database selected.", "error");
            return;
        }

        setIsSaving(true);
        try {
            const token = sessionStorage.getItem("token");
            const res = await axios.patch("/api/admin/databases/logo", {
                db_id: selectedDb.db_id,
                logo_url: logoUrl
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                showToast(`Logo updated successfully for client: ${selectedDb.db_name}`, "success");
                
                // Update local databases list state
                setDatabases(prev => 
                    prev.map(d => d.db_id === selectedDb.db_id ? { ...d, logo_url: logoUrl } : d)
                );

                // Update selected database reference
                setSelectedDb(prev => ({ ...prev, logo_url: logoUrl }));

                // Check if the updated database is the one the admin is currently viewing
                const currentUserStr = sessionStorage.getItem("user");
                if (currentUserStr) {
                    const currentUser = JSON.parse(currentUserStr);
                    if (currentUser.dbName === selectedDb.db_name) {
                        currentUser.dbLogoUrl = logoUrl;
                        sessionStorage.setItem("user", JSON.stringify(currentUser));
                        window.dispatchEvent(new Event("company_logo_updated"));
                    }
                }
            } else {
                showToast(res.data.error || "Failed to save logo", "error");
            }
        } catch (err) {
            console.error("[CompanyLogo] Save logo failed:", err);
            showToast("Server error saving logo.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDbChange = (e) => {
        const dbId = e.target.value;
        const db = databases.find(d => d.db_id === dbId);
        if (db) {
            setSelectedDb(db);
            setLogoUrl(db.logo_url || "");
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                <span className="ml-3 text-sm text-slate-500 font-medium">Loading database clients...</span>
            </div>
        );
    }

    const hasLogo = getDisplayLogo();

    return (
        <div className="space-y-6 max-w-xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center h-10">
                <div>
                    <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-1">Company Branding</h2>
                    <p className="text-slate-500 text-xs">View and update the branding logo for dashboard views.</p>
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

            {/* Preview & URL Input Area */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col space-y-6">
                <div className="w-full flex items-center gap-2 border-b border-slate-100 pb-3">
                    <ImageIcon className="w-4 h-4 text-indigo-600" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logo Branding Configuration</span>
                </div>

                {/* Logo URL Input Field */}
                <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Logo URL</label>
                    <input
                        type="text"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="Enter logo image URL (e.g. https://example.com/logo.png)"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 rounded-2xl text-xs font-medium text-slate-700 outline-none transition-all placeholder-slate-400"
                    />
                </div>

                {/* Live Logo Preview Box */}
                <div className="space-y-2 flex flex-col items-center w-full">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider self-start">Live Preview</span>
                    
                    <div className="relative w-full max-w-md h-52 bg-slate-50 rounded-2xl border border-slate-150 flex flex-col items-center justify-center overflow-hidden p-6">
                        {hasLogo && !imgError ? (
                            <div className="flex flex-col items-center justify-center h-full w-full">
                                <img 
                                    src={hasLogo} 
                                    alt="Client Branding Logo" 
                                    onError={() => setImgError(true)}
                                    className="max-w-full max-h-36 object-contain transition-transform" 
                                />
                                {logoUrl ? (
                                    <span className="absolute bottom-3 text-[9px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
                                        Custom URL Logo
                                    </span>
                                ) : (
                                    <span className="absolute bottom-3 text-[9px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                                        Default Fallback Logo
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                <AlertCircle className="w-10 h-10 text-rose-300" />
                                <span className="text-xs font-bold text-slate-500">
                                    {imgError ? "Failed to load logo from URL" : "No logo configured"}
                                </span>
                                <span className="text-[9px] uppercase tracking-wider text-slate-400">
                                    {imgError ? "Verify image URL is valid and accessible" : "Enter a URL above to preview"}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Control Action Buttons */}
                <div className="flex items-center gap-3 w-full pt-2">
                    <button
                        onClick={handleReset}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-100 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Reset
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-100 disabled:shadow-none cursor-pointer"
                    >
                        {isSaving ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        {isSaving ? "Updating..." : "Update Logo"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompanyLogo;
