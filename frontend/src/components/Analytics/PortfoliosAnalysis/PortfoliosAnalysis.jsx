import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import {
  Box,
  Card,
  Grid,
  Tabs,
  Tab,
  TextField,
  Select,
  MenuItem,
  Typography,
  Button,
  Divider,
  Dialog,
} from "@mui/material";

import { Filter, SlidersHorizontal } from "lucide-react";

const categoryData = {
  Cassata: {
    quantity: [
      { range: "0-50", Amul: 22, Arun: 15, CreamBell: 63 },
      { range: "51-75", BaskinRobbins: 100 },
      { range: "76-100", KwalityWalls: 55, Amul: 18, DairyDay: 31 },
      { range: "101-125", Amul: 52, Havmor: 48 },
      { range: "125+", Amul: 25, KwalityWalls: 34, CreamBell: 23 }
    ],
    price: [
      { range: "0-50", Amul: 22, Arun: 15, DairyDay: 7 },
      { range: "51-100", BaskinRobbins: 100 },
      { range: "101-150", Amul: 20, KwalityWalls: 79 },
      { range: "150+", CreamBell: 26, KwalityWalls: 34 }
    ]
  },

  Cone: {
    quantity: [
      { range: "0-50", Amul: 19, Arun: 7, Havmor: 16, KwalityWalls: 20 },
      { range: "51-75", GoZero: 72, Amul: 28 },
      { range: "76-100", CreamBell: 73, GoZero: 11 },
      { range: "101-125", Havmor: 43, KwalityWalls: 11 },
      { range: "126-150", Hocco: 98 },
      { range: "150+", Amul: 9, Arun: 15, KwalityWalls: 11 }
    ],
    price: [
      { range: "0-50", Amul: 31, Havmor: 15, KwalityWalls: 12 },
      { range: "51-100", CreamBell: 42, Amul: 28 },
      { range: "101-150", BaskinRobbins: 48, Hocco: 10 },
      { range: "150+", Havmor: 32, Amul: 8 }
    ]
  },

  Cup: {
    quantity: [
      { range: "151-200", Amul: 40, Havmor: 13, Nic: 10 },
      { range: "200+", CreamBell: 100 },
      { range: "0-50", KwalityWalls: 98 },
      { range: "0-100", Nic: 84, Havmor: 13 },
      { range: "51-75", CreamBell: 79 },
      { range: "76-100", Amul: 27, KwalityWalls: 23 },
      { range: "101-125", KwalityWalls: 75, Amul: 25 },
      { range: "126-150", BaskinRobbins: 100 },
      { range: "150+", KwalityWalls: 86, Amul: 13 }
    ],
    price: [
      { range: "0-50", Amul: 40, DairyDay: 8 },
      { range: "51-100", CreamBell: 11, KwalityWalls: 42 },
      { range: "101-150", BaskinRobbins: 48 },
      { range: "150+", Havmor: 41, KwalityWalls: 8 }
    ]
  }
};

/* ---------------------------------------------
   BRAND COLORS
---------------------------------------------- */
const brandColors = {
  Amul: "#5DADE2",
  Arun: "#85C1E9",
  BaskinRobbins: "#1A237E",
  CreamBell: "#26C6DA",
  DairyDay: "#D81B60",
  GoZero: "#EC407A",
  Havmor: "#F06292",
  Hocco: "#BA68C8",
  KwalityWalls: "#CE93D8",
  Nic: "#9575CD",
};

/* ---------------------------------------------
   COMPONENT START
---------------------------------------------- */
const PortfoliosAnalysis = () => {
  const categoryTabs = Object.keys(categoryData);

  const [selectedCategory, setSelectedCategory] = useState("Cassata");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [openFilter, setOpenFilter] = useState(false);

  /* Extract all brands available dynamically */
  const allBrands = useMemo(() => {
    const set = new Set();
    const cat = categoryData[selectedCategory];

    cat.quantity.forEach(row => {
      Object.keys(row).forEach(key => key !== "range" && set.add(key));
    });
    cat.price.forEach(row => {
      Object.keys(row).forEach(key => key !== "range" && set.add(key));
    });

    return ["All", ...Array.from(set)];
  }, [selectedCategory]);

  /* Filter by brand */
  const filterByBrand = (data) => {
    if (selectedBrand === "All") return data;

    return data.map(row => ({
      range: row.range,
      [selectedBrand]: row[selectedBrand] || 0
    }));
  };

  const activeQuantity = filterByBrand(categoryData[selectedCategory].quantity);
  const activePrice = filterByBrand(categoryData[selectedCategory].price);

  /* Label On Bars */
  const CustomLabel = ({ x, y, width, value }) =>
    value > 10 ? (
      <text
        x={x + width / 2}
        y={y + 15}
        fill="#fff"
        textAnchor="middle"
        fontSize={11}
        fontWeight="600"
      >
        {value}
      </text>
    ) : null;

  /* Render Chart */
  const renderStackedChart = (data, title) => {
    const brands = [
      ...new Set(
        data.flatMap((row) => Object.keys(row).filter((k) => k !== "range"))
      )
    ];

    return (
      <Card sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} mb={1}>
          {title}
        </Typography>

        <Box sx={{ width: "100%", height: 340 }}>
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="range"  textAnchor="end" />
              <YAxis />

              <Tooltip />
              <Legend />

              {brands.map((b) => (
                <Bar
                  key={b}
                  dataKey={b}
                  stackId="a"
                  fill={brandColors[b] || "#999"}
                  radius={[5, 5, 0, 0]}
                  label={<CustomLabel />}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Card>
    );
  };

  return (
    <Box p={3} display="flex">
      
      {/* LEFT CONTENT */}
      <Box flex={1}>
        {/* CATEGORY TABS */}
        <Card sx={{ mb: 3, borderRadius: 3 }}>
          <Tabs
            value={categoryTabs.indexOf(selectedCategory)}
            onChange={(e, v) => setSelectedCategory(categoryTabs[v])}
            variant="scrollable"
          >
            {categoryTabs.map((c) => (
              <Tab key={c} label={c} sx={{ textTransform: "none" }} />
            ))}
          </Tabs>
        </Card>

        {/* Charts */}
        {renderStackedChart(activeQuantity, "Quantity Ranges")}
        {renderStackedChart(activePrice, "Price Ranges")}
      </Box>

      {/* FLOATING FILTER BUTTON */}
      <Box
        sx={{
          position: "fixed",
          bottom: 22,
          right: 22,
          zIndex: 2000,
        }}
      >
        <Button
          onClick={() => setOpenFilter(true)}
          variant="contained"
          sx={{
            borderRadius: "50%",
            width: 64,
            height: 64,
            boxShadow: 5,
          }}
        >
          <SlidersHorizontal size={26} color="#fff" />
        </Button>
      </Box>

      {/* FILTER POPUP */}
      <Dialog
        open={openFilter}
        onClose={() => setOpenFilter(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, p: 2 },
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Filter size={18} />
          <Typography variant="h6" fontWeight={600}>
            Filters
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* BRAND FILTER */}
        <Typography fontWeight={600} mb={1}>
          Brand
        </Typography>

        <Select
          fullWidth
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          size="small"
        >
          {allBrands.map((b) => (
            <MenuItem key={b} value={b}>
              {b}
            </MenuItem>
          ))}
        </Select>

        <Divider sx={{ my: 2 }} />

        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => setSelectedBrand("All")}
          >
            Reset
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={() => setOpenFilter(false)}
          >
            Apply
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
};

export default PortfoliosAnalysis;
