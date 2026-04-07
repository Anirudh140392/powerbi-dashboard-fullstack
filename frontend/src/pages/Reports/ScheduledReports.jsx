import React, { useState, useEffect, useCallback } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import dayjs from "dayjs";
import { ScheduledReport } from "@/components/Reports/ScheduledReport";
import { saveAs } from 'file-saver';
import { fetchReportFilterOptions, downloadReport, fetchAvailableReportTypes } from "../../api/reportsService";
import { FilterContext } from "../../utils/FilterContext";
import { useContext } from "react";

export default function ScheduledReports() {
    const { refreshFilters } = useContext(FilterContext);

    // Restore comprehensive platform list from rca_sku_dim on mount
    // (Prevents subsetting from other pages like Performance Marketing)
    useEffect(() => {
        if (typeof refreshFilters === 'function') {
            refreshFilters();
        }
    }, [refreshFilters]);

    const [filters, setFilters] = useState({
        platform: "Blinkit",
    });

    const [selectedFilters, setSelectedFilters] = useState({
        platform: "Blinkit",
        brand: "All Brands",
        category: "All Categories",
        sku: "All SKUs",
        location: "All Locations",
        timePeriod: "Last 30 Days",
        reportType: "Business Overview",
    });

    // Custom date range state
    const [customDateRange, setCustomDateRange] = useState({
        startDate: dayjs().subtract(30, 'day'),
        endDate: dayjs(),
    });

    const [showSuccess, setShowSuccess] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Dynamic filter options from backend
    const [filterOptions, setFilterOptions] = useState({
        platforms: [],
        brands: [],
        cities: [],
        formats: [],
        skus: [],
        months: [],
    });

    // Dynamic report types from backend
    const [availableReportTypes, setAvailableReportTypes] = useState([]);

    // Fetch available report types on mount
    useEffect(() => {
        const loadReportTypes = async () => {
            const types = await fetchAvailableReportTypes();
            if (types.length > 0) {
                setAvailableReportTypes(types);
                // If current reportType is not in the available list, switch to first available
                if (!types.includes(selectedFilters.reportType)) {
                    setSelectedFilters(prev => ({ ...prev, reportType: types[0] }));
                }
            }
        };
        loadReportTypes();
    }, []);

    // Fetch filter options from backend whenever filters change
    const loadFilterOptions = useCallback(async (filters) => {
        try {
            const params = {};
            if (filters.platform && filters.platform !== 'All') params.platform = filters.platform;
            if (filters.brand && filters.brand !== 'All Brands') params.brand = filters.brand;
            if (filters.location && filters.location !== 'All Locations') params.city = filters.location;
            if (filters.category && filters.category !== 'All Categories') params.format = filters.category;

            const data = await fetchReportFilterOptions(params);
            setFilterOptions({
                platforms: data.platforms || [],
                brands: data.brands || [],
                cities: data.cities || [],
                formats: data.formats || [],
                skus: data.skus || [],
                months: data.months || [],
            });
        } catch (err) {
            console.error('[ScheduledReports] Failed to fetch filter options:', err);
        }
    }, []);

    // Fetch filter options on mount and when any relevant filter changes
    useEffect(() => {
        loadFilterOptions(selectedFilters);
    }, [
        selectedFilters.platform,
        selectedFilters.brand,
        selectedFilters.location,
        selectedFilters.category,
        loadFilterOptions
    ]);

    // Scheduled reports state (persist in localStorage)
    const [scheduledReports, setScheduledReports] = useState(() => {
        try {
            const raw = localStorage.getItem("scheduledReports");
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    });

    const [scheduleSuccess, setScheduleSuccess] = useState(false);

    const persistSchedules = (arr) => {
        try {
            localStorage.setItem("scheduledReports", JSON.stringify(arr));
        } catch (e) {
            // ignore
        }
    };

    const onScheduleAdd = (schedule) => {
        // ensure id and required fields
        const sched = {
            id: schedule.id || Date.now().toString(),
            email: schedule.email,
            frequency: schedule.frequency || "Daily",
            time: schedule.time || (dayjs().hour(9).minute(0).format("hh:mm A")),
            reportConfig: schedule.reportConfig || { reportType: selectedFilters.reportType, platform: selectedFilters.platform },
        };
        setScheduledReports((prev) => {
            const next = [sched, ...prev];
            persistSchedules(next);
            return next;
        });
        setScheduleSuccess(true);
        setTimeout(() => setScheduleSuccess(false), 3000);
    };

    const onScheduleDelete = (id) => {
        setScheduledReports((prev) => {
            const next = prev.filter((s) => s.id !== id);
            persistSchedules(next);
            return next;
        });
    };

    // Dropdown options derived from backend data
    const platformOptions = filterOptions.platforms.length > 0
        ? filterOptions.platforms
        : [];

    const getBrandOptions = () => {
        const brands = filterOptions.brands || [];
        return ["All Brands", ...brands];
    };

    const getCategoryOptions = () => {
        const formats = filterOptions.formats || [];
        return ["All Categories", ...formats];
    };

    const getSkuOptions = () => {
        const skus = filterOptions.skus || [];
        return ["All SKUs", ...skus];
    };

    const getLocationOptions = () => {
        const cities = filterOptions.cities || [];
        return ["All Locations", ...cities];
    };

    const timePeriodOptions = [
        "Last 7 Days",
        "Last 30 Days",
        "Last 90 Days",
        "Last 6 Months",
        "Last Year",
        "Custom Range",
    ];

    // Report types from backend (fallback to common types while loading)
    const reportTypeOptions = availableReportTypes.length > 0
        ? availableReportTypes
        : [
            "Business Overview",
            "Availability Analysis",
            "Visibility Analysis",
            "Sales Data",
            "Pricing Analysis",
            "Performance Marketing",
            "Inventory Analysis",
        ];

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const { platform, brand, location, timePeriod, reportType, category } = selectedFilters;

            // Build params for backend API
            const params = {
                platform: platform || undefined,
                brand: (brand && brand !== 'All Brands') ? brand : undefined,
                city: (location && location !== 'All Locations') ? location : undefined,
                format: (category && category !== 'All Categories') ? category : undefined,
                timePeriod: timePeriod,
                reportType: reportType,
            };

            // Handle custom date range
            if (timePeriod === "Custom Range") {
                params.startDate = dayjs(customDateRange.startDate).format('YYYY-MM-DD');
                params.endDate = dayjs(customDateRange.endDate).format('YYYY-MM-DD');
            }

            // Call backend API — it returns an Excel blob
            const blob = await downloadReport(params);

            // Trigger file download
            const fileName = `${reportType.replace(/\s+/g, '_')}_${timePeriod.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD')}.xlsx`;
            saveAs(blob, fileName);

            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            console.error('[ScheduledReports] Download failed:', err);
            alert('Failed to download report. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setSelectedFilters((prev) => {
            const newFilters = { ...prev, [key]: value };

            // Reset dependent dropdowns when platform changes
            if (key === "platform") {
                newFilters.brand = "All Brands";
                newFilters.location = "All Locations";
                newFilters.category = "All Categories";
                newFilters.sku = "All SKUs";
            }

            return newFilters;
        });
    };

    return (
        <CommonContainer
            title="Scheduled Reports"
            filters={filters}
            onFiltersChange={setFilters}
        >
            <ScheduledReport
                selectedFilters={selectedFilters}
                handleFilterChange={handleFilterChange}
                handleDownload={handleDownload}
                isDownloading={isDownloading}
                showSuccess={showSuccess}
                platformOptions={platformOptions}
                getBrandOptions={getBrandOptions}
                getCategoryOptions={getCategoryOptions}
                getSkuOptions={getSkuOptions}
                getLocationOptions={getLocationOptions}
                timePeriodOptions={timePeriodOptions}
                reportTypeOptions={reportTypeOptions}
                customDateRange={customDateRange}
                setCustomDateRange={setCustomDateRange}
                scheduledReports={scheduledReports}
                onScheduleAdd={onScheduleAdd}
                onScheduleDelete={onScheduleDelete}
                scheduleSuccess={scheduleSuccess}
                setScheduleSuccess={setScheduleSuccess}
            />
        </CommonContainer>
    );
}
