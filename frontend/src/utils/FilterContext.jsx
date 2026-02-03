import React, { createContext, useState, useEffect } from "react";
import axiosInstance from "../api/axiosInstance";
import dayjs from "dayjs";

export const FilterContext = createContext();

// Static platform-brand-location mapping
const platformData = {
    // --- ECOM CHANNELS ---
    "Blinkit": {
        brands: ["Kwality Walls", "Cornetto", "Magnum", "Feast", "Twister"],
        locations: {
            "Kwality Walls": ["Delhi", "Mumbai", "Bangalore"],
            "Cornetto": ["Delhi", "Mumbai", "Bangalore", "Pune"],
            "Magnum": ["Delhi", "Mumbai", "Hyderabad"],
            "Feast": ["Delhi", "Bangalore", "Chennai"],
            "Twister": ["Delhi", "Mumbai", "Kolkata"]
        }
    },
    "Zepto": {
        brands: ["Kwality Walls", "Cornetto", "Magnum", "Feast", "Twister"],
        locations: {
            "Kwality Walls": ["Delhi", "Mumbai", "Bangalore"],
            "Cornetto": ["Mumbai", "Delhi", "Pune"],
            "Magnum": ["Delhi", "Mumbai", "Chennai"],
            "Feast": ["Delhi", "Bangalore"],
            "Twister": ["Delhi", "Mumbai"]
        }
    },
    "Instamart": {
        brands: ["Kwality Walls", "Cornetto", "Magnum", "Feast", "Twister"],
        locations: {
            "Kwality Walls": ["Delhi", "Mumbai", "Bangalore"],
            "Cornetto": ["Hyderabad", "Pune", "Delhi"],
            "Magnum": ["Delhi", "Bangalore", "Mumbai"],
            "Feast": ["Delhi", "Noida", "Gurgaon"],
            "Twister": ["Delhi", "Chennai"]
        }
    },
    "Flipkart": {
        brands: ["Kwality Walls", "Cornetto", "Magnum", "Feast", "Twister"],
        locations: {
            "Kwality Walls": ["Delhi", "Mumbai", "Bangalore"],
            "Cornetto": ["Delhi", "Bangalore", "Pune"],
            "Magnum": ["Mumbai", "Delhi", "Chennai"],
            "Feast": ["Delhi", "Kolkata"],
            "Twister": ["Delhi", "Mumbai", "Bangalore"]
        }
    },
    "Amazon": {
        brands: ["Kwality Walls", "Cornetto", "Magnum", "Feast", "Twister"],
        locations: {
            "Kwality Walls": ["Delhi", "Mumbai", "Bangalore"],
            "Cornetto": ["Mumbai", "Delhi", "Bangalore"],
            "Magnum": ["Delhi", "Pune", "Hyderabad"],
            "Feast": ["Delhi", "Mumbai"],
            "Twister": ["Delhi", "Chennai", "Bangalore"]
        }
    },
    // --- MODERN TRADE CHANNELS ---
    "Reliance Fresh": {
        brands: ["Kwality Walls", "Cornetto"],
        locations: {
            "Kwality Walls": ["Mumbai", "Pune"],
            "Cornetto": ["Mumbai", "Ahmedabad"]
        }
    },
    "Big Bazaar": {
        brands: ["Kwality Walls", "Magnum"],
        locations: {
            "Kwality Walls": ["Delhi", "Kolkata"],
            "Magnum": ["Bangalore", "Chennai"]
        }
    },
    "DMart": {
        brands: ["Kwality Walls", "Cornetto", "Magnum"],
        locations: {
            "Kwality Walls": ["Mumbai", "Thane"],
            "Cornetto": ["Mumbai", "Surat"],
            "Magnum": ["Mumbai", "Bangalore"]
        }
    }
};

const channelPlatformMap = {
    "Ecom": ["Blinkit", "Zepto", "Instamart", "Flipkart", "Amazon"],
    "ModernTrade": ["Reliance Fresh", "Big Bazaar", "DMart"]
};


export const FilterProvider = ({ children }) => {
    // Channel state
    const [channels] = useState(["All", "Ecom", "ModernTrade"]);
    const [selectedChannel, setSelectedChannel] = useState("Ecom");

    // Platform state
    const [platforms, setPlatforms] = useState(channelPlatformMap["Ecom"]);
    const [platform, setPlatform] = useState("Blinkit");

    // Brand state
    const [brands, setBrands] = useState([]);
    const [selectedBrand, setSelectedBrand] = useState(null);

    // Location state
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(null);

    // Keyword state (for visibility analysis)
    const [keywords, setKeywords] = useState(["vanilla", "chocolate", "strawberry", "butterscotch", "mango"]);
    const [selectedKeyword, setSelectedKeyword] = useState("vanilla");

    // Date Ranges
    const [timeStart, setTimeStart] = useState(dayjs("2025-10-01"));
    const [timeEnd, setTimeEnd] = useState(dayjs("2025-10-06"));
    const [compareStart, setCompareStart] = useState(dayjs("2025-09-01"));
    const [compareEnd, setCompareEnd] = useState(dayjs("2025-09-06"));
    const [comparisonLabel, setComparisonLabel] = useState("VS PREV. 30 DAYS");

    // Update platforms when channel changes
    useEffect(() => {
        let availablePlatforms = [];
        if (selectedChannel === "All") {
            availablePlatforms = [...channelPlatformMap["Ecom"], ...channelPlatformMap["ModernTrade"]];
        } else {
            availablePlatforms = channelPlatformMap[selectedChannel] || [];
        }

        setPlatforms(availablePlatforms);

        // Only reset platform if the current one is not in the new list
        if (availablePlatforms.length > 0 && !availablePlatforms.includes(platform)) {
            setPlatform(availablePlatforms[0]);
        }
    }, [selectedChannel]);

    // Update brands when platform changes
    useEffect(() => {
        if (platform && platformData[platform]) {
            const platformBrands = platformData[platform].brands;
            setBrands(platformBrands);

            // Auto-select first brand
            if (platformBrands.length > 0) {
                setSelectedBrand(platformBrands[0]);
            }
        }
    }, [platform]);

    // Update locations when brand or platform changes
    useEffect(() => {
        if (platform && selectedBrand && platformData[platform]) {
            const brandLocations = platformData[platform].locations[selectedBrand];
            if (brandLocations) {
                setLocations(brandLocations);

                // Auto-select first location
                if (brandLocations.length > 0) {
                    setSelectedLocation(brandLocations[0]);
                }
            } else {
                setLocations([]);
                setSelectedLocation(null);
            }
        }
    }, [platform, selectedBrand]);

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
            setComparisonLabel
        }}>
            {children}
        </FilterContext.Provider>
    );
};
