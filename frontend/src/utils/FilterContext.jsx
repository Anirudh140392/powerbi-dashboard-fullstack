import React, { createContext, useState, useEffect, useCallback, useRef } from "react";
import axiosInstance from "../api/axiosInstance";
import dayjs from "dayjs";

export const FilterContext = createContext();

// Context ready states so children know when async data has loaded
export const initialContextLoaded = (ctx) => ctx.datesFetched && ctx.platformsFetched;


// Static fallback data (used if API is unreachable)
const FALLBACK_PLATFORMS = ["Blinkit", "Zepto", "Instamart", "Flipkart", "Amazon"];
const FALLBACK_CATEGORIES = ["All", "Cassata", "Core Tub", "Cup", "Sandwich"];
const FALLBACK_LOCATIONS = ["All"];
const FALLBACK_BRANDS = ["Colgate", "Palmolive", "Halo"];

// Channel → platform mapping (static, channels are not in rca_sku_dim)
const channelPlatformMap = {
    "Ecom": ["Blinkit", "Zepto", "Instamart", "Flipkart", "Amazon"],
    "ModernTrade": ["Reliance Fresh", "Big Bazaar", "DMart"]
};


export const FilterProvider = ({ children }) => {
    // Read initial states from localStorage or use defaults
    const getInitialState = (key, defaultVal) => {
        try {
            const item = window.localStorage.getItem(key);
            // Re-parse array values if they were stored as stringified arrays
            if (item) {
                try {
                    const parsed = JSON.parse(item);
                    return parsed;
                } catch {
                    return item; // Fallback to plain string if it wasn't JSON
                }
            }
        } catch (error) {
            console.error(`Error reading ${key} from localStorage`, error);
        }
        return defaultVal;
    };

    // Channel state
    const [channels] = useState(["All", "Ecom", "ModernTrade"]);
    const [selectedChannel, setSelectedChannel] = useState(() => getInitialState("filter_selectedChannel", "Ecom"));

    // Platform state
    const [platforms, setPlatforms] = useState(FALLBACK_PLATFORMS);
    const [platform, setPlatform] = useState(() => getInitialState("filter_platform", "All"));

    // A ref to always hold the latest platform value without causing re-renders
    const platformRef = useRef(platform);
    useEffect(() => { platformRef.current = platform; }, [platform]);

    // Brand state
    const [brands, setBrands] = useState(FALLBACK_BRANDS);
    const [selectedBrand, setSelectedBrand] = useState(() => getInitialState("filter_selectedBrand", "Colgate"));

    // Location state
    const [locations, setLocations] = useState(FALLBACK_LOCATIONS);
    const [selectedLocation, setSelectedLocation] = useState(() => getInitialState("filter_selectedLocation", "All"));

    // Keyword state (for visibility analysis)
    const [keywords, setKeywords] = useState(["vanilla", "chocolate", "strawberry", "butterscotch", "mango"]);
    const [selectedKeyword, setSelectedKeyword] = useState(() => getInitialState("filter_selectedKeyword", "vanilla"));

    // Category state
    const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
    const [selectedCategory, setSelectedCategory] = useState(() => getInitialState("filter_selectedCategory", "All"));

    // Write state changes to localStorage
    useEffect(() => {
        const setLocal = (key, val) => {
            try {
                window.localStorage.setItem(key, typeof val === 'object' ? JSON.stringify(val) : val);
            } catch (err) {
                console.error(`Error saving ${key} to localStorage`, err);
            }
        };
        setLocal("filter_selectedChannel", selectedChannel);
        setLocal("filter_platform", platform);
        setLocal("filter_selectedBrand", selectedBrand);
        setLocal("filter_selectedLocation", selectedLocation);
        setLocal("filter_selectedKeyword", selectedKeyword);
        setLocal("filter_selectedCategory", selectedCategory);
    }, [selectedChannel, platform, selectedBrand, selectedLocation, selectedKeyword, selectedCategory]);

    // Date Ranges
    const [timeStart, setTimeStart] = useState(dayjs().startOf('month'));
    const [timeEnd, setTimeEnd] = useState(dayjs());
    const [compareStart, setCompareStart] = useState(dayjs().subtract(1, 'month').startOf('month'));
    const [compareEnd, setCompareEnd] = useState(dayjs().subtract(1, 'month'));
    const [comparisonLabel, setComparisonLabel] = useState("VS PREV. PERIOD");

    // Tracks if async data is loaded
    const [datesFetched, setDatesFetched] = useState(false);
    const [platformsFetched, setPlatformsFetched] = useState(false);

    const datesInitialized = Boolean(timeStart && timeEnd);

    // Track hash changes since FilterProvider is rendering outside the Router tree
    const [isPricing, setIsPricing] = useState(() => window.location.hash.includes('/pricing'));
    useEffect(() => {
        const handleHashChange = () => {
            setIsPricing(window.location.hash.includes('/pricing'));
        };
        window.addEventListener('hashchange', handleHashChange);
        window.addEventListener('popstate', handleHashChange);
        return () => {
            window.removeEventListener('hashchange', handleHashChange);
            window.removeEventListener('popstate', handleHashChange);
        };
    }, []);

    // ====== FETCH LATEST DATES FROM DB (on mount) ======
    useEffect(() => {
        const fetchDates = async () => {
            try {
                const res = await axiosInstance.get('/watchtower/latest-available-month');
                if (res.data && res.data.available && res.data.defaultEndDate && res.data.defaultStartDate) {
                    const lEnd = dayjs(res.data.defaultEndDate);
                    const lStart = dayjs(res.data.defaultStartDate);

                    setTimeEnd(lEnd);
                    setTimeStart(lStart);

                    // Simple Previous period comparison
                    setCompareEnd(lEnd.subtract(1, 'month').endOf('month'));
                    setCompareStart(lStart.subtract(1, 'month').startOf('month'));

                    console.log("[FilterContext] Fetched dynamic dates:", res.data.defaultStartDate, "to", res.data.defaultEndDate);
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch latest dates:", err.message);
            } finally {
                setDatesFetched(true);
            }
        };
        fetchDates();
    }, []);

    // ====== FETCH PLATFORMS FROM DB (on mount or when isPricing changes) ======
    const fetchPlatformsFromDb = useCallback(async () => {
        try {
            const res = await axiosInstance.get("/watchtower/platforms", {
                params: { source: isPricing ? 'pricing' : undefined }
            });
            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                console.log("[FilterContext] Fetched platforms from DB:", res.data);
                setPlatforms(res.data);
                // Use the ref to read current platform without creating a dependency
                const currentPlatform = platformRef.current;
                if (currentPlatform !== "All") {
                    const currentList = Array.isArray(currentPlatform) ? currentPlatform : [currentPlatform];
                    const validPlatforms = currentList.filter(p => res.data.includes(p));
                    if (validPlatforms.length === 0) {
                        setPlatform("All");
                    } else if (validPlatforms.length === res.data.length) {
                        setPlatform("All");
                    } else {
                        setPlatform(validPlatforms.length === 1 ? validPlatforms[0] : validPlatforms);
                    }
                }
            }
        } catch (err) {
            console.warn("[FilterContext] Failed to fetch platforms, using fallback:", err.message);
        } finally {
            setPlatformsFetched(true);
        }
    }, [isPricing]); // Removed 'platform' — use platformRef instead to avoid infinite loop

    useEffect(() => {
        fetchPlatformsFromDb();
    }, [fetchPlatformsFromDb]);

    // refreshFilters — can be called by child components to re-fetch filter options
    const refreshFilters = useCallback(() => {
        fetchPlatformsFromDb();
    }, [fetchPlatformsFromDb]);

    // Update platforms list when channel changes (filter the DB platforms by channel mapping)
    useEffect(() => {
        const filterPlatformsByChannel = async () => {
            if (selectedChannel === "All") {
                // Fetch all platforms from DB
                try {
                    const res = await axiosInstance.get("/watchtower/platforms", {
                        params: { source: isPricing ? 'pricing' : undefined }
                    });
                    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                        setPlatforms(res.data);
                        setPlatform(prev => {
                            if (prev === "All") return prev;
                            const currentList = Array.isArray(prev) ? prev : [prev];
                            const validItems = currentList.filter(p => res.data.includes(p));
                            if (validItems.length === 0) return "All";
                            return validItems.length === 1 ? validItems[0] : validItems;
                        });
                        return;
                    }
                } catch (err) {
                    console.warn("[FilterContext] Failed to fetch platforms on channel change:", err.message);
                }
                // Fallback
                const allFallback = [...channelPlatformMap["Ecom"], ...channelPlatformMap["ModernTrade"]];
                setPlatforms(allFallback);
                setPlatform(prev => {
                    if (prev === "All") return prev;
                    const currentList = Array.isArray(prev) ? prev : [prev];
                    const validItems = currentList.filter(p => allFallback.includes(p));
                    if (validItems.length === 0) return "All";
                    return validItems.length === 1 ? validItems[0] : validItems;
                });
            } else {
                const channelFallback = channelPlatformMap[selectedChannel] || [];
                // Fetch from DB and filter by channel mapping
                try {
                    const res = await axiosInstance.get("/watchtower/platforms", {
                        params: { source: isPricing ? 'pricing' : undefined }
                    });
                    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                        // Intersect DB platforms with channel mapping
                        const channelPlatforms = res.data.filter(p => channelFallback.includes(p));
                        const finalPlatforms = channelPlatforms.length > 0 ? channelPlatforms : channelFallback;
                        setPlatforms(finalPlatforms);

                        // If current platform selection isn't in finalPlatforms, set to All or intersect
                        setPlatform(prev => {
                            if (prev === "All") return prev;
                            const currentList = Array.isArray(prev) ? prev : [prev];
                            const validPlatforms = currentList.filter(p => finalPlatforms.includes(p));
                            if (validPlatforms.length === 0 || validPlatforms.length === finalPlatforms.length) {
                                return "All";
                            }
                            return validPlatforms.length === 1 ? validPlatforms[0] : validPlatforms;
                        });
                        return;
                    }
                } catch (err) {
                    console.warn("[FilterContext] Failed to fetch platforms on channel change:", err.message);
                }
                // Fallback to static
                setPlatforms(channelFallback);
                setPlatform(prev => {
                    if (prev === "All") return prev;
                    const currentList = Array.isArray(prev) ? prev : [prev];
                    const validPlatforms = currentList.filter(p => channelFallback.includes(p));
                    if (validPlatforms.length === 0) return "All";
                    return validPlatforms.length === 1 ? validPlatforms[0] : validPlatforms;
                });
            }
        };
        filterPlatformsByChannel();
    }, [selectedChannel, isPricing]);

    // ====== FETCH CATEGORIES FROM DB (when platform changes) ======
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await axiosInstance.get("/watchtower/categories", {
                    params: {
                        platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform),
                        source: isPricing ? 'pricing' : undefined
                    }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched categories from DB:", res.data);
                    const cats = ["All", ...res.data.filter(c => c !== "All")];
                    setCategories(cats);
                    // Keep current selection if still valid, otherwise reset to "All"
                    setSelectedCategory(prev => {
                        if (prev === "All") return prev;
                        const currentList = Array.isArray(prev) ? prev : [prev];
                        const validItems = currentList.filter(c => cats.includes(c));
                        if (validItems.length === 0 || validItems.length === cats.length - 1) return "All";
                        return validItems.length === 1 ? validItems[0] : validItems;
                    });
                } else {
                    setCategories(FALLBACK_CATEGORIES);
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch categories, using fallback:", err.message);
                setCategories(FALLBACK_CATEGORIES);
            }
        };
        fetchCategories();
    }, [platform, isPricing]);

    // ====== FETCH LOCATIONS FROM DB (when platform changes) ======
    useEffect(() => {
        const fetchLocations = async () => {
            try {
                const res = await axiosInstance.get("/watchtower/locations", {
                    params: {
                        platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform),
                        source: isPricing ? 'pricing' : undefined
                    }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched locations from DB:", res.data);
                    const locs = ["All", ...res.data.filter(l => l !== "All")];
                    setLocations(locs);
                    // Keep current selection if still valid, otherwise reset to "All"
                    setSelectedLocation(prev => {
                        if (prev === "All") return prev;
                        const currentList = Array.isArray(prev) ? prev : [prev];
                        const validItems = currentList.filter(l => locs.includes(l));
                        if (validItems.length === 0 || validItems.length === locs.length - 1) return "All";
                        return validItems.length === 1 ? validItems[0] : validItems;
                    });
                } else {
                    setLocations(FALLBACK_LOCATIONS);
                    setSelectedLocation("All");
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch locations, using fallback:", err.message);
                setLocations(FALLBACK_LOCATIONS);
                setSelectedLocation("All");
            }
        };
        fetchLocations();
    }, [platform, isPricing]);

    // ====== FETCH BRANDS FROM DB (when platform changes) ======
    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const res = await axiosInstance.get("/watchtower/brands", {
                    params: {
                        platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform),
                        source: isPricing ? 'pricing' : undefined
                    }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched brands from DB:", res.data);
                    const brs = ["All", ...res.data.filter(b => b !== "All")];
                    setBrands(brs);
                    // Keep current selection if still valid, otherwise reset to "All"
                    setSelectedBrand(prev => {
                        if (prev === "All") return prev;
                        const currentList = Array.isArray(prev) ? prev : [prev];
                        const validItems = currentList.filter(b => brs.includes(b));
                        if (validItems.length === 0 || validItems.length === brs.length - 1) return "All";
                        return validItems.length === 1 ? validItems[0] : validItems;
                    });
                } else {
                    setBrands(FALLBACK_BRANDS);
                    setSelectedBrand("All"); // Reset if no brands
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch brands, using fallback:", err.message);
                setBrands(FALLBACK_BRANDS);
                setSelectedBrand("All"); // Reset if error
            }
        };
        fetchBrands();
    }, [platform, isPricing]); // Removed 'selectedBrand' from dependencies as setSelectedBrand uses prev callback

    return (
        <FilterContext.Provider value={{
            channels,
            selectedChannel,
            setSelectedChannel,
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
            comparisonLabel,
            setComparisonLabel,
            categories,
            selectedCategory,
            setSelectedCategory,
            datesInitialized,
            datesFetched,
            platformsFetched,
            refreshFilters
        }}>
            {children}
        </FilterContext.Provider>
    );
};
