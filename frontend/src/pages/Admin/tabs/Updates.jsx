import React, { useState, useEffect } from 'react';
import { 
    UploadCloud, 
    Check, 
    Loader2, 
    Plus, 
    Trash2, 
    ChevronLeft, 
    ChevronRight, 
    ChevronDown,
    Monitor, 
    ExternalLink,
    Image as ImageIcon,
    Layout
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";

const Updates = () => {
    // --- State Management ---
    const [updateData, setUpdateData] = useState({
        title: '',
        selectedClients: [],
        steps: [
            {
                id: Date.now(),
                heading: 'Welcome to the New Feature',
                description: 'Get started by exploring our latest dashboard enhancements designed to make your workflow faster.',
                image_url: '',
                route: '/dashboard'
            }
        ]
    });
    
    const allAppRoutes = [
        { label: "Business Overview", path: "/watch-tower" },
        { label: "Insights", path: "/insights" },
        { label: "Availability Analysis", path: "/availability-analysis" },
        { label: "Visibility Analysis", path: "/visibility-anlysis" },
        { label: "Market Share", path: "/market-share", hideForDb: ['mars_petcare'] },
        { label: "Pricing Analysis", path: "/pricing-analysis", hideForDb: ['mamaearth'] },
        { label: "Performance Marketing", path: "/performance-marketing", hideForDb: ['mamaearth', 'boat'] },
        { label: "Content Score", path: "/content-score", showOnlyForDb: ['mars'] },
        { label: "Content Analysis", path: "/content-analysis" },
        { label: "Inventory Analysis", path: "/inventory", hideForDb: ['mamaearth', 'boat'] },
        { label: "Scheduled Reports", path: "/scheduled-reports" },
        { label: "Download Report", path: "/download-report", showOnlyForDb: ['emami', 'godrej', 'pidilite', 'prestige', 'sugar'] },
        { label: "India Overview", path: "/geo-intelligence" },
        { label: "Category RCA", path: "/category-rca" },
        { label: "Portfolio Analysis", path: "/volume-cohort" },
        { label: "Price Per Pack", path: "/price-per-pack" },
        { label: "Sales", path: "/sales" },
        { label: "Piy Concept", path: "/piy" },
    ];

    const [clients, setClients] = useState([]);
    const [loadingClients, setLoadingClients] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [previewStepIndex, setPreviewStepIndex] = useState(0);

    const availableRoutes = React.useMemo(() => {
        if (updateData.selectedClients.length === 0) return allAppRoutes;
        
        return allAppRoutes.filter(route => {
            // Intersection: Must be available for EVERY selected client
            return updateData.selectedClients.every(clientDb => {
                const dbName = clientDb.toLowerCase();
                if (route.showOnlyForDb && !route.showOnlyForDb.includes(dbName)) return false;
                if (route.hideForDb && route.hideForDb.includes(dbName)) return false;
                return true;
            });
        });
    }, [updateData.selectedClients]);

    // --- Fetch Clients ---
    useEffect(() => {
        const fetchClients = async () => {
            try {
                const token = sessionStorage.getItem("token");
                const response = await axios.get(`${API_BASE}/admin/databases`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.data.success) {
                    setClients(response.data.data);
                } else {
                    // Fallback to dummy data
                    setClients([{ db_id: 1, db_name: 'Client A' }, { db_id: 2, db_name: 'Client B' }]);
                }
            } catch (err) {
                console.error('[Updates] Failed to fetch clients, using fallbacks:', err);
                setClients([{ db_id: 1, db_name: 'Client A' }, { db_id: 2, db_name: 'Client B' }]);
            } finally {
                setLoadingClients(false);
            }
        };
        fetchClients();
    }, []);

    // --- Handlers ---
    const handleAddStep = () => {
        const newStep = {
            id: Date.now(),
            heading: '',
            description: '',
            image_url: '',
            route: ''
        };
        setUpdateData(prev => ({
            ...prev,
            steps: [...prev.steps, newStep]
        }));
        // Auto navigate to new step in preview
        setPreviewStepIndex(updateData.steps.length);
    };

    const handleRemoveStep = (index) => {
        if (updateData.steps.length <= 1) return;
        const newSteps = updateData.steps.filter((_, i) => i !== index);
        setUpdateData(prev => ({ ...prev, steps: newSteps }));
        if (previewStepIndex >= newSteps.length) {
            setPreviewStepIndex(newSteps.length - 1);
        }
    };

    const handleStepChange = (index, field, value) => {
        const newSteps = [...updateData.steps];
        if (field === 'route') {
            // If selecting from dropdown, we might want to store the label too
            const routeObj = allAppRoutes.find(r => r.path === value);
            newSteps[index] = { 
                ...newSteps[index], 
                route: value,
                routeLabel: routeObj ? routeObj.label : (value === '/dashboard' ? 'Dashboard' : value)
            };
        } else {
            newSteps[index] = { ...newSteps[index], [field]: value };
        }
        setUpdateData(prev => ({ ...prev, steps: newSteps }));
    };

    const handleClientToggle = (clientName) => {
        setUpdateData(prev => {
            const currentSelected = prev.selectedClients;
            if (currentSelected.includes(clientName)) {
                return { ...prev, selectedClients: currentSelected.filter(name => name !== clientName) };
            } else {
                return { ...prev, selectedClients: [...currentSelected, clientName] };
            }
        });
    };

    const handleSelectAllClients = () => {
        if (updateData.selectedClients.length === clients.length) {
            setUpdateData(prev => ({ ...prev, selectedClients: [] }));
        } else {
            setUpdateData(prev => ({ ...prev, selectedClients: clients.map(c => c.db_name) }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!updateData.title) {
            alert("Please enter an update title.");
            return;
        }

        if (updateData.selectedClients.length === 0) {
            alert("Please select at least one target client.");
            return;
        }

        setPublishing(true);
        try {
            const token = sessionStorage.getItem("token");
            const response = await axios.post(`${API_BASE}/admin/walkthrough-notifications`, updateData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                alert("Walkthrough notification published successfully!");
                // Reset form or redirect? 
                // Let's just keep it for now but clear the title
                setUpdateData(prev => ({ ...prev, title: '', selectedClients: [] }));
            }
        } catch (err) {
            console.error('[Updates] Failed to publish update:', err);
            alert(err.response?.data?.error || "Failed to publish update. Please try again.");
        } finally {
            setPublishing(false);
        }
    };

    // --- Components ---
    const currentPreviewStep = updateData.steps[previewStepIndex] || updateData.steps[0];

    return (
        <div className="flex flex-col xl:flex-row gap-6 max-w-[1600px] mx-auto">
            {/* LEFT: EDITOR PANEL */}
            <div className="flex-1 space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/30 flex items-center">
                        <div className='flex gap-2 items-center'>
                            <Layout className='w-5 h-5 text-indigo-600'/>
                            <div>
                                <h2 className="text-base font-bold text-slate-800 tracking-tight">Walkthrough Studio</h2>
                                <p className="text-xs text-slate-400 font-medium">Design an interactive guide for your users.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 space-y-6">
                        {/* Update Info Cards */}
                        <div className="space-y-4 pb-6 border-b border-slate-100">
                            {/* Update Title Card */}
                            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
                                        <Layout className="w-3 h-3 text-indigo-600" />
                                    </div>
                                    <label className="text-xs font-bold text-slate-600">Update Title</label>
                                </div>
                                <input
                                    type="text"
                                    value={updateData.title}
                                    onChange={(e) => setUpdateData({ ...updateData, title: e.target.value })}
                                    placeholder="e.g., Q2 Feature Onboarding"
                                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700 text-sm placeholder:text-slate-400"
                                />
                            </div>

                            {/* Target Clients Card */}
                            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
                                            <Check className="w-3 h-3 text-emerald-600" />
                                        </div>
                                        <label className="text-xs font-bold text-slate-600">Target Clients</label>
                                        {updateData.selectedClients.length > 0 && (
                                            <span className="ml-1 px-2 py-0.5 bg-slate-200 text-slate-600 text-[9px] font-bold rounded-full">
                                                {updateData.selectedClients.length} of {clients.length}
                                            </span>
                                        )}
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleSelectAllClients}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded-md transition-all"
                                    >
                                        {updateData.selectedClients.length === clients.length ? 'Clear All' : 'Select All'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {loadingClients ? (
                                        <div className="col-span-full flex items-center gap-2 text-slate-400 py-4 justify-center">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-[10px] font-bold">Loading clients...</span>
                                        </div>
                                    ) : (
                                        clients.map(client => {
                                            const isSelected = updateData.selectedClients.includes(client.db_name);
                                            return (
                                                <button
                                                    key={client.db_id}
                                                    type="button"
                                                    onClick={() => handleClientToggle(client.db_name)}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 border cursor-pointer ${
                                                        isSelected 
                                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                                                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                                                        isSelected 
                                                            ? 'bg-indigo-600 border-indigo-600' 
                                                            : 'bg-white border-slate-300'
                                                    }`}>
                                                        {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                                    </div>
                                                    <span className="truncate">{client.db_name}</span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Steps Builder Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className='flex items-center gap-2'>
                                    <div className='w-1.5 h-4 bg-indigo-600 rounded-full'></div>
                                    <h3 className="text-sm font-bold text-slate-800">Walkthrough Steps</h3>
                                </div>
                                <div className="px-3 py-1 bg-indigo-50 rounded-full text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                                    {updateData.steps.length} Step{updateData.steps.length !== 1 && 's'}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <AnimatePresence initial={false}>
                                    {updateData.steps.map((step, index) => (
                                        <motion.div
                                            key={step.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                                                previewStepIndex === index 
                                                    ? 'bg-white border-indigo-500 shadow-lg shadow-indigo-50' 
                                                    : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'
                                            }`}
                                            onClick={() => setPreviewStepIndex(index)}
                                        >
                                            <div className="flex gap-4">
                                                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                                                    previewStepIndex === index ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'
                                                }`}>
                                                    {index + 1}
                                                </div>
                                                <div className="flex-grow space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <input
                                                            type="text"
                                                            value={step.heading}
                                                            onChange={(e) => handleStepChange(index, 'heading', e.target.value)}
                                                            placeholder="Enter Step Heading..."
                                                            className="w-full bg-transparent border-b border-slate-200 pb-1 text-sm font-bold text-slate-800 focus:ring-0 focus:border-indigo-500 outline-none placeholder:text-slate-400 transition-colors"
                                                        />
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveStep(index); }}
                                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    <textarea
                                                        value={step.description}
                                                        onChange={(e) => handleStepChange(index, 'description', e.target.value)}
                                                        placeholder="Describe what the user should know at this step..."
                                                        className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-600 font-medium leading-relaxed shadow-sm focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 outline-none transition-all resize-none h-20 placeholder:text-slate-400"
                                                    />

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div className="relative flex items-center">
                                                            <ImageIcon className="absolute left-3 w-3.5 h-3.5 text-slate-400" />
                                                            <input
                                                                type="text"
                                                                value={step.image_url}
                                                                onChange={(e) => handleStepChange(index, 'image_url', e.target.value)}
                                                                placeholder="Image URL"
                                                                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg shadow-sm text-xs font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5 flex-1">
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Target Route</label>
                                                            <div className="relative group">
                                                                <Layout className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                                <select
                                                                    value={step.route}
                                                                    onChange={(e) => handleStepChange(index, 'route', e.target.value)}
                                                                    className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                                                                >
                                                                    <option value="">Select a route...</option>
                                                                    <option value="/dashboard">/dashboard (Default)</option>
                                                                    {availableRoutes.map(r => (
                                                                        <option key={r.path} value={r.path}>{r.label} ({r.path})</option>
                                                                    ))}
                                                                </select>
                                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                <button
                                    onClick={handleAddStep}
                                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/20 transition-all active:scale-[0.99]"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span className='font-bold text-xs'>Add Step</span>
                                </button>
                            </div>
                        </div>

                        {/* Publish Button */}
                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={handleSubmit}
                                disabled={publishing}
                                className="group flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all shadow-md shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {publishing ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Publishing...
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                                        Publish Update
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT: LIVE PREVIEW PANEL */}
            <div className="xl:w-[380px]">
                <div className="sticky top-6">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <Monitor className="w-3.5 h-3.5 text-indigo-600" />
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Preview</h3>
                    </div>

                    <div className="bg-slate-900 rounded-[2rem] p-4 shadow-xl border-8 border-slate-800 h-[620px] flex flex-col relative overflow-hidden">
                        {/* Device Notch */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-800 rounded-b-2xl z-50"></div>
                        
                        <div className="flex-grow bg-white rounded-2xl overflow-hidden relative flex flex-col mt-3">
                            {/* App Shell Mock */}
                            <div className="px-4 py-5 space-y-4 opacity-20 select-none pointer-events-none">
                                <div className="flex justify-between items-center">
                                    <div className="w-24 h-3 bg-slate-100 rounded-full"></div>
                                    <div className="w-6 h-6 rounded-full bg-slate-100"></div>
                                </div>
                                <div className="h-28 bg-slate-50 rounded-xl border border-slate-100"></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="h-20 bg-slate-50 rounded-xl border border-slate-100"></div>
                                    <div className="h-20 bg-slate-50 rounded-xl border border-slate-100"></div>
                                </div>
                                <div className="h-24 bg-slate-50 rounded-xl border border-slate-100"></div>
                            </div>

                            {/* WALKTHROUGH OVERLAY */}
                            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-5">
                                <motion.div 
                                    key={previewStepIndex}
                                    initial={{ y: 12, opacity: 0, scale: 0.97 }}
                                    animate={{ y: 0, opacity: 1, scale: 1 }}
                                    className="bg-white rounded-2xl w-full shadow-xl overflow-hidden flex flex-col ring-1 ring-black/5"
                                >
                                    {currentPreviewStep.image_url ? (
                                        <div className="h-36 bg-slate-100 overflow-hidden relative">
                                            <img 
                                                src={currentPreviewStep.image_url} 
                                                alt="Step Visual" 
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-36 bg-gradient-to-tr from-slate-50 to-indigo-50 flex flex-col items-center justify-center text-indigo-200 gap-2 border-b border-slate-50">
                                            <ImageIcon className="w-8 h-8 opacity-20" />
                                            <span className="text-[9px] font-bold uppercase tracking-widest opacity-30">No Image</span>
                                        </div>
                                    )}

                                    <div className="p-5 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className='text-[9px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5'>
                                               <div className='w-1 h-1 rounded-full bg-indigo-600 animate-pulse'></div>
                                                Step {previewStepIndex + 1}
                                            </div>
                                            <div className='text-[9px] font-bold text-slate-300'>
                                                {previewStepIndex + 1} / {updateData.steps.length}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <h4 className="text-base font-bold text-slate-800 leading-tight">
                                                {currentPreviewStep.heading || "Give your step a title"}
                                            </h4>
                                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                                {currentPreviewStep.description || "Add a description to see it here in real-time."}
                                            </p>
                                        </div>

                                        {currentPreviewStep.route && (
                                            <div className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                                <Layout className="w-3 h-3 text-indigo-500" />
                                                <span className="text-[9px] font-bold text-indigo-600">
                                                    {currentPreviewStep.routeLabel || currentPreviewStep.route}
                                                </span>
                                            </div>
                                        )}

                                        <div className="pt-2 flex gap-2">
                                            <button 
                                                disabled={previewStepIndex === 0}
                                                onClick={() => setPreviewStepIndex(Math.max(0, previewStepIndex - 1))}
                                                className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-xl flex items-center justify-center transition-all disabled:opacity-20 flex-shrink-0"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if (previewStepIndex < updateData.steps.length - 1) {
                                                        setPreviewStepIndex(previewStepIndex + 1);
                                                    } else {
                                                        alert("Guided update complete!");
                                                    }
                                                }}
                                                className="flex-grow h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-1.5"
                                            >
                                                {previewStepIndex === updateData.steps.length - 1 ? 'Finish' : 'Next Step'}
                                                <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <div className="flex items-center gap-3">
                            <Monitor className="w-4 h-4 text-indigo-400" />
                            <p className="text-[10px] text-slate-400 font-medium">Click a step card to preview it here.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Updates;
