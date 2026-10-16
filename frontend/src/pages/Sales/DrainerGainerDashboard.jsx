
import React, { useMemo, useState } from "react";

/**
 * Drainer/Gainer Dashboard (Single-file JSX)
 * - Domains: Sales, Visibility, Availability, Performance Marketing, Inventory
 * - Filters: Domain, Drainer/Gainer, Keyword/SKU, Platform search
 * - Cards: compact, responsive, max 3 per row on desktop widths (auto), scroll list for overflow
 * - Modal: Trend + City breakdown (sample)
 *
 * NOTE: Replace VISIBILITY_DATA / AVAILABILITY_DATA with your real datasets if you already have them.
 */

/* ----------------------------- DATA (SAMPLE) ----------------------------- */

// Your provided Visibility dataset (kept as-is)
const VISIBILITY_DATA = [
  {
    id: "KW-KW-D02",
    level: "keyword",
    type: "drainer",
    keyword: "family pack ice cream",
    platform: "Zepto",
    impact: "-5.8%",
    offtake: "₹ 2.7 lac",
    kpis: {
      adSov: "10%",
      organicSov: "7%",
      overallSov: "8.3%",
      volumeShare: "5.4%",
      demandClicks: "33k",
      adCtr: "0.8%",
    },
    cities: [
      { city: "Mumbai", metric: "SOV 6.4%", change: "-2.6%" },
      { city: "Thane", metric: "Vol 4.9%", change: "-1.9%" },
      { city: "Pune", metric: "Vol 3.2%", change: "-1.1%" },
      { city: "Nashik", metric: "SOV 2.9%", change: "-0.8%" },
    ],
  },
  {
    id: "KW-KW-D03",
    level: "keyword",
    type: "drainer",
    keyword: "chocolate ice cream",
    platform: "Instamart",
    impact: "-4.9%",
    offtake: "₹ 2.3 lac",
    kpis: {
      adSov: "9%",
      organicSov: "6%",
      overallSov: "7.5%",
      volumeShare: "4.7%",
      demandClicks: "29k",
      adCtr: "0.8%",
    },
    cities: [
      { city: "Mumbai", metric: "SOV 6.4%", change: "-2.6%" },
      { city: "Thane", metric: "Vol 4.9%", change: "-1.9%" },
      { city: "Pune", metric: "Vol 3.2%", change: "-1.1%" },
      { city: "Nashik", metric: "SOV 2.9%", change: "-0.8%" },
    ],
  },
  {
    id: "KW-KW-D04",
    level: "keyword",
    type: "drainer",
    keyword: "kulfi",
    platform: "Blinkit",
    impact: "-3.7%",
    offtake: "₹ 1.9 lac",
    kpis: {
      adSov: "8%",
      organicSov: "5%",
      overallSov: "6.2%",
      volumeShare: "3.9%",
      demandClicks: "21k",
      adCtr: "0.7%",
    },
    cities: [
      { city: "Mumbai", metric: "SOV 6.4%", change: "-2.6%" },
      { city: "Thane", metric: "Vol 4.9%", change: "-1.9%" },
      { city: "Pune", metric: "Vol 3.2%", change: "-1.1%" },
      { city: "Nashik", metric: "SOV 2.9%", change: "-0.8%" },
    ],
  },
  {
    id: "KW-KW-D05",
    level: "keyword",
    type: "drainer",
    keyword: "ice cream combo pack",
    platform: "Flipkart",
    impact: "-4.3%",
    offtake: "₹ 2.1 lac",
    kpis: {
      adSov: "9%",
      organicSov: "6%",
      overallSov: "7.0%",
      volumeShare: "4.3%",
      demandClicks: "24k",
      adCtr: "0.8%",
    },
    cities: [
      { city: "Chennai", metric: "SOV 5.7%", change: "-2.0%" },
      { city: "Coimbatore", metric: "Vol 3.9%", change: "-1.5%" },
      { city: "Pune", metric: "Vol 3.2%", change: "-1.1%" },
      { city: "Nashik", metric: "SOV 2.9%", change: "-0.8%" },
    ],
  },
  {
    id: "KW-KW-G01",
    level: "keyword",
    type: "gainer",
    keyword: "cone ice cream",
    platform: "Blinkit",
    impact: "+8.1%",
    offtake: "₹ 4.7 lac",
    kpis: {
      adSov: "28%",
      organicSov: "21%",
      overallSov: "26%",
      volumeShare: "19%",
      demandClicks: "71k",
      adCtr: "1.8%",
    },
    cities: [
      { city: "Hyderabad", metric: "SOV 31%", change: "+6.2%" },
      { city: "Bangalore", metric: "Vol 22%", change: "+4.4%" },
      { city: "Pune", metric: "Vol 3.2%", change: "-1.1%" },
      { city: "Nashik", metric: "SOV 2.9%", change: "-0.8%" },
    ],
  },
  {
    id: "KW-KW-G02",
    level: "keyword",
    type: "gainer",
    keyword: "magnum ice cream",
    platform: "Zepto",
    impact: "+7.4%",
    offtake: "₹ 4.3 lac",
    kpis: {
      adSov: "26%",
      organicSov: "20%",
      overallSov: "24%",
      volumeShare: "17%",
      demandClicks: "64k",
      adCtr: "1.7%",
    },
    cities: [
      { city: "Mumbai", metric: "SOV 29%", change: "+5.6%" },
      { city: "Thane", metric: "Vol 18%", change: "+3.9%" },
      { city: "Pune", metric: "Vol 3.2%", change: "-1.1%" },
      { city: "Nashik", metric: "SOV 2.9%", change: "-0.8%" },
    ],
  },
  {
    id: "KW-KW-G03",
    level: "keyword",
    type: "gainer",
    keyword: "choco bar",
    platform: "Instamart",
    impact: "+6.2%",
    offtake: "₹ 3.8 lac",
    kpis: {
      adSov: "23%",
      organicSov: "18%",
      overallSov: "21%",
      volumeShare: "15%",
      demandClicks: "52k",
      adCtr: "1.6%",
    },
    cities: [
      { city: "Pune", metric: "SOV 24%", change: "+4.3%" },
      { city: "Nashik", metric: "Vol 14%", change: "+3.1%" },
      { city: "Hyderabad", metric: "Placement 93", change: "+3.8%" },
      { city: "Bangalore", metric: "Index 95", change: "+3.1%" },
    ],
  },
  {
    id: "KW-KW-G04",
    level: "keyword",
    type: "gainer",
    keyword: "family pack butterscotch",
    platform: "Blinkit",
    impact: "+5.7%",
    offtake: "₹ 3.4 lac",
    kpis: {
      adSov: "21%",
      organicSov: "17%",
      overallSov: "20%",
      volumeShare: "14%",
      demandClicks: "49k",
      adCtr: "1.4%",
    },
    cities: [
      { city: "Delhi", metric: "SOV 22%", change: "+3.9%" },
      { city: "Gurgaon", metric: "Vol 15%", change: "+3.0%" },
      { city: "Hyderabad", metric: "Placement 93", change: "+3.8%" },
      { city: "Bangalore", metric: "Index 95", change: "+3.1%" },
    ],
  },
  {
    id: "KW-KW-G05",
    level: "keyword",
    type: "gainer",
    keyword: "kulfi pack",
    platform: "Flipkart",
    impact: "+4.9%",
    offtake: "₹ 3.0 lac",
    kpis: {
      adSov: "19%",
      organicSov: "15%",
      overallSov: "18%",
      volumeShare: "13%",
      demandClicks: "43k",
      adCtr: "1.3%",
    },
    cities: [
      { city: "Chennai", metric: "SOV 20%", change: "+3.3%" },
      { city: "Coimbatore", metric: "Vol 12%", change: "+2.7%" },
      { city: "Noida", metric: "Placement 57", change: "-2.1%" },
      { city: "Ghaziabad", metric: "Index 69", change: "-1.5%" },
    ],
  },
  {
    id: "KW-SKU-D01",
    level: "sku",
    type: "drainer",
    skuCode: "KW-101",
    skuName: "Butterscotch 700ml",
    platform: "Zepto",
    impact: "-7.3%",
    offtake: "₹ 2.8 lac",
    kpis: {
      indexScore: "62",
      placementScore: "54",
      adPosition: "4",
      organicPosition: "23",
    },
    cities: [
      { city: "Mumbai", metric: "Placement 51", change: "-2.9%" },
      { city: "Pune", metric: "Index 59", change: "-1.8%" },
      { city: "Delhi", metric: "Index 65", change: "-2.4%" },
      { city: "Gurgaon", metric: "Placement 56", change: "-1.7%" },
    ],
  },
  {
    id: "KW-SKU-D02",
    level: "sku",
    type: "drainer",
    skuCode: "KW-102",
    skuName: "Belgian Chocolate 500ml",
    platform: "Blinkit",
    impact: "-5.9%",
    offtake: "₹ 2.3 lac",
    kpis: {
      indexScore: "68",
      placementScore: "57",
      adPosition: "3",
      organicPosition: "21",
    },
    cities: [
      { city: "Delhi", metric: "Index 65", change: "-2.4%" },
      { city: "Gurgaon", metric: "Placement 56", change: "-1.7%" },
      { city: "Chennai", metric: "SOV 20%", change: "+3.3%" },
      { city: "Coimbatore", metric: "Vol 12%", change: "+2.7%" },
    ],
  },
  {
    id: "KW-SKU-D03",
    level: "sku",
    type: "drainer",
    skuCode: "KW-103",
    skuName: "Kulfi Malai 60ml",
    platform: "Instamart",
    impact: "-4.7%",
    offtake: "₹ 1.9 lac",
    kpis: {
      indexScore: "71",
      placementScore: "59",
      adPosition: "5",
      organicPosition: "25",
    },
    cities: [
      { city: "Noida", metric: "Placement 57", change: "-2.1%" },
      { city: "Ghaziabad", metric: "Index 69", change: "-1.5%" },
      { city: "Chennai", metric: "SOV 20%", change: "+3.3%" },
      { city: "Coimbatore", metric: "Vol 12%", change: "+2.7%" },
    ],
  },
  {
    id: "KW-SKU-D04",
    level: "sku",
    type: "drainer",
    skuCode: "KW-104",
    skuName: "Mini Sticks Chocolate (6x40ml)",
    platform: "Flipkart",
    impact: "-4.2%",
    offtake: "₹ 2.0 lac",
    kpis: {
      indexScore: "69",
      placementScore: "58",
      adPosition: "4",
      organicPosition: "22",
    },
    cities: [
      { city: "Chennai", metric: "Placement 55", change: "-1.9%" },
      { city: "Coimbatore", metric: "Index 67", change: "-1.4%" },
      { city: "Chennai", metric: "SOV 20%", change: "+3.3%" },
      { city: "Coimbatore", metric: "Vol 12%", change: "+2.7%" },
    ],
  },
  {
    id: "KW-SKU-D05",
    level: "sku",
    type: "drainer",
    skuCode: "KW-105",
    skuName: "Black Currant 500ml",
    platform: "Blinkit",
    impact: "-3.8%",
    offtake: "₹ 1.8 lac",
    kpis: {
      indexScore: "72",
      placementScore: "61",
      adPosition: "3",
      organicPosition: "20",
    },
    cities: [
      { city: "Hyderabad", metric: "Placement 60", change: "-1.6%" },
      { city: "Bangalore", metric: "Index 71", change: "-1.3%" },
    ],
  },
  {
    id: "KW-SKU-G01",
    level: "sku",
    type: "gainer",
    skuCode: "KW-501",
    skuName: "Cornetto Double Choco",
    platform: "Flipkart",
    impact: "+5.7%",
    offtake: "₹ 3.9 lac",
    kpis: {
      indexScore: "91",
      placementScore: "88",
      adPosition: "1",
      organicPosition: "6",
    },
    cities: [
      { city: "Delhi", metric: "Index 93", change: "+3.4%" },
      { city: "Gurgaon", metric: "Placement 90", change: "+2.1%" },
      { city: "Hyderabad", metric: "Placement 93", change: "+3.8%" },
      { city: "Bangalore", metric: "Index 95", change: "+3.1%" },
    ],
  },
  {
    id: "KW-SKU-G02",
    level: "sku",
    type: "gainer",
    skuCode: "KW-502",
    skuName: "Magnum Truffle 80ml",
    platform: "Blinkit",
    impact: "+7.3%",
    offtake: "₹ 4.5 lac",
    kpis: {
      indexScore: "94",
      placementScore: "91",
      adPosition: "1",
      organicPosition: "4",
    },
    cities: [
      { city: "Hyderabad", metric: "Placement 93", change: "+3.8%" },
      { city: "Bangalore", metric: "Index 95", change: "+3.1%" },
      { city: "Delhi", metric: "Index 93", change: "+3.4%" },
      { city: "Gurgaon", metric: "Placement 90", change: "+2.1%" },
    ],
  },
  {
    id: "KW-SKU-G03",
    level: "sku",
    type: "gainer",
    skuCode: "KW-503",
    skuName: "Feast Chocolate 90ml",
    platform: "Instamart",
    impact: "+6.4%",
    offtake: "₹ 3.6 lac",
    kpis: {
      indexScore: "89",
      placementScore: "86",
      adPosition: "2",
      organicPosition: "7",
    },
    cities: [
      { city: "Pune", metric: "Placement 88", change: "+2.9%" },
      { city: "Delhi", metric: "Index 93", change: "+3.4%" },
      { city: "Gurgaon", metric: "Placement 90", change: "+2.1%" },
      { city: "Nashik", metric: "Index 87", change: "+2.4%" },
    ],
  },
  {
    id: "KW-SKU-G04",
    level: "sku",
    type: "gainer",
    skuCode: "KW-504",
    skuName: "Family Pack Butterscotch 1.3L",
    platform: "Zepto",
    impact: "+5.1%",
    offtake: "₹ 3.2 lac",
    kpis: {
      indexScore: "87",
      placementScore: "84",
      adPosition: "2",
      organicPosition: "8",
    },
    cities: [
      { city: "Mumbai", metric: "Placement 85", change: "+2.6%" },
      { city: "Thane", metric: "Index 86", change: "+2.1%" },
      { city: "Hyderabad", metric: "Placement 93", change: "+3.8%" },
      { city: "Bangalore", metric: "Index 95", change: "+3.1%" },
    ],
  },
  {
    id: "KW-SKU-G05",
    level: "sku",
    type: "gainer",
    skuCode: "KW-505",
    skuName: "Kulfi Assorted Box",
    platform: "Flipkart",
    impact: "+4.6%",
    offtake: "₹ 2.9 lac",
    kpis: {
      indexScore: "85",
      placementScore: "82",
      adPosition: "2",
      organicPosition: "9",
    },
    cities: [
      { city: "Chennai", metric: "Placement 83", change: "+2.2%" },
      { city: "Coimbatore", metric: "Index 84", change: "+1.9%" },
    ],
  },
];

