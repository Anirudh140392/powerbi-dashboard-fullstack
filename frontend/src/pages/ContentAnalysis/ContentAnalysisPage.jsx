import React from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import TrailyticsTypewriterLoader from "../../components/insights/TrailyticsTypewriterLoader";
import "./ContentAnalysisPage.css";

// Lazy-load the dashboard so it only loads when this route is visited
const ContentDashboard = React.lazy(() =>
  import("../../../../trailytics_content_analysis/frontend/src/pages/Dashboard.tsx")
);

export default function ContentAnalysisPage() {
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
          <ContentDashboard />
        </React.Suspense>
      </div>
    </CommonContainer>
  );
}
