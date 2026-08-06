import React from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline } from "@mui/material";
import App from "./App";
import AppThemeProvider from "./utils/ThemeContext";
import "./index.css";
import { getMsalInstance } from "./utils/msalConfig";

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
 * When Microsoft redirects the popup back to our origin, MSAL in the popup window
 * processes the token hash via handleRedirectPromise() and notifies the opener.
 */
if (window.opener && window.opener !== window) {
  // Inside MSAL popup window — initializing MSAL automatically processes the popup response
  // and closes the window. Do NOT call handleRedirectPromise() as it is only for redirect flows.
  getMsalInstance().catch((err) => {
    console.error("[MSAL Popup] Error initializing MSAL in popup window:", err);
  });
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
