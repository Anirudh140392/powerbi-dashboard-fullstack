import dayjs from "dayjs";

/**
 * Report schedule choices. They mirror backend/src/utils/reportScheduleTiming.js,
 * which decides when a schedule sends and which dates it covers. Times are IST.
 */
export const FREQUENCIES = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

// 1 = Monday … 7 = Sunday, as the backend counts them.
export const WEEKDAYS = [
    { value: 1, short: "Mon", label: "Monday" },
    { value: 2, short: "Tue", label: "Tuesday" },
    { value: 3, short: "Wed", label: "Wednesday" },
    { value: 4, short: "Thu", label: "Thursday" },
    { value: 5, short: "Fri", label: "Friday" },
    { value: 6, short: "Sat", label: "Saturday" },
    { value: 7, short: "Sun", label: "Sunday" },
];

export const DATE_WINDOWS = {
    yesterday: "Yesterday",
    last_7_days: "Last 7 days",
    last_week: "Last week (Mon–Sun)",
    month_to_date: "Month to date",
    last_month: "Last month",
};

/** The dates a new schedule covers until the user picks otherwise. */
export const DEFAULT_DATE_WINDOW = { daily: "yesterday", weekly: "last_week", monthly: "last_month" };

// The scheduler checks every 15 minutes, so finer times wouldn't be honoured.
export const SEND_TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

export const MAX_RECIPIENTS = 20;
export const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const ordinal = (n) => {
    const tens = n % 100;
    if (tens >= 11 && tens <= 13) return `${n}th`;
    return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
};

/** "Every Monday at 09:00 IST", "Daily at 07:30 IST", "Monthly on the 1st at 09:00 IST". */
export const describeSchedule = ({ frequency, dayOfWeek, dayOfMonth, sendTime }) => {
    const at = `at ${sendTime} IST`;
    if (frequency === "weekly") return `Every ${WEEKDAYS.find((d) => d.value === dayOfWeek)?.label || "week"} ${at}`;
    if (frequency === "monthly") return `Monthly on the ${dayOfMonth ? ordinal(dayOfMonth) : "—"} ${at}`;
    return `Daily ${at}`;
};

/** "Mon, 2 Nov · 09:00" from the backend's 'YYYY-MM-DD HH:mm'. */
export const formatSendTime = (value) => {
    if (!value) return "—";
    const [date, time] = value.split(" ");
    return `${dayjs(date).format("ddd, D MMM")} · ${time}`;
};
