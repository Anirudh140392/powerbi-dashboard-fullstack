import React, { useState, useContext, useEffect, useRef } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import PricingAnalysisData from "../../components/AllPricingAnalysis/PricingAnalysisData";
import { FilterContext } from "../../utils/FilterContext";
import dayjs from "dayjs";

export default function PricingAnalysis() {
  // Get values from FilterContext - the source of truth for dropdown selections
  const {
    platform,
    selectedBrand,
    selectedLocation,
    timeStart,
    timeEnd,
    selectedZone,
    setPlatform,
    setSelectedLocation,
    setTimeStart,
    setTimeEnd,
    selectedCategory,
    setSelectedCategory,
    compareStart,
    compareEnd,
    selectedChannel,
    refreshFilters
  } = useContext(FilterContext);

  // Initialize filters from context
  const [filters, setFilters] = useState({
    platform: platform || "Blinkit",
    brand: selectedBrand || "All",
    location: selectedLocation || "All",
    category: selectedCategory || "All",
    zones: selectedZone || "All",
    channel: selectedChannel || "Ecommerce",
    months: 6,
    timeStep: "Monthly",
    startDate: timeStart ? timeStart.format('YYYY-MM-DD') : dayjs().startOf('month').format('YYYY-MM-DD'),
    endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
    compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : null,
    compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : null
  });

  // Wrapper to sync context when filters change locally (e.g. from internal matrix filters)
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);

    // Sync back to FilterContext to update global header
    if (newFilters.platform && newFilters.platform !== platform) {
      setPlatform(newFilters.platform);
    }
    if (newFilters.location && newFilters.location !== selectedLocation) {
      setSelectedLocation(newFilters.location);
    }
    if (newFilters.category && newFilters.category !== selectedCategory) {
      setSelectedCategory(newFilters.category);
    }
    if (newFilters.startDate) {
      const newStart = dayjs(newFilters.startDate);
      if (!newStart.isSame(timeStart, 'day')) {
        setTimeStart(newStart);
      }
    }
    if (newFilters.endDate) {
      const newEnd = dayjs(newFilters.endDate);
      if (!newEnd.isSame(timeEnd, 'day')) {
        setTimeEnd(newEnd);
      }
    }
  };

  // Sync filters with FilterContext when context values change
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      platform: platform || prev.platform,
      brand: selectedBrand || prev.brand,
      location: selectedLocation || prev.location,
      category: selectedCategory || prev.category,
      zones: selectedZone || prev.zones,
      channel: selectedChannel || prev.channel,
      startDate: timeStart ? timeStart.format('YYYY-MM-DD') : prev.startDate,
      endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : prev.endDate,
      compareStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : null,
      compareEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : null
    }));
  }, [platform, selectedBrand, selectedLocation, selectedCategory, timeStart, timeEnd, compareStart, compareEnd, selectedZone, selectedChannel]);

  // Restore comprehensive platform list from rca_sku_dim on mount
  // (Prevents subsetting from other pages like Performance Marketing)
  useEffect(() => {
    if (typeof refreshFilters === 'function') {
      refreshFilters();
    }
  }, [refreshFilters]);

  return (
    <>
      <CommonContainer
        title="Pricing Analysis"
        filters={filters}
        onFiltersChange={handleFiltersChange}
      >
        <PricingAnalysisData
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />
      </CommonContainer>
    </>
  );
}