// Sample Availability dataset (replace with your real availability data)
const AVAILABILITY_DATA = [
  {
    id: "AV-KW-D01",
    level: "keyword",
    type: "drainer",
    keyword: "chocolate ice cream",
    platform: "Blinkit",
    impact: "-3.9%",
    offtake: "₹ 2.0 lac",
    kpis: { osa: "83%", oos: "9%", fillRate: "91%", lostSales: "₹ 0.6 lac" },
    cities: [
      { city: "Delhi", metric: "OSA 80%", change: "-3.0%" },
      { city: "Gurgaon", metric: "OOS 11%", change: "+2.1%" },
    ],
  },
  {
    id: "AV-KW-G01",
    level: "keyword",
    type: "gainer",
    keyword: "cone ice cream",
    platform: "Zepto",
    impact: "+4.6%",
    offtake: "₹ 3.6 lac",
    kpis: { osa: "94%", oos: "4%", fillRate: "96%", lostSales: "₹ 0.2 lac" },
    cities: [
      { city: "Mumbai", metric: "OSA 95%", change: "+2.0%" },
      { city: "Thane", metric: "OOS 3%", change: "-1.4%" },
    ],
  },
  {
    id: "AV-SKU-D01",
    level: "sku",
    type: "drainer",
    skuCode: "KW-201",
    skuName: "Belgian Chocolate 500ml",
    platform: "Instamart",
    impact: "-5.1%",
    offtake: "₹ 1.7 lac",
    kpis: { osa: "79%", oos: "12%", fillRate: "88%", lostSales: "₹ 0.7 lac" },
    cities: [
      { city: "Pune", metric: "OSA 77%", change: "-2.9%" },
      { city: "Nashik", metric: "OOS 13%", change: "+1.8%" },
    ],
  },
  {
    id: "AV-SKU-G01",
    level: "sku",
    type: "gainer",
    skuCode: "KW-202",
    skuName: "Cornetto Double Choco",
    platform: "Flipkart",
    impact: "+3.8%",
    offtake: "₹ 3.1 lac",
    kpis: { osa: "93%", oos: "5%", fillRate: "95%", lostSales: "₹ 0.3 lac" },
    cities: [
      { city: "Chennai", metric: "OSA 94%", change: "+1.9%" },
      { city: "Coimbatore", metric: "OOS 4%", change: "-0.8%" },
    ],
  },
];

