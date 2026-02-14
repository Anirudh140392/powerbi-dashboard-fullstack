import React from 'react';
import { Box, Card, Typography, Skeleton } from '@mui/material';

/**
 * Skeleton loader for Visibility Overview section (4 metric cards)
 */
export const VisibilityOverviewSkeleton = () => {
    return (
        <Box sx={{ mb: 4 }}>
            <Card sx={{ p: 3, borderRadius: 4, boxShadow: 4 }}>
                {/* Header */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                        <Skeleton variant="circular" width={36} height={36} animation="wave" />
                        <Skeleton variant="text" width={160} height={28} animation="wave" sx={{ borderRadius: 1 }} />
                        <Skeleton variant="rounded" width={40} height={24} animation="wave" sx={{ borderRadius: 2 }} />
                    </Box>
                </Box>

                {/* Cards Row */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                    {[1, 2, 3, 4].map((i) => (
                        <Box
                            key={i}
                            sx={{
                                flex: 1,
                                minWidth: 200,
                                p: 2,
                                borderRadius: 3,
                                border: '1px solid #e2e8f0',
                                bgcolor: '#f8fafc',
                            }}
                        >
                            <Skeleton variant="text" width="60%" height={18} animation="wave" sx={{ borderRadius: 1, mb: 1 }} />
                            <Skeleton variant="text" width="80%" height={36} animation="wave" sx={{ borderRadius: 1, mb: 1 }} />
                            <Skeleton variant="text" width="90%" height={14} animation="wave" sx={{ borderRadius: 1, mb: 2 }} />
                            <Skeleton variant="text" width="50%" height={14} animation="wave" sx={{ borderRadius: 1 }} />
                            <Skeleton variant="rounded" width="100%" height={60} animation="wave" sx={{ borderRadius: 2, mt: 2 }} />
                        </Box>
                    ))}
                </Box>
            </Card>
        </Box>
    );
};

/**
 * Skeleton loader for Tabbed Heatmap Table (Platform KPI Matrix)
 */
export const TabbedHeatmapTableSkeleton = () => {
    return (
        <div className="rounded-3xl bg-white border shadow p-3 md:p-5 flex flex-col gap-4">
            {/* Tab buttons */}
            <div className="flex gap-2 bg-gray-100 border border-slate-300 rounded-full p-1 w-full md:w-max overflow-x-auto no-scrollbar">
                {['Platform', 'Format', 'City'].map((tab) => (
                    <div key={tab} className="px-4 py-1.5 rounded-full bg-slate-200 animate-pulse min-w-[80px]">
                        <span className="opacity-0">{tab}</span>
                    </div>
                ))}
            </div>

            {/* Table skeleton */}
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="px-2 md:px-4 py-3">
                                <div className="h-4 w-16 md:w-20 bg-slate-200 rounded animate-pulse"></div>
                            </th>
                            {[1, 2, 3, 4, 5].map((col) => (
                                <th key={col} className="px-2 md:px-4 py-3 text-center">
                                    <div className="h-4 w-12 md:w-16 bg-slate-200 rounded animate-pulse mx-auto"></div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2, 3, 4, 5].map((row) => (
                            <tr key={row} className="border-b border-slate-100">
                                <td className="px-2 md:px-4 py-4">
                                    <div className="h-4 w-20 md:w-24 bg-slate-200 rounded animate-pulse"></div>
                                </td>
                                {[1, 2, 3, 4, 5].map((col) => (
                                    <td key={col} className="px-2 md:px-4 py-4 text-center">
                                        <div className="h-6 md:h-8 w-12 md:w-16 bg-slate-100 rounded animate-pulse mx-auto"></div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/**
 * Skeleton loader for Visibility Drilldown Table (Keywords at a Glance)
 */
export const VisibilityDrilldownSkeleton = () => {
    return (
        <div className="flex w-full flex-col">
            <div className="px-4 md:px-6 pt-4">
                {/* View toggle skeleton */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <div className="flex rounded-full bg-gray-100 p-1 min-w-max">
                        {['Keywords', 'SKUs', 'Platforms'].map((tab) => (
                            <div key={tab} className="px-4 py-1 rounded-full bg-slate-200 animate-pulse mx-0.5">
                                <span className="opacity-0 text-sm">{tab}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden p-4 md:p-6 pt-3">
                <div className="flex flex-col h-full w-full overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-6 pt-4 pb-2 gap-4 md:gap-0">
                        <div>
                            <div className="h-6 w-48 bg-slate-200 rounded animate-pulse mb-2"></div>
                            <div className="h-4 w-64 bg-slate-100 rounded animate-pulse"></div>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="h-8 w-20 bg-slate-200 rounded-full animate-pulse"></div>
                        </div>
                    </div>

                    {/* Table skeleton */}
                    <div className="flex-1 overflow-auto p-4">
                        <div className="h-4 w-72 bg-slate-100 rounded animate-pulse mb-4"></div>
                        <table className="min-w-full">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="px-2 md:px-3 py-3"><div className="h-4 w-20 md:w-24 bg-slate-200 rounded animate-pulse"></div></th>
                                    {[1, 2, 3, 4].map((col) => (
                                        <th key={col} className="px-2 md:px-3 py-3 text-center">
                                            <div className="h-4 w-12 md:w-16 bg-slate-200 rounded animate-pulse mx-auto"></div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[1, 2, 3, 4, 5].map((row) => (
                                    <tr key={row} className="border-b border-slate-100">
                                        <td className="px-2 md:px-3 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-4 bg-slate-200 rounded animate-pulse shrink-0"></div>
                                                <div className="h-4 w-20 md:w-28 bg-slate-200 rounded animate-pulse"></div>
                                            </div>
                                        </td>
                                        {[1, 2, 3, 4].map((col) => (
                                            <td key={col} className="px-2 md:px-3 py-4 text-center">
                                                <div className="h-5 md:h-6 w-10 md:w-12 bg-slate-100 rounded animate-pulse mx-auto"></div>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Skeleton loader for Top Search Terms section
 */
export const TopSearchTermsSkeleton = () => {
    return (
        <div className="w-full rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 px-4 md:px-6 py-4 bg-white/50 gap-3 md:gap-0">
                <div className="flex items-center gap-2">
                    <div className="h-5 w-5 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-5 w-36 bg-slate-200 rounded animate-pulse"></div>
                </div>
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse"></div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80">
                            <th className="px-4 md:px-6 py-4"><div className="h-4 w-16 md:w-20 bg-slate-200 rounded animate-pulse"></div></th>
                            <th className="px-4 md:px-6 py-4"><div className="h-4 w-20 md:w-24 bg-slate-200 rounded animate-pulse"></div></th>
                            <th className="px-4 md:px-6 py-4 text-center"><div className="h-4 w-24 md:w-28 bg-slate-200 rounded animate-pulse mx-auto"></div></th>
                            <th className="px-4 md:px-6 py-4 text-center"><div className="h-4 w-24 md:w-28 bg-slate-200 rounded animate-pulse mx-auto"></div></th>
                            <th className="px-4 md:px-6 py-4 text-center"><div className="h-4 w-20 md:w-24 bg-slate-200 rounded animate-pulse mx-auto"></div></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
                            <tr key={row} className="border-b border-slate-50">
                                <td className="px-4 md:px-6 py-4">
                                    <div className="h-4 w-24 md:w-28 bg-slate-200 rounded animate-pulse"></div>
                                </td>
                                <td className="px-4 md:px-6 py-4">
                                    <div className="h-6 w-20 md:w-24 bg-slate-100 rounded animate-pulse"></div>
                                </td>
                                <td className="px-4 md:px-6 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="h-4 w-10 bg-slate-200 rounded animate-pulse"></div>
                                        <div className="h-4 w-8 bg-slate-100 rounded animate-pulse"></div>
                                    </div>
                                </td>
                                <td className="px-4 md:px-6 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="h-4 w-10 bg-slate-200 rounded animate-pulse"></div>
                                        <div className="h-4 w-8 bg-slate-100 rounded animate-pulse"></div>
                                    </div>
                                </td>
                                <td className="px-4 md:px-6 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="h-4 w-10 bg-slate-200 rounded animate-pulse"></div>
                                        <div className="h-4 w-8 bg-slate-100 rounded animate-pulse"></div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/**
 * Full page skeleton for initial Visibility Analysis load
 */
export const VisibilityPageSkeleton = () => {
    return (
        <div className="mx-auto max-w-7xl space-y-4">
            <VisibilityOverviewSkeleton />
            <TabbedHeatmapTableSkeleton />
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <VisibilityDrilldownSkeleton />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <TopSearchTermsSkeleton />
            </div>
        </div>
    );
};

export default {
    VisibilityOverviewSkeleton,
    TabbedHeatmapTableSkeleton,
    VisibilityDrilldownSkeleton,
    TopSearchTermsSkeleton,
    VisibilityPageSkeleton,
};
