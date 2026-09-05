import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Mail, Database, Shield, Send, CheckCircle, AlertCircle, Copy, Link as LinkIcon } from "lucide-react";

const InviteUser = () => {
    const [email, setEmail] = useState("");
    const [selectedDbId, setSelectedDbId] = useState("");
    const [role, setRole] = useState("user");
    const [databases, setDatabases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingDbs, setFetchingDbs] = useState(true);
    const [message, setMessage] = useState(null);
    const [inviteResult, setInviteResult] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchDatabases = async () => {
            try {
                const token = sessionStorage.getItem("token");
                const API_BASE = import.meta.env.VITE_API_URL
                    ? `${import.meta.env.VITE_API_URL}/api`
                    : "/api";

                const response = await axios.get(`${API_BASE}/admin/databases`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.data.success) {
                    setDatabases(response.data.data);
                    if (response.data.data.length > 0) {
                        setSelectedDbId(response.data.data[0].db_id);
                    }
                }
            } catch (err) {
                console.error("Error fetching databases:", err);
            } finally {
                setFetchingDbs(false);
            }
        };
        fetchDatabases();
    }, []);

    const handleSendInvite = async (e) => {
        e.preventDefault();
        if (!email || !selectedDbId) return;

        setLoading(true);
        setMessage(null);
        setInviteResult(null);

        try {
            const token = sessionStorage.getItem("token");
            const API_BASE = import.meta.env.VITE_API_URL
                ? `${import.meta.env.VITE_API_URL}/api`
                : "/api";

            const response = await axios.post(
                `${API_BASE}/admin/invite-user`,
                { email, dbId: selectedDbId, role },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setMessage({ type: "success", text: response.data.message });
                setInviteResult(response.data);
                setEmail("");
            } else {
                setMessage({ type: "error", text: response.data.error || "Failed to send invitation." });
            }
        } catch (err) {
            console.error("Invite user error:", err);
            setMessage({
                type: "error",
                text: err.response?.data?.error || "An error occurred while sending the invitation."
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = () => {
        if (inviteResult?.inviteLink) {
            navigator.clipboard.writeText(inviteResult.inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 font-sans">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Invite New User</h1>
                <p className="text-sm text-slate-500 mt-1">
                    Send an email invitation mapping a user to a specific tenant database. The user will set their password via email and can log in via Password, Google SSO, or Microsoft SSO.
                </p>
            </div>

            {/* Invite Form Card */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm"
            >
                {message && (
                    <div
                        className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
                            message.type === "success"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}
                    >
                        {message.type === "success" ? (
                            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                        )}
                        <span>{message.text}</span>
                    </div>
                )}

                <form onSubmit={handleSendInvite} className="space-y-6">
                    {/* User Email */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            User Email Address *
                        </label>
                        <div className="relative">
                            <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                                type="email"
                                required
                                placeholder="colleague@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-800 text-sm transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Target Database */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Target Tenant Database *
                            </label>
                            <div className="relative">
                                <Database className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                <select
                                    required
                                    value={selectedDbId}
                                    onChange={(e) => setSelectedDbId(e.target.value)}
                                    disabled={fetchingDbs}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-800 text-sm transition-all appearance-none cursor-pointer"
                                >
                                    {fetchingDbs ? (
                                        <option>Loading databases...</option>
                                    ) : (
                                        databases.map((db) => (
                                            <option key={db.db_id} value={db.db_id}>
                                                {db.db_name.replace(/_/g, " ").toUpperCase()} (ID: {db.db_id})
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                        </div>

                        {/* User Role */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                User Access Role
                            </label>
                            <div className="relative">
                                <Shield className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-800 text-sm transition-all appearance-none cursor-pointer"
                                >
                                    <option value="user">Standard User</option>
                                    <option value="admin">Administrator</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading || fetchingDbs || !email}
                            className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <Send className="w-4 h-4" />
                            {loading ? "Sending Invitation..." : "Send Email Invitation"}
                        </button>
                    </div>
                </form>
            </motion.div>

            {/* Invitation Link Box (For Dev / Easy Testing) */}
            {inviteResult?.inviteLink && (
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 space-y-3"
                >
                    <div className="flex items-center gap-2 text-indigo-900 font-semibold text-sm">
                        <LinkIcon className="w-4 h-4 text-indigo-600" />
                        <span>Direct Invitation URL (Available for immediate testing):</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            readOnly
                            value={inviteResult.inviteLink}
                            className="flex-1 px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-xs font-mono text-slate-700 outline-none select-all"
                        />
                        <button
                            onClick={handleCopyLink}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            {copied ? "Copied!" : "Copy Link"}
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default InviteUser;
