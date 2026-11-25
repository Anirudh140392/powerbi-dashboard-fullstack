import React from "react";
import { motion } from "framer-motion";
import { Map, Layers, Database, ChevronRight, Settings, Activity, Zap, Plus, Globe } from "lucide-react";

const AccessMapping = () => {
    const mappings = [
        { title: "Geo-Spatial Data", entity: "Territory Matrix", status: "Synchronized", color: "text-blue-500", bg: "bg-blue-50", icon: Map },
        { title: "Inventory Vault", entity: "Stock-Logic Flow", status: "Optimized", color: "text-indigo-500", bg: "bg-indigo-50", icon: Database },
        { title: "Signal Channels", entity: "Omni-Platform Hub", status: "Active", color: "text-amber-500", bg: "bg-amber-50", icon: Zap },
        { title: "Engine Presets", entity: "Protocol Rules", status: "Verified", color: "text-emerald-500", bg: "bg-emerald-50", icon: Settings },
    ];

    return (
        <div className="space-y-10">
            <div className="flex justify-between items-center max-w-4xl">
                <div>
                    <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-1">Data Mapping</h2>
                    <p className="text-slate-500 text-xs">Configure how data sources and entities are mapped across regions.</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                    <Plus className="w-4 h-4 text-slate-400" />
                    New Mapping
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                {mappings.map((item, idx) => (
                    <div
                        key={item.title}
                        className="group flex items-center justify-between p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-100 transition-all cursor-pointer"
                    >
                        <div className="flex items-center gap-5">
                            <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center transition-all group-hover:scale-105`}>
                                <item.icon className={`w-6 h-6 ${item.color}`} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{item.entity}</p>
                                <h4 className="font-bold text-slate-800 text-sm">{item.title}</h4>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-full border border-slate-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.status}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Clean Info Banner */}
            <div className="max-w-4xl bg-white rounded-2xl border border-slate-200 p-10 flex flex-col md:flex-row items-center gap-10 shadow-sm">
                <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 flex-shrink-0">
                    <Globe className="w-10 h-10" />
                </div>
                <div className="flex-1 space-y-4">
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">Architecture Synchronization</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Ensure that your global neural connectors are properly synchronized across all geographic nodes to maintain low-latency data flow.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                        <button className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-sm">
                            Global Sync
                        </button>
                        <button className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors">
                            Node Specs
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccessMapping;