// NEW: Sales dataset (Offtake is the highlight KPI; keep no more than 3-4 KPIs)
const SALES_DATA = [
  {
    id: "SA-KW-D01",
    level: "keyword",
    type: "drainer",
    keyword: "family pack ice cream",
    platform: "Zepto",
    impact: "-4.8%",
    offtake: "₹ 6.2 lac",
    kpis: { orders: "8.1k", asp: "₹ 76", revenueShare: "4.9%" },
    cities: [
      { city: "Mumbai", metric: "Offtake ₹ 2.1 lac", change: "-2.1%" },
      { city: "Pune", metric: "Orders 2.4k", change: "-1.4%" },
    ],
  },
  {
    id: "SA-KW-D02",
    level: "keyword",
    type: "drainer",
    keyword: "kulfi",
    platform: "Blinkit",
    impact: "-3.2%",
    offtake: "₹ 4.7 lac",
    kpis: { orders: "6.6k", asp: "₹ 71", revenueShare: "3.8%" },
    cities: [
      { city: "Delhi", metric: "Offtake ₹ 1.9 lac", change: "-1.8%" },
      { city: "Gurgaon", metric: "Orders 1.6k", change: "-1.1%" },
    ],
  },
  {
    id: "SA-KW-G01",
    level: "keyword",
    type: "gainer",
    keyword: "cone ice cream",
    platform: "Instamart",
    impact: "+6.0%",
    offtake: "₹ 8.9 lac",
    kpis: { orders: "12.4k", asp: "₹ 72", revenueShare: "6.1%" },
    cities: [
      { city: "Hyderabad", metric: "Offtake ₹ 2.6 lac", change: "+2.9%" },
      { city: "Bangalore", metric: "Orders 3.1k", change: "+2.1%" },
    ],
  },
  {
    id: "SA-SKU-D01",
    level: "sku",
    type: "drainer",
    skuCode: "KW-701",
    skuName: "Butterscotch 700ml",
    platform: "Flipkart",
    impact: "-5.6%",
    offtake: "₹ 3.8 lac",
    kpis: { orders: "4.2k", asp: "₹ 91", revenueShare: "2.6%" },
    cities: [
      { city: "Chennai", metric: "Offtake ₹ 1.2 lac", change: "-2.0%" },
      { city: "Coimbatore", metric: "Orders 1.1k", change: "-1.3%" },
    ],
  },
  {
    id: "SA-SKU-G01",
    level: "sku",
    type: "gainer",
    skuCode: "KW-702",
    skuName: "Magnum Truffle 80ml",
    platform: "Blinkit",
    impact: "+4.2%",
    offtake: "₹ 7.1 lac",
    kpis: { orders: "9.6k", asp: "₹ 74", revenueShare: "5.4%" },
    cities: [
      { city: "Delhi", metric: "Offtake ₹ 2.2 lac", change: "+1.7%" },
      { city: "Gurgaon", metric: "Orders 2.3k", change: "+1.2%" },
    ],
  },
];

