import React, { createContext, useState, useEffect, useCallback } from "react";
import axiosInstance from "../api/axiosInstance";
import dayjs from "dayjs";

export const FilterContext = createContext();

// Static fallback data (used if API is unreachable)
const FALLBACK_PLATFORMS = ["Blinkit", "Zepto", "Instamart", "Flipkart", "Amazon"];
const FALLBACK_CATEGORIES = ["All", "Cassata", "Core Tub", "Cup", "Sandwich"];
const FALLBACK_LOCATIONS = ["All"];
const FALLBACK_BRANDS = ["Kwality Walls", "Cornetto", "Magnum", "Feast", "Twister"];

// Channel → platform mapping (static, channels are not in rca_sku_dim)
const channelPlatformMap = {
    "Ecom": ["Blinkit", "Zepto", "Instamart", "Flipkart", "Amazon"],
    "ModernTrade": ["Reliance Fresh", "Big Bazaar", "DMart"]
};


export const FilterProvider = ({ children }) => {
    // Channel state
    const [channels] = useState(["All", "Ecom", "ModernTrade"]);
    const [selectedChannel, setSelectedChannel] = useState("Ecom");

    // Platform state
    const [platforms, setPlatforms] = useState(FALLBACK_PLATFORMS);
    const [platform, setPlatform] = useState("All");

    // Brand state
    const [brands, setBrands] = useState(FALLBACK_BRANDS);
    const [selectedBrand, setSelectedBrand] = useState(null);

    // Location state
    const [locations, setLocations] = useState(FALLBACK_LOCATIONS);
    const [selectedLocation, setSelectedLocation] = useState("All");

    // Keyword state (for visibility analysis)
    const [keywords, setKeywords] = useState(["vanilla", "chocolate", "strawberry", "butterscotch", "mango"]);
    const [selectedKeyword, setSelectedKeyword] = useState("vanilla");

    // Category state
    const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
    const [selectedCategory, setSelectedCategory] = useState("All");

    // Date Ranges
    const [timeStart, setTimeStart] = useState(dayjs("2025-10-01"));
    const [timeEnd, setTimeEnd] = useState(dayjs("2025-10-06"));
    const [compareStart, setCompareStart] = useState(dayjs("2025-09-01"));
    const [compareEnd, setCompareEnd] = useState(dayjs("2025-09-06"));
    const [comparisonLabel, setComparisonLabel] = useState("VS PREV. 30 DAYS");

    // Dates are always initialized since they have defaults above
    const datesInitialized = Boolean(timeStart && timeEnd);

    // ====== FETCH PLATFORMS FROM DB (on mount) ======
    const fetchPlatformsFromDb = useCallback(async () => {
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
                const allFallback = [...channelPlatformMap["Ecom"], ...channelPlatformMap["ModernTrade"]];
                setPlatforms(allFallback);
                if (platform !== "All") {
                    const currentList = Array.isArray(platform) ? platform : [platform];
                    const validPlatforms = currentList.filter(p => allFallback.includes(p));
                    if (validPlatforms.length === 0) setPlatform("All");
                }
            } else {
                const channelFallback = channelPlatformMap[selectedChannel] || [];
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
            try {
                const res = await axiosInstance.get("/watchtower/categories", {
                    params: { platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform) }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched categories from DB:", res.data);
                    const cats = ["All", ...res.data.filter(c => c !== "All")];
                    setCategories(cats);
                    // Keep current selection if still valid, otherwise reset to "All"
                    if (selectedCategory !== "All" && !cats.includes(selectedCategory)) {
                        setSelectedCategory("All");
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
            try {
                const res = await axiosInstance.get("/watchtower/locations", {
                    params: { platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform) }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched locations from DB:", res.data);
                    const locs = ["All", ...res.data.filter(l => l !== "All")];
                    setLocations(locs);
                    // Keep current selection if still valid, otherwise reset to "All"
                    if (selectedLocation !== "All" && !locs.includes(selectedLocation)) {
                        setSelectedLocation("All");
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
            try {
                const res = await axiosInstance.get("/watchtower/brands", {
                    params: { platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform) }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched brands from DB:", res.data);
                    setBrands(res.data);
                    // Auto-select first brand if current not in list
                    if (!res.data.includes(selectedBrand)) {
                        setSelectedBrand(res.data[0]);
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
            refreshFilters
        }}>
            {children}
        </FilterContext.Provider>
    );
};
