import React, { useState } from "react";
import {
    Box,
    Drawer,
    Avatar,
    Typography,
    IconButton,
    Card,
    CardContent,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
} from "@mui/material";
import {
    TrendingUp,
    NavigateBefore,
    NavigateNext,
    Close,
    OpenInNew,
} from "@mui/icons-material";

export default function PricingRcaDrawer({ entityName, dimensionType, onClose }) {
    const [showAllCities, setShowAllCities] = useState(false);

    if (!entityName) return null;

    // Mock data for Pricing RCA
    const mockCities = [
        {
            name: "Mumbai",
            discount: "15.2%",
            discountChange: "+2.1%",
            pricePerUnit: "₹185.00",
            priceChange: "-₹10.50",
            rpi: "4.8",
            rpiChange: "+0.3",
            asp: "₹192.00",
            aspChange: "+₹5.00"
        },
        {
            name: "Delhi",
            discount: "12.8%",
            discountChange: "-1.2%",
            pricePerUnit: "₹192.50",
            priceChange: "+₹5.20",
            rpi: "4.2",
            rpiChange: "-0.1",
            asp: "₹205.00",
            aspChange: "+₹12.00"
        },
        {
            name: "Bengaluru",
            discount: "14.5%",
            discountChange: "+3.5%",
            pricePerUnit: "₹178.00",
            priceChange: "-₹15.00",
            rpi: "5.1",
            rpiChange: "+0.6",
            asp: "₹188.00",
            aspChange: "-₹2.50"
        },
        {
            name: "Hyderabad",
            discount: "11.2%",
            discountChange: "+0.5%",
            pricePerUnit: "₹198.00",
            priceChange: "+₹2.00",
            rpi: "3.9",
            rpiChange: "+0.1",
            asp: "₹210.00",
            aspChange: "+₹8.00"
        }
    ];

    const displayedCities = showAllCities
        ? mockCities
        : mockCities.slice(0, 2);

    return (
        <Drawer
            anchor="right"
            open={Boolean(entityName)}
            onClose={onClose}
            PaperProps={{
                sx: { width: 920 },
            }}
        >
            <Box sx={{ p: 3 }}>
                {/* Header */}
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "start",
                        mb: 3,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Avatar
                            sx={{
                                width: 40,
                                height: 40,
                                bgcolor: "primary.light",
                                borderRadius: 2,
                            }}
                        >
                            <TrendingUp sx={{ fontSize: 24, color: "white" }} />
                        </Avatar>
                        <Box>
                            <Typography variant="h6" fontWeight={700}>
                                Pricing Analysis RCA
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Detailed insights for {entityName} ({dimensionType})
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <IconButton onClick={onClose} size="small">
                            <Close />
                        </IconButton>
                    </Box>
                </Box>

                {/* Info Card */}
                <Card
                    sx={{
                        background: "linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%)",
                        mb: 3,
                        border: '1px solid',
                        borderColor: 'primary.100',
                        borderRadius: 3
                    }}
                >
                    <CardContent>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                            <Chip
                                label={`Top Insights: ${entityName}`}
                                size="small"
                                sx={{
                                    bgcolor: "primary.main",
                                    color: "white",
                                    fontWeight: "bold",
                                }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                Period: MTD vs Previous Month
                            </Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary" uppercase sx={{ tracking: 1, fontWeight: 700 }}>Avg Discount</Typography>
                                <Typography variant="h5" fontWeight={700} color="primary.main">12.4%</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" uppercase sx={{ tracking: 1, fontWeight: 700 }}>Avg Price</Typography>
                                <Typography variant="h5" fontWeight={700} color="primary.main">₹185.50</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" uppercase sx={{ tracking: 1, fontWeight: 700 }}>Overall RPI</Typography>
                                <Typography variant="h5" fontWeight={700} color="primary.main">4.25</Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>

                {/* Table */}
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.75rem', py: 2, color: 'text.secondary', textTransform: 'uppercase' } }}>
                                <TableCell>City</TableCell>
                                <TableCell align="right">Discount %</TableCell>
                                <TableCell align="right">Average selling price</TableCell>
                                <TableCell align="right">RPI</TableCell>
                                <TableCell align="right">ASP</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {displayedCities.map((city, idx) => (
                                <TableRow key={idx} hover sx={{ '& td': { py: 2 } }}>
                                    <TableCell>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            <Typography variant="body2" fontWeight={600}>
                                                {city.name}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2" fontWeight={700}>
                                            {city.discount}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontWeight: 600,
                                                color: city.discountChange.includes("-") ? "error.main" : "success.main",
                                            }}
                                        >
                                            {city.discountChange}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2" fontWeight={700}>
                                            {city.pricePerUnit}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontWeight: 600,
                                                color: city.priceChange.includes("-") ? "success.main" : "error.main", // Price drop is usually good for sales
                                            }}
                                        >
                                            {city.priceChange}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2" fontWeight={700} >
                                            {city.rpi}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontWeight: 600,
                                                color: city.rpiChange.includes("-") ? "error.main" : "success.main",
                                            }}
                                        >
                                            {city.rpiChange}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2" fontWeight={700}>
                                            {city.asp}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontWeight: 600,
                                                color: city.aspChange.includes("-") ? "error.main" : "success.main",
                                            }}
                                        >
                                            {city.aspChange}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                {mockCities.length > 2 && (
                    <Button
                        onClick={() => setShowAllCities(!showAllCities)}
                        sx={{
                            mt: 2,
                            textTransform: "none",
                            fontWeight: 600,
                            "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
                        }}
                    >
                        {showAllCities ? "− Show Less Cities" : `+ Show All ${mockCities.length} Cities`}
                    </Button>
                )}
            </Box>
        </Drawer>
    );
}
