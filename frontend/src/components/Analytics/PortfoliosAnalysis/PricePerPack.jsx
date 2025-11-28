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
  Tabs,
  Tab,
  Typography,
  Button,
  Divider,
  Dialog,
  Select,
  MenuItem,
} from "@mui/material";

import { Filter, SlidersHorizontal } from "lucide-react";

/* ---------------------------------------------
   PACK-WISE SALIENCY DATA (Dense)
---------------------------------------------- */


const pricePerPackData = {
  Cassata: {
    pack: [
      { range: "Pack 0", Amul: 18, BaskinRobbins: 12, CreamBell: 22, GoZero: 6, Grameen: 4, Havmor: 10, Hocco: 8, KwalityWalls: 12, Others: 5, Vadilal: 3 },
      { range: "Pack 1", Amul: 22, BaskinRobbins: 15, CreamBell: 20, GoZero: 8, Grameen: 5, Havmor: 12, Hocco: 5, KwalityWalls: 9, Others: 3, Vadilal: 1 },
      { range: "Pack 2", Amul: 16, BaskinRobbins: 22, CreamBell: 28, GoZero: 9, Grameen: 6, Havmor: 8, Hocco: 4, KwalityWalls: 5, Others: 1, Vadilal: 1 },
      { range: "Pack 3", Amul: 12, BaskinRobbins: 26, CreamBell: 24, GoZero: 10, Grameen: 8, Havmor: 7, Hocco: 4, KwalityWalls: 6, Others: 2, Vadilal: 1 },
      { range: "Pack 4", Amul: 10, BaskinRobbins: 30, CreamBell: 19, GoZero: 6, Grameen: 7, Havmor: 10, Hocco: 8, KwalityWalls: 5, Others: 3, Vadilal: 2 },
      { range: "Pack 5", Amul: 8, BaskinRobbins: 35, CreamBell: 16, GoZero: 5, Grameen: 6, Havmor: 12, Hocco: 10, KwalityWalls: 4, Others: 2, Vadilal: 2 },
      { range: "Pack 6", Amul: 6, BaskinRobbins: 27, CreamBell: 23, GoZero: 7, Grameen: 5, Havmor: 14, Hocco: 11, KwalityWalls: 4, Others: 1, Vadilal: 2 },
      { range: "Pack 7", Amul: 5, BaskinRobbins: 18, CreamBell: 20, GoZero: 8, Grameen: 7, Havmor: 28, Hocco: 10, KwalityWalls: 2, Others: 1, Vadilal: 1 },
      { range: "Pack 8", Amul: 2, BaskinRobbins: 60, CreamBell: 10, GoZero: 5, Grameen: 2, Havmor: 12, Hocco: 5, KwalityWalls: 2, Others: 1, Vadilal: 1 },
      { range: "Pack 9", Amul: 1, BaskinRobbins: 5, CreamBell: 12, GoZero: 4, Grameen: 4, Havmor: 60, Hocco: 10, KwalityWalls: 2, Others: 1, Vadilal: 1 },
      { range: "Pack 10", BaskinRobbins: 100 },
      { range: "Pack 11", Havmor: 100 },
    ],
  },

  Cone: {
    pack: [
      { range: "Pack 0", Amul: 20, Arun: 10, CreamBell: 15, Havmor: 18, KwalityWalls: 12, GoZero: 5 },
      { range: "Pack 1", Amul: 15, BaskinRobbins: 20, CreamBell: 25, GoZero: 15, Havmor: 10, KwalityWalls: 8 },
      { range: "Pack 2", Amul: 10, CreamBell: 30, GoZero: 20, Havmor: 15, KwalityWalls: 10, Arun: 5 },
      { range: "Pack 3", BaskinRobbins: 40, GoZero: 12, CreamBell: 20, Havmor: 10, KwalityWalls: 8, Others: 5 },
      { range: "Pack 4", Hocco: 60, GoZero: 10, CreamBell: 12, Havmor: 10, KwalityWalls: 8 },
      { range: "Pack 5", Amul: 8, Arun: 12, Havmor: 25, CreamBell: 30, GoZero: 15, KwalityWalls: 10 },
      { range: "Pack 6", BaskinRobbins: 55, Amul: 18, CreamBell: 12, Havmor: 10, KwalityWalls: 5 },
      { range: "Pack 7", GoZero: 45, Amul: 20, CreamBell: 18, Havmor: 10, KwalityWalls: 7 },
      { range: "Pack 8", CreamBell: 70, Amul: 10, GoZero: 6, Havmor: 8, KwalityWalls: 6 },
      { range: "Pack 9", Havmor: 100 },
    ],
  },

  Cup: {
    pack: [
      { range: "Pack 0", KwalityWalls: 40, Amul: 20, Nic: 15, Havmor: 10, CreamBell: 10, Others: 5 },
      { range: "Pack 1", CreamBell: 70, Havmor: 10, Nic: 10, KwalityWalls: 6, Amul: 4 },
      { range: "Pack 2", Amul: 35, KwalityWalls: 25, Havmor: 20, Nic: 15, Others: 5 },
      { range: "Pack 3", Nic: 60, Havmor: 18, KwalityWalls: 12, Amul: 7, CreamBell: 3 },
      { range: "Pack 4", CreamBell: 100 },
      { range: "Pack 5", KwalityWalls: 90, Amul: 10 },
      { range: "Pack 6", BaskinRobbins: 100 },
      { range: "Pack 7", Havmor: 80, KwalityWalls: 15, Amul: 5 },
      { range: "Pack 8", KwalityWalls: 65, CreamBell: 20, Amul: 10, Nic: 5 },
      { range: "Pack 9", Amul: 50, Havmor: 25, KwalityWalls: 15, CreamBell: 5, Nic: 5 },
      { range: "Pack 10", KwalityWalls: 100 },
    ],
  },
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
  Grameen: "#7D3C98",
  Havmor: "#F06292",
  Hocco: "#BA68C8",
  KwalityWalls: "#CE93D8",
  Nic: "#9575CD",
  Vadilal: "#FFD54F",
  Others: "#8D6E63",
};

