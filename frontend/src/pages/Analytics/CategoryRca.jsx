import React, { useState } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import RCATable from "../../components/Analytics/CategoryRca/RCATable";
import { motion } from "framer-motion";
import RcaCardTable from "@/components/Analytics/CategoryRca/RcaCardTable";

export default function CategoryRca() {
  const [filters, setFilters] = useState({
    platform: "Blinkit",
  });

  const [tableView, setTableView] = useState("card");

  const OPTIONS = [
    { key: "card", label: "Card View" },
    { key: "table", label: "Table View" },
  ];

  // ✅ FIX: dynamic active index
  const activeIndex = OPTIONS.findIndex(
    (opt) => opt.key === tableView
  );

  return (
    <CommonContainer
      title="Category RCA"
      filters={filters}
      onFiltersChange={setFilters}
    >
      <div className="flex justify-center" style={{margin: '10px'}}>
        <div className="relative w-full md:w-[420px]">
          <div className="relative flex items-center rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500">
            
            {/* ACTIVE SLIDER */}
            <motion.div
              layout
              className="absolute top-1 bottom-1 rounded-full bg-white shadow-sm"
              style={{
                width: `${100 / OPTIONS.length}%`,
              }}
              animate={{
                x: `${activeIndex * 100}%`,
              }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 26,
              }}
            />

            {/* BUTTONS */}
            {OPTIONS.map((option) => {
              const isActive = tableView === option.key;

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setTableView(option.key)}
                  className={`relative z-10 flex-1 rounded-full px-3 py-2 transition-colors ${
                    isActive
                      ? "text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  style={{cursor: 'pointer'}}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CONTENT SWITCH */}
      {tableView === "table" ? <RCATable /> : <RcaCardTable />}
    </CommonContainer>
  );
}
