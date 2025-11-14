import React from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography
} from "@mui/material";

export default function DataTableMUI({ rows }) {
  return (
    <TableContainer component={Paper} elevation={0}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell><Typography fontWeight={800}>Product Name</Typography></TableCell>
            <TableCell><Typography fontWeight={800}>Product Id</Typography></TableCell>
            <TableCell align="center"><Typography fontWeight={800}>Item Id</Typography></TableCell>
            <TableCell align="center"><Typography fontWeight={800}>OSA%</Typography></TableCell>
            <TableCell align="center"><Typography fontWeight={800}>Average ASP</Typography></TableCell>
            <TableCell align="center"><Typography fontWeight={800}>Average Discount%</Typography></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, idx) => (
            <TableRow key={idx} hover>
              <TableCell sx={{ maxWidth: 520 }}>
                <Typography sx={{ textDecoration: 'underline', color: '#164a80' }}>{r.productName}</Typography>
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>{r.productId}</TableCell>
              <TableCell align="center">{r.itemId}</TableCell>
              <TableCell align="center">{r.osa}</TableCell>
              <TableCell align="center">{r.asp}</TableCell>
              <TableCell align="center">{r.discount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
