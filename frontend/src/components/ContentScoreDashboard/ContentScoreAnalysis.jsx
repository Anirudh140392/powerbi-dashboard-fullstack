import React, { useState } from 'react';
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
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import { ChevronDown, ChevronRight, SlidersHorizontal, TrendingUp, TrendingDown, BarChart3, Type, Image as LucideImage, CopyPlus, FileText, Star, PieChart, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SnapshotOverview from "../CommonLayout/SnapshotOverview";

// --- DATA: Main View ---
const radarData = [
  { subject: 'Image Score', A: 90, fullMark: 100 },
  { subject: 'Title Score', A: 85, fullMark: 100 },
  { subject: 'SI Score', A: 88, fullMark: 100 },
  { subject: 'Rating Score', A: 65, fullMark: 100 },
  { subject: 'Description Score', A: 60, fullMark: 100 },
  { subject: 'Overall Score', A: 85, fullMark: 100 },
];

const barData = [
  { name: 'Blinkit', score: 91.55 },
  { name: 'Flipkart\nNational', score: 90.96 },
  { name: 'zepto', score: 83.90 },
  { name: 'Big Basket', score: 83.08 },
  { name: 'Instamart', score: 82.08 },
  { name: 'Amazon', score: 81.11 },
];

const tableData = [
  { 
    platform: 'Blinkit', title: '81.08%', images: '100.00%', secondary: '93.24%', desc: '91.89%', rating: '',
    skus: [
      { name: 'Boomer Krunch Strawberry, 28.8g', title: '80.00%', images: '100.00%', secondary: '90.00%', desc: '91.00%', rating: '-' },
      { name: 'Galaxy Fruit & Nut Chocolate Bar', title: '82.16%', images: '100.00%', secondary: '96.48%', desc: '92.78%', rating: '-' }
    ]
  },
  { 
    platform: 'Instamart', title: '97.22%', images: '97.22%', secondary: '78.33%', desc: '55.56%', rating: '',
    skus: [
      { name: 'Snickers Peanut Brownie Chocolate Bar', title: '95.00%', images: '97.00%', secondary: '76.00%', desc: '50.00%', rating: '-' },
      { name: 'Orbit Spearmint Sugarfree Gums', title: '99.44%', images: '97.44%', secondary: '80.66%', desc: '61.12%', rating: '-' }
    ]
  },
  { platform: 'zepto', title: '100.00%', images: '100.00%', secondary: '84.23%', desc: '51.35%', rating: '', skus: [] },
  { platform: 'Big Basket', title: '100.00%', images: '97.50%', secondary: '94.17%', desc: '71.25%', rating: '52.50%', skus: [] },
  { platform: 'Amazon', title: '84.62%', images: '94.87%', secondary: '94.02%', desc: '62.82%', rating: '69.23%', skus: [] },
];

// --- DATA: Key Insights View ---
const gainersData = [
  { id: 'Q4VAVDUASQ', name: 'Boomer Krunch Strawberry Flavour Bubble Gum Tube, 28.8 g', score: '100.00%' },
  { id: 'Q4VAVDUASQ', name: 'Boomer Krunch, Strawberry flavour Chewing Gum, Tube', score: '65.00%' },
  { id: 'XGCB4OCRRM', name: 'Bounty Coconut Filled Chocolate Bar, Soft & Tender Coconut in the Centre, 57 g', score: '100.00%' },
  { id: 'XGCB4OCRRM', name: 'Bounty Soft & Tender Coconut Filled Chocolate Bar', score: '75.00%' },
  { id: 'A3BKYEZQZ4', name: 'Galaxy Fruit & Nut Chocolate Bar', score: '95.00%' },
];

const drainersData = [
  { id: '1HL5G1ZLEI', name: 'Snickers Peanut Brownie Chocolate Bar | Loaded with Brownie, Peanuts & Caramel', score: '100.00%' },
  { id: '1HL5G1ZLEI', name: 'Snickers Peanut Brownie Chocolate Bar, Filled with Brownie, Peanuts & Caramel, Rich & Chewy Chocolate Bar', score: '75.00%' },
  { id: '72ISV2KZGJ', name: 'Orbit Spearmint Sugarfree Chewing Gum Pot - 59.4g', score: '75.00%' },
  { id: '72ISV2KZGJ', name: 'Orbit Sugar Free Spearmint Chewing Gum Pot', score: '70.00%' },
  { id: '79EWR3CGTU', name: 'Snickers Berry Whip Chocolate Bar with Peanuts, Nougat & Caramel, 40g', score: '100.00%' },
];

// --- DATA: Trends View ---
const trendsData = [
  { month: 'May 2025', title: 81.67, images: 82.90, secondary: 79.82, rating: 67.86, overall: 84.12, description: 65.43 },
  { month: '', title: 81.35, images: 83.00, secondary: 80.00, rating: 67.03, overall: 84.05, description: 65.21 },
  { month: 'Jun 2025', title: 86.25, images: 89.56, secondary: 83.25, rating: 72.11, overall: 86.45, description: 68.32 },
  { month: 'Jul 2025', title: 89.31, images: 97.35, secondary: 87.09, rating: 75.86, overall: 89.12, description: 72.15 },
  { month: '', title: 90.18, images: 98.21, secondary: 87.44, rating: 75.86, overall: 89.85, description: 72.88 },
  { month: 'Sep 2025', title: 90.07, images: 97.33, secondary: 87.17, rating: 75.38, overall: 89.65, description: 72.45 },
  { month: '', title: 89.88, images: 97.79, secondary: 88.18, rating: 72.33, overall: 89.45, description: 71.98 },
  { month: 'Nov 2025', title: 90.76, images: 98.24, secondary: 89.88, rating: 67.52, overall: 90.12, description: 69.56 },
  { month: '', title: 94.37, images: 97.40, secondary: 94.37, rating: 60.00, overall: 92.45, description: 66.82 },
  { month: 'Jan 2026', title: 93.86, images: 98.28, secondary: 90.99, rating: 67.42, overall: 91.55, description: 67.84 },
  { month: '', title: 93.18, images: 98.12, secondary: 90.34, rating: 68.85, overall: 91.22, description: 67.55 },
];

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

const HeaderControls = ({ title, onBack }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center', width: '100%' }}>
    {/* Override title area for sub-views */}
    <Typography variant="h5" sx={{ fontWeight: 800, color: '#1d487b', textTransform: 'uppercase' }}>
      MARS <span style={{ fontWeight: 600, fontSize: '1.2rem', color: '#1d487b' }}>CONTENT ANALYSIS ({title})</span>
    </Typography>
    <IconButton onClick={onBack} sx={{ bgcolor: 'white', border: '2px solid #555', borderRadius: '50%', '&:hover': { bgcolor: '#f0f0f0' } }}>
      <ArrowBackOutlinedIcon sx={{ color: '#555' }} />
    </IconButton>
  </Box>
);



const StyledTable = ({ title, data }) => (
  <Card sx={{ borderRadius: '12px', mb: 3, boxShadow: '0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #eaeaea' }}>
    <CardContent sx={{ p: '0 !important' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 800, p: 2, pb: 1, color: '#333' }}>
        {title}
      </Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, color: '#111', py: 1, borderBottom: '2px solid #bde0ff', width: '20%' }}>Product ID</TableCell>
            <TableCell sx={{ fontWeight: 700, color: '#111', py: 1, borderBottom: '2px solid #bde0ff', width: '60%' }}>SKU Name</TableCell>
            <TableCell sx={{ fontWeight: 700, color: '#111', py: 1, borderBottom: '2px solid #bde0ff', width: '20%', textAlign: 'right' }}>Overall Score</TableCell>
            <TableCell sx={{ p: 0, width: '10px', borderBottom: '2px solid #bde0ff' }}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={index}>
              <TableCell sx={{ py: 1.5, color: '#333', fontWeight: 600 }}>{row.id}</TableCell>
              <TableCell sx={{ py: 1.5, color: '#444' }}>{row.name}</TableCell>
              <TableCell sx={{ py: 1.5, color: '#333', fontWeight: 600, textAlign: 'right' }}>{row.score}</TableCell>
              <TableCell sx={{ p: 0, py: 1.5, pr: 2 }}>
                {index === 0 && <Box sx={{ width: 8, height: 20, bgcolor: '#ccc', borderRadius: 4, ml: 'auto' }} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
  const [currentView, setCurrentView] = useState('main'); // 'main' | 'trends' | 'key_insights'
  const [selectedLines, setSelectedLines] = useState(['overall', 'title', 'images', 'secondary', 'description', 'rating']);
  const [selectedKpi, setSelectedKpi] = useState('overallScore');

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
  const platformRows = tableData.map(row => {
    const barItem = barData.find(b => b.name.replace('\n', ' ') === row.platform.replace('\n', ' ')) || { score: 0 };
    return {
      name: row.platform.replace('\n', ' '),
      titleScore: parsePercent(row.title),
      imagesScore: parsePercent(row.images),
      secondaryScore: parsePercent(row.secondary),
      descScore: parsePercent(row.desc),
      ratingScore: parsePercent(row.rating),
      overallScore: barItem.score
    };
  });

  // ----- MAIN VIEW -----
  if (currentView === 'main') {
    return (
      <Box sx={{ p: { xs: 1, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3, bgcolor: '#f7f9fc', minHeight: '100vh', fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        <SnapshotOverview
          title="Content Analysis Overview"
          icon={Activity}
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
            { id: 'title', title: 'Title Score', value: '93.83%', subtitle: 'Title Quality', delta: 1.5, deltaLabel: '▲ 1.5%', icon: Type, gradient: ['#10b981', '#34d399'], trendSeries: [90, 92, 91, 93, 93.83] },
            { id: 'image', title: 'Image Score', value: '98.24%', subtitle: 'Hero images', delta: 0.8, deltaLabel: '▲ 0.8%', icon: LucideImage, gradient: ['#10b981', '#34d399'], trendSeries: [96, 96, 97, 98, 98.24] },
            { id: 'si', title: 'SI Score', value: '90.76%', subtitle: 'Secondary images', delta: 1.2, deltaLabel: '▲ 1.2%', icon: CopyPlus, gradient: ['#10b981', '#34d399'], trendSeries: [88, 89, 89, 90, 90.76] },
            { id: 'desc', title: 'Description Score', value: '67.84%', subtitle: 'Product details', delta: -3.4, deltaLabel: '▼ 3.4%', icon: FileText, gradient: ['#f43f5e', '#fb7185'], trendSeries: [70, 71, 71.24, 70.82, 67.84] },
            { id: 'rating', title: 'Rating Score', value: '67.52%', subtitle: 'Consumer ratings', delta: -0.4, deltaLabel: '▼ 0.4%', icon: Star, gradient: ['#f43f5e', '#fb7185'], trendSeries: [68, 67.8, 67.9, 67.5, 67.52] },
            { id: 'overall', title: 'Overall Score', value: '87.67%', subtitle: 'Aggregate health', delta: 2.1, deltaLabel: '▲ 2.1%', icon: PieChart, gradient: ['#6366f1', '#8b5cf6'], trendSeries: [84, 85, 85.5, 86.2, 87.67] }
          ]}
        />

        <Box sx={{ mb: 2 }}>
          <ContentCrossPlatformOverview 
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
          <PlatformPerformanceStudio rows={platformRows} />
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
                 <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow transition-all cursor-pointer">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Filters</span>
                 </button>
                 <div className="flex items-center gap-2 ml-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Healthy
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700 border border-amber-100">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Watch
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-rose-700 border border-rose-100">
                        <span className="h-2 w-2 rounded-full bg-rose-500" /> Action
                    </span>
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
                          {tableData.map((row, index) => (
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
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#444', fontWeight: 500 }} axisLine={false} tickLine={false} dx={0} dy={10} />
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
        <HeaderControls title={`KEY INSIGHTS - ${selectedKpi ? crossPlatformKpiDefs.find(k => k.key === selectedKpi)?.label : 'OVERALL'}`} onBack={() => setCurrentView('main')} />
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
    { key: "overallScore", label: "Overall Score", activeValue: active.overallScore, compareValue: compare?.overallScore, max: 100, format: (v) => `${v}%` },
    { key: "titleScore", label: "Title Score", activeValue: active.titleScore, compareValue: compare?.titleScore, max: 100, format: (v) => `${v}%` },
    { key: "imagesScore", label: "Images Score", activeValue: active.imagesScore, compareValue: compare?.imagesScore, max: 100, format: (v) => `${v}%` },
    { key: "secondaryScore", label: "Secondary Images Score", activeValue: active.secondaryScore, compareValue: compare?.secondaryScore, max: 100, format: (v) => `${v}%` },
    { key: "descScore", label: "Description Score", activeValue: active.descScore, compareValue: compare?.descScore, max: 100, format: (v) => `${v}%` },
    { key: "ratingScore", label: "Rating Score", activeValue: active.ratingScore, compareValue: compare?.ratingScore, max: 100, format: (v) => `${v}%` },
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
                    <div className={`text-[10px] ${isActive ? `text-${scoreColor}-600` : 'text-slate-500'}`}>Overall Score {f.overallScore}%</div>
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
                <div className="text-lg font-semibold">{active.overallScore}%</div>
                {compare && (
                  <div className={`mt-1 text-[10px] ${active.overallScore >= compare.overallScore ? 'text-emerald-500' : 'text-rose-500'}`}>
                    Delta {(active.overallScore - compare.overallScore).toFixed(1)}% vs {compare.name}
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
                  <div className="text-lg font-semibold">{active.overallScore}%</div>
                  {compare && <div className="text-[9px] text-violet-600 mt-0.5">vs {compare.overallScore}%</div>}
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

// --- CROSS PLATFORM OVERVIEW (STATIC) ---
const cn = (...classes) => classes.filter(Boolean).join(' ');

const crossPlatformKpiDefs = [
  { key: 'overallScore', label: 'Overall Score' },
  { key: 'titleScore', label: 'Title Score' },
  { key: 'imageScore', label: 'Image Score' },
  { key: 'siScore', label: 'SI Score' },
  { key: 'descScore', label: 'Description Score' },
  { key: 'ratingScore', label: 'Rating Score' },
];

const crossPlatformEntities = [
  { key: 'odd_overall', name: 'ODD OVERALL' },
  { key: 'blinkit', name: 'BLINKIT' },
  { key: 'flipkart', name: 'FLIPKART NAT.' },
  { key: 'zepto', name: 'ZEPTO' },
  { key: 'bigbasket', name: 'BIG BASKET' },
  { key: 'instamart', name: 'INSTAMART' },
  { key: 'amazon', name: 'AMAZON' },
];

const crossPlatformHardcodedData = [
  {
      key: 'odd_overall', name: 'ODD OVERALL',
      data: {
          overallScore: { value: '87.67%', delta: { value: '▲ 2.1%', dir: 'up' } },
          titleScore: { value: '93.83%', delta: { value: '▲ 1.5%', dir: 'up' } },
          imageScore: { value: '98.24%', delta: { value: '▲ 0.8%', dir: 'up' } },
          siScore: { value: '90.76%', delta: { value: '▼ 1.2%', dir: 'down' } },
          descScore: { value: '67.84%', delta: { value: '▼ 3.4%', dir: 'down' } },
          ratingScore: { value: '67.52%', delta: { value: '▲ 0.4%', dir: 'up' } },
      }
  },
  {
      key: 'blinkit', name: 'BLINKIT',
      data: {
          overallScore: { value: '91.55%', delta: { value: '▲ 1.3%', dir: 'up' } },
          titleScore: { value: '81.08%', delta: { value: '▼ 2.1%', dir: 'down' } },
          imageScore: { value: '100.00%', delta: { value: '▲ 0.0%', dir: 'up' } },
          siScore: { value: '93.24%', delta: { value: '▲ 4.1%', dir: 'up' } },
          descScore: { value: '91.89%', delta: { value: '▲ 2.8%', dir: 'up' } },
          ratingScore: { value: '-', delta: { value: '-', dir: 'up' } },
      }
  },
  {
      key: 'flipkart', name: 'FLIPKART NAT.',
      data: {
          overallScore: { value: '90.96%', delta: { value: '▲ 0.5%', dir: 'up' } },
          titleScore: { value: '95.00%', delta: { value: '▲ 2.3%', dir: 'up' } },
          imageScore: { value: '90.00%', delta: { value: '▼ 1.1%', dir: 'down' } },
          siScore: { value: '85.00%', delta: { value: '▲ 0.4%', dir: 'up' } },
          descScore: { value: '80.00%', delta: { value: '▼ 0.8%', dir: 'down' } },
          ratingScore: { value: '90.00%', delta: { value: '▲ 1.2%', dir: 'up' } },
      }
  },
  {
      key: 'zepto', name: 'ZEPTO',
      data: {
          overallScore: { value: '83.90%', delta: { value: '▼ 5.2%', dir: 'down' } },
          titleScore: { value: '100.00%', delta: { value: '▲ 0.0%', dir: 'up' } },
          imageScore: { value: '100.00%', delta: { value: '▲ 0.0%', dir: 'up' } },
          siScore: { value: '84.23%', delta: { value: '▼ 2.4%', dir: 'down' } },
          descScore: { value: '51.35%', delta: { value: '▼ 8.9%', dir: 'down' } },
          ratingScore: { value: '-', delta: { value: '-', dir: 'up' } },
      }
  },
  {
      key: 'bigbasket', name: 'BIG BASKET',
      data: {
          overallScore: { value: '83.08%', delta: { value: '▲ 1.1%', dir: 'up' } },
          titleScore: { value: '100.00%', delta: { value: '▲ 0.0%', dir: 'up' } },
          imageScore: { value: '97.50%', delta: { value: '▲ 0.5%', dir: 'up' } },
          siScore: { value: '94.17%', delta: { value: '▲ 3.2%', dir: 'up' } },
          descScore: { value: '71.25%', delta: { value: '▼ 4.5%', dir: 'down' } },
          ratingScore: { value: '52.50%', delta: { value: '▼ 1.1%', dir: 'down' } },
      }
  },
  {
      key: 'instamart', name: 'INSTAMART',
      data: {
          overallScore: { value: '82.08%', delta: { value: '▼ 1.5%', dir: 'down' } },
          titleScore: { value: '97.22%', delta: { value: '▲ 2.5%', dir: 'up' } },
          imageScore: { value: '97.22%', delta: { value: '▲ 1.4%', dir: 'up' } },
          siScore: { value: '78.33%', delta: { value: '▼ 6.2%', dir: 'down' } },
          descScore: { value: '55.56%', delta: { value: '▼ 3.1%', dir: 'down' } },
          ratingScore: { value: '-', delta: { value: '-', dir: 'up' } },
      }
  },
  {
      key: 'amazon', name: 'AMAZON',
      data: {
          overallScore: { value: '81.11%', delta: { value: '▲ 0.8%', dir: 'up' } },
          titleScore: { value: '84.62%', delta: { value: '▼ 1.2%', dir: 'down' } },
          imageScore: { value: '94.87%', delta: { value: '▲ 0.9%', dir: 'up' } },
          siScore: { value: '94.02%', delta: { value: '▲ 2.1%', dir: 'up' } },
          descScore: { value: '62.82%', delta: { value: '▼ 4.4%', dir: 'down' } },
          ratingScore: { value: '69.23%', delta: { value: '▲ 3.6%', dir: 'up' } },
      }
  }
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

const ContentCrossPlatformOverview = ({ onViewTrends, onViewInsights }) => {
  const platformData = crossPlatformHardcodedData;
  const selectedKpis = crossPlatformKpiDefs;

  return (
      <SectionWrapper
          title="Cross Platform Overview"
          icon={BarChart3}
          chip={`${crossPlatformEntities.length} Platforms × ${selectedKpis.length} KPIs`}
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
                      {crossPlatformEntities.map(plat => (
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
