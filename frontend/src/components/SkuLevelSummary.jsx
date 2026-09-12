import React, { useState } from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Paper, Box, Tabs, Tab, IconButton
} from "@mui/material";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function SkuLevelSummary() {
  const [dateView, setDateView] = useState(2); // 0: Month-Year, 1: Week, 2: Date
  const [kpiView, setKpiView] = useState(2); // 0: MRP, 1: Offtakes, 2: OSA%, 3: Discount%
  const [expandedRows, setExpandedRows] = useState({});

  // Hardcoded data with more rows for scrolling
  const rows = [
    {
      productId: "02EB9EF2-DEB9-433E-B19F-813C5BFD440A",
      product: "Colgate Kids Cocomelon Toothpaste for 2-5 Years - 80gm, 50% Lesser Abrasive Tooth Paste Formula for Cavity Protection with Milk Teeth (Strawberry Flavour)",
      itemId: 0,
      dates: ["85.21%", "84.05%", "85.21%", "86.77%", "84.44%", "86.77%", "86.38%", "85.60%"],
    },
    {
      productId: "03442E85-1CD2-4376-900D-745BABB68B94",
      product: "Colgate Total Sensitive 150gm Toothpaste, Antibacterial Tooth paste, Whole Mouth Health, World's No. 1* Germ-fighting Toothpaste (with a Premium Soft Toothbrush)",
      itemId: 0,
      dates: ["66.54%", "64.59%", "64.98%", "64.98%", "61.09%", "62.65%", "57.98%", "56.03%"],
    },
    {
      productId: "04c38eee-3870-4a28-994e-272b3aed8174",
      product: "Colgate Maxfresh Antibacterial Mouthwash, 24/7 Fresh Breath - Fresh Tea, 144ml (12ml x 12) (Pack of 12)",
      itemId: 0,
      dates: ["23.74%", "26.07%", "27.63%", "25.68%", "24.51%", "26.85%", "27.63%", "27.24%"],
    },
    {
      productId: "0516c3ad-ac58-44fb-a021-",
      product: "Palmolive Aroma Absolute Relax Body Wash for Women & Men, 250ml Shower Gel Single Bottle, 100% Natural Ylang Ylang Essential Oil & Iris Extracts for a Smooth Skin, pH Balanced Bodywash, Free of Parabens & Silicones",
      itemId: 0,
      dates: ["14.40%", "14.40%", "14.40%", "14.40%", "14.01%", "14.40%", "14.79%", "14.40%"],
    },
    {
      productId: "05A1B2C3-D4E5-6789-ABCD-EF0123456789",
      product: "Colgate Visible White Toothpaste - 200gm, Teeth Whitening Formula, Removes Stains",
      itemId: 0,
      dates: ["72.15%", "71.89%", "73.21%", "74.05%", "72.90%", "73.44%", "71.67%", "72.33%"],
    },
    {
      productId: "06B2C3D4-E5F6-7890-BCDE-F01234567890",
      product: "Pepsodent Germicheck Toothpaste 150g - 12 Hour Germ Protection, Fresh Breath",
      itemId: 0,
      dates: ["68.23%", "67.45%", "69.12%", "68.90%", "67.78%", "68.55%", "69.34%", "68.01%"],
    },
    {
      productId: "07C3D4E5-F6G7-8901-CDEF-012345678901",
      product: "Sensodyne Rapid Relief Toothpaste 80gm - Clinically Proven Sensitivity Relief",
      itemId: 0,
      dates: ["55.67%", "56.23%", "54.89%", "55.34%", "56.78%", "55.12%", "54.45%", "55.90%"],
    },
    {
      productId: "08D4E5F6-G7H8-9012-DEFG-123456789012",
      product: "Closeup Red Hot Gel Toothpaste 150g - Long Lasting Fresh Breath, Fights Germs",
      itemId: 0,
      dates: ["45.32%", "46.78%", "45.90%", "46.23%", "45.67%", "46.45%", "45.12%", "46.01%"],
    },
    {
      productId: "09E5F6G7-H8I9-0123-EFGH-234567890123",
      product: "Oral-B Pro-Health Toothpaste 140g - Prevents Cavities, Strengthens Enamel",
      itemId: 0,
      dates: ["78.90%", "79.34%", "78.56%", "79.12%", "78.23%", "79.67%", "78.45%", "79.01%"],
    },
    {
      productId: "10F6G7H8-I9J0-1234-FGHI-345678901234",
      product: "Himalaya Complete Care Toothpaste 175g - Natural Ingredients, Herbal Protection",
      itemId: 0,
      dates: ["62.45%", "63.12%", "62.78%", "63.45%", "62.90%", "63.23%", "62.56%", "63.01%"],
    },
  ];

  const dateColumns = [
    "08-10-25",
    "07-10-25",
    "06-10-25",
    "05-10-25",
    "04-10-25",
    "03-10-25",
    "02-10-25",
    "01-10-25",
  ];

  const toggleRow = (idx) => {
    setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <Box>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2,
        gap: 2,
        flexWrap: 'wrap'
      }}>
        {/* Title and Date View Selector */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <Box sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#111827' }}>
            SKU Level Summary
          </Box>
          <Box sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#6b7280' }}>
            *Select Date View from here:
          </Box>
        </Box>

        {/* Date View Tabs */}
        <Box sx={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 1, overflow: 'hidden' }}>
          <Box
            onClick={() => setDateView(0)}
            sx={{
              px: 3,
              py: 1,
              cursor: 'pointer',
              bgcolor: dateView === 0 ? '#ffffff' : '#f9fafb',
              color: dateView === 0 ? '#111827' : '#6b7280',
              fontWeight: 600,
              fontSize: '0.875rem',
              borderRight: '1px solid #e5e7eb',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: dateView === 0 ? '#ffffff' : '#f3f4f6' }
            }}
          >
            Month-Year
          </Box>
          <Box
            onClick={() => setDateView(1)}
            sx={{
              px: 3,
              py: 1,
              cursor: 'pointer',
              bgcolor: dateView === 1 ? '#ffffff' : '#f9fafb',
              color: dateView === 1 ? '#111827' : '#6b7280',
              fontWeight: 600,
              fontSize: '0.875rem',
              borderRight: '1px solid #e5e7eb',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: dateView === 1 ? '#ffffff' : '#f3f4f6' }
            }}
          >
            Week
          </Box>
          <Box
            onClick={() => setDateView(2)}
            sx={{
              px: 3,
              py: 1,
              cursor: 'pointer',
              bgcolor: dateView === 2 ? '#1f2937' : '#f9fafb',
              color: dateView === 2 ? '#ffffff' : '#6b7280',
              fontWeight: 600,
              fontSize: '0.875rem',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: dateView === 2 ? '#1f2937' : '#f3f4f6' }
            }}
          >
            Date
          </Box>
        </Box>
      </Box>

      {/* KPI Selector */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2, 
        mb: 2,
        flexWrap: 'wrap'
      }}>
        <Box sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#6b7280' }}>
          *Select KPI from here:
        </Box>
        <Box sx={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 1, overflow: 'hidden' }}>
          <Box
            onClick={() => setKpiView(0)}
            sx={{
              px: 3,
              py: 1,
              cursor: 'pointer',
              bgcolor: kpiView === 0 ? '#ffffff' : '#f9fafb',
              color: kpiView === 0 ? '#111827' : '#6b7280',
              fontWeight: 600,
              fontSize: '0.875rem',
              borderRight: '1px solid #e5e7eb',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: kpiView === 0 ? '#ffffff' : '#f3f4f6' }
            }}
          >
            MRP
          </Box>
          <Box
            onClick={() => setKpiView(1)}
            sx={{
              px: 3,
              py: 1,
              cursor: 'pointer',
              bgcolor: kpiView === 1 ? '#ffffff' : '#f9fafb',
              color: kpiView === 1 ? '#111827' : '#6b7280',
              fontWeight: 600,
              fontSize: '0.875rem',
              borderRight: '1px solid #e5e7eb',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: kpiView === 1 ? '#ffffff' : '#f3f4f6' }
            }}
          >
            Offtakes
          </Box>
          <Box
            onClick={() => setKpiView(2)}
            sx={{
              px: 3,
              py: 1,
              cursor: 'pointer',
              bgcolor: kpiView === 2 ? '#1f2937' : '#f9fafb',
              color: kpiView === 2 ? '#ffffff' : '#6b7280',
              fontWeight: 600,
              fontSize: '0.875rem',
              borderRight: '1px solid #e5e7eb',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: kpiView === 2 ? '#1f2937' : '#f3f4f6' }
            }}
          >
            OSA%
          </Box>
          <Box
            onClick={() => setKpiView(3)}
            sx={{
              px: 3,
              py: 1,
              cursor: 'pointer',
              bgcolor: kpiView === 3 ? '#ffffff' : '#f9fafb',
              color: kpiView === 3 ? '#111827' : '#6b7280',
              fontWeight: 600,
              fontSize: '0.875rem',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: kpiView === 3 ? '#ffffff' : '#f3f4f6' }
            }}
          >
            Discount%
          </Box>
        </Box>
      </Box>

      {/* Table */}
      <TableContainer 
        component={Paper} 
        sx={{ 
          maxHeight: 500, 
          overflowY: 'auto',
          border: '1px solid #e5e7eb',
          boxShadow: 'none',
          '&::-webkit-scrollbar': {
            width: 8
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#f3f4f6'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#cbd5e1',
            borderRadius: 4,
            '&:hover': {
              backgroundColor: '#94a3b8'
            }
          }
        }}
      >
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ 
                fontWeight: 700, 
                bgcolor: '#f9fafb',
                borderBottom: '2px solid #e5e7eb',
                fontSize: '0.875rem',
                color: '#111827',
                minWidth: 40
              }}></TableCell>
              <TableCell sx={{ 
                fontWeight: 700, 
                bgcolor: '#f9fafb',
                borderBottom: '2px solid #e5e7eb',
                fontSize: '0.875rem',
                color: '#111827',
                minWidth: 180
              }}>
                Product Id
              </TableCell>
              <TableCell sx={{ 
                fontWeight: 700, 
                bgcolor: '#f9fafb',
                borderBottom: '2px solid #e5e7eb',
                fontSize: '0.875rem',
                color: '#111827',
                minWidth: 350
              }}>
                Product
              </TableCell>
              <TableCell sx={{ 
                fontWeight: 700, 
                bgcolor: '#f9fafb',
                borderBottom: '2px solid #e5e7eb',
                fontSize: '0.875rem',
                color: '#111827',
                textAlign: 'center',
                minWidth: 80
              }}>
                Item Id
              </TableCell>

              {dateColumns.map((date) => (
                <TableCell key={date} sx={{ 
                  fontWeight: 700, 
                  bgcolor: '#f9fafb',
                  borderBottom: '2px solid #e5e7eb',
                  fontSize: '0.875rem',
                  color: '#111827',
                  textAlign: 'center',
                  minWidth: 100
                }}>
                  {date}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row, idx) => (
              <TableRow 
                key={idx}
                sx={{
                  '&:hover': { bgcolor: '#f9fafb' },
                  '&:last-child td': { borderBottom: 0 }
                }}
              >
                <TableCell sx={{ 
                  fontSize: '0.813rem',
                  color: '#374151',
                  borderBottom: '1px solid #f3f4f6',
                  padding: '12px 8px'
                }}>
                  <IconButton 
                    size="small" 
                    onClick={() => toggleRow(idx)}
                    sx={{ padding: 0 }}
                  >
                    {expandedRows[idx] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </IconButton>
                </TableCell>
                <TableCell sx={{ 
                  fontSize: '0.813rem',
                  color: '#374151',
                  borderBottom: '1px solid #f3f4f6',
                  fontFamily: 'monospace'
                }}>
                  {row.productId}
                </TableCell>
                <TableCell sx={{ 
                  fontSize: '0.813rem',
                  color: '#374151',
                  borderBottom: '1px solid #f3f4f6'
                }}>
                  {row.product}
                </TableCell>
                <TableCell sx={{ 
                  fontSize: '0.813rem',
                  color: '#374151',
                  borderBottom: '1px solid #f3f4f6',
                  textAlign: 'center'
                }}>
                  {row.itemId}
                </TableCell>

                {row.dates.map((val, i) => (
                  <TableCell key={i} sx={{ 
                    fontSize: '0.813rem',
                    color: '#374151',
                    borderBottom: '1px solid #f3f4f6',
                    textAlign: 'center',
                    fontWeight: 600
                  }}>
                    {val}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
