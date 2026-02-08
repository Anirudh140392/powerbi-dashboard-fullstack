import React, { createContext, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import dayjs from "dayjs";

export const FilterContext = createContext();

// Static platform-brand-location mapping (FALLBACK DATA)
const platformData = {
    "Blinkit": {
        brands: ["Kwality Walls", "Amul", "Mother Dairy"],
        locations: {
            "Kwality Walls": ["Delhi", "Mumbai", "Bangalore"],
            "Amul": ["Delhi", "Pune", "Hyderabad"],
            "Mother Dairy": ["Delhi", "Noida", "Gurgaon"]
        }
    },
    "Zepto": {
        brands: ["Kwality Walls", "Amul", "Mother Dairy"],
        locations: {
            "Kwality Walls": ["Delhi", "Mumbai", "Bangalore"],
            "Amul": ["Mumbai", "Delhi"],
            "Mother Dairy": ["Delhi", "Bangalore", "Chennai"]
        }
    },
    "Instamart": {
        brands: ["Kwality Walls", "Amul", "Mother Dairy"],
        locations: {
            "Kwality Walls": ["Delhi", "Mumbai", "Bangalore"],
            "Amul": ["Hyderabad", "Pune"],
            "Mother Dairy": ["Delhi", "Noida", "Gurgaon"]
        }
    },
    "Flipkart": {
        brands: ["Kwality Walls", "Amul", "Mother Dairy"],
        locations: {
            "Kwality Walls": ["Delhi", "Mumbai", "Bangalore"],
            "Amul": ["Delhi", "Bangalore"],
            "Mother Dairy": ["Mumbai", "Delhi", "Chennai"]
        }
    },
    "Amazon": {
        brands: ["Kwality Walls", "Amul", "Mother Dairy"],
        locations: {
            "Kwality Walls": ["Delhi", "Mumbai", "Bangalore"],
            "Amul": ["Mumbai", "Delhi", "Bangalore"],
            "Mother Dairy": ["Delhi", "Pune"]
        }
    }
};

// Fallback keywords by brand
const keywordsData = {
    "Kwality Walls": ["vanilla", "chocolate", "strawberry", "butterscotch", "mango"],
    "Amul": ["vanilla", "chocolate", "strawberry", "kesar", "pista"],
    "Mother Dairy": ["vanilla", "chocolate", "strawberry", "butterscotch", "kulfi"]
};

export const FilterProvider = ({ children }) => {
    // Use React Router's useLocation hook for reliable route change detection
    const location = useLocation();
    const currentPath = location.pathname;

    // Load saved filters from localStorage
    const savedFilters = JSON.parse(localStorage.getItem('savedFilters') || '{}');

    // Platform state
    const [allPlatforms, setAllPlatforms] = useState(Object.keys(platformData));
    const [platforms, setPlatforms] = useState(["All", ...Object.keys(platformData)]);
    const [platform, setPlatform] = useState(savedFilters.platform || "Zepto");

    // Brand state
    const [brands, setBrands] = useState([]);
    const [selectedBrand, setSelectedBrand] = useState(savedFilters.selectedBrand || null);

    // Location state
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(savedFilters.selectedLocation || null);

    // Keyword state (for visibility analysis)
    const [keywords, setKeywords] = useState([]);
    const [selectedKeyword, setSelectedKeyword] = useState(savedFilters.selectedKeyword || null);

    // Channel state (Ecommerce / Modern Trades)
    const [channels] = useState(["Ecommerce", "Modern Trades"]);
    const [selectedChannel, setSelectedChannel] = useState(savedFilters.selectedChannel || "Ecommerce");

    // MSL Toggle state
    const [mslEnabled, setMslEnabled] = useState(savedFilters.mslEnabled ?? false);

    // Category state (for Availability Analysis page)
    const [categories] = useState(["All", "Cassata", "Core Tub", "Cornetto", "Cup", "KW Sticks", "Magnum", "Others"]);
    const [selectedCategory, setSelectedCategory] = useState(savedFilters.selectedCategory || "All");

    // Zone state (for Performance Marketing page only)
    const [zones, setZones] = useState([]);
    const [selectedZone, setSelectedZone] = useState("All");

    // PM-specific Platform and Brand state (for Performance Marketing page only)
    const [pmPlatforms, setPmPlatforms] = useState([]);
    const [pmSelectedPlatform, setPmSelectedPlatform] = useState("All");
    const [pmBrands, setPmBrands] = useState([]);
    const [pmSelectedBrand, setPmSelectedBrand] = useState("All");

    // Date Ranges
    // Default date range: 1st of current month to today
    const [timeStart, setTimeStart] = useState(savedFilters.timeStart ? dayjs(savedFilters.timeStart) : dayjs().startOf('month'));
    const [timeEnd, setTimeEnd] = useState(savedFilters.timeEnd ? dayjs(savedFilters.timeEnd) : dayjs());
    const [compareStart, setCompareStart] = useState(savedFilters.compareStart ? dayjs(savedFilters.compareStart) : dayjs("2025-09-01"));
    const [compareEnd, setCompareEnd] = useState(savedFilters.compareEnd ? dayjs(savedFilters.compareEnd) : dayjs("2025-09-06"));
    const [comparisonLabel, setComparisonLabel] = useState(savedFilters.comparisonLabel || "VS PREV. 30 DAYS");

    const [datesInitialized, setDatesInitialized] = useState(false);

    // Max date available in the database (for date picker limit)
    const [maxDate, setMaxDate] = useState(dayjs());

    // Track if backend is available
    const [backendAvailable, setBackendAvailable] = useState(true);

    // Counter to force re-fetch of filter options (incremented when user clicks Refresh)
    const [filterRefreshCounter, setFilterRefreshCounter] = useState(0);

    // Dark Store Count State
    const [darkStoreData, setDarkStoreData] = useState({ totalCount: 0, byPlatform: {} });

    // Function to trigger a refresh of all filter options
    const refreshFilters = () => {
        console.log('🔄 [FilterContext] Refreshing all filter options...');
        setBackendAvailable(true); // Reset backend available flag to try API again
        setFilterRefreshCounter(prev => prev + 1); // Increment counter to trigger useEffect re-runs
    };

    // Fetch Dark Store Count
    useEffect(() => {
        const fetchDarkStoreCount = async () => {
            try {
                const response = await axiosInstance.get("/watchtower/dark-store-count", {
                    params: {
                        platform: platform,
                        location: selectedLocation,
                        startDate: timeStart ? timeStart.format('YYYY-MM-DD') : null,
                        endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : null
                    }
                });
                if (response.data) {
                    setDarkStoreData(response.data);
                }
            } catch (error) {
                console.error("[FilterContext] Error fetching dark store count:", error);
            }
        };

        if (datesInitialized) {
            fetchDarkStoreCount();
        }
    }, [platform, selectedLocation, timeStart, timeEnd, datesInitialized, filterRefreshCounter]);

    // Log route changes for debugging and reset location for Performance Marketing
    useEffect(() => {
        console.log('📍 Route changed to:', currentPath);
    }, [currentPath]);

    // Track current date source mode to handle page-specific date logic
    const [dateSourceMode, setDateSourceMode] = useState('default'); // 'default' | 'content_analysis'

    // Fetch latest month available in backend to init date range (fallback to current month on failure)
    useEffect(() => {
        // Determine required mode based on current path
        // Route is defined as /content-score in App.jsx
        const isContentAnalysis = currentPath.includes('content-analysis') || currentPath.includes('content-score');
        const targetMode = isContentAnalysis ? 'content_analysis' : 'default';

        // Only return if initialized AND the mode hasn't changed
        if (datesInitialized && dateSourceMode === targetMode) return;

        console.log(`[FilterContext] Date mode changed to ${targetMode}. Re-initializing dates...`);

        let cancelled = false;

        const fetchLatestMonth = async () => {
            try {
                // If we have a selected brand, try to get its specific latest month
                // Otherwise (or if it fails), get the global latest month
                // Check if we are on the Content Analysis page
                const isContentAnalysis = currentPath.includes('content-analysis') || currentPath.includes('content-score');

                const response = await axiosInstance.get("/watchtower/latest-available-month", {
                    params: {
                        platform: platform !== 'All' ? platform : undefined,
                        brand: selectedBrand !== 'All' ? selectedBrand : undefined,
                        source: isContentAnalysis ? 'content_analysis' : undefined // Trigger backend special logic
                    }
                });

                if (!cancelled && response.data?.available) {
                    const startDate = response.data.defaultStartDate || response.data.startDate;
                    const endDate = response.data.latestDate || response.data.defaultEndDate || response.data.endDate;

                    const s = dayjs(startDate);
                    const e = dayjs(endDate);

                    setTimeStart(s);
                    setTimeEnd(e);
                    // FIXED: Allow navigation up to today regardless of where data ends
                    setMaxDate(dayjs());

                    // Initialize comparison dates to preceding period
                    const diffDays = e.diff(s, 'day') + 1;
                    const cEnd = s.subtract(1, 'day');
                    const cStart = cEnd.subtract(diffDays - 1, 'day');
                    setCompareStart(cStart);
                    setCompareEnd(cEnd);

                    setDatesInitialized(true);
                    setDateSourceMode(targetMode);
                    return;
                } else if (!cancelled && selectedBrand && selectedBrand !== 'All') {
                    // Fallback to global latest month if brand-specific failed
                    console.log(`[FilterContext] No data for ${selectedBrand}, falling back to global latest month`);
                    const globalResponse = await axiosInstance.get("/watchtower/latest-available-month");
                    if (globalResponse.data?.available) {
                        const gStart = globalResponse.data.defaultStartDate;
                        const gEnd = globalResponse.data.defaultEndDate;
                        setTimeStart(dayjs(gStart));
                        setTimeEnd(dayjs(gEnd));
                        // FIXED: Allow navigation up to today
                        setMaxDate(dayjs());
                        setDatesInitialized(true);
                        setDateSourceMode(targetMode);
                        return;
                    }
                }
            } catch (error) {
                console.warn("⚠️ Unable to fetch latest available month, keeping default dates:", error.message);
            }

            if (!cancelled) {
                // Hard fallback to last known good data (updated to 2026)
                const s = dayjs("2026-01-01");
                const e = dayjs(); // Allow up to today
                setTimeStart(s);
                setTimeEnd(e);

                // Allow selection up to today
                setMaxDate(e);

                const cEnd = s.subtract(1, 'day');
                const cStart = cEnd.subtract(e.diff(s, 'day'), 'day');
                setCompareStart(cStart);
                setCompareEnd(cEnd);

                setDatesInitialized(true);
                setDateSourceMode(targetMode); // Ensure we switch mode even on fallback
            }
        };

        fetchLatestMonth();

        return () => {
            cancelled = true;
        };
    }, [datesInitialized, currentPath, dateSourceMode]); // Re-run when path or mode changes


    // Fetch platforms on mount (with fallback)
    useEffect(() => {
        const fetchPlatforms = async () => {
            try {
                const response = await axiosInstance.get("/watchtower/platforms");
                const fetchedPlatforms = response.data;

                if (fetchedPlatforms && fetchedPlatforms.length > 0) {
                    // Backend is available, use API data
                    const options = fetchedPlatforms.filter(p => p !== "All");
                    setAllPlatforms(options);
                    setBackendAvailable(true);
                } else {
                    // Empty response, use fallback
                    throw new Error("Empty platform data");
                }
            } catch (error) {
                console.warn("⚠️ [FilterContext] Backend platforms API failed:", error.message);
                setBackendAvailable(false);
                // Use hardcoded platforms
                const fallbackPlatforms = Object.keys(platformData);
                setAllPlatforms(fallbackPlatforms);
            }
        };
        fetchPlatforms();
    }, [filterRefreshCounter]); // Re-fetch when refresh counter changes

    // Update filtered platforms when channel or allPlatforms changes
    useEffect(() => {
        if (!allPlatforms || allPlatforms.length === 0) return;

        let filtered = [];
        if (selectedChannel === "Ecommerce") {
            // Ecommerce: only Blinkit (case-insensitive)
            filtered = allPlatforms.filter(p => p.toLowerCase().includes('blinkit'));
        } else if (selectedChannel === "Modern Trades") {
            // Modern Trades: everything EXCEPT Blinkit
            filtered = allPlatforms.filter(p => !p.toLowerCase().includes('blinkit'));
        } else {
            // Default or other channels: show all
            filtered = [...allPlatforms];
        }

        const options = ["All", ...filtered];
        setPlatforms(options);

        // If current platform is not in dynamic options, reset to 'All'
        if (!options.includes(platform)) {
            setPlatform("All");
        }
    }, [selectedChannel, allPlatforms]);

    // Fetch brands when platform changes (with fallback)
    useEffect(() => {
        if (!platform) return;

        const fetchBrands = async () => {
            if (backendAvailable) {
                try {
                    // Check if on Availability Analysis page - use availability-specific endpoint
                    const isAvailabilityPage = window.location.pathname.includes('availability-analysis');
                    // Check if on Visibility Analysis page
                    const isVisibilityPage = window.location.pathname.includes('visibility-anlysis');

                    let fetchedBrands;

                    if (isAvailabilityPage) {
                        // Use availability filter-options endpoint which fetches from rb_pdp_olap
                        const response = await axiosInstance.get("/availability-analysis/filter-options", {
                            params: {
                                filterType: 'brands',
                                platform: platform !== 'All' ? platform : 'All'
                            }
                        });
                        fetchedBrands = response.data?.options || [];
                    } else {
                        // Use watchtower/brands endpoint for other pages (uses rca_sku_dim)
                        const response = await axiosInstance.get("/watchtower/brands", {
                            params: {
                                platform: 'All',  // Always use 'All' since brands are shared across platforms
                                includeCompetitors: isVisibilityPage ? 'true' : 'false'
                            }
                        });
                        fetchedBrands = response.data;
                    }

                    if (fetchedBrands && fetchedBrands.length > 0) {
                        // API data available
                        const options = ["All", ...fetchedBrands.filter(b => b !== "All")];
                        setBrands(options);

                        if (options.length > 0) {
                            setSelectedBrand(options[0]);
                        } else {
                            setSelectedBrand(null);
                        }
                        return;
                    }
                } catch (error) {
                    console.warn("⚠️ API failed, falling back to hardcoded brands:", error.message);
                    setBackendAvailable(false);
                }
            }

            // Fallback to hardcoded data
            if (platformData[platform]) {
                const platformBrands = platformData[platform].brands;
                setBrands(platformBrands);

                if (platformBrands.length > 0) {
                    setSelectedBrand(platformBrands[0]);
                } else {
                    setSelectedBrand(null);
                }
            } else {
                setBrands([]);
                setSelectedBrand(null);
            }
        };

        fetchBrands();
    }, [platform, backendAvailable, currentPath, filterRefreshCounter]); // Re-fetch when refresh counter changes

    // Fetch keywords and locations when brand changes (with fallback)
    useEffect(() => {
        if (!selectedBrand || !platform) return;

        const fetchKeywords = async () => {
            if (backendAvailable) {
                try {
                    const response = await axiosInstance.get("/watchtower/keywords", {
                        params: { brand: selectedBrand }
                    });
                    const fetchedKeywords = response.data;

                    if (fetchedKeywords && fetchedKeywords.length > 0) {
                        setKeywords(fetchedKeywords);

                        if (fetchedKeywords.length > 0) {
                            setSelectedKeyword(fetchedKeywords[0]);
                        } else {
                            setSelectedKeyword(null);
                        }
                        return;
                    }
                } catch (error) {
                    console.warn("⚠️ API failed, falling back to hardcoded keywords:", error.message);
                }
            }

            // Fallback to hardcoded keywords
            if (keywordsData[selectedBrand]) {
                const brandKeywords = keywordsData[selectedBrand];
                setKeywords(brandKeywords);
                if (brandKeywords.length > 0) {
                    setSelectedKeyword(brandKeywords[0]);
                } else {
                    setSelectedKeyword(null);
                }
            } else {
                // Generic fallback
                const genericKeywords = ["vanilla", "chocolate", "strawberry", "butterscotch", "mango"];
                setKeywords(genericKeywords);
                setSelectedKeyword(genericKeywords[0]);
            }
        };

        const fetchLocations = async () => {


            if (backendAvailable) {
                try {
                    // Check if on Availability Analysis or Visibility Analysis page - include all locations
                    const isAvailabilityPage = window.location.pathname.includes('availability-analysis') || window.location.pathname.includes('visibility-anlysis');

                    const response = await axiosInstance.get("/watchtower/locations", {
                        params: {
                            platform: platform,
                            brand: selectedBrand,
                            includeCompetitors: isAvailabilityPage ? 'true' : 'false'
                        }
                    });
                    const fetchedLocations = response.data;

                    if (fetchedLocations && fetchedLocations.length > 0) {
                        // API data available
                        const options = ["All", ...fetchedLocations.filter(l => l !== "All")];
                        setLocations(options);

                        if (options.length > 0) {
                            setSelectedLocation(options[0]);
                        } else {
                            setSelectedLocation(null);
                        }
                        return;
                    }
                } catch (error) {
                    console.warn("⚠️ API failed, falling back to hardcoded locations:", error.message);
                }
            }

            // Fallback to hardcoded locations
            if (platformData[platform] && platformData[platform].locations[selectedBrand]) {
                const brandLocations = platformData[platform].locations[selectedBrand];
                setLocations(brandLocations);

                if (brandLocations.length > 0) {
                    setSelectedLocation(brandLocations[0]);
                } else {
                    setSelectedLocation(null);
                }
            } else {
                setLocations([]);
                setSelectedLocation(null);
            }
        };

        fetchKeywords();
        fetchLocations();
    }, [selectedBrand, platform, backendAvailable, currentPath, filterRefreshCounter]); // Re-fetch when refresh counter changes

    return (
        <FilterContext.Provider value={{
            brands,
            selectedBrand,
            setSelectedBrand,
            keywords,
            selectedKeyword,
            setSelectedKeyword,
            locations,
            selectedLocation,
            setSelectedLocation,
            platforms,
            platform,
            setPlatform,
            timeStart,
            setTimeStart,
            timeEnd,
            setTimeEnd,
            compareStart,
            setCompareStart,
            compareEnd,
            setCompareEnd,
            backendAvailable,
            comparisonLabel,
            setComparisonLabel,
            datesInitialized,
            maxDate,
            zones,
            selectedZone,
            setZones,
            setSelectedZone,
            pmPlatforms,
            pmSelectedPlatform,
            setPmPlatforms,
            setPmSelectedPlatform,
            pmBrands,
            pmSelectedBrand,
            setPmBrands,
            setPmSelectedBrand,
            refreshFilters,
            filterRefreshCounter,
            darkStoreData,
            channels,
            selectedChannel,
            setSelectedChannel,
            mslEnabled,
            setMslEnabled,
            categories,
            selectedCategory,
            setSelectedCategory
        }}>

            {children}
        </FilterContext.Provider>
    );
};
