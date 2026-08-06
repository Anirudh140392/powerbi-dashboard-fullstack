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
  // Inside MSAL popup window — handle redirect promise to process the #code= hash,
  // notify window.opener, and close the popup.
  getMsalInstance().then((msal) => {
    return msal.handleRedirectPromise();
  }).then(() => {
    if (window.opener) {
      window.close();
    }
  }).catch((err) => {
    console.error("[MSAL Popup] Error handling popup redirect:", err);
    if (window.opener) {
      window.close();
    }
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
