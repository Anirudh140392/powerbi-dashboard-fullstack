import React, { createContext, useState, useMemo, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

export const AppThemeContext = createContext();

export default function AppThemeProvider({ children }) {
  const getInitialMode = () => {
    try {
      const saved = localStorage.getItem("mode");
      if (saved === "light" || saved === "dark") return saved;
    } catch (e) {
      // ignore
    }
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  };

  const [mode, setMode] = useState(getInitialMode);

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === "dark"
            ? {
                background: {
                  default: "#111827",
                  paper: "#1f2937",
                },
                text: {
                  primary: "#f9fafb",
                  secondary: "#d1d5db",
                },
              }
            : {
                background: {
                  default: "#f5f5f5",
                  paper: "#ffffff",
                },
                text: {
                  primary: "#111827",
                  secondary: "#374151",
                },
              }),
        },
      }),
    [mode]
  );

  const toggleTheme = () =>
    setMode((prev) => (prev === "light" ? "dark" : "light"));

  useEffect(() => {
    try {
      // persist
      localStorage.setItem("mode", mode);
    } catch (e) {
      // ignore
    }

    // sync Tailwind / global styles: add/remove `dark` class on <html>
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [mode]);

  return (
    <AppThemeContext.Provider value={{ mode, toggleTheme }}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppThemeContext.Provider>
  );
}
