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
 * When Microsoft redirects the popup back to our origin with #code=... or #error=...,
 * MSAL needs to process this hash in the popup window and communicate the result
 * back to the main window via postMessage, then close itself.
 */
const urlHash = window.location.hash;
const isPopupWindow = window.opener && window.opener !== window;
const isMsalResponse = urlHash && (urlHash.includes('code=') || urlHash.includes('error=') || urlHash.includes('state='));

if (isPopupWindow && isMsalResponse) {
  // This is the MSAL popup window with an auth response in the hash.
  // Initialize MSAL so it can process the hash and notify the opener window.
  console.log("[MSAL Popup] Detected auth response hash, initializing MSAL to process...");
  getMsalInstance().then((msal) => {
    console.log("[MSAL Popup] Calling handleRedirectPromise to process hash...");
    return msal.handleRedirectPromise(urlHash);
  }).then((response) => {
    console.log("[MSAL Popup] handleRedirectPromise resolved:", response ? "got token" : "no token (handled internally)");
    // Popup should close automatically, but force close just in case
    setTimeout(() => {
      try { window.close(); } catch(e) {}
    }, 500);
  }).catch((err) => {
    console.error("[MSAL Popup] Error processing auth response:", err);
    setTimeout(() => {
      try { window.close(); } catch(e) {}
    }, 500);
  });
} else if (isPopupWindow) {
  // Popup window but no MSAL hash — just close it
  console.log("[MSAL Popup] Popup window without auth hash, closing...");
  setTimeout(() => {
    try { window.close(); } catch(e) {}
  }, 1000);
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
