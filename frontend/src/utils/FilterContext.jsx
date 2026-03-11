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
const FALLBACK_BRANDS = ["Colgate", "Closeup", "Palmolive", "Halo"];
const FALLBACK_CHANNELS = ["Ecom", "ModernTrade"];

export const FilterProvider = ({ children }) => {
    const { isLoggedIn } = useAuth();
    // Check if user is logged in (has a valid token) before making API calls
    const isAuthenticated = isLoggedIn || !!localStorage.getItem('token');

    // Channel state (fetched dynamically from rca_sku_dim)
    const [channels, setChannels] = useState(FALLBACK_CHANNELS);
    const [selectedChannel, setSelectedChannel] = useState("All");

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

    // Category state (from rca_sku_dim)
    const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
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

    // Tracks if async data is loaded
    const [datesFetched, setDatesFetched] = useState(false);
    const [platformsFetched, setPlatformsFetched] = useState(false);

    const datesInitialized = Boolean(timeStart && timeEnd);

    // ====== FETCH LATEST DATES FROM DB (on mount) ======
    useEffect(() => {
        const fetchDates = async () => {
            if (!isAuthenticated) return;

            setDatesFetched(false);
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
    }, [isAuthenticated]);

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

    // ====== FETCH PLATFORMS FROM DB (on mount) ======
    const fetchPlatformsFromDb = useCallback(async () => {
        if (!isAuthenticated) return;

        setPlatformsFetched(false);
        try {
            const res = await axiosInstance.get("/watchtower/platforms");
            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                console.log("[FilterContext] Fetched platforms from DB:", res.data);
                setPlatforms(res.data);
                // Keep "All" or current selection if it's still valid
                setPlatform(prevPlatform => {
                    if (prevPlatform !== "All") {
                        const currentList = Array.isArray(prevPlatform) ? prevPlatform : [prevPlatform];
                        const validPlatforms = currentList.filter(p => res.data.includes(p));
                        if (validPlatforms.length === 0) {
                            return "All";
                        } else if (validPlatforms.length === res.data.length) {
                            return "All";
                        } else {
                            return validPlatforms.length === 1 ? validPlatforms[0] : validPlatforms;
                        }
                    }
                    return prevPlatform;
                });
            }
        } catch (err) {
            console.warn("[FilterContext] Failed to fetch platforms, using fallback:", err.message);
        } finally {
            setPlatformsFetched(true);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        fetchPlatformsFromDb();
    }, [fetchPlatformsFromDb]);

    // refreshFilters — can be called by child components to re-fetch filter options
    const refreshFilters = useCallback(() => {
        fetchPlatformsFromDb();
    }, [fetchPlatformsFromDb]);

    // Update platforms list when channel changes (fetch from rca_sku_dim filtered by channel)
    useEffect(() => {
        const filterPlatformsByChannel = async () => {
            if (!isAuthenticated) return;
            try {
                const params = {};
                if (selectedChannel && selectedChannel !== "All") {
                    params.channel = selectedChannel;
                }
                const res = await axiosInstance.get("/watchtower/platforms", { params });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    setPlatforms(res.data);
                    // If current platform selection isn't in the new list, reset to All
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
                } else {
                    setPlatforms(FALLBACK_PLATFORMS);
                    setPlatform("All");
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch platforms on channel change:", err.message);
                setPlatforms(FALLBACK_PLATFORMS);
                setPlatform("All");
            }
        };
        filterPlatformsByChannel();
    }, [selectedChannel, isAuthenticated]);

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
                    setSelectedCategory(prevCat => {
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
                    setCategories(FALLBACK_CATEGORIES);
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch categories, using fallback:", err.message);
                setCategories(FALLBACK_CATEGORIES);
            }
        };
        fetchCategories();
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
                setSelectedBrand(FALLBACK_BRANDS[0]);
            }
        };
        fetchBrands();
    }, [platform, isAuthenticated]);

    // ====== FETCH KEYWORDS FROM DB (on mount) ======
    useEffect(() => {
        const fetchKeywords = async () => {
            if (!isAuthenticated) return;
            try {
                const params = {};
                if (selectedBrand && selectedBrand !== "All") {
                    params.brand = Array.isArray(selectedBrand) ? selectedBrand[0] : selectedBrand;
                }
                const res = await axiosInstance.get("/watchtower/keywords", { params });
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
    }, [isAuthenticated, selectedBrand]);

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
            setCategories,
            selectedCategory,
            setSelectedCategory,
            productCategories,
            setProductCategories,
            selectedProductCategory,
            setSelectedProductCategory,
            datesInitialized,
            datesFetched,
            platformsFetched,
            refreshFilters
        }}>
            {children}
        </FilterContext.Provider>
    );
};
