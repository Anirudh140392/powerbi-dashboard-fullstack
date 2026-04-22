import React, { createContext, useState, useEffect, useCallback } from "react";
import axiosInstance from "../api/axiosInstance";
import dayjs from "dayjs";
import { useAuth } from "./AuthContext";

export const FilterContext = createContext();

// Context ready states so children know when async data has loaded
export const initialContextLoaded = (ctx) => ctx.datesFetched && ctx.platformsFetched;


// Static fallback data (used if API is unreachable)
const FALLBACK_PLATFORMS = ["Blinkit", "Zepto", "Instamart"];
const FALLBACK_CATEGORIES = ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"];
const FALLBACK_LOCATIONS = [];
const FALLBACK_BRANDS = [];
const FALLBACK_CHANNELS = ["Ecom", "ModernTrade"];

export const FilterProvider = ({ children }) => {
    const { isLoggedIn } = useAuth();
    // Check if user is logged in (has a valid token) before making API calls
    const isAuthenticated = isLoggedIn || !!sessionStorage.getItem('token');

    // Channel state (fetched dynamically from rca_sku_dim)
    const [channels, setChannels] = useState(FALLBACK_CHANNELS);
    const [selectedChannel, setSelectedChannel] = useState("All");

    // Platform state
    const [platforms, setPlatforms] = useState(FALLBACK_PLATFORMS);
    const [platform, setPlatform] = useState("All");

    // Brand state
    const [brands, setBrands] = useState(FALLBACK_BRANDS);
    const [selectedBrand, setSelectedBrand] = useState("All");

    // Location state
    const [locations, setLocations] = useState(FALLBACK_LOCATIONS);
    const [selectedLocation, setSelectedLocation] = useState("All");

    // Additional Location Filters
    const [zones, setZones] = useState([]);
    const [selectedZone, setSelectedZone] = useState("All");
    const [metroFlags, setMetroFlags] = useState([]);
    const [selectedMetroFlag, setSelectedMetroFlag] = useState("All");
    const [pincodes, setPincodes] = useState([]);
    const [selectedPincode, setSelectedPincode] = useState("All");

    // Keyword state (for visibility analysis) - fetched dynamically from rb_kw_olap
    const [keywords, setKeywords] = useState([]);
    const [selectedKeyword, setSelectedKeyword] = useState(["All"]);

    // Keyword Type state (for visibility analysis) - fetched dynamically from rb_pm_olap
    const [keywordTypes, setKeywordTypes] = useState([]);
    const [selectedKeywordType, setSelectedKeywordType] = useState(["All"]);

    // Category state (from rca_sku_dim)
    const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
    const [visibilityCategories, setVisibilityCategories] = useState(FALLBACK_CATEGORIES);
    const [selectedCategory, setSelectedCategory] = useState("All");

    // Product Category state (from rb_pdp_olap)
    const [productCategories, setProductCategories] = useState([]);
    const [selectedProductCategory, setSelectedProductCategory] = useState("All");
    const [productCategoriesFetched, setProductCategoriesFetched] = useState(false);

    // Date Ranges
    const [timeStart, setTimeStart] = useState(dayjs().startOf('month'));
    const [timeEnd, setTimeEnd] = useState(dayjs());
    const [compareStart, setCompareStart] = useState(dayjs().subtract(1, 'month').startOf('month'));
    const [compareEnd, setCompareEnd] = useState(dayjs().subtract(1, 'month'));
    const [comparisonLabel, setComparisonLabel] = useState("VS PREV. PERIOD");
    const [maxDate, setMaxDate] = useState(dayjs());

    // Tracks if async data is loaded
    const [datesFetched, setDatesFetched] = useState(false);
    const [platformsFetched, setPlatformsFetched] = useState(false);

    // Content-specific filter mode (hides category filter on Content Analysis page)
    const [contentFilterMode, setContentFilterMode] = useState(false);

    // Visibility-specific segment toggle (My SKUs vs All SKUs)
    const [visibilityOwnBrandsOnly, setVisibilityOwnBrandsOnly] = useState(true);

    // SOS / BSR toggle mode
    const [visibilityMode, setVisibilityMode] = useState('sos');

    // Track current hash to detect page changes
    const [currentHash, setCurrentHash] = useState(window.location.hash);

    useEffect(() => {
        const handleHashChange = () => {
            console.log("[FilterContext] Hash changed to:", window.location.hash);
            setCurrentHash(window.location.hash);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const datesInitialized = Boolean(timeStart && timeEnd);

    // ====== RESET STATE ON LOGOUT ======
    useEffect(() => {
        if (!isAuthenticated) {
            console.log("[FilterContext] Resetting state due to logout");
            setChannels(FALLBACK_CHANNELS);
            setSelectedChannel("All");
            setPlatforms(FALLBACK_PLATFORMS);
            setPlatform("All");
            setBrands(FALLBACK_BRANDS);
            setSelectedBrand("All");
            setLocations(FALLBACK_LOCATIONS);
            setSelectedLocation("All");
            setZones([]);
            setSelectedZone("All");
            setMetroFlags([]);
            setSelectedMetroFlag("All");
            setPincodes([]);
            setSelectedPincode("All");
            setKeywords([]);
            setSelectedKeyword(["All"]);
            setKeywordTypes([]);
            setSelectedKeywordType(["All"]);
            setCategories(FALLBACK_CATEGORIES);
            setVisibilityCategories(FALLBACK_CATEGORIES);
            setSelectedCategory("All");
            setProductCategories([]);
            setSelectedProductCategory("All");
            setPlatformsFetched(false);
            setVisibilityOwnBrandsOnly(true);
            setVisibilityMode('sos');
        }
    }, [isAuthenticated]);

    // ====== FETCH LATEST DATES FROM DB (on mount and hash change) ======
    const refreshDates = useCallback(async () => {
        if (!isAuthenticated) return;

        setDatesFetched(false);
        try {
            // Use window.location.hash directly to ensure it has the latest path on mount
            const isMarketShare = window.location.hash.includes('/market-share');
            const endpoint = isMarketShare ? '/market-share/latest-date' : '/watchtower/latest-available-month';
            
            console.log(`[FilterContext] Fetching basic dates from ${endpoint}...`);
            const res = await axiosInstance.get(endpoint);
            if (res.data && res.data.available && res.data.defaultEndDate && res.data.defaultStartDate) {
                const lEnd = dayjs(res.data.defaultEndDate);
                const lStart = dayjs(res.data.defaultStartDate);

                setTimeEnd(lEnd);
                setTimeStart(lStart);
                setMaxDate(lEnd);

                // Simple Previous period comparison
                setCompareEnd(lEnd.subtract(1, 'month').endOf('month'));
                setCompareStart(lStart.subtract(1, 'month').startOf('month'));

                console.log(`[FilterContext] Fetched dynamic dates for ${isMarketShare ? 'Market Share' : 'Watchtower'}:`, res.data.defaultStartDate, "to", res.data.defaultEndDate);
            }
        } catch (err) {
            console.warn("[FilterContext] Failed to fetch latest dates:", err.message);
        } finally {
            setDatesFetched(true);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        refreshDates();
    }, [refreshDates, currentHash]);

    // ====== FETCH CHANNELS FROM DB (on mount) ======
    useEffect(() => {
        const fetchChannels = async () => {
            if (!isAuthenticated) return;
            try {
                const res = await axiosInstance.get("/watchtower/channels");
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched channels from DB:", res.data);
                    setChannels(res.data);
                    // Keep current selection if still valid, otherwise select first
                    setSelectedChannel(prev => {
                        if (prev === 'All') return 'All'; // Always keep "All" as valid
                        if (res.data.includes(prev)) return prev;
                        return 'All'; // Default to All instead of first channel
                    });
                } else {
                    setChannels(FALLBACK_CHANNELS);
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch channels, using fallback:", err.message);
                setChannels(FALLBACK_CHANNELS);
            }
        };
        fetchChannels();
    }, [isAuthenticated]);

    // ====== FETCH PLATFORMS FROM DB (based on channel) ======
    const fetchPlatformsFromDb = useCallback(async () => {
        if (!isAuthenticated) return;

        setPlatformsFetched(false);
        try {
            // If we are on the Market Share page, fetch all top filters from rb_ms_olap
            const isMarketShare = window.location.hash.includes('/market-share');

            if (isMarketShare) {
                console.log("[FilterContext] Fetching Market Share top filters from rb_ms_olap...");
                const res = await axiosInstance.get("/market-share/top-filter-options");
                if (res.data) {
                    const newPlatforms = res.data.platforms || [];
                    const newCategories = res.data.categories || [];
                    const newChannels = res.data.channels || [];
                    const newLocations = res.data.locations || [];

                    if (newPlatforms.length > 0) setPlatforms(newPlatforms);
                    if (newCategories.length > 0) setCategories(newCategories);
                    if (newChannels.length > 0) setChannels(newChannels);
                    if (newLocations.length > 0) setLocations(newLocations);

                    // Validate current platform selection
                    setPlatform(prev => {
                        if (prev === "All") return "All";
                        const currentList = Array.isArray(prev) ? prev : [prev];
                        const valid = currentList.filter(p => newPlatforms.includes(p));
                        if (valid.length === 0) return "All";
                        return valid.length === 1 ? valid[0] : valid;
                    });

                    // Validate current category selection
                    setSelectedCategory(prev => {
                        if (prev === "All") return "All";
                        const currentList = Array.isArray(prev) ? prev : [prev];
                        const valid = currentList.filter(c => newCategories.includes(c));
                        if (valid.length === 0) return "All";
                        return valid.length === 1 ? valid[0] : valid;
                    });

                    // Validate current location selection
                    setSelectedLocation(prev => {
                        if (prev === "All") return "All";
                        const currentList = Array.isArray(prev) ? prev : [prev];
                        const valid = currentList.filter(l => newLocations.includes(l));
                        if (valid.length === 0) return "All";
                        return valid.length === 1 ? valid[0] : valid;
                    });
                }
            } else if (window.location.hash.includes('/content-analysis')) {
                const res = await axiosInstance.get("/content-analysis/platforms");
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched dynamic platforms from Content Analysis:", res.data);
                    setPlatforms(res.data);
                    // Keep "All" or current selection if it's still valid
                    setPlatform(prevPlatform => {
                        if (prevPlatform === "All") return "All";
                        const currentList = Array.isArray(prevPlatform) ? prevPlatform : [prevPlatform];
                        const validPlatforms = currentList.filter(p => res.data.includes(p));
                        if (validPlatforms.length === 0) return "All";
                        if (validPlatforms.length === res.data.length) return "All";
                        return validPlatforms.length === 1 ? validPlatforms[0] : validPlatforms;
                    });
                } else {
                    setPlatforms(FALLBACK_PLATFORMS);
                    setPlatform("All");
                }
            } else {
                const res = await axiosInstance.get("/watchtower/platforms", {
                    params: { channel: selectedChannel === "All" ? undefined : selectedChannel }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched dynamic platforms from Watchtower:", res.data);
                    setPlatforms(res.data);
                    // Keep "All" or current selection if it's still valid
                    setPlatform(prevPlatform => {
                        if (prevPlatform === "All") return "All";
                        const currentList = Array.isArray(prevPlatform) ? prevPlatform : [prevPlatform];
                        const validPlatforms = currentList.filter(p => res.data.includes(p));
                        if (validPlatforms.length === 0) return "All";
                        if (validPlatforms.length === res.data.length) return "All";
                        return validPlatforms.length === 1 ? validPlatforms[0] : validPlatforms;
                    });
                } else {
                    setPlatforms(FALLBACK_PLATFORMS);
                    setPlatform("All");
                }
            }
        } catch (err) {
            console.warn("[FilterContext] Failed to fetch dynamic platforms, using fallback:", err.message);
            // Fallbacks are set in individual effects or on mount
        } finally {
            setPlatformsFetched(true);
        }
    }, [isAuthenticated, selectedChannel]);

    useEffect(() => {
        fetchPlatformsFromDb();
    }, [fetchPlatformsFromDb, currentHash]);

    // refreshFilters — can be called by child components to re-fetch filter options
    const refreshFilters = useCallback(() => {
        fetchPlatformsFromDb();
    }, [fetchPlatformsFromDb]);

    // ====== FETCH CATEGORIES & BRANDS FROM DB (when platform changes) ======
    useEffect(() => {
        const fetchCategories = async () => {
            if (!isAuthenticated) return;
            // Skip generic category fetch if on Market Share page
            if (window.location.hash.includes('/market-share')) return;
            try {
                const res = await axiosInstance.get("/watchtower/categories", {
                    params: { platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform) }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched categories from DB:", res.data);
                    const cats = [...res.data.filter(c => c !== "All")];
                    setCategories(cats);
                    // Keep current selection if still valid, otherwise reset to "All"
                    setSelectedCategory(prevCat => {
                        if (prevCat === "All") return "All";
                        const currentList = Array.isArray(prevCat) ? prevCat : [prevCat];
                        const validList = currentList.filter(c => cats.includes(c));
                        if (validList.length === 0) return "All";
                        if (validList.length === cats.length) return "All";
                        return validList.length === 1 ? validList[0] : validList;
                    });
                } else {
                    setCategories(FALLBACK_CATEGORIES);
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch categories, using fallback:", err.message);
                setCategories(FALLBACK_CATEGORIES);
            }
        };

        const fetchVisibilityCategories = async () => {
            if (!isAuthenticated) return;
            // Skip generic category fetch if on Market Share page
            if (window.location.hash.includes('/market-share')) return;
            try {
                const res = await axiosInstance.get("/visibility-analysis/categories", {
                    params: { platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform) }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    const cats = [...res.data.filter(c => c !== "All")];
                    setVisibilityCategories(cats);
                } else {
                    setVisibilityCategories(FALLBACK_CATEGORIES);
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch visibility categories:", err.message);
                setVisibilityCategories(FALLBACK_CATEGORIES);
            }
        };

        fetchCategories();
        fetchVisibilityCategories();
    }, [platform, isAuthenticated]);

    // ====== FETCH PRODUCT CATEGORIES FROM DB (when platform or brand changes) ======
    useEffect(() => {
        const fetchProductCategories = async () => {
            if (!isAuthenticated) return;
            setProductCategoriesFetched(false);
            try {
                const res = await axiosInstance.get("/watchtower/product-categories", {
                    params: {
                        platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform),
                        brand: selectedBrand === "All" ? undefined : (Array.isArray(selectedBrand) ? selectedBrand.join(",") : selectedBrand)
                    }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched product categories from DB:", res.data);
                    const cats = [...res.data.filter(c => c !== "All")];
                    setProductCategories(cats);
                    // Keep current selection if valid, otherwise reset
                    setSelectedProductCategory(prevCat => {
                        if (prevCat !== "All") {
                            const currentList = Array.isArray(prevCat) ? prevCat : [prevCat];
                            const validList = currentList.filter(c => cats.includes(c));
                            if (validList.length === 0) return "All";
                            if (validList.length === cats.length) return "All";
                            return validList.length === 1 ? validList[0] : validList;
                        }
                        return prevCat;
                    });
                } else {
                    setProductCategories([]);
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch product categories:", err.message);
                setProductCategories([]);
            } finally {
                setProductCategoriesFetched(true);
            }
        };
        fetchProductCategories();
    }, [platform, selectedBrand, isAuthenticated]);

    // ====== FETCH LOCATIONS FROM DB (when platform changes) ======
    useEffect(() => {
        const fetchLocations = async () => {
            if (!isAuthenticated) return;
            // Skip generic location fetch if on Market Share page
            if (window.location.hash.includes('/market-share')) return;
            try {
                const res = await axiosInstance.get("/watchtower/locations", {
                    params: { platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform) }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched locations from DB:", res.data);
                    const locs = [...res.data.filter(l => l !== "All")];
                    setLocations(locs);
                    // Keep current selection if still valid, otherwise reset to "All"
                    setSelectedLocation(prevLoc => {
                        if (prevLoc !== "All") {
                            const currentList = Array.isArray(prevLoc) ? prevLoc : [prevLoc];
                            const validList = currentList.filter(l => locs.includes(l));
                            if (validList.length === 0) return "All";
                            if (validList.length === locs.length) return "All";
                            return validList.length === 1 ? validList[0] : validList;
                        }
                        return prevLoc;
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
    }, [platform, isAuthenticated]);

    // ====== FETCH BRANDS FROM DB (when platform changes) ======
    useEffect(() => {
        const fetchBrands = async () => {
            if (!isAuthenticated) return;
            // Skip generic brand fetch if on Market Share page
            if (window.location.hash.includes('/market-share')) return;
            try {
                const res = await axiosInstance.get("/watchtower/brands", {
                    params: { platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform) }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched brands from DB:", res.data);
                    setBrands(res.data);
                    // Auto-select first brand if current not in list
                    setSelectedBrand(prevBrand => {
                        if (prevBrand !== "All") {
                            const currentList = Array.isArray(prevBrand) ? prevBrand : [prevBrand];
                            const validList = currentList.filter(b => res.data.includes(b));
                            if (validList.length === 0) {
                                return res.data[0]; // fallback to first valid brand
                            } else {
                                return validList.length === 1 ? validList[0] : validList;
                            }
                        }
                        return prevBrand;
                    });
                } else {
                    setBrands(FALLBACK_BRANDS);
                    setSelectedBrand(FALLBACK_BRANDS[0]);
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch brands, using fallback:", err.message);
                setBrands(FALLBACK_BRANDS);
                setSelectedBrand("All");
            }
        };
        fetchBrands();
    }, [platform, isAuthenticated]);

    // ====== FETCH KEYWORDS FROM DB (when platform or category changes) ======
    useEffect(() => {
        const fetchKeywords = async () => {
            if (!isAuthenticated) return;

            try {
                const params = {
                    platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform),
                    category: selectedCategory === "All" ? undefined : (Array.isArray(selectedCategory) ? selectedCategory.join(",") : selectedCategory),
                    ownBrandsOnly: visibilityOwnBrandsOnly
                };

                console.log("[FilterContext] Fetching keywords with params:", params);
                const res = await axiosInstance.get("/visibility-analysis/keywords", { params });

                if (res.data && Array.isArray(res.data)) {
                    const fetchedKeywords = res.data.filter(k => k !== "All");
                    setKeywords(fetchedKeywords);

                    // Validate current selections against new list
                    setSelectedKeyword(prev => {
                        if (prev.includes("All")) return ["All"];
                        const valid = prev.filter(k => fetchedKeywords.includes(k));
                        return valid.length > 0 ? valid : ["All"];
                    });
                } else {
                    setKeywords([]);
                }
            } catch (err) {
                console.error("[FilterContext] Failed to fetch keywords:", err);
                setKeywords([]);
            }
        };

        fetchKeywords();
    }, [isAuthenticated, platform, selectedCategory, visibilityOwnBrandsOnly]);

    // ====== FETCH KEYWORD TYPES FROM DB (when platform changes) ======
    useEffect(() => {
        const fetchKeywordTypes = async () => {
            if (!isAuthenticated) return;

            try {
                const params = {
                    platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform)
                };

                console.log("[FilterContext] Fetching keyword types with params:", params);
                const res = await axiosInstance.get("/visibility-analysis/keyword-types", { params });

                if (res.data && Array.isArray(res.data)) {
                    const fetchedKeywordTypes = res.data.filter(k => k !== "All");
                    setKeywordTypes(fetchedKeywordTypes);

                    // Validate current selections against new list
                    setSelectedKeywordType(prev => {
                        if (prev.includes("All")) return ["All"];
                        const valid = prev.filter(k => fetchedKeywordTypes.includes(k));
                        return valid.length > 0 ? valid : ["All"];
                    });
                } else {
                    setKeywordTypes([]);
                }
            } catch (err) {
                console.error("[FilterContext] Failed to fetch keyword types:", err);
                setKeywordTypes([]);
            }
        };

        fetchKeywordTypes();
    }, [isAuthenticated, platform]);

    return (
        <FilterContext.Provider value={{
            channels,
            setChannels,
            selectedChannel,
            setSelectedChannel,
            brands,
            setBrands,
            selectedBrand,
            setSelectedBrand,
            keywords,
            setKeywords,
            selectedKeyword,
            setSelectedKeyword,
            keywordTypes,
            setKeywordTypes,
            selectedKeywordType,
            setSelectedKeywordType,
            locations,
            setLocations,
            selectedLocation,
            setSelectedLocation,
            platforms,
            setPlatforms,
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
            visibilityCategories,
            setCategories,
            selectedCategory,
            setSelectedCategory,
            productCategories,
            setProductCategories,
            selectedProductCategory,
            setSelectedProductCategory,
            maxDate,
            datesInitialized,
            datesFetched,
            platformsFetched,
            refreshFilters,
            refreshDates,
            contentFilterMode,
            setContentFilterMode,
            visibilityOwnBrandsOnly,
            setVisibilityOwnBrandsOnly,
            zones,
            setZones,
            selectedZone,
            setSelectedZone,
            metroFlags,
            setMetroFlags,
            selectedMetroFlag,
            setSelectedMetroFlag,
            pincodes,
            setPincodes,
            selectedPincode,
            setSelectedPincode,
            visibilityMode,
            setVisibilityMode
        }}>
            {children}
        </FilterContext.Provider>
    );
};
