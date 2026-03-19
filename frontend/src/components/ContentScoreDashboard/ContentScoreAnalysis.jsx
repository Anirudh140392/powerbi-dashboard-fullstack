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
  Select,
  MenuItem,
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
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';

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
  { platform: 'Blinkit', title: '81.08%', images: '100.00%', secondary: '93.24%', desc: '91.89%', rating: '' },
  { platform: 'Instamart', title: '97.22%', images: '97.22%', secondary: '78.33%', desc: '55.56%', rating: '' },
  { platform: 'zepto', title: '100.00%', images: '100.00%', secondary: '84.23%', desc: '51.35%', rating: '' },
  { platform: 'Big Basket', title: '100.00%', images: '97.50%', secondary: '94.17%', desc: '71.25%', rating: '52.50%' },
  { platform: 'Amazon', title: '84.62%', images: '94.87%', secondary: '94.02%', desc: '62.82%', rating: '69.23%' },
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
  { month: 'May 2025', title: 81.67, images: 82.90, secondary: 79.82, rating: 67.86 },
  { month: '', title: 81.35, images: 83.00, secondary: 80.00, rating: 67.03 },
  { month: 'Jun 2025', title: 86.25, images: 89.56, secondary: 83.25, rating: 72.11 },
  { month: 'Jul 2025', title: 89.31, images: 97.35, secondary: 87.09, rating: 75.86 },
  { month: '', title: 90.18, images: 98.21, secondary: 87.44, rating: 75.86 },
  { month: 'Sep 2025', title: 90.07, images: 97.33, secondary: 87.17, rating: 75.38 },
  { month: '', title: 89.88, images: 97.79, secondary: 88.18, rating: 72.33 },
  { month: 'Nov 2025', title: 90.76, images: 98.24, secondary: 89.88, rating: 67.52 },
  { month: '', title: 94.37, images: 97.40, secondary: 94.37, rating: 60.00 },
  { month: 'Jan 2026', title: 93.86, images: 98.28, secondary: 90.99, rating: 67.42 },
  { month: '', title: 93.18, images: 98.12, secondary: 90.34, rating: 68.85 },
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

const FilterBar = () => (
  <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 3 }}>
    <Box sx={{ bgcolor: 'white', p: 1.5, borderRadius: '8px', border: '1px solid #eaeaea', minWidth: 200 }}>
      <Typography variant="caption" sx={{ fontWeight: 600, color: '#333', mb: 0.5, display: 'block' }}>Platform</Typography>
      <Select size="small" fullWidth value="All" sx={{ '& .MuiSelect-select': { py: 0.8 }, color: '#555', fontSize: '0.9rem' }}>
        <MenuItem value="All">All</MenuItem>
        <MenuItem value="Instamart">Instamart</MenuItem>
        <MenuItem value="Blinkit">Blinkit</MenuItem>
      </Select>
    </Box>
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


