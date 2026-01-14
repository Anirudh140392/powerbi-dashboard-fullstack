import React from 'react';
import { Box, Card, Typography, Skeleton } from '@mui/material';

/**
 * Skeleton loader for Availability Overview section (3 metric cards)
 * Same style as Visibility page's VisibilityOverviewSkeleton
 */
export const AvailabilityOverviewSkeleton = () => {
    return (
        <Box sx={{ mb: 4 }}>
            <Card sx={{ p: 3, borderRadius: 4, boxShadow: 4 }}>
                {/* Header */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                        <Skeleton variant="circular" width={36} height={36} animation="wave" />
                        <Skeleton variant="text" width={180} height={28} animation="wave" sx={{ borderRadius: 1 }} />
                        <Skeleton variant="rounded" width={40} height={24} animation="wave" sx={{ borderRadius: 2 }} />
                    </Box>
                </Box>

                {/* Cards Row - 3 cards for Availability */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                    {[1, 2, 3].map((i) => (
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
 * Skeleton loader for Platform KPI Matrix (TabbedHeatmapTable)
 * Same style as Visibility page's TabbedHeatmapTableSkeleton
 */
export const PlatformKpiMatrixSkeleton = () => {
    return (
        <div className="rounded-3xl bg-white border shadow p-5 flex flex-col gap-4">
            {/* Tab buttons */}
            <div className="flex gap-2 bg-gray-100 border border-slate-300 rounded-full p-1 w-max">
                {['Platform', 'Format', 'City'].map((tab) => (
                    <div key={tab} className="px-4 py-1.5 rounded-full bg-slate-200 animate-pulse">
                        <span className="opacity-0">{tab}</span>
                    </div>
                ))}
            </div>

            {/* Table skeleton */}
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="px-4 py-3">
                                <div className="h-4 w-20 bg-slate-200 rounded animate-pulse"></div>
                            </th>
                            {[1, 2, 3, 4, 5].map((col) => (
                                <th key={col} className="px-4 py-3 text-center">
                                    <div className="h-4 w-16 bg-slate-200 rounded animate-pulse mx-auto"></div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2, 3, 4, 5].map((row) => (
                            <tr key={row} className="border-b border-slate-100">
                                <td className="px-4 py-4">
                                    <div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div>
                                </td>
                                {[1, 2, 3, 4, 5].map((col) => (
                                    <td key={col} className="px-4 py-4 text-center">
                                        <div className="h-8 w-16 bg-slate-100 rounded animate-pulse mx-auto"></div>
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
 * Skeleton loader for OSA % Detail View table
 * Same style as Visibility page's drilldown skeleton
 */
export const OsaDetailViewSkeleton = () => {
    return (
        <div className="rounded-3xl flex-col bg-slate-50 relative">
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 overflow-auto p-0 pr-0">
                    <div className="rounded-3xl border bg-white p-4 shadow relative">
                        {/* Title + Legend skeleton */}
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <div className="h-5 w-32 bg-slate-200 rounded animate-pulse"></div>
                                <div className="h-3 w-48 bg-slate-100 rounded animate-pulse"></div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-20 bg-slate-200 rounded-full animate-pulse"></div>
                                <div className="flex items-center gap-2">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-6 w-16 bg-slate-100 rounded-full animate-pulse"></div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Table skeleton */}
                        <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                            <div className="overflow-auto">
                                <table className="min-w-[1200px] w-full border-separate border-spacing-0">
                                    <thead className="sticky top-0 z-10 bg-white">
                                        <tr>
                                            <th className="sticky left-0 z-20 bg-slate-50 py-3 pl-4 pr-4 border-b border-slate-200" style={{ minWidth: 280 }}>
                                                <div className="h-4 w-28 bg-slate-200 rounded animate-pulse"></div>
                                            </th>
                                            <th className="bg-slate-50 py-3 px-3 border-b border-slate-200">
                                                <div className="h-4 w-12 bg-slate-200 rounded animate-pulse mx-auto"></div>
                                            </th>
                                            <th className="bg-slate-50 py-3 px-3 border-b border-slate-200">
                                                <div className="h-4 w-16 bg-slate-200 rounded animate-pulse mx-auto"></div>
                                            </th>
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((col) => (
                                                <th key={col} className="bg-slate-50 py-3 px-3 border-b border-slate-200">
                                                    <div className="h-4 w-10 bg-slate-200 rounded animate-pulse mx-auto"></div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[1, 2, 3, 4, 5].map((row) => (
                                            <tr key={row} className="border-l-4 border-slate-200">
                                                <td className="sticky left-0 bg-white px-3 py-2 border-b border-slate-100" style={{ minWidth: 280 }}>
                                                    <div className="h-4 w-36 bg-slate-200 rounded animate-pulse"></div>
                                                </td>
                                                <td className="px-3 py-2 border-b border-slate-100 text-center">
                                                    <div className="h-4 w-10 bg-slate-100 rounded animate-pulse mx-auto"></div>
                                                </td>
                                                <td className="px-3 py-2 border-b border-slate-100">
                                                    <div className="h-5 w-14 bg-slate-100 rounded-full animate-pulse mx-auto"></div>
                                                </td>
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((col) => (
                                                    <td key={col} className="px-2 py-2 border-b border-slate-100 text-center">
                                                        <div className="h-5 w-10 bg-slate-100 rounded animate-pulse mx-auto"></div>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination skeleton */}
                            <div className="mt-3 flex items-center justify-between text-[11px] px-4 py-3 border-t border-slate-200">
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-12 bg-slate-200 rounded-full animate-pulse"></div>
                                    <div className="h-4 w-16 bg-slate-100 rounded animate-pulse"></div>
                                    <div className="h-6 w-12 bg-slate-200 rounded-full animate-pulse"></div>
                                </div>
                                <div className="h-6 w-20 bg-slate-200 rounded animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Full page skeleton for initial Availability Analysis load
 */
export const AvailabilityPageSkeleton = () => {
    return (
        <div className="max-w-7xl mx-auto space-y-5">
            <div className="space-y-4">
                <AvailabilityOverviewSkeleton />
                <PlatformKpiMatrixSkeleton />
                <OsaDetailViewSkeleton />
            </div>
        </div>
    );
};

export default {
    AvailabilityOverviewSkeleton,
    PlatformKpiMatrixSkeleton,
    OsaDetailViewSkeleton,
    AvailabilityPageSkeleton,
};
