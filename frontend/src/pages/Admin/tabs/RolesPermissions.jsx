import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Shield,
    Users,
    UserPlus,
    X,
    ChevronDown,
    ChevronRight,
    Search,
    Database,
    Layout,
    CheckCircle2,
    XCircle,
    ChevronLeft,
    ChevronsLeft,
    ChevronsRight,
    Loader2
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";

const Switch = ({ checked, onChange }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
            e.stopPropagation();
            onChange();
        }}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
    >
        <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'
                }`}
        />
    </button>
);

const RolesPermissions = () => {
    const [expandedUsers, setExpandedUsers] = useState({});
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDb, setSelectedDb] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(8);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        db_name: ""
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalError, setModalError] = useState(null);

    // These are the tab labels that match the Sidebar menu items
    const tabsList = [
        "Business Overview", "India Overview", "Insights", "Availability Analysis",
        "Market Coverage", "Visibility Analysis", "Market Share", "Sales Data", 
        "Pricing Analysis", "Performance Marketing", "Portfolio Analysis", "Content Analysis",
        "Inventory Analysis", "Play it Yourself", "Category RCA",
        "Scheduled Reports", "Download Report", "Ad Auto", "Rating", "Supply", "Content", "Priority Action", "PDS Score"
    ];

    const [usersData, setUsersData] = useState([]);
    const [allDatabases, setAllDatabases] = useState([]);
    const [selectedAllDb, setSelectedAllDb] = useState("mars");

    // Fetch users and databases from the API on mount
    useEffect(() => {
        fetchPermissionsUsers();
        fetchDatabases();
    }, []);

    const fetchDatabases = async () => {
        try {
            const token = sessionStorage.getItem("token");
            const response = await axios.get(`${API_BASE}/admin/databases`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                // Deduplicate by db_id to ensure unique React keys
                const uniqueDbs = [];
                const seenIds = new Set();
                for (const db of response.data.data) {
                    if (db && db.db_id && !seenIds.has(db.db_id)) {
                        seenIds.add(db.db_id);
                        uniqueDbs.push(db);
                    }
                }
                setAllDatabases(uniqueDbs);
            }
        } catch (err) {
            console.error('[RolesPermissions] Failed to fetch databases:', err);
        }
    };

    const fetchPermissionsUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = sessionStorage.getItem("token");
            const response = await axios.get(`${API_BASE}/admin/permissions/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                const users = response.data.data.map((user, idx) => {
                    // Build tabs object: if tabPermissions has entries, use them; otherwise default all to true
                    const tabPerms = user.tabPermissions || {};
                    const hasAnyPerm = Object.keys(tabPerms).length > 0;
                    const tabs = tabsList.reduce((acc, tab) => {
                        acc[tab] = hasAnyPerm ? (tabPerms[tab] !== undefined ? tabPerms[tab] : true) : true;
                        return acc;
                    }, {});

                    return {
                        id: user.id, // Use actual device/user_id from backend
                        email: user.email,
                        name: user.name || user.email.split('@')[0],
                        role: user.role || 'user',
                        ip: user.ip || 'N/A', // Display IP if needed, though optional
                        dbName: user.dbName || 'N/A',
                        dbStatus: user.dbStatus,
                        tabs
                    };
                });
                setUsersData(users);
            }
        } catch (err) {
            console.error('[RolesPermissions] Failed to fetch users:', err);
            setError('Failed to load permission data');
        } finally {
            setLoading(false);
        }
    };

    const toggleUserExpansion = (userEmail) => {
        setExpandedUsers(prev => ({
            ...prev,
            [userEmail]: !prev[userEmail]
        }));
    };

    const handleTabStatusChange = async (userEmail, tabName) => {
        const user = usersData.find(u => u.email === userEmail);
        if (!user) return;

        const newTabValue = !user.tabs[tabName];
        const updatedTabs = { ...user.tabs, [tabName]: newTabValue };

        // Optimistic update
        setUsersData(prev => prev.map(u => {
            if (u.email === userEmail) {
                return { ...u, tabs: updatedTabs };
            }
            return u;
        }));

        // Persist to backend
        try {
            const token = sessionStorage.getItem("token");
            await axios.patch(`${API_BASE}/admin/permissions/tab-permissions`, {
                email: user.email,
                tabPermissions: updatedTabs
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            console.error('[RolesPermissions] Failed to update tab permissions:', err);
            // Revert on error
            setUsersData(prev => prev.map(u => {
                if (u.email === userEmail) {
                    return { ...u, tabs: { ...updatedTabs, [tabName]: !newTabValue } };
                }
                return u;
            }));
        }
    };

    const handleAllTabsToggle = async (userEmail) => {
        const user = usersData.find(u => u.email === userEmail);
        if (!user) return;

        const allActive = tabsList.every(tab => user.tabs[tab]);
        const newValue = !allActive;
        const updatedTabs = tabsList.reduce((acc, tab) => {
            acc[tab] = newValue;
            return acc;
        }, {});

        // Optimistic update
        setUsersData(prev => prev.map(u => {
            if (u.email === userEmail) {
                return { ...u, tabs: updatedTabs };
            }
            return u;
        }));

        // Persist to backend
        try {
            const token = sessionStorage.getItem("token");
            await axios.patch(`${API_BASE}/admin/permissions/tab-permissions`, {
                email: user.email,
                tabPermissions: updatedTabs
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            console.error('[RolesPermissions] Failed to toggle all tab permissions:', err);
            // Revert on error
            const revertedTabs = tabsList.reduce((acc, tab) => {
                acc[tab] = !newValue;
                return acc;
            }, {});
            setUsersData(prev => prev.map(u => {
                if (u.email === userEmail) {
                    return { ...u, tabs: revertedTabs };
                }
                return u;
            }));
        }
    };

    const handleDbStatusChange = async (userEmail) => {
        const user = usersData.find(u => u.email === userEmail);
        if (!user) return;

        const newStatus = !user.dbStatus;

        // Optimistic update
        setUsersData(prev => prev.map(u => {
            if (u.email === userEmail) {
                return { ...u, dbStatus: newStatus };
            }
            return u;
        }));

        // Persist to backend
        try {
            const token = sessionStorage.getItem("token");
            await axios.patch(`${API_BASE}/admin/permissions/db-status`, {
                email: user.email,
                dbStatus: newStatus
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            console.error('[RolesPermissions] Failed to update db status:', err);
            // Revert on error
            setUsersData(prev => prev.map(u => {
                if (u.email === userEmail) {
                    return { ...u, dbStatus: !newStatus };
                }
                return u;
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.db_name.trim()) newErrors.db_name = "Database Name is required";
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleOpenModal = () => {
        setFormData({ db_name: "" });
        setErrors({});
        setModalError(null);
        setIsSubmitting(false);
        setShowModal(true);
    };

    const handleAddDatabase = async (e) => {
        e.preventDefault();
        setModalError(null);
        if (validateForm()) {
            try {
                setIsSubmitting(true);
                const token = sessionStorage.getItem("token");
                const response = await axios.post(`${API_BASE}/admin/databases`, {
                    db_name: formData.db_name
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.data.success) {
                    setShowModal(false);
                    setFormData({ db_name: "" });
                    setErrors({});
                    fetchDatabases();
                } else {
                    setModalError(response.data.error || "Failed to create database");
                }
            } catch (err) {
                console.error('[RolesPermissions] Failed to add database:', err);
                const msg = err.response?.data?.error || err.message || "Failed to create database";
                setModalError(msg);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const filteredUsers = usersData.filter(user => {
        // Database filter
        if (selectedDb !== 'all' && user.dbName !== selectedDb) return false;
        // Search filter
        const q = searchTerm.toLowerCase();
        return !q || user.name.toLowerCase().includes(q) ||
            user.email.toLowerCase().includes(q) ||
            user.role.toLowerCase().includes(q) ||
            user.dbName.toLowerCase().includes(q);
    });

    const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + rowsPerPage);

    const handleRowsPerPageChange = (e) => {
        setRowsPerPage(parseInt(e.target.value, 10));
        setCurrentPage(1);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                <span className="ml-3 text-sm text-slate-500 font-medium">Loading permissions data...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <XCircle className="w-8 h-8 text-rose-500" />
                <span className="text-sm text-slate-600 font-medium">{error}</span>
                <button 
                    onClick={fetchPermissionsUsers}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all cursor-pointer"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-0.5 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <div>
                    <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-1">Access Roles & Permissions</h2>
                    <p className="text-slate-500 text-xs font-medium">Manage user-level access to platform modules and databases.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-52">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>
                    <select
                        value={selectedDb}
                        onChange={(e) => { setSelectedDb(e.target.value); setCurrentPage(1); }}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer appearance-none pr-8 transition-all"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                    >
                        <option value="all">All Databases ({usersData.length})</option>
                        {[...new Set(usersData.map(u => u.dbName))].filter(d => d && d !== 'N/A').sort().map(db => (
                            <option key={db} value={db}>
                                {db} ({usersData.filter(u => u.dbName === db).length})
                            </option>
                        ))}
                    </select>
                    <button 
                        onClick={handleOpenModal}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                        <UserPlus className="w-4 h-4" />
                        Add Database
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-t-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent border-slate-200">
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-4 pl-4">User</TableHead>
                            <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-4">Tab Permission</TableHead>
                            <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-4">Email</TableHead>
                            <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-4">Db Name</TableHead>
                            <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-4">Db status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {/* "All" Master Control Row */}
                        {currentPage === 1 && (
                            <React.Fragment key="all-master-row">
                                <TableRow
                                    className={`group cursor-pointer transition-colors border-slate-100 ${expandedUsers['all'] ? "bg-slate-50/80" : "hover:bg-slate-50/50"}`}
                                    style={{ borderLeft: '3px solid #6366f1' }}
                                    onClick={() => toggleUserExpansion('all')}
                                >
                                    <TableCell className="pl-4 py-4">
                                        <div className="text-slate-400 transition-transform duration-200" style={{ transform: expandedUsers['all'] ? 'rotate(90deg)' : 'none' }}>
                                            <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-[9px] shadow-sm shadow-indigo-200">
                                                ALL
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-900">All</p>
                                                <p className="text-[10px] text-slate-500 font-medium">Master Control</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg w-fit">
                                            <Layout className="w-3 h-3 text-slate-400" />
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                                Expand for details
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <p className="text-xs font-medium text-slate-600">-</p>
                                    </TableCell>
                                    <TableCell className="py-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="relative flex items-center gap-2">
                                            <Database className="w-3.5 h-3.5 text-slate-400" />
                                            <div className="relative">
                                                <select
                                                    value={selectedAllDb}
                                                    onChange={(e) => setSelectedAllDb(e.target.value)}
                                                    className="appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 cursor-pointer transition-all hover:border-indigo-300"
                                                >
                                                    {allDatabases.map(db => (
                                                        <option key={db.db_id} value={db.db_name.toLowerCase()}>
                                                            {db.db_name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-3">
                                            {(() => {
                                                const filteredByDb = usersData.filter(u => u.dbName.toLowerCase() === selectedAllDb.toLowerCase());
                                                const allDbActive = filteredByDb.length > 0 && filteredByDb.every(u => u.dbStatus);
                                                return (
                                                    <>
                                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${allDbActive ? 'text-indigo-600' : 'text-slate-300'}`}>
                                                            {allDbActive ? 'Active' : 'Inactive'}
                                                        </span>
                                                        <Switch
                                                            checked={allDbActive}
                                                            onChange={async () => {
                                                                const newStatus = !allDbActive;
                                                                setUsersData(prev => prev.map(u => {
                                                                    if (u.dbName.toLowerCase() === selectedAllDb.toLowerCase()) {
                                                                        return { ...u, dbStatus: newStatus };
                                                                    }
                                                                    return u;
                                                                }));
                                                                try {
                                                                    const token = sessionStorage.getItem("token");
                                                                    await Promise.all(filteredByDb.map(u =>
                                                                        axios.patch(`${API_BASE}/admin/permissions/db-status`, {
                                                                            email: u.email,
                                                                            dbStatus: newStatus
                                                                        }, { headers: { Authorization: `Bearer ${token}` } })
                                                                    ));
                                                                } catch (err) {
                                                                    console.error('[RolesPermissions] Failed to toggle DB statuses for selected DB:', err);
                                                                    fetchPermissionsUsers();
                                                                }
                                                            }}
                                                        />
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </TableCell>
                                </TableRow>

                                <AnimatePresence>
                                    {expandedUsers['all'] && (
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell colSpan={7} className="p-0">
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                                    className="overflow-hidden bg-indigo-50/20"
                                                >
                                                    <div className="px-14 py-4 space-y-2">
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                            {tabsList.map((tab) => {
                                                                const filteredByDb = usersData.filter(u => u.dbName.toLowerCase() === selectedAllDb.toLowerCase());
                                                                const allUsersHaveTab = filteredByDb.length > 0 && filteredByDb.every(u => u.tabs[tab]);
                                                                return (
                                                                    <div
                                                                        key={tab}
                                                                        className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all"
                                                                    >
                                                                        <div className="flex flex-col gap-1">
                                                                            <span className="text-[11px] font-semibold text-slate-600">{tab}</span>
                                                                        </div>
                                                                        <div className="flex flex-col items-end gap-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`text-[9px] font-bold uppercase tracking-wider ${allUsersHaveTab ? 'text-indigo-600' : 'text-slate-300'}`}>
                                                                                    {allUsersHaveTab ? 'Active' : 'Inactive'}
                                                                                </span>
                                                                                <Switch
                                                                                    checked={allUsersHaveTab}
                                                                                    onChange={async () => {
                                                                                        const newVal = !allUsersHaveTab;
                                                                                        // Optimistic update for filtered users
                                                                                        setUsersData(prev => prev.map(u => {
                                                                                            if (u.dbName.toLowerCase() === selectedAllDb.toLowerCase()) {
                                                                                                return { ...u, tabs: { ...u.tabs, [tab]: newVal } };
                                                                                            }
                                                                                            return u;
                                                                                        }));
                                                                                        // Persist for each user
                                                                                        try {
                                                                                            const token = sessionStorage.getItem("token");
                                                                                            await Promise.all(filteredByDb.map(u => {
                                                                                                const updatedTabs = { ...u.tabs, [tab]: newVal };
                                                                                                return axios.patch(`${API_BASE}/admin/permissions/tab-permissions`, {
                                                                                                    email: u.email,
                                                                                                    tabPermissions: updatedTabs
                                                                                                }, { headers: { Authorization: `Bearer ${token}` } });
                                                                                            }));
                                                                                        } catch (err) {
                                                                                            console.error('[RolesPermissions] Failed to toggle all tab permissions for selected database:', err);
                                                                                            fetchPermissionsUsers();
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </AnimatePresence>
                            </React.Fragment>
                        )}
                        {paginatedUsers.map((user) => (
                            <React.Fragment key={user.email}>
                                <TableRow
                                    className={`group cursor-pointer transition-colors border-slate-100 ${expandedUsers[user.email] ? "bg-indigo-50/30" : "hover:bg-slate-50/50"
                                        }`}
                                    onClick={() => toggleUserExpansion(user.email)}
                                >
                                    <TableCell className="pl-4 py-4">
                                        <div className="text-slate-400 transition-transform duration-200" style={{ transform: expandedUsers[user.email] ? 'rotate(90deg)' : 'none' }}>
                                            <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[10px]">
                                                {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-900">{user.name}</p>
                                                <p className="text-[10px] text-slate-500 font-medium capitalize">{user.role}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg w-fit">
                                            <Layout className="w-3 h-3 text-slate-400" />
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                                Expand for details
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <p className="text-xs font-medium text-slate-600">{user.email}</p>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-2">
                                            <Database className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="text-xs font-semibold text-slate-700">{user.dbName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[9px] font-bold uppercase tracking-wider ${user.dbStatus ? 'text-indigo-600' : 'text-slate-300'}`}>
                                                {user.dbStatus ? 'Active' : 'Inactive'}
                                            </span>
                                            <Switch
                                                checked={user.dbStatus}
                                                onChange={() => handleDbStatusChange(user.email)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>

                                <AnimatePresence>
                                    {expandedUsers[user.email] && (
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell colSpan={7} className="p-0">
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                                    className="overflow-hidden bg-slate-50/30"
                                                >
                                                    <div className="px-14 py-4 space-y-2">
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                            {/* All - Master Toggle */}
                                                            <div
                                                                className={`flex items-center justify-between p-3 rounded-xl hover:shadow-sm transition-all border-2 ${
                                                                    tabsList.every(tab => user.tabs[tab])
                                                                        ? 'bg-indigo-50 border-indigo-300'
                                                                        : 'bg-white border-indigo-200'
                                                                }`}
                                                            >
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[11px] font-bold text-indigo-700">All</span>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${tabsList.every(tab => user.tabs[tab]) ? 'text-indigo-600' : 'text-slate-300'}`}>
                                                                            {tabsList.every(tab => user.tabs[tab]) ? 'Active' : 'Inactive'}
                                                                        </span>
                                                                        <Switch
                                                                            checked={tabsList.every(tab => user.tabs[tab])}
                                                                            onChange={() => handleAllTabsToggle(user.email)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {tabsList.map((tab) => (
                                                                <div
                                                                    key={tab}
                                                                    className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all"
                                                                >
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[11px] font-semibold text-slate-600">{tab}</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-[9px] font-bold uppercase tracking-wider ${user.tabs[tab] ? 'text-indigo-600' : 'text-slate-300'}`}>
                                                                                {user.tabs[tab] ? 'Active' : 'Inactive'}
                                                                            </span>
                                                                            <Switch
                                                                                checked={user.tabs[tab]}
                                                                                onChange={() => handleTabStatusChange(user.email, tab)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </AnimatePresence>
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            {filteredUsers.length > 8 && (
                <div className="flex flex-col sm:flex-row rounded-b-2xl justify-between items-center gap-1 bg-white pl-4 pr-4 pt-2 pb-2 border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rows per page</span>
                            <select
                                value={rowsPerPage}
                                onChange={handleRowsPerPageChange}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value={8}>8</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={30}>30</option>
                            </select>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Showing {startIndex + 1}-{Math.min(startIndex + rowsPerPage, filteredUsers.length)} of {filteredUsers.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                        >
                            <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1 px-4 overflow-x-auto hide-scrollbar">
                            {(() => {
                                const pages = [];
                                if (totalPages <= 7) {
                                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                                } else {
                                    if (currentPage <= 4) {
                                        for (let i = 1; i <= 5; i++) pages.push(i);
                                        pages.push('...');
                                        pages.push(totalPages);
                                    } else if (currentPage >= totalPages - 3) {
                                        pages.push(1);
                                        pages.push('...');
                                        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                                    } else {
                                        pages.push(1);
                                        pages.push('...');
                                        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                                        pages.push('...');
                                        pages.push(totalPages);
                                    }
                                }
                                return pages.map((page, index) => {
                                    if (page === '...') {
                                        return (
                                            <span key={`ellipsis-${index}`} className="w-7 h-7 flex items-center justify-center text-xs font-bold text-slate-400">
                                                ...
                                            </span>
                                        );
                                    }
                                    return (
                                        <button
                                            key={`page-${page}`}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${currentPage === page
                                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                                : 'text-slate-500 hover:bg-slate-50'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    );
                                });
                            })()}
                        </div>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                        >
                            <ChevronsRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
            {/* Add Database Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Add New Database</h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                             <form onSubmit={handleAddDatabase} className="p-6 space-y-4">
                                {modalError && (
                                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5">
                                        <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                        <p className="text-xs font-semibold text-rose-600 leading-relaxed">{modalError}</p>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Database Name (String)</label>
                                    <div className="relative">
                                        <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={formData.db_name}
                                            onChange={(e) => setFormData({ ...formData, db_name: e.target.value })}
                                            placeholder="e.g. Sales_Analytics"
                                            disabled={isSubmitting}
                                            className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border ${errors.db_name ? 'border-rose-300 ring-rose-50' : 'border-slate-200 focus:ring-indigo-500/10 focus:border-indigo-500'} rounded-xl text-sm transition-all focus:ring-4 outline-none`}
                                        />
                                    </div>
                                    {errors.db_name && <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase tracking-tighter italic">! {errors.db_name}</p>}
                                </div>

                                <div className="pt-4 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        disabled={isSubmitting}
                                        className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all font-sans cursor-pointer disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 px-4 py-2.5 bg-indigo-600 rounded-xl text-sm font-bold text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-sans cursor-pointer disabled:opacity-75 flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Creating...</span>
                                            </>
                                        ) : (
                                            <span>Create Database</span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RolesPermissions;