// --- MAIN DEFAULT EXPORT ---
export default function ContentScoreAnalysis() {
  const [currentView, setCurrentView] = useState('main'); // 'main' | 'trends' | 'key_insights'
  const [selectedLines, setSelectedLines] = useState(['title', 'images', 'secondary', 'rating']);

  const toggleLine = (line) => {
    if (selectedLines.includes(line)) {
      if (selectedLines.length > 1) { // ensure at least one remains
        setSelectedLines(selectedLines.filter(l => l !== line));
      }
    } else {
      setSelectedLines([...selectedLines, line]);
    }
  };

  // ----- MAIN VIEW -----
  if (currentView === 'main') {
    return (
      <Box sx={{ p: { xs: 1, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3, bgcolor: '#f7f9fc', minHeight: '100vh', fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <ScoreCard title="Title Score" score="93.83" isGreen={true} />
          <ScoreCard title="Image Score" score="98.24" isGreen={true} />
          <ScoreCard title="SI Score" score="90.76" isGreen={true} />
          <ScoreCard title="Description Score" score="67.84" isGreen={false} />
          <ScoreCard title="Rating Score" score="67.52" isGreen={false} />
          <ScoreCard title="Overall Score" score="87.67" isGreen={true} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 'auto' }}>
            <Button variant="outlined" size="small" onClick={() => setCurrentView('trends')} sx={{ borderRadius: '20px', textTransform: 'none', color: '#555', borderColor: '#ccc', fontWeight: 600, px: 3 }}>
              View Trends
            </Button>
            <Button variant="outlined" size="small" onClick={() => setCurrentView('key_insights')} sx={{ borderRadius: '20px', textTransform: 'none', color: '#555', borderColor: '#ccc', fontWeight: 600, px: 3 }}>
              Key Insights
            </Button>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          <Card sx={{ flex: 1, borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #eaeaea' }}>
            <CardContent>
              <Typography variant="h6" sx={{ textAlign: 'center', fontWeight: 600, mb: 1, color: '#333' }}>Performance vs Benchmark</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: -2, ml: 2 }}>
                 <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#333', fontWeight: 500 }}>Axis</Typography>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#204d80', ml: 1 }} />
                    <Typography sx={{ fontSize: '0.75rem', color: '#333', fontWeight: 500 }}>Score</Typography>
                 </Box>
              </Box>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                    <PolarGrid stroke="#e0e0e0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#333', fontSize: 12, fontWeight: 500 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Score" dataKey="A" stroke="#2b5e94" fill="#678bbc" fillOpacity={0.5} dot={{ r: 4, fill: '#2b5e94' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1.2, borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #eaeaea' }}>
            <CardContent>
              <Typography variant="h6" sx={{ textAlign: 'center', fontWeight: 600, mb: 3, color: '#333' }}>Overall Score by Platform</Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaeaea" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#333', fontWeight: 500 }} axisLine={{ stroke: '#eaeaea' }} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 12, fill: '#333', fontWeight: 500 }} axisLine={{ stroke: '#eaeaea' }} tickLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} ticks={[0, 50, 100]} />
                    <Bar dataKey="score" fill="#204d80" radius={[0, 0, 0, 0]} barSize={50}>
                      <LabelList dataKey="score" position="top" formatter={(val) => `${val}%`} style={{ fontSize: '12px', fontWeight: 700, fill: '#333' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <TableContainer component={Paper} sx={{ borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #eaeaea', overflow: 'hidden' }}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#1d487b' }}>
                <TableCell sx={{ color: 'white', fontWeight: 600, py: 2, borderRight: '1px solid rgba(255,255,255,0.1)' }}>Platform</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 600, py: 2, borderRight: '1px solid rgba(255,255,255,0.1)' }}>Title Score</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 600, py: 2, borderRight: '1px solid rgba(255,255,255,0.1)' }}>Images Score</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 600, py: 2, borderRight: '1px solid rgba(255,255,255,0.1)' }}>Secondary Images Score</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 600, py: 2, borderRight: '1px solid rgba(255,255,255,0.1)' }}>Features & Benefits & Description Score</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 600, py: 2 }}>
                  Rating Score
                  <Box component="span" sx={{ ml: 0.5, fontSize: '0.8rem', verticalAlign: 'middle', color: '#fff' }}>▲</Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tableData.map((row, index) => (
                <TableRow key={index} sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { bgcolor: '#f5f7fa' } }}>
                  <TableCell sx={{ py: 2.5, borderRight: '1px solid #eaeaea', color: '#333', fontWeight: 500 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <AddBoxOutlinedIcon sx={{ fontSize: 18, color: '#aaa' }} />
                      {row.platform}
                    </Box>
                  </TableCell>
                  <TableCell align="center" sx={{ py: 2.5, borderRight: '1px solid #eaeaea', color: '#333' }}>{row.title}</TableCell>
                  <TableCell align="center" sx={{ py: 2.5, borderRight: '1px solid #eaeaea', color: '#333' }}>{row.images}</TableCell>
                  <TableCell align="center" sx={{ py: 2.5, borderRight: '1px solid #eaeaea', color: '#333' }}>{row.secondary}</TableCell>
                  <TableCell align="center" sx={{ py: 2.5, borderRight: '1px solid #eaeaea', color: '#333' }}>{row.desc}</TableCell>
                  <TableCell align="center" sx={{ py: 2.5, color: '#333' }}>{row.rating}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  }

  // ----- TRENDS VIEW -----
  if (currentView === 'trends') {
    return (
      <Box sx={{ p: { xs: 1, md: 3 }, display: 'flex', flexDirection: 'column', bgcolor: '#f7f9fc', minHeight: '100vh', mt: '-20px' }}>
        <HeaderControls title="TRENDS" onBack={() => setCurrentView('main')} />
        <FilterBar />
        
        <Card sx={{ flex: 1, borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #eaeaea', p: 3 }}>
          <Box sx={{ display: 'flex', gap: 3, mb: 1 }}>
            <Typography onClick={() => toggleLine('title')} variant="body2" sx={{ cursor: 'pointer', opacity: selectedLines.includes('title') ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 0.5, color: '#444', fontWeight: 600, fontSize: '0.8rem' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#4ca6ff' }} /> Title Score</Typography>
            <Typography onClick={() => toggleLine('images')} variant="body2" sx={{ cursor: 'pointer', opacity: selectedLines.includes('images') ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 0.5, color: '#444', fontWeight: 600, fontSize: '0.8rem' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#1d227b' }} /> Images Score</Typography>
            <Typography onClick={() => toggleLine('secondary')} variant="body2" sx={{ cursor: 'pointer', opacity: selectedLines.includes('secondary') ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 0.5, color: '#444', fontWeight: 600, fontSize: '0.8rem' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#db783b' }} /> Secondary Images Score</Typography>
            <Typography onClick={() => toggleLine('rating')} variant="body2" sx={{ cursor: 'pointer', opacity: selectedLines.includes('rating') ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 0.5, color: '#444', fontWeight: 600, fontSize: '0.8rem' }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#731475' }} /> Rating Score</Typography>
          </Box>
          <Box sx={{ height: 450, mt: 2 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendsData} margin={{ top: 20, right: 30, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaeaea" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#444', fontWeight: 500 }} axisLine={false} tickLine={false} dx={0} dy={10} />
                <YAxis tick={{ fontSize: 12, fill: '#444', fontWeight: 500 }} axisLine={false} tickLine={false} domain={[60, 100]} tickFormatter={(val) => `${val}%`} />
                {selectedLines.includes('title') && <Line type="monotone" dataKey="title" stroke="#4ca6ff" strokeWidth={2.5} dot={false} label={renderCustomLabel} activeDot={{ r: 6 }} />}
                {selectedLines.includes('images') && <Line type="monotone" dataKey="images" stroke="#1d227b" strokeWidth={2.5} dot={false} label={renderCustomLabel} activeDot={{ r: 6 }} />}
                {selectedLines.includes('secondary') && <Line type="monotone" dataKey="secondary" stroke="#db783b" strokeWidth={2.5} dot={false} label={renderCustomLabel} activeDot={{ r: 6 }} />}
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
        <HeaderControls title="KEY INSIGHTS" onBack={() => setCurrentView('main')} />
        <FilterBar />
        <StyledTable title="GAINERS" data={gainersData} />
        <StyledTable title="DRAINERS" data={drainersData} />
      </Box>
    );
  }

  return null;
}
