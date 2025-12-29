import React, { useState } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import dayjs from "dayjs";
import { ScheduledReport } from "@/components/Reports/ScheduledReport";

export default function ScheduledReports() {
    const [filters, setFilters] = useState({
        platform: "Blinkit",
    });

    const [selectedFilters, setSelectedFilters] = useState({
        platform: "Blinkit",
        brand: "All Brands",
        location: "All Locations",
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

    // Data mapping for dependent dropdowns
    const dataMapping = {
        "Blinkit": {
            brands: ["All Brands", "Brand A", "Brand B", "Premium Line"],
            locations: ["All Locations", "North Region", "Metro Cities", "Tier 2 Cities"]
        },
        "Zepto": {
            brands: ["All Brands", "Brand A", "Brand D", "Premium Line"],
            locations: ["All Locations", "West Region", "Metro Cities", "Tier 2 Cities"]
        },
        "Instamart": {
            brands: ["All Brands", "Brand B", "Brand C", "Economy Line"],
            locations: ["All Locations", "South Region", "East Region", "Metro Cities"]
        },
        "Amazon": {
            brands: ["All Brands", "Brand A", "Brand C", "Brand D", "Premium Line"],
            locations: ["All Locations", "North Region", "South Region", "East Region", "West Region", "Metro Cities"]
        },
        "Flipkart": {
            brands: ["All Brands", "Brand B", "Brand C", "Brand D", "Economy Line"],
            locations: ["All Locations", "North Region", "South Region", "East Region", "West Region", "Tier 2 Cities"]
        }
    };

    // Dropdown options - Platform is independent
    const platformOptions = [
        "Blinkit",
        "Zepto",
        "Instamart",
        "Amazon",
        "Flipkart",
    ];

    // Get filtered brand options based on selected platform
    const getBrandOptions = () => {
        return dataMapping[selectedFilters.platform]?.brands || ["All Brands"];
    };

    // Get filtered location options based on selected platform
    const getLocationOptions = () => {
        return dataMapping[selectedFilters.platform]?.locations || ["All Locations"];
    };

    const timePeriodOptions = [
        "Last 7 Days",
        "Last 30 Days",
        "Last 90 Days",
        "Last 6 Months",
        "Last Year",
        "Custom Range",
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

    const handleDownload = () => {
        setIsDownloading(true);

        // Simulate download
        setTimeout(() => {
            setIsDownloading(false);
            setShowSuccess(true);

            setTimeout(() => {
                setShowSuccess(false);
            }, 3000);
        }, 2000);
    };

    const handleFilterChange = (key, value) => {
        setSelectedFilters((prev) => {
            const newFilters = { ...prev, [key]: value };

            // Reset dependent dropdowns when platform changes
            if (key === "platform") {
                const newBrands = dataMapping[value]?.brands || ["All Brands"];
                const newLocations = dataMapping[value]?.locations || ["All Locations"];

                // Reset to "All" if current selection is not available in new platform
                if (!newBrands.includes(prev.brand)) {
                    newFilters.brand = "All Brands";
                }
                if (!newLocations.includes(prev.location)) {
                    newFilters.location = "All Locations";
                }
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
