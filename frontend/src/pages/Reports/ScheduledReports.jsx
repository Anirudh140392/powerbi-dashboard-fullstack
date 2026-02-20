import React, { useState } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import dayjs from "dayjs";
import { ScheduledReport } from "@/components/Reports/ScheduledReport";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { getLogicalKpiValue } from "../../components/AllAvailablityAnalysis/availablityDataCenter";

export default function ScheduledReports() {
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

    // Data mapping for dependent dropdowns - Using actual project entities
    const dataMapping = {
        "Blinkit": {
            brands: ["All Brands", "Kwality Walls", "Amul", "Mother Dairy", "Cornetto", "Magnum", "Feast", "Twister"],
            categories: ["All Categories", "Cassata", "Core Tub", "Cup", "Sandwich", "Sticks", "Tubs"],
            skus: ["All SKUs", "Magnum Butterscotch Cone", "Cornetto Double Chocolate", "Feast Cadbury Crackle", "Vanilla Ice Cream Tub"],
            locations: ["All Locations", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Pune", "Chennai", "Kolkata"]
        },
        "Zepto": {
            brands: ["All Brands", "Kwality Walls", "Amul", "Mother Dairy", "Cornetto", "Magnum"],
            categories: ["All Categories", "Cassata", "Cup", "Sandwich", "Sticks", "Tubs"],
            skus: ["All SKUs", "Magnum Chocolate Truffle", "Cornetto Oreo Cone", "Magnum Brownie Stick"],
            locations: ["All Locations", "Mumbai", "Delhi", "Bangalore", "Pune"]
        },
        "Instamart": {
            brands: ["All Brands", "Kwality Walls", "Amul", "Mother Dairy", "Cornetto", "Feast"],
            categories: ["All Categories", "Core Tub", "Cup", "Sandwich", "Sticks", "Tubs"],
            skus: ["All SKUs", "Magnum Pistachio Stick", "Dairy Factory Vanilla Tub", "Cornetto Double Chocolate"],
            locations: ["All Locations", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai"]
        },
        "Amazon": {
            brands: ["All Brands", "Kwality Walls", "Amul", "Mother Dairy", "Cornetto", "Magnum", "Feast"],
            categories: ["All Categories", "Cassata", "Core Tub", "Cup", "Sandwich", "Sticks", "Tubs"],
            skus: ["All SKUs", "Magnum Butterscotch Cone", "Cornetto Oreo Cone", "Vanilla Ice Cream Tub"],
            locations: ["All Locations", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Pune", "Chennai", "Kolkata"]
        },
        "Flipkart": {
            brands: ["All Brands", "Kwality Walls", "Amul", "Mother Dairy", "Cornetto", "Magnum"],
            categories: ["All Categories", "Cassata", "Core Tub", "Cup", "Sandwich", "Sticks"],
            skus: ["All SKUs", "Magnum Chocolate Truffle", "Feast Cadbury Crackle", "Magnum Brownie Stick"],
            locations: ["All Locations", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Pune", "Chennai", "Kolkata"]
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

    // Get filtered options based on selected platform
    const getBrandOptions = () => {
        return dataMapping[selectedFilters.platform]?.brands || ["All Brands"];
    };

    const getCategoryOptions = () => {
        return dataMapping[selectedFilters.platform]?.categories || ["All Categories"];
    };

    const getSkuOptions = () => {
        return dataMapping[selectedFilters.platform]?.skus || ["All SKUs"];
    };

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

        const { platform, brand, location, timePeriod, reportType } = selectedFilters;

        // Calculate date range
        let end = dayjs();
        let start = dayjs().subtract(30, 'day');

        if (timePeriod === "Last 7 Days") start = dayjs().subtract(7, 'day');
        else if (timePeriod === "Last 90 Days") start = dayjs().subtract(90, 'day');
        else if (timePeriod === "Last 6 Months") start = dayjs().subtract(6, 'month');
        else if (timePeriod === "Last Year") start = dayjs().subtract(1, 'year');
        else if (timePeriod === "Custom Range") {
            start = dayjs(customDateRange.startDate);
            end = dayjs(customDateRange.endDate);
        }

        const dates = [];
        let curr = start;
        while (curr.isBefore(end) || curr.isSame(end, 'day')) {
            dates.push(curr.format('YYYY-MM-DD'));
            curr = curr.add(1, 'day');
        }

        // Mock entities for report generation
        const platforms = platform === "All" ? platformOptions : [platform];
        const brands = (brand === "All Brands" || brand === "All") ? (dataMapping[platform]?.brands.filter(b => b !== "All Brands") || []) : [brand];
        const locations = (location === "All Locations" || location === "All") ? (dataMapping[platform]?.locations.filter(l => l !== "All Locations") || []) : [location];
        const categories = (selectedFilters.category === "All Categories" || selectedFilters.category === "All") ? (dataMapping[platform]?.categories.filter(c => c !== "All Categories") || []) : [selectedFilters.category];
        const products = (selectedFilters.sku === "All SKUs" || selectedFilters.sku === "All") ? (dataMapping[platform]?.skus.filter(s => s !== "All SKUs") || []) : [selectedFilters.sku];

        const reportData = [];

        dates.forEach(date => {
            platforms.forEach(p => {
                brands.forEach(b => {
                    locations.forEach(loc => {
                        categories.forEach((cat, catIdx) => {
                            const prod = products[catIdx % products.length];
                            const context = { platform: p, brand: b, location: loc, category: cat, sku: prod, date };

                            let row = {};

                            if (reportType === "Visibility Analysis") {
                                // Clamp SOS to 20% max as per user request
                                const baseSos = getLogicalKpiValue('sos', context);
                                const overallSos = Math.min(20, (baseSos / 5.5) + (catIdx % 3));
                                const sponsoredRatio = (getLogicalKpiValue('inorg', context) / (getLogicalKpiValue('sos', context) || 1)) || 0.3;
                                const sponsoredVal = overallSos * Math.min(0.7, sponsoredRatio);
                                const organicVal = overallSos - sponsoredVal;

                                row = {
                                    DATE: date,
                                    Platform: p,
                                    Brand: b,
                                    Keyword_Category: cat,
                                    Keyword_Type: catIdx % 2 === 0 ? "Competition" : "Generic",
                                    Overall_SOS_Percentage: overallSos.toFixed(2),
                                    Sponsored_SOS_Percentage: sponsoredVal.toFixed(2),
                                    Organic_SOS_Percentage: organicVal.toFixed(2),
                                    Ad_POS: (2.5 + (Math.abs(p.length - catIdx) % 1.5)).toFixed(2),
                                    Org_POS: (4.2 + (Math.abs(b.length - catIdx) % 2.5)).toFixed(2),
                                };
                            } else if (reportType === "Availability Analysis") {
                                const osaVal = getLogicalKpiValue('osa', context);
                                const dsVal = getLogicalKpiValue('dslisting', context) || 85;
                                const aspVal = getLogicalKpiValue('asp', context) || 150;
                                const discVal = (getLogicalKpiValue('promo', context) / 10).toFixed(2);

                                row = {
                                    DATE: date,
                                    Platform: p,
                                    Brand: b,
                                    Category: cat,
                                    Product: prod,
                                    City: loc,
                                    OSA: osaVal.toFixed(2),
                                    "DS Listing": (dsVal / 10).toFixed(2),
                                    ASP: (aspVal / 15).toFixed(2),
                                    Discount: discVal,
                                };
                            } else if (reportType === "Market Share") {
                                const offtake = getLogicalKpiValue('offtake', context);
                                const marketShare = getLogicalKpiValue('market', context);
                                row = {
                                    DATE: date,
                                    Platform: p,
                                    Brand: b,
                                    Category: cat,
                                    Product: prod,
                                    City: loc,
                                    Offtakes: offtake.toFixed(2),
                                    "SKU MS": (marketShare / 5).toFixed(2),
                                    "Category Size": (offtake * 3).toFixed(2),
                                    "Brand MS": marketShare.toFixed(2),
                                };
                            }
                            else if (reportType === "Sales Data") {
                                const offtake = getLogicalKpiValue('offtake', context);
                                row = {
                                    DATE: date,
                                    Platform: p,
                                    Brand: b,
                                    Category: cat,
                                    Product: prod,
                                    City: loc,
                                    Offtakes: offtake.toFixed(2),
                                    "LMTD Offtakes": (offtake * 0.88).toFixed(2),
                                    "LYMTD Offtakes": (offtake * 0.75).toFixed(2),
                                    "Qty Sold": (offtake * 1.5).toFixed(2),
                                    DOI: (offtake * 1.5).toFixed(2),
                                };
                            } else if (reportType === "Pricing Analysis") {
                                const asp = getLogicalKpiValue('asp', context) || 1500;
                                const rpi = (0.8 + (catIdx % 5) * 0.1).toFixed(2);
                                // Varying discount logic
                                const discount = (2.5 + (Math.abs(p.length - catIdx) % 15) * 0.4).toFixed(2);

                                row = {
                                    DATE: date,
                                    Platform: p,
                                    Brand: b,
                                    Keyword_Category: cat,
                                    Product: prod,
                                    City: loc,
                                    RPI: rpi,
                                    Discount: discount,
                                    ASP: (asp / 100).toFixed(2),
                                };
                            }
                            else if (reportType === "Performance Marketing") {
                                const offtake = getLogicalKpiValue('offtake', context);
                                const spend = offtake / 2;
                                row = {
                                    DATE: date,
                                    Platform: p,
                                    Brand: b,
                                    Product: prod,
                                    Offtakes: "₹" + offtake.toFixed(2) + " Lakh",
                                    Spend: "₹" + spend.toFixed(2) + " Lakh",
                                    ROAS: (offtake / spend).toFixed(1) + "x",
                                    Impressions: Math.floor(spend * 4000),
                                    Clicks: Math.floor(spend * 120),
                                    CTR: "3.0%",
                                    CPC: "₹" + (spend * 100000 / (spend * 120)).toFixed(1),
                                };
                            } else {
                                // Default "Watch Tower" optimized for SKU level
                                const offtake = getLogicalKpiValue('offtake', context);
                                const spend = offtake / 2;
                                row = {
                                    DATE: date,
                                    Platform: p,
                                    Brand: b,
                                    City: loc,
                                    Category: cat,
                                    Product: prod,
                                    Offtakes: "₹" + offtake.toFixed(2) + " Lakh",
                                    Spend: "₹" + spend.toFixed(2) + " Lakh",
                                    ROAS: (offtake / spend).toFixed(1) + "x",
                                    Availability: getLogicalKpiValue('osa', context).toFixed(1) + "%",
                                    SOS: getLogicalKpiValue('sos', context).toFixed(1) + "%",
                                    Market_Share: (getLogicalKpiValue('market', context) / 5).toFixed(2) + "%",
                                };
                            }

                            reportData.push(row);
                        });
                    });
                });
            });
        });

        // Create Excel
        const worksheet = XLSX.utils.json_to_sheet(reportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

        // Download
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        saveAs(data, `${reportType.replace(/\s+/g, '_')}_${timePeriod.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD')}.xlsx`);

        setIsDownloading(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    const handleFilterChange = (key, value) => {
        setSelectedFilters((prev) => {
            const newFilters = { ...prev, [key]: value };

            // Reset dependent dropdowns when platform changes
            if (key === "platform") {
                const mapping = dataMapping[value] || {};
                const newBrands = mapping.brands || ["All Brands"];
                const newLocations = mapping.locations || ["All Locations"];
                const newCategories = mapping.categories || ["All Categories"];
                const newSkus = mapping.skus || ["All SKUs"];

                if (!newBrands.includes(prev.brand)) newFilters.brand = "All Brands";
                if (!newLocations.includes(prev.location)) newFilters.location = "All Locations";
                if (!newCategories.includes(prev.category)) newFilters.category = "All Categories";
                if (!newSkus.includes(prev.sku)) newFilters.sku = "All SKUs";
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
