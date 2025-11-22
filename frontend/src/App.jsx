import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CategoryRCA from "./pages/CategoryRCA";

// MUI Date Picker Providers
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

export default function App() {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
         <Route path="/category-rca" element={<CategoryRCA />} />
        </Routes>
      </BrowserRouter>
    </LocalizationProvider>
  );
}
