import React from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline } from "@mui/material";
import App from "./App";
import AppThemeProvider from "./utils/ThemeContext";
import "./index.css";

// Force unregister any service workers that might be lingering
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}

/**
 * MSAL Popup Interception
 * When Microsoft redirects the popup back to our origin, this page loads in the popup.
 * We detect we're inside a popup (window.opener exists) and DO NOT render the React app.
 * The parent window's loginPopup() monitors this popup's URL, extracts the auth code
 * from the hash fragment, and closes the popup automatically.
 */
if (window.opener && window.opener !== window) {
  // We're inside the MSAL popup — render nothing.
  // The parent window will read the #code=... hash and close this popup.
  console.log("[MSAL Popup] Detected popup window, waiting for parent to process auth response...");
} else {
  // Normal app render (main browser window)
  createRoot(document.getElementById("root")).render(
    <>
      <AppThemeProvider>
        <CssBaseline />
        <App />
      </AppThemeProvider>
    </>
  );
}
