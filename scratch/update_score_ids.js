const fs = require('fs');
const path = require('path');

const pdsScorePath = path.join(__dirname, '../frontend/src/pages/PDSScore/PDSScore.jsx');
let content = fs.readFileSync(pdsScorePath, 'utf8');

const idMapping = [
  { id: 1, lever: /Assortment/i, subLever: /Blockbuster Availability/i },
  { id: 2, lever: /Assortment/i, subLever: /Trading SKU Availability/i },
  { id: 3, lever: /Search/i, subLever: /Onsite generic search/i },
  { id: 4, lever: /Search/i, subLever: /Onsite branded search/i },
  { id: 5, lever: /Search/i, subLever: /Top of Category/i },
  { id: 6, lever: /Content/i, subLever: /Quality hero image/i },
  { id: 7, lever: /Content/i, subLever: /Secondary\s*images/i },
  { id: 8, lever: /Content/i, subLever: /Enhanced Content/i },
  { id: 9, lever: /Content/i, subLever: /Features & Benefits/i },
  { id: 10, lever: /Content/i, subLever: /Title full usage/i },
  { id: 11, lever: /Content/i, subLever: /Ratings & Reviews/i },
  { id: 12, lever: /Navigation/i, subLever: /3 Clicks to Confectionery/i },
  { id: 13, lever: /interruption/i, subLever: /Dual Sit+ing & Tagging/i },
  { id: 14, lever: /Data/i, subLever: /Sell-out data by SKU/i },
  { id: 15, lever: /Data/i, subLever: /Search term frequency/i }
];

// We need to parse each block like:
// scoreId: X,
// dmmhLever: "Assortment",
// dmmhSubLever: "Blockbuster Availability",
// We replace scoreId: X with scoreId: matched_id

const regex = /scoreId:\s*\d+,([\s\S]*?)dmmhLever:\s*"([^"]+)",\s*dmmhSubLever:\s*"([^"]+)"/g;

let matchCount = 0;
let replacedContent = content.replace(regex, (match, middle, lever, subLever) => {
  let matchedId = null;
  for (let rule of idMapping) {
    if (rule.lever.test(lever) && rule.subLever.test(subLever)) {
      matchedId = rule.id;
      break;
    }
  }
  
  if (matchedId !== null) {
    matchCount++;
    return `scoreId: ${matchedId},${middle}dmmhLever: "${lever}",\n    dmmhSubLever: "${subLever}"`;
  }
  
  console.log(`NO MATCH FOR: ${lever} - ${subLever}`);
  return match;
});

fs.writeFileSync(pdsScorePath, replacedContent, 'utf8');
console.log(`Updated ${matchCount} scoreIds.`);
