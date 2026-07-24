import React, { createContext, useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
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
const FALLBACK_CHANNELS = []; // Dynamic — fetched from rca_sku_dim / rb_pdp_olap on mount

export const FilterProvider = ({ children }) => {
    const { isLoggedIn } = useAuth();
    // Check if user is logged in (has a valid token) before making API calls
    const isAuthenticated = isLoggedIn || !!sessionStorage.getItem('token');

    // Channel state (fetched dynamically from rca_sku_dim)
    const [channels, setChannels] = useState(FALLBACK_CHANNELS);
    const [selectedChannel, setSelectedChannel] = useState("All");

    // Platform state
    const [platforms, setPlatforms] = useState([]);
    const [platformMetadata, setPlatformMetadata] = useState([]);
    const [platform, setPlatform] = useState("");

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

    // Sub Category state (for market share mamaearth dashboard)
    const [subCategories, setSubCategories] = useState([]);
    const [selectedSubCategory, setSelectedSubCategory] = useState("All");

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
    const [minDate, setMinDate] = useState(null);

    // Tracks if the user has manually overridden the default dates
    const [userSetDate, setUserSetDate] = useState(false);

    // Tracks if async data is loaded
    const [datesFetched, setDatesFetched] = useState(false);
    const [platformsFetched, setPlatformsFetched] = useState(false);

    // Content-specific filter mode (hides category filter on Content Analysis page)
    const [contentFilterMode, setContentFilterMode] = useState(false);

    // Visibility-specific segment toggle (My SKUs vs All SKUs)
    const [visibilityOwnBrandsOnly, setVisibilityOwnBrandsOnly] = useState(true);

    // SOS / BSR toggle mode
    const [visibilityMode, setVisibilityMode] = useState('sos');

    // Visibility rank filter (POSITION <= rank).
    const [selectedRank, setSelectedRank] = useState('Top 10');

    // MSL (Must Stock List) filter state
    const [msls, setMsls] = useState([]);
    const [selectedMsl, setSelectedMsl] = useState("All");

    // Priority Action specific filters
    const [paPriority, setPaPriority] = useState("All");
    const [paStatus, setPaStatus] = useState("All");
    const [paPlatform, setPaPlatform] = useState("All");
    const [paBrand, setPaBrand] = useState("All");
    const [paCity, setPaCity] = useState("All");
    const [paFilters, setPaFilters] = useState({
        statuses: [],
        platforms: [],
        brands: [],
        categories: [],
        cities: []
    });

    // Use react-router's useLocation instead of native hashchange for reliable route tracking
    const location = useLocation();
    
    // Track current path to detect page changes
    const [currentPath, setCurrentPath] = useState(location.pathname);

    useEffect(() => {
        console.log("[FilterContext] Path changed to:", location.pathname);
        setCurrentPath(location.pathname);
    }, [location.pathname]);

    // Race condition guard: prevents stale responses from overwriting fresh date state
    const dateRequestCounter = useRef(0);

    const datesInitialized = Boolean(timeStart && timeEnd);

    // ====== RESET STATE ON LOGOUT ======
    useEffect(() => {
        if (!isAuthenticated) {
            console.log("[FilterContext] Resetting state due to logout");
            setChannels(FALLBACK_CHANNELS);
            setSelectedChannel(FALLBACK_CHANNELS[0] || "All");
            setPlatforms([]);
            setPlatform("");
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
            setSubCategories([]);
            setSelectedSubCategory("All");
            setProductCategories([]);
            setSelectedProductCategory("All");
            setPlatformsFetched(false);
            setVisibilityOwnBrandsOnly(true);
            setVisibilityMode('sos');
            setSelectedRank('Top 10');
            setUserSetDate(false);
            setMinDate(null);
        }
    }, [isAuthenticated]);

    // ====== FETCH LATEST DATES FROM DB (on mount and hash change) ======
    // Each page gets its max date from a specific table:
    //   Market Share      → rb_ms_olap  via /market-share/latest-date
    //   Visibility Analysis → rb_kw_olap via /visibility-analysis/latest-available-dates
    //   All other pages   → rb_pdp_olap via /watchtower/latest-available-month
    const refreshDates = useCallback(async () => {
        if (!isAuthenticated) return;

        const requestId = ++dateRequestCounter.current;
        setDatesFetched(false);
        try {
            const path = currentPath;
            const isMarketShare = path.includes('/market-share');
            const isVisibility = path.includes('/visibility-anlysis');

            let endpoint;
            let pageLabel;
            if (isMarketShare) {
                endpoint = '/market-share/latest-date';
                pageLabel = 'Market Share (rb_ms_olap)';
            } else if (isVisibility) {
                endpoint = '/visibility-analysis/latest-available-dates';
                pageLabel = 'Visibility Analysis (rb_kw_olap)';
            } else {
                endpoint = '/watchtower/latest-available-month';
                pageLabel = 'Default (rb_pdp_olap)';
            }

            console.log(`[FilterContext] Fetching dates from ${endpoint} for ${pageLabel}...`);
            const res = await axiosInstance.get(endpoint);

            // Stale response guard: discard if a newer request was fired
            if (requestId !== dateRequestCounter.current) {
                console.log(`[FilterContext] Discarding stale date response (request ${requestId}, current ${dateRequestCounter.current})`);
                return;
            }

            if (res.data && res.data.available !== false) {
                // Normalize response: endpoints return slightly different field names
                const endDateStr = res.data.defaultEndDate || res.data.endDate;
                const startDateStr = res.data.defaultStartDate || res.data.startDate;
                const minDateStr = res.data.minDate;

                if (endDateStr && startDateStr) {
                    const lEnd = dayjs(endDateStr);
                    const lStart = dayjs(startDateStr);

                    // Always update maxDate so the date picker boundary is correct for the page
                    setMaxDate(lEnd);

                    if (minDateStr) {
                        setMinDate(dayjs(minDateStr));
                    } else {
                        setMinDate(null);
                    }

                    // Only overwrite timeStart and timeEnd if the user hasn't explicitly set a custom date
                    if (!userSetDate) {
                        setTimeEnd(lEnd);
                        setTimeStart(lStart);

                        // Simple Previous period comparison (aligned with the length of the current period)
                        const periodDays = lEnd.diff(lStart, 'day') + 1;
                        const prevEnd = lStart.subtract(1, 'day');
                        const prevStart = prevEnd.subtract(periodDays - 1, 'day');
                        setCompareEnd(prevEnd);
                        setCompareStart(prevStart);

                        console.log(`[FilterContext] Dates set for ${pageLabel}:`, startDateStr, "to", endDateStr);
                    } else {
                        console.log(`[FilterContext] Max date updated for ${pageLabel}. Preserving user's custom date selection.`);
                    }
                }
            }
        } catch (err) {
            // Only apply error state if this is still the latest request
            if (requestId !== dateRequestCounter.current) return;
            console.warn("[FilterContext] Failed to fetch latest dates:", err.message);
        } finally {
            // Only mark fetched if this is still the latest request
            if (requestId === dateRequestCounter.current) {
                setDatesFetched(true);
            }
        }
    }, [isAuthenticated, currentPath]);

    useEffect(() => {
        refreshDates();
    }, [refreshDates, currentPath]);

    // ====== FETCH CHANNELS FROM DB (on mount) ======
    const fetchChannels = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const res = await axiosInstance.get("/watchtower/channels");
            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                console.log("[FilterContext] Fetched channels from DB:", res.data);
                setChannels(res.data);
                // Keep current selection if still valid, otherwise select first non-All
                setSelectedChannel(prev => {
                    const validChannels = res.data.filter(c => c !== 'All');
                    // If prev is a valid channel in the new list, keep it
                    if (prev !== "All" && validChannels.includes(prev)) return prev;
                    // Otherwise select the first available channel
                    return validChannels.length > 0 ? validChannels[0] : 'All';
                });
            } else {
                setChannels(FALLBACK_CHANNELS);
            }
        } catch (err) {
            console.warn("[FilterContext] Failed to fetch channels, using fallback:", err.message);
            setChannels(FALLBACK_CHANNELS);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        fetchChannels();
    }, [fetchChannels]);

    const prevChannelRef = useRef(selectedChannel);

    // ====== FETCH PLATFORMS FROM DB (based on channel) ======
    const fetchPlatformsFromDb = useCallback(async () => {
        if (!isAuthenticated) return;

        const channelChanged = prevChannelRef.current !== selectedChannel;
        prevChannelRef.current = selectedChannel;

        setPlatformsFetched(false);
        try {
            // If we are on the Market Share page, fetch all top filters from rb_ms_olap
            const isMarketShare = window.location.hash.includes('/market-share');

            if (isMarketShare) {
                console.log("[FilterContext] Fetching Market Share top filters from rb_ms_olap for channel:", selectedChannel);
                const res = await axiosInstance.get("/market-share/top-filter-options", {
                    params: { channel: selectedChannel === "All" ? undefined : selectedChannel }
                });
                if (res.data) {
                    const newPlatforms = res.data.platforms || [];
                    const newCategories = res.data.categories || [];
                    const newChannels = res.data.channels || [];
                    const newLocations = res.data.locations || [];
                    const newBrands = res.data.brands || [];
                    const newSubCategories = res.data.subCategories || [];
                    const newPlatformMetadata = res.data.platformMetadata || [];

                    if (newPlatforms.length > 0) setPlatforms(newPlatforms);
                    if (newCategories.length > 0) setCategories(newCategories);
                    if (newChannels.length > 0) setChannels(newChannels);
                    if (newLocations.length > 0) setLocations(newLocations);
                    if (newBrands.length > 0) setBrands(newBrands);
                    if (newSubCategories.length > 0) {
                        setSubCategories(newSubCategories);
                    } else {
                        setSubCategories([]);
                    }
                    // Update platform metadata with icons sourced from rb_ms_olap platforms
                    if (newPlatformMetadata.length > 0) setPlatformMetadata(newPlatformMetadata);

                    // Validate current platform selection
                    setPlatform(prev => {
                        if (channelChanged && newPlatforms.length > 0) return newPlatforms[0];
                        const currentList = Array.isArray(prev) ? prev : [prev];
                        const valid = currentList.filter(p => newPlatforms.includes(p));
                        if (valid.length === 0) return newPlatforms[0];
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

                    // Validate current subcategory selection
                    setSelectedSubCategory(prev => {
                        if (prev === "All") return "All";
                        const currentList = Array.isArray(prev) ? prev : [prev];
                        const valid = currentList.filter(s => newSubCategories.includes(s));
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

                    // Validate current brand selection
                    setSelectedBrand(prev => {
                        if (prev === "All") return "All";
                        const currentList = Array.isArray(prev) ? prev : [prev];
                        const valid = currentList.filter(b => newBrands.includes(b));
                        if (valid.length === 0) return "All";
                        return valid.length === 1 ? valid[0] : valid;
                    });
                }
            } else if (window.location.hash.includes('/visibility-analysis') || window.location.hash.includes('/visibility-anlysis')) {
                console.log("[FilterContext] Fetching Visibility Analysis dynamic filters for channel:", selectedChannel);
                
                // Fetch platforms specifically for Visibility Analysis
                const platRes = await axiosInstance.get("/visibility-analysis/filter-options", {
                    params: { 
                        filterType: 'platforms', 
                        channel: selectedChannel === "All" ? undefined : selectedChannel 
                    }
                });

                if (platRes.data && platRes.data.options) {
                    const newPlatforms = platRes.data.options;
                    if (newPlatforms.length > 0) {
                        setPlatforms(newPlatforms);
                        // Validate current platform selection
                        setPlatform(prev => {
                            if (channelChanged) return newPlatforms[0];
                            const currentList = Array.isArray(prev) ? prev : [prev];
                            const valid = currentList.filter(p => newPlatforms.includes(p));
                            if (valid.length === 0) return newPlatforms[0];
                            return valid.length === 1 ? valid[0] : valid;
                        });
                    } else {
                        setPlatforms([]);
                        setPlatform("");
                    }
                } else {
                    setPlatforms([]);
                    setPlatform("");
                }

                // IMPORTANT: Fetch channels specifically for Visibility Analysis to ensure they refresh 
                // when switching from other restricted pages (like Market Share)
                const chanRes = await axiosInstance.get("/visibility-analysis/filter-options", {
                    params: { filterType: 'channels' }
                });
                if (chanRes.data && chanRes.data.options) {
                    const newChannels = chanRes.data.options;
                    if (newChannels.length > 0) {
                        console.log("[FilterContext] Refreshed channels for Visibility Analysis:", newChannels);
                        setChannels(newChannels);
                        setSelectedChannel(prev => {
                            if (prev === "All") return "All";
                            const lowerPrev = prev.toLowerCase();
                            // Handle mapping from Ecom/QuickComm to ecommerce/quickcomm
                            if (['ecom', 'ecommerce', 'e-commerce'].includes(lowerPrev)) {
                                const found = newChannels.find(c => ['ecommerce', 'ecom'].includes(c.toLowerCase()));
                                if (found) return found;
                            }
                            if (lowerPrev === 'quickcomm' || lowerPrev === 'quick commerce' || lowerPrev.includes('quick')) {
                                const found = newChannels.find(c => ['quickcomm', 'quick commerce', 'quick_commerce'].includes(c.toLowerCase()));
                                if (found) return found;
                            }
                            const exactMatch = newChannels.find(c => c.toLowerCase() === lowerPrev);
                            if (exactMatch) return exactMatch;
                            const validChannels = newChannels.filter(c => c !== 'All');
                            return validChannels.length > 0 ? validChannels[0] : 'All';
                        });
                    }
                }
            } else if (window.location.hash.includes('/content-analysis') || window.location.hash.includes('/content-score')) {
                const res = await axiosInstance.get("/content-analysis/platforms", {
                    params: { channel: selectedChannel === "All" ? undefined : selectedChannel }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched dynamic platforms from Content Analysis:", res.data);
                    setPlatforms(res.data);
                    // Keep "All" or current selection if it's still valid
                    setPlatform(prevPlatform => {
                        if (channelChanged) return res.data[0];
                        const currentList = Array.isArray(prevPlatform) ? prevPlatform : [prevPlatform];
                        const validPlatforms = currentList.filter(p => res.data.includes(p));
                        if (validPlatforms.length === 0) return res.data[0];
                        return validPlatforms.length === 1 ? validPlatforms[0] : validPlatforms;
                    });
                } else {
                    setPlatforms([]);
                    setPlatform("");
                }
            } else {
                // Refresh channels for other pages to clear any restricted lists (like from Market Share)
                fetchChannels();
                
                const res = await axiosInstance.get("/watchtower/platforms", {
                    params: { channel: selectedChannel === "All" ? undefined : selectedChannel }
                });
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    console.log("[FilterContext] Fetched dynamic platforms from Watchtower:", res.data);
                    setPlatforms(res.data);
                    // Keep "All" or current selection if it's still valid
                    setPlatform(prevPlatform => {
                        if (prevPlatform === "All") return "All"; // Preserve "All" on reset
                        if (channelChanged) return res.data[0];
                        const currentList = Array.isArray(prevPlatform) ? prevPlatform : [prevPlatform];
                        const validPlatforms = currentList.filter(p => res.data.includes(p));
                        if (validPlatforms.length === 0) return res.data[0];
                        return validPlatforms.length === 1 ? validPlatforms[0] : validPlatforms;
                    });
                } else {
                    setPlatforms([]);
                    setPlatform("");
                }
            }
        } catch (err) {
            console.warn("[FilterContext] Failed to fetch dynamic platforms:", err.message);
            setPlatforms([]);
            setPlatform("");
        } finally {
            setPlatformsFetched(true);
        }
    }, [isAuthenticated, selectedChannel, fetchChannels]);

    useEffect(() => {
        fetchPlatformsFromDb();
    }, [fetchPlatformsFromDb, currentPath]);

    // ====== FETCH PLATFORM METADATA (IMAGES) FROM DB ======
    useEffect(() => {
        const fetchPlatformMetadata = async () => {
            if (!isAuthenticated) return;
            // Skip watchtower metadata fetch on Market Share page — it provides its own metadata
            const isMarketShare = window.location.hash.includes('/market-share');
            if (isMarketShare) return;
            try {
                const res = await axiosInstance.get("/watchtower/platform-metadata");
                if (res.data && Array.isArray(res.data)) {
                    console.log("[FilterContext] Fetched platform metadata:", res.data);
                    setPlatformMetadata(res.data);
                }
            } catch (err) {
                console.warn("[FilterContext] Failed to fetch platform metadata:", err.message);
            }
        };
        fetchPlatformMetadata();
    }, [isAuthenticated, currentPath]);

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
                        if (validList.length === 0) return (Array.isArray(prevCat) && prevCat.length === 0) ? [] : "All";
                        if (validList.length === cats.length && cats.length > 0) return "All";
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
                            if (validList.length === 0) return (Array.isArray(prevCat) && prevCat.length === 0) ? [] : "All";
                            if (validList.length === cats.length && cats.length > 0) return "All";
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
                            if (validList.length === 0) return (Array.isArray(prevLoc) && prevLoc.length === 0) ? [] : "All";
                            if (validList.length === locs.length && locs.length > 0) return "All";
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
                                return (Array.isArray(prevBrand) && prevBrand.length === 0) ? [] : "All"; 
                            } else {
                                return (validList.length === res.data.length && res.data.length > 0) ? "All" : (validList.length === 1 ? validList[0] : validList);
                            }
                        }
                        return prevBrand;
                    });
                } else {
                    setBrands(FALLBACK_BRANDS);
                    setSelectedBrand("All");
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
                        if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : ["All"];
                        return valid;
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
                        if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : ["All"];
                        return valid;
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

    // ====== FETCH MSL VALUES FROM DB ======
    useEffect(() => {
        const fetchMsls = async () => {
            if (!isAuthenticated) return;
            try {
                const res = await axiosInstance.get("/watchtower/msls");
                if (res.data && Array.isArray(res.data)) {
                    const fetchedMsls = res.data.map(m => m !== null && m !== undefined ? m.toString() : "").filter(Boolean);
                    console.log("[FilterContext] Fetched MSL values:", fetchedMsls);
                    setMsls(fetchedMsls);
                } else {
                    setMsls([]);
                }
            } catch (err) {
                console.error("[FilterContext] Failed to fetch MSL values:", err);
                setMsls([]);
            }
        };
        fetchMsls();
    }, [isAuthenticated]);

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
            platformMetadata,
            platform,
            setPlatform,
            timeStart,
            setTimeStart,
            timeEnd,
            setTimeEnd,
            userSetDate,
            setUserSetDate,
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
            subCategories,
            setSubCategories,
            selectedSubCategory,
            setSelectedSubCategory,
            productCategories,
            setProductCategories,
            selectedProductCategory,
            setSelectedProductCategory,
            maxDate,
            minDate,
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
            setVisibilityMode,
            selectedRank,
            setSelectedRank,
            msls,
            setMsls,
            selectedMsl,
            setSelectedMsl,
            paPriority,
            setPaPriority,
            paStatus,
            setPaStatus,
            paPlatform,
            setPaPlatform,
            paBrand,
            setPaBrand,
            paCity,
            setPaCity,
            paFilters,
            setPaFilters
        }}>
            {children}
        </FilterContext.Provider>
    );
};
