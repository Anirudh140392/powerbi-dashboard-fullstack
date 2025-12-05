import { Card, CardContent, Typography, Box } from "@mui/material";
import MiniSparkline from "./MiniSparkline";

const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];

const generateValues = () => months.map(() => Math.floor(Math.random() * 60) + 20);

export default function MetricCard({ card, scrollNeeded, totalCards }) {
  const values = generateValues();
  const positive = card.change.includes("▲") || card.change.includes("+");
  const color = positive ? "#28a745" : "#dc3545";

  return (
    <Card
      sx={{
        flexShrink: 0,
        width: scrollNeeded ? 250 : `${100 / Math.min(totalCards, 5) - 1}%`,
        borderRadius: 3,
        scrollSnapAlign: "start",
        transition: "0.25s",
        "&:hover": { transform: "translateY(-5px)", boxShadow: 6 },
      }}
    >
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {card.title}
        </Typography>

        <Typography variant="h5" fontWeight={600}>
          {card.value}{" "}
          <Typography component="span" color="text.secondary">
            {card.sub}
          </Typography>
        </Typography>

        <Typography variant="body2" sx={{ color: card.changeColor, mt: 1 }}>
          {card.change}{" "}
          <Typography component="span" color="text.secondary">
            {card.prevText}
          </Typography>
        </Typography>

        {card.extra && (
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {card.extra}{" "}
            <span style={{ color: card.extraChangeColor }}>
              {card.extraChange}
            </span>
          </Typography>
        )}

        {/* Sparkline */}
        <MiniSparkline months={months} values={values} color={color} />
      </CardContent>
    </Card>
  );
}
