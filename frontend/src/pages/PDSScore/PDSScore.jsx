import React, { useState, useContext, useEffect } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import { FilterContext } from "../../utils/FilterContext";
import TrailyticsTypewriterLoader from "../../components/insights/TrailyticsTypewriterLoader";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  Stack,
  InputBase,
  Button,
  Menu,
  TableSortLabel,
  keyframes,
} from "@mui/material";
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ViewAgenda as ViewAgendaIcon,
  ViewComfy as ViewComfyIcon,
  Sort as SortIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";

const PLATFORMS = ["Amazon", "Flipkart National", "Instamart", "Zepto", "BigBasket", "Blinkit"];

const MOCK_PDS_DATA = [
  {
    scoreId: 1,
    dmmhLever: "Assortment",
    dmmhSubLever: "Blockbuster Availability",
    target: "84.08%",
    weight: 35.0,
    score: "78.52%",
    weightedScore: "27.48",
    periodWSTarget: "36.69",
  },
  {
    scoreId: 3,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite generic search",
    target: "15.75%",
    weight: 15.0,
    score: "11.49%",
    weightedScore: "1.72",
    periodWSTarget: "13.47",
  },
  {
    scoreId: 4,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite branded search",
    target: "96.50%",
    weight: 10.0,
    score: "98.73%",
    weightedScore: "9.87",
    periodWSTarget: "9.70",
  },
  {
    scoreId: 6,
    dmmhLever: "Content",
    dmmhSubLever: "Quality hero image",
    target: "91.00%",
    weight: 8.5,
    score: "82.03%",
    weightedScore: "6.97",
    periodWSTarget: "9.13",
  },
  {
    scoreId: 7,
    dmmhLever: "Content",
    dmmhSubLever: "Secondary images",
    target: "88.92%",
    weight: 5.5,
    score: "80.16%",
    weightedScore: "4.41",
    periodWSTarget: "5.51",
  },
  {
    scoreId: 8,
    dmmhLever: "Content",
    dmmhSubLever: "Enhanced Content",
    target: "100.00%",
    weight: 1.0,
    score: "-",
    weightedScore: "-",
    periodWSTarget: "1.00",
  },
  {
    scoreId: 9,
    dmmhLever: "Content",
    dmmhSubLever: "Features & Benefits & Description",
    target: "74.22%",
    weight: 2.0,
    score: "56.09%",
    weightedScore: "1.12",
    periodWSTarget: "2.14",
  },
  {
    scoreId: 10,
    dmmhLever: "Content",
    dmmhSubLever: "Title full usage",
    target: "93.08%",
    weight: 8.0,
    score: "82.64%",
    weightedScore: "6.61",
    periodWSTarget: "7.18",
  },
  {
    scoreId: 11,
    dmmhLever: "Content",
    dmmhSubLever: "Ratings & Reviews",
    target: "74.00%",
    weight: 2.5,
    score: "69.36%",
    weightedScore: "1.73",
    periodWSTarget: "2.59",
  },
  {
    scoreId: 13,
    dmmhLever: "Interruption",
    dmmhSubLever: "Dual Siting & Tagging",
    target: "100.00%",
    weight: 2.5,
    score: "-",
    weightedScore: "-",
    periodWSTarget: "2.50",
  },
  {
    scoreId: 14,
    dmmhLever: "Data",
    dmmhSubLever: "Sell-out data by SKU",
    target: "100.00%",
    weight: 5.0,
    score: "100.00%",
    weightedScore: "5.00",
    periodWSTarget: "5.00",
  },
  {
    scoreId: 15,
    dmmhLever: "Data",
    dmmhSubLever: "Search term frequency",
    target: "100.00%",
    weight: 5.0,
    score: "100.00%",
    weightedScore: "5.00",
    periodWSTarget: "5.00",
  },
];