// NEW: Performance Marketing dataset (ROAS is main; rest CTR, Clicks, ATC)
const PERFORMANCE_MARKETING_DATA = [
  {
    id: "PM-KW-D01",
    level: "keyword",
    type: "drainer",
    keyword: "ice cream tub",
    platform: "Blinkit",
    impact: "-3.6%",
    offtake: "₹ 2.9 lac",
    kpis: { roas: "2.1x", ctr: "0.8%", clicks: "18k", atc: "2.4k" },
    cities: [
      { city: "Delhi", metric: "ROAS 1.9x", change: "-0.2x" },
      { city: "Gurgaon", metric: "CTR 0.7%", change: "-0.1%" },
    ],
  },
  {
    id: "PM-KW-G01",
    level: "keyword",
    type: "gainer",
    keyword: "magnum ice cream",
    platform: "Zepto",
    impact: "+5.2%",
    offtake: "₹ 4.1 lac",
    kpis: { roas: "3.7x", ctr: "1.6%", clicks: "41k", atc: "5.8k" },
    cities: [
      { city: "Mumbai", metric: "ROAS 3.9x", change: "+0.4x" },
      { city: "Thane", metric: "ATC 1.6k", change: "+320" },
    ],
  },
  {
    id: "PM-SKU-D01",
    level: "sku",
    type: "drainer",
    skuCode: "KW-801",
    skuName: "Belgian Chocolate 500ml",
    platform: "Instamart",
    impact: "-4.1%",
    offtake: "₹ 2.0 lac",
    kpis: { roas: "1.8x", ctr: "0.7%", clicks: "12k", atc: "1.3k" },
    cities: [
      { city: "Pune", metric: "ROAS 1.6x", change: "-0.3x" },
      { city: "Nashik", metric: "Clicks 2.1k", change: "-420" },
    ],
  },
  {
    id: "PM-SKU-G01",
    level: "sku",
    type: "gainer",
    skuCode: "KW-802",
    skuName: "Cornetto Double Choco",
    platform: "Flipkart",
    impact: "+3.9%",
    offtake: "₹ 3.7 lac",
    kpis: { roas: "3.2x", ctr: "1.3%", clicks: "27k", atc: "3.9k" },
    cities: [
      { city: "Chennai", metric: "ROAS 3.4x", change: "+0.2x" },
      { city: "Coimbatore", metric: "ATC 980", change: "+140" },
    ],
  },
];

// NEW: Inventory dataset (DOI is main; rest DRR, plus 1-2 more)
const INVENTORY_DATA = [
  {
    id: "IN-KW-D01",
    level: "keyword",
    type: "drainer",
    keyword: "kulfi",
    platform: "Blinkit",
    impact: "-2.8%",
    offtake: "₹ 1.8 lac",
    kpis: { doi: "6.1", drr: "82", oos: "11%", expiryRisk: "High" },
    cities: [
      { city: "Delhi", metric: "DOI 5.4", change: "-0.8" },
      { city: "Gurgaon", metric: "DRR 88", change: "+6" },
    ],
  },
  {
    id: "IN-KW-G01",
    level: "keyword",
    type: "gainer",
    keyword: "cone ice cream",
    platform: "Zepto",
    impact: "+3.1%",
    offtake: "₹ 3.2 lac",
    kpis: { doi: "14.7", drr: "55", oos: "4%", expiryRisk: "Low" },
    cities: [
      { city: "Mumbai", metric: "DOI 15.3", change: "+1.2" },
      { city: "Thane", metric: "DRR 52", change: "-4" },
    ],
  },
  {
    id: "IN-SKU-D01",
    level: "sku",
    type: "drainer",
    skuCode: "KW-901",
    skuName: "Butterscotch 700ml",
    platform: "Instamart",
    impact: "-3.5%",
    offtake: "₹ 2.1 lac",
    kpis: { doi: "4.9", drr: "96", oos: "13%", expiryRisk: "Med" },
    cities: [
      { city: "Pune", metric: "DOI 4.1", change: "-0.7" },
      { city: "Nashik", metric: "OOS 14%", change: "+2%" },
    ],
  },
  {
    id: "IN-SKU-G01",
    level: "sku",
    type: "gainer",
    skuCode: "KW-902",
    skuName: "Magnum Truffle 80ml",
    platform: "Flipkart",
    impact: "+2.6%",
    offtake: "₹ 2.9 lac",
    kpis: { doi: "12.2", drr: "61", oos: "5%", expiryRisk: "Low" },
    cities: [
      { city: "Chennai", metric: "DOI 12.8", change: "+0.6" },
      { city: "Coimbatore", metric: "DRR 59", change: "-3" },
    ],
  },
];

