import React, { useState } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import dayjs from "dayjs";
import { ScheduledReport } from "@/components/Reports/ScheduledReport";
import { fetchReportFilterOptions, downloadReport } from "../../api/reportsService";

export default function ScheduledReports() {
    const [filters, setFilters] = useState({
        platform: "Blinkit",
    });

    const [selectedFilters, setSelectedFilters] = useState({
        platform: "Blinkit",
        brand: "All Brands",
        city: "All Cities",
        format: "All Formats",
        timePeriod: "Last 30 Days",
        reportType: "Watch Tower",
    });

    // Custom date range state
    const [customDateRange, setCustomDateRange] = useState({
        startDate: dayjs().subtract(30, 'day'),
        endDate: dayjs(),
    });

    const [showSuccess, setShowSuccess] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

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

    const [options, setOptions] = useState({
        platforms: [],
        brands: [],
        cities: [],
        formats: [],
        months: []
    });
    const [loadingOptions, setLoadingOptions] = useState(false);

    // Fetch initial filter options (platforms)
    React.useEffect(() => {
        const loadInitialOptions = async () => {
            setLoadingOptions(true);
            try {
                const data = await fetchReportFilterOptions();
                if (data && data.platforms) {
                    setOptions(prev => ({
                        ...prev,
                        ...data,
                        months: data.months || prev.months || [],
                        formats: data.formats || prev.formats || [],
                        cities: data.cities || prev.cities || [],
                        brands: data.brands || prev.brands || []
                    }));

                    // Set default platform if available
                    if (data.platforms.length > 0 && !data.platforms.includes(selectedFilters.platform)) {
                        setSelectedFilters(prev => ({ ...prev, platform: data.platforms[0] }));
                    }
                }
            } catch (error) {
                console.error("Error loading report filter options:", error);
            } finally {
                setLoadingOptions(false);
            }
        };
        loadInitialOptions();
    }, []);

    // Fetch brands and locations when platform changes
    React.useEffect(() => {
        if (!selectedFilters.platform || selectedFilters.platform === 'All') return;

        const loadDependentOptions = async () => {
            try {
                const data = await fetchReportFilterOptions({ platform: selectedFilters.platform });
                if (data) {
                    setOptions(prev => ({
                        ...prev,
                        brands: data.brands || [],
                        cities: data.cities || [],
                        formats: data.formats || []
                    }));
                }
            } catch (error) {
                console.error("Error loading dependent options:", error);
            }
        };
        loadDependentOptions();
    }, [selectedFilters.platform]);

    const platformOptions = options.platforms.length > 0 ? options.platforms : ["Blinkit", "Zepto", "Instamart"];

    const getBrandOptions = () => {
        return ["All Brands", ...options.brands];
    };

    const getCityOptions = () => {
        return ["All Cities", ...options.cities];
    };

    const getFormatOptions = () => {
        return ["All Formats", ...options.formats];
    };

    const timePeriodOptions = [
        "Last 7 Days",
        "Last 30 Days",
        "Last 90 Days",
        "Last 6 Months",
        "Last Year",
        "Custom Range",
        ...(options.months || [])
    ];

    const reportTypeOptions = [
        "Watch Tower",
        "Availability Analysis",
        "Visibility Analysis",
        "Market Share",
        "Sales Data",
        "Pricing Analysis",
        "Performance Marketing",
        "Portfolio Analysis",
        "Content Analysis",
        "Inventory Analysis",
        "Play it Yourself",
        "Category RCA",
    ];

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const blob = await downloadReport(selectedFilters);

            // Create a link element to trigger the download
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            const fileName = `${selectedFilters.reportType.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
            link.setAttribute('download', fileName);

            document.body.appendChild(link);
            link.click();

            // Clean up
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
            }, 3000);
        } catch (error) {
            console.error("Error downloading report:", error);
            // Optionally show error notification
        } finally {
            setIsDownloading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setSelectedFilters((prev) => ({ ...prev, [key]: value }));
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
                getCityOptions={getCityOptions}
                getFormatOptions={getFormatOptions}
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
