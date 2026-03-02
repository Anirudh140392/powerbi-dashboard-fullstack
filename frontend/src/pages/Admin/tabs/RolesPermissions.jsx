import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Shield,
    Users,
    ChevronDown,
    ChevronRight,
    Search,
    Database,
    Layout,
    CheckCircle2,
    XCircle,
    ChevronLeft,
    ChevronsLeft,
    ChevronsRight
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

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
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(8);

    const tabsList = [
        "Watch Tower", "Map Intellect", "Insights", "Availability Analysis",
        "Visibility Analysis", "Market Share", "Sales Data", "Pricing Analysis",
        "Performance Marketing", "Portfolio Analysis", "Content Analysis",
        "Inventory Analysis", "Play it Yourself", "Category RCA",
        "Scheduled Reports", "Ad Auto", "Rating", "Supply", "Content"
    ];

    const [usersData, setUsersData] = useState([
        {
            id: 1,
            name: "Sanyam Miglani",
            email: "sanyam.m@trailytics.com",
            role: "Manager",
            dbName: "Mars",
            dbStatus: true,
            tabs: tabsList.reduce((acc, tab) => ({ ...acc, [tab]: true }), {})
        },
        {
            id: 2,
            name: "Shubham Singh",
            email: "shubham.s@trailytics.com",
            role: "Super Admin",
            dbName: "Colpal",
            dbStatus: true,
            tabs: tabsList.reduce((acc, tab) => ({ ...acc, [tab]: tab !== "Pricing Analysis" }), {})
        },
        {
            id: 3,
            name: "Arjun Singh",
            email: "arjun.si@trailytics.com",
            role: "Viewer",
            dbName: "Report_DB",
            dbStatus: false,
            tabs: tabsList.reduce((acc, tab) => ({ ...acc, [tab]: ["Insights", "Sales Data"].includes(tab) }), {})
        },
        {
            id: 4,
            name: "Priya Sharma",
            email: "priya.sh@trailytics.com",
            role: "Analyst",
            dbName: "Market_Intelligence",
            dbStatus: true,
            tabs: tabsList.reduce((acc, tab) => ({ ...acc, [tab]: tab.includes("Analysis") }), {})
        },
        {
            id: 5,
            name: "Rahul Verma",
            email: "rahul.v@trailytics.com",
            role: "Manager",
            dbName: "Sales_Tracker",
            dbStatus: true,
            tabs: tabsList.reduce((acc, tab) => ({ ...acc, [tab]: ["Sales Data", "Insights", "Watch Tower"].includes(tab) }), {})
        },
        {
            id: 6,
            name: "Ananya Iyer",
            email: "ananya.i@trailytics.com",
            role: "Super Admin",
            dbName: "Core_System",
            dbStatus: true,
            tabs: tabsList.reduce((acc, tab) => ({ ...acc, [tab]: true }), {})
        },
        {
            id: 7,
            name: "Vikram Malhotra",
            email: "vikram.m@trailytics.com",
            role: "Viewer",
            dbName: "ReadOnly_Store",
            dbStatus: true,
            tabs: tabsList.reduce((acc, tab) => ({ ...acc, [tab]: ["Rating", "Supply", "Content"].includes(tab) }), {})
        },
        {
            id: 8,
            name: "Sneha Kapoor",
            email: "sneha.k@trailytics.com",
            role: "Manager",
            dbName: "Ad_Operations",
            dbStatus: false,
            tabs: tabsList.reduce((acc, tab) => ({ ...acc, [tab]: tab.startsWith("Ad") || tab === "Scheduled Reports" }), {})
        },
        {
            id: 9,
            name: "Amit Patel",
            email: "amit.p@trailytics.com",
            role: "Analyst",
            dbName: "Supply_Chain_DB",
            dbStatus: true,
            tabs: tabsList.reduce((acc, tab) => ({ ...acc, [tab]: ["Supply", "Inventory Analysis", "Watch Tower"].includes(tab) }), {})
        },
        {
            id: 10,
            name: "Kavita Reddy",
            email: "kavita.r@trailytics.com",
            role: "Super Admin",
            dbName: "Analytics_Pro",
            dbStatus: true,
            tabs: tabsList.reduce((acc, tab) => ({ ...acc, [tab]: true }), {})
        }
    ]);

    const toggleUserExpansion = (userId) => {
        setExpandedUsers(prev => ({
            ...prev,
            [userId]: !prev[userId]
        }));
    };

    const handleTabStatusChange = (userId, tabName) => {
        setUsersData(prev => prev.map(user => {
            if (user.id === userId) {
                return {
                    ...user,
                    tabs: {
                        ...user.tabs,
                        [tabName]: !user.tabs[tabName]
                    }
                };
            }
            return user;
        }));
    };

    const handleDbStatusChange = (userId) => {
        setUsersData(prev => prev.map(user => {
            if (user.id === userId) {
                return { ...user, dbStatus: !user.dbStatus };
            }
            return user;
        }));
    };

    const filteredUsers = usersData.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + rowsPerPage);

    const handleRowsPerPageChange = (e) => {
        setRowsPerPage(parseInt(e.target.value, 10));
        setCurrentPage(1);
    };

    return (
        <div className="space-y-0.5 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <div>
                    <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-1">Access Roles & Permissions</h2>
                    <p className="text-slate-500 text-xs font-medium">Manage user-level access to platform modules and databases.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>
                    {/* <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2 whitespace-nowrap">
                        <Users className="w-4 h-4" />
                        Add User
                    </button> */}
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
                            {/* <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-4">Tab Status</TableHead> */}
                            <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-4">Db Name</TableHead>
                            <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-4">Db status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedUsers.map((user) => (
                            <React.Fragment key={user.id}>
                                <TableRow
                                    className={`group cursor-pointer transition-colors border-slate-100 ${expandedUsers[user.id] ? "bg-indigo-50/30" : "hover:bg-slate-50/50"
                                        }`}
                                    onClick={() => toggleUserExpansion(user.id)}
                                >
                                    <TableCell className="pl-4 py-4">
                                        <div className="text-slate-400 transition-transform duration-200" style={{ transform: expandedUsers[user.id] ? 'rotate(90deg)' : 'none' }}>
                                            <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[10px]">
                                                {user.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-900">{user.name}</p>
                                                <p className="text-[10px] text-slate-500 font-medium">{user.role}</p>
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
                                    {/* <TableCell className="py-4">
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg w-fit">
                                            <Layout className="w-3 h-3 text-slate-400" />
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                                Expand for details
                                            </span>
                                        </div>
                                    </TableCell> */}
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
                                                onChange={() => handleDbStatusChange(user.id)}
                                            />
                                            {/* {user.dbStatus ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-rose-500" />
                                            )} */}
                                        </div>
                                    </TableCell>
                                </TableRow>

                                <AnimatePresence>
                                    {expandedUsers[user.id] && (
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
                                                                                onChange={() => handleTabStatusChange(user.id, tab)}
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
                                <option value={20}>30</option>
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
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        >
                            <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1 px-4">
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i + 1}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${currentPage === i + 1
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                        : 'text-slate-500 hover:bg-slate-50'
                                        }`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        >
                            <ChevronsRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RolesPermissions;
