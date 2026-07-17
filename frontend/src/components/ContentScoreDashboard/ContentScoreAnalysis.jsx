import React, { useState, useEffect, useContext, useMemo } from 'react';
import { FilterContext } from '../../utils/FilterContext';
import axiosInstance from '../../api/axiosInstance';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton
} from '@mui/material';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  LineChart,
  Line,
  Tooltip
} from 'recharts';
import CloseIcon from '@mui/icons-material/Close';
import { ChevronDown, ChevronRight, SlidersHorizontal, TrendingUp, TrendingDown, BarChart3, Type, Image as LucideImage, CopyPlus, FileText, Star, PieChart, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SnapshotOverview from "../CommonLayout/SnapshotOverview";

// --- COMPONENTS ---

const renderCustomLabel = (props) => {
  const { x, y, value, index } = props;
  if (!value) return null;
  // Reduce label density by showing labels dynamically
  if (index % 2 === 0 || value > 90) {
    return (
      <text x={x} y={y - 12} fill="#333" fontSize={11} fontWeight={600} textAnchor="middle">
        {value.toFixed(2)}%
      </text>
    );
  }
  return null;
};

// --- COMPONENTS ---
const ScoreCard = ({ title, score, isGreen }) => (
  <Box
    sx={{
      backgroundColor: isGreen ? '#4a8244' : '#bd423c',
      color: 'white',
      borderRadius: '8px',
      px: 2,
      py: 1.5,
      minWidth: '130px',
      textAlign: 'center',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}
  >
    <Typography sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.85rem' }}>
      {title}
    </Typography>
    <Typography sx={{ fontWeight: 700, fontSize: '1.5rem' }}>
      {score}%
    </Typography>
  </Box>
);

const HeaderControls = ({ title, onBack }) => {
  const isKeyInsights = title === "KEY-INSIGHTS";
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center', width: '100%' }}>
      {/* Override title area for sub-views */}
      <Typography variant="h6" sx={{ fontWeight: 500, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {!isKeyInsights && <>MARS <span style={{ fontWeight: 500, fontSize: '0.95rem', color: '#334155' }}>CONTENT ANALYSIS </span></>}
        {isKeyInsights ? title : `(${title})`}
      </Typography>
      <IconButton onClick={onBack} sx={{ bgcolor: 'white', border: '1px solid #cbd5e1', borderRadius: '50%', width: 34, height: 34, '&:hover': { bgcolor: '#f6f8fb' } }}>
        <CloseIcon sx={{ color: '#64748b', fontSize: '20px' }} />
      </IconButton>
    </Box>
  );
};



const StyledTable = ({ title, data }) => (
  <Card sx={{ borderRadius: '12px', mb: 3, boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid rgba(148,163,184,0.25)', bgcolor: '#ffffff' }}>
    <CardContent sx={{ p: '0 !important' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 800, p: 2, pb: 1, color: '#0f172a' }}>
        {title}
      </Typography>
      <TableContainer sx={{ maxHeight: 320, overflowY: 'auto', borderTop: '1px solid #e5e7eb' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 700, color: '#0f172a', py: 1.5, borderBottom: '2px solid #e2e8f0', width: '21%', minWidth: 200 }}>Product ID</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#0f172a', py: 1.5, borderBottom: '2px solid #e2e8f0', width: '60%', minWidth: 400 }}>SKU Name</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#0f172a', py: 1.5, borderBottom: '2px solid #e2e8f0', width: '19%', minWidth: 120, textAlign: 'right' }}>Overall Score</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={index} sx={{ '&:hover': { backgroundColor: '#f1f5f9' } }}>
                <TableCell sx={{ py: 1.25, color: '#1e293b', fontWeight: 600 }}>{row.id}</TableCell>
                <TableCell sx={{ py: 1.25, color: '#334155', whiteSpace: 'normal', lineHeight: 1.3 }}>{row.name}</TableCell>
                <TableCell sx={{ py: 1.25, color: '#1e293b', fontWeight: 700, textAlign: 'right' }}>{row.score}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </CardContent>
  </Card>
);


const cellTone = (v) => {
  const num = parseFloat((v || '').replace('%', ''));
  if (isNaN(num)) return "";
  if (num >= 85) return "bg-emerald-50 text-emerald-700 ring-emerald-200 border border-emerald-200";
  if (num >= 70) return "bg-amber-50 text-amber-700 ring-amber-200 border border-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200 border border-rose-200";
};

const renderScoreCell = (score) => {
  if (!score || score === '-') return '-';
  return (
    <span className={`inline-flex min-w-[36px] justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-slate-900 ${cellTone(score)}`}>
      {score}
    </span>
  );
};

const ExpandablePlatformRow = ({ row }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <React.Fragment>
      <tr className="group hover:bg-slate-50 transition-colors">
        <td
            className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-3 py-2 border-b border-slate-100 border-r"
            style={{ minWidth: 280 }}
        >
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400 hover:text-slate-600 cursor-pointer border-none bg-transparent"
                >
                    {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                    ) : (
                        <ChevronRight className="h-4 w-4" />
                    )}
                </button>
                <div>
                    <div className="font-bold text-slate-900 leading-5 text-[13px]">{row.platform}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Platform Summary</div>
                </div>
            </div>
        </td>
        <td className="px-3 py-3 border-b border-slate-100 text-[12px] text-slate-900 font-semibold text-center">{renderScoreCell(row.title)}</td>
        <td className="px-3 py-3 border-b border-slate-100 text-[12px] text-slate-900 font-semibold text-center">{renderScoreCell(row.images)}</td>
        <td className="px-3 py-3 border-b border-slate-100 text-[12px] text-slate-900 font-semibold text-center">{renderScoreCell(row.secondary)}</td>
        <td className="px-3 py-3 border-b border-slate-100 text-[12px] text-slate-900 font-semibold text-center">{renderScoreCell(row.desc)}</td>
        <td className="px-3 py-3 border-b border-slate-100 text-[12px] text-slate-900 font-semibold text-center">{renderScoreCell(row.rating)}</td>
      </tr>
      
      {expanded && row.skus && row.skus.map((sku, idx) => (
          <tr key={`sku-${row.platform}-${idx}`} className="bg-slate-50/70 hover:bg-slate-100/70 transition-colors">
              <td
                  className="sticky left-0 z-10 bg-slate-50/70 px-3 py-2 border-b border-slate-100 pl-10 border-r"
                  style={{ minWidth: 280 }}
              >
                  <div className="text-[12px] font-medium text-slate-700 leading-snug">
                      {sku.name}
                  </div>
              </td>
              <td className="px-3 py-2 border-b border-slate-100 text-[12px] text-slate-600 text-center">{renderScoreCell(sku.title)}</td>
              <td className="px-3 py-2 border-b border-slate-100 text-[12px] text-slate-600 text-center">{renderScoreCell(sku.images)}</td>
              <td className="px-3 py-2 border-b border-slate-100 text-[12px] text-slate-600 text-center">{renderScoreCell(sku.secondary)}</td>
              <td className="px-3 py-2 border-b border-slate-100 text-[12px] text-slate-600 text-center">{renderScoreCell(sku.desc)}</td>
              <td className="px-3 py-2 border-b border-slate-100 text-[12px] text-slate-600 text-center">{renderScoreCell(sku.rating)}</td>
          </tr>
      ))}
    </React.Fragment>
  );
};

// --- MAIN DEFAULT EXPORT ---
export default function ContentScoreAnalysis() {
  const { platform, getResolvedPlatform, selectedCategory, selectedChannel, selectedBrand, selectedLocation, timeStart, timeEnd, compareStart, compareEnd } = useContext(FilterContext);

  const [currentView, setCurrentView] = useState('main'); // 'main' | 'trends' | 'key_insights'
  const [selectedLines, setSelectedLines] = useState(['overall', 'title', 'images', 'secondary', 'description', 'rating']);
  const [selectedKpi, setSelectedKpi] = useState('overallScore');

  const [overviewData, setOverviewData] = useState({
    current: { titleScore: 0, imageScore: 0, siScore: 0, descScore: 0, ratingScore: 0, overallScore: 0 },
    deltas: { titleScore: 0, imageScore: 0, siScore: 0, descScore: 0, ratingScore: 0, overallScore: 0 }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [platformBreakdown, setPlatformBreakdown] = useState({ overall: null, platforms: [] });
  const [skuData, setSkuData] = useState([]);
  const [trendsData, setTrendsData] = useState([]);
  
  // Detail View Search/Filter States
  const [detailSearchQuery, setDetailSearchQuery] = useState("");
  const [activeStatusFilter, setActiveStatusFilter] = useState("All"); // All, Healthy, Watch, Action

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const commonParams = {
          platform: getResolvedPlatform(),
          category: selectedCategory === "All" ? undefined : (Array.isArray(selectedCategory) ? selectedCategory.join(",") : selectedCategory),
          channel: selectedChannel === "All" ? undefined : (Array.isArray(selectedChannel) ? selectedChannel.join(",") : selectedChannel),
          brand: selectedBrand === "All" ? undefined : (Array.isArray(selectedBrand) ? selectedBrand.join(",") : selectedBrand),
          location: selectedLocation === "All" ? undefined : (Array.isArray(selectedLocation) ? selectedLocation.join(",") : selectedLocation),
          startDate: timeStart ? timeStart.format('YYYY-MM-DD') : undefined,
          endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : undefined,
          prevStartDate: compareStart ? compareStart.format('YYYY-MM-DD') : undefined,
          prevEndDate: compareEnd ? compareEnd.format('YYYY-MM-DD') : undefined,
        };

        // Fetch Overview
        const overviewRes = await axiosInstance.get('/content-analysis/overview', { params: commonParams });
        if (overviewRes.data && overviewRes.data.current) {
          setOverviewData(overviewRes.data);
        }

        // Fetch Platform Breakdown — exclude channel & platform filters so Cross Platform Overview is unfiltered
        const crossPlatformParams = { ...commonParams };
        delete crossPlatformParams.platform;
        delete crossPlatformParams.channel;
        const breakdownRes = await axiosInstance.get('/content-analysis/platform-breakdown', { params: crossPlatformParams });
        if (breakdownRes.data) {
          setPlatformBreakdown(breakdownRes.data);
        }

        // Fetch SKU Details (from original content API)
        const skuRes = await axiosInstance.get('/content-analysis', { params: commonParams });
        if (skuRes.data) {
          setSkuData(skuRes.data);
        }

        // Fetch Trends
        const trendsRes = await axiosInstance.get('/content-analysis/trends', { params: commonParams });
        if (trendsRes.data) {
          setTrendsData(trendsRes.data);
        }

      } catch (err) {
        console.error("Failed to fetch content analysis data", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (timeStart && timeEnd) {
      fetchData();
    }
  }, [platform, selectedCategory, selectedChannel, selectedBrand, selectedLocation, timeStart, timeEnd, compareStart, compareEnd]);

  const toggleLine = (line) => {
    if (selectedLines.includes(line)) {
      if (selectedLines.length > 1) { // ensure at least one remains
        setSelectedLines(selectedLines.filter(l => l !== line));
      }
    } else {
      setSelectedLines([...selectedLines, line]);
    }
  };

  const mapKpiKeyToTrendKey = (kpiKey) => {
    const mapping = {
      overallScore: 'overall',
      titleScore: 'title',
      imageScore: 'images',
      siScore: 'secondary',
      descScore: 'description',
      ratingScore: 'rating'
    };
    return mapping[kpiKey] || kpiKey;
  };

  const parsePercent = str => parseFloat((str||'0').replace('%','')) || 0;
  
  const platformRows = useMemo(() => {
    return platformBreakdown.platforms.map(p => ({
      name: p.platform,
      titleScore: p.current.titleScore,
      imagesScore: p.current.imageScore,
      secondaryScore: p.current.siScore,
      descScore: p.current.descScore,
      ratingScore: p.current.ratingScore,
      overallScore: p.current.overallScore
    }));
  }, [platformBreakdown]);

  // Transform SKU data for the detail table
  const tableDataWithSkus = useMemo(() => {
    return platformBreakdown.platforms.map(p => {
      // Filter SKUs based on search query and status
      const filteredSkus = skuData.filter(s => {
        const matchesPlatform = s.platform.toLowerCase() === p.platform.toLowerCase();
        if (!matchesPlatform) return false;

        const matchesSearch = s.title.toLowerCase().includes(detailSearchQuery.toLowerCase());
        
        // Status logic
        let matchesStatus = true;
        if (activeStatusFilter !== "All") {
          const score = s.overallScore;
          if (activeStatusFilter === "Healthy") matchesStatus = score >= 90;
          else if (activeStatusFilter === "Watch") matchesStatus = score >= 70 && score < 90;
          else if (activeStatusFilter === "Action") matchesStatus = score < 70;
        }

        return matchesSearch && matchesStatus;
      });

      const platformSkus = filteredSkus.map(s => ({
        name: s.title,
        title: `${s.titleScore.toFixed(2)}%`,
        images: `${s.imageScore.toFixed(2)}%`,
        secondary: `${s.siScore.toFixed(2)}%`,
        desc: `${s.descriptionScore.toFixed(2)}%`,
        rating: `${s.ratingScore.toFixed(2)}%`
      }));

      return {
        platform: p.platform,
        title: `${p.current.titleScore.toFixed(2)}%`,
        images: `${p.current.imageScore.toFixed(2)}%`,
        secondary: `${p.current.siScore.toFixed(2)}%`,
        desc: `${p.current.descScore.toFixed(2)}%`,
        rating: `${p.current.ratingScore.toFixed(2)}%`,
        skus: platformSkus,
        overallScore: p.current.overallScore
      };
    }).filter(p => {
      // Only show platform if it matches search OR has filtered SKUs
      if (activeStatusFilter !== "All") {
        return p.skus.length > 0;
      }
      return p.platform.toLowerCase().includes(detailSearchQuery.toLowerCase()) || p.skus.length > 0;
    });
  }, [platformBreakdown, skuData, detailSearchQuery, activeStatusFilter]);

  // Insights gainers/drainers from SKU data
  const gainersData = useMemo(() => {
    return [...skuData]
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 10)
      .map(s => ({ id: s.product_id, name: s.title, score: `${s.overallScore.toFixed(1)}%` }));
  }, [skuData]);

  const drainersData = useMemo(() => {
    return [...skuData]
      .filter(s => s.overallScore > 0)
      .sort((a, b) => a.overallScore - b.overallScore)
      .slice(0, 10)
      .map(s => ({ id: s.product_id, name: s.title, score: `${s.overallScore.toFixed(1)}%` }));
  }, [skuData]);

  // ----- MAIN VIEW -----
  if (currentView === 'main') {
    return (
      <Box sx={{ p: { xs: 1, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3, bgcolor: '#f7f9fc', minHeight: '100vh', fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        <SnapshotOverview
          title="Content Analysis Overview"
          icon={Activity}
          loading={isLoading}
          chip="Performance Metrics"
          headerRight={
            <div className="flex flex-row items-center gap-2">
              <Button variant="outlined" size="small" onClick={() => setCurrentView('trends')} sx={{ borderRadius: '20px', textTransform: 'none', color: '#555', borderColor: '#ccc', fontWeight: 600, px: 3 }}>
                View Trends
              </Button>
              <Button variant="outlined" size="small" onClick={() => setCurrentView('key_insights')} sx={{ borderRadius: '20px', textTransform: 'none', color: '#555', borderColor: '#ccc', fontWeight: 600, px: 3 }}>
                Key Insights
              </Button>
            </div>
          }
          kpis={[
            { id: 'title', title: 'Title Score', value: `${overviewData.current.titleScore.toFixed(2)}%`, subtitle: 'Title Quality', delta: overviewData.deltas.titleScore, deltaLabel: `${overviewData.deltas.titleScore > 0 ? '▲' : '▼'} ${Math.abs(overviewData.deltas.titleScore).toFixed(1)}%`, icon: Type, gradient: ['#10b981', '#34d399'], trendSeries: [] },
            { id: 'image', title: 'Image Score', value: `${overviewData.current.imageScore.toFixed(2)}%`, subtitle: 'Hero images', delta: overviewData.deltas.imageScore, deltaLabel: `${overviewData.deltas.imageScore > 0 ? '▲' : '▼'} ${Math.abs(overviewData.deltas.imageScore).toFixed(1)}%`, icon: LucideImage, gradient: ['#10b981', '#34d399'], trendSeries: [] },
            { id: 'si', title: 'SI Score', value: `${overviewData.current.siScore.toFixed(2)}%`, subtitle: 'Secondary images', delta: overviewData.deltas.siScore, deltaLabel: `${overviewData.deltas.siScore > 0 ? '▲' : '▼'} ${Math.abs(overviewData.deltas.siScore).toFixed(1)}%`, icon: CopyPlus, gradient: ['#10b981', '#34d399'], trendSeries: [] },
            { id: 'desc', title: 'Description Score', value: `${overviewData.current.descScore.toFixed(2)}%`, subtitle: 'Product details', delta: overviewData.deltas.descScore, deltaLabel: `${overviewData.deltas.descScore > 0 ? '▲' : '▼'} ${Math.abs(overviewData.deltas.descScore).toFixed(1)}%`, icon: FileText, gradient: ['#f43f5e', '#fb7185'], trendSeries: [] },
            { id: 'rating', title: 'Rating Score', value: `${overviewData.current.ratingScore.toFixed(2)}%`, subtitle: 'Consumer ratings', delta: overviewData.deltas.ratingScore, deltaLabel: `${overviewData.deltas.ratingScore > 0 ? '▲' : '▼'} ${Math.abs(overviewData.deltas.ratingScore).toFixed(1)}%`, icon: Star, gradient: ['#f43f5e', '#fb7185'], trendSeries: [] },
            { id: 'overall', title: 'Overall Score', value: `${overviewData.current.overallScore.toFixed(2)}%`, subtitle: 'Aggregate health', delta: overviewData.deltas.overallScore, deltaLabel: `${overviewData.deltas.overallScore > 0 ? '▲' : '▼'} ${Math.abs(overviewData.deltas.overallScore).toFixed(1)}%`, icon: PieChart, gradient: ['#6366f1', '#8b5cf6'], trendSeries: [] }
          ]}
        />

        <Box sx={{ mb: 2 }}>
          <ContentCrossPlatformOverview 
            breakdown={platformBreakdown}
            onViewTrends={(kpiKey) => {
              setSelectedLines([mapKpiKeyToTrendKey(kpiKey)]);
              setCurrentView('trends');
            }}
            onViewInsights={(kpiKey) => {
              setSelectedKpi(kpiKey);
              setCurrentView('key_insights');
            }}
          />
        </Box>

        <Box sx={{ mb: 4 }}>
          {platformRows.length > 0 && <PlatformPerformanceStudio rows={platformRows} />}
        </Box>

        <div className="rounded-3xl border bg-white p-4 shadow-sm w-full mt-6">
          <div className="mb-4 flex items-center justify-between font-bold text-slate-900">
             <div className="flex flex-col gap-0.5">
               <div className="text-base font-semibold text-slate-900">
                 Content Analysis Detail View
               </div>
               <div className="text-xs text-slate-500 font-normal">
                 Sortable • Paginated
               </div>
             </div>
             
             <div className="flex items-center gap-2">
                 <div className="relative">
                    <input 
                      type="text"
                      placeholder="Search SKU..."
                      className="rounded-full border border-slate-200 bg-white pl-8 pr-4 py-1.5 text-xs outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-all w-48"
                      value={detailSearchQuery}
                      onChange={(e) => setDetailSearchQuery(e.target.value)}
                    />
                    <SlidersHorizontal className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                 </div>
                 <div className="flex items-center gap-2 ml-2">
                    <span 
                      onClick={() => setActiveStatusFilter(activeStatusFilter === "Healthy" ? "All" : "Healthy")}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium border cursor-pointer transition-all ${
                        activeStatusFilter === "Healthy" 
                        ? "bg-emerald-500 text-white border-emerald-600 shadow-sm" 
                        : "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
                      }`}
                    >
                        <span className={`h-2 w-2 rounded-full ${activeStatusFilter === "Healthy" ? "bg-white" : "bg-emerald-500"}`} /> Healthy
                    </span>
                    <span 
                      onClick={() => setActiveStatusFilter(activeStatusFilter === "Watch" ? "All" : "Watch")}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium border cursor-pointer transition-all ${
                        activeStatusFilter === "Watch" 
                        ? "bg-amber-500 text-white border-amber-600 shadow-sm" 
                        : "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100"
                      }`}
                    >
                        <span className={`h-2 w-2 rounded-full ${activeStatusFilter === "Watch" ? "bg-white" : "bg-amber-500"}`} /> Watch
                    </span>
                    <span 
                      onClick={() => setActiveStatusFilter(activeStatusFilter === "Action" ? "All" : "Action")}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium border cursor-pointer transition-all ${
                        activeStatusFilter === "Action" 
                        ? "bg-rose-500 text-white border-rose-600 shadow-sm" 
                        : "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100"
                      }`}
                    >
                        <span className={`h-2 w-2 rounded-full ${activeStatusFilter === "Action" ? "bg-white" : "bg-rose-500"}`} /> Action
                    </span>
                    {activeStatusFilter !== "All" && (
                      <button 
                        onClick={() => setActiveStatusFilter("All")}
                        className="text-[10px] text-slate-500 hover:text-slate-800 underline ml-1"
                      >
                        Clear
                      </button>
                    )}
                 </div>
             </div>
          </div>
          
          <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="overflow-auto">
                  <table className="min-w-[1000px] w-full border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10 bg-white">
                          <tr>
                              <th className="sticky left-0 z-20 bg-slate-50 py-3 pl-4 pr-4 text-left text-[11px] font-bold uppercase tracking-widest text-slate-900 border-b border-r border-slate-100 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)]" style={{ minWidth: 280 }}>
                                  <div className="flex items-center h-full">PLATFORM / SKU</div>
                              </th>
                              <th className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900">
                                  TITLE SCORE
                              </th>
                              <th className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900">
                                  IMAGES SCORE
                              </th>
                              <th className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900">
                                  SECONDARY IMAGES SCORE
                              </th>
                              <th className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900">
                                  FEATURES & BENEFITS SCORE
                              </th>
                              <th className="border-b border-r border-slate-100 last:border-r-0 bg-slate-50 py-3 px-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-900">
                                  RATING SCORE
                              </th>
                          </tr>
                      </thead>
                      <tbody>
                          {tableDataWithSkus.map((row, index) => (
                              <ExpandablePlatformRow key={index} row={row} />
                          ))}
                      </tbody>
                  </table>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] px-4 py-3 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                       <button disabled className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-40 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-not-allowed">
                           Prev
                       </button>
                       <span className="text-slate-600">
                           Page <b className="text-slate-900">1</b> / 1
                       </span>
                       <button disabled className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-40 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-not-allowed">
                           Next
                       </button>
                  </div>
                  <div className="flex items-center gap-3">
                       <div className="text-slate-600">
                           Rows/page
                           <select defaultValue={5} className="ml-1 rounded-full border border-slate-200 px-2 py-1 bg-white outline-none focus:border-slate-400 text-slate-700">
                               <option value={5}>5</option>
                           </select>
                       </div>
                  </div>
              </div>
          </div>
        </div>
      </Box>
    );
  }

  // ----- TRENDS VIEW -----
  if (currentView === 'trends') {
    return (
      <Box sx={{ p: { xs: 1, md: 3 }, display: 'flex', flexDirection: 'column', bgcolor: '#f7f9fc', minHeight: '100vh', mt: '-20px' }}>
        <HeaderControls title="TRENDS" onBack={() => setCurrentView('main')} />
        
        <Card sx={{ flex: 1, borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #eaeaea', p: 3 }}>
          <Box sx={{ display: 'flex', gap: 3, mb: 1 }}>
            <Typography onClick={() => toggleLine('overall')} variant="body2" sx={{ cursor: 'pointer', opacity: selectedLines.includes('overall') ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 0.5, color: '#444', fontWeight: 600, fontSize: '0.8rem' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#6366f1' }} /> Overall Score</Typography>
            <Typography onClick={() => toggleLine('title')} variant="body2" sx={{ cursor: 'pointer', opacity: selectedLines.includes('title') ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 0.5, color: '#444', fontWeight: 600, fontSize: '0.8rem' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#4ca6ff' }} /> Title Score</Typography>
            <Typography onClick={() => toggleLine('images')} variant="body2" sx={{ cursor: 'pointer', opacity: selectedLines.includes('images') ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 0.5, color: '#444', fontWeight: 600, fontSize: '0.8rem' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#1d227b' }} /> Images Score</Typography>
            <Typography onClick={() => toggleLine('secondary')} variant="body2" sx={{ cursor: 'pointer', opacity: selectedLines.includes('secondary') ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 0.5, color: '#444', fontWeight: 600, fontSize: '0.8rem' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#db783b' }} /> Secondary Images Score</Typography>
            <Typography onClick={() => toggleLine('description')} variant="body2" sx={{ cursor: 'pointer', opacity: selectedLines.includes('description') ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 0.5, color: '#444', fontWeight: 600, fontSize: '0.8rem' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#f43f5e' }} /> Description Score</Typography>
            <Typography onClick={() => toggleLine('rating')} variant="body2" sx={{ cursor: 'pointer', opacity: selectedLines.includes('rating') ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 0.5, color: '#444', fontWeight: 600, fontSize: '0.8rem' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#731475' }} /> Rating Score</Typography>
          </Box>
          <Box sx={{ height: 450, mt: 2 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendsData} margin={{ top: 20, right: 30, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaeaea" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }} 
                  axisLine={false} 
                  tickLine={false} 
                  dy={10}
                  tickFormatter={(str) => {
                    if (!str) return "";
                    // Expected format YYYY-MM-DD from API
                    const parts = str.split('-');
                    if (parts.length < 3) return str;
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    return `${months[parseInt(parts[1])-1]} ${parts[2]}`;
                  }}
                />
                <YAxis tick={{ fontSize: 12, fill: '#444', fontWeight: 500 }} axisLine={false} tickLine={false} domain={[60, 100]} tickFormatter={(val) => `${val}%`} />
                {selectedLines.includes('overall') && <Line type="monotone" dataKey="overall" stroke="#6366f1" strokeWidth={2.5} dot={false} label={renderCustomLabel} activeDot={{ r: 6 }} />}
                {selectedLines.includes('title') && <Line type="monotone" dataKey="title" stroke="#4ca6ff" strokeWidth={2.5} dot={false} label={renderCustomLabel} activeDot={{ r: 6 }} />}
                {selectedLines.includes('images') && <Line type="monotone" dataKey="images" stroke="#1d227b" strokeWidth={2.5} dot={false} label={renderCustomLabel} activeDot={{ r: 6 }} />}
                {selectedLines.includes('secondary') && <Line type="monotone" dataKey="secondary" stroke="#db783b" strokeWidth={2.5} dot={false} label={renderCustomLabel} activeDot={{ r: 6 }} />}
                {selectedLines.includes('description') && <Line type="monotone" dataKey="description" stroke="#f43f5e" strokeWidth={2.5} dot={false} label={renderCustomLabel} activeDot={{ r: 6 }} />}
                {selectedLines.includes('rating') && <Line type="monotone" dataKey="rating" stroke="#731475" strokeWidth={2.5} dot={false} label={renderCustomLabel} activeDot={{ r: 6 }} />}
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #eaeaea', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              </LineChart>
            </ResponsiveContainer>
            <Typography variant="body2" sx={{ textAlign: 'center', color: '#555', fontWeight: 600, mt: 1 }}>Year</Typography>
          </Box>
        </Card>
      </Box>
    );
  }

  // ----- KEY INSIGHTS VIEW -----
  if (currentView === 'key_insights') {
    return (
      <Box sx={{ p: { xs: 1, md: 3 }, display: 'flex', flexDirection: 'column', bgcolor: '#f7f9fc', minHeight: '100vh', mt: '-20px' }}>
        <HeaderControls title="KEY-INSIGHTS" onBack={() => setCurrentView('main')} />
        <StyledTable title={`${selectedKpi ? crossPlatformKpiDefs.find(k => k.key === selectedKpi)?.label : 'OVERALL'} GAINERS`} data={gainersData} />
        <StyledTable title={`${selectedKpi ? crossPlatformKpiDefs.find(k => k.key === selectedKpi)?.label : 'OVERALL'} DRAINERS`} data={drainersData} />
      </Box>
    );
  }

  return null;
}

const PlatformPerformanceStudio = ({ rows }) => {
  const [activeName, setActiveName] = useState(rows[0]?.name);
  const [compareName, setCompareName] = useState(null);

  const active = React.useMemo(() => rows.find((f) => f.name === activeName) ?? rows[0], [activeName, rows]);
  const compare = React.useMemo(() => compareName ? rows.find((f) => f.name === compareName) ?? null : null, [compareName, rows]);
  const clamp01 = (value) => Math.max(0, Math.min(1, value));

  const kpiBands = [
    { key: "overallScore", label: "Overall Score", activeValue: active.overallScore, compareValue: compare?.overallScore, max: 100, format: (v) => `${Number(v).toFixed(2)}%` },
    { key: "titleScore", label: "Title Score", activeValue: active.titleScore, compareValue: compare?.titleScore, max: 100, format: (v) => `${Number(v).toFixed(2)}%` },
    { key: "imagesScore", label: "Images Score", activeValue: active.imagesScore, compareValue: compare?.imagesScore, max: 100, format: (v) => `${Number(v).toFixed(2)}%` },
    { key: "secondaryScore", label: "Secondary Images Score", activeValue: active.secondaryScore, compareValue: compare?.secondaryScore, max: 100, format: (v) => `${Number(v).toFixed(2)}%` },
    { key: "descScore", label: "Description Score", activeValue: active.descScore, compareValue: compare?.descScore, max: 100, format: (v) => `${Number(v).toFixed(2)}%` },
    { key: "ratingScore", label: "Rating Score", activeValue: active.ratingScore, compareValue: compare?.ratingScore, max: 100, format: (v) => `${Number(v).toFixed(2)}%` },
  ];

  return (
    <motion.div
      className="rounded-3xl bg-white/70 backdrop-blur-xl border border-slate-200/80 shadow-xl shadow-sky-900/5 p-4 lg:p-6 grid grid-cols-1 md:grid-cols-5 gap-4 w-full"
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}
      style={{ fontFamily: "Roboto, sans-serif", width: "100%" }}
    >
      <div className="md:col-span-2 space-y-3 flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[1.2rem] text-slate-800">Platform performance</h2>
            <p className="text-xs text-slate-500">Hover a platform to see its DNA. Click a pill below to compare.</p>
          </div>
        </div>

        <div className="space-y-2 max-h-150 overflow-y-auto pr-1 flex-1">
          {rows.map((f, index) => {
            const isActive = f.name === activeName;
            const scoreColor = f.overallScore >= 85 ? 'emerald' : f.overallScore >= 70 ? 'amber' : 'rose';
            
            return (
              <motion.button
                key={f.name} onMouseEnter={() => setActiveName(f.name)} onClick={() => setActiveName(f.name)}
                className={`group w-full flex items-center justify-between rounded-2xl px-3 py-2 text-xs border transition-all duration-200 ${
                  isActive 
                    ? `border-${scoreColor}-400 bg-${scoreColor}-50 shadow-sm shadow-${scoreColor}-900/10` 
                    : "border-slate-200 bg-white/70 hover:bg-slate-50"
                }`}
                whileHover={{ boxShadow: "0 0 12px rgba(0,0,0,0.08)" }} transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <div className="flex items-center gap-2">
                  <div className={`px-3 h-6 rounded-full text-[11px] font-semibold flex items-center justify-center transition-colors duration-100 ${
                    isActive 
                      ? `bg-${scoreColor}-500 text-white` 
                      : `bg-slate-100 text-gray-500 group-hover:bg-${scoreColor}-500 group-hover:text-white`
                  }`}>
                    #{index + 1}
                  </div>
                  <div className="text-left">
                    <div className={`font-bold text-[0.95rem] ${isActive ? `text-${scoreColor}-900` : 'text-slate-800'}`}>{f.name}</div>
                    <div className={`text-[10px] ${isActive ? `text-${scoreColor}-600` : 'text-slate-500'}`}>Overall Score {Number(f.overallScore).toFixed(2)}%</div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="md:col-span-3 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.name + (compare?.name ?? "")}
            className="h-full rounded-3xl bg-gradient-to-br bg-white border border-slate-200/70 shadow-lg p-4 lg:p-6 flex flex-col gap-4"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500 font-semibold">{compare ? "Focus platform · VS mode" : "Focus platform"}</div>
                <div className="text-xl font-semibold">{active.name}{compare && <span className="text-sm font-normal text-slate-500"> vs {compare.name}</span>}</div>
                <p className="text-xs text-slate-500 mt-1">Platform performance scorecard across key dimensions.</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <div className="text-[10px] text-slate-500">Overall Score</div>
                <div className="text-lg font-semibold">{Number(active.overallScore).toFixed(2)}%</div>
                {compare && (
                  <div className={`mt-1 text-[10px] ${active.overallScore >= compare.overallScore ? 'text-emerald-500' : 'text-rose-500'}`}>
                    Delta {(active.overallScore - compare.overallScore).toFixed(2)}% vs {compare.name}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-6 mt-4 items-center">
              <div className="relative h-28 w-28 shrink-0 flex items-center justify-center pt-2">
                <svg viewBox="0 0 100 100" className="h-full w-full absolute inset-0">
                  <circle cx="50" cy="50" r="38" stroke="rgba(148,163,184,0.25)" strokeWidth="8" fill="none" />
                  {compare && (
                    <motion.circle
                      cx="50" cy="50" r="38" stroke="#a855f7" strokeWidth="4" fill="none" strokeLinecap="round"
                      initial={{ pathLength: 0 }} animate={{ pathLength: clamp01(compare.overallScore / 100) }}
                      transition={{ duration: 0.6, ease: "easeOut" }} style={{ transformOrigin: "50% 50%", rotate: "-90deg" }} opacity={0.6}
                    />
                  )}
                  <motion.circle
                    cx="50" cy="50" r="38" stroke="url(#activeGradient)" strokeWidth="8" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: clamp01(active.overallScore / 100) }}
                    transition={{ duration: 0.6, ease: "easeOut" }} style={{ transformOrigin: "50% 50%", rotate: "-90deg" }}
                  />
                  <defs>
                    <linearGradient id="activeGradient" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor={active.overallScore >= 85 ? "#10b981" : active.overallScore >= 70 ? "#f59e0b" : "#f43f5e"} />
                      <stop offset="100%" stopColor={active.overallScore >= 85 ? "#34d399" : active.overallScore >= 70 ? "#fbbf24" : "#fb7185"} />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-xs pt-2">
                  <div className="text-[10px] text-slate-500">SCORE</div>
                  <div className="text-lg font-semibold">{Number(active.overallScore).toFixed(2)}%</div>
                  {compare && <div className="text-[9px] text-violet-600 mt-0.5">vs {Number(compare.overallScore).toFixed(2)}%</div>}
                </div>
              </div>

              <div className="flex-1 space-y-3">
                {kpiBands.map((k) => {
                  const activeRatio = clamp01(k.activeValue / k.max);
                  const compareRatio = k.compareValue != null ? clamp01(k.compareValue / k.max) : null;
                  return (
                    <div key={k.key} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-medium">{k.label}</span>
                        <div className="flex items-center gap-2">
                          {compareRatio != null && <span className="text-[10px] text-violet-600">{k.format(k.compareValue)}</span>}
                          <span className="font-bold">{k.format(k.activeValue)}</span>
                        </div>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden relative">
                        {compareRatio != null && (
                          <motion.div className={`absolute inset-y-[2px] left-0 rounded-full ${k.compareValue >= 85 ? 'bg-emerald-300/40' : k.compareValue >= 70 ? 'bg-amber-300/40' : 'bg-rose-300/40'}`}
                            initial={{ width: 0 }} animate={{ width: `${compareRatio * 100}%` }} transition={{ duration: 0.45, ease: "easeOut" }} />
                        )}
                        <motion.div className={`relative h-full rounded-full bg-gradient-to-r ${k.activeValue >= 85 ? 'from-emerald-400 to-emerald-600' : k.activeValue >= 70 ? 'from-amber-400 to-amber-600' : 'from-rose-400 to-rose-600'}`}
                          initial={{ width: 0 }} animate={{ width: `${activeRatio * 100}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {rows.map((f) => {
                const weight = clamp01(f.overallScore / 100);
                const isCompare = compareName === f.name;
                const isActive = activeName === f.name;
                return (
                  <motion.button key={f.name} onClick={() => setCompareName((prev) => (prev === f.name ? null : f.name))}
                    className={`px-4 py-2 rounded-full text-[11px] border backdrop-blur-sm flex items-center gap-2 hover:-translate-y-0.5 transition-transform ${isCompare ? "border-violet-500 bg-violet-50 shadow-sm" : "border-slate-200 bg-white/80 hover:bg-slate-50"}`}
                  >
                    <div className="h-2 w-10 rounded-full" style={{ background: `linear-gradient(to right, rgba(14,165,233,${0.3 + weight * 0.4}), rgba(99,102,241,${0.2 + weight * 0.5}))` }} />
                    <span className={`truncate ${isActive ? "font-semibold" : "font-normal"}`}>{f.name}</span>
                    {isCompare && <span className="text-[9px] text-violet-600 font-bold ml-1">VS</span>}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// --- CROSS PLATFORM OVERVIEW (DYNAMIC) ---
const cn = (...classes) => classes.filter(Boolean).join(' ');

const crossPlatformKpiDefs = [
  { key: 'overallScore', label: 'Overall Score' },
  { key: 'titleScore', label: 'Title Score' },
  { key: 'imageScore', label: 'Image Score' },
  { key: 'siScore', label: 'SI Score' },
  { key: 'descScore', label: 'Description Score' },
  { key: 'ratingScore', label: 'Rating Score' },
];


const crossSize = {
  minW: 'min-w-[155px]',
  py: 'py-2.5',
  text: 'text-[14px]',
  delta: 'text-[10px]'
};

const getStatusText = (delta) => {
  if (!delta || delta.value === '-') return "text-slate-500";
  return delta.dir === 'up' ? "text-emerald-500" : "text-rose-500";
};

const SectionWrapper = ({ title, icon: Icon, children, className = '', chip, headerRight }) => {
  return (
      <motion.div
          className={`bg-white rounded-3xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] border border-slate-100/60 ${className}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
      >
          <div className="px-6 py-4 border-b border-slate-100/60">
              <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
                          <Icon size={20} className="text-sky-600" />
                      </div>
                      <span className="text-[17px] font-bold text-slate-900" style={{ fontFamily: 'Roboto, sans-serif' }}>
                          {title}
                      </span>
                  </div>
                  {headerRight && (
                      <div className="flex items-center gap-3">
                          {headerRight}
                      </div>
                  )}
              </div>
          </div>
          <div className="p-6">{children}</div>
      </motion.div>
  )
};

const ContentCrossPlatformOverview = ({ breakdown, onViewTrends, onViewInsights }) => {
  const platformData = useMemo(() => {
    const list = [];
    if (breakdown.overall) {
      list.push({
        key: 'overall',
        name: 'ODD OVERALL',
        data: Object.keys(breakdown.overall.current).reduce((acc, k) => {
          const val = breakdown.overall.current[k];
          const delta = breakdown.overall.deltas[k];
          acc[k] = {
            value: `${val.toFixed(1)}%`,
            delta: {
              value: `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}%`,
              dir: delta >= 0 ? 'up' : 'down'
            }
          };
          return acc;
        }, {})
      });
    }

    breakdown.platforms.forEach(p => {
      list.push({
        key: p.platform.toLowerCase(),
        name: p.platform.toUpperCase(),
        data: Object.keys(p.current).reduce((acc, k) => {
          const val = p.current[k];
          const delta = p.deltas[k];
          acc[k] = {
            value: `${val.toFixed(1)}%`,
            delta: {
              value: `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}%`,
              dir: delta >= 0 ? 'up' : 'down'
            }
          };
          return acc;
        }, {})
      });
    });

    return list;
  }, [breakdown]);

  const selectedKpis = crossPlatformKpiDefs;

  return (
      <SectionWrapper
          title="Cross Platform Overview"
          icon={BarChart3}
          chip={`${platformData.length} Entities × ${selectedKpis.length} KPIs`}
          headerRight={
              <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-[9px] text-emerald-600 bg-emerald-50/50 px-2 py-0.5 rounded-full font-bold border border-emerald-100/50 uppercase tracking-tight">
                          <span className="w-1 h-1 rounded-full bg-emerald-500"></span> Growth
                      </span>
                      <span className="flex items-center gap-1.5 text-[9px] text-rose-600 bg-rose-50/50 px-2 py-0.5 rounded-full font-bold border border-rose-100/50 uppercase tracking-tight">
                          <span className="w-1 h-1 rounded-full bg-rose-500"></span> Decline
                      </span>
                  </div>
              </div>
          }
      >
          <div className="overflow-x-auto no-scrollbar pb-2">
              <div className="min-w-max pb-2">
                  {/* Column Header Row */}
                  <div className="flex items-center gap-2 mb-4 px-1">
                      <div className="w-48 flex-shrink-0 sticky left-0 bg-white z-20 pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                          <span className="text-xs font-bold text-slate-900 uppercase tracking-[0.15em]">Entity</span>
                      </div>
                      {platformData.map(plat => (
                          <div
                              key={plat.key}
                              className={cn(
                                  'flex-1 text-center py-2 px-2 rounded-lg bg-white border border-slate-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]',
                                  crossSize.minW
                              )}
                          >
                              <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-[0.12em] whitespace-nowrap">
                                  {plat.name}
                              </div>
                          </div>
                      ))}
                  </div>

                  {/* Data Rows */}
                  <div className="space-y-3 px-1">
                      {selectedKpis.map((kpi) => (
                          <motion.div
                              key={kpi.key}
                              className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50/50 transition-colors"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3 }}
                          >
                              <div className="w-48 flex-shrink-0 flex items-center justify-between sticky left-0 bg-white z-20 pr-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] border-r border-slate-50">
                                  <span
                                      className="text-[11px] font-bold text-slate-600 whitespace-nowrap uppercase tracking-wide"
                                      style={{ fontFamily: 'Roboto, sans-serif' }}
                                  >
                                      {kpi.label}
                                  </span>
                                  <div className="flex items-center gap-1.5 ml-2">
                                      <button 
                                        onClick={() => onViewTrends(kpi.key)}
                                        className="p-1.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white transition-all duration-200 cursor-pointer border-none group"
                                        title="View Trends"
                                      >
                                          <TrendingUp size={14} className="group-hover:scale-110 transition-transform" />
                                      </button>
                                      <button 
                                        onClick={() => onViewInsights(kpi.key)}
                                        className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all duration-200 cursor-pointer border-none group"
                                        title="Key Insights"
                                      >
                                          <Activity size={14} className="group-hover:scale-110 transition-transform" />
                                      </button>
                                  </div>
                              </div>

                              {platformData.map(plat => {
                                  const cell = plat.data[kpi.key]
                                  const textColor = getStatusText(cell?.delta)
                                  const isUp = cell?.delta?.dir === 'up'
                                  const isNull = !cell || cell.value === '-'

                                  return (
                                      <motion.button
                                          key={plat.key}
                                          className={cn(
                                              'flex-1 px-3 rounded-xl text-center transition-all duration-200 relative overflow-hidden',
                                              'bg-gradient-to-br from-white to-slate-50',
                                              'border',
                                              isNull ? 'border-slate-100' : (isUp ? 'border-emerald-100' : 'border-rose-100'),
                                              'shadow-[0_4px_16px_rgba(0,0,0,0.04)]',
                                              'hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] hover:-translate-y-1',
                                              'active:scale-[0.98]',
                                              crossSize.minW, crossSize.py
                                          )}
                                          whileHover={{ scale: 1.02 }}
                                          whileTap={{ scale: 0.98 }}
                                      >
                                          {!isNull && (
                                            <div className={cn(
                                                'absolute inset-0 opacity-10 rounded-xl',
                                                isUp ? 'bg-gradient-to-br from-emerald-100 to-transparent' : 'bg-gradient-to-br from-rose-100 to-transparent'
                                            )} />
                                          )}
                                          <div className={cn('font-bold text-slate-900 tabular-nums relative z-10 leading-tight', crossSize.text)} style={{ fontFamily: 'Roboto, sans-serif' }}>
                                              {cell?.value}
                                          </div>
                                          {!isNull && (
                                            <div className={cn('font-bold flex items-center justify-center gap-0.5 mt-0.5 relative z-10 whitespace-nowrap', textColor, crossSize.delta)}>
                                                <span>{cell?.delta?.value}</span>
                                            </div>
                                          )}
                                      </motion.button>
                                  )
                              })}
                          </motion.div>
                      ))}
                  </div>
              </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                      <div className="h-6 w-6 rounded-lg bg-slate-900 flex items-center justify-center">
                          <TrendingUp size={14} className="text-white" />
                      </div>
                      <span className="text-slate-800 text-sm font-bold">
                          {platformData.reduce((sum, p) => sum + selectedKpis.filter(k => p.data[k.key]?.delta?.dir === 'up' && p.data[k.key]?.value !== '-').length, 0)}
                      </span>
                      <span className="text-slate-500 text-xs">positive</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                      <div className="h-6 w-6 rounded-lg bg-slate-400 flex items-center justify-center">
                          <TrendingDown size={14} className="text-white" />
                      </div>
                      <span className="text-slate-800 text-sm font-bold">
                          {platformData.reduce((sum, p) => sum + selectedKpis.filter(k => p.data[k.key]?.delta?.dir === 'down' && p.data[k.key]?.value !== '-').length, 0)}
                      </span>
                      <span className="text-slate-500 text-xs">negative</span>
                  </div>
              </div>
          </div>
      </SectionWrapper>
  )
}
