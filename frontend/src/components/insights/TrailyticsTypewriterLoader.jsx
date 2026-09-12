import { useState, useEffect, useRef } from "react";

const WORD = "trailytics";
const TYPE_SPEED = 100;    // ms per character typed
const HOLD_DURATION = 900; // ms to hold full word before deleting
const DELETE_SPEED = 60;   // ms per character deleted
const PAUSE_DURATION = 400; // ms pause before restarting

export default function TrailyticsTypewriterLoader({
  size = 1,
  message = "Fetching analytics...",
  fullscreen = false,
}) {
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState("typing"); // typing | holding | deleting | pausing
  const timeoutRef = useRef(null);

  useEffect(() => {
    const clear = () => clearTimeout(timeoutRef.current);

    if (phase === "typing") {
      if (displayed.length < WORD.length) {
        timeoutRef.current = setTimeout(() => {
          setDisplayed(WORD.slice(0, displayed.length + 1));
        }, TYPE_SPEED);
      } else {
        timeoutRef.current = setTimeout(() => setPhase("holding"), HOLD_DURATION);
      }
    }

    if (phase === "holding") {
      timeoutRef.current = setTimeout(() => setPhase("deleting"), 0);
    }

    if (phase === "deleting") {
      if (displayed.length > 0) {
        timeoutRef.current = setTimeout(() => {
          setDisplayed(displayed.slice(0, -1));
        }, DELETE_SPEED);
      } else {
        timeoutRef.current = setTimeout(() => setPhase("pausing"), PAUSE_DURATION);
      }
    }

    if (phase === "pausing") {
      timeoutRef.current = setTimeout(() => setPhase("typing"), 0);
    }

    return clear;
  }, [displayed, phase]);

  const s = size;

  const barH = [10 * s, 16 * s, 22 * s];
  const barW = 7 * s;
  const barGap = 3 * s;
  const arrowW = 12 * s;
  const arrowH = 18 * s;

  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 20 * s,
    ...(fullscreen
      ? {
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 9999,
        }
      : {}),
  };

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes tl-tw-barBounce {
          0%, 100% { transform: scaleY(1); }
          50%       { transform: scaleY(0.4); }
        }
        @keyframes tl-tw-caret {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes tl-tw-subFade {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        .tl-tw-b1 {
          animation: tl-tw-barBounce 0.8s ease-in-out infinite;
          animation-delay: 0s;
          transform-origin: bottom;
        }
        .tl-tw-b2 {
          animation: tl-tw-barBounce 0.8s ease-in-out infinite;
          animation-delay: 0.12s;
          transform-origin: bottom;
        }
        .tl-tw-b3 {
          animation: tl-tw-barBounce 0.8s ease-in-out infinite;
          animation-delay: 0.24s;
          transform-origin: bottom;
        }
        .tl-tw-caret {
          animation: tl-tw-caret 0.7s step-end infinite;
        }
        .tl-tw-sub {
          animation: tl-tw-subFade 2s ease-in-out infinite;
        }
      `}</style>

      {/* Logo row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8 * s,
        }}
      >
        {/* Bars */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: barGap,
          }}
        >
          {barH.map((h, i) => (
            <div
              key={i}
              className={`tl-tw-b${i + 1}`}
              style={{
                width: barW,
                height: h,
                background: "#E8364F",
                borderRadius: 2 * s,
              }}
            />
          ))}
        </div>

        {/* Arrow */}
        <svg
          width={arrowW}
          height={arrowH}
          viewBox="0 0 12 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <line
            x1="6" y1="17" x2="6" y2="2"
            stroke="#111" strokeWidth="2.5" strokeLinecap="round"
          />
          <polyline
            points="1,7 6,1 11,7"
            fill="none"
            stroke="#111"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>

        {/* Typewriter word + caret */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
          }}
        >
          <span
            style={{
              fontSize: 28 * s,
              fontWeight: 700,
              fontFamily: "'Georgia', 'Times New Roman', serif",
              color: "#111",
              letterSpacing: -0.5 * s,
              lineHeight: 1,
              minWidth: 0,
            }}
          >
            {displayed}
          </span>
          <span
            className="tl-tw-caret"
            style={{
              display: "inline-block",
              width: 2.5 * s,
              height: 28 * s,
              background: "#E8364F",
              borderRadius: 1,
              marginLeft: 2 * s,
              verticalAlign: "bottom",
            }}
          />
        </div>
      </div>

      {/* Subtitle */}
      {message && (
        <p
          className="tl-tw-sub"
          style={{
            margin: 0,
            fontSize: 12 * s,
            color: "#999",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 500,
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
