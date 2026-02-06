// import React from 'react'

// const SkuCompetitorAnalysis = () => {
//     return (
//         <div>SkuCompetitorAnalysis</div>
//     )
// }

// export default SkuCompetitorAnalysis


import { useState, useMemo, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChevronDown,
    ChevronRight,
    X,
    Search,
    Filter,
    TrendingUp,
    TrendingDown,
    Minus,
    DollarSign,
    Percent,
    BarChart3,
    Users,
    Calendar,
    RefreshCw,
    Download,
    Columns2,
    Package,
    Activity,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import {
    getTrendIndicator,
    getDeltaIndicator,
    formatCurrency,
    formatPercent,
    calculateEcpPerUnit,
    generateDateOptions,
} from '../../lib/pricingUtils'

// ========================================
// UTILITY FUNCTIONS
// ========================================

// Font color heatmap for day-wise values (green=high, red=low)
const getDayWiseFontColor = (value, min = 30, max = 60) => {
    if (value === null || value === undefined) return 'text-slate-400'
    const normalized = (value - min) / (max - min)
    if (normalized >= 0.8) return 'text-emerald-600 font-bold'
    if (normalized >= 0.6) return 'text-emerald-500 font-semibold'
    if (normalized >= 0.4) return 'text-slate-700 font-medium'
    if (normalized >= 0.2) return 'text-amber-600 font-medium'
    return 'text-rose-600 font-semibold'
}

// Background heatmap for discount trend (green=low discount, red=high discount)
const getDiscountHeatmap = (value) => {
    if (value === null || value === undefined) return 'bg-slate-50 text-slate-400'
    if (value <= 0) return 'bg-emerald-100 text-emerald-800 font-medium'
    if (value <= 5) return 'bg-emerald-50 text-emerald-700'
    if (value <= 10) return 'bg-yellow-50 text-yellow-700'
    if (value <= 15) return 'bg-amber-100 text-amber-800'
    if (value <= 20) return 'bg-orange-100 text-orange-800 font-medium'
    return 'bg-rose-100 text-rose-800 font-bold'
}

// ========================================
// PLATFORM CONFIGURATION
// ========================================

const PLATFORMS = [
    { key: 'blinkit', label: 'Blinkit', color: '#FFCE00', bg: 'bg-yellow-400', text: 'text-black' },
    { key: 'instamart', label: 'Instamart', color: '#FC8019', bg: 'bg-orange-500', text: 'text-white' },
    { key: 'zepto', label: 'Zepto', color: '#8B5CF6', bg: 'bg-purple-600', text: 'text-white' },
]

const VIEW_TABS = [
    { key: 'discount', label: 'Discount Trend', icon: Percent },
    { key: 'ecpBrand', label: 'ECP by Brand', icon: DollarSign },
    { key: 'dayLevel', label: 'Brand-SKU Day View', icon: Calendar },
    { key: 'competitor', label: 'Competitor View', icon: Users },
]

// ========================================
// POWERBI DATA - Updated 2026-02-05
// ========================================

// KPI Summary Data
const KPI_DATA = {
    skusTracked: 167,
    avgEcp: 170,
    rpi: 1.27,
    discounts: {
        blinkit: 3,
        zepto: 7,
        instamart: 5,
    }
}

// Discount Trend Data - Category → SKU hierarchy with multi-metric support
const DISCOUNT_TREND_DATA = [
    {
        category: 'Bon Bon / Mini Bites',
        skus: [
            {
                sku: 'Noto Mini Bites Chocolate', ml: '50g',
                blinkit: { ecp: 45, discount: 15, rpi: 1.2 },
                instamart: { ecp: 48, discount: 17, rpi: 1.1 },
                zepto: { ecp: 47, discount: 18, rpi: 1.15 },
                total: { ecp: 47, discount: 18, rpi: 1.15 }
            },
            {
                sku: 'Noto Mini Bites Vanilla', ml: '50g',
                blinkit: { ecp: 42, discount: 17, rpi: 1.3 },
                instamart: { ecp: 44, discount: 19, rpi: 1.2 },
                zepto: { ecp: 43, discount: 20, rpi: 1.25 },
                total: { ecp: 43, discount: 20, rpi: 1.25 }
            },
            {
                sku: 'Brooklyn Bon Bons Strawberry', ml: '100g',
                blinkit: { ecp: 85, discount: 14, rpi: 0.9 },
                instamart: { ecp: 82, discount: 18, rpi: 0.95 },
                zepto: { ecp: 82, discount: 18, rpi: 0.95 },
                total: { ecp: 83, discount: 18, rpi: 0.93 }
            },
            {
                sku: 'Brooklyn Bon Bons Mango', ml: '100g',
                blinkit: { ecp: 84, discount: 16, rpi: 0.92 },
                instamart: { ecp: 80, discount: 20, rpi: 0.88 },
                zepto: { ecp: 80, discount: 20, rpi: 0.88 },
                total: { ecp: 81, discount: 20, rpi: 0.89 }
            },
        ],
        totals: {
            blinkit: { ecp: 64, discount: 15, rpi: 1.08 },
            instamart: { ecp: 64, discount: 19, rpi: 1.03 },
            zepto: { ecp: 63, discount: 19, rpi: 1.06 },
            total: { ecp: 64, discount: 19, rpi: 1.06 }
        }
    },
    {
        category: 'Butterscotch Cones',
        skus: [
            {
                sku: 'Amul Tricone Butterscotch', ml: '100ml',
                blinkit: { ecp: 35, discount: 0, rpi: 2.1 },
                instamart: { ecp: 35, discount: 0, rpi: 2.1 },
                zepto: { ecp: 34, discount: 3, rpi: 2.0 },
                total: { ecp: 35, discount: 3, rpi: 2.07 }
            },
            {
                sku: 'BR Butterscotch Cone', ml: '120ml',
                blinkit: null,
                instamart: { ecp: 89, discount: 15, rpi: 0.6 },
                zepto: { ecp: 95, discount: 0, rpi: 0.7 },
                total: { ecp: 92, discount: 17, rpi: 0.65 }
            },
            {
                sku: 'BR Double Butterscotch', ml: '150ml',
                blinkit: null,
                instamart: { ecp: 99, discount: 19, rpi: 0.55 },
                zepto: { ecp: 105, discount: 0, rpi: 0.6 },
                total: { ecp: 102, discount: 21, rpi: 0.57 }
            },
            {
                sku: 'Cornetto Butterscotch', ml: '110ml',
                blinkit: null,
                instamart: null,
                zepto: { ecp: 40, discount: 0, rpi: 1.8 },
                total: { ecp: 40, discount: 3, rpi: 1.8 }
            },
            {
                sku: 'Go-Zero Butterscotch', ml: '90ml',
                blinkit: { ecp: 55, discount: 11, rpi: 1.4 },
                instamart: { ecp: 46, discount: 25, rpi: 1.0 },
                zepto: { ecp: 52, discount: 16, rpi: 1.2 },
                total: { ecp: 51, discount: 23, rpi: 1.2 }
            },
        ],
        totals: {
            blinkit: null,
            instamart: { ecp: 67, discount: 8, rpi: 1.06 },
            zepto: { ecp: 65, discount: 3, rpi: 1.26 },
            total: { ecp: 64, discount: 3, rpi: 1.26 }
        }
    },
    {
        category: 'ButterScotch Cups',
        skus: [
            {
                sku: 'Amul Butterscotch Cup', ml: '100ml',
                blinkit: null,
                instamart: { ecp: 38, discount: 3, rpi: 1.9 },
                zepto: null,
                total: { ecp: 38, discount: 3, rpi: 1.9 }
            },
            {
                sku: 'Brooklyn BS Cup', ml: '125ml',
                blinkit: null,
                instamart: { ecp: 72, discount: 18, rpi: 0.85 },
                zepto: { ecp: 80, discount: 8, rpi: 1.0 },
                total: { ecp: 76, discount: 16, rpi: 0.93 }
            },
            {
                sku: 'Brooklyn BS Premium', ml: '200ml',
                blinkit: null,
                instamart: { ecp: 95, discount: 20, rpi: 0.7 },
                zepto: { ecp: 105, discount: 10, rpi: 0.8 },
                total: { ecp: 100, discount: 18, rpi: 0.75 }
            },
            {
                sku: 'Keventers Butterscotch', ml: '150ml',
                blinkit: { ecp: 65, discount: 23, rpi: 0.9 },
                instamart: null,
                zepto: null,
                total: { ecp: 65, discount: 23, rpi: 0.9 }
            },
        ],
        totals: {
            blinkit: { ecp: 65, discount: 1, rpi: 0.9 },
            instamart: { ecp: 68, discount: 13, rpi: 1.15 },
            zepto: { ecp: 93, discount: 6, rpi: 0.9 },
            total: { ecp: 70, discount: 11, rpi: 1.12 }
        }
    },
    {
        category: 'ButterScotch Tubs',
        skus: [
            {
                sku: 'Amul BS Tub', ml: '500ml',
                blinkit: { ecp: 180, discount: 2, rpi: 0.36 },
                instamart: { ecp: 175, discount: 5, rpi: 0.35 },
                zepto: { ecp: 166, discount: 10, rpi: 0.33 },
                total: { ecp: 174, discount: 7, rpi: 0.35 }
            },
            {
                sku: 'Amul BS Family Tub', ml: '1000ml',
                blinkit: { ecp: 340, discount: 2, rpi: 0.34 },
                instamart: { ecp: 325, discount: 7, rpi: 0.33 },
                zepto: { ecp: 300, discount: 14, rpi: 0.30 },
                total: { ecp: 322, discount: 9, rpi: 0.32 }
            },
            {
                sku: 'KW Butterscotch Tub', ml: '700ml',
                blinkit: { ecp: 290, discount: 4, rpi: 0.41 },
                instamart: { ecp: 272, discount: 10, rpi: 0.39 },
                zepto: { ecp: 248, discount: 18, rpi: 0.35 },
                total: { ecp: 270, discount: 12, rpi: 0.39 }
            },
        ],
        totals: {
            blinkit: { ecp: 270, discount: 3, rpi: 0.37 },
            instamart: { ecp: 257, discount: 8, rpi: 0.36 },
            zepto: { ecp: 238, discount: 15, rpi: 0.33 },
            total: { ecp: 255, discount: 10, rpi: 0.35 }
        }
    },
    {
        category: 'Cakes',
        skus: [
            {
                sku: 'BR Chocolate Cake', ml: '500g',
                blinkit: { ecp: 450, discount: 5, rpi: 0.9 },
                instamart: null,
                zepto: { ecp: 475, discount: 0, rpi: 0.95 },
                total: { ecp: 463, discount: 0, rpi: 0.93 }
            },
            {
                sku: 'BR Ice Cream Cake', ml: '1kg',
                blinkit: { ecp: 850, discount: 5, rpi: 0.85 },
                instamart: null,
                zepto: { ecp: 895, discount: 0, rpi: 0.9 },
                total: { ecp: 873, discount: 0, rpi: 0.87 }
            },
            {
                sku: 'Cream Bell Choco Cake', ml: '400g',
                blinkit: { ecp: 250, discount: 0, rpi: 0.63 },
                instamart: { ecp: 235, discount: 6, rpi: 0.59 },
                zepto: { ecp: 213, discount: 15, rpi: 0.53 },
                total: { ecp: 233, discount: 10, rpi: 0.58 }
            },
            {
                sku: 'Cream Bell Party Cake', ml: '750g',
                blinkit: { ecp: 420, discount: 0, rpi: 0.56 },
                instamart: { ecp: 386, discount: 8, rpi: 0.51 },
                zepto: { ecp: 340, discount: 19, rpi: 0.45 },
                total: { ecp: 382, discount: 14, rpi: 0.51 }
            },
        ],
        totals: {
            blinkit: null,
            instamart: null,
            zepto: null,
            total: null
        }
    },
]

// ECP by Brand Data (from PowerBI)
const ECP_BY_BRAND_DATA = [
    { brand: 'Amul', mrp: 48, ecp: 48, ecpPerUnit: 0.48, rpi: 7.16, ml: '100 ml' },
    { brand: 'Amul', mrp: 196, ecp: 188, ecpPerUnit: 0.19, rpi: 0.73, ml: '1000 ml' },
    { brand: 'Amul', mrp: 46, ecp: 45, ecpPerUnit: 0.41, rpi: 1.45, ml: '110 ml' },
    { brand: 'Amul', mrp: 230, ecp: 218, ecpPerUnit: 1.09, rpi: 0.23, ml: '200 ml' },
    { brand: 'Amul', mrp: 47, ecp: 47, ecpPerUnit: 0.94, rpi: 6.02, ml: '50 ml' },
    { brand: 'Amul', mrp: 72, ecp: 63, ecpPerUnit: 0.13, rpi: 3.37, ml: '500 ml' },
    { brand: 'Amul', mrp: 137, ecp: 136, ecpPerUnit: 1.94, rpi: 1.12, ml: '70 ml' },
    { brand: 'Amul', mrp: 68, ecp: 54, ecpPerUnit: 0.67, rpi: 4.63, ml: '80 ml' },
    { brand: 'Baskin Robbins', mrp: 93, ecp: 93, ecpPerUnit: 1.33, rpi: 1.64, ml: '70 ml' },
    { brand: 'Baskin Robbins', mrp: 435, ecp: 406, ecpPerUnit: 0.58, rpi: 0.47, ml: '700 ml' },
    { brand: 'Baskin Robbins', mrp: 305, ecp: 281, ecpPerUnit: 3.51, rpi: 0.89, ml: '80 ml' },
    { brand: 'Baskin Robbins', mrp: 296, ecp: 271, ecpPerUnit: 2.71, rpi: 1.27, ml: '100 ml' },
    { brand: 'Baskin Robbins', mrp: 84, ecp: 84, ecpPerUnit: 0.76, rpi: 0.77, ml: '110 ml' },
    { brand: 'Baskin Robbins', mrp: 930, ecp: 938, ecpPerUnit: 7.50, rpi: 0.15, ml: '125 ml' },
    { brand: 'Cream Bell', mrp: 75, ecp: 73, ecpPerUnit: 0.73, rpi: 0.81, ml: '100 ml' },
    { brand: 'Cream Bell', mrp: 45, ecp: 45, ecpPerUnit: 0.41, rpi: 1.44, ml: '110 ml' },
    { brand: 'Cream Bell', mrp: 188, ecp: 155, ecpPerUnit: 1.24, rpi: 0.91, ml: '125 ml' },
    { brand: 'Cream Bell', mrp: 45, ecp: 45, ecpPerUnit: 0.16, rpi: 13.05, ml: '188 ml' },
    { brand: 'Cream Bell', mrp: 301, ecp: 260, ecpPerUnit: 0.12, rpi: 0.81, ml: '500 ml' },
    { brand: 'Cream Bell', mrp: 35, ecp: 35, ecpPerUnit: 0.50, rpi: 4.00, ml: '70 ml' },
    { brand: 'Cream Bell', mrp: 210, ecp: 166, ecpPerUnit: 0.83, rpi: 7.16, ml: '80 ml' },
    { brand: 'Cream Bell', mrp: 35, ecp: 35, ecpPerUnit: 0.43, rpi: null, ml: '81 ml' },
    { brand: 'Kwality Walls', mrp: 222, ecp: 211, ecpPerUnit: 1.00, rpi: 1.00, ml: '500 ml' },
    { brand: 'Kwality Walls', mrp: 68, ecp: 61, ecpPerUnit: 1.03, rpi: null, ml: '59 ml' },
    { brand: 'Kwality Walls', mrp: 76, ecp: 76, ecpPerUnit: 0.76, rpi: 1.30, ml: '61 ml' },
]

// Weekday/Weekend Data (from PowerBI)
const WEEKDAY_WEEKEND_DATA = [
    { brand: 'Apsara', weekday: null, weekend: null, trend: null },
    { brand: 'Yogbar', weekday: null, weekend: null, trend: null },
    { brand: 'Amul', weekday: 134.29, weekend: null, trend: 'down' },
    { brand: 'Baskin Robbins', weekday: 212.31, weekend: null, trend: 'down' },
    { brand: 'Cream Bell', weekday: 117.59, weekend: null, trend: 'down' },
    { brand: 'Cream Pot', weekday: 187.45, weekend: null, trend: 'down' },
    { brand: 'Dairy Day', weekday: 105.84, weekend: null, trend: null },
    { brand: 'Get-A-Way', weekday: 153.31, weekend: null, trend: 'down' },
    { brand: 'Go-Zero', weekday: 177.40, weekend: null, trend: 'down' },
    { brand: 'Graineen', weekday: 130.72, weekend: null, trend: null },
]

// Own vs Compete Data (from PowerBI) - multi-metric support
const OWN_VS_COMPETE_DATA = [
    {
        platform: 'Blinkit',
        date: '05 February 2026',
        competeDesc: 'Baskin Robbins',
        ownProductName: 'Kwality Walls Cornetto Double Chocolate Frozen Dessert Cone',
        ownMl: '105 ml',
        ownEcp: 35, ownDiscount: 0, ownRpi: 1.2,
        ownMrp: 35,
        competeProductName: 'Baskin Robbins Bavarian Chocolate Ice Cream Cone',
        competeMl: '110 ml',
        competeEcp: 85, competeDiscount: 15, competeRpi: 0.6,
        competeMrp: 100,
    },
    {
        platform: 'Blinkit',
        date: '05 February 2026',
        competeDesc: 'Havmor',
        ownProductName: 'Kwality Walls Cornetto Double Chocolate Frozen Dessert Cone',
        ownMl: '105 ml',
        ownEcp: 35, ownDiscount: 0, ownRpi: 1.2,
        ownMrp: 35,
        competeProductName: 'Havmor Dark Chocolate Ice Cream Cone',
        competeMl: '110 ml',
        competeEcp: 50, competeDiscount: 10, competeRpi: 0.9,
        competeMrp: 55,
    },
    {
        platform: 'Blinkit',
        date: '05 February 2026',
        competeDesc: 'Havmor World',
        ownProductName: 'Kwality Walls Cornetto Double Chocolate Frozen Dessert Cone',
        ownMl: '105 ml',
        ownEcp: 35, ownDiscount: 0, ownRpi: 1.2,
        ownMrp: 35,
        competeProductName: 'Havmor World Double Belgian Chocolate Ice Cream Cone',
        competeMl: '150 ml',
        competeEcp: 90, competeDiscount: 18, competeRpi: 0.5,
        competeMrp: 110,
    },
    {
        platform: 'Zepto',
        date: '05 February 2026',
        competeDesc: 'Amul',
        ownProductName: 'Kwality Walls Cornetto Strawberry Vanilla',
        ownMl: '105 ml',
        ownEcp: 35, ownDiscount: 8, ownRpi: 1.1,
        ownMrp: 38,
        competeProductName: 'Amul Gold Epic Almond Ice Cream Stick',
        competeMl: '80 ml',
        competeEcp: 41, competeDiscount: 5, competeRpi: 1.5,
        competeMrp: 43,
    },
    {
        platform: 'Instamart',
        date: '05 February 2026',
        competeDesc: 'Amul',
        ownProductName: 'Kwality Walls Choco Brownie Fudge Frozen Dessert Cup',
        ownMl: '100 ml',
        ownEcp: 45, ownDiscount: 12, ownRpi: 0.85,
        ownMrp: 51,
        competeProductName: 'Amul Jumbo Chocolate Brownie Ice Cream Cup',
        competeMl: '125 ml',
        competeEcp: 26, competeDiscount: 42, competeRpi: 2.1,
        competeMrp: 45,
    },
]

// Brand-SKU Day Level Data with multiple metrics
const BRAND_SKU_DAY_DATA = [
    {
        brand: 'Amul',
        skus: [
            {
                name: 'Amul Gold Frostik Ice Cream Stick',
                ml: '70 ml',
                days: {
                    '2026-02-05': { ecp: 45, discount: 5, rpi: 1.2 },
                    '2026-02-04': { ecp: 45, discount: 5, rpi: 1.2 },
                    '2026-02-03': { ecp: 36, discount: 12, rpi: 0.9 },
                    '2026-02-02': { ecp: 45, discount: 5, rpi: 1.2 },
                    '2026-02-01': { ecp: 40, discount: 8, rpi: 1.0 },
                    '2026-01-31': { ecp: 42, discount: 6, rpi: 1.1 },
                    '2026-01-30': { ecp: 44, discount: 5, rpi: 1.2 }
                }
            },
            {
                name: 'Amul Gold Fruit N Nut Fantasy Ice Cream Cup',
                ml: '125 ml',
                days: {
                    '2026-02-05': { ecp: 50, discount: 10, rpi: 0.8 },
                    '2026-02-04': { ecp: 50, discount: 10, rpi: 0.8 },
                    '2026-02-03': { ecp: 50, discount: 10, rpi: 0.8 },
                    '2026-02-02': { ecp: 50, discount: 10, rpi: 0.8 },
                    '2026-02-01': { ecp: 50, discount: 10, rpi: 0.8 },
                    '2026-01-31': { ecp: 48, discount: 12, rpi: 0.7 },
                    '2026-01-30': { ecp: 52, discount: 8, rpi: 0.9 }
                }
            },
        ]
    },
    {
        brand: 'Kwality Walls',
        skus: [
            {
                name: 'Kwality Walls Choco Brownie Fudge Cup',
                ml: '100 ml',
                days: {
                    '2026-02-05': { ecp: 50, discount: 15, rpi: 1.5 },
                    '2026-02-04': { ecp: 50, discount: 15, rpi: 1.5 },
                    '2026-02-03': { ecp: 50, discount: 15, rpi: 1.5 },
                    '2026-02-02': { ecp: 50, discount: 15, rpi: 1.5 },
                    '2026-02-01': { ecp: 50, discount: 15, rpi: 1.5 },
                    '2026-01-31': { ecp: 48, discount: 17, rpi: 1.4 },
                    '2026-01-30': { ecp: 52, discount: 12, rpi: 1.6 }
                }
            },
            {
                name: 'Kwality Walls Cornetto Butterscotch',
                ml: '105 ml',
                days: {
                    '2026-02-05': { ecp: 35, discount: 0, rpi: 2.1 },
                    '2026-02-04': { ecp: 40, discount: 3, rpi: 1.8 },
                    '2026-02-03': { ecp: 35, discount: 0, rpi: 2.1 },
                    '2026-02-02': { ecp: 40, discount: 3, rpi: 1.8 },
                    '2026-02-01': { ecp: 35, discount: 0, rpi: 2.1 },
                    '2026-01-31': { ecp: 38, discount: 2, rpi: 1.9 },
                    '2026-01-30': { ecp: 35, discount: 0, rpi: 2.1 }
                }
            },
        ]
    },
    {
        brand: 'Baskin Robbins',
        skus: [
            {
                name: 'BR Chocolate Fudge Brownie 100ml',
                ml: '100 ml',
                days: {
                    '2026-02-05': { ecp: 89, discount: 5, rpi: 0.6 },
                    '2026-02-04': { ecp: 89, discount: 5, rpi: 0.6 },
                    '2026-02-03': { ecp: 85, discount: 8, rpi: 0.5 },
                    '2026-02-02': { ecp: 89, discount: 5, rpi: 0.6 },
                    '2026-02-01': { ecp: 89, discount: 5, rpi: 0.6 },
                    '2026-01-31': { ecp: 92, discount: 3, rpi: 0.7 },
                    '2026-01-30': { ecp: 89, discount: 5, rpi: 0.6 }
                }
            },
        ]
    },
]

// ========================================
// PREMIUM KPI CARD COMPONENT
// ========================================

function PremiumKpiCard({ icon: Icon, label, value, delta, trend, iconColor, badge }) {
    const trendData = getTrendIndicator(trend)
    const deltaData = getDeltaIndicator(delta, true)

    return (
        <motion.div
            className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/80 p-4 hover:shadow-lg hover:border-slate-300 transition-all duration-300"
            whileHover={{ scale: 1.02, y: -2 }}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: `${iconColor}20` }}
                    >
                        <Icon size={20} style={{ color: iconColor }} />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{label}</div>
                        <div className="text-xl font-bold text-slate-900 mt-0.5">{value}</div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    {delta !== undefined && (
                        <span className={cn('text-xs font-semibold flex items-center gap-0.5', deltaData.className)}>
                            {deltaData.symbol} {Math.abs(delta)}%
                        </span>
                    )}
                    {badge && (
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', badge.bg, badge.text)}>
                            {badge.label}
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

function PlatformDiscountCard({ platform, discount }) {
    return (
        <motion.div
            className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/80 p-4 hover:shadow-lg transition-all duration-300"
            whileHover={{ scale: 1.02 }}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', platform.bg)}>
                        <Percent size={14} className={platform.text} />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">Avg Discount</div>
                        <div className="text-sm font-bold" style={{ color: platform.color }}>{platform.label}</div>
                    </div>
                </div>
                <div className="text-2xl font-black text-slate-900">{discount}%</div>
            </div>
        </motion.div>
    )
}

// ========================================
// VIEW TABS COMPONENT
// ========================================

function ViewTabs({ activeTab, onChange }) {
    return (
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {VIEW_TABS.map(tab => {
                const Icon = tab.icon
                const isActive = activeTab === tab.key
                return (
                    <button
                        key={tab.key}
                        onClick={() => onChange(tab.key)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                            isActive
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        )}
                    >
                        <Icon size={16} />
                        {tab.label}
                    </button>
                )
            })}
        </div>
    )
}

function TableSearch({ value, onChange, placeholder }) {
    return (
        <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-64 pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
            />
        </div>
    )
}

// ========================================
// DISCOUNT TREND TABLE (Category → SKU with ML)
// ========================================

function DiscountTrendTable({ data, searchQuery }) {
    const [expandedRows, setExpandedRows] = useState([])
    const [metricType, setMetricType] = useState('discount') // 'ecp', 'discount', 'rpi'

    const METRIC_OPTIONS = [
        { key: 'ecp', label: 'ECP', suffix: '₹' },
        { key: 'discount', label: 'Discount', suffix: '%' },
        { key: 'rpi', label: 'RPI', suffix: '' },
    ]

    const toggleRow = (category) => {
        setExpandedRows(prev =>
            prev.includes(category)
                ? prev.filter(r => r !== category)
                : [...prev, category]
        )
    }

    const closeAll = () => setExpandedRows([])

    const filteredData = useMemo(() => {
        if (!searchQuery) return data
        const q = searchQuery.toLowerCase()
        return data.filter(item =>
            item.category.toLowerCase().includes(q) ||
            item.skus.some(s => s.sku.toLowerCase().includes(q))
        )
    }, [data, searchQuery])

    const getMetricValue = (platformData) => {
        if (!platformData) return null
        return platformData[metricType]
    }

    const formatValue = (val) => {
        if (val === null || val === undefined) return null
        if (metricType === 'rpi') return val.toFixed(2)
        if (metricType === 'discount') return `${val}%`
        return `₹${val}`
    }

    // Get font color based on metric type and value
    const getMetricFontColor = (val) => {
        if (val === null || val === undefined) return 'text-slate-400'

        if (metricType === 'discount') {
            // Discount: lower is better (green), higher is worse (red)
            if (val <= 5) return 'text-emerald-600 font-semibold'
            if (val <= 10) return 'text-emerald-500'
            if (val <= 15) return 'text-amber-500'
            if (val <= 20) return 'text-orange-500'
            return 'text-rose-500 font-semibold'
        }

        if (metricType === 'rpi') {
            // RPI: higher is better (green = competitive), lower is worse (red = expensive)
            if (val >= 1.5) return 'text-emerald-600 font-semibold'
            if (val >= 1.2) return 'text-emerald-500'
            if (val >= 0.9) return 'text-slate-600'
            if (val >= 0.6) return 'text-orange-500'
            return 'text-rose-500 font-semibold'
        }

        // ECP: just use neutral colors with some variance
        if (val <= 50) return 'text-slate-700 font-medium'
        if (val <= 100) return 'text-slate-600'
        if (val <= 200) return 'text-slate-500'
        return 'text-slate-500'
    }

    const MetricCell = ({ platformData }) => {
        const val = getMetricValue(platformData)
        if (val === null || val === undefined) {
            return <td className="px-3 py-2 text-center text-slate-300 text-sm">—</td>
        }

        return (
            <td className="px-3 py-2 text-center">
                <span className={cn('text-sm tabular-nums', getMetricFontColor(val))}>
                    {formatValue(val)}
                </span>
            </td>
        )
    }

    const activeMetric = METRIC_OPTIONS.find(m => m.key === metricType)

    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.03)] ring-1 ring-slate-200/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">{activeMetric.label} by Category / SKU</span>
                    <span className="px-2 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded">
                        {filteredData.length} categories
                    </span>
                    {/* Metric Selector */}
                    <div className="flex items-center gap-1 p-0.5 bg-blue-50 rounded-lg border border-blue-200">
                        {METRIC_OPTIONS.map(metric => (
                            <button
                                key={metric.key}
                                onClick={() => setMetricType(metric.key)}
                                className={cn(
                                    'px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all',
                                    metricType === metric.key
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-blue-600 hover:bg-blue-100'
                                )}
                            >
                                {metric.label}
                            </button>
                        ))}
                    </div>

                </div>
                {expandedRows.length > 0 && (
                    <button
                        onClick={closeAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                    >
                        <X size={12} /> Close All ({expandedRows.length})
                    </button>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-900">
                            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider w-72">
                                Category / SKU
                            </th>
                            <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider w-20">
                                ML
                            </th>
                            {PLATFORMS.map(p => (
                                <th key={p.key} className="text-center px-3 py-3">
                                    <span className={cn('px-2 py-1 rounded text-[10px] font-bold', p.bg, p.text)}>
                                        {p.label}
                                    </span>
                                </th>
                            ))}
                            <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider">
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((item, idx) => {
                            const isExpanded = expandedRows.includes(item.category)

                            return (
                                <>
                                    {/* Category Row */}
                                    <tr
                                        key={item.category}
                                        className={cn(
                                            'border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50',
                                            isExpanded && 'bg-blue-50/30'
                                        )}
                                        onClick={() => toggleRow(item.category)}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <motion.span
                                                    animate={{ rotate: isExpanded ? 90 : 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <ChevronRight size={16} className="text-slate-400" />
                                                </motion.span>
                                                <span className="text-sm font-medium text-slate-800">{item.category}</span>
                                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {item.skus.length} SKUs
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-center text-sm text-slate-400">—</td>
                                        <MetricCell platformData={item.totals?.blinkit} />
                                        <MetricCell platformData={item.totals?.instamart} />
                                        <MetricCell platformData={item.totals?.zepto} />
                                        <MetricCell platformData={item.totals?.total} />
                                    </tr>

                                    {/* Expanded SKU Rows */}
                                    <AnimatePresence>
                                        {isExpanded && item.skus.map((sku, sIdx) => (
                                            <motion.tr
                                                key={`${item.category}-${sku.sku}`}
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-slate-50/50 border-b border-slate-50"
                                            >
                                                <td className="px-4 py-2 pl-10">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400">└</span>
                                                        <span className="text-sm text-slate-700">{sku.sku}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className="text-xs text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {sku.ml}
                                                    </span>
                                                </td>
                                                <MetricCell platformData={sku.blinkit} />
                                                <MetricCell platformData={sku.instamart} />
                                                <MetricCell platformData={sku.zepto} />
                                                <MetricCell platformData={sku.total} />
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Values represent {metricType === 'discount' ? 'discount %' : metricType === 'ecp' ? 'effective consumer price' : 'relative price index'} across SKUs</span>
                    <span>{filteredData.length} categories</span>
                </div>
            </div>
        </div>
    )
}

// ========================================
// ECP BY BRAND TABLE
// ========================================

function EcpByBrandTable({ data, searchQuery }) {
    const filteredData = useMemo(() => {
        if (!searchQuery) return data
        const q = searchQuery.toLowerCase()
        return data.filter(item => item.brand.toLowerCase().includes(q))
    }, [data, searchQuery])

    // Get totals
    const totals = useMemo(() => ({
        mrp: Math.round(filteredData.reduce((a, b) => a + b.mrp, 0) / filteredData.length),
        ecp: Math.round(filteredData.reduce((a, b) => a + b.ecp, 0) / filteredData.length),
        ecpPerUnit: (filteredData.reduce((a, b) => a + b.ecpPerUnit, 0) / filteredData.length).toFixed(2),
        rpi: (filteredData.filter(d => d.rpi).reduce((a, b) => a + (b.rpi || 0), 0) / filteredData.filter(d => d.rpi).length).toFixed(2),
    }), [filteredData])

    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.03)] ring-1 ring-slate-200/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">ECP by Brand</span>
                    <span className="px-2 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded">
                        {filteredData.length} SKUs
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-900">
                            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider">Brand</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider">MRP</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider">ECP</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider">ECP Per Unit</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider">RPI</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider">ML</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((item, idx) => (
                            <motion.tr
                                key={idx}
                                className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.02 }}
                            >
                                <td className="px-4 py-3 text-sm font-medium text-slate-800">{item.brand}</td>
                                <td className="px-4 py-3 text-sm text-slate-600 text-right tabular-nums">{item.mrp}</td>
                                <td className="px-4 py-3 text-sm text-slate-600 text-right tabular-nums">{item.ecp}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-sm font-medium text-slate-700 tabular-nums">
                                        {item.ecpPerUnit.toFixed(2)}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600 text-right tabular-nums">
                                    {item.rpi ? item.rpi.toFixed(2) : '—'}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600 text-right">{item.ml}</td>
                            </motion.tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-100 font-semibold">
                            <td className="px-4 py-3 text-sm text-slate-700">Total</td>
                            <td className="px-4 py-3 text-sm text-slate-700 text-right tabular-nums">{totals.mrp}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 text-right tabular-nums">{totals.ecp}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 text-center tabular-nums">{totals.ecpPerUnit}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 text-right tabular-nums">{totals.rpi}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 text-right">—</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    )
}

// ========================================
// BRAND-SKU DAY LEVEL TABLE
// ========================================

function BrandSkuDayTable({ data, searchQuery }) {
    const [expandedBrands, setExpandedBrands] = useState([])
    const [dayRange, setDayRange] = useState(7)
    const [metricType, setMetricType] = useState('ecp') // 'ecp', 'discount', 'rpi'
    const dates = generateDateOptions(dayRange)

    const METRIC_OPTIONS = [
        { key: 'ecp', label: 'ECP', suffix: '₹' },
        { key: 'discount', label: 'Discount', suffix: '%' },
        { key: 'rpi', label: 'RPI', suffix: '' },
    ]

    const toggleBrand = (brand) => {
        setExpandedBrands(prev =>
            prev.includes(brand)
                ? prev.filter(b => b !== brand)
                : [...prev, brand]
        )
    }

    const closeAll = () => setExpandedBrands([])

    const filteredData = useMemo(() => {
        if (!searchQuery) return data
        const q = searchQuery.toLowerCase()
        return data.filter(item =>
            item.brand.toLowerCase().includes(q) ||
            item.skus.some(s => s.name.toLowerCase().includes(q))
        )
    }, [data, searchQuery])

    const getMetricValue = (dayData) => {
        if (!dayData) return null
        return dayData[metricType]
    }

    const formatValue = (val) => {
        if (val === null || val === undefined) return '—'
        const metric = METRIC_OPTIONS.find(m => m.key === metricType)
        if (metricType === 'rpi') return val.toFixed(2)
        if (metricType === 'discount') return `${val}%`
        return val
    }

    const activeMetric = METRIC_OPTIONS.find(m => m.key === metricType)

    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.03)] ring-1 ring-slate-200/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">Brand → SKU Day-Level {activeMetric.label}</span>
                    {/* Day Range Selector */}
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                        {[7, 14, 30].map(days => (
                            <button
                                key={days}
                                onClick={() => setDayRange(days)}
                                className={cn(
                                    'px-2 py-1 text-[10px] font-medium rounded-md transition-all',
                                    dayRange === days
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                {days}D
                            </button>
                        ))}
                    </div>
                    {/* Metric Selector Dropdown */}
                    <div className="flex items-center gap-1 p-0.5 bg-blue-50 rounded-lg border border-blue-200">
                        {METRIC_OPTIONS.map(metric => (
                            <button
                                key={metric.key}
                                onClick={() => setMetricType(metric.key)}
                                className={cn(
                                    'px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all',
                                    metricType === metric.key
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-blue-600 hover:bg-blue-100'
                                )}
                            >
                                {metric.label}
                            </button>
                        ))}
                    </div>
                </div>
                {expandedBrands.length > 0 && (
                    <button
                        onClick={closeAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                    >
                        <X size={12} /> Close All ({expandedBrands.length})
                    </button>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-900">
                            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider w-80">
                                Brand / SKU
                            </th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                                ML
                            </th>
                            {dates.map(d => (
                                <th key={d.key} className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider">
                                    {d.shortLabel}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map((brand, bIdx) => {
                            const isExpanded = expandedBrands.includes(brand.brand)

                            return (
                                <>
                                    {/* Brand Row */}
                                    <tr
                                        key={brand.brand}
                                        className={cn(
                                            'border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50',
                                            isExpanded && 'bg-blue-50/30'
                                        )}
                                        onClick={() => toggleBrand(brand.brand)}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <motion.span
                                                    animate={{ rotate: isExpanded ? 90 : 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <ChevronRight size={16} className="text-slate-400" />
                                                </motion.span>
                                                <span className="text-sm font-semibold text-slate-800">{brand.brand}</span>
                                                <span className="text-xs text-slate-400">({brand.skus.length} SKUs)</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-400 text-center">—</td>
                                        {dates.map(d => (
                                            <td key={d.key} className="px-3 py-3 text-sm text-slate-400 text-center">—</td>
                                        ))}
                                    </tr>

                                    {/* SKU Rows */}
                                    <AnimatePresence>
                                        {isExpanded && brand.skus.map((sku, sIdx) => (
                                            <motion.tr
                                                key={`${brand.brand}-${sku.name}`}
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-slate-50/50 border-b border-slate-50"
                                            >
                                                <td className="px-4 py-2 pl-10">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400">└</span>
                                                        <span className="text-sm text-slate-700 truncate max-w-[280px]" title={sku.name}>
                                                            {sku.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-sm text-slate-600 text-center">{sku.ml}</td>
                                                {dates.map(d => {
                                                    const dayData = sku.days[d.key]
                                                    const val = getMetricValue(dayData)
                                                    return (
                                                        <td key={d.key} className="px-3 py-2 text-sm text-center">
                                                            <span className={cn('tabular-nums font-medium', getDayWiseFontColor(val))}>
                                                                {formatValue(val)}
                                                            </span>
                                                        </td>
                                                    )
                                                })}
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ========================================
// COMPETITOR VIEW TABLE
// ========================================

function CompetitorViewTable({ data, searchQuery }) {
    const [viewMode, setViewMode] = useState('detail')
    const [dayFilter, setDayFilter] = useState('all') // 'all', 'weekday', 'weekend'
    const [expandedBrands, setExpandedBrands] = useState(new Set())

    const VIEW_OPTIONS = [
        { key: 'detail', label: 'Detail Table', icon: '📋' },
        { key: 'sku', label: 'Own SKU Drill', icon: '🎯' },
        { key: 'pack', label: 'Pack Size', icon: '📦' },
        { key: 'duel', label: 'Duel Cards', icon: '⚔️' },
        { key: 'delta', label: 'Delta Focus', icon: '📊' },
        { key: 'heatmap', label: 'Heat Map', icon: '🔥' },
    ]

    const DAY_OPTIONS = [
        { key: 'all', label: 'All Days' },
        { key: 'weekday', label: 'Weekday' },
        { key: 'weekend', label: 'Weekend' },
    ]

    // Determine if a date is weekend (Sat/Sun)
    const isWeekend = (dateStr) => {
        const date = new Date(dateStr)
        const day = date.getDay()
        return day === 0 || day === 6
    }

    // Process raw data into structured comparisons
    const processedData = useMemo(() => {
        return data.map(item => ({
            platform: item.platform,
            date: item.date,
            dateFormatted: new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            isWeekend: isWeekend(item.date),
            competeDesc: item.competeDesc,
            brand: item.competeDesc, // Brand for drill-down
            ownProductName: item.ownProductName,
            ownMl: item.ownMl,
            ownEcp: item.ownEcp,
            ownMrp: item.ownMrp,
            competeProductName: item.competeProductName,
            competeMl: item.competeMl,
            competeEcp: item.competeEcp,
            competeMrp: item.competeMrp,
            ecpDelta: item.competeEcp - item.ownEcp,
            mrpDelta: item.competeMrp - item.ownMrp,
        }))
    }, [data])

    // Apply day filter
    const dayFilteredData = useMemo(() => {
        if (dayFilter === 'all') return processedData
        if (dayFilter === 'weekend') return processedData.filter(r => r.isWeekend)
        return processedData.filter(r => !r.isWeekend)
    }, [processedData, dayFilter])

    // Apply search filter
    const filteredData = useMemo(() => {
        if (!searchQuery) return dayFilteredData
        const q = searchQuery.toLowerCase()
        return dayFilteredData.filter(row =>
            row.ownProductName.toLowerCase().includes(q) ||
            row.competeProductName.toLowerCase().includes(q) ||
            row.platform.toLowerCase().includes(q) ||
            row.brand.toLowerCase().includes(q)
        )
    }, [dayFilteredData, searchQuery])

    // Group by OWN SKU (Kwality Walls products) - client-centric view
    const ownSkuGroupedData = useMemo(() => {
        const groups = {}
        filteredData.forEach(row => {
            const key = `${row.ownProductName}|${row.ownMl}`
            if (!groups[key]) {
                groups[key] = {
                    ownProduct: row.ownProductName,
                    ownMl: row.ownMl,
                    ownEcp: row.ownEcp,
                    ownMrp: row.ownMrp,
                    competitors: [],
                    platforms: new Set(),
                    totalWins: 0,
                    totalLosses: 0
                }
            }
            groups[key].competitors.push(row)
            groups[key].platforms.add(row.platform)
            if (row.ecpDelta > 0) groups[key].totalWins++
            else if (row.ecpDelta < 0) groups[key].totalLosses++
        })
        Object.values(groups).forEach(g => {
            g.platforms = Array.from(g.platforms)
            g.avgDelta = Math.round(g.competitors.reduce((a, c) => a + c.ecpDelta, 0) / g.competitors.length)
        })
        return Object.values(groups).sort((a, b) => a.ownProduct.localeCompare(b.ownProduct))
    }, [filteredData])

    // Group by PACK SIZE (ML) - compare same pack across brands
    const packSizeGroupedData = useMemo(() => {
        const groups = {}
        filteredData.forEach(row => {
            const ml = row.ownMl
            if (!groups[ml]) {
                groups[ml] = {
                    ml,
                    comparisons: [],
                    avgOwnEcp: 0,
                    avgCompeteEcp: 0,
                    wins: 0,
                    losses: 0
                }
            }
            groups[ml].comparisons.push(row)
            if (row.ecpDelta > 0) groups[ml].wins++
            else if (row.ecpDelta < 0) groups[ml].losses++
        })
        Object.values(groups).forEach(g => {
            g.avgOwnEcp = Math.round(g.comparisons.reduce((a, c) => a + c.ownEcp, 0) / g.comparisons.length)
            g.avgCompeteEcp = Math.round(g.comparisons.reduce((a, c) => a + c.competeEcp, 0) / g.comparisons.length)
        })
        return Object.values(groups).sort((a, b) => parseInt(a.ml) - parseInt(b.ml))
    }, [filteredData])

    const toggleBrand = (brand) => {
        setExpandedBrands(prev => {
            const next = new Set(prev)
            if (next.has(brand)) next.delete(brand)
            else next.add(brand)
            return next
        })
    }

    const getPlatformStyle = (platform) => {
        const p = PLATFORMS.find(pl => pl.label === platform)
        return p ? { bg: p.bg, color: p.color } : { bg: 'bg-slate-500', color: '#64748b' }
    }

    const getDeltaColor = (delta) => {
        if (delta > 0) return 'text-emerald-600 bg-emerald-50'
        if (delta < 0) return 'text-rose-600 bg-rose-50'
        return 'text-slate-600 bg-slate-50'
    }

    // =====================================
    // VIEW 1: DETAIL TABLE with Date
    // =====================================
    const DetailTableView = () => (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-[#2B579A] text-white text-left">
                        <th className="px-3 py-2 font-medium text-[11px]">Platform</th>
                        <th className="px-3 py-2 font-medium text-[11px]">Date</th>
                        <th className="px-3 py-2 font-medium text-[11px]">Compete Desc.</th>
                        <th className="px-3 py-2 font-medium text-[11px]">Own Product Name</th>
                        <th className="px-3 py-2 font-medium text-[11px] text-right">Own ML</th>
                        <th className="px-3 py-2 font-medium text-[11px]">Compete Product Name</th>
                        <th className="px-3 py-2 font-medium text-[11px] text-right">Compete ML</th>
                        <th className="px-3 py-2 font-medium text-[11px] text-right">Own ECP</th>
                        <th className="px-3 py-2 font-medium text-[11px] text-right">Compete ECP</th>
                        <th className="px-3 py-2 font-medium text-[11px] text-right">Own MRP</th>
                        <th className="px-3 py-2 font-medium text-[11px] text-right">Compete MRP</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredData.slice(0, 20).map((row, idx) => (
                        <motion.tr
                            key={idx}
                            className={cn('border-b hover:bg-blue-50/50 transition-colors', idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.015 }}
                        >
                            <td className="px-3 py-2">
                                <span className={cn('px-2 py-0.5 text-[10px] rounded', getPlatformStyle(row.platform).bg, 'text-white')}>
                                    {row.platform}
                                </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600 text-xs tabular-nums">
                                <div className="flex items-center gap-1">
                                    {row.dateFormatted}
                                    {row.isWeekend && <span className="px-1 py-0.5 text-[8px] bg-amber-100 text-amber-700 rounded">WE</span>}
                                </div>
                            </td>
                            <td className="px-3 py-2 text-slate-600 text-xs">{row.competeDesc}</td>
                            <td className="px-3 py-2 text-slate-800 max-w-[180px] truncate">{row.ownProductName}</td>
                            <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{row.ownMl}</td>
                            <td className="px-3 py-2 text-slate-800 max-w-[180px] truncate">{row.competeProductName}</td>
                            <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{row.competeMl}</td>
                            <td className="px-3 py-2 text-right text-blue-600 tabular-nums font-medium">{row.ownEcp}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: row.competeEcp > row.ownEcp ? '#059669' : '#dc2626' }}>{row.competeEcp}</td>
                            <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{row.ownMrp}</td>
                            <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{row.competeMrp}</td>
                        </motion.tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

    // =====================================
    // VIEW 2: OWN SKU DRILL (Client-Centric)
    // Shows how each Kwality Walls product performs vs competitors
    // =====================================
    const OwnSkuDrillView = () => (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-[#2B579A] text-white text-left">
                        <th className="px-3 py-2 font-medium text-[11px] w-8"></th>
                        <th className="px-3 py-2 font-medium text-[11px]">Our Product</th>
                        <th className="px-3 py-2 font-medium text-[11px] text-center">ML</th>
                        <th className="px-3 py-2 font-medium text-[11px]">Platforms</th>
                        <th className="px-3 py-2 font-medium text-[11px] text-right">Our ECP</th>
                        <th className="px-3 py-2 font-medium text-[11px] text-center">Wins</th>
                        <th className="px-3 py-2 font-medium text-[11px] text-center">Losses</th>
                        <th className="px-3 py-2 font-medium text-[11px] text-center">Avg Δ</th>
                    </tr>
                </thead>
                <tbody>
                    {ownSkuGroupedData.map((sku, idx) => {
                        const skuKey = `${sku.ownProduct}|${sku.ownMl}`
                        return (
                            <Fragment key={skuKey}>
                                {/* Own SKU Row */}
                                <motion.tr
                                    className={cn('border-b cursor-pointer hover:bg-blue-50/50 transition-colors', expandedBrands.has(skuKey) ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}
                                    onClick={() => toggleBrand(skuKey)}
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                >
                                    <td className="px-3 py-2.5 text-center">
                                        <motion.span animate={{ rotate: expandedBrands.has(skuKey) ? 90 : 0 }} className="inline-block text-slate-400">
                                            <ChevronRight className="w-4 h-4" />
                                        </motion.span>
                                    </td>
                                    <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[220px] truncate">{sku.ownProduct}</td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded font-medium">{sku.ownMl}</span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex gap-1 flex-wrap">
                                            {sku.platforms.map(p => (
                                                <span key={p} className={cn('px-1.5 py-0.5 text-[9px] rounded', getPlatformStyle(p).bg, 'text-white')}>{p}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-blue-600 font-medium tabular-nums">₹{sku.ownEcp}</td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className="px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 rounded font-medium">{sku.totalWins}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className="px-2 py-0.5 text-[10px] bg-rose-100 text-rose-700 rounded font-medium">{sku.totalLosses}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium tabular-nums', getDeltaColor(sku.avgDelta))}>
                                            {sku.avgDelta > 0 ? '+' : ''}{sku.avgDelta}
                                        </span>
                                    </td>
                                </motion.tr>
                                {/* Expanded Competitor Rows */}
                                <AnimatePresence>
                                    {expandedBrands.has(skuKey) && sku.competitors.map((comp, compIdx) => (
                                        <motion.tr
                                            key={`${skuKey}-${compIdx}`}
                                            className="bg-slate-50/80 border-b border-slate-100"
                                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                        >
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2 pl-8 text-slate-600 text-xs" colSpan={2}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={cn('px-1.5 py-0.5 text-[9px] rounded', getPlatformStyle(comp.platform).bg, 'text-white')}>{comp.platform}</span>
                                                    <span className="text-slate-400">{comp.dateFormatted}</span>
                                                    {comp.isWeekend && <span className="px-1 py-0.5 text-[8px] bg-amber-100 text-amber-700 rounded">WE</span>}
                                                </div>
                                                <div className="text-slate-700 truncate max-w-[280px]">
                                                    <span className="text-slate-400">vs</span> {comp.competeProductName}
                                                    <span className="text-slate-400 ml-1">({comp.brand})</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center text-xs text-slate-500">{comp.competeMl}</td>
                                            <td className="px-3 py-2 text-right tabular-nums" style={{ color: comp.ecpDelta > 0 ? '#059669' : '#dc2626' }}>₹{comp.competeEcp}</td>
                                            <td className="px-3 py-2 text-center" colSpan={2}>
                                                {comp.ecpDelta > 0 ? <span className="text-emerald-600 text-xs font-medium">✓ WIN</span> : <span className="text-rose-600 text-xs font-medium">✗ LOSE</span>}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums', getDeltaColor(comp.ecpDelta))}>
                                                    {comp.ecpDelta > 0 ? '+' : ''}{comp.ecpDelta}
                                                </span>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </Fragment>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )

    // =====================================
    // VIEW 3: PACK SIZE DRILL
    // Compare same pack size across all competitors
    // =====================================
    const PackSizeDrillView = () => (
        <div className="p-4 space-y-4">
            {packSizeGroupedData.map((pack, idx) => (
                <motion.div key={pack.ml} className="border border-slate-200 rounded-xl overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }}>
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="bg-white/20 px-3 py-1 rounded-lg text-white font-bold text-lg">{pack.ml}</span>
                            <span className="text-white/80 text-sm">Pack Size</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-white">
                            <div className="flex items-center gap-1">
                                <span className="text-white/60">Comparisons:</span>
                                <span className="font-medium">{pack.comparisons.length}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="px-2 py-0.5 bg-emerald-500/30 rounded text-emerald-200">{pack.wins} Wins</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="px-2 py-0.5 bg-rose-500/30 rounded text-rose-200">{pack.losses} Losses</span>
                            </div>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {pack.comparisons.slice(0, 6).map((row, rowIdx) => (
                            <div key={rowIdx} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={cn('px-1.5 py-0.5 text-[9px] rounded', getPlatformStyle(row.platform).bg, 'text-white')}>{row.platform}</span>
                                        <span className="text-[10px] text-slate-400">{row.dateFormatted}</span>
                                        {row.isWeekend && <span className="px-1 py-0.5 text-[8px] bg-amber-100 text-amber-700 rounded">WE</span>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-[10px] text-blue-600 font-medium">OUR</div>
                                            <div className="text-sm text-slate-800 truncate">{row.ownProductName}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-purple-600 font-medium">COMPETITOR ({row.brand})</div>
                                            <div className="text-sm text-slate-800 truncate">{row.competeProductName}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 ml-4">
                                    <div className="text-right">
                                        <div className="text-[10px] text-slate-400">Our ECP</div>
                                        <div className="font-medium text-blue-600 tabular-nums">₹{row.ownEcp}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-slate-400">Their ECP</div>
                                        <div className={cn('font-medium tabular-nums', row.ecpDelta > 0 ? 'text-emerald-600' : 'text-rose-600')}>₹{row.competeEcp}</div>
                                    </div>
                                    <span className={cn('px-2 py-1 rounded text-xs font-medium min-w-[60px] text-center', getDeltaColor(row.ecpDelta))}>
                                        {row.ecpDelta > 0 ? '+' : ''}₹{row.ecpDelta}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {pack.comparisons.length > 6 && (
                        <div className="px-4 py-2 text-center text-xs text-slate-400 bg-slate-50">
                            +{pack.comparisons.length - 6} more comparisons
                        </div>
                    )}
                </motion.div>
            ))}
        </div>
    )

    // =====================================
    // VIEW 3: DUEL CARDS
    // =====================================
    const DuelCardsView = () => (
        <div className="p-4 grid gap-3">
            {filteredData.slice(0, 8).map((row, idx) => (
                <motion.div
                    key={idx}
                    className="bg-gradient-to-r from-blue-50 via-white to-purple-50 rounded-xl border border-slate-200 p-4 shadow-sm"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className={cn('px-2 py-0.5 text-[10px] rounded', getPlatformStyle(row.platform).bg, 'text-white')}>{row.platform}</span>
                            <span className="text-[10px] text-slate-500">{row.dateFormatted}</span>
                            {row.isWeekend && <span className="px-1 py-0.5 text-[8px] bg-amber-100 text-amber-700 rounded">Weekend</span>}
                        </div>
                        <span className="text-[10px] text-slate-400">{row.competeDesc}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-200">
                            <div className="text-[10px] text-blue-600 font-medium mb-1">YOUR PRODUCT</div>
                            <div className="text-sm text-slate-800 font-medium truncate mb-2">{row.ownProductName}</div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div><div className="text-[10px] text-slate-400">ML</div><div className="text-sm font-medium">{row.ownMl}</div></div>
                                <div><div className="text-[10px] text-slate-400">ECP</div><div className="text-sm font-medium text-blue-600">₹{row.ownEcp}</div></div>
                                <div><div className="text-[10px] text-slate-400">MRP</div><div className="text-sm font-medium">₹{row.ownMrp}</div></div>
                            </div>
                        </div>
                        <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-200">
                            <div className="text-[10px] text-purple-600 font-medium mb-1">COMPETITOR</div>
                            <div className="text-sm text-slate-800 font-medium truncate mb-2">{row.competeProductName}</div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div><div className="text-[10px] text-slate-400">ML</div><div className="text-sm font-medium">{row.competeMl}</div></div>
                                <div><div className="text-[10px] text-slate-400">ECP</div><div className={cn('text-sm font-medium', row.ecpDelta > 0 ? 'text-emerald-600' : 'text-rose-600')}>₹{row.competeEcp}</div></div>
                                <div><div className="text-[10px] text-slate-400">MRP</div><div className="text-sm font-medium">₹{row.competeMrp}</div></div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2">
                        <span className={cn('px-3 py-1 rounded-full text-xs font-medium', getDeltaColor(row.ecpDelta))}>
                            ECP Δ: {row.ecpDelta > 0 ? '+' : ''}₹{row.ecpDelta}
                        </span>
                        {row.ecpDelta > 0 ? <span className="text-emerald-500">✓ Advantage</span> : <span className="text-rose-500">⚠ Undercut</span>}
                    </div>
                </motion.div>
            ))}
        </div>
    )

    // =====================================
    // VIEW 4: DELTA FOCUS
    // =====================================
    const DeltaFocusView = () => {
        const maxDelta = Math.max(...filteredData.map(r => Math.abs(r.ecpDelta)))
        return (
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600">
                            <th className="text-left px-4 py-3 text-[11px] font-medium uppercase">Platform</th>
                            <th className="text-left px-3 py-3 text-[11px] font-medium uppercase">Date</th>
                            <th className="text-left px-3 py-3 text-[11px] font-medium uppercase">Your Product</th>
                            <th className="text-left px-3 py-3 text-[11px] font-medium uppercase">Competitor</th>
                            <th className="text-center px-3 py-3 text-[11px] font-medium uppercase min-w-[200px]">ECP Delta</th>
                            <th className="text-center px-3 py-3 text-[11px] font-medium uppercase">Verdict</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.slice(0, 15).map((row, idx) => {
                            const barWidth = Math.abs(row.ecpDelta) / maxDelta * 50
                            return (
                                <motion.tr key={idx} className="border-b hover:bg-slate-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <td className="px-4 py-2.5">
                                        <span className={cn('px-2 py-0.5 text-[10px] rounded', getPlatformStyle(row.platform).bg, 'text-white')}>{row.platform}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-600 text-xs">
                                        {row.dateFormatted}
                                        {row.isWeekend && <span className="ml-1 px-1 py-0.5 text-[8px] bg-amber-100 text-amber-700 rounded">WE</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-700 max-w-[160px] truncate">{row.ownProductName}</td>
                                    <td className="px-3 py-2.5 text-slate-700 max-w-[160px] truncate">{row.competeProductName}</td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center justify-center gap-1">
                                            <div className="w-[50%] flex justify-end">
                                                {row.ecpDelta < 0 && <div className="h-4 bg-rose-400 rounded-l" style={{ width: `${barWidth}%` }} />}
                                            </div>
                                            <div className="w-10 text-center text-xs font-medium tabular-nums">{row.ecpDelta > 0 ? '+' : ''}{row.ecpDelta}</div>
                                            <div className="w-[50%] flex justify-start">
                                                {row.ecpDelta > 0 && <div className="h-4 bg-emerald-400 rounded-r" style={{ width: `${barWidth}%` }} />}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        {row.ecpDelta > 0 ? <span className="text-emerald-600 text-xs font-medium">✓ WIN</span> : row.ecpDelta < 0 ? <span className="text-rose-600 text-xs font-medium">✗ LOSE</span> : <span className="text-slate-400 text-xs">—</span>}
                                    </td>
                                </motion.tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        )
    }

    // =====================================
    // VIEW 5: PLATFORM GRID
    // =====================================
    const PlatformGridView = () => {
        const grouped = useMemo(() => {
            const g = {}
            filteredData.forEach(row => {
                if (!g[row.platform]) g[row.platform] = []
                g[row.platform].push(row)
            })
            return g
        }, [filteredData])

        return (
            <div className="p-4 space-y-4">
                {Object.entries(grouped).map(([platform, rows]) => (
                    <motion.div key={platform} className="border border-slate-200 rounded-xl overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className={cn('px-4 py-2 flex items-center gap-2', getPlatformStyle(platform).bg)}>
                            <span className="text-white font-medium text-sm">{platform}</span>
                            <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] text-white">{rows.length} matches</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {rows.slice(0, 5).map((row, idx) => (
                                <div key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                                            <span>{row.dateFormatted}</span>
                                            {row.isWeekend && <span className="px-1 py-0.5 text-[8px] bg-amber-100 text-amber-700 rounded">WE</span>}
                                        </div>
                                        <div className="text-sm text-slate-800 truncate">{row.ownProductName}</div>
                                        <div className="text-[11px] text-slate-500">vs {row.competeProductName}</div>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="text-right"><span className="text-slate-400 text-xs">You:</span> <span className="font-medium text-blue-600">₹{row.ownEcp}</span></div>
                                        <div className="text-right"><span className="text-slate-400 text-xs">Comp:</span> <span className={cn('font-medium', row.ecpDelta > 0 ? 'text-emerald-600' : 'text-rose-600')}>₹{row.competeEcp}</span></div>
                                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getDeltaColor(row.ecpDelta))}>Δ{row.ecpDelta > 0 ? '+' : ''}{row.ecpDelta}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>
        )
    }

    // =====================================
    // VIEW 6: HEAT MAP
    // =====================================
    const HeatMapView = () => {
        const getHeatColor = (delta) => {
            if (delta >= 50) return 'bg-emerald-500 text-white'
            if (delta >= 20) return 'bg-emerald-300 text-emerald-900'
            if (delta > 0) return 'bg-emerald-100 text-emerald-800'
            if (delta === 0) return 'bg-slate-100 text-slate-600'
            if (delta > -20) return 'bg-rose-100 text-rose-800'
            if (delta > -50) return 'bg-rose-300 text-rose-900'
            return 'bg-rose-500 text-white'
        }
        return (
            <div className="overflow-x-auto p-4">
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                    {filteredData.slice(0, 20).map((row, idx) => (
                        <motion.div
                            key={idx}
                            className={cn('rounded-lg p-3 border transition-all', getHeatColor(row.ecpDelta))}
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: idx * 0.03 }}
                        >
                            <div className="text-[10px] opacity-75 mb-1 flex items-center gap-1">
                                {row.platform}
                                {row.isWeekend && <span className="px-1 bg-white/30 rounded text-[8px]">WE</span>}
                            </div>
                            <div className="text-xs font-medium truncate">{row.ownProductName.split(' ').slice(0, 3).join(' ')}</div>
                            <div className="text-[10px] opacity-60 truncate">vs {row.competeProductName.split(' ').slice(0, 3).join(' ')}</div>
                            <div className="mt-2 text-lg font-bold tabular-nums">Δ{row.ecpDelta > 0 ? '+' : ''}{row.ecpDelta}</div>
                        </motion.div>
                    ))}
                </div>
                <div className="mt-4 flex items-center justify-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> Strong Advantage (+50+)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200"></span> Advantage (+1-49)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-200"></span> Undercut (-1--49)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500"></span> Major Undercut (-50+)</span>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] ring-1 ring-slate-200/50">
            {/* Header with View Selector + Day Filter */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">ECP - Own vs Compete Product</span>
                    <span className="px-2 py-0.5 text-[10px] text-slate-500 bg-slate-100 rounded">{filteredData.length} comparisons</span>
                </div>
                <div className="flex items-center gap-3">
                    {/* Day Filter Toggle */}
                    <div className="flex items-center gap-1 p-0.5 bg-amber-50 rounded-lg border border-amber-200">
                        {DAY_OPTIONS.map(opt => (
                            <button key={opt.key} onClick={() => setDayFilter(opt.key)}
                                className={cn('px-2 py-1 text-[10px] rounded-md transition-all',
                                    dayFilter === opt.key ? 'bg-amber-500 text-white font-medium shadow-sm' : 'text-amber-700 hover:bg-amber-100')}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {/* View Selector */}
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                        {VIEW_OPTIONS.map(opt => (
                            <button key={opt.key} onClick={() => setViewMode(opt.key)}
                                className={cn('px-2.5 py-1.5 text-[11px] rounded-md transition-all flex items-center gap-1',
                                    viewMode === opt.key ? 'bg-white text-slate-800 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700')}>
                                <span>{opt.icon}</span>
                                <span className="hidden lg:inline">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content by view mode */}
            {viewMode === 'detail' && <DetailTableView />}
            {viewMode === 'sku' && <OwnSkuDrillView />}
            {viewMode === 'pack' && <PackSizeDrillView />}
            {viewMode === 'duel' && <DuelCardsView />}
            {viewMode === 'delta' && <DeltaFocusView />}
            {viewMode === 'heatmap' && <HeatMapView />}
        </div>
    )
}


// ========================================
// MAIN PRICING ANALYSIS PAGE
// ========================================

export default function PricingAnalysis() {
    const [activeTab, setActiveTab] = useState('discount')
    const [searchQuery, setSearchQuery] = useState('')

    const renderActiveTable = () => {
        switch (activeTab) {
            case 'discount':
                return <DiscountTrendTable data={DISCOUNT_TREND_DATA} searchQuery={searchQuery} />
            case 'ecpBrand':
                return <EcpByBrandTable data={ECP_BY_BRAND_DATA} searchQuery={searchQuery} />
            case 'dayLevel':
                return <BrandSkuDayTable data={BRAND_SKU_DAY_DATA} searchQuery={searchQuery} />
            case 'competitor':
                return <CompetitorViewTable data={OWN_VS_COMPETE_DATA} searchQuery={searchQuery} />
            default:
                return null
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/30 to-slate-100">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg">
                                <DollarSign size={20} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800">Pricing Analysis</h1>
                                <p className="text-sm text-slate-500">ECP, Discounts & Competitor Intelligence</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all">
                                <RefreshCw size={14} />
                                Refresh
                            </button>
                            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm">
                                <Download size={14} />
                                Export
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Outer Container with 3D Effect */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60 space-y-6">
                    {/* KPI Cards Row */}
                    <div className="grid grid-cols-6 gap-4">
                        <PremiumKpiCard
                            icon={Package}
                            label="SKUs Tracked"
                            value={KPI_DATA.skusTracked}
                            iconColor="#3b82f6"
                        />
                        <PremiumKpiCard
                            icon={DollarSign}
                            label="Avg ECP"
                            value={`₹${KPI_DATA.avgEcp}`}
                            delta={1.8}
                            iconColor="#10b981"
                        />
                        <PremiumKpiCard
                            icon={Activity}
                            label="RPI"
                            value={KPI_DATA.rpi.toFixed(2)}
                            delta={0.3}
                            iconColor="#8b5cf6"
                        />
                        {PLATFORMS.map(p => (
                            <PlatformDiscountCard
                                key={p.key}
                                platform={p}
                                discount={KPI_DATA.discounts[p.key]}
                            />
                        ))}
                    </div>

                    {/* View Tabs and Search */}
                    <div className="flex items-center justify-between">
                        <ViewTabs activeTab={activeTab} onChange={setActiveTab} />
                        <TableSearch
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search brands, SKUs..."
                        />
                    </div>

                    {/* Active Table */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {renderActiveTable()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
