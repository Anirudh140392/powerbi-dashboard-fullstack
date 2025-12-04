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
    const [platform, setPlatform] = useState("Zepto");

    // Date Ranges
    const [timeStart, setTimeStart] = useState(dayjs("2025-10-01"));
    const [timeEnd, setTimeEnd] = useState(dayjs("2025-10-06"));
    const [compareStart, setCompareStart] = useState(dayjs("2025-09-01"));
    const [compareEnd, setCompareEnd] = useState(dayjs("2025-09-06"));

    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const response = await axiosInstance.get("/watchtower/brands", {
                    params: { platform: platform }
                });
                const fetchedBrands = response.data;
                setBrands(fetchedBrands);

                // Set default brand if not already selected or if current selection is not in new list
                // For simplicity, always default to first brand when platform changes to ensure validity
                if (fetchedBrands.length > 0) {
                    setSelectedBrand(fetchedBrands[0]);
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
            if (!selectedBrand) return;
            try {
                const response = await axiosInstance.get("/watchtower/locations", {
                    params: { brand: selectedBrand }
                });
                const fetchedLocations = response.data;
                setLocations(fetchedLocations);

                // Set default location if available
                if (fetchedLocations.length > 0) {
                    setSelectedLocation(fetchedLocations[0]);
                } else {
                    setSelectedLocation(null);
                }
            } catch (error) {
                console.error("Error fetching locations:", error);
            }
        };

        fetchKeywords();
        fetchLocations();
    }, [selectedBrand]);

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
