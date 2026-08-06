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
 * MSAL Popup / Redirect Interception
 * 
 * When Microsoft redirects back to our origin with #code=...&state=..., we must
 * NOT render the React app. If we let React Router boot, it navigates the URL
 * (e.g. / -> /watch-tower -> /login), which STRIPS the #code= hash from the
 * address bar before MSAL in the main window can read it from the popup.
 * 
 * For MSAL popup flow: the main window's loginPopup() polls the popup's URL.
 * When it sees the popup is on the same origin with a hash, it reads the hash,
 * exchanges the code for tokens, and closes the popup. The popup just needs to
 * exist at the redirectUri with the hash intact — no JS processing needed.
 */
const urlHash = window.location.hash;
const isMsalAuthResponse = urlHash &&
  urlHash.includes('state=') &&
  (urlHash.includes('code=') || urlHash.includes('error='));

if (isMsalAuthResponse) {
  // ---- MSAL auth response detected in the URL hash ----
  // Do NOT render the React app. Keep the page blank so the hash is preserved.
  // MSAL in the main window will read this popup's URL, extract the hash,
  // and close this popup automatically.
  console.log("[MSAL] Auth response hash detected in URL. Not rendering React app.");
  console.log("[MSAL] window.opener:", !!window.opener, "| hash length:", urlHash.length);

  // Safety: if MSAL doesn't close this window within 10 seconds, close it ourselves
  setTimeout(() => {
    console.log("[MSAL] Safety timeout — closing popup window.");
    try { window.close(); } catch (e) { /* ignore */ }
  }, 10000);
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