const AMAZON_DATA = [
  {
    scoreId: 1,
    dmmhLever: "Assortment",
    dmmhSubLever: "Blockbuster Availability",
    weight: 35.0,
    periods: {
      "Period 1": { target: "92%", weightedTarget: "32.20", score: "94.55%", weightedScore: "33.09" },
      "Period 2": { target: "95%", weightedTarget: "33.25", score: "92.29%", weightedScore: "32.30" },
      "Period 3": { target: "95%", weightedTarget: "33.25", score: "86.54%", weightedScore: "30.29" },
      "Period 4": { target: "88%", weightedTarget: "30.80", score: "94.74%", weightedScore: "33.16" },
      "Period 5": { target: "89%", weightedTarget: "31.15", score: "94.94%", weightedScore: "33.23" },
      "Period 6": { target: "90%", weightedTarget: "31.50", score: "94.93%", weightedScore: "33.23" },
    }
  },
  {
    scoreId: 3,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite generic search",
    weight: 15.0,
    periods: {
      "Period 1": { target: "25.00%", weightedTarget: "3.75", score: "21.13%", weightedScore: "3.17" },
      "Period 2": { target: "23.00%", weightedTarget: "3.45", score: "18.43%", weightedScore: "2.76" },
      "Period 3": { target: "23.00%", weightedTarget: "3.45", score: "17.23%", weightedScore: "2.58" },
      "Period 4": { target: "16.00%", weightedTarget: "2.40", score: "18.51%", weightedScore: "2.78" },
      "Period 5": { target: "20.00%", weightedTarget: "3.00", score: "15.00%", weightedScore: "2.25" },
      "Period 6": { target: "21.00%", weightedTarget: "3.15", score: "15.51%", weightedScore: "2.33" },
    }
  },
  {
    scoreId: 4,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite branded search",
    weight: 10.0,
    periods: {
      "Period 1": { target: "85.00%", weightedTarget: "8.50", score: "72.02%", weightedScore: "7.20" },
      "Period 2": { target: "75.00%", weightedTarget: "7.50", score: "76.82%", weightedScore: "7.68" },
      "Period 3": { target: "80.00%", weightedTarget: "8.00", score: "85.90%", weightedScore: "8.59" },
      "Period 4": { target: "88.00%", weightedTarget: "8.80", score: "70.00%", weightedScore: "7.00" },
      "Period 5": { target: "75.00%", weightedTarget: "7.50", score: "76.11%", weightedScore: "7.61" },
      "Period 6": { target: "76.00%", weightedTarget: "7.60", score: "83.20%", weightedScore: "8.32" },
    }
  },
  {
    scoreId: 6,
    dmmhLever: "Content",
    dmmhSubLever: "Quality hero image",
    weight: 7.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "7.00", score: "95.41%", weightedScore: "6.68" },
      "Period 2": { target: "100%", weightedTarget: "7.00", score: "95.58%", weightedScore: "6.69" },
      "Period 3": { target: "100%", weightedTarget: "7.00", score: "100%", weightedScore: "7.00" },
      "Period 4": { target: "100%", weightedTarget: "7.00", score: "100%", weightedScore: "7.00" },
      "Period 5": { target: "100%", weightedTarget: "7.00", score: "100%", weightedScore: "7.00" },
      "Period 6": { target: "100%", weightedTarget: "7.00", score: "100%", weightedScore: "7.00" },
    }
  },
  {
    scoreId: 7,
    dmmhLever: "Content",
    dmmhSubLever: "Secondary images",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "93.91%", weightedScore: "4.70" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "92.99%", weightedScore: "4.65" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "97.60%", weightedScore: "4.88" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "98.25%", weightedScore: "4.91" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "87.70%", weightedScore: "4.39" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "92.00%", weightedScore: "4.60" },
    }
  },
  {
    scoreId: 8,
    dmmhLever: "Content",
    dmmhSubLever: "Enhanced content",
    weight: 3.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "3.00", score: "100%", weightedScore: "3.00" },
      "Period 2": { target: "100%", weightedTarget: "3.00", score: "100%", weightedScore: "3.00" },
      "Period 3": { target: "100%", weightedTarget: "3.00", score: "100%", weightedScore: "3.00" },
      "Period 4": { target: "100%", weightedTarget: "3.00", score: "100%", weightedScore: "3.00" },
      "Period 5": { target: "100%", weightedTarget: "3.00", score: "100%", weightedScore: "3.00" },
      "Period 6": { target: "100%", weightedTarget: "3.00", score: "100%", weightedScore: "3.00" },
    }
  },
  {
    scoreId: 9,
    dmmhLever: "Content",
    dmmhSubLever: "Features & Benefits",
    weight: 3.0,
    periods: {
      "Period 1": { target: "60%", weightedTarget: "1.80", score: "64.13%", weightedScore: "1.92" },
      "Period 2": { target: "70%", weightedTarget: "2.10", score: "63.45%", weightedScore: "1.90" },
      "Period 3": { target: "70%", weightedTarget: "2.10", score: "59.52%", weightedScore: "1.79" },
      "Period 4": { target: "70%", weightedTarget: "2.10", score: "63.16%", weightedScore: "1.89" },
      "Period 5": { target: "65%", weightedTarget: "1.95", score: "58.00%", weightedScore: "1.74" },
      "Period 6": { target: "69%", weightedTarget: "2.07", score: "76.00%", weightedScore: "2.28" },
    }
  },
  {
    scoreId: 10,
    dmmhLever: "Content",
    dmmhSubLever: "Title full usage",
    weight: 7.0,
    periods: {
      "Period 1": { target: "90%", weightedTarget: "6.30", score: "84.40%", weightedScore: "5.91" },
      "Period 2": { target: "90%", weightedTarget: "6.30", score: "84.42%", weightedScore: "5.91" },
      "Period 3": { target: "90%", weightedTarget: "6.30", score: "92.79%", weightedScore: "6.50" },
      "Period 4": { target: "100%", weightedTarget: "7.00", score: "94.74%", weightedScore: "6.63" },
      "Period 5": { target: "96%", weightedTarget: "6.72", score: "84.00%", weightedScore: "5.88" },
      "Period 6": { target: "93%", weightedTarget: "6.51", score: "74.00%", weightedScore: "5.18" },
    }
  },
  {
    scoreId: 11,
    dmmhLever: "Content",
    dmmhSubLever: "Ratings & Reviews",
    weight: 5.0,
    periods: {
      "Period 1": { target: "75%", weightedTarget: "3.75", score: "69.54%", weightedScore: "3.48" },
      "Period 2": { target: "75%", weightedTarget: "3.75", score: "69.38%", weightedScore: "3.47" },
      "Period 3": { target: "75%", weightedTarget: "3.75", score: "63.53%", weightedScore: "3.18" },
      "Period 4": { target: "75%", weightedTarget: "3.75", score: "63.16%", weightedScore: "3.16" },
      "Period 5": { target: "64%", weightedTarget: "3.20", score: "74.00%", weightedScore: "3.70" },
      "Period 6": { target: "65%", weightedTarget: "3.25", score: "68.00%", weightedScore: "3.40" },
    }
  },
  {
    scoreId: 14,
    dmmhLever: "Data",
    dmmhSubLever: "Sell-out Data by SKU",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  },
  {
    scoreId: 15,
    dmmhLever: "Data",
    dmmhSubLever: "Search term frequency",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  }
];

const FKN_DATA = [
  {
    scoreId: 1,
    dmmhLever: "Assortment",
    dmmhSubLever: "Blockbuster Availability",
    weight: 35.0,
    periods: {
      "Period 1": { target: "90%", weightedTarget: "31.50", score: "81.19%", weightedScore: "28.42" },
      "Period 2": { target: "85%", weightedTarget: "29.75", score: "68.05%", weightedScore: "23.82" },
      "Period 3": { target: "70%", weightedTarget: "24.50", score: "51.67%", weightedScore: "18.08" },
      "Period 4": { target: "60%", weightedTarget: "21.00", score: "51.18%", weightedScore: "17.91" },
      "Period 5": { target: "65%", weightedTarget: "22.75", score: "64.89%", weightedScore: "22.71" },
      "Period 6": { target: "70%", weightedTarget: "24.50", score: "59.30%", weightedScore: "20.75" },
    }
  },
  {
    scoreId: 3,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite generic search",
    weight: 15.0,
    periods: {
      "Period 1": { target: "23.00%", weightedTarget: "3.45", score: "22.40%", weightedScore: "3.36" },
      "Period 2": { target: "25.00%", weightedTarget: "3.75", score: "23.01%", weightedScore: "3.45" },
      "Period 3": { target: "26.00%", weightedTarget: "3.90", score: "21.94%", weightedScore: "3.29" },
      "Period 4": { target: "18.00%", weightedTarget: "2.70", score: "12.83%", weightedScore: "1.92" },
      "Period 5": { target: "15.00%", weightedTarget: "2.25", score: "8.50%", weightedScore: "1.28" },
      "Period 6": { target: "18.00%", weightedTarget: "2.70", score: "11.20%", weightedScore: "1.68" },
    }
  },
  {
    scoreId: 4,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite branded search",
    weight: 10.0,
    periods: {
      "Period 1": { target: "90.00%", weightedTarget: "9.00", score: "83.88%", weightedScore: "8.39" },
      "Period 2": { target: "90.00%", weightedTarget: "9.00", score: "85.13%", weightedScore: "8.51" },
      "Period 3": { target: "90.00%", weightedTarget: "9.00", score: "70.31%", weightedScore: "7.03" },
      "Period 4": { target: "75.00%", weightedTarget: "7.50", score: "63.18%", weightedScore: "6.32" },
      "Period 5": { target: "63.00%", weightedTarget: "6.30", score: "42.30%", weightedScore: "4.23" },
      "Period 6": { target: "73.00%", weightedTarget: "7.30", score: "47.00%", weightedScore: "4.70" },
    }
  },
  {
    scoreId: 6,
    dmmhLever: "Content",
    dmmhSubLever: "Quality hero image",
    weight: 8.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "8.00", score: "99.83%", weightedScore: "7.99" },
      "Period 2": { target: "100%", weightedTarget: "8.00", score: "99.83%", weightedScore: "7.99" },
      "Period 3": { target: "100%", weightedTarget: "8.00", score: "100%", weightedScore: "8.00" },
      "Period 4": { target: "100%", weightedTarget: "8.00", score: "100%", weightedScore: "8.00" },
      "Period 5": { target: "100%", weightedTarget: "8.00", score: "100%", weightedScore: "8.00" },
      "Period 6": { target: "100%", weightedTarget: "8.00", score: "100%", weightedScore: "8.00" },
    }
  },
  {
    scoreId: 7,
    dmmhLever: "Content",
    dmmhSubLever: "Secondary images",
    weight: 6.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "6.00", score: "99.54%", weightedScore: "5.97" },
      "Period 2": { target: "100%", weightedTarget: "6.00", score: "99.52%", weightedScore: "5.97" },
      "Period 3": { target: "100%", weightedTarget: "6.00", score: "89.07%", weightedScore: "5.34" },
      "Period 4": { target: "100%", weightedTarget: "6.00", score: "86.67%", weightedScore: "5.20" },
      "Period 5": { target: "88%", weightedTarget: "5.28", score: "88.00%", weightedScore: "5.28" },
      "Period 6": { target: "90%", weightedTarget: "5.40", score: "90.00%", weightedScore: "5.40" },
    }
  },

  {
    scoreId: 9,
    dmmhLever: "Content",
    dmmhSubLever: "Features & Benefits",
    weight: 3.0,
    periods: {
      "Period 1": { target: "80%", weightedTarget: "2.40", score: "72.87%", weightedScore: "2.19" },
      "Period 2": { target: "80%", weightedTarget: "2.40", score: "73.11%", weightedScore: "2.19" },
      "Period 3": { target: "80%", weightedTarget: "2.40", score: "84.04%", weightedScore: "2.52" },
      "Period 4": { target: "90%", weightedTarget: "2.70", score: "85.00%", weightedScore: "2.55" },
      "Period 5": { target: "86%", weightedTarget: "2.58", score: "80.00%", weightedScore: "2.40" },
      "Period 6": { target: "84%", weightedTarget: "2.52", score: "90.00%", weightedScore: "2.70" },
    }
  },
  {
    scoreId: 10,
    dmmhLever: "Content",
    dmmhSubLever: "Title full usage",
    weight: 8.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "8.00", score: "98.96%", weightedScore: "7.92" },
      "Period 2": { target: "100%", weightedTarget: "8.00", score: "98.99%", weightedScore: "7.92" },
      "Period 3": { target: "100%", weightedTarget: "8.00", score: "95.96%", weightedScore: "7.68" },
      "Period 4": { target: "100%", weightedTarget: "8.00", score: "95.00%", weightedScore: "7.60" },
      "Period 5": { target: "97%", weightedTarget: "7.76", score: "100%", weightedScore: "8.00" },
      "Period 6": { target: "96%", weightedTarget: "7.68", score: "100%", weightedScore: "8.00" },
    }
  },
  {
    scoreId: 11,
    dmmhLever: "Content",
    dmmhSubLever: "Ratings & Reviews",
    weight: 5.0,
    periods: {
      "Period 1": { target: "80%", weightedTarget: "4.00", score: "81.74%", weightedScore: "4.09" },
      "Period 2": { target: "85%", weightedTarget: "4.25", score: "81.34%", weightedScore: "4.07" },
      "Period 3": { target: "85%", weightedTarget: "4.25", score: "94.23%", weightedScore: "4.71" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "90.00%", weightedScore: "4.50" },
      "Period 6": { target: "91%", weightedTarget: "4.55", score: "95.00%", weightedScore: "4.75" },
    }
  },
  {
    scoreId: 14,
    dmmhLever: "Data",
    dmmhSubLever: "Sell-out Data by SKU",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  },
  {
    scoreId: 15,
    dmmhLever: "Data",
    dmmhSubLever: "Search term frequency",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  }
];

