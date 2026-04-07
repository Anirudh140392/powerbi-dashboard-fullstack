import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard,
    Users,
    ShieldAlert,
    Network,
    LogOut,
    Bell,
    Search,
    ChevronRight,
    User,
    Inbox
} from "lucide-react";
import { useAuth } from "../../utils/AuthContext";
import AdminDashboard from "./tabs/AdminDashboard";
import UsersTable from "./tabs/UsersTable";
import RolesPermissions from "./tabs/RolesPermissions";
import AccessMapping from "./tabs/AccessMapping";
import AllUsersTable from "./tabs/AllUsersTable";
import NewRequests from "./tabs/NewRequests";

const AdminPanel = () => {
    const [activeTab, setActiveTab] = useState("users");
    const { logout, user} = useAuth();

    const menuItems = [
        { id: "users", label: "Live Users", icon: Users },
        { id: "all-users", label: "All Users", icon: Users },
        { id: "roles", label: "Permissions", icon: ShieldAlert },
        { id: "new-requests", label: "New Requests", icon: Inbox }
    ];

    const renderContent = () => {
        switch (activeTab) {
            case "all-users": return <AllUsersTable />;
            case "users": return <UsersTable />;
            case "new-requests": return <NewRequests />;
            case "roles": return <RolesPermissions />;
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50/50 font-sans text-slate-900">
            {/* Sidebar - Clean Minimalist */}
            <aside className="w-72 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen z-50">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                            <span className="text-white font-bold text-lg italic">T</span>
                        </div>
                        <span className="text-lg font-bold tracking-tight text-slate-800 uppercase">Trailytics</span>
                    </div>

                    <nav className="space-y-1">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group cursor-pointer ${activeTab === item.id
                                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    }`}
                            >
                                <item.icon className={`w-5 h-5 transition-colors ${activeTab === item.id ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                                <span className="text-sm">
                                    {item.label}
                                </span>
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-8">
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200 text-sm font-medium"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* Minimal Header */}
                <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-40 px-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">
                            {menuItems.find(i => i.id === activeTab)?.label}
                        </h1>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 w-64 transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-4 border-l border-slate-100 pl-6">
                            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                                <Bell className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-3">
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-semibold text-slate-800 leading-none">{user?.name || "Admin"}</p>
                                    <p className="text-xs text-slate-400 mt-1">{user?.email}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold border border-slate-200">
                                    {user?.email?.[0].toUpperCase() || <User className="w-5 h-5" />}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Container */}
                <div className="p-10 max-w-7xl mx-auto w-full flex-1">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.2 }}
                            className="h-full"
                        >
                            {renderContent()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

export default AdminPanel;