/* --------------------------- CONFIG / HELPERS ---------------------------- */

const DOMAINS = [
  { key: "sales", label: "Sales" },
  { key: "visibility", label: "Visibility" },
  { key: "availability", label: "Availability" },
  { key: "performance", label: "Performance Marketing" },
  { key: "inventory", label: "Inventory" },
];

function domainDataset(domainKey) {
  switch (domainKey) {
    case "sales":
      return SALES_DATA;
    case "visibility":
      return VISIBILITY_DATA;
    case "availability":
      return AVAILABILITY_DATA;
    case "performance":
      return PERFORMANCE_MARKETING_DATA;
    case "inventory":
      return INVENTORY_DATA;
    default:
      return VISIBILITY_DATA;
  }
}

function toTitle(item) {
  if (item.level === "keyword") return item.keyword || "—";
  return item.skuName ? `${item.skuName}` : item.skuCode || "—";
}

function toSubTitle(item) {
  if (item.level === "keyword") return "Keyword";
  return item.skuCode ? `SKU · ${item.skuCode}` : "SKU";
}

function impactTone(impact) {
  const s = String(impact || "");
  if (s.startsWith("+")) return "pos";
  if (s.startsWith("-")) return "neg";
  return "muted";
}

function smallSpark() {
  // tiny deterministic-ish sparkline points
  const base = 30 + Math.floor(Math.random() * 20);
  return Array.from({ length: 14 }, (_, i) => {
    const wiggle = Math.sin(i / 2) * (6 + Math.random() * 3);
    return Math.max(4, Math.round(base + wiggle + (Math.random() * 5 - 2.5)));
  });
}

function mainKpiForDomain(domainKey, item) {
  // returns { label, value }
  const k = item.kpis || {};
  if (domainKey === "sales") return { label: "Offtake", value: item.offtake || "—" };
  if (domainKey === "performance") return { label: "ROAS", value: k.roas || "—" };
  if (domainKey === "inventory") return { label: "DOI", value: k.doi != null ? String(k.doi) : "—" };
  if (domainKey === "availability") return { label: "OSA", value: k.osa || "—" };
  // visibility default: Overall SOV for keyword, Index Score for SKU
  if (domainKey === "visibility") {
    if (item.level === "keyword") return { label: "Overall SOV", value: k.overallSov || "—" };
    return { label: "Index", value: k.indexScore || "—" };
  }
  return { label: "Metric", value: "—" };
}

function compactKpisForDomain(domainKey, item) {
  const k = item.kpis || {};
  // enforce 3-4 KPIs max (excluding the big one where applicable)
  if (domainKey === "sales") return [
    { label: "Orders", value: k.orders || "—" },
    { label: "ASP", value: k.asp || "—" },
    { label: "Rev Share", value: k.revenueShare || "—" },
  ];
  if (domainKey === "performance") return [
    { label: "CTR", value: k.ctr || "—" },
    { label: "Clicks", value: k.clicks || "—" },
    { label: "ATC", value: k.atc || "—" },
  ];
  if (domainKey === "inventory") return [
    { label: "DRR", value: k.drr || "—" },
    { label: "OOS", value: k.oos || "—" },
    { label: "Expiry Risk", value: k.expiryRisk || "—" },
  ];
  if (domainKey === "availability") return [
    { label: "OOS", value: k.oos || "—" },
    { label: "Fill Rate", value: k.fillRate || "—" },
    { label: "Lost Sales", value: k.lostSales || "—" },
  ];
  // visibility
  if (item.level === "keyword") {
    return [
      { label: "Ad SOV", value: k.adSov || "—" },
      { label: "Org SOV", value: k.organicSov || "—" },
      { label: "Clicks", value: k.demandClicks || "—" },
    ];
  }
  return [
    { label: "Placement", value: k.placementScore || "—" },
    { label: "Ad Pos", value: k.adPosition || "—" },
    { label: "Org Pos", value: k.organicPosition || "—" },
  ];
}

function uniqPlatforms(data) {
  const s = new Set();
  data.forEach((d) => s.add(d.platform));
  return ["All", ...Array.from(s)];
}

/* ------------------------------ UI PARTS -------------------------------- */