const BIGBASKET_DATA = [
  {
    scoreId: 1,
    dmmhLever: "Assortment",
    dmmhSubLever: "Blockbuster Availability",
    weight: 35.0,
    periods: {
      "Period 1": { target: "90%", weightedTarget: "31.50", score: "86.62%", weightedScore: "30.32" },
      "Period 2": { target: "88%", weightedTarget: "30.80", score: "86.51%", weightedScore: "30.28" },
      "Period 3": { target: "88%", weightedTarget: "30.80", score: "83.80%", weightedScore: "29.33" },
      "Period 4": { target: "85%", weightedTarget: "29.75", score: "58.36%", weightedScore: "20.43" },
      "Period 5": { target: "87%", weightedTarget: "30.45", score: "78.41%", weightedScore: "27.44" },
      "Period 6": { target: "88%", weightedTarget: "30.80", score: "88.25%", weightedScore: "30.89" },
    }
  },
  {
    scoreId: 3,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite generic search",
    weight: 15.0,
    periods: {
      "Period 1": { target: "13.00%", weightedTarget: "1.95", score: "13.46%", weightedScore: "2.02" },
      "Period 2": { target: "15.00%", weightedTarget: "2.25", score: "13.23%", weightedScore: "1.98" },
      "Period 3": { target: "15.00%", weightedTarget: "2.25", score: "11.97%", weightedScore: "1.80" },
      "Period 4": { target: "13.00%", weightedTarget: "1.95", score: "12.53%", weightedScore: "1.88" },
      "Period 5": { target: "13.00%", weightedTarget: "1.95", score: "11.17%", weightedScore: "1.68" },
      "Period 6": { target: "14.00%", weightedTarget: "2.10", score: "14.90%", weightedScore: "2.24" },
    }
  },
  {
    scoreId: 4,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite branded search",
    weight: 10.0,
    periods: {
      "Period 1": { target: "90.00%", weightedTarget: "9.00", score: "87.28%", weightedScore: "8.73" },
      "Period 2": { target: "90.00%", weightedTarget: "9.00", score: "87.18%", weightedScore: "8.72" },
      "Period 3": { target: "90.00%", weightedTarget: "9.00", score: "86.22%", weightedScore: "8.62" },
      "Period 4": { target: "89.00%", weightedTarget: "8.90", score: "86.63%", weightedScore: "8.66" },
      "Period 5": { target: "88.00%", weightedTarget: "8.80", score: "85.91%", weightedScore: "8.59" },
      "Period 6": { target: "89.00%", weightedTarget: "8.90", score: "78.06%", weightedScore: "7.81" },
    }
  },
  {
    scoreId: 6,
    dmmhLever: "Content",
    dmmhSubLever: "Quality hero image",
    weight: 8.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "8.00", score: "97.32%", weightedScore: "7.79" },
      "Period 2": { target: "100%", weightedTarget: "8.00", score: "97.24%", weightedScore: "7.78" },
      "Period 3": { target: "100%", weightedTarget: "8.00", score: "99.00%", weightedScore: "7.92" },
      "Period 4": { target: "100%", weightedTarget: "8.00", score: "95.00%", weightedScore: "7.60" },
      "Period 5": { target: "97%", weightedTarget: "7.76", score: "100%", weightedScore: "8.00" },
      "Period 6": { target: "98%", weightedTarget: "7.84", score: "100%", weightedScore: "8.00" },
    }
  },
  {
    scoreId: 7,
    dmmhLever: "Content",
    dmmhSubLever: "Secondary images",
    weight: 6.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "6.00", score: "94.05%", weightedScore: "5.64" },
      "Period 2": { target: "100%", weightedTarget: "6.00", score: "94.11%", weightedScore: "5.65" },
      "Period 3": { target: "100%", weightedTarget: "6.00", score: "89.35%", weightedScore: "5.36" },
      "Period 4": { target: "100%", weightedTarget: "6.00", score: "83.33%", weightedScore: "5.00" },
      "Period 5": { target: "85%", weightedTarget: "5.10", score: "91.00%", weightedScore: "5.46" },
      "Period 6": { target: "89%", weightedTarget: "5.34", score: "99.00%", weightedScore: "5.94" },
    }
  },
  {
    scoreId: 9,
    dmmhLever: "Content",
    dmmhSubLever: "Features & Benefits",
    weight: 3.0,
    periods: {
      "Period 1": { target: "75%", weightedTarget: "2.25", score: "71.25%", weightedScore: "2.14" },
      "Period 2": { target: "75%", weightedTarget: "2.25", score: "71.21%", weightedScore: "2.14" },
      "Period 3": { target: "75%", weightedTarget: "2.25", score: "76.06%", weightedScore: "2.28" },
      "Period 4": { target: "80%", weightedTarget: "2.40", score: "77.50%", weightedScore: "2.33" },
      "Period 5": { target: "79%", weightedTarget: "2.37", score: "75.00%", weightedScore: "2.25" },
      "Period 6": { target: "76%", weightedTarget: "2.28", score: "85.00%", weightedScore: "2.55" },
    }
  },
  {
    scoreId: 10,
    dmmhLever: "Content",
    dmmhSubLever: "Title full usage",
    weight: 8.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "8.00", score: "99.82%", weightedScore: "7.99" },
      "Period 2": { target: "100%", weightedTarget: "8.00", score: "99.83%", weightedScore: "7.99" },
      "Period 3": { target: "100%", weightedTarget: "8.00", score: "100%", weightedScore: "8.00" },
      "Period 4": { target: "100%", weightedTarget: "8.00", score: "100%", weightedScore: "8.00" },
      "Period 5": { target: "90%", weightedTarget: "7.20", score: "100%", weightedScore: "8.00" },
      "Period 6": { target: "100%", weightedTarget: "8.00", score: "100%", weightedScore: "8.00" },
    }
  },
  {
    scoreId: 11,
    dmmhLever: "Content",
    dmmhSubLever: "Ratings & Reviews",
    weight: 5.0,
    periods: {
      "Period 1": { target: "60%", weightedTarget: "3.00", score: "53.04%", weightedScore: "2.65" },
      "Period 2": { target: "60%", weightedTarget: "3.00", score: "52.76%", weightedScore: "2.64" },
      "Period 3": { target: "60%", weightedTarget: "3.00", score: "40.96%", weightedScore: "2.05" },
      "Period 4": { target: "55%", weightedTarget: "2.75", score: "40.00%", weightedScore: "2.00" },
      "Period 5": { target: "43%", weightedTarget: "2.15", score: "40.00%", weightedScore: "2.00" },
      "Period 6": { target: "45%", weightedTarget: "2.25", score: "80.00%", weightedScore: "4.00" },
    }
  },
  {
    scoreId: 14,
    dmmhLever: "Data",
    dmmhSubLever: "Sell-out Data by SKU",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  },
  {
    scoreId: 15,
    dmmhLever: "Data",
    dmmhSubLever: "Search term frequency",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  }
];

