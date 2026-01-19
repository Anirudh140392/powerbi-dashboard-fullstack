import { Box, Typography } from "@mui/material";
import { useState } from "react";

export default function MiniSparkline({ months, values, color }) {
  const [hover, setHover] = useState(null);

  const createSmoothPath = () => {
    const points = values.map((v, i) => ({
      x: (i / (values.length - 1)) * 100,
      y: 100 - v,
    }));

    let d = `M ${points[0].x},${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const cpX = (points[i - 1].x + points[i].x) / 2;
      d += ` Q ${cpX},${points[i - 1].y} ${points[i].x},${points[i].y}`;
    }

    return d;
  };

  return (
    <Box mt={1.5} sx={{ height: 80, position: "relative" }}>
      <svg width="100%" height="100%" viewBox="0 0 100 110" preserveAspectRatio="none">
        <path
          d={createSmoothPath()}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Dots + Tooltip */}
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * 100;
        const y = 100 - v;

        return (
          <Box key={i}>
            {hover === i && (
              <Box
                sx={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${(y / 110) * 100 - 12}%`,
                  transform: "translate(-50%, -100%)",
                  bgcolor: "white",
                  px: 1.2,
                  py: 0.6,
                  borderRadius: 1.5,
                  boxShadow: 3,
                  zIndex: 5,
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {months[i]}
                </Typography>
                <Typography variant="caption" sx={{ display: "block", fontSize: "0.7rem" }}>
                  value: {v}
                </Typography>
              </Box>
            )}

            {/* Dot */}
            <Box
              sx={{
                position: "absolute",
                left: `${x}%`,
                top: `${(y / 110) * 100}%`,
                width: hover === i ? 10 : 8,
                height: hover === i ? 10 : 8,
                borderRadius: "50%",
                backgroundColor: hover === i ? color : "white",
                border: `2px solid ${color}`,
                transform: "translate(-50%, -50%)",
                transition: "all 0.2s",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </Box>
        );
      })}
    </Box>
  );
}
