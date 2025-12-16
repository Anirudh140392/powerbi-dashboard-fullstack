import React, { useState } from "react";
import { SignalLabVisibility } from "../../components/AllVisiblityAnalysis/SignalLabVisibility";
import VisibilityLayoutOne from "../../components/AllVisiblityAnalysis/VisibilityLayoutOne";
import { motion } from "framer-motion";

export default function SalesGainerDrainerWrapper() {
    const [activeTab, setActiveTab] = useState("availability");

    return (
        <div className="w-full bg-slate-50 py-6 px-1">
            <div className="mx-auto max-w-7xl bg-white border rounded-3xl px-6 py-5 shadow">
                {/* Toggle at the top start of the card */}
                <div className="flex justify-start mb-6">
                    <div className="flex items-center rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500">
                        {[
                            { key: "availability", label: "Availability" },
                            { key: "sales", label: "Sales" },
                            { key: "performance", label: "Performance" },
                            { key: "inventory", label: "Inventory" },
                            { key: "visibility", label: "Visibility" },
                        ].map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                onClick={() => setActiveTab(option.key)}
                                style={{ minWidth: '90px' }}
                                className={`rounded-full px-3 py-2 text-sm transition-all ${activeTab === option.key
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Conditionally render components based on active tab */}
                {/* We pass a prop 'noCard' if we want to strip the card from children, or we just rely on the children update */}
                {activeTab === "visibility" ? (
                    <div className="mt-4">
                        <VisibilityLayoutOne />
                    </div>
                ) : (
                    <SignalLabVisibility type={activeTab} />
                )}
            </div>
        </div>
    );
}
