import dayjs from "dayjs";

export default class TrendController {
  
  // Utility to generate random values
  random(min, max) {
    return Math.random() * (max - min) + min;
  }

  // ⭐ Main Data Generator — EXACT Required Logic
  generateData(months = 1, timeStep = "Daily") {
    const today = dayjs();
    const start = today.subtract(months, "month");

    const data = [];
    let cursor = start;

    if (timeStep === "Daily") {
      // ✔ All dates inside the period
      while (cursor.isBefore(today) || cursor.isSame(today)) {
        data.push({
          date: cursor.format("DD MMM"), // Example: 01 Jun
          offtake: this.random(1.5, 3.5),
          osa: this.random(70, 95),
          discount: this.random(5, 15),
          sov: this.random(20, 45),
        });

        cursor = cursor.add(1, "day");
      }
    }

    else if (timeStep === "Weekly") {
      // ✔ Week start dates
      cursor = cursor.startOf("week");

      while (cursor.isBefore(today) || cursor.isSame(today)) {
        data.push({
          date: cursor.format("DD MMM"), // Example: 03 Jun
          offtake: this.random(1.5, 3.5),
          osa: this.random(70, 95),
          discount: this.random(5, 15),
          sov: this.random(20, 45),
        });

        cursor = cursor.add(1, "week");
      }
    }

    else if (timeStep === "Monthly") {
      // ✔ 1 point per month
      cursor = cursor.startOf("month");

      while (cursor.isBefore(today) || cursor.isSame(today)) {
        data.push({
          date: cursor.format("MMM YYYY"), // Example: June 2025
          offtake: this.random(1.5, 3.5),
          osa: this.random(70, 95),
          discount: this.random(5, 15),
          sov: this.random(20, 45),
        });

        cursor = cursor.add(1, "month");
      }
    }

    return data;
  }

  // ⭐ Metrics Summary
  getMetrics(data) {
    const latest = data[data.length - 1];
    const prev = data.length > 1 ? data[data.length - 2] : latest;

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
