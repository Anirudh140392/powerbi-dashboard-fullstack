import React, { createContext, useState, useEffect, useCallback } from "react";
import axiosInstance from "../api/axiosInstance";
import dayjs from "dayjs";

export const FilterContext = createContext();

// Context ready states so children know when async data has loaded
export const initialContextLoaded = (ctx) => ctx.datesFetched && ctx.platformsFetched;


// Static fallback data (used if API is unreachable)
const FALLBACK_PLATFORMS = ["Blinkit", "Zepto", "Instamart"];
const FALLBACK_CATEGORIES = ["Toothpaste", "Toothbrush", "Mouthwash", "Handwash", "Bodywash"];
const FALLBACK_LOCATIONS = [];
const FALLBACK_BRANDS = ["Colgate", "Closeup", "Palmolive", "Halo"];

// Channel → platform mapping (static, channels are not in rca_sku_dim)
const channelPlatformMap = {
    "Ecom": ["Blinkit", "Zepto", "Instamart", "Flipkart", "Amazon"],
    "ModernTrade": ["Reliance Fresh", "Big Bazaar", "DMart"]
};


export const FilterProvider = ({ children }) => {
    // Check if user is logged in (has a valid token) before making API calls
    const isAuthenticated = !!localStorage.getItem('token');

    // Channel state
    const [channels] = useState(["Ecom", "ModernTrade"]);
    const [selectedChannel, setSelectedChannel] = useState("Ecom");

    // Platform state
    const [platforms, setPlatforms] = useState(FALLBACK_PLATFORMS);
    const [platform, setPlatform] = useState("All");

    // Brand state
    const [brands, setBrands] = useState(FALLBACK_BRANDS);
    const [selectedBrand, setSelectedBrand] = useState("Colgate");

    // Location state
    const [locations, setLocations] = useState(FALLBACK_LOCATIONS);
    const [selectedLocation, setSelectedLocation] = useState("All");

    // Keyword state (for visibility analysis) - fetched dynamically from rb_kw
    const [keywords, setKeywords] = useState([]);
    const [selectedKeyword, setSelectedKeyword] = useState("All");

    // Category state
    const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
    const [selectedCategory, setSelectedCategory] = useState("All");

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

    // ====== FETCH LATEST DATES FROM DB (on mount) ======
    useEffect(() => {
        const fetchDates = async () => {
            if (!isAuthenticated) {
                setDatesFetched(true);
                return;
            }
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

    // ====== FETCH PLATFORMS FROM DB (on mount) ======
    const fetchPlatformsFromDb = useCallback(async () => {
        if (!isAuthenticated) {
            setPlatformsFetched(true);
            return;
        }
        try {
            const res = await axiosInstance.get("/watchtower/platforms");
            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                console.log("[FilterContext] Fetched platforms from DB:", res.data);
                setPlatforms(res.data);
                // Keep "All" or current selection if it's still valid
                if (platform !== "All") {
                    const currentList = Array.isArray(platform) ? platform : [platform];
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
    }, [platform]);

    useEffect(() => {
        fetchPlatformsFromDb();
    }, []);

    // refreshFilters — can be called by child components to re-fetch filter options
    const refreshFilters = useCallback(() => {
        fetchPlatformsFromDb();
    }, [fetchPlatformsFromDb]);

    // Update platforms list when channel changes (filter the DB platforms by channel mapping)
    useEffect(() => {
        const filterPlatformsByChannel = async () => {
            if (!isAuthenticated) return;
            if (selectedChannel === "All") {
                // Fetch all platforms from DB
                try {
                    const res = await axiosInstance.get("/watchtower/platforms");
                    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                        setPlatforms(res.data);
                        // Reset to All if current selection is not compatible or keep All
                        if (platform !== "All") {
                            const currentList = Array.isArray(platform) ? platform : [platform];
                            const validPlatforms = currentList.filter(p => res.data.includes(p));
                            if (validPlatforms.length === 0) setPlatform("All");
                        }
                        return;
                    }
                } catch (err) {
                    console.warn("[FilterContext] Failed to fetch platforms on channel change:", err.message);
                }
                // Fallback
                const allFallback = [...new Set([...channelPlatformMap["Ecom"], ...channelPlatformMap["ModernTrade"]])];
                setPlatforms(allFallback);
                if (platform !== "All") {
                    const currentList = Array.isArray(platform) ? platform : [platform];
                    const validPlatforms = currentList.filter(p => allFallback.includes(p));
                    if (validPlatforms.length === 0) setPlatform("All");
                }
            } else {
                // Merge platforms from all selected channels
                const channelFallback = [...new Set(selectedChannels.flatMap(ch => channelPlatformMap[ch] || []))];

                // Fetch from DB and filter by channel mapping
                try {
                    const res = await axiosInstance.get("/watchtower/platforms");
                    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                        // Intersect DB platforms with channel mapping
                        const channelPlatforms = res.data.filter(p => channelFallback.includes(p));
                        const finalPlatforms = channelPlatforms.length > 0 ? channelPlatforms : channelFallback;
                        setPlatforms(finalPlatforms);

                        // If current platform selection isn't in finalPlatforms, set to All or intersect
                        if (platform !== "All") {
                            const currentList = Array.isArray(platform) ? platform : [platform];
                            const validPlatforms = currentList.filter(p => finalPlatforms.includes(p));
                            if (validPlatforms.length === 0) {
                                setPlatform("All");
                            } else if (validPlatforms.length === finalPlatforms.length) {
                                setPlatform("All");
                            } else {
                                setPlatform(validPlatforms.length === 1 ? validPlatforms[0] : validPlatforms);
                            }
                        }
                        return;
                    }
                } catch (err) {
                    console.warn("[FilterContext] Failed to fetch platforms on channel change:", err.message);
                }
                // Fallback to static
                setPlatforms(channelFallback);
                if (platform !== "All") {
                    const currentList = Array.isArray(platform) ? platform : [platform];
                    const validPlatforms = currentList.filter(p => channelFallback.includes(p));
                    if (validPlatforms.length === 0) setPlatform("All");
                }
            }
        };
        filterPlatformsByChannel();
    }, [selectedChannel]);

    // ====== FETCH CATEGORIES FROM DB (when platform changes) ======
    useEffect(() => {
        const fetchCategories = async () => {
            if (!isAuthenticated) return;
            try {
                const res = await axiosInstance.get("/watchtower/categories", {
                    params: { platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform) }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched categories from DB:", res.data);
                    const cats = [...res.data.filter(c => c !== "All")];
                    setCategories(cats);
                    // Keep current selection if still valid, otherwise reset to "All"
                    if (selectedCategory !== "All") {
                        const currentList = Array.isArray(selectedCategory) ? selectedCategory : [selectedCategory];
                        const validList = currentList.filter(c => cats.includes(c));
                        if (validList.length === 0) {
                            setSelectedCategory("All");
                        } else if (validList.length === cats.length - 1) { // all except "All"
                            setSelectedCategory("All");
                        } else {
                            setSelectedCategory(validList.length === 1 ? validList[0] : validList);
                        }
                    }
                } else {
                    setCategories(FALLBACK_CATEGORIES);
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch categories, using fallback:", err.message);
                setCategories(FALLBACK_CATEGORIES);
            }
        };
        fetchCategories();
    }, [platform]);

    // ====== FETCH LOCATIONS FROM DB (when platform changes) ======
    useEffect(() => {
        const fetchLocations = async () => {
            if (!isAuthenticated) return;
            try {
                const res = await axiosInstance.get("/watchtower/locations", {
                    params: { platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform) }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched locations from DB:", res.data);
                    const locs = [...res.data.filter(l => l !== "All")];
                    setLocations(locs);
                    // Keep current selection if still valid, otherwise reset to "All"
                    if (selectedLocation !== "All") {
                        const currentList = Array.isArray(selectedLocation) ? selectedLocation : [selectedLocation];
                        const validList = currentList.filter(l => locs.includes(l));
                        if (validList.length === 0) {
                            setSelectedLocation("All");
                        } else if (validList.length === locs.length - 1) {
                            setSelectedLocation("All");
                        } else {
                            setSelectedLocation(validList.length === 1 ? validList[0] : validList);
                        }
                    }
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
    }, [platform]);

    // ====== FETCH BRANDS FROM DB (when platform changes) ======
    useEffect(() => {
        const fetchBrands = async () => {
            if (!isAuthenticated) return;
            try {
                const res = await axiosInstance.get("/watchtower/brands", {
                    params: { platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform) }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched brands from DB:", res.data);
                    setBrands(res.data);
                    // Auto-select first brand if current not in list
                    if (selectedBrand !== "All") {
                        const currentList = Array.isArray(selectedBrand) ? selectedBrand : [selectedBrand];
                        const validList = currentList.filter(b => res.data.includes(b));
                        if (validList.length === 0) {
                            setSelectedBrand(res.data[0]); // fallback to first valid brand
                        } else {
                            setSelectedBrand(validList.length === 1 ? validList[0] : validList);
                        }
                    }
                } else {
                    setBrands(FALLBACK_BRANDS);
                    setSelectedBrand(FALLBACK_BRANDS[0]);
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch brands, using fallback:", err.message);
                setBrands(FALLBACK_BRANDS);
                setSelectedBrand(FALLBACK_BRANDS[0]);
            }
        };
        fetchBrands();
    }, [platform]);

    // ====== FETCH KEYWORDS FROM DB (on mount) ======
    useEffect(() => {
        const fetchKeywords = async () => {
            if (!isAuthenticated) return;
            try {
                const res = await axiosInstance.get("/watchtower/keywords");
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched keywords from DB:", res.data.length, "keywords");
                    setKeywords(res.data);
                    // Keep current selection if still valid
                    if (selectedKeyword !== "All" && !res.data.includes(selectedKeyword)) {
                        setSelectedKeyword("All");
                    }
                } else {
                    setKeywords([]);
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch keywords:", err.message);
                setKeywords([]);
            }
        };
        fetchKeywords();
    }, []);

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
