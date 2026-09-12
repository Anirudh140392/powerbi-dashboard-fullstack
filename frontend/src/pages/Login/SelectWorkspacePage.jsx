import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../utils/AuthContext';
import {
    ArrowRight,
    LogOut,
    CheckCircle2,
    Building2,
    Layers,
    Loader2
} from 'lucide-react';

const SelectWorkspacePage = () => {
    const { user, switchDb, logout } = useAuth();
    const navigate = useNavigate();
    const [selectedDb, setSelectedDb] = useState(null);
    const [switching, setSwitching] = useState(false);
    const [imageErrorMap, setImageErrorMap] = useState({});

    const mappedDatabases = user?.mappedDatabases || [];
    const currentDbName = (user?.dbName || '').toLowerCase();

    const handleSelectWorkspace = async (dbItem) => {
        if (switching) return;
        const targetDbName = dbItem.dbName;
        setSelectedDb(targetDbName);
        setSwitching(true);

        try {
            // Mark workspace as selected for this session
            sessionStorage.setItem('workspaceSelected', 'true');
            sessionStorage.setItem('activeWorkspaceDb', targetDbName);

            // Switch database context if target is different or re-sync
            if (targetDbName.toLowerCase() !== currentDbName) {
                await switchDb(targetDbName);
            } else {
                navigate('/watch-tower', { replace: true });
            }
        } catch (error) {
            console.error('[SelectWorkspace] Error switching workspace:', error);
            setSwitching(false);
            setSelectedDb(null);
        }
    };

    const handleImageError = (dbName) => {
        setImageErrorMap(prev => ({ ...prev, [dbName]: true }));
    };

    const formatDbName = (name) => {
        if (!name) return 'Workspace';
        if (name.toLowerCase() === 'drl') return 'Dr. Reddy\'s';
        if (name.toLowerCase() === 'mars') return 'Mars Wrigley';
        if (name.toLowerCase() === 'pidilite') return 'Pidilite';
        if (name.toLowerCase() === 'colpal') return 'Colgate-Palmolive';
        return name.charAt(0).toUpperCase() + name.slice(1);
    };

    return (
        <div className="min-h-screen w-screen bg-white font-['Outfit',_sans-serif] text-slate-800 flex flex-col justify-between p-6 md:p-10 relative overflow-hidden select-none">
            {/* Top Navigation Bar */}
            <div className="w-full max-w-7xl mx-auto flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    <img
                        src="/sidebar_logo.png"
                        alt="Trailytics Logo"
                        className="h-9 w-auto object-contain"
                    />
                </div>

                <div className="flex items-center gap-4">
                    {user?.email && (
                        <div className="hidden sm:flex flex-col text-right">
                            <span className="text-xs font-semibold text-slate-700">{user.name || user.email.split('@')[0]}</span>
                            <span className="text-[11px] text-slate-400">{user.email}</span>
                        </div>
                    )}
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100/70 hover:bg-slate-200/80 rounded-xl transition-all duration-200"
                        title="Sign Out"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Sign Out</span>
                    </button>
                </div>
            </div>

            {/* Main Selection Area */}
            <div className="w-full max-w-5xl mx-auto my-auto py-12 flex flex-col items-center text-center z-10">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col items-center"
                >
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-5 shadow-sm">
                        <Layers className="w-6 h-6" />
                    </div>

                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
                        Select Your Workspace
                    </h1>
                    <p className="text-slate-500 text-sm md:text-base max-w-lg mb-10 leading-relaxed">
                        Please choose a workspace to access its dedicated Business Overview dashboard and unified commerce intelligence.
                    </p>
                </motion.div>

                {/* Workspace Cards Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl"
                >
                    {mappedDatabases.map((db, idx) => {
                        const isCurrentActive = db.dbName.toLowerCase() === currentDbName;
                        const isSelectedThisSession = selectedDb === db.dbName;
                        const hasImageError = imageErrorMap[db.dbName];
                        const logoUrl = db.dbLogoUrl;

                        return (
                            <motion.div
                                key={db.dbName || idx}
                                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSelectWorkspace(db)}
                                className={`
                                    group relative bg-white rounded-2xl border p-6 flex flex-col items-center justify-between text-center cursor-pointer transition-all duration-300 min-h-[200px]
                                    ${isSelectedThisSession && switching
                                        ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-lg'
                                        : 'border-slate-200/90 shadow-sm hover:shadow-xl hover:border-indigo-400'
                                    }
                                `}
                            >
                                {/* Selected Badge */}
                                {isCurrentActive && (
                                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-200/60 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Active
                                    </div>
                                )}

                                {/* Logo / Image Container */}
                                <div className="w-full h-24 flex items-center justify-center p-2 mb-4">
                                    {logoUrl && !hasImageError ? (
                                        <img
                                            src={logoUrl}
                                            alt={db.dbName}
                                            onError={() => handleImageError(db.dbName)}
                                            className="max-h-20 max-w-[170px] w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300">
                                            {db.dbName ? db.dbName.substring(0, 2).toUpperCase() : 'WS'}
                                        </div>
                                    )}
                                </div>

                                {/* Workspace Info & Action */}
                                <div className="w-full flex flex-col items-center gap-2">
                                    <h3 className="text-base font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                        {formatDbName(db.dbName)}
                                    </h3>

                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 opacity-90 group-hover:opacity-100 transition-opacity mt-1">
                                        {isSelectedThisSession && switching ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                <span>Launching Workspace...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Enter Dashboard</span>
                                                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            </div>

            {/* Footer */}
            <div className="w-full max-w-7xl mx-auto text-center text-xs text-slate-400 z-10 py-2">
                © 2026 Trailytics Unified E-Commerce Intelligence. All rights reserved.
            </div>
        </div>
    );
};

export default SelectWorkspacePage;
