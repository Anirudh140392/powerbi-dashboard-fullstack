import React, { useState, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Users, Waypoints, Filter, Settings, Database, Upload } from 'lucide-react';
import SkuMasterTable from './SkuMasterTable';
import CompetitorMappingTable from './CompetitorMappingTable';
import StakeholderMappingTable from './StakeholderMappingTable';
import CategoryExtractionRules from './CategoryExtractionRules';
import QualityControlPanel from './QualityControlPanel';
// Heavy panels — loaded only when their sub-tab is activated.
const RawDataLake = lazy(() => import('../RawDataLake'));
const BulkImportPanel = lazy(() => import('../automation/BulkImportPanel').then(m => ({ default: m.BulkImportPanel })));

interface MasterLayoutProps {
    productFilters?: {
        platform?: string;
        pareto_status?: string;
        category?: string;
        material?: string;
        price_mode?: 'rp' | 'sp';
        price_min?: number;
        price_max?: number;
    };
    /** Pre-fill SkuMasterTable's search box (used for ?web_pid=… deep links from alert emails). */
    initialSearch?: string;
}

type MasterTabKey = 'sku' | 'qcaudit' | 'bulk' | 'datalake' | 'competitor' | 'stakeholder' | 'category';

// SKU Master + Quality Control + Bulk Import + Data Lake are the four
// "master data" surfaces — what gets fed *into* the system. The legacy
// rule-engine sub-tabs (competitor / stakeholder / category) also live
// here so existing bookmarks keep working, but the Rules top-level tab
// is now the canonical home for those.
const MASTER_TABS = [
    { key: 'sku',          label: 'SKU Master',        icon: Package,   description: 'Product catalog & classification' },
    { key: 'qcaudit',      label: 'AI QC Tracker',     icon: Filter,    description: 'Review & Sync ML Audits' },
    { key: 'bulk',         label: 'Bulk Import',       icon: Upload,    description: 'CSV: web_pid → pareto status' },
    { key: 'datalake',     label: 'Data Lake (Raw)',   icon: Database,  description: 'Raw review + snapshot rows' },
    { key: 'competitor',   label: 'Competitor Mapping',icon: Waypoints, description: '↗ Also in Rules' },
    { key: 'stakeholder',  label: 'Stakeholder Rules', icon: Users,     description: '↗ Also in Rules' },
    { key: 'category',     label: 'Categorization',    icon: Filter,    description: '↗ Also in Rules' },
] as const;

const MasterLayout: React.FC<MasterLayoutProps> = ({ productFilters, initialSearch }) => {
    const [activeTab, setActiveTab] = useState<MasterTabKey>('sku');

    return (
        <div className="flex flex-col md:flex-row h-full rounded-2xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 shadow-xl">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-48 flex-shrink-0 border-r border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col">
                <div className="p-4 border-b border-slate-200/60 dark:border-slate-700/60">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Settings size={16} className="text-indigo-500" />
                        Master Configuration
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Manage global datasets</p>
                </div>
                
                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                    {MASTER_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as MasterTabKey)}
                                className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-start gap-3
                                    ${isActive 
                                        ? 'bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 text-indigo-600 dark:text-indigo-400' 
                                        : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-transparent'
                                    }`}
                            >
                                <Icon size={18} className={`mt-0.5 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                                <div>
                                    <div className={`text-sm font-medium ${isActive ? 'text-slate-900 dark:text-white' : ''}`}>
                                        {tab.label}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                                        {tab.description}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-white/80 dark:bg-slate-900/80">
                <AnimatePresence mode="wait">
                    {activeTab === 'qcaudit' && (
                        <motion.div key="qcaudit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full flex flex-col">
                            <QualityControlPanel />
                        </motion.div>
                    )}
                    {activeTab === 'sku' && (
                        <motion.div key="sku" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full flex flex-col">
                            <SkuMasterTable filters={productFilters} initialSearch={initialSearch} />
                        </motion.div>
                    )}
                    {activeTab === 'bulk' && (
                        <motion.div key="bulk" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full flex flex-col p-5 overflow-y-auto">
                            <Suspense fallback={<div className="text-sm text-slate-400 p-4">Loading bulk import…</div>}>
                                <BulkImportPanel />
                            </Suspense>
                        </motion.div>
                    )}
                    {activeTab === 'datalake' && (
                        <motion.div key="datalake" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full flex flex-col">
                            <Suspense fallback={<div className="text-sm text-slate-400 p-4">Loading data lake…</div>}>
                                <RawDataLake filters={{
                                    platform: productFilters?.platform,
                                    category: productFilters?.category,
                                    price_mode: productFilters?.price_mode,
                                    price_min: productFilters?.price_min,
                                    price_max: productFilters?.price_max,
                                }} />
                            </Suspense>
                        </motion.div>
                    )}
                    {activeTab === 'competitor' && (
                        <motion.div key="competitor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full flex flex-col">
                            <CompetitorMappingTable />
                        </motion.div>
                    )}
                    {activeTab === 'stakeholder' && (
                        <motion.div key="stakeholder" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full flex flex-col">
                            <StakeholderMappingTable />
                        </motion.div>
                    )}
                    {activeTab === 'category' && (
                        <motion.div key="category" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full flex flex-col">
                            <CategoryExtractionRules />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default MasterLayout;
