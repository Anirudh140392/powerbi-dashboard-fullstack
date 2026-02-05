import React, { createContext, useState, useMemo, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

export const AppThemeContext = createContext();

// Enforce static light mode
const mode = "light";

const muiTheme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#f5f5f5",
      paper: "#ffffff",
    },
    text: {
      primary: "#111827",
      secondary: "#374151",
    },
  },
});

export default function AppThemeProvider({ children }) {
  // Ensure DOM is synced with light mode immediately
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("mode"); // Clean up legacy storage
  }, []);

  // toggleTheme is now a no-op or removed. Keeping a dummy for safety if other components call it, 
  // but better to remove usages. For now, we provide a no-op to prevent crashes during refactor.
  const toggleTheme = () => { };

  return (
    <AppThemeContext.Provider value={{ mode, toggleTheme }}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppThemeContext.Provider>
  );
}
