import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
// MUI Date Picker Providers
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import WatchTower from "./pages/ControlTower/WatchTower";
import CategoryRca from "./pages/Analytics/CategoryRca";

export default function App() {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WatchTower />} />
         <Route path="/category-rca" element={<CategoryRca />} />
        </Routes>
      </BrowserRouter>
    </LocalizationProvider>
  );
}