const BLINKIT_DATA = [
  {
    scoreId: 1,
    dmmhLever: "Assortment",
    dmmhSubLever: "Blockbuster Availability",
    weight: 35.0,
    periods: {
      "Period 1": { target: "85%", weightedTarget: "29.75", score: "85.15%", weightedScore: "29.80" },
      "Period 2": { target: "88%", weightedTarget: "30.80", score: "85.33%", weightedScore: "29.87" },
      "Period 3": { target: "88%", weightedTarget: "30.80", score: "82.22%", weightedScore: "28.78" },
      "Period 4": { target: "85%", weightedTarget: "29.75", score: "90.58%", weightedScore: "31.70" },
      "Period 5": { target: "85%", weightedTarget: "29.75", score: "88.58%", weightedScore: "31.00" },
      "Period 6": { target: "86%", weightedTarget: "30.10", score: "90.59%", weightedScore: "31.71" },
    }
  },
  {
    scoreId: 3,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite generic search",
    weight: 15.0,
    periods: {
      "Period 1": { target: "21.00%", weightedTarget: "3.15", score: "13.72%", weightedScore: "2.06" },
      "Period 2": { target: "16.00%", weightedTarget: "2.40", score: "12.37%", weightedScore: "1.86" },
      "Period 3": { target: "15.00%", weightedTarget: "2.25", score: "13.76%", weightedScore: "2.06" },
      "Period 4": { target: "12.00%", weightedTarget: "1.80", score: "11.69%", weightedScore: "1.75" },
      "Period 5": { target: "14.00%", weightedTarget: "2.10", score: "16.20%", weightedScore: "2.43" },
      "Period 6": { target: "16.00%", weightedTarget: "2.40", score: "14.54%", weightedScore: "2.18" },
    }
  },
  {
    scoreId: 4,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite branded search",
    weight: 10.0,
    periods: {
      "Period 1": { target: "70.00%", weightedTarget: "7.00", score: "59.43%", weightedScore: "5.94" },
      "Period 2": { target: "70.00%", weightedTarget: "7.00", score: "69.72%", weightedScore: "6.97" },
      "Period 3": { target: "80.00%", weightedTarget: "8.00", score: "67.15%", weightedScore: "6.72" },
      "Period 4": { target: "70.00%", weightedTarget: "7.00", score: "69.33%", weightedScore: "6.93" },
      "Period 5": { target: "72.00%", weightedTarget: "7.20", score: "71.50%", weightedScore: "7.15" },
      "Period 6": { target: "76.00%", weightedTarget: "7.60", score: "73.00%", weightedScore: "7.30" },
    }
  },
  {
    scoreId: 6,
    dmmhLever: "Content",
    dmmhSubLever: "Quality hero image",
    weight: 9.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "9.00", score: "99.60%", weightedScore: "8.96" },
      "Period 2": { target: "100%", weightedTarget: "9.00", score: "99.62%", weightedScore: "8.97" },
      "Period 3": { target: "100%", weightedTarget: "9.00", score: "100%", weightedScore: "9.00" },
      "Period 4": { target: "100%", weightedTarget: "9.00", score: "100%", weightedScore: "9.00" },
      "Period 5": { target: "100%", weightedTarget: "9.00", score: "100%", weightedScore: "9.00" },
      "Period 6": { target: "100%", weightedTarget: "9.00", score: "100%", weightedScore: "9.00" },
    }
  },
  {
    scoreId: 7,
    dmmhLever: "Content",
    dmmhSubLever: "Secondary images",
    weight: 5.0,
    periods: {
      "Period 1": { target: "95%", weightedTarget: "4.75", score: "92.92%", weightedScore: "4.65" },
      "Period 2": { target: "95%", weightedTarget: "4.75", score: "92.99%", weightedScore: "4.65" },
      "Period 3": { target: "95%", weightedTarget: "4.75", score: "93.25%", weightedScore: "4.66" },
      "Period 4": { target: "95%", weightedTarget: "4.75", score: "92.98%", weightedScore: "4.65" },
      "Period 5": { target: "93%", weightedTarget: "4.65", score: "91.00%", weightedScore: "4.55" },
      "Period 6": { target: "94%", weightedTarget: "4.70", score: "98.00%", weightedScore: "4.90" },
    }
  },
  {
    scoreId: 9,
    dmmhLever: "Content",
    dmmhSubLever: "Features & Benefits",
    weight: 3.0,
    periods: {
      "Period 1": { target: "95%", weightedTarget: "2.85", score: "91.47%", weightedScore: "2.74" },
      "Period 2": { target: "95%", weightedTarget: "2.85", score: "91.50%", weightedScore: "2.75" },
      "Period 3": { target: "95%", weightedTarget: "2.85", score: "74.85%", weightedScore: "2.25" },
      "Period 4": { target: "90%", weightedTarget: "2.70", score: "71.05%", weightedScore: "2.13" },
      "Period 5": { target: "75%", weightedTarget: "2.25", score: "74.00%", weightedScore: "2.22" },
      "Period 6": { target: "78%", weightedTarget: "2.34", score: "95.00%", weightedScore: "2.85" },
    }
  },
  {
    scoreId: 10,
    dmmhLever: "Content",
    dmmhSubLever: "Title full usage",
    weight: 8.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "8.00", score: "79.76%", weightedScore: "6.38" },
      "Period 2": { target: "90%", weightedTarget: "7.20", score: "80.50%", weightedScore: "6.44" },
      "Period 3": { target: "90%", weightedTarget: "7.20", score: "69.94%", weightedScore: "5.60" },
      "Period 4": { target: "85%", weightedTarget: "6.80", score: "63.16%", weightedScore: "5.05" },
      "Period 5": { target: "65%", weightedTarget: "5.20", score: "84.20%", weightedScore: "6.74" },
      "Period 6": { target: "69%", weightedTarget: "5.52", score: "84.00%", weightedScore: "6.72" },
    }
  },
  {
    scoreId: 13,
    dmmhLever: "interruption",
    dmmhSubLever: "Dual Sitting & Tagging",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  },
  {
    scoreId: 14,
    dmmhLever: "Data",
    dmmhSubLever: "Sell-out Data by SKU",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  },
  {
    scoreId: 15,
    dmmhLever: "Data",
    dmmhSubLever: "Search term frequency",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  }
];

