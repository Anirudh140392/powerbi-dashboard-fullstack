import React, { useState } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import RCATable from "../../components/Analytics/CategoryRca/RCATable";

export default function CategoryRca() {
  const [filters, setFilters] = useState({
    platform: "Blinkit",
  });

  return (
    <CommonContainer
      title="Category RCA"
      filters={filters}
      onFiltersChange={setFilters}
    >
      <RCATable />
    </CommonContainer>
  );
}
