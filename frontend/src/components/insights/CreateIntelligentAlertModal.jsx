import React, { useState, useContext, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Bell,
    Mail,
    MessageSquare,
    Check,
    ChevronDown,
    BookmarkPlus,
    Phone,
    Sliders,
    Zap,
    AlertTriangle,
    Edit3,
    Loader2,
    Calendar
} from "lucide-react";
import { FilterContext } from "../../utils/FilterContext";
import axiosInstance from "../../api/axiosInstance";
import { createAlert, updateAlert } from "../../api/insightsService";

// Defined Alert Rule Presets
const ALERT_PRESETS = [
    {
        id: "low_osa_bottom_city",
        name: "Low OSA Alert (Bottom % City Level)",
        category: "Inventory & On-Shelf Availability",
        metrics: ["Bottom %", "City"],
        formula: "Bottom N% cities by OSA score",
        condition: "City falls in bottom threshold %",
        operator: "lt",
        defaultThreshold: "20",
        severity: "High",
    },
    {
        id: "low_osa_bottom_product",
        name: "Low OSA Alert (Bottom % Product Level)",
        category: "Inventory & On-Shelf Availability",
        metrics: ["Bottom %", "Product"],
        formula: "Bottom N% products by OSA score",
        condition: "Product falls in bottom threshold %",
        operator: "lt",
        defaultThreshold: "20",
        severity: "High",
    },
    {
        id: "keyword_delta_sos",
        name: "Keyword Delta SOS Exceeds Threshold",
        category: "Share of Search",
        metrics: ["Delta", "Keyword"],
        formula: "Delta SOS > N",
        condition: "Keyword Delta SOS exceeds threshold",
        operator: "gt",
        defaultThreshold: "10",
        severity: "Medium",
    },
];

// Helper to format platform names cleanly
const formatPlatformName = (name) => {
    if (!name) return "";
    if (name === "All Platforms" || name === "All") return "All Platforms";
    const lower = name.toLowerCase().trim();
    if (lower === "blinkit") return "Blinkit";
    if (lower === "zepto") return "Zepto";
    if (lower === "instamart") return "Instamart";
    if (lower === "amazon") return "Amazon";
    if (lower === "flipkart") return "Flipkart";
    if (lower === "myntra") return "Myntra";
    if (lower === "jiomart") return "JioMart";
    if (lower === "bigbasket") return "BigBasket";
    return name.charAt(0).toUpperCase() + name.slice(1);
};

// Helper function to resolve platform logo image URLs
const getPlatformLogo = (platName, platformMetadata = []) => {
    if (!platName || platName === "All Platforms" || platName === "All") return null;
    const lower = String(platName).toLowerCase().trim();

    // 1. Check metadata from FilterContext / DB
    if (Array.isArray(platformMetadata)) {
        const found = platformMetadata.find(m =>
            String(m.platform_name || m.name || '').toLowerCase().trim() === lower
        );
        if (found && (found.image_url || found.logo || found.image)) {
            return found.image_url || found.logo || found.image;
        }
    }

    // 2. High Quality Brand Vector/PNG Icons Fallback
    if (lower.includes('amazon')) return "https://www.vectorlogo.zone/logos/amazon/amazon-icon.svg";
    if (lower.includes('flipkart')) return "https://www.vectorlogo.zone/logos/flipkart/flipkart-icon.svg";
    if (lower.includes('blinkit')) return "https://upload.wikimedia.org/wikipedia/commons/2/2f/Blinkit-yellow-app-icon.svg";
    if (lower.includes('zepto')) return "https://images.crunchbase.com/image/upload/c_pad,h_170,w_170,f_auto,b_white,q_auto:eco,dpr_2/k7o8mvg1m4pxef69ndms";
    if (lower.includes('instamart') || lower.includes('swiggy')) return "https://www.vectorlogo.zone/logos/swiggy/swiggy-icon.svg";
    if (lower.includes('myntra')) return "https://www.vectorlogo.zone/logos/myntra/myntra-icon.svg";
    if (lower.includes('jiomart')) return "https://cdn.iconscout.com/icon/free/png-256/free-jiomart-3628830-3030232.png";
    if (lower.includes('bigbasket') || lower.includes('bb')) return "https://cdn.iconscout.com/icon/free/png-256/free-bigbasket-3628670-3030105.png";

    return null;
};