function Segmented({ value, onChange, options }) {
  return (
    <div className="seg" role="tablist" aria-label="segmented">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            className={`segBtn ${active ? "segActive" : ""}`}
            onClick={() => onChange(o.value)}
            type="button"
            role="tab"
            aria-selected={active}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Chip({ children, tone = "neutral" }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

function IconButton({ title, onClick, children }) {
  return (
    <button className="iconBtn" type="button" title={title} aria-label={title} onClick={onClick}>
      {children}
    </button>
  );
}

function MiniSparkline({ points }) {
  const w = 140;
  const h = 34;
  const pad = 2;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const scaleX = (i) => (i * (w - pad * 2)) / (points.length - 1) + pad;
  const scaleY = (v) => {
    if (max === min) return h / 2;
    return h - pad - ((v - min) * (h - pad * 2)) / (max - min);
  };
  const d = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${scaleX(i).toFixed(2)} ${scaleY(v).toFixed(2)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="spark" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modalOverlay" onMouseDown={onClose} role="dialog" aria-modal="true">
      <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalTitle">{title}</div>
          <button className="modalClose" type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------ MAIN PAGE -------------------------------- */

export default function DrainerGainerDashboard() {
  const [domain, setDomain] = useState("visibility");
  const [type, setType] = useState("drainer");
  const [level, setLevel] = useState("keyword");
  const [platform, setPlatform] = useState("All");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);

  const raw = useMemo(() => domainDataset(domain), [domain]);
  const platforms = useMemo(() => uniqPlatforms(raw), [raw]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return raw.filter((it) => {
      if (it.type !== type) return false;
      if (it.level !== level) return false;
      if (platform !== "All" && it.platform !== platform) return false;
      if (!qq) return true;
      const hay = `${toTitle(it)} ${it.platform} ${it.impact} ${it.offtake}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [raw, type, level, platform, q]);

  const headerKpi = useMemo(() => {
    const n = filtered.length;
    const labs = {
      sales: "Offtake",
      visibility: level === "keyword" ? "Overall SOV" : "Index",
      availability: "OSA",
      performance: "ROAS",
      inventory: "DOI",
    };
    return { count: n, label: labs[domain] || "Metric" };
  }, [filtered.length, domain, level]);

  return (
    <div className="page">
      <div className="topbar">
        <div className="titleBlock">
          <div className="title">Drainers & Gainers</div>
          <div className="subtitle">
            Domain-wise view (Sales, Visibility, Availability, Performance Marketing, Inventory) · Light theme · Responsive
          </div>
        </div>

        <div className="kpiPills">
          <div className="pill">
            <div className="pillLabel">Showing</div>
            <div className="pillValue">{headerKpi.count}</div>
          </div>
          <div className="pill">
            <div className="pillLabel">Primary KPI</div>
            <div className="pillValue">{headerKpi.label}</div>
          </div>
        </div>
      </div>

      <div className="controls">
        <div className="controlRow">
          <div className="controlGroup">
            <div className="controlLabel">Domain</div>
            <Segmented
              value={domain}
              onChange={(v) => {
                setDomain(v);
                setSelected(null);
              }}
              options={DOMAINS.map((d) => ({ value: d.key, label: d.label }))}
            />
          </div>

          <div className="controlGroup">
            <div className="controlLabel">Type</div>
            <Segmented
              value={type}
              onChange={(v) => {
                setType(v);
                setSelected(null);
              }}
              options={[
                { value: "drainer", label: "Drainer" },
                { value: "gainer", label: "Gainer" },
              ]}
            />
          </div>

          <div className="controlGroup">
            <div className="controlLabel">Level</div>
            <Segmented
              value={level}
              onChange={(v) => {
                setLevel(v);
                setSelected(null);
              }}
              options={[
                { value: "keyword", label: "Keyword" },
                { value: "sku", label: "SKU" },
              ]}
            />
          </div>
        </div>

        <div className="controlRow">
          <div className="controlGroup" style={{ minWidth: 220 }}>
            <div className="controlLabel">Platform</div>
            <select className="select" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="controlGroup grow">
            <div className="controlLabel">Search</div>
            <input
              className="input"
              placeholder="Search keyword / SKU / platform..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="controlGroup">
            <div className="controlLabel">Quick</div>
            <div className="quickHint">
              <span className="dot" /> Click a card for Trend and City view
            </div>
          </div>
        </div>
      </div>

      <div className="list">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="emptyTitle">No results</div>
            <div className="emptySub">Try changing Domain / Type / Level / Platform or clear search.</div>
          </div>
        ) : (
          <div className="grid">
            {filtered.map((item) => (
              <Card
                key={item.id}
                item={item}
                domain={domain}
                onOpen={() => setSelected({ item, points: smallSpark() })}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${toTitle(selected.item)} · ${selected.item.platform}` : ""}
      >
        {selected && (
          <div className="modalGrid">
            <div className="trendPanel">
              <div className="trendHeader">
                <div className="trendTitle">Trend (sample)</div>
                <div className="trendMeta">
                  <Chip tone={impactTone(selected.item.impact)}>{selected.item.impact}</Chip>
                  <Chip>{selected.item.platform}</Chip>
                </div>
              </div>
              <div className="trendLine">
                <MiniSparkline points={selected.points} />
                <div className="trendNotes">
                  <div className="trendNote">
                    <div className="trendNoteLabel">{mainKpiForDomain(domain, selected.item).label}</div>
                    <div className="trendNoteValue">{mainKpiForDomain(domain, selected.item).value}</div>
                  </div>
                  <div className="trendNote">
                    <div className="trendNoteLabel">Offtake</div>
                    <div className="trendNoteValue">{selected.item.offtake || "—"}</div>
                  </div>
                </div>
              </div>
              <div className="kpiStrip">
                {compactKpisForDomain(domain, selected.item).map((k) => (
                  <div className="kpiMini" key={k.label}>
                    <div className="kpiMiniLabel">{k.label}</div>
                    <div className="kpiMiniValue">{k.value}</div>
                  </div>
                ))}
              </div>
              <div className="hint">
                This trend is mocked for UI. Hook your real time-series here (day-wise / week-wise / city-wise).
              </div>
            </div>

            <div className="cityPanel">
              <div className="cityHeader">
                <div className="cityTitle">City breakdown</div>
                <div className="citySub">Top contributing cities (sample rows from your data)</div>
              </div>

              <div className="cityTable">
                <div className="cityRow cityRowHead">
                  <div>City</div>
                  <div>Metric</div>
                  <div style={{ textAlign: "right" }}>Change</div>
                </div>
                {(selected.item.cities || []).slice(0, 10).map((c, idx) => (
                  <div className="cityRow" key={`${c.city}-${idx}`}>
                    <div className="cityName">{c.city}</div>
                    <div className="cityMetric">{c.metric}</div>
                    <div className={`cityChange ${impactTone(c.change)}`} style={{ textAlign: "right" }}>
                      {c.change}
                    </div>
                  </div>
                ))}
                {(selected.item.cities || []).length === 0 && (
                  <div className="cityEmpty">No city data present for this item.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <style>{css}</style>
    </div>
  );
}

function Card({ item, domain, onOpen }) {
  const main = mainKpiForDomain(domain, item);
  const kpis = compactKpisForDomain(domain, item);

  return (
    <button className="card" type="button" onClick={onOpen}>
      <div className="cardTop">
        <div className="cardTitleWrap">
          <div className="cardTitle" title={toTitle(item)}>
            {toTitle(item)}
          </div>
          <div className="cardSub">{toSubTitle(item)}</div>
        </div>

        <div className="cardChips">
          <Chip>{item.platform}</Chip>
          <Chip tone={impactTone(item.impact)}>{item.impact}</Chip>
        </div>
      </div>

      <div className="cardMain">
        <div className="mainKpi">
          <div className="mainKpiLabel">{main.label}</div>
          <div className="mainKpiValue">{main.value}</div>
        </div>

        <div className="rightMini">
          <div className="rightMiniLabel">Offtake</div>
          <div className="rightMiniValue">{item.offtake || "—"}</div>
        </div>
      </div>

      <div className="cardKpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpiLabel">{k.label}</div>
            <div className="kpiValue">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="cardBottom">
        <div className="cityPreview">
          {(item.cities || []).slice(0, 2).map((c, idx) => (
            <div className="cityPill" key={`${c.city}-${idx}`}>
              <span className="cityPillName">{c.city}</span>
              <span className={`cityPillChange ${impactTone(c.change)}`}>{c.change}</span>
            </div>
          ))}
          {(item.cities || []).length > 2 && <span className="more">+{item.cities.length - 2} more</span>}
        </div>

        <div className="openHint">
          <span className="openIcon">↗</span> Trend
        </div>
      </div>
    </button>
  );
}

/* --------------------------------- CSS ---------------------------------- */

const css = `
  :root{
    --bg:#f7f8fb;
    --card:#ffffff;
    --text:#0f172a;
    --muted:#64748b;
    --line:#e6eaf2;
    --shadow: 0 10px 22px rgba(15,23,42,0.07);
    --shadow2: 0 6px 14px rgba(15,23,42,0.08);
    --pos:#0f766e;
    --neg:#b42318;
    --chip:#eef2ff;
    --chipText:#1e293b;
    --focus:#2563eb;
  }

  *{ box-sizing:border-box; }
  .page{
    min-height:100vh;
    background:var(--bg);
    color:var(--text);
    padding:18px;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  }

  .topbar{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:12px;
    padding:14px 14px 10px 14px;
  }
  .titleBlock{ display:flex; flex-direction:column; gap:4px; }
  .title{
    font-size:18px;
    font-weight:800;
    letter-spacing: -0.02em;
  }
  .subtitle{
    font-size:12px;
    color:var(--muted);
  }
  .kpiPills{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    justify-content:flex-end;
  }
  .pill{
    background:var(--card);
    border:1px solid var(--line);
    border-radius:12px;
    padding:10px 12px;
    box-shadow: var(--shadow2);
    min-width: 130px;
  }
  .pillLabel{ font-size:11px; color:var(--muted); }
  .pillValue{ font-size:14px; font-weight:800; margin-top:2px; }

  .controls{
    background:var(--card);
    border:1px solid var(--line);
    border-radius:16px;
    padding:12px;
    box-shadow: var(--shadow2);
    margin: 8px 0 14px 0;
  }
  .controlRow{
    display:flex;
    gap:12px;
    align-items:flex-end;
    flex-wrap:wrap;
  }
  .controlGroup{
    display:flex;
    flex-direction:column;
    gap:6px;
  }
  .controlGroup.grow{ flex: 1 1 320px; }
  .controlLabel{
    font-size:11px;
    color:var(--muted);
    font-weight:700;
    letter-spacing:0.02em;
    text-transform: uppercase;
  }
  .select, .input{
    height:36px;
    border-radius:12px;
    border:1px solid var(--line);
    padding: 0 12px;
    outline:none;
    background:#fff;
    color:var(--text);
  }
  .select:focus, .input:focus{
    border-color: rgba(37,99,235,0.6);
    box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
  }

  .seg{
    display:flex;
    border:1px solid var(--line);
    border-radius:12px;
    overflow:hidden;
    background:#fff;
    height:36px;
  }
  .segBtn{
    padding:0 12px;
    border:0;
    background:transparent;
    cursor:pointer;
    font-size:12px;
    font-weight:700;
    color:var(--muted);
    border-right:1px solid var(--line);
    height:36px;
    white-space:nowrap;
  }
  .segBtn:last-child{ border-right:0; }
  .segActive{
    color: var(--text);
    background: #f1f5ff;
  }

  .quickHint{
    height:36px;
    display:flex;
    align-items:center;
    gap:8px;
    padding:0 10px;
    border:1px dashed rgba(100,116,139,0.35);
    border-radius:12px;
    color:var(--muted);
    font-size:12px;
    background: rgba(255,255,255,0.6);
  }
  .dot{
    width:8px; height:8px; border-radius:999px;
    background: rgba(37,99,235,0.9);
  }

  .list{
    margin-top: 10px;
  }
  .grid{
    display:grid;
    gap:12px;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  .card{
    text-align:left;
    border:1px solid var(--line);
    border-radius:16px;
    background:var(--card);
    box-shadow: var(--shadow);
    padding:12px;
    cursor:pointer;
    transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
    display:flex;
    flex-direction:column;
    gap:10px;
    min-height: 150px;
  }
  .card:hover{
    transform: translateY(-2px);
    box-shadow: 0 14px 28px rgba(15,23,42,0.10);
    border-color: rgba(37,99,235,0.25);
  }
  .card:focus{
    outline:none;
    box-shadow: 0 0 0 3px rgba(37,99,235,0.18), var(--shadow);
  }

  .cardTop{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:10px;
  }
  .cardTitleWrap{ min-width:0; }
  .cardTitle{
    font-size:14px;
    font-weight:900;
    line-height:1.2;
    letter-spacing: -0.01em;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    max-width: 520px;
  }
  .cardSub{
    font-size:11px;
    color:var(--muted);
    margin-top:2px;
  }

  .cardChips{
    display:flex;
    align-items:center;
    gap:8px;
    flex-wrap:wrap;
    justify-content:flex-end;
  }

  .chip{
    display:inline-flex;
    align-items:center;
    gap:6px;
    font-size:11px;
    font-weight:800;
    padding:5px 9px;
    border-radius:999px;
    background: var(--chip);
    color: var(--chipText);
    border:1px solid rgba(15,23,42,0.06);
  }
  .chip-pos{ background: rgba(16,185,129,0.12); color: var(--pos); }
  .chip-neg{ background: rgba(244,63,94,0.12); color: var(--neg); }

  .cardMain{
    display:flex;
    align-items:flex-end;
    justify-content:space-between;
    gap:12px;
    border-top:1px solid rgba(230,234,242,0.8);
    padding-top:10px;
  }
  .mainKpiLabel{
    font-size:11px;
    color:var(--muted);
    font-weight:800;
    text-transform: uppercase;
    letter-spacing:0.04em;
  }
  .mainKpiValue{
    font-size:18px;
    font-weight:1000;
    margin-top:2px;
    letter-spacing:-0.02em;
  }
  .rightMini{
    text-align:right;
    min-width: 110px;
  }
  .rightMiniLabel{
    font-size:11px;
    color:var(--muted);
    font-weight:800;
    text-transform: uppercase;
    letter-spacing:0.04em;
  }
  .rightMiniValue{
    font-size:13px;
    font-weight:900;
    margin-top:2px;
  }

  .cardKpis{
    display:grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap:10px;
  }
  .kpi{
    border:1px solid rgba(230,234,242,0.95);
    background: rgba(248,250,252,0.6);
    border-radius:12px;
    padding:8px 10px;
  }
  .kpiLabel{
    font-size:10px;
    color:var(--muted);
    font-weight:900;
    letter-spacing:0.04em;
    text-transform:uppercase;
  }
  .kpiValue{
    font-size:13px;
    font-weight:900;
    margin-top:3px;
  }

  .cardBottom{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    border-top:1px solid rgba(230,234,242,0.8);
    padding-top:10px;
  }
  .cityPreview{
    display:flex;
    align-items:center;
    gap:8px;
    flex-wrap:wrap;
    min-width:0;
  }
  .cityPill{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:5px 8px;
    border-radius:999px;
    border:1px solid rgba(230,234,242,0.95);
    background: rgba(255,255,255,0.8);
    font-size:11px;
    font-weight:800;
  }
  .cityPillName{ color: var(--text); }
  .cityPillChange.pos{ color: var(--pos); }
  .cityPillChange.neg{ color: var(--neg); }
  .cityPillChange.muted{ color: var(--muted); }
  .more{
    font-size:11px;
    color:var(--muted);
    font-weight:800;
    white-space:nowrap;
  }
  .openHint{
    display:flex;
    align-items:center;
    gap:8px;
    color: rgba(37,99,235,0.95);
    font-weight:900;
    font-size:12px;
    white-space:nowrap;
  }
  .openIcon{
    display:inline-flex;
    width:22px;
    height:22px;
    border-radius:10px;
    align-items:center;
    justify-content:center;
    border:1px solid rgba(37,99,235,0.25);
    background: rgba(37,99,235,0.08);
  }

  .empty{
    background: var(--card);
    border:1px solid var(--line);
    border-radius:16px;
    padding:28px;
    box-shadow: var(--shadow2);
    text-align:center;
  }
  .emptyTitle{ font-size:14px; font-weight:900; }
  .emptySub{ font-size:12px; color:var(--muted); margin-top:6px; }

  /* Modal */
  .modalOverlay{
    position: fixed;
    inset: 0;
    background: rgba(15,23,42,0.45);
    display:flex;
    align-items:center;
    justify-content:center;
    padding: 14px;
    z-index: 1000;
  }
  .modalCard{
    width: min(920px, 100%);
    background: var(--card);
    border-radius: 18px;
    border: 1px solid rgba(230,234,242,0.95);
    box-shadow: 0 30px 60px rgba(15,23,42,0.25);
    overflow:hidden;
  }
  .modalHeader{
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(230,234,242,0.95);
  }
  .modalTitle{ font-size: 13px; font-weight: 900; }
  .modalClose{
    border:1px solid rgba(230,234,242,0.95);
    background:#fff;
    border-radius: 12px;
    height: 32px;
    width: 32px;
    cursor:pointer;
    font-weight: 900;
  }
  .modalBody{ padding: 14px; }

  .modalGrid{
    display:grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 12px;
  }
  @media (max-width: 860px){
    .modalGrid{ grid-template-columns: 1fr; }
  }

  .trendPanel, .cityPanel{
    border:1px solid rgba(230,234,242,0.95);
    border-radius: 16px;
    padding: 12px;
    background: rgba(248,250,252,0.55);
  }
  .trendHeader{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:10px;
  }
  .trendTitle{ font-size: 12px; font-weight: 950; }
  .trendMeta{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
  .trendLine{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    margin-top: 10px;
    padding: 10px;
    border-radius: 14px;
    border: 1px solid rgba(230,234,242,0.95);
    background:#fff;
  }
  .spark{ color: rgba(37,99,235,0.95); }
  .trendNotes{
    display:flex;
    gap:14px;
    align-items:stretch;
    justify-content:flex-end;
  }
  .trendNote{
    min-width: 120px;
    padding: 6px 10px;
    border-radius: 12px;
    border: 1px solid rgba(230,234,242,0.95);
    background: rgba(248,250,252,0.65);
    text-align:right;
  }
  .trendNoteLabel{
    font-size: 10px;
    color: var(--muted);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .trendNoteValue{
    font-size: 13px;
    font-weight: 950;
    margin-top: 3px;
  }

  .kpiStrip{
    display:grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 12px;
  }
  .kpiMini{
    background:#fff;
    border:1px solid rgba(230,234,242,0.95);
    border-radius: 14px;
    padding: 10px;
  }
  .kpiMiniLabel{
    font-size: 10px;
    color: var(--muted);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .kpiMiniValue{
    font-size: 13px;
    font-weight: 950;
    margin-top: 4px;
  }

  .hint{
    margin-top: 10px;
    font-size: 12px;
    color: var(--muted);
  }

  .cityHeader{ display:flex; flex-direction:column; gap:2px; }
  .cityTitle{ font-size: 12px; font-weight: 950; }
  .citySub{ font-size: 12px; color: var(--muted); }

  .cityTable{
    margin-top: 10px;
    border:1px solid rgba(230,234,242,0.95);
    border-radius: 14px;
    overflow:hidden;
    background:#fff;
  }
  .cityRow{
    display:grid;
    grid-template-columns: 1fr 1.2fr 0.7fr;
    gap:10px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(230,234,242,0.95);
    font-size: 12px;
    align-items:center;
  }
  .cityRow:last-child{ border-bottom:0; }
  .cityRowHead{
    background: rgba(248,250,252,0.75);
    color: var(--muted);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 10px;
  }
  .cityName{ font-weight: 900; }
  .cityMetric{ color: var(--text); font-weight: 800; }
  .cityChange.pos{ color: var(--pos); font-weight: 950; }
  .cityChange.neg{ color: var(--neg); font-weight: 950; }
  .cityChange.muted{ color: var(--muted); font-weight: 950; }

  .cityEmpty{
    padding: 14px;
    color: var(--muted);
    font-size: 12px;
  }
`;
