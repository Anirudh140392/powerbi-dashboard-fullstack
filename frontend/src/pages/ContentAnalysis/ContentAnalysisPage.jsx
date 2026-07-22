import React, { useContext } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import TrailyticsTypewriterLoader from "../../components/insights/TrailyticsTypewriterLoader";
import "./ContentAnalysisPage.css";
import { FilterContext } from "../../utils/FilterContext";

// Lazy-load the dashboard so it only loads when this route is visited
const ContentDashboard = React.lazy(() =>
  import("../../../../trailytics_content_analysis/frontend/src/pages/Dashboard.tsx")
);

export default function ContentAnalysisPage() {
  const { platform } = useContext(FilterContext);
  
  // Resolve sidebar platform to a single string, since Content Analysis should only have one selected
  let sidebarPlatform = typeof platform === "string" ? platform : (Array.isArray(platform) ? platform[0] : "All");
  
  return (
    <CommonContainer
      title="Content Analysis"
      disablePadding={true}
      hideFilters={true}
      hideHeader={true}
      fullHeight={true}
    >
      <div className="content-analysis-isolated">
        <React.Suspense
          fallback={
            <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
              <TrailyticsTypewriterLoader size={1.1} message="Loading Content Analysis..." />
            </div>
          }
        >
          <ContentDashboard sidebarPlatform={sidebarPlatform} />
        </React.Suspense>
      </div>
    </CommonContainer>
  );
}
