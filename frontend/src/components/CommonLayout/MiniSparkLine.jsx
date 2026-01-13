import { Box, Typography } from "@mui/material";
import { useState, useMemo } from "react";

export default function MiniSparkline({ months, values, color }) {
  const [hover, setHover] = useState(null);

  // Normalize values to fit within 20-80 range to prevent extreme positions
  const normalizedValues = useMemo(() => {
    if (!values || values.length === 0) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1; // Prevent division by zero

    // Normalize to 20-80 range (leaving room at top and bottom)
    return values.map(v => 20 + ((v - min) / range) * 60);
  }, [values]);

  const createSmoothPath = () => {
    if (normalizedValues.length === 0) return "";

    const points = normalizedValues.map((v, i) => ({
      x: (i / (normalizedValues.length - 1 || 1)) * 100,
      y: 100 - v, // Invert Y so higher values are at top
    }));

    let d = `M ${points[0].x},${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const cpX = (points[i - 1].x + points[i].x) / 2;
      d += ` Q ${cpX},${points[i - 1].y} ${points[i].x},${points[i].y}`;
    }

    return d;
  };

  if (!values || values.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        height: 50,
        position: "relative",
        mt: 2,
        mb: 1,
      }}
    >
      {/* SVG Graph Container - takes full height */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ overflow: "visible" }}
        >
          <path
            d={createSmoothPath()}
            fill="none"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </Box>

      {/* Dots Layer - positioned absolutely within the same container */}
      {/* Only show dots if we have a reasonable number of points (e.g., <= 40) to avoid clutter */}
      {normalizedValues.length <= 40 && normalizedValues.map((v, i) => {
        const x = (i / (normalizedValues.length - 1 || 1)) * 100;
        const y = 100 - v; // Same calculation as in createSmoothPath

        return (
          <Box key={i}>
            {/* Tooltip */}
            {hover === i && (
              <Box
                sx={{
                  position: "absolute",
                  left: `${x}%`,
                  bottom: `${v}%`,
                  transform: "translate(-50%, -100%)",
                  bgcolor: "white",
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  boxShadow: 2,
                  zIndex: 20,
                  whiteSpace: "nowrap",
                  mb: 1,
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: "0.65rem" }}>
                  {months[i]}: {values[i]?.toFixed?.(1) || values[i]}
                </Typography>
              </Box>
            )}

            {/* Dot */}
            <Box
              sx={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: hover === i ? 8 : 6,
                height: hover === i ? 8 : 6,
                borderRadius: "50%",
                backgroundColor: hover === i ? color : "white",
                border: `2px solid ${color}`,
                transform: "translate(-50%, -50%)",
                transition: "all 0.15s",
                cursor: "pointer",
                zIndex: 10,
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
