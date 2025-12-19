import React, { useState } from "react";
import { datasets } from "./mockData";
import { CustomPivotWorkbench } from "../AllVisiblityAnalysis/CustomPivotWorkbench";
import { motion } from "framer-motion";

export default function PlayItYourself() {
    const [selectedKey, setSelectedKey] = useState("visibility");

    const currentDataset = datasets[selectedKey];

    return (
        <div className="w-full space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Play It Yourself</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Experience the power of our pivot engine. Select a dataset to explore real-time analytics.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">Choose Dataset:</span>
                    <select
                        value={selectedKey}
                        onChange={(e) => setSelectedKey(e.target.value)}
                        className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-sm"
                    >
                        {Object.entries(datasets).map(([key, config]) => (
                            <option key={key} value={key}>
                                {config.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <motion.div
                key={selectedKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                {/* We key the component to force a fresh mount when dataset changes, ensuring internal state resets */}
                <CustomPivotWorkbench
                    key={selectedKey}
                    data={currentDataset.data}
                    fields={currentDataset.fields}
                    initialConfig={currentDataset.initialConfig}
                />
            </motion.div>
        </div>
    );
}

