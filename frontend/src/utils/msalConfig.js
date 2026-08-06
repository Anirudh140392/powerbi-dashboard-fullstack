import { PublicClientApplication } from "@azure/msal-browser";

export const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '153c3bd5-c6f7-41a5-b11c-3334d71b5db4',
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common'}`,
        redirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false,
    }
};

export const msalInstance = new PublicClientApplication(msalConfig);

let isInitialized = false;
let initPromise = null;

export async function getMsalInstance() {
    if (isInitialized) return msalInstance;
    if (!initPromise) {
        initPromise = msalInstance.initialize().then(() => {
            isInitialized = true;
            return msalInstance;
        });
    }
    return initPromise;
}
