import React, { useState } from "react";

/* -------------------------------------------------------------------------- */
/*                               KPI DEFINITIONS                              */
/* -------------------------------------------------------------------------- */

const VISIBILITY_KEYWORD_KPIS = [
  "adSov",
  "organicSov",
  "overallSov",
  "volumeShare",
  "demandClicks",
  "adCtr",
];
const VISIBILITY_DATA = [
  // KEYWORD – DRAINERS (5)
  // {
  //   id: "KW-KW-D01",
  //   level: "keyword",
  //   type: "drainer",
  //   keyword: "ice cream tub",
  //   platform: "Blinkit",
  //   impact: "-6.4%",
  //   offtake: "₹ 3.1 lac",
  //   kpis: {
  //     adSov: "12%",
  //     organicSov: "8%",
  //     overallSov: "9.4%",
  //     volumeShare: "6.1%",
  //     demandClicks: "41k",
  //     adCtr: "0.9%",
  //   },
  //   cities: [
  //     { city: "Delhi", metric: "SOV 7.2%", change: "-3.1%" },
  //     { city: "Gurgaon", metric: "Vol 5.1%", change: "-1.7%" },
  //   ],
  // },
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
      { city: "Pune", metric: "Vol 3.2%", change: "-1.1%" },  // NEW
      { city: "Nashik", metric: "SOV 2.9%", change: "-0.8%" } // NEW
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
      { city: "Pune", metric: "Vol 3.2%", change: "-1.1%" },  // NEW
      { city: "Nashik", metric: "SOV 2.9%", change: "-0.8%" } // NEW
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
      { city: "Pune", metric: "Vol 3.2%", change: "-1.1%" },  // NEW
      { city: "Nashik", metric: "SOV 2.9%", change: "-0.8%" } // NEW
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
      { city: "Pune", metric: "Vol 3.2%", change: "-1.1%" },  // NEW
      { city: "Nashik", metric: "SOV 2.9%", change: "-0.8%" } // NEW
    ],
  },

  // KEYWORD – GAINERS (5)
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
      { city: "Pune", metric: "Vol 3.2%", change: "-1.1%" },  // NEW
      { city: "Nashik", metric: "SOV 2.9%", change: "-0.8%" } // NEW
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
      { city: "Pune", metric: "Vol 3.2%", change: "-1.1%" },  // NEW
      { city: "Nashik", metric: "SOV 2.9%", change: "-0.8%" } // NEW
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

  // SKU – DRAINERS (5)
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

  // SKU – GAINERS (5)
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

const VISIBILITY_SKU_KPIS = [
  "indexScore",
  "placementScore",
  "adPosition",
  "organicPosition",
];

const KPI_LABELS = {
  adSov: "Ad SOV",
  organicSov: "Organic SOV",
  overallSov: "Overall SOV",
  volumeShare: "Vol. Share",
  demandClicks: "Demand Clicks",
  adCtr: "Ad CTR",

  indexScore: "Index Score",
  placementScore: "Placement Score",
  adPosition: "Ad Pos.",
  organicPosition: "Org. Pos.",
};

/* -------------------------------------------------------------------------- */
/*                              IMPACT PILL UI                                */
/* -------------------------------------------------------------------------- */

function ImpactPill({ value }) {
  const trimmed = value.trim();
  const isPositive = trimmed.startsWith("+");
  const isNegative = trimmed.startsWith("-");

  let tone =
    " bg-slate-100 text-slate-700 border border-slate-200";

  if (isPositive)
    tone =
      " bg-emerald-50 text-emerald-700 border border-emerald-200";

  if (isNegative)
    tone =
      " bg-rose-50 text-rose-700 border border-rose-200";

  return (
    <span
      className={
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium " +
        tone
      }
    >
      {value}
    </span>
  );
}


/* -------------------------------------------------------------------------- */
/*                           SEGMENTED SWITCHES                               */
/* -------------------------------------------------------------------------- */