const ZEPTO_DATA = [
  {
    scoreId: 1,
    dmmhLever: "Assortment",
    dmmhSubLever: "Blockbuster Availability",
    weight: 35.0,
    periods: {
      "Period 1": { target: "82%", weightedTarget: "28.70", score: "90.17%", weightedScore: "31.56" },
      "Period 2": { target: "92%", weightedTarget: "32.20", score: "88.44%", weightedScore: "30.95" },
      "Period 3": { target: "90%", weightedTarget: "31.50", score: "86.93%", weightedScore: "30.43" },
      "Period 4": { target: "88%", weightedTarget: "30.80", score: "86.69%", weightedScore: "30.34" },
      "Period 5": { target: "89%", weightedTarget: "31.15", score: "96.35%", weightedScore: "33.72" },
      "Period 6": { target: "90%", weightedTarget: "31.50", score: "98.20%", weightedScore: "34.37" },
    }
  },
  {
    scoreId: 3,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite generic search",
    weight: 15.0,
    periods: {
      "Period 1": { target: "23.00%", weightedTarget: "3.45", score: "18.51%", weightedScore: "2.78" },
      "Period 2": { target: "21.00%", weightedTarget: "3.15", score: "16.35%", weightedScore: "2.45" },
      "Period 3": { target: "20.00%", weightedTarget: "3.00", score: "17.36%", weightedScore: "2.60" },
      "Period 4": { target: "16.00%", weightedTarget: "2.40", score: "16.43%", weightedScore: "2.46" },
      "Period 5": { target: "19.00%", weightedTarget: "2.85", score: "15.00%", weightedScore: "2.25" },
      "Period 6": { target: "20.00%", weightedTarget: "3.00", score: "13.10%", weightedScore: "1.97" },
    }
  },
  {
    scoreId: 4,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite branded search",
    weight: 10.0,
    periods: {
      "Period 1": { target: "55.00%", weightedTarget: "5.50", score: "58.16%", weightedScore: "5.82" },
      "Period 2": { target: "70.00%", weightedTarget: "7.00", score: "72.12%", weightedScore: "7.21" },
      "Period 3": { target: "80.00%", weightedTarget: "8.00", score: "71.14%", weightedScore: "7.11" },
      "Period 4": { target: "75.00%", weightedTarget: "7.50", score: "70.74%", weightedScore: "7.07" },
      "Period 5": { target: "70.00%", weightedTarget: "7.00", score: "55.20%", weightedScore: "5.52" },
      "Period 6": { target: "76.00%", weightedTarget: "7.60", score: "54.00%", weightedScore: "5.40" },
    }
  },
  {
    scoreId: 6,
    dmmhLever: "Content",
    dmmhSubLever: "Quality hero image",
    weight: 10.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "10.00", score: "100%", weightedScore: "10.00" },
      "Period 2": { target: "100%", weightedTarget: "10.00", score: "100%", weightedScore: "10.00" },
      "Period 3": { target: "100%", weightedTarget: "10.00", score: "95.75%", weightedScore: "9.58" },
      "Period 4": { target: "100%", weightedTarget: "10.00", score: "95.00%", weightedScore: "9.50" },
      "Period 5": { target: "97%", weightedTarget: "9.70", score: "100%", weightedScore: "10.00" },
      "Period 6": { target: "98%", weightedTarget: "9.80", score: "100%", weightedScore: "10.00" },
    }
  },
  {
    scoreId: 7,
    dmmhLever: "Content",
    dmmhSubLever: "Secondary images",
    weight: 6.0,
    periods: {
      "Period 1": { target: "85%", weightedTarget: "5.10", score: "84.01%", weightedScore: "5.04" },
      "Period 2": { target: "85%", weightedTarget: "5.10", score: "84.11%", weightedScore: "5.05" },
      "Period 3": { target: "85%", weightedTarget: "5.10", score: "88.26%", weightedScore: "5.30" },
      "Period 4": { target: "95%", weightedTarget: "5.70", score: "88.60%", weightedScore: "5.32" },
      "Period 5": { target: "90%", weightedTarget: "5.40", score: "93.00%", weightedScore: "5.58" },
      "Period 6": { target: "88%", weightedTarget: "5.28", score: "97.00%", weightedScore: "5.82" },
    }
  },
  {
    scoreId: 10,
    dmmhLever: "Content",
    dmmhSubLever: "Title full usage",
    weight: 9.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "9.00", score: "100.00%", weightedScore: "9.00" },
      "Period 2": { target: "100%", weightedTarget: "9.00", score: "100%", weightedScore: "9.00" },
      "Period 3": { target: "100%", weightedTarget: "9.00", score: "100%", weightedScore: "9.00" },
      "Period 4": { target: "100%", weightedTarget: "9.00", score: "100%", weightedScore: "9.00" },
      "Period 5": { target: "100%", weightedTarget: "9.00", score: "95.00%", weightedScore: "8.55" },
      "Period 6": { target: "100%", weightedTarget: "9.00", score: "94.00%", weightedScore: "8.46" },
    }
  },
  {
    scoreId: 13,
    dmmhLever: "interruption",
    dmmhSubLever: "Dual Sitting & Tagging",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  },
  {
    scoreId: 14,
    dmmhLever: "Data",
    dmmhSubLever: "Sell-out Data by SKU",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  },
  {
    scoreId: 15,
    dmmhLever: "Data",
    dmmhSubLever: "Search term frequency",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  }
];

