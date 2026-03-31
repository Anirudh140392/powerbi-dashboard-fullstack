import React, { useState } from "react";
import {
    Box,
    Drawer,
    Typography,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
} from "@mui/material";
import {
    Close,
} from "@mui/icons-material";
import { motion, AnimatePresence } from 'framer-motion';
import {
    MapPin,
    TrendingUp,
    TrendingDown,
    DollarSign,
    LineChart,
    ChevronDown,
    ChevronUp,
    Info
} from 'lucide-react';
import { cn } from '../../lib/utils';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            type: 'spring',
            stiffness: 100
        }
    }
};

function KpiCard({ title, value, change, icon: Icon, colorClass }) {
    return (
        <motion.div
            variants={itemVariants}
            className="flex-1 bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden group"
        >
            <div className={cn("absolute top-0 right-0 w-24 h-24 -mt-8 -mr-8 opacity-[0.03] transition-transform duration-500 group-hover:scale-110", colorClass)}>
                <Icon size={96} />
            </div>

            <div className="flex items-start justify-between mb-4">
                <div className={cn("p-2.5 rounded-2xl", colorClass.replace('text-', 'bg-').replace('600', '50'))}>
                    <Icon size={18} className={colorClass} />
                </div>
            </div>

            <Typography variant="caption" className="text-slate-500 font-bold uppercase tracking-wider mb-1 block">
                {title}
            </Typography>
            <div className="flex items-baseline gap-2">
                <Typography variant="h4" className="font-extrabold text-slate-800">
                    {value}
                </Typography>
                {change && (
                    <div className={cn(
                        "flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-lg",
                        change.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    )}>
                        {change}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export default function PricingRcaDrawer({ entityName, dimensionType, onClose }) {
    const [showAllCities, setShowAllCities] = useState(false);

    if (!entityName) return null;

    // Mock data for Pricing RCA
    const mockCities = [
        {
            name: "Mumbai",
            discount: 15.2,
            discountChange: 2.1,
            pricePerUnit: 185.00,
            priceChange: -10.50,
            asp: 192.00,
            aspChange: 5.00
        },
        {
            name: "Delhi",
            discount: 12.8,
            discountChange: -1.2,
            pricePerUnit: 192.50,
            priceChange: 5.20,
            asp: 205.00,
            aspChange: 12.00
        },
        {
            name: "Bengaluru",
            discount: 14.5,
            discountChange: 3.5,
            pricePerUnit: 178.00,
            priceChange: -15.00,
            asp: 188.00,
            aspChange: -2.50
        },
        {
            name: "Hyderabad",
            discount: 11.2,
            discountChange: 0.5,
            pricePerUnit: 198.00,
            priceChange: 2.00,
            asp: 210.00,
            aspChange: 8.00
        }
    ];

    const displayedCities = showAllCities
        ? mockCities
        : mockCities.slice(0, 3);

    return (
        <Drawer
            anchor="right"
            open={Boolean(entityName)}
            onClose={onClose}
            transitionDuration={400}
            PaperProps={{
                sx: {
                    width: 960,
                    bgcolor: '#f8fafc',
                    boxShadow: '-10px 0 30px rgba(0,0,0,0.05)',
                    border: 'none'
                },
            }}
        >
            <Box className="flex flex-col h-full bg-[#f8fafc]">
                {/* Header */}
                <div className="bg-white px-8 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_3px_rgb(0,0,0,0.02)]">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                            <TrendingUp size={24} className="text-white" />
                        </div>
                        <div>
                            <Typography variant="h5" className="font-black text-slate-800 tracking-tight">
                                Pricing Analysis RCA
                            </Typography>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">{dimensionType} Analysis</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                <span className="text-[14px] font-bold text-blue-600">{entityName}</span>
                            </div>
                        </div>
                    </div>

                    <IconButton
                        onClick={onClose}
                        className="bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-2xl transition-all duration-300"
                    >
                        <Close size={20} />
                    </IconButton>
                </div>

                <Box className="p-8 overflow-y-auto custom-scrollbar">
                    {/* KPI Section */}
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="flex gap-6 mb-10"
                    >
                        <KpiCard
                            title="Avg Discount"
                            value="12.4%"
                            change="+1.2%"
                            icon={TrendingUp}
                            colorClass="text-blue-600"
                        />
                        <KpiCard
                            title="Avg Price"
                            value="₹185.5"
                            change="-₹10.5"
                            icon={DollarSign}
                            colorClass="text-emerald-600"
                        />
                    </motion.div>

                    {/* Table Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_40px_rgb(0,0,0,0.03)] overflow-hidden"
                    >
                        <div className="px-8 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                    <MapPin size={16} />
                                </div>
                                <Typography className="font-extrabold text-slate-700 text-sm uppercase tracking-wider">
                                    City Performance Breakdown
                                </Typography>
                            </div>
                            <div className="flex items-center gap-2 text-[12px] font-bold text-slate-400 bg-white px-3 py-1.5 rounded-xl border border-slate-100">
                                <Info size={14} />
                                MTD vs Previous Month
                            </div>
                        </div>

                        <TableContainer>
                            <Table stickyHeader className="border-collapse">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ pl: 4, fontWeight: 800, fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', tracking: '0.1em', bgcolor: 'white' }}>City</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', tracking: '0.1em', bgcolor: 'white' }}>Discount %</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', tracking: '0.1em', bgcolor: 'white' }}>Avg Selling Price</TableCell>
                                        <TableCell align="right" sx={{ pr: 4, fontWeight: 800, fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', tracking: '0.1em', bgcolor: 'white' }}>ASP</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <AnimatePresence mode="popLayout">
                                        {displayedCities.map((city, idx) => (
                                            <TableRow
                                                component={motion.tr}
                                                key={city.name}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.5 + (idx * 0.05) }}
                                                hover
                                                className="group transition-colors duration-200"
                                            >
                                                <TableCell sx={{ pl: 4, py: 3, borderBottom: '1px solid #f8fafc' }}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors duration-300">
                                                            <MapPin size={14} />
                                                        </div>
                                                        <Typography className="font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                                                            {city.name}
                                                        </Typography>
                                                    </div>
                                                </TableCell>
                                                <TableCell align="right" sx={{ py: 3, borderBottom: '1px solid #f8fafc' }}>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[15px] font-black text-slate-800">{city.discount}%</span>
                                                        <span className={cn(
                                                            "text-[11px] font-extrabold flex items-center gap-0.5",
                                                            city.discountChange >= 0 ? "text-emerald-500" : "text-rose-500"
                                                        )}>
                                                            {city.discountChange >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                            {Math.abs(city.discountChange).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell align="right" sx={{ py: 3, borderBottom: '1px solid #f8fafc' }}>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[15px] font-black text-slate-800">₹{city.pricePerUnit}</span>
                                                        <span className={cn(
                                                            "text-[11px] font-extrabold flex items-center gap-0.5",
                                                            city.priceChange >= 0 ? "text-emerald-500" : "text-rose-500"
                                                        )}>
                                                            {city.priceChange >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                            ₹{Math.abs(city.priceChange).toFixed(1)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell align="right" sx={{ pr: 4, py: 3, borderBottom: '1px solid #f8fafc' }}>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[15px] font-black text-slate-800">₹{city.asp}</span>
                                                        <span className={cn(
                                                            "text-[11px] font-extrabold flex items-center gap-0.5",
                                                            city.aspChange >= 0 ? "text-emerald-500" : "text-rose-500"
                                                        )}>
                                                            {city.aspChange >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                            ₹{Math.abs(city.aspChange).toFixed(1)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </AnimatePresence>
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <div className="p-6 bg-slate-50/30 flex justify-center border-t border-slate-50">
                            <Button
                                onClick={() => setShowAllCities(!showAllCities)}
                                className="bg-white hover:bg-slate-100 text-slate-600 font-bold px-6 py-2 rounded-2xl border border-slate-200 shadow-sm transition-all duration-300"
                                startIcon={showAllCities ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            >
                                {showAllCities ? "Show Less Cities" : `Show All ${mockCities.length} Cities`}
                            </Button>
                        </div>
                    </motion.div>
                </Box>
            </Box>
        </Drawer>
    );
}
