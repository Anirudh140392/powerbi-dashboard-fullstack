const fs = require('fs');
const path = require('path');

const data = {
  AMAZON_DATA: `
  {
    scoreId: 1,
    dmmhLever: "Assortment",
    dmmhSubLever: "Blockbuster Availability",
    weight: 35.0,
    periods: {
      "Period 1": { target: "95%", weightedTarget: "33.25", score: "94.55%", weightedScore: "33.09" },
      "Period 2": { target: "97%", weightedTarget: "33.95", score: "92.29%", weightedScore: "32.30" },
      "Period 3": { target: "97%", weightedTarget: "33.95", score: "86.54%", weightedScore: "30.29" },
      "Period 4": { target: "95%", weightedTarget: "33.25", score: "94.74%", weightedScore: "33.16" },
      "Period 5": { target: "98%", weightedTarget: "34.30", score: "94.94%", weightedScore: "33.23" },
      "Period 6": { target: "98%", weightedTarget: "34.30", score: "94.93%", weightedScore: "33.23" }
    }
  },
  {
    scoreId: 3,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite generic search",
    weight: 15.0,
    periods: {
      "Period 1": { target: "25.00%", weightedTarget: "3.75", score: "21.13%", weightedScore: "3.17" },
      "Period 2": { target: "30.00%", weightedTarget: "4.50", score: "18.43%", weightedScore: "2.76" },
      "Period 3": { target: "25.00%", weightedTarget: "3.75", score: "17.23%", weightedScore: "2.58" },
      "Period 4": { target: "25.00%", weightedTarget: "3.75", score: "18.51%", weightedScore: "2.78" },
      "Period 5": { target: "20.00%", weightedTarget: "3.00", score: "15.00%", weightedScore: "2.25" },
      "Period 6": { target: "25.00%", weightedTarget: "3.75", score: "15.51%", weightedScore: "2.33" }
    }
  },
  {
    scoreId: 4,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite branded search",
    weight: 10.0,
    periods: {
      "Period 1": { target: "85.00%", weightedTarget: "8.50", score: "72.02%", weightedScore: "7.20" },
      "Period 2": { target: "85.00%", weightedTarget: "8.50", score: "76.82%", weightedScore: "7.68" },
      "Period 3": { target: "90.00%", weightedTarget: "9.00", score: "85.90%", weightedScore: "8.59" },
      "Period 4": { target: "90.00%", weightedTarget: "9.00", score: "70.00%", weightedScore: "7.00" },
      "Period 5": { target: "85.00%", weightedTarget: "8.50", score: "76.11%", weightedScore: "7.61" },
      "Period 6": { target: "90.00%", weightedTarget: "9.00", score: "83.20%", weightedScore: "8.32" }
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
      "Period 6": { target: "100%", weightedTarget: "7.00", score: "100%", weightedScore: "7.00" }
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
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "92.00%", weightedScore: "4.60" }
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
      "Period 6": { target: "100%", weightedTarget: "3.00", score: "100%", weightedScore: "3.00" }
    }
  },
  {
    scoreId: 9,
    dmmhLever: "Content",
    dmmhSubLever: "Features & Benefits",
    weight: 3.0,
    periods: {
      "Period 1": { target: "70%", weightedTarget: "2.10", score: "64.13%", weightedScore: "1.92" },
      "Period 2": { target: "75%", weightedTarget: "2.25", score: "63.45%", weightedScore: "1.90" },
      "Period 3": { target: "75%", weightedTarget: "2.25", score: "59.52%", weightedScore: "1.79" },
      "Period 4": { target: "70%", weightedTarget: "2.10", score: "63.16%", weightedScore: "1.89" },
      "Period 5": { target: "75%", weightedTarget: "2.25", score: "58.00%", weightedScore: "1.74" },
      "Period 6": { target: "80%", weightedTarget: "2.40", score: "76.00%", weightedScore: "2.28" }
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
      "Period 3": { target: "95%", weightedTarget: "6.65", score: "92.79%", weightedScore: "6.50" },
      "Period 4": { target: "100%", weightedTarget: "7.00", score: "94.74%", weightedScore: "6.63" },
      "Period 5": { target: "96%", weightedTarget: "6.72", score: "84.00%", weightedScore: "5.88" },
      "Period 6": { target: "93%", weightedTarget: "6.51", score: "74.00%", weightedScore: "5.18" }
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
      "Period 4": { target: "80%", weightedTarget: "4.00", score: "63.16%", weightedScore: "3.16" },
      "Period 5": { target: "80%", weightedTarget: "4.00", score: "74.00%", weightedScore: "3.70" },
      "Period 6": { target: "85%", weightedTarget: "4.25", score: "68.00%", weightedScore: "3.40" }
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
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" }
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
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" }
    }
  }`,
  
  BIGBASKET_DATA: `
  {
    scoreId: 1,
    dmmhLever: "Assortment",
    dmmhSubLever: "Blockbuster Availability",
    weight: 35.0,
    periods: {
      "Period 1": { target: "90%", weightedTarget: "31.50", score: "86.62%", weightedScore: "30.32" },
      "Period 2": { target: "95%", weightedTarget: "33.25", score: "86.51%", weightedScore: "30.28" },
      "Period 3": { target: "95%", weightedTarget: "33.25", score: "83.80%", weightedScore: "29.33" },
      "Period 4": { target: "90%", weightedTarget: "31.50", score: "58.36%", weightedScore: "20.43" },
      "Period 5": { target: "87%", weightedTarget: "30.45", score: "78.41%", weightedScore: "27.44" },
      "Period 6": { target: "95%", weightedTarget: "33.25", score: "88.25%", weightedScore: "30.89" }
    }
  },
  {
    scoreId: 3,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite generic search",
    weight: 15.0,
    periods: {
      "Period 1": { target: "15.00%", weightedTarget: "2.25", score: "13.46%", weightedScore: "2.02" },
      "Period 2": { target: "20.00%", weightedTarget: "3.00", score: "13.23%", weightedScore: "1.98" },
      "Period 3": { target: "20.00%", weightedTarget: "3.00", score: "11.97%", weightedScore: "1.80" },
      "Period 4": { target: "17.00%", weightedTarget: "2.55", score: "12.53%", weightedScore: "1.88" },
      "Period 5": { target: "18.00%", weightedTarget: "2.70", score: "11.17%", weightedScore: "1.68" },
      "Period 6": { target: "18%", weightedTarget: "2.70", score: "14.90%", weightedScore: "2.24" }
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
      "Period 4": { target: "95.00%", weightedTarget: "9.50", score: "86.63%", weightedScore: "8.66" },
      "Period 5": { target: "95.00%", weightedTarget: "9.50", score: "85.91%", weightedScore: "8.59" },
      "Period 6": { target: "90%", weightedTarget: "9.00", score: "78.06%", weightedScore: "7.81" }
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
      "Period 3": { target: "100%", weightedTarget: "8.00", score: "99%", weightedScore: "7.92" },
      "Period 4": { target: "100%", weightedTarget: "8.00", score: "95%", weightedScore: "7.60" },
      "Period 5": { target: "100%", weightedTarget: "8.00", score: "100%", weightedScore: "8.00" },
      "Period 6": { target: "100%", weightedTarget: "8.00", score: "100%", weightedScore: "8.00" }
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
      "Period 5": { target: "95%", weightedTarget: "5.70", score: "91%", weightedScore: "5.46" },
      "Period 6": { target: "100%", weightedTarget: "6.00", score: "99%", weightedScore: "5.94" }
    }
  },
  {
    scoreId: 9,
    dmmhLever: "Content",
    dmmhSubLever: "Features & Benefits",
    weight: 3.0,
    periods: {
      "Period 1": { target: "75%", weightedTarget: "2.25", score: "71.25%", weightedScore: "2.14" },
      "Period 2": { target: "80%", weightedTarget: "2.40", score: "71.21%", weightedScore: "2.14" },
      "Period 3": { target: "80%", weightedTarget: "2.40", score: "76.06%", weightedScore: "2.28" },
      "Period 4": { target: "85%", weightedTarget: "2.55", score: "77.50%", weightedScore: "2.33" },
      "Period 5": { target: "85%", weightedTarget: "2.55", score: "75%", weightedScore: "2.25" },
      "Period 6": { target: "90%", weightedTarget: "2.70", score: "85%", weightedScore: "2.55" }
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
      "Period 5": { target: "100%", weightedTarget: "8.00", score: "90%", weightedScore: "7.20" },
      "Period 6": { target: "100%", weightedTarget: "8.00", score: "100%", weightedScore: "8.00" }
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
      "Period 4": { target: "80%", weightedTarget: "4.00", score: "70%", weightedScore: "3.60" },
      "Period 5": { target: "90%", weightedTarget: "4.50", score: "40%", weightedScore: "2.00" },
      "Period 6": { target: "90%", weightedTarget: "4.50", score: "80%", weightedScore: "4.00" }
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
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" }
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
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" }
    }
  }`,
  BLINKIT_DATA: `
  {
    scoreId: 1,
    dmmhLever: "Assortment",
    dmmhSubLever: "Blockbuster Availability",
    weight: 35.0,
    periods: {
      "Period 1": { target: "90%", weightedTarget: "31.50", score: "85.15%", weightedScore: "29.80" },
      "Period 2": { target: "92%", weightedTarget: "32.20", score: "85.33%", weightedScore: "29.87" },
      "Period 3": { target: "95%", weightedTarget: "33.25", score: "82.22%", weightedScore: "28.78" },
      "Period 4": { target: "95%", weightedTarget: "33.25", score: "90.58%", weightedScore: "31.70" },
      "Period 5": { target: "97%", weightedTarget: "33.95", score: "88.58%", weightedScore: "31.00" },
      "Period 6": { target: "95%", weightedTarget: "33.25", score: "90.60%", weightedScore: "31.71" }
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
      "Period 3": { target: "15.00%", weightedTarget: "2.25", score: "11.76%", weightedScore: "1.76" },
      "Period 4": { target: "12.00%", weightedTarget: "1.80", score: "11.69%", weightedScore: "1.75" },
      "Period 5": { target: "18.00%", weightedTarget: "2.70", score: "16.20%", weightedScore: "2.43" },
      "Period 6": { target: "20%", weightedTarget: "3.00", score: "14.54%", weightedScore: "2.18" }
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
      "Period 4": { target: "80.00%", weightedTarget: "8.00", score: "69.33%", weightedScore: "6.93" },
      "Period 5": { target: "80.00%", weightedTarget: "8.00", score: "71.50%", weightedScore: "7.15" },
      "Period 6": { target: "80%", weightedTarget: "8.00", score: "73.00%", weightedScore: "7.30" }
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
      "Period 6": { target: "100%", weightedTarget: "9.00", score: "100%", weightedScore: "9.00" }
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
      "Period 5": { target: "91%", weightedTarget: "4.55", score: "93%", weightedScore: "4.65" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "98%", weightedScore: "4.90" }
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
      "Period 5": { target: "80%", weightedTarget: "2.40", score: "74%", weightedScore: "2.22" },
      "Period 6": { target: "97%", weightedTarget: "2.91", score: "95%", weightedScore: "2.85" }
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
      "Period 5": { target: "90%", weightedTarget: "7.20", score: "84.20%", weightedScore: "6.74" },
      "Period 6": { target: "95%", weightedTarget: "7.60", score: "84%", weightedScore: "6.72" }
    }
  },
  {
    scoreId: 13,
    dmmhLever: "Interruption",
    dmmhSubLever: "Dual Siting & Tagging",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" }
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
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" }
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
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" }
    }
  }`,
  ZEPTO_DATA: `
  {
    scoreId: 1,
    dmmhLever: "Assortment",
    dmmhSubLever: "Blockbuster Availability",
    weight: 35.0,
    periods: {
      "Period 1": { target: "82%", weightedTarget: "28.70", score: "90.17%", weightedScore: "31.56" },
      "Period 2": { target: "95%", weightedTarget: "33.25", score: "88.44%", weightedScore: "30.95" },
      "Period 3": { target: "95%", weightedTarget: "33.25", score: "86.93%", weightedScore: "30.43" },
      "Period 4": { target: "93%", weightedTarget: "32.55", score: "86.69%", weightedScore: "30.34" },
      "Period 5": { target: "97%", weightedTarget: "33.95", score: "96.35%", weightedScore: "33.72" },
      "Period 6": { target: "100%", weightedTarget: "35.00", score: "98.20%", weightedScore: "34.37" }
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
      "Period 4": { target: "22.00%", weightedTarget: "3.30", score: "16.43%", weightedScore: "2.46" },
      "Period 5": { target: "22.00%", weightedTarget: "3.30", score: "15%", weightedScore: "2.25" },
      "Period 6": { target: "20%", weightedTarget: "3.00", score: "13.10%", weightedScore: "1.97" }
    }
  },
  {
    scoreId: 4,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite branded search",
    weight: 10.0,
    periods: {
      "Period 1": { target: "55.00%", weightedTarget: "5.50", score: "58.16%", weightedScore: "5.82" },
      "Period 2": { target: "75.00%", weightedTarget: "7.50", score: "72.12%", weightedScore: "7.21" },
      "Period 3": { target: "80.00%", weightedTarget: "8.00", score: "71.14%", weightedScore: "7.11" },
      "Period 4": { target: "75%", weightedTarget: "7.50", score: "70.74%", weightedScore: "7.07" },
      "Period 5": { target: "75.00%", weightedTarget: "7.50", score: "55.20%", weightedScore: "5.52" },
      "Period 6": { target: "76%", weightedTarget: "7.60", score: "54.00%", weightedScore: "5.40" }
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
      "Period 4": { target: "100%", weightedTarget: "10.00", score: "95%", weightedScore: "9.50" },
      "Period 5": { target: "100%", weightedTarget: "10.00", score: "100%", weightedScore: "10.00" },
      "Period 6": { target: "100%", weightedTarget: "10.00", score: "100%", weightedScore: "10.00" }
    }
  },
  {
    scoreId: 7,
    dmmhLever: "Content",
    dmmhSubLever: "Secondary images",
    weight: 6.0,
    periods: {
      "Period 1": { target: "85%", weightedTarget: "5.10", score: "84.01%", weightedScore: "5.04" },
      "Period 2": { target: "90%", weightedTarget: "5.40", score: "84.11%", weightedScore: "5.05" },
      "Period 3": { target: "95%", weightedTarget: "5.70", score: "88.26%", weightedScore: "5.30" },
      "Period 4": { target: "95%", weightedTarget: "5.70", score: "88.60%", weightedScore: "5.32" },
      "Period 5": { target: "95%", weightedTarget: "5.70", score: "93%", weightedScore: "5.58" },
      "Period 6": { target: "99%", weightedTarget: "5.94", score: "97%", weightedScore: "5.82" }
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
      "Period 5": { target: "100%", weightedTarget: "9.00", score: "95%", weightedScore: "8.55" },
      "Period 6": { target: "100%", weightedTarget: "9.00", score: "94%", weightedScore: "8.46" }
    }
  },
  {
    scoreId: 13,
    dmmhLever: "Interruption",
    dmmhSubLever: "Dual Siting & Tagging",
    weight: 5.0,
    periods: {
      "Period 1": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 2": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 3": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" }
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
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" }
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
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" }
    }
  }`,
  FKN_DATA: `
  {
    scoreId: 1,
    dmmhLever: "Assortment",
    dmmhSubLever: "Blockbuster Availability",
    weight: 35.0,
    periods: {
      "Period 1": { target: "90%", weightedTarget: "31.50", score: "81.19%", weightedScore: "28.42" },
      "Period 2": { target: "95%", weightedTarget: "33.25", score: "68.05%", weightedScore: "23.82" },
      "Period 3": { target: "80%", weightedTarget: "28.00", score: "51.67%", weightedScore: "18.08" },
      "Period 4": { target: "70%", weightedTarget: "24.50", score: "51.18%", weightedScore: "17.91" },
      "Period 5": { target: "75%", weightedTarget: "26.25", score: "64.89%", weightedScore: "22.71" },
      "Period 6": { target: "80%", weightedTarget: "28.00", score: "59.30%", weightedScore: "20.75" }
    }
  },
  {
    scoreId: 3,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite generic search",
    weight: 15.0,
    periods: {
      "Period 1": { target: "23.00%", weightedTarget: "3.45", score: "22.40%", weightedScore: "3.36" },
      "Period 2": { target: "27.00%", weightedTarget: "4.05", score: "23.01%", weightedScore: "3.45" },
      "Period 3": { target: "30.00%", weightedTarget: "4.50", score: "21.94%", weightedScore: "3.29" },
      "Period 4": { target: "30.00%", weightedTarget: "4.50", score: "12.83%", weightedScore: "1.92" },
      "Period 5": { target: "20.00%", weightedTarget: "3.00", score: "8.50%", weightedScore: "1.28" },
      "Period 6": { target: "20%", weightedTarget: "3.00", score: "11.20%", weightedScore: "1.68" }
    }
  },
  {
    scoreId: 4,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite branded search",
    weight: 10.0,
    periods: {
      "Period 1": { target: "90.00%", weightedTarget: "9.00", score: "83.88%", weightedScore: "8.39" },
      "Period 2": { target: "95.00%", weightedTarget: "9.50", score: "85.13%", weightedScore: "8.51" },
      "Period 3": { target: "90.00%", weightedTarget: "9.00", score: "70.31%", weightedScore: "7.03" },
      "Period 4": { target: "85%", weightedTarget: "8.50", score: "63.18%", weightedScore: "6.32" },
      "Period 5": { target: "80.00%", weightedTarget: "8.00", score: "42.30%", weightedScore: "4.23" },
      "Period 6": { target: "73%", weightedTarget: "7.30", score: "47.00%", weightedScore: "4.70" }
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
      "Period 6": { target: "100%", weightedTarget: "8.00", score: "100%", weightedScore: "8.00" }
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
      "Period 5": { target: "95%", weightedTarget: "5.70", score: "88%", weightedScore: "5.28" },
      "Period 6": { target: "100%", weightedTarget: "6.00", score: "90%", weightedScore: "5.40" }
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
      "Period 3": { target: "90%", weightedTarget: "2.70", score: "84.04%", weightedScore: "2.52" },
      "Period 4": { target: "95%", weightedTarget: "2.85", score: "85%", weightedScore: "2.55" },
      "Period 5": { target: "95%", weightedTarget: "2.85", score: "80%", weightedScore: "2.40" },
      "Period 6": { target: "95%", weightedTarget: "2.85", score: "90%", weightedScore: "2.70" }
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
      "Period 4": { target: "100%", weightedTarget: "8.00", score: "95%", weightedScore: "7.60" },
      "Period 5": { target: "100%", weightedTarget: "8.00", score: "100%", weightedScore: "8.00" },
      "Period 6": { target: "100%", weightedTarget: "8.00", score: "100%", weightedScore: "8.00" }
    }
  },
  {
    scoreId: 11,
    dmmhLever: "Content",
    dmmhSubLever: "Ratings & Reviews",
    weight: 5.0,
    periods: {
      "Period 1": { target: "85%", weightedTarget: "4.25", score: "81.74%", weightedScore: "4.09" },
      "Period 2": { target: "85%", weightedTarget: "4.25", score: "81.34%", weightedScore: "4.07" },
      "Period 3": { target: "95%", weightedTarget: "4.75", score: "94.23%", weightedScore: "4.71" },
      "Period 4": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" },
      "Period 5": { target: "100%", weightedTarget: "5.00", score: "90%", weightedScore: "4.50" },
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "95%", weightedScore: "4.75" }
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
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" }
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
      "Period 6": { target: "100%", weightedTarget: "5.00", score: "100%", weightedScore: "5.00" }
    }
  }`
};

const pdsScorePath = path.join(__dirname, '../frontend/src/pages/PDSScore/PDSScore.jsx');
let content = fs.readFileSync(pdsScorePath, 'utf8');

for (const [key, value] of Object.entries(data)) {
  const marker1 = `const ${key} = [`;
  const marker2 = `];`;
  const startIdx = content.indexOf(marker1);
  if (startIdx !== -1) {
    const endIdx = content.indexOf(marker2, startIdx);
    if (endIdx !== -1) {
      content = content.substring(0, startIdx) + marker1 + '\n' + value + '\n' + content.substring(endIdx);
    }
  }
}

fs.writeFileSync(pdsScorePath, content, 'utf8');
console.log('Done!');
