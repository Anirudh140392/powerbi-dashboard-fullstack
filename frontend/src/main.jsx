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
 *
 * When Microsoft redirects the popup back to our origin with #code=...&state=...,
 * we must:
 *   1. NOT render the React app (React Router would navigate and strip the hash)
 *   2. DO initialize MSAL and call handleRedirectPromise() so MSAL can:
 *      - Parse the #code= hash from the URL
 *      - Exchange the authorization code for tokens (PKCE)
 *      - Broadcast the token response to the main window via BroadcastChannel
 *      - Close the popup
 *
 * The main window's loginPopup() is listening for this broadcast. Once it
 * receives the token response, the loginPopup() promise resolves and the
 * handleMicrosoftLogin() function proceeds to call the backend.
 */
const urlHash = window.location.hash;
const isMsalAuthResponse = urlHash &&
  urlHash.includes('state=') &&
  (urlHash.includes('code=') || urlHash.includes('error='));

if (isMsalAuthResponse) {
  // ---- MSAL auth response detected in the URL hash ----
  // Do NOT render React. Initialize MSAL and process the hash.
  console.log("[MSAL Popup] Auth response hash detected. Processing...");

  import("./utils/msalConfig").then(({ getMsalInstance }) => {
    return getMsalInstance();
  }).then((msal) => {
    console.log("[MSAL Popup] MSAL initialized, calling handleRedirectPromise...");
    return msal.handleRedirectPromise();
  }).then((response) => {
    console.log("[MSAL Popup] handleRedirectPromise resolved:", response ? "token received" : "handled internally");
    // MSAL should close the popup automatically, but force close as safety net
    setTimeout(() => {
      try { window.close(); } catch (e) { /* ignore */ }
    }, 1000);
  }).catch((err) => {
    console.error("[MSAL Popup] Error processing auth response:", err);
    setTimeout(() => {
      try { window.close(); } catch (e) { /* ignore */ }
    }, 1000);
  });
} else {
  // ---- Normal page load (main browser window) ----
  createRoot(document.getElementById("root")).render(
    <>
      <AppThemeProvider>
        <CssBaseline />
        <App />
      </AppThemeProvider>
    </>
  );
}
