import React, { useState } from "react";
import { Container, Box, useTheme } from "@mui/material";
import CommonContainer from "../../components/CommonLayout/CommonContainer";

function TabButton({ label, active, onClick }) {
  const theme = useTheme();
  return (
    <Box
      onClick={onClick}
      sx={{
        py: 2,
        cursor: "pointer",
        borderBottom: active
          ? `3px solid ${theme.palette.primary.main}`
          : "3px solid transparent",
        color: active
          ? theme.palette.primary.main
          : theme.palette.text.secondary,
        fontWeight: 700,
        fontSize: "0.85rem",
        display: "flex",
        alignItems: "center",
        gap: 1,
      }}
    >
      <Box component="span" sx={{ fontSize: "1.1rem" }}>
        ▦
      </Box>
      <Box component="span">{label}</Box>
    </Box>
  );
}

import PlatformOverview from "../../components/ControlTower/WatchTower/PlatformOverview";
import CategoryTable from "../../components/ControlTower/WatchTower/CategoryTable";
import SKUTable from "../../components/ControlTower/WatchTower/SKUTable";
import MyTrendsDrawer from "../../components/ControlTower/WatchTower/MyTrendsDrawer";
import CardMetric from "../../components/ControlTower/WatchTower/CardMetric";

export default function WatchTower() {
  const [showTrends, setShowTrends] = useState(false);
  const monthLogos = {
    jan: "https://img.icons8.com/fluency/96/january.png",
    feb: "https://img.icons8.com/fluency/96/february.png",
    mar: "https://img.icons8.com/fluency/96/march.png",
    apr: "https://img.icons8.com/fluency/96/april.png",
    may: "https://img.icons8.com/fluency/96/may.png",
    jun: "https://img.icons8.com/fluency/96/june.png",
    jul: "https://img.icons8.com/fluency/96/july.png",
    aug: "https://img.icons8.com/fluency/96/august.png",
    sep: "https://img.icons8.com/fluency/96/september.png",
    oct: "https://img.icons8.com/fluency/96/october.png",
    nov: "https://img.icons8.com/fluency/96/november.png",
    dec: "https://img.icons8.com/fluency/96/december.png",
  };
  const categoryLogo = "https://cdn-icons-png.flaticon.com/512/711/711284.png";

  const defaultPlatforms = [
    {
      key: "all",
      label: "All",
      logo: "https://cdn-icons-png.flaticon.com/512/711/711284.png",
      columns: [
        {
          title: "Offtake",
          value: "₹9.0 Cr",
          change: { text: "▲3.2% (₹28.8 lac)", positive: true },
          meta: { units: "4.9 lac", change: "▲2.4%" },
        },
        {
          title: "Est. Category Share",
          value: "35.0%",
          change: { text: "▲0.4% (+0.1 pp)", positive: true },
          meta: { units: "4.9 lac", change: "▲2.4%" },
        },
        {
          title: "Category Size",
          value: "₹25.7 Cr",
          change: { text: "▲2.9% (₹72.5 lac)", positive: true },
          meta: { units: "4.9 lac", change: "▲2.4%" },
        },
        {
          title: "Wt. OSA%",
          value: "78.6%",
          change: { text: "▼9.4% (-8.2 pp)", positive: false },
          meta: { units: "4.9 lac", change: "▲2.4%" },
        },
        {
          title: "Wt. Disc %",
          value: "26.5%",
          change: { text: "▲6.2% (+1.6 pp)", positive: true },
          meta: { units: "4.9 lac", change: "▲2.4%" },
        },
        // {
        //   title: "Overall SOV",
        //   value: "37.4%",
        //   change: { text: "▼7.2% (-2.9 pp)", positive: false },
        //   meta: { units: "4.9 lac", change: "▲2.4%" },
        // },
        // {
        //   title: "Impressions",
        //   value: "21.0M",
        //   change: { text: "▲4.6% (+0.9M)", positive: true },
        //   meta: { units: "4.9 lac", change: "▲2.4%" },
        // },
        // {
        //   title: "Clicks",
        //   value: "973K",
        //   change: { text: "▲3.6% (+33.6K)", positive: true },
        //   meta: { units: "4.9 lac", change: "▲2.4%" },
        // },
        // {
        //   title: "CTR",
        //   value: "4.6%",
        //   change: { text: "▲0.2 pp", positive: true },
        //   meta: { units: "4.9 lac", change: "▲2.4%" },
        // },
        // {
        //   title: "CVR",
        //   value: "2.2%",
        //   change: { text: "▲0.1 pp", positive: true },
        //   meta: { units: "4.9 lac", change: "▲2.4%" },
        // },
        // {
        //   title: "Orders",
        //   value: "13.8K",
        //   change: { text: "▲1.5% (+201)", positive: true },
        //   meta: { units: "4.9 lac", change: "▲2.4%" },
        // },
        // {
        //   title: "Ad Spends",
        //   value: "₹1.63 Cr",
        //   change: { text: "▲2.8% (₹4.6 lac)", positive: true },
        //   meta: { units: "4.9 lac", change: "▲2.4%" },
        // },
        // {
        //   title: "ROAS",
        //   value: "5.44x",
        //   change: { text: "▲3.1% (+0.2x)", positive: true },
        //   meta: { units: "4.9 lac", change: "▲2.4%" },
        // },
      ],
    },

    // BLINKIT
    {
      key: "blinkit",
      label: "Blinkit",
      logo: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Blinkit-yellow-rounded.svg",
      columns: [
        {
          title: "Offtake",
          value: "₹2.1 Cr",
          change: { text: "▲3.0% (₹6.1 lac)", positive: true },
          meta: { units: "1.1 lac", change: "▲1.8%" },
        },
        {
          title: "Est. Category Share",
          value: "38.3%",
          change: { text: "▲0.6% (+0.2 pp)", positive: true },
          meta: { units: "1.1 lac", change: "▲1.8%" },
        },
        {
          title: "Category Size",
          value: "₹5.48 Cr",
          change: { text: "▲2.2% (₹11.9 lac)", positive: true },
          meta: { units: "1.1 lac", change: "▲1.8%" },
        },
        {
          title: "Wt. OSA%",
          value: "75.4%",
          change: { text: "▼15.5% (-13.9 pp)", positive: false },
          meta: { units: "1.1 lac", change: "▲1.8%" },
        },
        {
          title: "Wt. Disc %",
          value: "24.0%",
          change: { text: "▲7.4% (+1.7 pp)", positive: true },
          meta: { units: "1.1 lac", change: "▲1.8%" },
        },
        // {
        //   title: "Overall SOV",
        //   value: "36.5%",
        //   change: { text: "▼7.3% (-2.9 pp)", positive: false },
        //   meta: { units: "1.1 lac", change: "▲1.8%" },
        // },
        // {
        //   title: "Impressions",
        //   value: "4.2M",
        //   change: { text: "▲4.0% (+0.16M)", positive: true },
        //   meta: { units: "1.1 lac", change: "▲1.8%" },
        // },
        // {
        //   title: "Clicks",
        //   value: "196K",
        //   change: { text: "▲3.5% (+6.6K)", positive: true },
        //   meta: { units: "1.1 lac", change: "▲1.8%" },
        // },
        // {
        //   title: "CTR",
        //   value: "4.7%",
        //   change: { text: "▲0.2 pp", positive: true },
        //   meta: { units: "1.1 lac", change: "▲1.8%" },
        // },
        // {
        //   title: "CVR",
        //   value: "2.1%",
        //   change: { text: "▲0.1 pp", positive: true },
        //   meta: { units: "1.1 lac", change: "▲1.8%" },
        // },
        // {
        //   title: "Orders",
        //   value: "4.1K",
        //   change: { text: "▲1.5% (+60)", positive: true },
        //   meta: { units: "1.1 lac", change: "▲1.8%" },
        // },
        // {
        //   title: "Ad Spends",
        //   value: "₹0.36 Cr",
        //   change: { text: "▲2.1% (₹0.8 lac)", positive: true },
        //   meta: { units: "1.1 lac", change: "▲1.8%" },
        // },
        // {
        //   title: "ROAS",
        //   value: "5.8x",
        //   change: { text: "▲2.5% (+0.1x)", positive: true },
        //   meta: { units: "1.1 lac", change: "▲1.8%" },
        // },
      ],
    },

    // ZEPTO
    {
      key: "zepto",
      label: "Zepto",
      logo: "https://upload.wikimedia.org/wikipedia/en/7/7d/Logo_of_Zepto.png",
      columns: [
        {
          title: "Offtake",
          value: "₹1.6 Cr",
          change: { text: "▲3.6% (₹5.6 lac)", positive: true },
          meta: { units: "0.9 lac", change: "▲1.2%" },
        },
        {
          title: "Est. Category Share",
          value: "36.4%",
          change: { text: "▲0.4% (+0.1 pp)", positive: true },
          meta: { units: "0.9 lac", change: "▲1.2%" },
        },
        {
          title: "Category Size",
          value: "₹4.40 Cr",
          change: { text: "▲1.9% (₹8.3 lac)", positive: true },
          meta: { units: "0.9 lac", change: "▲1.2%" },
        },
        {
          title: "Wt. OSA%",
          value: "79.7%",
          change: { text: "▼4.7% (-3.9 pp)", positive: false },
          meta: { units: "0.9 lac", change: "▲1.2%" },
        },
        {
          title: "Wt. Disc %",
          value: "29.9%",
          change: { text: "▲6.3% (+1.8 pp)", positive: true },
          meta: { units: "0.9 lac", change: "▲1.2%" },
        },
      ],
    },

    // SWIGGY
    {
      key: "swiggy",
      label: "Swiggy",
      logo: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Swiggy_Logo_2024.webp",
      columns: [
        {
          title: "Offtake",
          value: "₹1.1 Cr",
          change: { text: "▲2.5% (₹2.8 lac)", positive: true },
          meta: { units: "0.7 lac", change: "▲0.8%" },
        },
        {
          title: "Est. Category Share",
          value: "30.5%",
          change: { text: "▲0.2% (+0.1 pp)", positive: true },
          meta: { units: "0.7 lac", change: "▲0.8%" },
        },
        {
          title: "Category Size",
          value: "₹3.61 Cr",
          change: { text: "▲1.7% (₹6.1 lac)", positive: true },
          meta: { units: "0.7 lac", change: "▲0.8%" },
        },
        {
          title: "Wt. OSA%",
          value: "83.3%",
          change: { text: "▼2.8% (-2.4 pp)", positive: false },
          meta: { units: "0.7 lac", change: "▲0.8%" },
        },
        {
          title: "Wt. Disc %",
          value: "27.3%",
          change: { text: "▲4.4% (+1.1 pp)", positive: true },
          meta: { units: "0.7 lac", change: "▲0.8%" },
        },
      ],
    },

    // AMAZON
    {
      key: "amazon",
      label: "Amazon",
      logo: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
      columns: [
        {
          title: "Offtake",
          value: "₹2.2 Cr",
          change: { text: "▲3.1% (₹6.6 lac)", positive: true },
          meta: { units: "1.1 lac", change: "▲2.0%" },
        },
        {
          title: "Est. Category Share",
          value: "33.5%",
          change: { text: "▲0.3% (+0.1 pp)", positive: true },
          meta: { units: "1.1 lac", change: "▲2.0%" },
        },
        {
          title: "Category Size",
          value: "₹6.57 Cr",
          change: { text: "▲2.5% (₹16.0 lac)", positive: true },
          meta: { units: "1.1 lac", change: "▲2.0%" },
        },
        {
          title: "Wt. OSA%",
          value: "81.2%",
          change: { text: "▼3.1% (-2.6 pp)", positive: false },
          meta: { units: "1.1 lac", change: "▲2.0%" },
        },
        {
          title: "Wt. Disc %",
          value: "25.5%",
          change: { text: "▲3.6% (+0.9 pp)", positive: true },
          meta: { units: "1.1 lac", change: "▲2.0%" },
        },
      ],
    },
  ];

  const defaultMonths = [
    // ---------- JAN ----------
    {
      key: "jan",
      label: "Jan",
      logo: monthLogos["jan"],
      columns: [
        {
          title: "Offtake",
          value: "₹7.8 Cr",
          change: { text: "▲1.2% (+₹9.3 lac)", positive: true },
          meta: { units: "4.0 lac", change: "▲0.8%" },
        },
        {
          title: "Est. Category Share",
          value: "33.2%",
          change: { text: "▲0.2 pp", positive: true },
          meta: { units: "33.2%", change: "▲0.2 pp" },
        },
        {
          title: "Category Size",
          value: "₹23.5 Cr",
          change: { text: "▲1.9% (+₹43.7 lac)", positive: true },
          meta: { units: "2350 lac", change: "▲1.9%" },
        },
        {
          title: "Wt. OSA%",
          value: "80.5%",
          change: { text: "▼1.5 pp", positive: false },
          meta: { units: "80.5%", change: "▼1.5 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "24.7%",
          change: { text: "▲0.9 pp", positive: true },
          meta: { units: "24.7%", change: "▲0.9 pp" },
        },
      ],
    },

    // ---------- FEB ----------
    {
      key: "feb",
      label: "Feb",
      logo: monthLogos["feb"],
      columns: [
        {
          title: "Offtake",
          value: "₹8.4 Cr",
          change: { text: "▲1.8% (+₹15.1 lac)", positive: true },
          meta: { units: "4.3 lac", change: "▲1.0%" },
        },
        {
          title: "Est. Category Share",
          value: "34.1%",
          change: { text: "▲0.3 pp", positive: true },
          meta: { units: "34.1%", change: "▲0.3 pp" },
        },
        {
          title: "Category Size",
          value: "₹24.6 Cr",
          change: { text: "▲2.2% (+₹53.3 lac)", positive: true },
          meta: { units: "2460 lac", change: "▲2.2%" },
        },
        {
          title: "Wt. OSA%",
          value: "81.0%",
          change: { text: "▼1.1 pp", positive: false },
          meta: { units: "81.0%", change: "▼1.1 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "25.3%",
          change: { text: "▲1.1 pp", positive: true },
          meta: { units: "25.3%", change: "▲1.1 pp" },
        },
      ],
    },

    // ---------- MAR ----------
    {
      key: "mar",
      label: "Mar",
      logo: monthLogos["mar"],
      columns: [
        {
          title: "Offtake",
          value: "₹8.9 Cr",
          change: { text: "▲2.5% (+₹22.3 lac)", positive: true },
          meta: { units: "4.6 lac", change: "▲1.4%" },
        },
        {
          title: "Est. Category Share",
          value: "35.0%",
          change: { text: "▲0.4 pp", positive: true },
          meta: { units: "35.0%", change: "▲0.4 pp" },
        },
        {
          title: "Category Size",
          value: "₹25.0 Cr",
          change: { text: "▲2.1% (+₹51.2 lac)", positive: true },
          meta: { units: "2500 lac", change: "▲2.1%" },
        },
        {
          title: "Wt. OSA%",
          value: "79.8%",
          change: { text: "▼1.6 pp", positive: false },
          meta: { units: "79.8%", change: "▼1.6 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "26.0%",
          change: { text: "▲1.2 pp", positive: true },
          meta: { units: "26.0%", change: "▲1.2 pp" },
        },
      ],
    },

    // ---------- APR ----------
    {
      key: "apr",
      label: "Apr",
      logo: monthLogos["apr"],
      columns: [
        {
          title: "Offtake",
          value: "₹9.4 Cr",
          change: { text: "▲3.1% (+₹28.9 lac)", positive: true },
          meta: { units: "4.8 lac", change: "▲1.7%" },
        },
        {
          title: "Est. Category Share",
          value: "35.4%",
          change: { text: "▲0.2 pp", positive: true },
          meta: { units: "35.4%", change: "▲0.2 pp" },
        },
        {
          title: "Category Size",
          value: "₹25.6 Cr",
          change: { text: "▲2.4% (+₹59.9 lac)", positive: true },
          meta: { units: "2560 lac", change: "▲2.4%" },
        },
        {
          title: "Wt. OSA%",
          value: "78.6%",
          change: { text: "▼2.3 pp", positive: false },
          meta: { units: "78.6%", change: "▼2.3 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "26.4%",
          change: { text: "▲1.3 pp", positive: true },
          meta: { units: "26.4%", change: "▲1.3 pp" },
        },
      ],
    },

    // ---------- MAY ----------
    {
      key: "may",
      label: "May",
      logo: monthLogos["may"],
      columns: [
        {
          title: "Offtake",
          value: "₹10.1 Cr",
          change: { text: "▲3.5% (+₹34.8 lac)", positive: true },
          meta: { units: "5.2 lac", change: "▲2.0%" },
        },
        {
          title: "Est. Category Share",
          value: "36.1%",
          change: { text: "▲0.3 pp", positive: true },
          meta: { units: "36.1%", change: "▲0.3 pp" },
        },
        {
          title: "Category Size",
          value: "₹26.3 Cr",
          change: { text: "▲2.8% (+₹71.4 lac)", positive: true },
          meta: { units: "2630 lac", change: "▲2.8%" },
        },
        {
          title: "Wt. OSA%",
          value: "77.4%",
          change: { text: "▼1.8 pp", positive: false },
          meta: { units: "77.4%", change: "▼1.8 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "27.0%",
          change: { text: "▲0.9 pp", positive: true },
          meta: { units: "27.0%", change: "▲0.9 pp" },
        },
      ],
    },

    // ---------- JUN ----------
    {
      key: "jun",
      label: "Jun",
      logo: monthLogos["jun"],
      columns: [
        {
          title: "Offtake",
          value: "₹10.6 Cr",
          change: { text: "▲2.9% (+₹29.3 lac)", positive: true },
          meta: { units: "5.5 lac", change: "▲1.3%" },
        },
        {
          title: "Est. Category Share",
          value: "36.6%",
          change: { text: "▲0.3 pp", positive: true },
          meta: { units: "36.6%", change: "▲0.3 pp" },
        },
        {
          title: "Category Size",
          value: "₹26.9 Cr",
          change: { text: "▲2.1% (+₹55.9 lac)", positive: true },
          meta: { units: "2690 lac", change: "▲2.1%" },
        },
        {
          title: "Wt. OSA%",
          value: "76.2%",
          change: { text: "▼2.1 pp", positive: false },
          meta: { units: "76.2%", change: "▼2.1 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "27.4%",
          change: { text: "▲0.6 pp", positive: true },
          meta: { units: "27.4%", change: "▲0.6 pp" },
        },
      ],
    },

    // ---------- JUL ----------
    {
      key: "jul",
      label: "Jul",
      logo: monthLogos["jul"],
      columns: [
        {
          title: "Offtake",
          value: "₹11.0 Cr",
          change: { text: "▲2.4% (+₹26.4 lac)", positive: true },
          meta: { units: "5.7 lac", change: "▲1.1%" },
        },
        {
          title: "Est. Category Share",
          value: "37.1%",
          change: { text: "▲0.2 pp", positive: true },
          meta: { units: "37.1%", change: "▲0.2 pp" },
        },
        {
          title: "Category Size",
          value: "₹27.5 Cr",
          change: { text: "▲1.9% (+₹51.9 lac)", positive: true },
          meta: { units: "2750 lac", change: "▲1.9%" },
        },
        {
          title: "Wt. OSA%",
          value: "75.8%",
          change: { text: "▼1.2 pp", positive: false },
          meta: { units: "75.8%", change: "▼1.2 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "27.8%",
          change: { text: "▲0.5 pp", positive: true },
          meta: { units: "27.8%", change: "▲0.5 pp" },
        },
      ],
    },

    // ---------- AUG ----------
    {
      key: "aug",
      label: "Aug",
      logo: monthLogos["aug"],
      columns: [
        {
          title: "Offtake",
          value: "₹11.4 Cr",
          change: { text: "▲2.9% (+₹32.1 lac)", positive: true },
          meta: { units: "5.9 lac", change: "▲1.5%" },
        },
        {
          title: "Est. Category Share",
          value: "37.6%",
          change: { text: "▲0.3 pp", positive: true },
          meta: { units: "37.6%", change: "▲0.3 pp" },
        },
        {
          title: "Category Size",
          value: "₹28.0 Cr",
          change: { text: "▲2.0% (+₹54.9 lac)", positive: true },
          meta: { units: "2800 lac", change: "▲2.0%" },
        },
        {
          title: "Wt. OSA%",
          value: "75.1%",
          change: { text: "▼1.4 pp", positive: false },
          meta: { units: "75.1%", change: "▼1.4 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "28.2%",
          change: { text: "▲0.6 pp", positive: true },
          meta: { units: "28.2%", change: "▲0.6 pp" },
        },
      ],
    },

    // ---------- SEP ----------
    {
      key: "sep",
      label: "Sep",
      logo: monthLogos["sep"],
      columns: [
        {
          title: "Offtake",
          value: "₹11.2 Cr",
          change: { text: "▼1.5% (-₹16.8 lac)", positive: false },
          meta: { units: "5.6 lac", change: "▼1.2%" },
        },
        {
          title: "Est. Category Share",
          value: "36.9%",
          change: { text: "▼0.4 pp", positive: false },
          meta: { units: "36.9%", change: "▼0.4 pp" },
        },
        {
          title: "Category Size",
          value: "₹28.4 Cr",
          change: { text: "▲1.4% (+₹39.6 lac)", positive: true },
          meta: { units: "2840 lac", change: "▲1.4%" },
        },
        {
          title: "Wt. OSA%",
          value: "74.3%",
          change: { text: "▼1.8 pp", positive: false },
          meta: { units: "74.3%", change: "▼1.8 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "28.0%",
          change: { text: "▼0.2 pp", positive: false },
          meta: { units: "28.0%", change: "▼0.2 pp" },
        },
      ],
    },

    // ---------- OCT ----------
    {
      key: "oct",
      label: "Oct",
      logo: monthLogos["oct"],
      columns: [
        {
          title: "Offtake",
          value: "₹12.1 Cr",
          change: { text: "▲4.1% (+₹47.2 lac)", positive: true },
          meta: { units: "6.1 lac", change: "▲2.4%" },
        },
        {
          title: "Est. Category Share",
          value: "38.0%",
          change: { text: "▲0.5 pp", positive: true },
          meta: { units: "38.0%", change: "▲0.5 pp" },
        },
        {
          title: "Category Size",
          value: "₹29.0 Cr",
          change: { text: "▲2.1% (+₹59.2 lac)", positive: true },
          meta: { units: "2900 lac", change: "▲2.1%" },
        },
        {
          title: "Wt. OSA%",
          value: "75.6%",
          change: { text: "▲1.3 pp", positive: true },
          meta: { units: "75.6%", change: "▲1.3 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "28.5%",
          change: { text: "▲0.5 pp", positive: true },
          meta: { units: "28.5%", change: "▲0.5 pp" },
        },
      ],
    },

    // ---------- NOV ----------
    {
      key: "nov",
      label: "Nov",
      logo: monthLogos["nov"],
      columns: [
        {
          title: "Offtake",
          value: "₹12.4 Cr",
          change: { text: "▲2.1% (+₹26.0 lac)", positive: true },
          meta: { units: "6.2 lac", change: "▲1.0%" },
        },
        {
          title: "Est. Category Share",
          value: "38.5%",
          change: { text: "▲0.3 pp", positive: true },
          meta: { units: "38.5%", change: "▲0.3 pp" },
        },
        {
          title: "Category Size",
          value: "₹29.4 Cr",
          change: { text: "▲1.7% (+₹49.0 lac)", positive: true },
          meta: { units: "2940 lac", change: "▲1.7%" },
        },
        {
          title: "Wt. OSA%",
          value: "76.0%",
          change: { text: "▲0.4 pp", positive: true },
          meta: { units: "76.0%", change: "▲0.4 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "28.7%",
          change: { text: "▲0.2 pp", positive: true },
          meta: { units: "28.7%", change: "▲0.2 pp" },
        },
      ],
    },

    // ---------- DEC ----------
    {
      key: "dec",
      label: "Dec",
      logo: monthLogos["dec"],
      columns: [
        {
          title: "Offtake",
          value: "₹13.0 Cr",
          change: { text: "▲3.8% (+₹47.4 lac)", positive: true },
          meta: { units: "6.5 lac", change: "▲2.2%" },
        },
        {
          title: "Est. Category Share",
          value: "39.1%",
          change: { text: "▲0.6 pp", positive: true },
          meta: { units: "39.1%", change: "▲0.6 pp" },
        },
        {
          title: "Category Size",
          value: "₹29.9 Cr",
          change: { text: "▲1.9% (+₹55.0 lac)", positive: true },
          meta: { units: "2990 lac", change: "▲1.9%" },
        },
        {
          title: "Wt. OSA%",
          value: "76.4%",
          change: { text: "▲0.4 pp", positive: true },
          meta: { units: "76.4%", change: "▲0.4 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "29.1%",
          change: { text: "▲0.4 pp", positive: true },
          meta: { units: "29.1%", change: "▲0.4 pp" },
        },
      ],
    },
  ];

  const defaultCategory = [
    {
      key: "cassata",
      label: "Cassata",
      logo: categoryLogo,
      columns: [
        {
          title: "Offtake",
          value: "₹1.2 Cr",
          change: { text: "▲2.8% (+₹3.3 lac)", positive: true },
          meta: { units: "0.62 lac", change: "▲1.5%" },
        },
        {
          title: "Est. Category Share",
          value: "7.8%",
          change: { text: "▲0.2 pp", positive: true },
          meta: { units: "7.8%", change: "▲0.2 pp" },
        },
        {
          title: "Category Size",
          value: "₹15.4 Cr",
          change: { text: "▲2.1% (+₹31.5 lac)", positive: true },
          meta: { units: "1540 lac", change: "▲2.1%" },
        },
        {
          title: "Wt. OSA%",
          value: "82.5%",
          change: { text: "▼3.2 pp", positive: false },
          meta: { units: "82.5%", change: "▼3.2 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "21.4%",
          change: { text: "▲1.1 pp", positive: true },
          meta: { units: "21.4%", change: "▲1.1 pp" },
        },
      ],
    },

    {
      key: "coreTub",
      label: "Core Tub",
      logo: categoryLogo,
      columns: [
        {
          title: "Offtake",
          value: "₹2.9 Cr",
          change: { text: "▲3.5% (+₹9.9 lac)", positive: true },
          meta: { units: "1.45 lac", change: "▲2.2%" },
        },
        {
          title: "Est. Category Share",
          value: "21.2%",
          change: { text: "▲0.3 pp", positive: true },
          meta: { units: "21.2%", change: "▲0.3 pp" },
        },
        {
          title: "Category Size",
          value: "₹13.7 Cr",
          change: { text: "▲2.4% (+₹32.9 lac)", positive: true },
          meta: { units: "1370 lac", change: "▲2.4%" },
        },
        {
          title: "Wt. OSA%",
          value: "77.1%",
          change: { text: "▼2.1 pp", positive: false },
          meta: { units: "77.1%", change: "▼2.1 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "24.6%",
          change: { text: "▲1.4 pp", positive: true },
          meta: { units: "24.6%", change: "▲1.4 pp" },
        },
      ],
    },

    {
      key: "cornetto",
      label: "Cornetto",
      logo: categoryLogo,
      columns: [
        {
          title: "Offtake",
          value: "₹3.7 Cr",
          change: { text: "▲4.1% (+₹14.8 lac)", positive: true },
          meta: { units: "1.93 lac", change: "▲3.0%" },
        },
        {
          title: "Est. Category Share",
          value: "26.5%",
          change: { text: "▲0.4 pp", positive: true },
          meta: { units: "26.5%", change: "▲0.4 pp" },
        },
        {
          title: "Category Size",
          value: "₹14.1 Cr",
          change: { text: "▲2.6% (+₹35.7 lac)", positive: true },
          meta: { units: "1410 lac", change: "▲2.6%" },
        },
        {
          title: "Wt. OSA%",
          value: "80.2%",
          change: { text: "▼1.8 pp", positive: false },
          meta: { units: "80.2%", change: "▼1.8 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "26.1%",
          change: { text: "▲1.8 pp", positive: true },
          meta: { units: "26.1%", change: "▲1.8 pp" },
        },
      ],
    },

    {
      key: "cup",
      label: "Cup",
      logo: categoryLogo,
      columns: [
        {
          title: "Offtake",
          value: "₹1.8 Cr",
          change: { text: "▲2.2% (+₹3.9 lac)", positive: true },
          meta: { units: "0.98 lac", change: "▲1.0%" },
        },
        {
          title: "Est. Category Share",
          value: "12.8%",
          change: { text: "▲0.1 pp", positive: true },
          meta: { units: "12.8%", change: "▲0.1 pp" },
        },
        {
          title: "Category Size",
          value: "₹14.2 Cr",
          change: { text: "▲2.5% (+₹34.8 lac)", positive: true },
          meta: { units: "1420 lac", change: "▲2.5%" },
        },
        {
          title: "Wt. OSA%",
          value: "83.0%",
          change: { text: "▼1.2 pp", positive: false },
          meta: { units: "83.0%", change: "▼1.2 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "23.7%",
          change: { text: "▲0.8 pp", positive: true },
          meta: { units: "23.7%", change: "▲0.8 pp" },
        },
      ],
    },

    {
      key: "kwSticks",
      label: "KW Sticks",
      logo: categoryLogo,
      columns: [
        {
          title: "Offtake",
          value: "₹2.4 Cr",
          change: { text: "▲3.0% (+₹7.1 lac)", positive: true },
          meta: { units: "1.22 lac", change: "▲1.8%" },
        },
        {
          title: "Est. Category Share",
          value: "17.4%",
          change: { text: "▲0.3 pp", positive: true },
          meta: { units: "17.4%", change: "▲0.3 pp" },
        },
        {
          title: "Category Size",
          value: "₹13.9 Cr",
          change: { text: "▲2.3% (+₹31.9 lac)", positive: true },
          meta: { units: "1390 lac", change: "▲2.3%" },
        },
        {
          title: "Wt. OSA%",
          value: "79.4%",
          change: { text: "▼2.7 pp", positive: false },
          meta: { units: "79.4%", change: "▼2.7 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "27.2%",
          change: { text: "▲1.6 pp", positive: true },
          meta: { units: "27.2%", change: "▲1.6 pp" },
        },
      ],
    },

    {
      key: "magnum",
      label: "Magnum",
      logo: categoryLogo,
      columns: [
        {
          title: "Offtake",
          value: "₹1.4 Cr",
          change: { text: "▲2.9% (+₹4.1 lac)", positive: true },
          meta: { units: "0.73 lac", change: "▲1.6%" },
        },
        {
          title: "Est. Category Share",
          value: "10.1%",
          change: { text: "▲0.2 pp", positive: true },
          meta: { units: "10.1%", change: "▲0.2 pp" },
        },
        {
          title: "Category Size",
          value: "₹13.8 Cr",
          change: { text: "▲2.4% (+₹32.4 lac)", positive: true },
          meta: { units: "1380 lac", change: "▲2.4%" },
        },
        {
          title: "Wt. OSA%",
          value: "81.8%",
          change: { text: "▼1.5 pp", positive: false },
          meta: { units: "81.8%", change: "▼1.5 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "25.4%",
          change: { text: "▲0.9 pp", positive: true },
          meta: { units: "25.4%", change: "▲0.9 pp" },
        },
      ],
    },

    {
      key: "others",
      label: "Others",
      logo: categoryLogo,
      columns: [
        {
          title: "Offtake",
          value: "₹0.95 Cr",
          change: { text: "▲1.7% (+₹1.6 lac)", positive: true },
          meta: { units: "0.51 lac", change: "▲0.7%" },
        },
        {
          title: "Est. Category Share",
          value: "4.0%",
          change: { text: "▲0.1 pp", positive: true },
          meta: { units: "4.0%", change: "▲0.1 pp" },
        },
        {
          title: "Category Size",
          value: "₹13.9 Cr",
          change: { text: "▲2.4% (+₹32.8 lac)", positive: true },
          meta: { units: "1390 lac", change: "▲2.4%" },
        },
        {
          title: "Wt. OSA%",
          value: "78.2%",
          change: { text: "▼1.9 pp", positive: false },
          meta: { units: "78.2%", change: "▼1.9 pp" },
        },
        {
          title: "Wt. Disc %",
          value: "22.5%",
          change: { text: "▲0.6 pp", positive: true },
          meta: { units: "22.5%", change: "▲0.6 pp" },
        },
      ],
    },
  ];

  const [filters, setFilters] = useState({
    platform: "Blinkit",
    months: 6,
    timeStep: "Monthly",
  });

  const [activeTab, setActiveTab] = useState("category");
  const [activeKpisTab, setActiveKpisTab] = useState("Platform Overview");

  const [trendParams, setTrendParams] = useState({
    months: 6,
    timeStep: "Monthly",
    platform: "Blinkit",
  });

  const [trendData, setTrendData] = useState({
    timeSeries: [],
    metrics: {},
  });

  const handleViewTrends = (card) => {
    console.log("card clicked", card);

    const series =
      card.chart?.map((v, i) => {
        let date;

        if (trendParams.timeStep === "Monthly") {
          const d = new Date();
          d.setMonth(d.getMonth() - (card.chart.length - 1 - i));
          date = d.toLocaleString("default", {
            month: "short",
            year: "2-digit",
          });
        } else if (trendParams.timeStep === "Weekly") {
          const d = new Date();
          d.setDate(d.getDate() - 7 * (card.chart.length - 1 - i));
          date = d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          });
        } else {
          const d = new Date();
          d.setDate(d.getDate() - (card.chart.length - 1 - i));
          date = d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          });
        }

        return { date, offtake: v };
      }) ?? [];

    setTrendData({
      timeSeries: series,
      metrics: {},
    });

    setTrendParams((prev) => ({
      ...prev,
      platform: card.name ?? "Blinkit",
    }));

    setShowTrends(true);
  };

  const [dashboardData] = useState({
    summaryMetrics: {
      offtakes: "₹5.1 Cr",
      offtakesTrend: "+1.5%",
      shareOfSearch: "39.4%",
      shareOfSearchTrend: "-2.0%",
      stockAvailability: "96.3%",
      stockAvailabilityTrend: "+4.2%",
      marketShare: "32.1%",
    },

    topMetrics: [
      {
        name: "Offtake",
        label: "₹5.1 Cr",
        subtitle: "for MTD",
        trend: "+1.5% (₹7.3 lac)",
        trendType: "up",
        comparison: "vs Previous Month",
        units: "2.9 lac",
        unitsTrend: "-2.1%",
        chart: [0.6, 1.2, 1.6, 2.0, 2.2, 2.0, 2.4, 2.5],
      },
      {
        name: "Share of Search",
        label: "39.4%",
        subtitle: "for MTD",
        trend: "-2.0% (-0.8%)",
        trendType: "down",
        comparison: "vs Previous Month",
        units: "",
        unitsTrend: "",
        chart: [20, 28, 34, 36, 38, 39, 39.5, 39.4],
      },
      {
        name: "Market Share",
        label: "26.5%",
        subtitle: "for MTD",
        trend: "+62.2% (10.2%)",
        trendType: "up",
        comparison: "vs Previous Month",
        units: "",
        unitsTrend: "",
        chart: [10, 12, 14, 16, 18, 20, 22, 26.5],
      },
    ],

    skuTable: [
      {
        sku: "Colgate Visible White 02 Whitening Toothpaste - 100g",
        all: { offtake: "₹8.8 lac", trend: "+3.0%" },
        blinkit: { offtake: "₹5.3 lac", trend: "+7.6%" },
        zepto: { offtake: "₹2.5 lac", trend: "-1.4%" },
        instamart: { offtake: "₹3.4 lac", trend: "+5.2%" },
      },
      {
        sku: "Colgate Sensitive Toothbrush (Ultra Soft) - 4 units",
        all: { offtake: "₹8.4 lac", trend: "-1.4%" },
        blinkit: { offtake: "₹4.0 lac", trend: "-18.9%" },
        zepto: { offtake: "₹4.4 lac", trend: "+22.2%" },
        instamart: { offtake: "NA", trend: "NA" },
      },
      {
        sku: "Colgate Gentle Sensitive Soft Bristles Toothbrush - 1 piece",
        all: { offtake: "₹7.9 lac", trend: "-2.0%" },
        blinkit: { offtake: "₹3.5 lac", trend: "-12.8%" },
        zepto: { offtake: "₹2.5 lac", trend: "+1.9%" },
        instamart: { offtake: "₹1.9 lac", trend: "+5.1%" },
      },
      // scroll demo rows…
      ...Array.from({ length: 12 }).map((_, i) => ({
        sku: `Colgate SKU Sample ${i + 1}`,
        all: {
          offtake: `₹${7 - i > 0 ? 7 - i + ".0 lac" : i + 1 + ".0 lac"}`,
          trend: `${i % 2 ? "+1.0%" : "-0.5%"}`,
        },
        blinkit: {
          offtake: `₹${(i + 1) * 0.4} lac`,
          trend: `${i % 2 ? "+0.5%" : "-0.2%"}`,
        },
        zepto: {
          offtake: `₹${(i + 1) * 0.25} lac`,
          trend: `${i % 3 ? "+0.3%" : "-0.7%"}`,
        },
        instamart: {
          offtake: `₹${(i + 1) * 0.15} lac`,
          trend: `${i % 2 ? "+0.9%" : "-0.4%"}`,
        },
      })),
    ],
  });

  return (
    <>
      <CommonContainer
        title="Watch Tower"
        filters={filters}
        onFiltersChange={setFilters}
      >
        {/* Top Cards */}
        <CardMetric
          data={dashboardData.topMetrics}
          onViewTrends={handleViewTrends}
        />

        {/* Platform Overview */}
        {/* Tabs */}
        <Box
          sx={{
            bgcolor: (theme) => theme.palette.background.paper,
            borderRadius: 2,
            boxShadow: 1,
            mb: 4,
          }}
        >
          <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3 }}>
            <Box sx={{ display: "flex", gap: 4 }}>
              <TabButton
                label="By Platfrom"
                active={activeKpisTab === "Platform Overview"}
                onClick={() => setActiveKpisTab("Platform Overview")}
              />

              <TabButton
                label="By Category"
                active={activeKpisTab === "Category Overview"}
                onClick={() => setActiveKpisTab("Category Overview")}
              />

              <TabButton
                label="By Month"
                active={activeKpisTab === "Month Overview"}
                onClick={() => setActiveKpisTab("Month Overview")}
              />
            </Box>
          </Box>
          <Box sx={{ p: 3 }}>
            <PlatformOverview
              onViewTrends={handleViewTrends}
              data={
                activeKpisTab === "Platform Overview"
                  ? defaultPlatforms
                  : activeKpisTab === "Category Overview"
                  ? defaultCategory
                  : activeKpisTab === "Month Overview"
                  ? defaultMonths
                  : []
              }
              activeKpisTab={activeKpisTab}
            />
            {/* defaultMonths
defaultCategory */}
          </Box>
        </Box>

        {/* Category / SKU Tabs */}
        <Box
          sx={{
            bgcolor: (theme) => theme.palette.background.paper,
            borderRadius: 2,
            boxShadow: 1,
            mb: 4,
          }}
        >
          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3 }}>
            <Box sx={{ display: "flex", gap: 4 }}>
              <TabButton
                label="Split by Category"
                active={activeTab === "category"}
                onClick={() => setActiveTab("category")}
              />

              <TabButton
                label="Split by SKUs"
                active={activeTab === "sku"}
                onClick={() => setActiveTab("sku")}
              />
            </Box>
          </Box>

          {/* Content */}
          {activeTab === "category" && (
            <Box sx={{ p: 3 }}>
              <CategoryTable />
            </Box>
          )}

          {activeTab === "sku" && (
            <Box sx={{ p: 3 }}>
              <SKUTable data={dashboardData.skuTable} />
            </Box>
          )}
        </Box>
      </CommonContainer>

      {/* Trend Drawer */}
      <MyTrendsDrawer
        open={showTrends}
        onClose={() => setShowTrends(false)}
        trendData={trendData}
        trendParams={trendParams}
      />
    </>
  );
}
