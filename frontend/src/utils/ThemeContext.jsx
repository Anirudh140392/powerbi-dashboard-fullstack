import React, { createContext, useState, useMemo, useEffect } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

export const AppThemeContext = createContext();

export default function AppThemeProvider({ children }) {
  const getInitialMode = () => {
    try {
      const saved = localStorage.getItem("mode");
      if (saved === "light" || saved === "dark") return saved;
    } catch { }

    // 🚫 REMOVE system theme detection — always default to light
    return "light";
  };

  const [mode, setMode] = useState(getInitialMode);

  const toggleTheme = () => {
    setMode(prev => prev === "light" ? "dark" : "light");
  };

  const muiTheme = useMemo(() => createTheme({
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
  }), [mode]);

  useEffect(() => {

    // 💥 Force default to light on Linux/Firefox/WebKit before render
    if (!localStorage.getItem("mode")) {
      document.documentElement.setAttribute("data-theme", "light");
      document.documentElement.style.colorScheme = "light";
    }

    try {
      localStorage.setItem("mode", mode);
    } catch { }

    // Tailwind / system UI sync
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode;
    document.documentElement.classList.toggle("dark", mode === "dark");

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