const INSTAMART_DATA = [
  {
    scoreId: 1,
    dmmhLever: "Assortment",
    dmmhSubLever: "Blockbuster Availability",
    weight: 35.0,
    periods: {
      "Period 1": { target: "75%", weightedTarget: "26.25", score: "76.66%", weightedScore: "26.83" },
      "Period 2": { target: "80%", weightedTarget: "28.00", score: "76.88%", weightedScore: "26.91" },
      "Period 3": { target: "80%", weightedTarget: "28.00", score: "67.38%", weightedScore: "23.58" },
      "Period 4": { target: "72%", weightedTarget: "25.20", score: "72.35%", weightedScore: "25.32" },
      "Period 5": { target: "73%", weightedTarget: "25.55", score: "78.10%", weightedScore: "27.34" },
      "Period 6": { target: "74%", weightedTarget: "25.90", score: "79.72%", weightedScore: "27.90" },
    }
  },
  {
    scoreId: 3,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite generic search",
    weight: 14.0,
    periods: {
      "Period 1": { target: "14.00%", weightedTarget: "1.96", score: "15.19%", weightedScore: "2.13" },
      "Period 2": { target: "17.00%", weightedTarget: "2.38", score: "14.20%", weightedScore: "1.99" },
      "Period 3": { target: "17.00%", weightedTarget: "2.38", score: "9.85%", weightedScore: "1.38" },
      "Period 4": { target: "10.00%", weightedTarget: "1.40", score: "8.50%", weightedScore: "1.19" },
      "Period 5": { target: "11.00%", weightedTarget: "1.54", score: "9.50%", weightedScore: "1.33" },
      "Period 6": { target: "12%", weightedTarget: "1.68", score: "8.90%", weightedScore: "1.25" },
    }
  },
  {
    scoreId: 4,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite branded search",
    weight: 10.0,
    periods: {
      "Period 1": { target: "80.00%", weightedTarget: "8.00", score: "79.15%", weightedScore: "7.92" },
      "Period 2": { target: "85.00%", weightedTarget: "8.50", score: "73.71%", weightedScore: "7.37" },
      "Period 3": { target: "85.00%", weightedTarget: "8.50", score: "83.72%", weightedScore: "8.37" },
      "Period 4": { target: "80%", weightedTarget: "8.00", score: "84.12%", weightedScore: "8.41" },
      "Period 5": { target: "80.00%", weightedTarget: "8.00", score: "85.08%", weightedScore: "8.51" },
      "Period 6": { target: "84%", weightedTarget: "8.40", score: "88.12%", weightedScore: "8.81" },
    }
  },
  {
    scoreId: 6,
    dmmhLever: "Content",
    dmmhSubLever: "Quality hero image",
    weight: 10.0,
    periods: {
      "Period 1": { target: "96%", weightedTarget: "9.60", score: "97.02%", weightedScore: "9.70" },
      "Period 2": { target: "96%", weightedTarget: "9.60", score: "97.13%", weightedScore: "9.71" },
      "Period 3": { target: "96%", weightedTarget: "9.60", score: "100%", weightedScore: "10.00" },
      "Period 4": { target: "96%", weightedTarget: "9.60", score: "100%", weightedScore: "10.00" },
      "Period 5": { target: "94%", weightedTarget: "9.40", score: "100%", weightedScore: "10.00" },
      "Period 6": { target: "96%", weightedTarget: "9.60", score: "100%", weightedScore: "10.00" },
    }
  },
  {
    scoreId: 7,
    dmmhLever: "Content",
    dmmhSubLever: "Secondary images",
    weight: 6.0,
    periods: {
      "Period 1": { target: "60%", weightedTarget: "3.60", score: "77.53%", weightedScore: "4.65" },
      "Period 2": { target: "60%", weightedTarget: "3.60", score: "78.16%", weightedScore: "4.69" },
      "Period 3": { target: "90%", weightedTarget: "5.40", score: "97.14%", weightedScore: "5.83" },
      "Period 4": { target: "100%", weightedTarget: "6.00", score: "97.80%", weightedScore: "5.87" },
      "Period 5": { target: "69%", weightedTarget: "4.14", score: "96.70%", weightedScore: "5.80" },
      "Period 6": { target: "68%", weightedTarget: "4.08", score: "95%", weightedScore: "5.70" },
    }
  },
  {
    scoreId: 10,
    dmmhLever: "Content",
    dmmhSubLever: "Title full usage",
    weight: 9.0,
    periods: {
      "Period 1": { target: "98%", weightedTarget: "8.82", score: "97.02%", weightedScore: "8.73" },
      "Period 2": { target: "98%", weightedTarget: "8.82", score: "97.13%", weightedScore: "8.74" },
      "Period 3": { target: "98%", weightedTarget: "8.82", score: "100%", weightedScore: "9.00" },
      "Period 4": { target: "100%", weightedTarget: "9.00", score: "100%", weightedScore: "9.00" },
      "Period 5": { target: "100%", weightedTarget: "9.00", score: "100%", weightedScore: "9.00" },
      "Period 6": { target: "94%", weightedTarget: "8.46", score: "94%", weightedScore: "8.46" },
    }
  },
  {
    scoreId: 13,
    dmmhLever: "interruption",
    dmmhSubLever: "Dual Sitting & Tagging",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  },
  {
    scoreId: 14,
    dmmhLever: "Data",
    dmmhSubLever: "Sell-out Data by SKU",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  },
  {
    scoreId: 15,
    dmmhLever: "Data",
    dmmhSubLever: "Search term frequency",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
    }
  }
];

const getTableData = (platform, period) => {
  if (platform === "Amazon") {
    return AMAZON_DATA.map(row => ({
      scoreId: row.scoreId,
      dmmhLever: row.dmmhLever,
      dmmhSubLever: row.dmmhSubLever,
      weight: row.weight,
      target: row.periods[period]?.target || "-",
      weightedTarget: row.periods[period]?.weightedTarget || "-",
      score: row.periods[period]?.score || "-",
      weightedScore: row.periods[period]?.weightedScore || "-"
    }));
  }
  
  if (platform === "Flipkart National") {
    return FKN_DATA.map(row => ({
      scoreId: row.scoreId,
      dmmhLever: row.dmmhLever,
      dmmhSubLever: row.dmmhSubLever,
      weight: row.weight,
      target: row.periods[period]?.target || "-",
      weightedTarget: row.periods[period]?.weightedTarget || "-",
      score: row.periods[period]?.score || "-",
      weightedScore: row.periods[period]?.weightedScore || "-"
    }));
  }

  if (platform === "BigBasket") {
    return BIGBASKET_DATA.map(row => ({
      scoreId: row.scoreId,
      dmmhLever: row.dmmhLever,
      dmmhSubLever: row.dmmhSubLever,
      weight: row.weight,
      target: row.periods[period]?.target || "-",
      weightedTarget: row.periods[period]?.weightedTarget || "-",
      score: row.periods[period]?.score || "-",
      weightedScore: row.periods[period]?.weightedScore || "-"
    }));
  }

  if (platform === "Blinkit") {
    return BLINKIT_DATA.map(row => ({
      scoreId: row.scoreId,
      dmmhLever: row.dmmhLever,
      dmmhSubLever: row.dmmhSubLever,
      weight: row.weight,
      target: row.periods[period]?.target || "-",
      weightedTarget: row.periods[period]?.weightedTarget || "-",
      score: row.periods[period]?.score || "-",
      weightedScore: row.periods[period]?.weightedScore || "-"
    }));
  }

  if (platform === "Zepto") {
    return ZEPTO_DATA.map(row => ({
      scoreId: row.scoreId,
      dmmhLever: row.dmmhLever,
      dmmhSubLever: row.dmmhSubLever,
      weight: row.weight,
      target: row.periods[period]?.target || "-",
      weightedTarget: row.periods[period]?.weightedTarget || "-",
      score: row.periods[period]?.score || "-",
      weightedScore: row.periods[period]?.weightedScore || "-"
    }));
  }

  if (platform === "Instamart") {
    return INSTAMART_DATA.map(row => ({
      scoreId: row.scoreId,
      dmmhLever: row.dmmhLever,
      dmmhSubLever: row.dmmhSubLever,
      weight: row.weight,
      target: row.periods[period]?.target || "-",
      weightedTarget: row.periods[period]?.weightedTarget || "-",
      score: row.periods[period]?.score || "-",
      weightedScore: row.periods[period]?.weightedScore || "-"
    }));
  }

  // fallback for other platforms
  return MOCK_PDS_DATA.map(row => {
    const w = parseFloat(row.weight);
    const t = parseFloat(row.target);
    const wt = isNaN(w) || isNaN(t) ? "-" : ((w * t) / 100).toFixed(2);
    
    return {
      scoreId: row.scoreId,
      dmmhLever: row.dmmhLever,
      dmmhSubLever: row.dmmhSubLever,
      weight: row.weight,
      target: row.target,
      weightedTarget: wt,
      score: row.score,
      weightedScore: row.weightedScore
    };
  });
};