function SignalTypeSwitch({ value, onChange }) {
  const options = [
    { label: "Drainers", value: "drainer" },
    { label: "Gainers", value: "gainer" },
  ];

  return (
    <div className="inline-flex rounded-2xl bg-slate-100 p-1 shadow-inner border border-slate-200">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-1.5 rounded-2xl text-xs sm:text-sm font-medium transition-all
              ${active
                ? "bg-white text-slate-900 shadow -translate-y-[1px]"
                : "text-slate-500 hover:text-slate-900"
              }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function LevelSwitch({ value, onChange }) {
  const options = [
    { label: "Keyword", value: "keyword" },
    { label: "SKU", value: "sku" },
  ];

  return (
    <div className="inline-flex rounded-2xl bg-slate-100 p-1 shadow-inner border border-slate-200">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-1.5 rounded-2xl text-xs sm:text-sm font-medium transition-all
              ${active
                ? "bg-white text-slate-900 shadow -translate-y-[1px]"
                : "text-slate-500 hover:text-slate-900"
              }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               CARD COMPONENT                                */
/* -------------------------------------------------------------------------- */

function VisibilityCard({ item, expanded, toggleExpand }) {
  const citiesToShow = expanded ? item.cities : item.cities.slice(0, 2);

  const isKeyword = item.level === "keyword";
  const kpiKeys = isKeyword ? VISIBILITY_KEYWORD_KPIS : VISIBILITY_SKU_KPIS;

  return (
    <div
      className="
      flex flex-col justify-between 
      rounded-3xl border border-slate-200 
      bg-white shadow-sm 
      px-6 py-5 
      w-full
      transition-all duration-200
    "
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          {/* SKU or Keyword */}
          <div>
            {isKeyword ? (
              <>
                <div className="text-[13px] font-semibold text-slate-800 capitalize">
                  {item.keyword}
                </div>
              </>
            ) : (
              <>
                <div className="text-[13px] font-semibold text-slate-800">
                  {item.skuCode}
                </div>
                <div className="text-[12px] text-slate-500">
                  {item.skuName}
                </div>
              </>
            )}
          </div>

          <span className="px-3 py-1 rounded-full text-[10px] bg-sky-50 border border-sky-100 text-sky-700 font-medium">
            {item.platform}
          </span>
        </div>

        {/* Offtake & Impact */}
        <div className="mt-2 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400">Offtake</div>
            <div className="text-[17px] font-semibold text-slate-900">
              {item.offtake}
            </div>
          </div>

          <ImpactPill value={item.impact} />
        </div>

        {/* KPI Chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {kpiKeys.map((key) => (
            <div
              key={key}
              className="
                px-3 py-1 
                rounded-full 
                bg-slate-50 border border-slate-200
                text-[11px] flex items-center gap-1
              "
            >
              <span className="text-slate-500">{KPI_LABELS[key]}:</span>
              <span className="font-semibold text-slate-800">
                {item.kpis[key] ?? "-"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cities */}
      <div className="mt-6 border-t border-slate-200 pt-3">
        <div className="text-[11px] font-semibold text-slate-600 mb-2">
          Top impacted cities
        </div>

        <div className="grid grid-cols-2 gap-3">
          {citiesToShow.map((c) => (
            <div
              key={c.city}
              className="
        p-3 rounded-2xl 
        bg-white border border-slate-200 
        flex flex-col gap-1
      "
            >
              <div className="text-[12px] font-medium text-slate-800">
                {c.city}
              </div>
              <div className="text-[11px] text-slate-500">{c.metric}</div>
              <ImpactPill value={c.change} />
            </div>
          ))}
        </div>

        {item.cities.length > 2 && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={toggleExpand}
              className="text-[12px] font-semibold text-sky-600 hover:underline"
            >
              {expanded ? "Show less" : "More cities"}
            </button>

          </div>

        )}


      </div>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*                               MAIN VIEW                                    */
/* -------------------------------------------------------------------------- */

export function VisibilityLayoutOne() {
  const [signalType, setSignalType] = useState("drainer");
  const [level, setLevel] = useState("keyword");
  const [expandedCards, setExpandedCards] = useState({});

  const toggleExpand = (id) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };



  const filtered = VISIBILITY_DATA.filter(
    (row) => row.type === signalType && row.level === level
  );

  return (
    <div className=" bg-slate-50 py-1 px-0">
      <div className="mx-auto rounded-3xl border bg-white shadow px-3 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Visibility Signals — Keyword & SKU
            </h2>
            {/* <p className="mt-1 text-xs text-slate-500 max-w-xl">
              Auto-ranked Kwality Walls drainers and gainers based on visibility
              KPIs at keyword and SKU level across quick commerce platforms.
            </p> */}
          </div>

          <div className="flex flex-wrap gap-3">
            <SignalTypeSwitch value={signalType} onChange={setSignalType} />
            <LevelSwitch value={level} onChange={setLevel} />
          </div>
        </div>

        <div className="mt-2 pb-1">
          <div className="grid grid-cols-4 gap-3 w-full items-start">
            {filtered.slice(0, 4).map((item) => (
              <VisibilityCard
                key={item.id}
                item={item}
                expanded={expandedCards[item.id]}   // ✅ passing expanded state
                toggleExpand={() => toggleExpand(item.id)}  // ✅ passing handler
              />
            ))}

          </div>
        </div>

      </div>
    </div>
  );
}

export default VisibilityLayoutOne;
