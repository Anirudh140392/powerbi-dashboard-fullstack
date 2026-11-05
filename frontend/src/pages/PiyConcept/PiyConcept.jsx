import React, { useState, useEffect, useContext } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import PlayItYourself from "../../components/PiyConcept/PlayItYourself";
import { FilterContext } from "../../utils/FilterContext";

export default function PiyConcept() {
  const { refreshFilters } = useContext(FilterContext);

  // Restore comprehensive platform list from rca_sku_dim on mount
  // (Prevents subsetting from other pages like Performance Marketing)
  useEffect(() => {
    if (typeof refreshFilters === 'function') {
      refreshFilters();
    }
  }, [refreshFilters]);

  const [filters, setFilters] = useState({
    platform: "All",
    timeStep: "Monthly",
  });

  return (
    <CommonContainer
      title="Pivot Studio Demo"
      filters={filters}
      onFiltersChange={setFilters}
    >
      <PlayItYourself />
    </CommonContainer>
  );
}