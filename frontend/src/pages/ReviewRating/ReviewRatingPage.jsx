/**
 * ReviewRatingPage — Digital Shelf host page for the Rating Intelligence dashboard.
 *
 * Approach (Option C — full bundle merge):
 *   1. On mount, calls DS backend /api/auth/ratings-sso-token to get a
 *      short-lived HMAC token for the current DS user.
 *   2. Renders the Rating Intelligence Dashboard component directly (TypeScript
 *      component imported from trailytics_ratings/src).
 *   3. The ratings AuthProvider exchanges the SSO token silently — no login form.
 *
 * Both React versions (DS uses React 18, ratings uses React 19) are handled
 * by Vite's esbuild — the ratings components are bundled into the DS output,
 * sharing the DS React instance. This avoids two React roots.
 */

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../utils/AuthContext";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import TrailyticsTypewriterLoader from "../../components/insights/TrailyticsTypewriterLoader";

// ─── Lazy-import the ratings components ────────────────────────────────────────
// Using React.lazy so the ratings bundle chunk is only loaded when this route
// is visited, keeping initial DS load time unaffected.
const RatingsDashboard = React.lazy(() =>
  import("../../../../trailytics_ratings/src/components/Dashboard.tsx")
);
const RatingsLoginPage = React.lazy(() =>
  import("../../../../trailytics_ratings/src/components/LoginPage.tsx")
);

// Import the ratings AuthProvider + hook
import { AuthProvider as RatingsAuthProvider, useAuth as useRatingsAuth } from "../../../../trailytics_ratings/src/contexts/AuthContext.tsx";

// ─── Inner component: handles SSO exchange inside the ratings AuthProvider ─────
function RatingsContent() {
  const { isAuthenticated, isLoading, ssoLogin } = useRatingsAuth();
  const { user: dsUser } = useAuth(); // DS auth context
  const [ssoState, setSsoState] = useState("idle"); // idle | loading | done | error
  const [ssoError, setSsoError] = useState("");
  const attempted = useRef(false);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Skip if already auth'd in ratings, or SSO already tried, or DS user not available
    if (isAuthenticated || isLoading || attempted.current || !dsUser?.email) return;

    attempted.current = true;
    setSsoState("loading");

    (async () => {
      try {
        // 1. Get SSO token from DS backend
        const token = sessionStorage.getItem("token");
        const resp = await fetch("/api/auth/ratings-sso-token", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        if (!resp.ok || !data.ssoToken) {
          setSsoError(data.error || "Failed to obtain SSO token");
          setSsoState("error");
          return;
        }

        // 2. Exchange token for ratings session
        const result = await ssoLogin(data.ssoToken);
        if (!result.ok) {
          setSsoError(result.error);
          setSsoState("error");
        } else {
          setSsoState("done");
        }
      } catch (err) {
        setSsoError(err.message || "SSO failed");
        setSsoState("error");
      }
    })();
  }, [isAuthenticated, isLoading, dsUser?.email, ssoLogin]);

  // ─── Loading state ────────────────────────────────────────────────────────
  if (isLoading || ssoState === "loading" || showLoader) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
        }}
      >
        <TrailyticsTypewriterLoader size={1.1} message="Loading Rating Intelligence..." />
      </div>
    );
  }

  // ─── SSO error — fall back to manual login ─────────────────────────────────
  if (!isAuthenticated && ssoState === "error") {
    return (
      <div style={{ height: "100%", overflow: "auto" }}>
        {ssoError && (
          <div
            style={{
              position: "fixed",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 50,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#f87171",
              fontSize: 13,
              padding: "8px 16px",
              borderRadius: 12,
            }}
          >
            SSO failed: {ssoError}. Please log in manually below.
          </div>
        )}
        <React.Suspense fallback={<div />}>
          <RatingsLoginPage />
        </React.Suspense>
      </div>
    );
  }

  // ─── Not authenticated and SSO hasn't run yet — render login ──────────────
  if (!isAuthenticated) {
    return (
      <div style={{ height: "100%", overflow: "auto" }}>
        <React.Suspense fallback={<div />}>
          <RatingsLoginPage />
        </React.Suspense>
      </div>
    );
  }

  // ─── Authenticated — render the full dashboard ─────────────────────────────
  return (
    <React.Suspense
      fallback={
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <TrailyticsTypewriterLoader size={1.1} message="Loading Rating Intelligence..." />
        </div>
      }
    >
      <RatingsDashboard />
    </React.Suspense>
  );
}

// ─── Page wrapper ──────────────────────────────────────────────────────────────
export default function ReviewRatingPage() {
  return (
    // Wrap in the ratings AuthProvider so ratings auth state is isolated from DS
    <RatingsAuthProvider>
      <CommonContainer title="Rating Intelligence" disablePadding={true} hideFilters={true}>
        <div
          style={{
            width: "100%",
            flex: 1,
            display: "flex",
            flexDirection: "column"
          }}
        >
          <RatingsContent />
        </div>
      </CommonContainer>
    </RatingsAuthProvider>
  );
}
