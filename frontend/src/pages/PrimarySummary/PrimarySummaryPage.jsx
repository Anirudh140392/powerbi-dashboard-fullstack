import React from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import PrimarySummary from "../../components/ControlTower/WatchTower/PrimarySummary";
import PrimaryPlanVsAchieved from "../../components/ControlTower/WatchTower/PrimaryPlanVsAchieved";
import CategorySubcategoryDrillDown from "../../components/ControlTower/WatchTower/CategorySubcategoryDrillDown";

export default function PrimarySummaryPage() {
  return (
    <CommonContainer title="Primary Summary" hideFilters={true}>
      <PrimarySummary />
      <PrimaryPlanVsAchieved />
    </CommonContainer>
  );
}
