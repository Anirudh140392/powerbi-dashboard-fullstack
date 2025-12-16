import React, { createContext, useState, useEffect } from "react";
import axiosInstance from "../api/axiosInstance";
import dayjs from "dayjs";


export const FilterContext = createContext();

export const FilterProvider = ({ children }) => {
    const [brands, setBrands] = useState([]);
    const [selectedBrand, setSelectedBrand] = useState(null);
    const [keywords, setKeywords] = useState([]);
    const [selectedKeyword, setSelectedKeyword] = useState(null);
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [platforms, setPlatforms] = useState([]);
    const [platform, setPlatform] = useState("Zepto");

    useEffect(() => {
        const fetchPlatforms = async () => {
            try {
                const response = await axiosInstance.get("/watchtower/platforms");
                const fetchedPlatforms = response.data;
                // Add All option
                const options = ["All", ...fetchedPlatforms.filter(p => p !== "All")];
                setPlatforms(options);

                // Optional: Set default platform if needed, but keeping "Zepto" as default for now
            } catch (error) {
                console.error("Error fetching platforms:", error);
            }
        };
        fetchPlatforms();
    }, []);

    // Date Ranges
    // Default date range: 1st of current month to today
    const [timeStart, setTimeStart] = useState(dayjs().startOf('month'));
    const [timeEnd, setTimeEnd] = useState(dayjs());
    const [compareStart, setCompareStart] = useState(dayjs("2025-09-01"));
    const [compareEnd, setCompareEnd] = useState(dayjs("2025-09-06"));

    useEffect(() => {
        const fetchPlatforms = async () => {
            try {
                const response = await axiosInstance.get("/watchtower/platforms");
                const fetchedPlatforms = response.data;
                // setPlatforms(fetchedPlatforms); // Assuming you want to store this, but for now we just need to know it's dynamic. 
                // Actually, we need to expose platforms to the UI.
                // Let's add a state for it.
            } catch (error) {
                console.error("Error fetching platforms:", error);
            }
        };
        fetchPlatforms();
    }, []);

    useEffect(() => {
        const fetchBrands = async () => {
            if (!platform) return;
            try {
                const response = await axiosInstance.get("/watchtower/brands", {
                    params: { platform: platform }
                });
                const fetchedBrands = response.data;
                // Add All option
                const options = ["All", ...fetchedBrands.filter(b => b !== "All")];
                setBrands(options);

                // Set default brand if not already selected or if current selection is not in new list
                // For simplicity, always default to first brand when platform changes to ensure validity
                if (options.length > 0) {
                    setSelectedBrand(options[0]);
                } else {
                    setSelectedBrand(null);
                }
            } catch (error) {
                console.error("Error fetching brands:", error);
            }
        };

        fetchBrands();
    }, [platform]); // Run when platform changes

    // Fetch keywords when brand changes
    useEffect(() => {
        const fetchKeywords = async () => {
            if (!selectedBrand) return;
            try {
                const response = await axiosInstance.get("/watchtower/keywords", {
                    params: { brand: selectedBrand }
                });
                const fetchedKeywords = response.data;
                setKeywords(fetchedKeywords);

                // Set default keyword if available
                if (fetchedKeywords.length > 0) {
                    setSelectedKeyword(fetchedKeywords[0]);
                } else {
                    setSelectedKeyword(null);
                }
            } catch (error) {
                console.error("Error fetching keywords:", error);
            }
        };

        const fetchLocations = async () => {
            if (!selectedBrand || !platform) return;
            try {
                const response = await axiosInstance.get("/watchtower/locations", {
                    params: {
                        platform: platform,
                        brand: selectedBrand
                    }
                });
                const fetchedLocations = response.data;
                // Add All option
                const options = ["All", ...fetchedLocations.filter(l => l !== "All")];
                setLocations(options);

                // Set default location if available
                if (options.length > 0) {
                    setSelectedLocation(options[0]);
                } else {
                    setSelectedLocation(null);
                }
            } catch (error) {
                console.error("Error fetching locations:", error);
            }
        };

        fetchKeywords();
        fetchLocations();
    }, [selectedBrand, platform]);

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
            platform, setPlatform,
            timeStart, setTimeStart,
            timeEnd, setTimeEnd,
            compareStart, setCompareStart,
            compareEnd, setCompareEnd
        }}>
            {children}
        </FilterContext.Provider>
    );
};
