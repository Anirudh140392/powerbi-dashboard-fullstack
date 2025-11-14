import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area } from "recharts";
import { Box } from "@mui/material";

/**
 * Small interactive chart using Recharts.
 * We create sample time series — you can replace with real timeseries later.
 */
const sampleSeries = {
  offtake: [
    { date: "Jul", val: 40 }, { date: "Aug", val: 55 }, { date: "Sep", val: 48 }, { date: "Oct", val: 60 }
  ],
  share: [
    { date: "Jul", val: 30 }, { date: "Aug", val: 34 }, { date: "Sep", val: 33 }, { date: "Oct", val: 36 }
  ],
  stock: [
    { date: "Jul", val: 58 }, { date: "Aug", val: 59 }, { date: "Sep", val: 57 }, { date: "Oct", val: 58 }
  ],
  market: [
    { date: "Wk29", val: 40 }, { date: "Wk31", val: 39 }, { date: "Wk33", val: 41 }, { date: "Wk41", val: 40 }
  ]
};

export default function ChartBoxInteractive({ variant = "offtake" }) {
  const data = sampleSeries[variant] || sampleSeries.offtake;
  return (
    <Box sx={{ width: "100%", height: 100 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <defs>
            <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2ca4ff" stopOpacity={0.6}/>
              <stop offset="95%" stopColor="#2ca4ff" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis hide />
          <Tooltip />
          <Area type="monotone" dataKey="val" stroke="#2ca4ff" fill="url(#colorUv)" />
          <Line type="monotone" dataKey="val" stroke="#2ca4ff" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
