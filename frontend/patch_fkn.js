const fs = require('fs');
const path = '/Users/2004yashgautamgmail.com/Documents/trailytics_ds/powerbi-dashboard-fullstack/frontend/src/pages/PDSScore/PDSScore.jsx';

const content = fs.readFileSync(path, 'utf8');

const fknDataString = `
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
    scoreId: 2,
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
    scoreId: 3,
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
    scoreId: 4,
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
    scoreId: 5,
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
    scoreId: 6,
    dmmhLever: "Content",
    dmmhSubLever: "Enhanced content",
    weight: 0.0,
    periods: {
      "Period 1": { target: "-", weightedTarget: "-", score: "-", weightedScore: "0.00" },
      "Period 2": { target: "-", weightedTarget: "-", score: "-", weightedScore: "0.00" },
      "Period 3": { target: "-", weightedTarget: "-", score: "-", weightedScore: "0.00" },
      "Period 4": { target: "-", weightedTarget: "-", score: "-", weightedScore: "0.00" },
      "Period 5": { target: "-", weightedTarget: "-", score: "-", weightedScore: "0.00" },
      "Period 6": { target: "-", weightedTarget: "-", score: "-", weightedScore: "0.00" },
    }
  },
  {
    scoreId: 7,
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
    scoreId: 8,
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
    scoreId: 9,
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
    scoreId: 10,
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
    scoreId: 11,
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

let newContent = content.replace("const getTableData = (platform, period) => {", fknDataString + "\nconst getTableData = (platform, period) => {");

newContent = newContent.replace(`if (platform === "Amazon") {`, `if (platform === "Amazon") {
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

  // fallback for other platforms
  // (we keep this simple so we overwrite the entire function)`);

// Wait, doing replace like this might double up or break something if not exact.
// I will just construct the full replacement for getTableData.

const getTableDataRegex = /const getTableData = \(platform, period\) => \{[\s\S]*?\n\};\n/m;
const getTableDataReplacement = \`const getTableData = (platform, period) => {
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
\`;

newContent = content.replace(getTableDataRegex, fknDataString + "\n" + getTableDataReplacement);

fs.writeFileSync(path, newContent);
