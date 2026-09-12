const fs = require('fs');
const path = '/Users/2004yashgautamgmail.com/Documents/trailytics_ds/powerbi-dashboard-fullstack/frontend/src/pages/PDSScore/PDSScore.jsx';

const content = fs.readFileSync(path, 'utf8');

const bbDataString = `
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
    scoreId: 2,
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
    scoreId: 3,
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
    scoreId: 4,
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
    scoreId: 5,
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
    scoreId: 6,
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
    scoreId: 7,
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
    scoreId: 8,
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
    scoreId: 9,
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
    scoreId: 10,
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
`;

const getTableDataRegex = /const getTableData = \(platform, period\) => \{[\s\S]*?\n\};\n/m;
const getTableDataReplacement = `const getTableData = (platform, period) => {
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
`;

const newContent = content.replace(getTableDataRegex, bbDataString + "\n" + getTableDataReplacement);

fs.writeFileSync(path, newContent);
