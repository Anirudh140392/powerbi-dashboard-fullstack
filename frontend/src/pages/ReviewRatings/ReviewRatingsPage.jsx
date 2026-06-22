import React, { useState, useRef, useCallback } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";

// The ratings app runs as a separate Vite app.
// In development it runs on port 5174 (configured in trailytics_ratings/vite.config.ts).
// In production, set VITE_RATINGS_URL in the frontend .env to the deployed URL.
const RATINGS_APP_URL =
  import.meta.env.VITE_RATINGS_URL || "http://localhost:5174";

const ReviewRatingsPage = () => {
  const iframeRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = "";
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = currentSrc;
      }, 50);
    }
  }, []);

  return (
    <CommonContainer
      title="Review Rating"
      hideFilters={true}
      disablePadding={true}
      hideHeader={true}
    >
      {/* 
        The CommonContainer renders a scrollable Box > Container. 
        We use calc(100vh - 120px) to fill the available viewport below 
        the sidebar header + notification scroller + dashboard header.
      */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* Loading Overlay */}
        {isLoading && !hasError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              gap: "20px",
              borderRadius: "16px",
            }}
          >
            {/* Animated Logo */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "18px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 40px rgba(99, 102, 241, 0.4)",
                animation: "rr-pulse 2s ease-in-out infinite",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill="white"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </svg>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#0f172a",
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "-0.02em",
                }}
              >
                Review Rating Intelligence
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "rgba(15,23,42,0.6)",
                  marginTop: "6px",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Loading Session..
              </div>
            </div>

            {/* Spinner */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "3px solid #f1f5f9",
                borderTop: "3px solid #4f46e5",
                animation: "rr-spin 0.9s linear infinite",
              }}
            />

            <style>{`
              @keyframes rr-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes rr-pulse {
                0%, 100% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.4); transform: scale(1); }
                50% { box-shadow: 0 0 60px rgba(99, 102, 241, 0.7); transform: scale(1.05); }
              }
            `}</style>
          </div>
        )}

        {/* Error State */}
        {hasError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              gap: "20px",
              padding: "32px",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "18px",
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 40px rgba(239, 68, 68, 0.3)",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="white"
                  strokeWidth="2"
                />
                <line
                  x1="12"
                  y1="8"
                  x2="12"
                  y2="12"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="16" r="1" fill="white" />
              </svg>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#0f172a",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Unable to connect
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "rgba(15,23,42,0.6)",
                  marginTop: "8px",
                  maxWidth: "420px",
                  lineHeight: 1.6,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                The Review Rating dashboard could not be loaded. Make sure the
                ratings app is running at{" "}
                <code
                  style={{
                    background: "rgba(15,23,42,0.06)",
                    borderRadius: "4px",
                    padding: "2px 6px",
                    fontSize: "12px",
                    color: "#4338ca",
                  }}
                >
                  {RATINGS_APP_URL}
                </code>
              </div>
            </div>

            <button
              onClick={handleRetry}
              style={{
                padding: "10px 28px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "translateY(-2px)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "translateY(0)")
              }
            >
              Retry
            </button>
          </div>
        )}

        {/* The actual iframe — fills the full content area */}
        <iframe
          ref={iframeRef}
          src={RATINGS_APP_URL}
          title="Review Rating Intelligence Dashboard"
          onLoad={handleLoad}
          onError={handleError}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
            opacity: isLoading || hasError ? 0 : 1,
            transition: "opacity 0.4s ease",
            borderRadius: "16px",
          }}
          allow="clipboard-write; clipboard-read"
        />
      </div>
    </CommonContainer>
  );
};

export default ReviewRatingsPage;
