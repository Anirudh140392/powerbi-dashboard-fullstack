import React, { useContext } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import SecondarySummaryOverview from "../../components/ControlTower/WatchTower/SecondarySummaryOverview";
import SecondaryDailyTracking from "../../components/ControlTower/WatchTower/SecondaryDailyTracking";
import { FilterContext } from "../../utils/FilterContext";

export default function SecondarySummaryPage() {
  const { timeStart, timeEnd } = useContext(FilterContext);

  return (
    <CommonContainer title="Secondary Summary" hideFilters={true}>
      <SecondarySummaryOverview />
      <SecondaryDailyTracking 
        timeStart={timeStart}
        timeEnd={timeEnd}
      />
    </CommonContainer>
  );
}
