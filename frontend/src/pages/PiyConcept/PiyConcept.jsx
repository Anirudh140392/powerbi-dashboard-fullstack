import React, { useState } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import PlayItYourself from "../../components/PiyConcept/PlayItYourself";

export default function PiyConcept() {
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