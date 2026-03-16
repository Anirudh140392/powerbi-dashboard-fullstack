import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { STATES, CITIES } from "./indiaData"; // Assuming we can use these coords
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import axiosInstance from "../../api/axiosInstance";
import dayjs from "dayjs";

// --- Constants & Types ---
const INDIA_BOUNDS = [
    [68.1, 6.0],
    [97.4, 37.2],
];

const COLORS = {
    Green: "#10b981", // High / Good
    Blue: "#3b82f6",  // Target
    Orange: "#f59e0b", // Warning
    Red: "#ef4444",   // Critical
};

// --- Helper: Generate Pin SVG (valueText is any formatted string; caller controls % or units) ---
const getPinSvg = (color, valueText) => `
    <svg width="46" height="56" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg">
        <path fill="${color}" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"/>
        <circle cx="192" cy="192" r="130" fill="white" />
        <text x="192" y="235" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="64" fill="${color}">${valueText}</text>
    </svg>
`;

// --- Components ---

export default function GeoIntelligenceMap() {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [filters, setFilters] = useState({ platform: 'Blinkit' });
    const [metric, setMetric] = useState("Wt. OSA %");
    const [platform, setPlatform] = useState("Blinkit");
    const [timePeriod, setTimePeriod] = useState("MTD");
    const [markers, setMarkers] = useState([]);
    const [apiData, setApiData] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState({ startDate: "", endDate: "" });
    const [loading, setLoading] = useState(false);
    const [platforms, setPlatforms] = useState([]);

    // --- Fetch Platforms from DB ---
    useEffect(() => {
        const fetchPlatforms = async () => {
            try {
                const res = await axiosInstance.get('/watchtower/platforms');
                const data = res.data;
                setPlatforms(data || []);
                if (data && data.length > 0 && !data.includes(platform)) {
                    setPlatform(data[0]);
                }
            } catch (error) {
                console.error('[MapIntellect] Failed to fetch platforms:', error);
                setPlatforms(['Blinkit', 'Zepto', 'Instamart']);
            }
        };
        fetchPlatforms();
    }, []);

    // Filter Handling
    const [importanceFilter, setImportanceFilter] = useState("All");

    // --- Fetch Real Data from Backend ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Build time period params
                let params = `platform=${encodeURIComponent(platform)}`;

                // Add metric parameter based on selected KPI
                let metricParam = 'all';
                if (metric === 'Market Share') {
                    metricParam = 'marketshare';
                } else if (metric === 'Wt. OSA %') {
                    metricParam = 'osa';
                } else if (metric === 'Sales') {
                    metricParam = 'sales';
                } else if (metric === 'Orders') {
                    metricParam = 'orders';
                }
                params += `&metric=${metricParam}`;

                if (timePeriod === "MTD") {
                    params += `&months=1`;
                } else if (timePeriod === "7D") {
                    params += `&days=7`;
                } else if (timePeriod === "14D") {
                    params += `&days=14`;
                } else if (timePeriod === "31D") {
                    params += `&days=31`;
                }

                const res = await axiosInstance.get('/map-intellect/data', { params: Object.fromEntries(new URLSearchParams(params)) });
                if (res.data && res.data.cities) {
                    setApiData(res.data.cities);
                } else {
                    setApiData([]);
                }
                if (res.data && res.data.period) {
                    setSelectedPeriod(res.data.period);
                } else {
                    setSelectedPeriod({ startDate: "", endDate: "" });
                }
            } catch (error) {
                console.error('[MapIntellect] Failed to fetch data:', error);
                setApiData([]);
                setSelectedPeriod({ startDate: "", endDate: "" });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [platform, timePeriod, metric]);

    // --- Build coordinate-mapped data from API response ---
    const mapData = useMemo(() => {
        // Build a lookup from city/state name -> coordinates
        const coordsLookup = {};
        CITIES.forEach(c => { coordsLookup[c.name.toLowerCase()] = { lat: c.coords[1], lng: c.coords[0], type: "City" }; });
        STATES.forEach(s => { coordsLookup[s.name.toLowerCase()] = { lat: s.center[1], lng: s.center[0], type: "State" }; });

        // Calculate max values for relative thresholding on absolute metrics
        const maxSales = Math.max(...apiData.map(c => c.sales || 0), 1);
        const maxOrders = Math.max(...apiData.map(c => c.orders || 0), 1);

        return apiData
            .filter(city => coordsLookup[city.name.toLowerCase()])
            .map(city => {
                const coords = coordsLookup[city.name.toLowerCase()];

                // Pick the value and calculate color based on the selected metric
                let value = 0;
                let color = COLORS.Red; // Default

                if (metric === "Wt. OSA %") {
                    value = city.osa || 0;
                    if (value > 80) color = COLORS.Green;
                    else if (value > 65) color = COLORS.Blue;
                    else if (value > 45) color = COLORS.Orange;
                    else color = COLORS.Red;
                } else if (metric === "Market Share") {
                    value = city.marketShare || 0;
                    // User-defined thresholds for Market Share
                    if (value > 4.9) color = COLORS.Green;
                    else color = COLORS.Red;
                } else if (metric === "Sales") {
                    value = city.sales || 0;
                    color = (city.salesChange || 0) >= 0 ? COLORS.Green : COLORS.Red;
                } else if (metric === "Orders") {
                    value = city.orders || 0;
                    color = (city.ordersChange || 0) >= 0 ? COLORS.Green : COLORS.Red;
                }

                return {
                    name: city.name,
                    value,
                    osa: city.osa || 0,
                    marketShare: city.marketShare || 0,
                    sales: city.sales || 0,
                    salesFormatted: city.salesFormatted || "₹0",
                    orders: city.orders || 0,
                    color,
                    lat: coords.lat,
                    lng: coords.lng,
                    type: coords.type,
                    listingPercentage: city.listingPercentage || 0,
                };
            });
    }, [apiData, metric]);

    // --- Map Initialization ---
    useEffect(() => {
        if (map.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    osm: {
                        type: 'raster',
                        tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '&copy; OpenStreetMap'
                    }
                },
                layers: [
                    {
                        id: 'osm-tiles',
                        type: 'raster',
                        source: 'osm',
                        minzoom: 0,
                        maxzoom: 19,
                        paint: { 'raster-saturation': -0.8, 'raster-contrast': 0.1 } // Subtle, desaturated look
                    }
                ]
            },
            center: [79.5, 22.0],
            zoom: 4.6,
            attributionControl: false,
        });

        map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

        // Add India State Boundaries Source (using the one from previous context or reliable URL)
        map.current.on('load', () => {
            map.current.addSource('india-states', {
                type: 'geojson',
                data: 'https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson'
            });
            map.current.addLayer({
                id: 'india-fill',
                type: 'fill',
                source: 'india-states',
                paint: {
                    'fill-color': '#fff',
                    'fill-opacity': 0.1
                }
            });
            map.current.addLayer({
                id: 'india-line',
                type: 'line',
                source: 'india-states',
                paint: {
                    'line-color': '#cbd5e1',
                    'line-width': 1
                }
            });
        });

    }, []);

    // --- Marker Updates ---
    useEffect(() => {
        if (!map.current) return;

        // Clear existing markers
        markers.forEach(m => m.remove());

        const newMarkers = [];

        // Filter logic mapping based on markers assigned color
        const filteredData = mapData.filter(d => {
            if (importanceFilter === "All") return true;
            if (metric === "Sales" || metric === "Orders") {
                if (importanceFilter === "Growth") return d.color === COLORS.Green;
                if (importanceFilter === "Degrowth") return d.color === COLORS.Red;
            } else {
                if (importanceFilter === "High") return d.color === COLORS.Green;
                if (importanceFilter === "Medium") return d.color === COLORS.Blue || d.color === COLORS.Orange;
                if (importanceFilter === "Low") return d.color === COLORS.Red;
            }
            return true;
        });

        filteredData.forEach(d => {
            // Create custom marker element
            const el = document.createElement('div');
            el.className = 'custom-marker';
            // Determine pin display text based on selected metric
            let pinText = '';
            if (metric === 'Sales') {
                pinText = d.salesFormatted || '₹0';
            } else if (metric === 'Orders') {
                pinText = `${d.orders}`;
            } else if (metric === 'Market Share') {
                pinText = `${d.marketShare}%`;
            } else {
                pinText = `${d.osa}%`;
            }
            el.innerHTML = getPinSvg(d.color, pinText);
            el.style.width = '46px';
            el.style.height = '56px';
            el.style.cursor = 'pointer';

            // Popup content - show only the selected KPI value
            let kpiLabel = '';
            let kpiValue = '';

            if (metric === 'Wt. OSA %') {
                kpiLabel = 'Wt. OSA %';
                kpiValue = `${d.osa}%`;
            } else if (metric === 'Market Share') {
                kpiLabel = 'Market Share';
                kpiValue = `${d.marketShare}%`;
            } else if (metric === 'Sales') {
                kpiLabel = 'Sales';
                kpiValue = d.salesFormatted;
            } else if (metric === 'Orders') {
                kpiLabel = 'Orders';
                kpiValue = d.orders.toLocaleString('en-IN');
            }

            const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`
            <div style="font-family: 'DM Sans', sans-serif; padding: 8px; min-width: 180px;">
                <div style="font-weight: 700; font-size: 14px; color: #1e293b; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">${d.name}</div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
                    <span>${kpiLabel}:</span> <span style="font-weight: 600; color: #1e293b;">${kpiValue}</span>
                </div>
                ${metric === "Wt. OSA %" ? `
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-top: 4px;">
                    <span>Listing %:</span> <span style="font-weight: 600; color: #1e293b;">${d.listingPercentage}%</span>
                </div>
                ` : ""}
            </div>
        `);

            // Add marker
            const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([d.lng, d.lat])
                .setPopup(popup)
                .addTo(map.current);

            // Hover effect for popup
            el.addEventListener('mouseenter', () => marker.togglePopup());
            el.addEventListener('mouseleave', () => marker.togglePopup());

            newMarkers.push(marker);
        });

        setMarkers(newMarkers);

    }, [mapData, importanceFilter, metric]); // Re-render markers when data or metric changes

    // --- Render ---
    return (
        <CommonContainer title="India Overview" filters={filters} onFiltersChange={setFilters}>
            <div style={{ padding: "30px 28px", background: "#f8fafc", minHeight: "100vh", fontFamily: '"DM Sans", sans-serif' }}>

                {/* Header removed per request (Map Intellect panel & analysis period) */}

                {/* Main Container */}
                <div style={{ position: "relative" }}>

                    {/* Filter Bar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>

                        {/* Metrics */}
                        <div style={{ display: "flex", gap: "8px", background: "#f8fafc", padding: "4px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                            {["Wt. OSA %", "Market Share", "Sales", "Orders"].map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMetric(m)}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                        fontWeight: "700",
                                        border: "none",
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                        background: metric === m ? "#2563eb" : "transparent",
                                        color: metric === m ? "white" : "#64748b",
                                        boxShadow: metric === m ? "0 2px 4px rgba(37,99,235,0.2)" : "none"
                                    }}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>

                        {/* Platform & Time */}
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>Market</span>
                                <div style={{ position: "relative" }}>
                                    <select
                                        value={platform}
                                        onChange={(e) => setPlatform(e.target.value)}
                                        style={{
                                            appearance: "none",
                                            background: "#f8fafc",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "8px",
                                            padding: "8px 32px 8px 12px",
                                            fontSize: "13px",
                                            fontWeight: "700",
                                            color: "#0f172a",
                                            cursor: "pointer",
                                            minWidth: "120px"
                                        }}
                                    >
                                        {platforms.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                    <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </div>
                                </div>
                            </div>

                            <div style={{ height: "24px", width: "1px", background: "#e2e8f0" }}></div>

                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div style={{ display: "flex", gap: "4px" }}>
                                    {["MTD", "7D", "14D", "31D"].map(tp => (
                                        <button
                                            key={tp}
                                            onClick={() => setTimePeriod(tp)}
                                            style={{
                                                width: "36px",
                                                height: "32px",
                                                borderRadius: "8px",
                                                fontSize: "11px",
                                                fontWeight: "700",
                                                border: tp === timePeriod ? "none" : "1px solid #e2e8f0",
                                                cursor: "pointer",
                                                background: tp === timePeriod ? "#1e293b" : "white",
                                                color: tp === timePeriod ? "white" : "#64748b",
                                            }}
                                        >
                                            {tp}
                                        </button>
                                    ))}
                                </div>
                                {selectedPeriod.startDate && (
                                    <div style={{
                                        fontSize: "12px",
                                        fontWeight: "700",
                                        color: "#475569",
                                        background: "#f1f5f9",
                                        padding: "6px 12px",
                                        borderRadius: "20px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        border: "1px solid #e2e8f0"
                                    }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                        {dayjs(selectedPeriod.startDate).format("DD MMM")} - {dayjs(selectedPeriod.endDate).format("DD MMM, YYYY")}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{
                        position: "relative",
                        height: "calc(100vh - 120px)",
                        width: "100%",
                        overflow: "hidden",
                        borderRadius: "32px",
                        background: "white",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)",
                        border: "1px solid #e2e8f0"
                    }}>
                        <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

                        {/* Skeleton Loader Overlay */}
                        {loading && (
                            <div style={{
                                position: "absolute", inset: 0, zIndex: 50,
                                background: "rgba(248, 250, 252, 0.85)",
                                backdropFilter: "blur(4px)",
                                display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center",
                                gap: "24px", borderRadius: "32px"
                            }}>
                                {/* Pulsing map pin placeholders */}
                                <div style={{ display: "flex", gap: "32px", alignItems: "flex-end" }}>
                                    {[36, 48, 40, 44, 38].map((h, i) => (
                                        <div key={i} style={{
                                            width: "28px", height: `${h}px`,
                                            borderRadius: "50% 50% 50% 0",
                                            background: `linear-gradient(135deg, #e2e8f0, #cbd5e1)`,
                                            animation: `pulse 1.5s ease-in-out ${i * 0.2}s infinite`,
                                            opacity: 0.6
                                        }} />
                                    ))}
                                </div>
                                {/* Loading text */}
                                <div style={{
                                    display: "flex", flexDirection: "column",
                                    alignItems: "center", gap: "8px"
                                }}>
                                    <div style={{
                                        width: "32px", height: "32px",
                                        border: "3px solid #e2e8f0",
                                        borderTop: "3px solid #3b82f6",
                                        borderRadius: "50%",
                                        animation: "spin 0.8s linear infinite"
                                    }} />
                                    <span style={{
                                        fontSize: "13px", fontWeight: 700,
                                        color: "#64748b", letterSpacing: "0.5px"
                                    }}>Loading map data...</span>
                                </div>
                                <style>{`
                                    @keyframes pulse {
                                        0%, 100% { transform: scale(1); opacity: 0.4; }
                                        50% { transform: scale(1.15); opacity: 0.8; }
                                    }
                                    @keyframes spin {
                                        to { transform: rotate(360deg); }
                                    }
                                `}</style>
                            </div>
                        )}

                        {/* Floating Control: Focus Area */}
                        <div style={{ position: "absolute", top: "20px", left: "20px", background: "white", padding: "12px 16px", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)", display: "flex", gap: "24px", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>FOCUS AREA</div>
                                <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>Across India</div>
                            </div>
                            <div style={{ width: "1px", height: "24px", background: "#e2e8f0" }}></div>
                            <div>
                                <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>GRANULARITY</div>
                                <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>State-level</div>
                            </div>
                        </div>


                        {/* INNOVATIVE: Prism Intensity & Filter Panel */}
                        <div style={{
                            position: "absolute",
                            bottom: "32px",
                            right: "32px",
                            background: "rgba(255, 255, 255, 0.95)",
                            backdropFilter: "blur(20px)",
                            padding: "24px",
                            borderRadius: "32px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)",
                            width: "300px",
                            color: "#0f172a"
                        }}>
                            {/* The Luminous Prism Scale */}
                            <div style={{ marginBottom: "24px" }}>
                                <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "800", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "16px" }}>Intensity Prism</div>
                                <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "40px" }}>
                                    {(metric === "Sales" || metric === "Orders" || metric === "Market Share") ? (
                                        <>
                                            <div style={{ flex: 1, height: "50%", background: COLORS.Red, borderRadius: "4px", boxShadow: `0 4px 12px ${COLORS.Red}33` }}></div>
                                            <div style={{ flex: 1, height: "100%", background: COLORS.Green, borderRadius: "4px", boxShadow: `0 4px 12px ${COLORS.Green}33` }}></div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ flex: 1, height: "40%", background: COLORS.Red, borderRadius: "4px", boxShadow: `0 4px 12px ${COLORS.Red}33` }}></div>
                                            <div style={{ flex: 1, height: "60%", background: COLORS.Orange, borderRadius: "4px", boxShadow: `0 4px 12px ${COLORS.Orange}33` }}></div>
                                            <div style={{ flex: 1, height: "80%", background: COLORS.Blue, borderRadius: "4px", boxShadow: `0 4px 12px ${COLORS.Blue}33` }}></div>
                                            <div style={{ flex: 1, height: "100%", background: COLORS.Green, borderRadius: "4px", boxShadow: `0 4px 12px ${COLORS.Green}33` }}></div>
                                        </>
                                    )}
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "10px", fontWeight: "700", color: "#94a3b8" }}>
                                    <span>{(metric === "Sales" || metric === "Orders") ? "DEGROWTH" : "CRITICAL"}</span>
                                    <span>{(metric === "Sales" || metric === "Orders") ? "GROWTH" : "LEADER"}</span>
                                </div>
                            </div>

                            {/* Interactive Analysis Pills */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "800", textTransform: "uppercase", letterSpacing: "2px" }}>Focus Filter</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    {((metric === "Sales" || metric === "Orders") ? ["All", "Growth", "Degrowth"] : (metric === "Market Share" ? ["All", "High", "Low"] : ["All", "High", "Medium", "Low"])).map(f => {
                                        const active = importanceFilter === f;
                                        let dotColor = "#94a3b8";
                                        if (f === "High" || f === "Growth") dotColor = COLORS.Green;
                                        else if (f === "Medium") dotColor = COLORS.Blue;
                                        else if (f === "Low" || f === "Degrowth") dotColor = COLORS.Red;

                                        return (
                                            <button
                                                key={f}
                                                onClick={() => setImportanceFilter(f)}
                                                style={{
                                                    padding: "12px",
                                                    borderRadius: "16px",
                                                    fontSize: "12px",
                                                    fontWeight: "700",
                                                    border: active ? "1px solid #e2e8f0" : "1px solid #f1f5f9",
                                                    cursor: "pointer",
                                                    transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                                                    background: active ? "#0f172a" : "#f8fafc",
                                                    color: active ? "#fff" : "#64748b",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    transform: active ? "scale(1.05)" : "scale(1)",
                                                    boxShadow: active ? "0 10px 15px -3px rgba(0, 0, 0, 0.1)" : "none"
                                                }}
                                            >
                                                {f}
                                                <div style={{
                                                    width: "8px",
                                                    height: "8px",
                                                    borderRadius: "50%",
                                                    background: dotColor,
                                                    boxShadow: active ? `0 0 8px ${dotColor}` : "none"
                                                }}></div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </CommonContainer>
    );
}