export default function PDSScore() {
  const { platform, selectedBrand } = useContext(FilterContext);

  const [selectedPlatform, setSelectedPlatform] = useState("Amazon");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedPeriod, setSelectedPeriod] = useState("Period 1");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("compact");
  const [sortConfig, setSortConfig] = useState({ key: "scoreId", direction: "asc" });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (platform && PLATFORMS.includes(platform)) {
      setSelectedPlatform(platform);
    }
  }, [platform]);


  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedPlatform, selectedYear, selectedPeriod, searchTerm]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const currentData = getTableData(selectedPlatform, selectedPeriod);

  const filteredData = currentData.filter((row) => {
    const matchesSearch = Object.values(row).some(
      (val) =>
        val &&
        val.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
    return matchesSearch;
  });

  // Sort data
  const sortData = (data) => {
    return [...data].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (["scoreId", "weight", "score", "target", "weightedScore", "weightedTarget"].includes(sortConfig.key)) {
          aValue = parseFloat(String(aValue).replace('%', '')) || 0;
          bValue = parseFloat(String(bValue).replace('%', '')) || 0;
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  };

  const sortedFilteredData = sortData(filteredData);

  const getScoreBadgeColor = (score) => {
    if (score === "-") return { bg: "#f3f4f6", text: "#6b7280" };
    const numScore = parseFloat(score);
    if (numScore >= 90) return { bg: "#d1fae5", text: "#065f46" };
    if (numScore >= 75) return { bg: "#dbeafe", text: "#0c4a6e" };
    if (numScore >= 60) return { bg: "#fed7aa", text: "#92400e" };
    return { bg: "#fee2e2", text: "#991b1b" };
  };

  const leverBackgroundColors = {
    Assortment: "#FCEAEA", // Very light pink
    Search: "#FFF4D4", // Very light orange/yellow
    Content: "#EBF5FB", // Very light blue
    Interruption: "#E1F2FB", // Very light sky blue
    Data: "#F4F6F6", // Very light grey
  };

  const blink = keyframes`
    0% { opacity: .2; }
    20% { opacity: 1; }
    100% { opacity: .2; }
  `;

  const DotLoader = () => (
    <Box component="span" sx={{ display: 'inline-flex', fontWeight: 700, fontSize: '1.1rem', ml: 0.5 }}>
      <Box component="span" sx={{ animation: `${blink} 1.4s infinite both`, animationDelay: '0s' }}>.</Box>
      <Box component="span" sx={{ animation: `${blink} 1.4s infinite both`, animationDelay: '0.2s' }}>.</Box>
      <Box component="span" sx={{ animation: `${blink} 1.4s infinite both`, animationDelay: '0.4s' }}>.</Box>
    </Box>
  );

  const calculateTotal = (key) => {
    return currentData.reduce((acc, row) => {
      const val = parseFloat(row[key]);
      return acc + (isNaN(val) ? 0 : val);
    }, 0).toFixed(2);
  };

  const totalTarget = calculateTotal("weightedTarget");
  const totalAchievement = calculateTotal("weightedScore");

  return (
    <CommonContainer title="PDS Score" hideFilters={true}>
      <Box sx={{ p: 2 }}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            bgcolor: "#fff",
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 4, flexWrap: 'wrap' }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: "#0052a3", letterSpacing: 1, textTransform: "uppercase" }}>
              TOTAL PDS SCORE
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ bgcolor: "#0052a3", color: "white", px: 2.5, py: 0.5, display: 'flex', alignItems: 'center', gap: 1, boxShadow: '0 4px 12px rgba(0,82,163,0.3)', borderRadius: '99px' }}>
                <Typography sx={{ fontWeight: 500, fontSize: '0.85rem' }}>Achievement :</Typography>
                {isLoading ? (
                  <DotLoader />
                ) : (
                  <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{totalAchievement}</Typography>
                )}
              </Box>
              <Box sx={{ bgcolor: "#0052a3", color: "white", px: 2.5, py: 0.5, display: 'flex', alignItems: 'center', gap: 1, boxShadow: '0 4px 12px rgba(0,82,163,0.3)', borderRadius: '99px' }}>
                <Typography sx={{ fontWeight: 500, fontSize: '0.85rem' }}>Target :</Typography>
                {isLoading ? (
                  <DotLoader />
                ) : (
                  <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{totalTarget}</Typography>
                )}
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              border: "1px solid #e2e8f0",
              borderRadius: '12px',
              overflow: "hidden",
            }}
          >
          {/* Filter and Search Bar */}
          <Box
            sx={{
              p: 1.5,
              bgcolor: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                Filter:
              </Typography>

              {/* Platform Filter */}
              <Select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                IconComponent={ExpandMoreIcon}
                sx={{
                  bgcolor: "#fff",
                  color: "#374151",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  borderRadius: "99px",
                  border: "1px solid #cbd5e1",
                  transition: "all 0.2s ease",
                  "&:hover": { borderColor: "#94a3b8" },
                  "& .MuiSelect-select": {
                    paddingTop: "4px",
                    paddingBottom: "4px",
                    paddingLeft: "12px",
                    paddingRight: "24px",
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    border: "none",
                  },
                  "& .MuiSvgIcon-root": {
                    color: "#6b7280",
                    fontSize: "1rem",
                  },
                  minWidth: 130,
                }}
              >
                {PLATFORMS.map((p) => (
                  <MenuItem key={p} value={p} sx={{ fontSize: "0.75rem" }}>
                    {p}
                  </MenuItem>
                ))}
              </Select>

              {/* Year Filter */}
              <Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                IconComponent={ExpandMoreIcon}
                sx={{
                  bgcolor: "#fff",
                  color: "#374151",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  borderRadius: "99px",
                  border: "1px solid #cbd5e1",
                  transition: "all 0.2s ease",
                  "&:hover": { borderColor: "#94a3b8" },
                  "& .MuiSelect-select": {
                    paddingTop: "4px",
                    paddingBottom: "4px",
                    paddingLeft: "12px",
                    paddingRight: "24px",
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    border: "none",
                  },
                  "& .MuiSvgIcon-root": {
                    color: "#6b7280",
                    fontSize: "1rem",
                  },
                  minWidth: 110,
                }}
              >
                <MenuItem value="2026" sx={{ fontSize: "0.75rem" }}>2026</MenuItem>
              </Select>

              {/* Period Filter */}
              <Select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                IconComponent={ExpandMoreIcon}
                sx={{
                  bgcolor: "#fff",
                  color: "#374151",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  borderRadius: "99px",
                  border: "1px solid #cbd5e1",
                  transition: "all 0.2s ease",
                  "&:hover": { borderColor: "#94a3b8" },
                  "& .MuiSelect-select": {
                    paddingTop: "4px",
                    paddingBottom: "4px",
                    paddingLeft: "12px",
                    paddingRight: "24px",
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    border: "none",
                  },
                  "& .MuiSvgIcon-root": {
                    color: "#6b7280",
                    fontSize: "1rem",
                  },
                  minWidth: 110,
                }}
              >
                <MenuItem value="Period 1" sx={{ fontSize: "0.75rem" }}>Period 1</MenuItem>
                <MenuItem value="Period 2" sx={{ fontSize: "0.75rem" }}>Period 2</MenuItem>
                <MenuItem value="Period 3" sx={{ fontSize: "0.75rem" }}>Period 3</MenuItem>
                <MenuItem value="Period 4" sx={{ fontSize: "0.75rem" }}>Period 4</MenuItem>
                <MenuItem value="Period 5" sx={{ fontSize: "0.75rem" }}>Period 5</MenuItem>
                <MenuItem value="Period 6" sx={{ fontSize: "0.75rem" }}>Period 6</MenuItem>
              </Select>
            </Box>

            {/* Search Bar */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                bgcolor: "#fff",
                border: "1px solid #cbd5e1",
                borderRadius: "99px",
                px: 2,
                py: 0.6,
                minWidth: 250,
                transition: "all 0.2s ease",
                "&:hover": { borderColor: "#94a3b8" },
              }}
            >
              <SearchIcon sx={{ color: "#9ca3af", fontSize: "1.1rem" }} />
              <InputBase
                placeholder="Search by ID, Lever, or Sub-Lever..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{
                  flex: 1,
                  fontSize: "0.875rem",
                  color: "#1f2937",
                  "& ::placeholder": {
                    color: "#9ca3af",
                    opacity: 1,
                  },
                }}
              />
            </Box>
          </Box>

          {/* Table */}
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              <TrailyticsTypewriterLoader size={1.1} message="Analyzing KPI correlations..." />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table sx={{ minWidth: "100%", "& th, & td": { borderRight: "1px solid #e5e7eb" }, "& th:last-child, & td:last-child": { borderRight: "none" } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "#f3f4f6" }}>
                  {[
                    { id: "scoreId", label: "Score ID", width: "8%", align: "center", sortable: false },
                    { id: "dmmhLever", label: "DMMH Lever", width: "12%", align: "left", sortable: false },
                    { id: "dmmhSubLever", label: "DMMH Sub-Lever", width: "22%", align: "left", sortable: false },
                    { id: "target", label: "Target", width: "10%", align: "center", sortable: true },
                    { id: "weight", label: "Weight", width: "10%", align: "center", sortable: true },
                    { id: "score", label: "Score", width: "10%", align: "center", sortable: true },
                    { id: "weightedScore", label: "Wt Score", width: "10%", align: "center", sortable: true },
                    { id: "weightedTarget", label: "Wt Target", width: "10%", align: "center", sortable: true },
                  ].map((headCell) => (
                    <TableCell
                      key={headCell.id}
                      align={headCell.align}
                      sx={{
                        fontWeight: 700,
                        color: "#374151",
                        fontSize: "0.8rem",
                        py: 1.5,
                        px: 2,
                        width: headCell.width,
                      }}
                    >
                      {headCell.sortable ? (
                        <TableSortLabel
                          active={sortConfig.key === headCell.id}
                          direction={sortConfig.key === headCell.id ? sortConfig.direction : 'asc'}
                          onClick={() => handleSort(headCell.id)}
                          sx={{
                            "& .MuiTableSortLabel-icon": {
                              opacity: 0.3,
                            },
                            "&.Mui-active .MuiTableSortLabel-icon": {
                              opacity: 1,
                              color: "#0052a3",
                            },
                          }}
                        >
                          {headCell.label}
                        </TableSortLabel>
                      ) : (
                        headCell.label
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedFilteredData.map((row, idx) => (
                  <TableRow
                    key={idx}
                    sx={{
                      backgroundColor: leverBackgroundColors[row.dmmhLever] || (idx % 2 === 0 ? "#ffffff" : "#fafafa"),
                      borderBottom: "1px solid #e5e7eb",
                      "&:hover": {
                        filter: "brightness(0.96)",
                      },
                      transition: "filter 0.15s ease",
                    }}
                  >
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: "#374151",
                        py: 1.5,
                        px: 2,
                        fontWeight: 500,
                        textAlign: "center",
                      }}
                    >
                      {row.scoreId}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: "#374151",
                        py: 1.5,
                        px: 2,
                        fontWeight: 500,
                      }}
                    >
                      {row.dmmhLever}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: "#374151",
                        py: 1.5,
                        px: 2,
                      }}
                    >
                      {row.dmmhSubLever}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: "#374151",
                        py: 1.5,
                        px: 2,
                        textAlign: "center",
                      }}
                    >
                      {row.target}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: "#374151",
                        py: 1.5,
                        px: 2,
                        textAlign: "center",
                      }}
                    >
                      {row.weight}%
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        py: 1.5,
                        px: 2,
                        textAlign: "center",
                      }}
                    >
                      {row.score === "-" ? (
                        <Typography sx={{ color: "#6b7280", fontSize: "0.8rem" }}>
                          —
                        </Typography>
                      ) : (
                        <Box
                          sx={{
                            display: "inline-block",
                            bgcolor: getScoreBadgeColor(row.score).bg,
                            color: getScoreBadgeColor(row.score).text,
                            px: 2,
                            py: 0.4,
                            borderRadius: 1,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          {row.score}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: "#1f2937",
                        py: 1.5,
                        px: 2,
                        textAlign: "center",
                        fontWeight: 600,
                      }}
                    >
                      {row.weightedScore}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: "#374151",
                        py: 1.5,
                        px: 2,
                        textAlign: "center",
                        fontWeight: 600,
                      }}
                    >
                      {row.weightedTarget}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination Info */}
          <Box
            sx={{
              p: 1.5,
              bgcolor: "#f9fafb",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.75rem",
              color: "#6b7280",
            }}
          >
            <Typography sx={{ fontSize: "0.75rem", color: "#6b7280" }}>
              1 — {filteredData.length} of {currentData.length}
            </Typography>
          </Box>
          </>
          )}
          </Box>
        </Paper>
      </Box>
    </CommonContainer>
  );
}
