/**
 * ReviewRatingPage — Digital Shelf host page for the Rating Intelligence dashboard.
 *
 * Auth is bypassed: the ratings AuthProvider always returns isAuthenticated=true
 * and persists the real companyId (297e37ea-a5ac-47df-bebd-ac44e52b7979) to
 * localStorage on mount so tenant.ts / useRatingsAPI can resolve it without
 * requiring any sign-in flow.
 *
 * CSS isolation: the `.ratings-isolated` wrapper overrides Digital Shelf global
 * styles (font-family !important, table text-transform, etc.) so the ratings
 * dashboard renders exactly as it does standalone.
 */

import React from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import TrailyticsTypewriterLoader from "../../components/insights/TrailyticsTypewriterLoader";
import "./ReviewRatingPage.css";
import { useAuth } from "../../utils/AuthContext";

// Import the ratings AuthProvider so companyId is seeded into localStorage
import { AuthProvider as RatingsAuthProvider } from "../../../../trailytics_ratings/frontend/src/contexts/AuthContext.tsx";

// Lazy-load the dashboard so it only loads when this route is visited
const RatingsDashboard = React.lazy(() =>
  import("../../../../trailytics_ratings/frontend/src/components/Dashboard.tsx")
);

export default function ReviewRatingPage() {
  const { user } = useAuth();

  return (
    <RatingsAuthProvider companyId={user?.dbId} companyName={user?.dbName}>
      {/*
       * fullHeight=true  → the content Box uses overflow:hidden and becomes a
       *                    flex column so the Dashboard's own <main> can scroll.
       * disablePadding   → no MUI Container gutters around the ratings dashboard.
       * hideFilters      → Digital Shelf header shows only the title/breadcrumb,
       *                    not the DS filter bar (ratings has its own GlobalFilterBar).
       */}
      <CommonContainer
        title="Rating Intelligence"
        disablePadding={true}
        hideFilters={true}
        fullHeight={true}
      >
        {/*
         * ratings-isolated: scoped CSS resets (see ReviewRatingPage.css)
         * that undo Digital Shelf global rules bleeding into this section.
         * flex + min-height:0 lets the Dashboard fill the available height.
         */}
        <div className="ratings-isolated">
          <React.Suspense
            fallback={
              <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
                <TrailyticsTypewriterLoader size={1.1} message="Loading Rating Intelligence..." />
              </div>
            }
          >
            <RatingsDashboard />
          </React.Suspense>
        </div>
      </CommonContainer>
    </RatingsAuthProvider>
  );
}
