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
 * When Microsoft redirects the popup back to our origin, the popup loads this app.
 * We must detect we're inside a popup, let MSAL process the auth response,
 * and close the popup — WITHOUT rendering the full React app.
 */
async function handleMsalPopup() {
  // Detect if we're inside a popup opened by MSAL (window.opener is the parent login page)
  if (window.opener && window.opener !== window) {
    try {
      const { PublicClientApplication } = await import("@azure/msal-browser");
      const msalConfig = {
        auth: {
          clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '153c3bd5-c6f7-41a5-b11c-3334d71b5db4',
          authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID || 'b50e2cd2-ee2d-4b60-ab85-dc4ce039da6a'}`,
          redirectUri: window.location.origin,
        },
        cache: {
          cacheLocation: "sessionStorage",
          storeAuthStateInCookie: false,
        }
      };
      const msalInstance = new PublicClientApplication(msalConfig);
      await msalInstance.initialize();
      // This processes the auth hash, sends the token to the parent window, and closes the popup
      await msalInstance.handleRedirectPromise();
    } catch (e) {
      // If MSAL handling fails, close the popup anyway
      console.error("MSAL popup handling error:", e);
    }
    // Don't render the React app in the popup — return early
    return;
  }

  // Normal app render (not a popup)
  createRoot(document.getElementById("root")).render(
    <>
      <AppThemeProvider>
        <CssBaseline />
        <App />
      </AppThemeProvider>
    </>
  );
}

handleMsalPopup();