/* ---------------------------------------------
   COMPONENT
---------------------------------------------- */
const PricePerPack = () => {
  const categoryTabs = Object.keys(pricePerPackData);

  const [selectedCategory, setSelectedCategory] = useState("Cassata");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [openFilter, setOpenFilter] = useState(false);

  /* Extract all brands dynamically */
  const allBrands = useMemo(() => {
    const set = new Set();
    const cat = pricePerPackData[selectedCategory];

    cat.pack.forEach((row) => {
      Object.keys(row).forEach((key) => key !== "range" && set.add(key));
    });

    return ["All", ...Array.from(set)];
  }, [selectedCategory]);

  /* Filter by brand */
  const activePack = useMemo(() => {
    const pack = pricePerPackData[selectedCategory].pack;

    if (selectedBrand === "All") return pack;

    return pack.map((row) => ({
      range: row.range,
      [selectedBrand]: row[selectedBrand] || 0,
    }));
  }, [selectedCategory, selectedBrand]);

  /* Bar Label */
  const CustomLabel = ({ x, y, width, value }) =>
    value >= 10 ? (
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

  /* Chart Renderer */
  const renderStackedChart = (data, title) => {
    const brands = [
      ...new Set(
        data.flatMap((row) => Object.keys(row).filter((k) => k !== "range"))
      ),
    ];

    return (
      <Card sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} mb={1}>
          {title}
        </Typography>

        <Box sx={{ width: "100%", height: 380 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="range" />
              <YAxis tickFormatter={(v) => `${v}%`} />
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
      {/* LEFT SIDE */}
      <Box flex={1}>
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

        {renderStackedChart(activePack, "Price Per Pack")}
      </Box>

      {/* FILTER FLOATING BUTTON */}
      <Box sx={{ position: "fixed", bottom: 22, right: 22 }}>
        <Button
          onClick={() => setOpenFilter(true)}
          variant="contained"
          sx={{ width: 64, height: 64, borderRadius: "50%", boxShadow: 6 }}
        >
          <SlidersHorizontal size={26} color="#fff" />
        </Button>
      </Box>

      {/* FILTER POPUP */}
      <Dialog
        open={openFilter}
        onClose={() => setOpenFilter(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 4, p: 2 } }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Filter size={18} />
          <Typography variant="h6" fontWeight={600}>
            Filters
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography fontWeight={600} mb={1}>
          Brand
        </Typography>

        <Select
          fullWidth
          size="small"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
        >
          {allBrands.map((b) => (
            <MenuItem key={b} value={b}>
              {b}
            </MenuItem>
          ))}
        </Select>

        <Divider sx={{ my: 2 }} />

        <Box display="flex" gap={1}>
          <Button fullWidth variant="outlined" onClick={() => setSelectedBrand("All")}>
            Reset
          </Button>
          <Button fullWidth variant="contained" onClick={() => setOpenFilter(false)}>
            Apply
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
};

export default PricePerPack;
