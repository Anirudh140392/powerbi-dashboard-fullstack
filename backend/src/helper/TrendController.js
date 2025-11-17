export default class TrendController {
  generateData(months = 6, timeStep = "Monthly") {
    const dataPoints =
      timeStep === "Daily"
        ? months * 30
        : timeStep === "Weekly"
        ? months * 4
        : months;

    const data = [];
    const start = new Date();
    start.setMonth(start.getMonth() - months);

    for (let i = 0; i < dataPoints; i++) {
      const date = new Date(start);

      if (timeStep === "Daily") date.setDate(date.getDate() + i);
      else if (timeStep === "Weekly") date.setDate(date.getDate() + i * 7);
      else date.setMonth(date.getMonth() + i);

      data.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        offtake: 2.5 + Math.random() * 0.8 - 0.4,
        osa: 95 + Math.random() * 5,
        discount: 8 + Math.random() * 4,
        sov: 45 + Math.random() * 10,
      });
    }

    return data;
  }

  getMetrics(data) {
    const latest = data[data.length - 1];
    const prev = data[data.length - 2];

    return {
      offtake: {
        value: latest.offtake.toFixed(2) + " Cr",
        change: ((latest.offtake - prev.offtake) / prev.offtake * 100).toFixed(1),
      },
      osa: {
        value: "~" + latest.osa.toFixed(0) + "%",
        change: (latest.osa - prev.osa).toFixed(1),
      },
      discount: {
        value: latest.discount.toFixed(1) + "%",
        change: (latest.discount - prev.discount).toFixed(1),
      },
      sov: {
        value: latest.sov.toFixed(1) + "%",
        change: (latest.sov - prev.sov).toFixed(1),
      },
    };
  }
}
