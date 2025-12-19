import React from "react";

/**
 * Simplified RCA Icon
 * Pure bulb design for a cleaner "insight" look.
 * Default color set to Pure Black (#000000).
 */
export function LightbulbCogRCAIcon({ size = 64, color = "#000000", glow = "#fde68a" }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ overflow: "visible" }}
        >
            {/* Intense Glow - Centered on Bulb */}
            <circle
                cx="32"
                cy="30"
                r="20"
                fill={glow}
                opacity="0.3"
                className="bulb-glow-extra"
            />

            {/* Extra Bold Bulb - Centered */}
            <path
                d="M16 30C16 21.1634 23.1634 14 32 14C40.8366 14 48 21.1634 48 30C48 36.2 44.5 41.6 39.4 44.3C37.8 45.1 37.3 46.4 37.3 48V51.5H26.7V48C26.7 46.4 26.2 45.1 24.6 44.3C19.5 41.6 16 36.2 16 30Z"
                stroke={color}
                strokeWidth="4"
                strokeLinejoin="round"
            />

            {/* Heavy Bulb base */}
            <path
                d="M26.7 51.5H37.3M28.7 57H35.3"
                stroke={color}
                strokeWidth="4"
                strokeLinecap="round"
            />

            <style>{`
        .bulb-glow-extra {
          animation: glowPulseExtreme 2.5s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes glowPulseExtreme {
          0% { opacity: 0.2; transform: scale(0.9); }
          50% { opacity: 0.6; transform: scale(1.15); }
          100% { opacity: 0.2; transform: scale(0.9); }
        }
      `}</style>
        </svg>
    );
}