export default function CreateIntelligentAlertModal({ open, onClose, onSaveAlert, initialPlatforms, initialBrands, editingAlert = null }) {
    const filterCtx = useContext(FilterContext) || {};

    // Multi-Select Preset Rules State
    const [selectedPresetIds, setSelectedPresetIds] = useState(["low_osa_bottom_city"]);
    const [showPresetDropdown, setShowPresetDropdown] = useState(false);

    // Custom Alert Name & User Override Tracking
    const [alertName, setAlertName] = useState("Low OSA Alert (Bottom % City Level)");
    const [isCustomAlertName, setIsCustomAlertName] = useState(false);

    const [category, setCategory] = useState("Inventory & On-Shelf Availability");
    const [triggerOperator, setTriggerOperator] = useState("lt");
    const [thresholdValue, setThresholdValue] = useState("20");
    const [comparisonPeriod, setComparisonPeriod] = useState("vs L4W Avg");

    // Multi-Select Scope Selection State (Platforms & Brands)
    const [selectedPlatforms, setSelectedPlatforms] = useState([]);
    const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);

    const [selectedBrands, setSelectedBrands] = useState([]);
    const [showBrandDropdown, setShowBrandDropdown] = useState(false);

    // Dynamic Lists (from Global FilterContext + Backend API)
    const [availablePlatforms, setAvailablePlatforms] = useState([]);
    const [availableBrands, setAvailableBrands] = useState([]);

    // Custom Rule Formula & Condition Overrides (Edit Mode State)
    const [customFormulas, setCustomFormulas] = useState({});
    const [customConditions, setCustomConditions] = useState({});
    const [editingRuleId, setEditingRuleId] = useState(null);

    // Frequency & Severity Custom Dropdowns State
    const [frequency, setFrequency] = useState("Weekly Summary");
    const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);

    const [severity, setSeverity] = useState("Critical");
    const [showSeverityDropdown, setShowSeverityDropdown] = useState(false);

    // Custom Day Schedule for Performance Summary Alert (e.g. Monday, Tuesday...)
    const [scheduledDay, setScheduledDay] = useState("Monday");

    const [emailNotify, setEmailNotify] = useState(true);
    const [emailAddress, setEmailAddress] = useState("");
    const [whatsappNotify, setWhatsappNotify] = useState(false);
    const [whatsappNumber, setWhatsappNumber] = useState("");
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const presetDropdownRef = useRef(null);
    const platformDropdownRef = useRef(null);
    const brandDropdownRef = useRef(null);
    const frequencyDropdownRef = useRef(null);
    const severityDropdownRef = useRef(null);

    const selectedPresets = ALERT_PRESETS.filter(p => selectedPresetIds.includes(p.id));
    const isPerformanceSummarySelected = selectedPresetIds.includes("performance_summary");
    const isWeeklyForced = selectedPresetIds.some(id => ["low_osa_bottom_city", "low_osa_bottom_product", "keyword_delta_sos"].includes(id));

    // Sync values when editing an existing alert
    useEffect(() => {
        if (open && editingAlert) {
            const isPerfSummary = editingAlert.alert_type === "performance_summary";
            setAlertName(editingAlert.alert_name || editingAlert.alertName || "Untitled Custom Alert");
            setIsCustomAlertName(true);
            setEmailAddress(editingAlert.send_email || editingAlert.email || "");
            setEmailNotify(!!(editingAlert.send_email || editingAlert.email));
            setWhatsappNumber(isPerfSummary ? "" : (editingAlert.whatsapp_no || editingAlert.phone || ""));
            setWhatsappNotify(isPerfSummary ? false : !!(editingAlert.whatsapp_no || editingAlert.phone));
            if (Array.isArray(editingAlert.platforms) && editingAlert.platforms.length > 0) {
                setSelectedPlatforms(editingAlert.platforms);
            }
            if (Array.isArray(editingAlert.brands) && editingAlert.brands.length > 0) {
                setSelectedBrands(editingAlert.brands);
            }
            setTriggerOperator(editingAlert.conditional_operator || editingAlert.operator || "lt");
            setThresholdValue(editingAlert.threshold_value !== undefined ? String(editingAlert.threshold_value) : String(editingAlert.threshold || "20"));
            setComparisonPeriod(editingAlert.benchmark_period || "vs L4W Avg");
            if (["low_osa_bottom_city", "low_osa_bottom_product", "keyword_delta_sos"].some(id => editingAlert.alert_type?.includes(id))) {
                setFrequency("Weekly Summary");
            } else {
                setFrequency(editingAlert.alert_frequency || editingAlert.frequency || "Hourly");
            }
            setSeverity(editingAlert.severity_level || editingAlert.severity || "Critical");
            if (editingAlert.alert_type) {
                setSelectedPresetIds(editingAlert.alert_type.split(','));
            }

            if (editingAlert.scheduled_day || editingAlert.scheduledDay) {
                setScheduledDay(editingAlert.scheduled_day || editingAlert.scheduledDay);
            } else {
                // Sync scheduled day if present in alert_frequency
                const freqStr = editingAlert.alert_frequency || editingAlert.frequency || "";
                const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                const matchedDay = days.find(d => freqStr.toLowerCase().includes(d.toLowerCase()));
                if (matchedDay) {
                    setScheduledDay(matchedDay);
                }
            }
        } else if (open && !editingAlert) {
            setIsCustomAlertName(false);
            setAlertName("Low OSA Alert (Bottom % City Level)");
            setSelectedPresetIds(["low_osa_bottom_city"]);
            setSelectedPlatforms([]);
            setSelectedBrands([]);
            setScheduledDay("Monday");
        }
    }, [open, editingAlert]);

    // Toggle Multi-Select Platforms
    const handleTogglePlatform = (plat) => {
        let updated;
        if (selectedPlatforms.includes(plat)) {
            updated = selectedPlatforms.filter(p => p !== plat);
        } else {
            updated = [...selectedPlatforms, plat];
        }
        setSelectedPlatforms(updated);
    };

    // Toggle Multi-Select Brands
    const handleToggleBrand = (brand) => {
        if (brand === "All Brands") {
            if (selectedBrands.includes("All Brands") || selectedBrands.length === availableBrands.length) {
                setSelectedBrands([]);
            } else {
                setSelectedBrands(["All Brands", ...availableBrands]);
            }
            return;
        }

        let updated;
        if (selectedBrands.includes(brand)) {
            updated = selectedBrands.filter(b => b !== brand && b !== "All Brands");
        } else {
            const nextList = [...selectedBrands.filter(b => b !== "All Brands"), brand];
            if (nextList.length === availableBrands.length && availableBrands.length > 0) {
                updated = ["All Brands", ...nextList];
            } else {
                updated = nextList;
            }
        }
        setSelectedBrands(updated);
    };

    // Handle Single-Select Preset Toggle (Allows only one option at a time)
    const handleTogglePreset = (presetId) => {
        let updated;
        if (selectedPresetIds.includes(presetId)) {
            updated = [];
        } else {
            updated = [presetId];
        }

        setSelectedPresetIds(updated);

        // When a weekly-forced alert is selected, set frequency
        if (updated.some(id => ["low_osa_bottom_city", "low_osa_bottom_product", "keyword_delta_sos"].includes(id))) {
            setFrequency("Weekly Summary");
        }

        // When Performance Summary is selected, disable WhatsApp
        if (presetId === "performance_summary") {
            setWhatsappNotify(false);
        }

        const activePresets = ALERT_PRESETS.filter(p => updated.includes(p.id));

        if (activePresets.length > 0) {
            const latest = activePresets[0];
            setCategory(latest.category);
            setTriggerOperator(latest.operator);
            setThresholdValue(latest.defaultThreshold);
            setSeverity(latest.severity);
        }

        // Auto-update alert name if user has NOT custom edited it
        if (!isCustomAlertName) {
            if (activePresets.length === 0) {
                setAlertName("");
            } else {
                setAlertName(activePresets[0].name);
            }
        }
    };

    // Click outside listener for dropdowns
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target)) {
                setShowPresetDropdown(false);
            }
            if (platformDropdownRef.current && !platformDropdownRef.current.contains(e.target)) {
                setShowPlatformDropdown(false);
            }
            if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target)) {
                setShowBrandDropdown(false);
            }
            if (frequencyDropdownRef.current && !frequencyDropdownRef.current.contains(e.target)) {
                setShowFrequencyDropdown(false);
            }
            if (severityDropdownRef.current && !severityDropdownRef.current.contains(e.target)) {
                setShowSeverityDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 1. Fetch & Sync Dynamic Platforms from Global Filter Context / Backend API / rca_sku_dim
    useEffect(() => {
        if (!open) return;

        const loadDynamicPlatforms = async () => {
            let platList = [];
            
            if (Array.isArray(initialPlatforms) && initialPlatforms.length > 0) {
                platList = initialPlatforms;
            } else {
                platList = filterCtx.platforms && filterCtx.platforms.length > 0 ? filterCtx.platforms : [];
                try {
                    if (platList.length === 0) {
                        const resPlat = await axiosInstance.get("/watchtower/platforms");
                        if (resPlat.data && Array.isArray(resPlat.data)) platList = resPlat.data;
                    }
                } catch (err) {
                    console.warn("[CreateIntelligentAlertModal] Dynamic platforms fetch error:", err);
                }
            }

            const sourcePlatforms = platList.length > 0 ? platList : (filterCtx.platforms || []);
            const allFormattedPlatforms = sourcePlatforms
                .filter(p => p && p !== "All" && p !== "All Platforms")
                .map(formatPlatformName);
            const formattedPlatforms = Array.from(new Set(allFormattedPlatforms));

            setAvailablePlatforms(formattedPlatforms);
        };

        loadDynamicPlatforms();
    }, [open, filterCtx.platforms, filterCtx.platform, initialPlatforms]);

    // 2. Fetch & Sync Dynamic Brands dynamically based on Selected Platforms & Global Filter API / rca_sku_dim
    useEffect(() => {
        if (!open) return;

        const loadDynamicBrands = async () => {
            let brandList = [];

            if (Array.isArray(initialBrands) && initialBrands.length > 0) {
                brandList = initialBrands;
            } else {
                try {
                    const params = {};
                    if (selectedPlatforms.length > 0 && !selectedPlatforms.includes("All Platforms")) {
                        params.platform = selectedPlatforms[0].toLowerCase();
                    }

                    const resBrand = await axiosInstance.get("/watchtower/brands", { params });
                    if (resBrand.data && Array.isArray(resBrand.data)) {
                        brandList = resBrand.data;
                    }
                } catch (err) {
                    console.warn("[CreateIntelligentAlertModal] Dynamic brands API fetch error:", err);
                }

                // Fallback to global FilterContext brands if API returns empty
                if (brandList.length === 0 && filterCtx.brands && filterCtx.brands.length > 0) {
                    brandList = filterCtx.brands;
                }
            }

            const sourceBrands = brandList.length > 0 ? brandList : (filterCtx.brands || []);
            const allFormattedBrands = sourceBrands
                .filter(b => b && b !== "All" && b !== "All Brands")
                .map(b => String(b).trim());
            const finalBrands = Array.from(new Set(allFormattedBrands));

            setAvailableBrands(finalBrands);
        };

        loadDynamicBrands();
    }, [open, selectedPlatforms, filterCtx.brands, filterCtx.selectedBrand, initialBrands]);

    if (!open) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitError("");

        const isPerfSummary = selectedPresetIds.includes("performance_summary");

        try {
            // Map form fields to the backend API schema (matches admin_master.tb_alert columns)
            const apiPayload = {
                alertName: alertName || "Untitled Custom Alert",
                alertType: selectedPresetIds.join(','),
                sendEmail: emailNotify ? (emailAddress || "") : "",
                whatsappNo: isPerfSummary ? "" : (whatsappNotify ? (whatsappNumber || "") : ""),
                platforms: selectedPlatforms.includes("All Platforms") ? availablePlatforms : selectedPlatforms,
                brands: isPerfSummary ? availableBrands : (selectedBrands.includes("All Brands") ? availableBrands : selectedBrands),
                conditionalOperator: isPerfSummary ? "eq" : triggerOperator,
                thresholdValue: isPerfSummary ? 0 : (parseFloat(thresholdValue) || 0),
                benchmarkPeriod: isPerfSummary ? "Weekly Schedule" : comparisonPeriod,
                alertFrequency: isPerfSummary ? `Weekly Summary (${scheduledDay})` : frequency,
                severityLevel: isPerfSummary ? "Medium" : severity,
                scheduledDay: isPerfSummary ? scheduledDay : "",
                scheduled_day: isPerfSummary ? scheduledDay : "",
            };

            let response;
            if (editingAlert && editingAlert.id) {
                response = await updateAlert(editingAlert.id, apiPayload);
            } else {
                response = await createAlert(apiPayload);
            }

            if (response.success && onSaveAlert) {
                // Pass the server-returned alert data to the parent
                onSaveAlert(response.data);
            }

            setShowSuccessToast(true);
            setTimeout(() => {
                setShowSuccessToast(false);
                onClose();
            }, 1200);
        } catch (err) {
            console.error("[CreateAlert] Submit error:", err);
            setSubmitError(err?.response?.data?.error || err.message || "Failed to save alert");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 9999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(15, 23, 42, 0.55)",
                    backdropFilter: "blur(6px)",
                    padding: "20px",
                }}
                onClick={onClose}
            >
                <style>{`
                    .custom-modal-scroll::-webkit-scrollbar {
                        width: 6px;
                    }
                    .custom-modal-scroll::-webkit-scrollbar-track {
                        background: #f8fafc;
                        border-radius: 4px;
                    }
                    .custom-modal-scroll::-webkit-scrollbar-thumb {
                        background: #cbd5e1;
                        border-radius: 4px;
                    }
                    .custom-modal-scroll::-webkit-scrollbar-thumb:hover {
                        background: #94a3b8;
                    }
                    .form-input-focus:focus {
                        border-color: #0047FF !important;
                        box-shadow: 0 0 0 3px rgba(0, 71, 255, 0.12) !important;
                    }
                `}</style>

                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 12 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        width: "100%",
                        maxWidth: "660px",
                        maxHeight: "86vh",
                        background: "#ffffff",
                        borderRadius: "20px",
                        boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8)",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: "20px 28px",
                            borderBottom: "1px solid #f1f5f9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: "12px",
                                    background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                                    border: "1px solid #bfdbfe",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    boxShadow: "0 2px 8px rgba(0, 71, 255, 0.12)",
                                }}
                            >
                                <Bell size={20} color="#0047FF" strokeWidth={2.2} />
                            </div>
                            <div>
                                <h2
                                    style={{
                                        fontSize: "18px",
                                        fontWeight: 800,
                                        color: "#0f172a",
                                        margin: 0,
                                        letterSpacing: "-0.02em",
                                    }}
                                >
                                    Create New Intelligent Alert
                                </h2>
                                <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0", fontWeight: 400 }}>
                                    Set up automated signal tracking & multi-channel notifications
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            style={{
                                background: "#f1f5f9",
                                border: "1px solid #e2e8f0",
                                cursor: "pointer",
                                padding: "8px",
                                borderRadius: "10px",
                                color: "#64748b",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#e2e8f0";
                                e.currentTarget.style.color = "#0f172a";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#f1f5f9";
                                e.currentTarget.style.color = "#64748b";
                            }}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Form Scrollable Content */}
                    <div
                        className="custom-modal-scroll"
                        style={{
                            padding: "24px 28px",
                            overflowY: "auto",
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: "22px",
                            background: "#ffffff",
                        }}
                    >
                        {/* Section 1: Scope Selection (Multi-Select Platforms & Brands) */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                                <div style={{ width: "4px", height: "16px", borderRadius: "2px", background: "#0047FF" }} />
                                <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                                    Scope Selection
                                </span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
                                {/* MULTI-SELECT PLATFORM */}
                                <div>
                                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                                        SELECT PLATFORM(S)
                                    </label>

                                    <div style={{ position: "relative" }} ref={platformDropdownRef}>
                                        {/* Dropdown Trigger Box */}
                                        <div
                                            onClick={() => setShowPlatformDropdown((prev) => !prev)}
                                            className="form-input-focus"
                                            style={{
                                                width: "100%",
                                                minHeight: "42px",
                                                padding: "6px 12px",
                                                borderRadius: "10px",
                                                border: showPlatformDropdown ? "1.5px solid #0047FF" : "1px solid #cbd5e1",
                                                boxShadow: showPlatformDropdown ? "0 0 0 3px rgba(0, 71, 255, 0.12)" : "none",
                                                background: "#ffffff",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                cursor: "pointer",
                                                boxSizing: "border-box",
                                                gap: "8px",
                                                transition: "all 0.15s ease",
                                            }}
                                        >
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", flex: 1 }}>
                                                {selectedPlatforms.length === 0 ? (
                                                    <span style={{ fontSize: "13px", color: "#94a3b8" }}>Select platform(s)...</span>
                                                ) : selectedPlatforms.includes("All Platforms") ? (
                                                    <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0047FF", background: "#eff6ff", padding: "2px 8px", borderRadius: "12px", border: "1px solid #bfdbfe" }}>
                                                        All Platforms
                                                    </span>
                                                ) : (
                                                    selectedPlatforms.map((p) => (
                                                        <span
                                                            key={p}
                                                            style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "5px",
                                                                padding: "2px 8px",
                                                                borderRadius: "16px",
                                                                background: "#eff6ff",
                                                                border: "1px solid #bfdbfe",
                                                                color: "#0047FF",
                                                                fontSize: "12px",
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {p}
                                                            <span
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleTogglePlatform(p);
                                                                }}
                                                                style={{
                                                                    display: "inline-flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    width: "14px",
                                                                    height: "14px",
                                                                    borderRadius: "50%",
                                                                    background: "#dbeafe",
                                                                    color: "#0047FF",
                                                                    cursor: "pointer",
                                                                    fontSize: "9px",
                                                                    fontWeight: 800,
                                                                }}
                                                            >
                                                                ✕
                                                            </span>
                                                        </span>
                                                    ))
                                                )}
                                            </div>

                                            <ChevronDown size={16} style={{ color: "#64748b", transform: showPlatformDropdown ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }} />
                                        </div>

                                        {/* Multi-Select Options List */}
                                        {showPlatformDropdown && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    top: "100%",
                                                    left: 0,
                                                    right: 0,
                                                    marginTop: "6px",
                                                    background: "#ffffff",
                                                    border: "1px solid #e2e8f0",
                                                    borderRadius: "12px",
                                                    boxShadow: "0 12px 28px -4px rgba(15, 23, 42, 0.18)",
                                                    padding: "6px",
                                                    zIndex: 30,
                                                    maxHeight: "220px",
                                                    overflowY: "auto",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "2px",
                                                }}
                                            >
                                                {/* Individual Platforms */}
                                                {availablePlatforms.map((plat) => {
                                                    const isSelected = selectedPlatforms.includes(plat);
                                                    return (
                                                        <div
                                                            key={plat}
                                                            onClick={() => handleTogglePlatform(plat)}
                                                            style={{
                                                                padding: "8px 12px",
                                                                borderRadius: "8px",
                                                                background: isSelected ? "#eff6ff" : "transparent",
                                                                color: isSelected ? "#0047FF" : "#1e293b",
                                                                fontSize: "12.5px",
                                                                fontWeight: isSelected ? 700 : 500,
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "space-between",
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                                <div style={{ width: 18, height: 18, borderRadius: 4, border: isSelected ? "none" : "1.5px solid #cbd5e1", background: isSelected ? "#0047FF" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                                    {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
                                                                </div>
                                                                <span>{plat}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* MULTI-SELECT BRAND (Hidden for Performance Summary) */}
                                {false && !isPerformanceSummarySelected && (
                                    <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                                            SELECT BRAND(S)
                                        </label>

                                        <div style={{ position: "relative" }} ref={brandDropdownRef}>
                                            <div
                                                onClick={() => setShowBrandDropdown((prev) => !prev)}
                                                className="form-input-focus"
                                                style={{
                                                    width: "100%",
                                                    minHeight: "42px",
                                                    padding: "6px 12px",
                                                    borderRadius: "10px",
                                                    border: showBrandDropdown ? "1.5px solid #10b981" : "1px solid #cbd5e1",
                                                    boxShadow: showBrandDropdown ? "0 0 0 3px rgba(16, 185, 129, 0.12)" : "none",
                                                    background: "#ffffff",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    cursor: "pointer",
                                                    boxSizing: "border-box",
                                                    gap: "8px",
                                                    transition: "all 0.15s ease",
                                                }}
                                            >
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", flex: 1 }}>
                                                    {selectedBrands.length === 0 ? (
                                                        <span style={{ fontSize: "13px", color: "#94a3b8" }}>Select brand(s)...</span>
                                                    ) : selectedBrands.includes("All Brands") ? (
                                                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#10b981", background: "#f0fdf4", padding: "2px 8px", borderRadius: "12px", border: "1px solid #a7f3d0" }}>
                                                            All Brands
                                                        </span>
                                                    ) : (
                                                        selectedBrands.map((b) => (
                                                            <span
                                                                key={b}
                                                                style={{
                                                                    display: "inline-flex",
                                                                    alignItems: "center",
                                                                    gap: "5px",
                                                                    padding: "2px 8px",
                                                                    borderRadius: "16px",
                                                                    background: "#f0fdf4",
                                                                    border: "1px solid #a7f3d0",
                                                                    color: "#10b981",
                                                                    fontSize: "12px",
                                                                    fontWeight: 700,
                                                                }}
                                                            >
                                                                {b}
                                                                <span
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleToggleBrand(b);
                                                                    }}
                                                                    style={{
                                                                        display: "inline-flex",
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                        width: "14px",
                                                                        height: "14px",
                                                                        borderRadius: "50%",
                                                                        background: "#d1fae5",
                                                                        color: "#059669",
                                                                        cursor: "pointer",
                                                                        fontSize: "9px",
                                                                        fontWeight: 800,
                                                                    }}
                                                                >
                                                                    ✕
                                                                </span>
                                                            </span>
                                                        ))
                                                    )}
                                                </div>

                                                <ChevronDown size={16} style={{ color: "#64748b", transform: showBrandDropdown ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }} />
                                            </div>

                                            {/* Dropdown Options for Brands */}
                                            {showBrandDropdown && (
                                                <div
                                                    style={{
                                                        position: "absolute",
                                                        top: "100%",
                                                        left: 0,
                                                        right: 0,
                                                        marginTop: "6px",
                                                        background: "#ffffff",
                                                        border: "1px solid #e2e8f0",
                                                        borderRadius: "12px",
                                                        boxShadow: "0 12px 28px -4px rgba(15, 23, 42, 0.18)",
                                                        padding: "6px",
                                                        zIndex: 30,
                                                        maxHeight: "220px",
                                                        overflowY: "auto",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: "2px",
                                                    }}
                                                >
                                                    {/* All Brands Toggle */}
                                                    <div
                                                        onClick={() => handleToggleBrand("All Brands")}
                                                        style={{
                                                            padding: "8px 12px",
                                                            borderRadius: "8px",
                                                            background: selectedBrands.includes("All Brands") ? "#f0fdf4" : "transparent",
                                                            color: selectedBrands.includes("All Brands") ? "#10b981" : "#1e293b",
                                                            fontSize: "12.5px",
                                                            fontWeight: 700,
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "space-between",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                            <div style={{ width: 18, height: 18, borderRadius: 4, border: selectedBrands.includes("All Brands") ? "none" : "1.5px solid #cbd5e1", background: selectedBrands.includes("All Brands") ? "#10b981" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                                {selectedBrands.includes("All Brands") && <Check size={13} color="#fff" strokeWidth={3} />}
                                                            </div>
                                                            <span>All Brands</span>
                                                        </div>
                                                    </div>

                                                    {/* Individual Brands */}
                                                    {availableBrands.map((b) => {
                                                        const isSelected = selectedBrands.includes(b);
                                                        return (
                                                            <div
                                                                key={`b_${b}`}
                                                                onClick={() => handleToggleBrand(b)}
                                                                style={{
                                                                    padding: "8px 12px",
                                                                    borderRadius: "8px",
                                                                    background: isSelected ? "#f0fdf4" : "transparent",
                                                                    color: isSelected ? "#10b981" : "#1e293b",
                                                                    fontSize: "12.5px",
                                                                    fontWeight: isSelected ? 700 : 500,
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "space-between",
                                                                    cursor: "pointer",
                                                                }}
                                                            >
                                                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                                    <div style={{ width: 18, height: 18, borderRadius: 4, border: isSelected ? "none" : "1.5px solid #cbd5e1", background: isSelected ? "#10b981" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                                        {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
                                                                    </div>
                                                                    <span>{b}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 2: General Information */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                                <div style={{ width: "4px", height: "16px", borderRadius: "2px", background: "#0047FF" }} />
                                <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                                    General Information & Alert Rules
                                </span>
                            </div>

                            {/* 1. SELECT ALERT CONDITION (Top Row with Pill Badges) */}
                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                                    SELECT ALERT CONDITION
                                </label>

                                <div style={{ position: "relative" }} ref={presetDropdownRef}>
                                    {/* Trigger Box */}
                                    <div
                                        onClick={() => setShowPresetDropdown((prev) => !prev)}
                                        className="form-input-focus"
                                        style={{
                                            width: "100%",
                                            minHeight: "44px",
                                            padding: "8px 14px",
                                            borderRadius: "10px",
                                            border: showPresetDropdown ? "1.5px solid #0047FF" : "1px solid #cbd5e1",
                                            boxShadow: showPresetDropdown ? "0 0 0 3px rgba(0, 71, 255, 0.12)" : "none",
                                            background: "#ffffff",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            cursor: "pointer",
                                            boxSizing: "border-box",
                                            gap: "10px",
                                            transition: "all 0.15s ease",
                                        }}
                                    >
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", flex: 1 }}>
                                            {selectedPresets.length === 0 ? (
                                                <span style={{ fontSize: "13px", color: "#94a3b8" }}>Select an alert condition...</span>
                                            ) : (
                                                selectedPresets.map((p) => (
                                                    <span
                                                        key={p.id}
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "6px",
                                                            padding: "3px 10px",
                                                            borderRadius: "20px",
                                                            background: "#eff6ff",
                                                            border: "1px solid #bfdbfe",
                                                            color: "#0047FF",
                                                            fontSize: "12px",
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {p.name}
                                                        <span
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleTogglePreset(p.id);
                                                            }}
                                                            style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                width: "14px",
                                                                height: "14px",
                                                                borderRadius: "50%",
                                                                background: "#dbeafe",
                                                                color: "#0047FF",
                                                                cursor: "pointer",
                                                                fontSize: "10px",
                                                                fontWeight: 800,
                                                            }}
                                                        >
                                                            ✕
                                                        </span>
                                                    </span>
                                                ))
                                            )}
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: "12px" }}>
                                                {selectedPresets.length} selected
                                            </span>
                                            <ChevronDown size={16} style={{ color: "#0047FF", transform: showPresetDropdown ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
                                        </div>
                                    </div>

                                    {/* Floating Dropdown Options */}
                                    {showPresetDropdown && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: "100%",
                                                left: 0,
                                                right: 0,
                                                marginTop: "6px",
                                                background: "#ffffff",
                                                border: "1px solid #e2e8f0",
                                                borderRadius: "14px",
                                                boxShadow: "0 16px 36px -4px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(0,0,0,0.04)",
                                                padding: "8px",
                                                zIndex: 50,
                                                maxHeight: "220px",
                                                overflowY: "auto",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "4px",
                                            }}
                                        >
                                            {ALERT_PRESETS.map((preset) => {
                                                const isSelected = selectedPresetIds.includes(preset.id);
                                                return (
                                                    <div
                                                        key={preset.id}
                                                        onClick={() => handleTogglePreset(preset.id)}
                                                        style={{
                                                            padding: "10px 14px",
                                                            borderRadius: "10px",
                                                            background: isSelected ? "#f0f5ff" : "transparent",
                                                            color: isSelected ? "#0047FF" : "#1e293b",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "space-between",
                                                            cursor: "pointer",
                                                            transition: "all 0.12s ease",
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (!isSelected) e.currentTarget.style.background = "#f8fafc";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!isSelected) e.currentTarget.style.background = "transparent";
                                                        }}
                                                    >
                                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                            <div
                                                                style={{
                                                                    width: 20,
                                                                    height: 20,
                                                                    borderRadius: "6px",
                                                                    border: isSelected ? "none" : "1.5px solid #cbd5e1",
                                                                    background: isSelected ? "#0047FF" : "#ffffff",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    transition: "all 0.12s ease",
                                                                }}
                                                            >
                                                                {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
                                                            </div>
                                                            <div>
                                                                <span style={{ display: "block", fontSize: "13px", fontWeight: isSelected ? 700 : 600, color: isSelected ? "#0047FF" : "#0f172a" }}>
                                                                    {preset.name}
                                                                </span>
                                                                <span style={{ fontSize: "11px", color: "#64748b" }}>
                                                                    {preset.category}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 2. ALERT NAME (CUSTOMIZABLE) (Below Select Alert Condition) */}
                            <div>
                                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                                    ALERT NAME (CUSTOMIZABLE)
                                </label>
                                <input
                                    type="text"
                                    className="form-input-focus"
                                    placeholder="e.g., Low OSA Alert"
                                    value={alertName}
                                    onChange={(e) => {
                                        setAlertName(e.target.value);
                                        setIsCustomAlertName(true);
                                    }}
                                    style={{
                                        width: "100%",
                                        height: "42px",
                                        padding: "0 14px",
                                        borderRadius: "10px",
                                        border: "1px solid #cbd5e1",
                                        fontSize: "13.5px",
                                        fontWeight: 600,
                                        color: "#0f172a",
                                        outline: "none",
                                        boxSizing: "border-box",
                                        background: "#fff",
                                        transition: "all 0.15s ease",
                                    }}
                                />
                            </div>
                        </div>

                        {/* Section 3: Notification Channels */}
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                                <div style={{ width: "4px", height: "16px", borderRadius: "2px", background: "#0047FF" }} />
                                <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                                    Notification Channels
                                </span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: (emailNotify || whatsappNotify) ? "14px" : "0" }}>
                                {/* Email Alert Card */}
                                <div
                                    onClick={() => setEmailNotify((prev) => !prev)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "14px 16px",
                                        borderRadius: "12px",
                                        border: emailNotify ? "2px solid #0047FF" : "1.5px solid #e2e8f0",
                                        background: emailNotify ? "#f0f5ff" : "#ffffff",
                                        cursor: "pointer",
                                        boxShadow: emailNotify ? "0 4px 12px rgba(0, 71, 255, 0.08)" : "0 1px 3px rgba(0, 0, 0, 0.02)",
                                        transition: "all 0.18s ease",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: "8px",
                                                background: "#0047FF",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                boxShadow: "0 2px 6px rgba(0, 71, 255, 0.3)",
                                            }}
                                        >
                                            <Mail size={18} color="#ffffff" />
                                        </div>
                                        <div>
                                            <span style={{ display: "block", fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                                                Email Alert
                                            </span>
                                            <span style={{ fontSize: "11px", color: "#64748b" }}>Instant digest emails</span>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: "6px",
                                            background: emailNotify ? "#0047FF" : "#ffffff",
                                            border: emailNotify ? "none" : "1.5px solid #cbd5e1",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "all 0.15s ease",
                                        }}
                                    >
                                        {emailNotify && <Check size={14} color="#ffffff" strokeWidth={3} />}
                                    </div>
                                </div>
                                {/* WhatsApp Card */}
                                <div
                                    onClick={() => {
                                        if (!isPerformanceSummarySelected) {
                                            setWhatsappNotify((prev) => !prev);
                                        }
                                    }}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "14px 16px",
                                        borderRadius: "12px",
                                        border: (whatsappNotify && !isPerformanceSummarySelected) ? "2px solid #10b981" : "1.5px solid #e2e8f0",
                                        background: isPerformanceSummarySelected ? "#f8fafc" : ((whatsappNotify && !isPerformanceSummarySelected) ? "#f0fdf4" : "#ffffff"),
                                        cursor: isPerformanceSummarySelected ? "not-allowed" : "pointer",
                                        opacity: isPerformanceSummarySelected ? 0.55 : 1,
                                        boxShadow: (whatsappNotify && !isPerformanceSummarySelected) ? "0 4px 12px rgba(16, 185, 129, 0.08)" : "0 1px 3px rgba(0, 0, 0, 0.02)",
                                        transition: "all 0.18s ease",
                                    }}
                                    title={isPerformanceSummarySelected ? "WhatsApp is disabled for Performance Summary alert" : ""}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: "8px",
                                                background: isPerformanceSummarySelected ? "#94a3b8" : "#25D366",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                boxShadow: isPerformanceSummarySelected ? "none" : "0 2px 6px rgba(37, 211, 102, 0.3)",
                                            }}
                                        >
                                            <MessageSquare size={18} color="#ffffff" />
                                        </div>
                                        <div>
                                            <span style={{ display: "block", fontSize: "13.5px", fontWeight: 700, color: isPerformanceSummarySelected ? "#94a3b8" : "#0f172a" }}>
                                                WhatsApp
                                            </span>
                                            <span style={{ fontSize: "11px", color: isPerformanceSummarySelected ? "#94a3b8" : "#64748b" }}>
                                                {isPerformanceSummarySelected ? "Disabled for Performance Summary" : "Real-time mobile pings"}
                                            </span>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: "6px",
                                            background: (whatsappNotify && !isPerformanceSummarySelected) ? "#10b981" : "#ffffff",
                                            border: (whatsappNotify && !isPerformanceSummarySelected) ? "none" : "1.5px solid #cbd5e1",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "all 0.15s ease",
                                        }}
                                    >
                                        {(whatsappNotify && !isPerformanceSummarySelected) && <Check size={14} color="#ffffff" strokeWidth={3} />}
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic Channel Input Fields */}
                            {(emailNotify || (whatsappNotify && !isPerformanceSummarySelected)) && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    style={{ display: "grid", gridTemplateColumns: (emailNotify && (whatsappNotify && !isPerformanceSummarySelected)) ? "1fr 1fr" : "1fr", gap: "14px" }}
                                >
                                    {emailNotify && (
                                        <div>
                                            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                                                EMAIL ADDRESS
                                            </label>
                                            <div style={{ position: "relative" }}>
                                                <Mail size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                                                <input
                                                    type="email"
                                                    className="form-input-focus"
                                                    placeholder="e.g., alert-team@company.com"
                                                    value={emailAddress}
                                                    onChange={(e) => setEmailAddress(e.target.value)}
                                                    style={{
                                                        width: "100%",
                                                        height: "40px",
                                                        padding: "0 14px 0 36px",
                                                        borderRadius: "10px",
                                                        border: "1px solid #cbd5e1",
                                                        fontSize: "13px",
                                                        color: "#0f172a",
                                                        outline: "none",
                                                        boxSizing: "border-box",
                                                        background: "#fff",
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {(whatsappNotify && !isPerformanceSummarySelected) && (
                                        <div>
                                            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                                                WHATSAPP NUMBER
                                            </label>
                                            <div style={{ position: "relative" }}>
                                                <Phone size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#10b981" }} />
                                                <input
                                                    type="tel"
                                                    className="form-input-focus"
                                                    placeholder="e.g., +91 98765 43210"
                                                    value={whatsappNumber}
                                                    onChange={(e) => setWhatsappNumber(e.target.value)}
                                                    style={{
                                                        width: "100%",
                                                        height: "40px",
                                                        padding: "0 14px 0 36px",
                                                        borderRadius: "10px",
                                                        border: "1px solid #cbd5e1",
                                                        fontSize: "13px",
                                                        color: "#0f172a",
                                                        outline: "none",
                                                        boxSizing: "border-box",
                                                        background: "#fff",
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </div>

                        {/* Section 4: Trigger Configuration & Formula Specs with EDIT BUTTON (Hidden for Performance Summary) */}
                        {!isPerformanceSummarySelected && (
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                                    <div style={{ width: "4px", height: "16px", borderRadius: "2px", background: "#0047FF" }} />
                                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                                        Trigger Configuration & Logic Rules
                                    </span>
                                </div>

                                <div
                                    style={{
                                        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "14px",
                                        padding: "16px 18px",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "14px",
                                    }}
                                >
                                    {/* Formula Specs Card with Inline Edit Mode */}
                                    {selectedPresets.length > 0 && (
                                        <div
                                            style={{
                                                background: "#ffffff",
                                                borderRadius: "10px",
                                                border: "1px solid #dbeafe",
                                                padding: "12px 14px",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "12px",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                    <Sliders size={14} color="#0047FF" />
                                                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                                                        Metric(s) Required:
                                                    </span>
                                                </div>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                                    {Array.from(new Set(selectedPresets.flatMap(p => p.metrics))).map(m => (
                                                        <span
                                                            key={m}
                                                            style={{
                                                                padding: "2px 8px",
                                                                borderRadius: "6px",
                                                                background: "#eff6ff",
                                                                border: "1px solid #bfdbfe",
                                                                color: "#0047FF",
                                                                fontSize: "11px",
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {m}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {selectedPresets.map(preset => {
                                                const isEditingThis = editingRuleId === preset.id;
                                                const currentFormula = customFormulas[preset.id] || preset.formula;
                                                const currentCond = customConditions[preset.id] || preset.condition;

                                                return (
                                                    <div key={`formula_${preset.id}`} style={{ display: "flex", flexDirection: "column", gap: "6px", borderBottom: "1px dashed #e2e8f0", paddingBottom: "10px" }}>
                                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                            <span style={{ fontSize: "12px", fontWeight: 800, color: "#0047FF" }}>
                                                                {preset.name} Rules
                                                            </span>
                                                        </div>

                                                        {/* Formula Box */}
                                                        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", background: "#faf5ff", padding: "8px 10px", borderRadius: "6px", border: "1px solid #f3e8ff" }}>
                                                            <Zap size={14} color="#9333ea" style={{ marginTop: 2, flexShrink: 0 }} />
                                                            <div style={{ flex: 1 }}>
                                                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#6b21a8" }}>Formula: </span>
                                                                {isEditingThis ? (
                                                                    <input
                                                                        type="text"
                                                                        value={currentFormula}
                                                                        onChange={(e) => setCustomFormulas({ ...customFormulas, [preset.id]: e.target.value })}
                                                                        style={{
                                                                            width: "100%",
                                                                            marginTop: "4px",
                                                                            padding: "4px 8px",
                                                                            borderRadius: "4px",
                                                                            border: "1px solid #c084fc",
                                                                            fontSize: "11px",
                                                                            fontFamily: "monospace",
                                                                            background: "#fff",
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <code style={{ fontSize: "11px", fontFamily: "monospace", color: "#581c87", fontWeight: 600 }}>
                                                                        {currentFormula}
                                                                    </code>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Condition Box */}
                                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fff7ed", padding: "6px 10px", borderRadius: "6px", border: "1px solid #ffedd5" }}>
                                                            <AlertTriangle size={13} color="#c2410c" style={{ flexShrink: 0 }} />
                                                            <div style={{ flex: 1 }}>
                                                                <span style={{ fontSize: "11px", fontWeight: 600, color: "#9a3412" }}>
                                                                    Condition:{" "}
                                                                </span>
                                                                {isEditingThis ? (
                                                                    <input
                                                                        type="text"
                                                                        value={currentCond}
                                                                        onChange={(e) => setCustomConditions({ ...customConditions, [preset.id]: e.target.value })}
                                                                        style={{
                                                                            width: "100%",
                                                                            marginTop: "4px",
                                                                            padding: "4px 8px",
                                                                            borderRadius: "4px",
                                                                            border: "1px solid #fdba74",
                                                                            fontSize: "11px",
                                                                            background: "#fff",
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#9a3412" }}>
                                                                        {currentCond}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Interactive Operators & Threshold Value */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.3fr 1.2fr", gap: "12px", alignItems: "center" }}>
                                        {/* Operator Dropdown */}
                                        <div style={{ position: "relative" }}>
                                            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                                                CONDITION OPERATOR
                                            </label>
                                            <select
                                                value={triggerOperator}
                                                onChange={(e) => setTriggerOperator(e.target.value)}
                                                style={{
                                                    width: "100%",
                                                    height: "38px",
                                                    padding: "0 28px 0 10px",
                                                    borderRadius: "8px",
                                                    border: "1.5px solid #0047FF",
                                                    background: "#eff6ff",
                                                    color: "#0047FF",
                                                    fontWeight: 700,
                                                    fontSize: "12.5px",
                                                    outline: "none",
                                                    cursor: "pointer",
                                                    appearance: "none",
                                                    boxSizing: "border-box",
                                                }}
                                            >
                                                <option value="gt">Greater than (&gt;)</option>
                                                <option value="lt">Lesser than (&lt;)</option>
                                            </select>
                                            <ChevronDown size={14} style={{ position: "absolute", right: 8, bottom: 12, color: "#0047FF", pointerEvents: "none" }} />
                                        </div>

                                        {/* Threshold Value Input */}
                                        <div>
                                            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                                                THRESHOLD VALUE
                                            </label>
                                            <input
                                                type="text"
                                                className="form-input-focus"
                                                placeholder="Threshold (e.g. 85)"
                                                value={thresholdValue}
                                                onChange={(e) => setThresholdValue(e.target.value)}
                                                style={{
                                                    width: "100%",
                                                    height: "38px",
                                                    padding: "0 12px",
                                                    borderRadius: "8px",
                                                    border: "1px solid #cbd5e1",
                                                    fontSize: "12.5px",
                                                    fontWeight: 600,
                                                    color: "#0f172a",
                                                    outline: "none",
                                                    boxSizing: "border-box",
                                                    background: "#fff",
                                                }}
                                            />
                                        </div>

                                        {/* Comparison Period */}
                                        <div style={{ position: "relative" }}>
                                            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                                                BENCHMARK PERIOD
                                            </label>
                                            <select
                                                value={comparisonPeriod}
                                                onChange={(e) => setComparisonPeriod(e.target.value)}
                                                className="form-input-focus"
                                                style={{
                                                    width: "100%",
                                                    height: "38px",
                                                    padding: "0 28px 0 10px",
                                                    borderRadius: "8px",
                                                    border: "1px solid #cbd5e1",
                                                    fontSize: "12.5px",
                                                    color: "#0f172a",
                                                    background: "#fff",
                                                    outline: "none",
                                                    cursor: "pointer",
                                                    appearance: "none",
                                                    boxSizing: "border-box",
                                                }}
                                            >
                                                <option value="vs L4W Avg">vs L4W Avg</option>
                                            </select>
                                            <ChevronDown size={14} style={{ position: "absolute", right: 8, bottom: 12, color: "#64748b", pointerEvents: "none" }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section 5: Frequency & Severity (Hidden for Performance Summary) */}
                        {!isPerformanceSummarySelected && (
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                                    <div style={{ width: "4px", height: "16px", borderRadius: "2px", background: "#0047FF" }} />
                                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                                        Frequency & Severity
                                    </span>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                    {/* ALERT FREQUENCY */}
                                    <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                                            ALERT FREQUENCY
                                        </label>
                                        <div style={{ position: "relative" }} ref={frequencyDropdownRef}>
                                            <div
                                                onClick={() => setShowFrequencyDropdown((prev) => !prev)}
                                                className="form-input-focus"
                                                style={{
                                                    width: "100%",
                                                    height: "42px",
                                                    padding: "0 14px",
                                                    borderRadius: "10px",
                                                    border: showFrequencyDropdown ? "1.5px solid #0047FF" : "1px solid #cbd5e1",
                                                    boxShadow: showFrequencyDropdown ? "0 0 0 3px rgba(0, 71, 255, 0.12)" : "none",
                                                    background: "#ffffff",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    cursor: "pointer",
                                                    boxSizing: "border-box",
                                                    transition: "all 0.15s ease",
                                                }}
                                            >
                                                <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                                                    {frequency}
                                                </span>
                                                <ChevronDown size={16} style={{ color: "#64748b", transform: showFrequencyDropdown ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
                                            </div>

                                            {/* Dropdown Options (Upwards Opening) */}
                                            {showFrequencyDropdown && (
                                                <div
                                                    style={{
                                                        position: "absolute",
                                                        bottom: "100%",
                                                        left: 0,
                                                        right: 0,
                                                        marginBottom: "6px",
                                                        background: "#ffffff",
                                                        border: "1px solid #e2e8f0",
                                                        borderRadius: "12px",
                                                        boxShadow: "0 12px 28px -4px rgba(15, 23, 42, 0.18)",
                                                        padding: "6px",
                                                        zIndex: 40,
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: "2px",
                                                    }}
                                                >
                                                    {["Weekly Summary"].map((freqOption) => (
                                                        <div
                                                            key={freqOption}
                                                            onClick={() => {
                                                                setFrequency(freqOption);
                                                                setShowFrequencyDropdown(false);
                                                            }}
                                                            style={{
                                                                padding: "9px 12px",
                                                                borderRadius: "8px",
                                                                background: frequency === freqOption ? "#eff6ff" : "transparent",
                                                                color: frequency === freqOption ? "#0047FF" : "#1e293b",
                                                                fontSize: "13px",
                                                                fontWeight: frequency === freqOption ? 700 : 500,
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "space-between",
                                                                cursor: "pointer",
                                                                transition: "all 0.12s ease",
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (frequency !== freqOption) e.currentTarget.style.background = "#f8fafc";
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (frequency !== freqOption) e.currentTarget.style.background = "transparent";
                                                            }}
                                                        >
                                                            <span>{freqOption}</span>
                                                            {frequency === freqOption && <Check size={16} strokeWidth={3} />}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* SEVERITY LEVEL */}
                                    <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                                            SEVERITY LEVEL
                                        </label>
                                        <div style={{ position: "relative" }} ref={severityDropdownRef}>
                                            <div
                                                onClick={() => setShowSeverityDropdown((prev) => !prev)}
                                                className="form-input-focus"
                                                style={{
                                                    width: "100%",
                                                    height: "42px",
                                                    padding: "0 14px",
                                                    borderRadius: "10px",
                                                    border: showSeverityDropdown ? "1.5px solid #0047FF" : "1px solid #cbd5e1",
                                                    boxShadow: showSeverityDropdown ? "0 0 0 3px rgba(0, 71, 255, 0.12)" : "none",
                                                    background: "#ffffff",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    cursor: "pointer",
                                                    boxSizing: "border-box",
                                                    transition: "all 0.15s ease",
                                                }}
                                            >
                                                <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                                                    {severity}
                                                </span>
                                                <ChevronDown size={16} style={{ color: "#64748b", transform: showSeverityDropdown ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
                                            </div>

                                            {/* Dropdown Options (Upwards Opening) */}
                                            {showSeverityDropdown && (
                                                <div
                                                    style={{
                                                        position: "absolute",
                                                        bottom: "100%",
                                                        left: 0,
                                                        right: 0,
                                                        marginBottom: "6px",
                                                        background: "#ffffff",
                                                        border: "1px solid #e2e8f0",
                                                        borderRadius: "12px",
                                                        boxShadow: "0 12px 28px -4px rgba(15, 23, 42, 0.18)",
                                                        padding: "6px",
                                                        zIndex: 40,
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: "2px",
                                                    }}
                                                >
                                                    {["Critical", "High / Warning", "Medium", "Low"].map((sevOption) => (
                                                        <div
                                                            key={sevOption}
                                                            onClick={() => {
                                                                setSeverity(sevOption);
                                                                setShowSeverityDropdown(false);
                                                            }}
                                                            style={{
                                                                padding: "9px 12px",
                                                                borderRadius: "8px",
                                                                background: severity === sevOption ? "#eff6ff" : "transparent",
                                                                color: severity === sevOption ? "#0047FF" : "#1e293b",
                                                                fontSize: "13px",
                                                                fontWeight: severity === sevOption ? 700 : 500,
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "space-between",
                                                                cursor: "pointer",
                                                                transition: "all 0.12s ease",
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (severity !== sevOption) e.currentTarget.style.background = "#f8fafc";
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (severity !== sevOption) e.currentTarget.style.background = "transparent";
                                                            }}
                                                        >
                                                            <span>{sevOption}</span>
                                                            {severity === sevOption && <Check size={16} strokeWidth={3} />}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section 5 (Alternate for Performance Summary): Schedule Auto Report Segment */}
                        {isPerformanceSummarySelected && (
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                                    <div style={{ width: "4px", height: "16px", borderRadius: "2px", background: "#0047FF" }} />
                                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                                        Schedule Auto Report
                                    </span>
                                </div>

                                <div
                                    style={{
                                        background: "linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%)",
                                        border: "1px solid #bfdbfe",
                                        borderRadius: "14px",
                                        padding: "18px 20px",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "14px",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <div style={{ width: 38, height: 38, borderRadius: "10px", background: "#dbeafe", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <Calendar size={20} color="#0047FF" />
                                        </div>
                                        <div>
                                            <span style={{ display: "block", fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                                                Weekly Automated Performance Digest
                                            </span>
                                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                                                Schedule an automated weekly cross-platform brand performance report.
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                                            SELECT DELIVERY DAY OF THE WEEK
                                        </label>
                                        <div style={{ position: "relative" }}>
                                            <select
                                                value={scheduledDay}
                                                onChange={(e) => setScheduledDay(e.target.value)}
                                                className="form-input-focus"
                                                style={{
                                                    width: "100%",
                                                    height: "42px",
                                                    padding: "0 32px 0 14px",
                                                    borderRadius: "10px",
                                                    border: "1.5px solid #0047FF",
                                                    background: "#ffffff",
                                                    color: "#0f172a",
                                                    fontWeight: 700,
                                                    fontSize: "13.5px",
                                                    outline: "none",
                                                    cursor: "pointer",
                                                    appearance: "none",
                                                    boxSizing: "border-box",
                                                }}
                                            >
                                                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                                                    <option key={day} value={day}>
                                                        Every {day}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown size={16} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#0047FF", pointerEvents: "none" }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}</div>

                    {/* Footer Actions */}
                    <div
                        style={{
                            padding: "18px 28px",
                            borderTop: "1px solid #f1f5f9",
                            background: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: "14px",
                        }}
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: "10px 24px",
                                borderRadius: "10px",
                                border: "1px solid #cbd5e1",
                                background: "#ffffff",
                                color: "#334155",
                                fontSize: "13.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                        >
                            Cancel
                        </button>

                        {submitError && (
                            <div style={{ fontSize: "12px", color: "#ef4444", fontWeight: 600, padding: "6px 12px", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
                                {submitError}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "10px 26px",
                                borderRadius: "10px",
                                border: "none",
                                background: isSubmitting ? "#94a3b8" : "linear-gradient(135deg, #0047FF 0%, #0036C8 100%)",
                                color: "#ffffff",
                                fontSize: "13.5px",
                                fontWeight: 700,
                                cursor: isSubmitting ? "not-allowed" : "pointer",
                                boxShadow: isSubmitting ? "none" : "0 4px 14px rgba(0, 71, 255, 0.35)",
                                transition: "all 0.18s ease",
                                opacity: isSubmitting ? 0.7 : 1,
                            }}
                            onMouseEnter={(e) => {
                                if (!isSubmitting) {
                                    e.currentTarget.style.transform = "translateY(-1px)";
                                    e.currentTarget.style.boxShadow = "0 6px 18px rgba(0, 71, 255, 0.45)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isSubmitting) {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "0 4px 14px rgba(0, 71, 255, 0.35)";
                                }
                            }}
                        >
                            {isSubmitting ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <BookmarkPlus size={18} />}
                            {isSubmitting ? "Saving..." : "Submit Alert"}
                        </button>
                    </div>

                    {/* Toast Overlay */}
                    {showSuccessToast && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: "absolute",
                                bottom: "24px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                background: "#0f172a",
                                color: "#fff",
                                padding: "12px 22px",
                                borderRadius: "10px",
                                fontSize: "13.5px",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                boxShadow: "0 10px 30px rgba(15,23,42,0.3)",
                                zIndex: 10000,
                            }}
                        >
                            <Check size={18} color="#10b981" />
                            Intelligent Alert Saved Successfully!
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
