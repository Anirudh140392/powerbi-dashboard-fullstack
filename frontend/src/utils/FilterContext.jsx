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
    const [platforms, setPlatforms] = useState(Object.keys(platformData));
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

    // Fetch latest month available in backend to init date range (fallback to current month on failure)
    useEffect(() => {
        if (datesInitialized) return;

        let cancelled = false;

        const fetchLatestMonth = async () => {
            try {
                // If we have a selected brand, try to get its specific latest month
                // Otherwise (or if it fails), get the global latest month
                const response = await axiosInstance.get("/watchtower/latest-available-month", {
                    params: {
                        platform: platform !== 'All' ? platform : undefined,
                        brand: selectedBrand !== 'All' ? selectedBrand : undefined
                    }
                });

                if (!cancelled && response.data?.available) {
                    const startDate = response.data.defaultStartDate || response.data.startDate;
                    const endDate = response.data.latestDate || response.data.defaultEndDate || response.data.endDate;

                    const s = dayjs(startDate);
                    const e = dayjs(endDate);

                    setTimeStart(s);
                    setTimeEnd(e);
                    setMaxDate(e);

                    // Initialize comparison dates to preceding period
                    const diffDays = e.diff(s, 'day') + 1;
                    const cEnd = s.subtract(1, 'day');
                    const cStart = cEnd.subtract(diffDays - 1, 'day');
                    setCompareStart(cStart);
                    setCompareEnd(cEnd);

                    setDatesInitialized(true);
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
                        setMaxDate(dayjs(gEnd));
                        setDatesInitialized(true);
                        return;
                    }
                }
            } catch (error) {
                console.warn("⚠️ Unable to fetch latest available month, keeping default dates:", error.message);
            }

            if (!cancelled) {
                // Hard fallback to last known good data (since table ends at 2025-12-31)
                const s = dayjs("2025-12-01");
                const e = dayjs("2025-12-31");
                setTimeStart(s);
                setTimeEnd(e);

                const cEnd = s.subtract(1, 'day');
                const cStart = cEnd.subtract(e.diff(s, 'day'), 'day');
                setCompareStart(cStart);
                setCompareEnd(cEnd);

                setDatesInitialized(true);
            }
        };

        fetchLatestMonth();

        return () => {
            cancelled = true;
        };
    }, [datesInitialized]);


    // Fetch platforms on mount (with fallback)
    useEffect(() => {
        const fetchPlatforms = async () => {
            try {
                const response = await axiosInstance.get("/watchtower/platforms");
                const fetchedPlatforms = response.data;

                if (fetchedPlatforms && fetchedPlatforms.length > 0) {
                    // Backend is available, use API data
                    const options = ["All", ...fetchedPlatforms.filter(p => p !== "All")];
                    setPlatforms(options);
                    setBackendAvailable(true);

                    if (options.length > 0 && !platform) {
                        setPlatform(options[0]);
                    }
                } else {
                    // Empty response, use fallback
                    throw new Error("Empty platform data");
                }
            } catch (error) {
                console.warn("⚠️ Backend unavailable, using fallback data for platforms:", error.message);
                setBackendAvailable(false);
                // Use hardcoded platforms
                const fallbackPlatforms = Object.keys(platformData);
                setPlatforms(fallbackPlatforms);
                if (!platform && fallbackPlatforms.length > 0) {
                    setPlatform(fallbackPlatforms[0]);
                }
            }
        };
        fetchPlatforms();
    }, [filterRefreshCounter]); // Re-fetch when refresh counter changes

    // Fetch brands when platform changes (with fallback)
    useEffect(() => {
        if (!platform) return;

        const fetchBrands = async () => {
            if (backendAvailable) {
                try {
                    // Check if on Availability Analysis or Visibility Analysis page - include competitor brands
                    const isAvailabilityPage = window.location.pathname.includes('availability-analysis') || window.location.pathname.includes('visibility-anlysis');

                    // Note: Brands in rca_sku_dim are NOT platform-specific, so we always fetch with platform='All'
                    // The platform filter is only relevant for other dropdowns like locations
                    const response = await axiosInstance.get("/watchtower/brands", {
                        params: {
                            platform: 'All',  // Always use 'All' since brands are shared across platforms
                            includeCompetitors: isAvailabilityPage ? 'true' : 'false'
                        }
                    });
                    const fetchedBrands = response.data;

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
            darkStoreData
        }}>

            {children}
        </FilterContext.Provider>
    );
};
