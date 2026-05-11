import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronRight, ChevronLeft, Sparkles, AlertTriangle,
    BarChart3, BadgePercent, Truck, Radar, MousePointerClick,
    Megaphone, MapPin, Store, Package, Eye,
    ArrowRightLeft, Target, Layers, TrendingUp, Zap, Table2, Bot
} from "lucide-react";

const STORAGE_KEY = "insights_tour_v9";
const DD_KEY = "insights_dd_tour_v7";

const STEPS = [
    { target: ".dynamic-insights-bar", title: "AI Insight Engine", description: "Your automated command center. MARS continuously scans millions of retail data points — pricing, availability, market share, ad performance — and surfaces the highest-impact opportunities here every day.", icon: Sparkles, iconColor: "#8b5cf6" },
    { target: ".tour-active-signals", title: "Active Signals Counter", description: "This badge shows the total number of live insights currently flagged across all categories. Each signal represents a specific, actionable opportunity or risk that requires your attention.", icon: Target, iconColor: "#10b981" },
    { target: ".tour-total-opportunity", title: "Total Opportunity Value", description: "The cumulative revenue impact of all active signals, expressed in INR. Use this metric to prioritize — higher values mean bigger bottom-line impact if you act.", icon: TrendingUp, iconColor: "#3b82f6" },
    { target: ".tour-card-share-headroom-hotspots", title: "Share Headroom Hotspots", description: "Identifies product-location combinations where your market share has room to grow. Each row shows the offtake loss impact — the revenue you're missing because competitors are capturing demand you could serve.", icon: BarChart3, iconColor: "#4a6fa5" },
    { target: ".tour-card-price-parity-radar", title: "Price Parity Radar", description: "Monitors your pricing vs. every competitor in real-time. When you're priced higher than the category average or a key rival, this signal quantifies the revenue at risk from price-sensitive shoppers switching.", icon: BadgePercent, iconColor: "#3d7a8a" },
    { target: ".tour-card-replenishment-breaks", title: "Replenishment Breaks", description: "Detects SKU-warehouse pairs where replenishment has stalled — low fill rates, delayed purchase orders, or forecasting mismatches. Each row shows the excess inventory or stockout cost so you can act before shelves go empty.", icon: Truck, iconColor: "#6b5ea8" },
    { target: ".tour-card-competitor-osa-weak-spots", title: "Competitor OSA Weak Spots", description: "Strategic intelligence showing where your competitors have availability issues. These are windows of opportunity — when a rival is out of stock, their shoppers need an alternative. That alternative should be you.", icon: Radar, iconColor: "#3a7d68" },
    { target: ".tour-card-remove-ad-low-osa", title: "Remove Ad Low OSA", description: "Flags products where you're spending ad budget but the product has poor on-shelf availability. Running ads on out-of-stock items wastes spend and frustrates shoppers. This signal helps you reallocate budget instantly.", icon: Megaphone, iconColor: "#8a6a3d" },
    { target: ".tour-card-keyword-efficiency-and-budget-caps", title: "Keyword Efficiency & Budget Caps", description: "Analyzes your search ad keywords by conversion rate and spend efficiency. Surfaces keywords that are burning budget without converting, and identifies high-performers that are being held back by budget caps.", icon: Zap, iconColor: "#8a6a3d" },
    { target: ".tour-card-surplus-stock", title: "Surplus Stock", description: "Surfaces SKU-location pairs sitting with excessive days of inventory. Each row shows the excess inventory value — capital that's tied up and at risk of expiry or markdowns. Use this to plan clearance or inter-warehouse transfers.", icon: Package, iconColor: "#6b5ea8" },
    { target: ".tour-card-prioritise-po", title: "Prioritise PO", description: "Ranks incoming purchase orders by projected sales velocity and current stock levels. Helps your supply chain team focus on the POs that will have the biggest impact on preventing lost sales.", icon: Truck, iconColor: "#8a4a6b" },
    { target: ".tour-card-transfer-issue", title: "Transfer Issue", description: "Flags friction points in inter-warehouse stock transfers — delayed shipments, routing inefficiencies, or mismatched inventory levels between locations that could be balanced.", icon: ArrowRightLeft, iconColor: "#5a7a4e" },
    { target: ".tour-card-new-market-entry", title: "New Market Entry", description: "Identifies promising new territories by analyzing competitor performance, demand density, and distribution gaps. Shows where competitors are generating revenue in markets you haven't entered yet.", icon: MapPin, iconColor: "#4a6b8a" },
    { target: ".tour-card-dark-store-coverage-gaps", title: "Dark Store Coverage Gaps", description: "Specifically monitors quick-commerce availability. Dark stores have rapid turnover — even small gaps in coverage can mean significant lost sales in high-velocity urban markets.", icon: Store, iconColor: "#7c3aed" },
    { target: ".tour-card-new-dark-store-expansion", title: "New Dark Store Expansion", description: "Recommends locations for new dark store deployments based on demand heatmaps, competitor dark store density, and delivery radius optimization.", icon: Store, iconColor: "#6d28d9" },
];

const DD_STEPS = [
    { target: ".modal-header-title-text", title: "Signal Header", description: "Shows the insight type and category. The KPI badges summarize the key metrics at a glance — fill rate, match percentage, and the total revenue impact of this signal.", icon: Eye, iconColor: "#6366f1" },
    { target: ".dynamic-insights-bar", title: "AI Prescription Bar", description: "MARS's AI engine provides a one-line prescription — a plain-English summary of the most important action to take based on this signal's evidence data.", icon: Bot, iconColor: "#8b5cf6" },
    { target: ".modal-body-container", title: "Evidence Table", description: "The full evidence dataset powering this signal. Each row represents a specific product-location-competitor combination with granular metrics. You can sort, filter, and export this data for deeper analysis.", icon: Table2, iconColor: "#3b82f6" },
];

// ─── Styles ─────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.t-overlay-path { fill: rgba(15,23,42,0.45); }

.t-pop {
  position: fixed; z-index: 100001; width: 320px; max-width: calc(100vw - 32px);
  font-family: 'Inter', sans-serif; pointer-events: auto;
  opacity: 0; transform: translateY(-6px) scale(0.98);
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(.4,0,.2,1), left 0.3s cubic-bezier(.4,0,.2,1), top 0.3s cubic-bezier(.4,0,.2,1);
}
.t-pop.t-vis { opacity: 1; transform: translateY(0) scale(1); }
.t-pop.t-up { transform: translateY(6px) scale(0.98); }
.t-pop.t-up.t-vis { transform: translateY(0) scale(1); }

.t-card {
  background: rgba(255,255,255,0.72);
  backdrop-filter: blur(48px) saturate(180%);
  -webkit-backdrop-filter: blur(48px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.6);
  border-radius: 16px; overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06),
    inset 0 1px 0 rgba(255,255,255,0.5);
  animation: t-float 4s ease-in-out infinite;
}

@keyframes t-float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-3px); }
  100% { transform: translateY(0px); }
}

@keyframes t-pulse-ring {
  0% { stroke-width: 1.5; opacity: 0.4; }
  50% { stroke-width: 4; opacity: 0.9; }
  100% { stroke-width: 1.5; opacity: 0.4; }
}

.t-pulse-ring {
  animation: t-pulse-ring 2.5s ease-in-out infinite;
}

.t-bar { height: 3px; background: linear-gradient(90deg,#818cf8,#c084fc); transition: width 0.3s ease; }

.t-body { padding: 16px 18px 12px; display: flex; gap: 14px; align-items: flex-start; }

.t-icon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(0,0,0,0.04);
}

.t-title { margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; line-height: 1.3; }
.t-desc { margin: 5px 0 0; font-size: 12.5px; color: #475569; line-height: 1.55; font-weight: 450; }

.t-foot {
  padding: 10px 18px 14px; display: flex; align-items: center; justify-content: space-between;
  border-top: 1px solid rgba(15,23,42,0.06);
}

.t-step { font-size: 11px; font-weight: 600; color: #94a3b8; }

.t-btn { border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; font-family: inherit; transition: all 0.15s; }

.t-next {
  background: #0f172a; color: #fff; padding: 6px 16px; border-radius: 8px;
  font-size: 12px; font-weight: 700; box-shadow: 0 2px 8px rgba(15,23,42,0.15);
}
.t-next:hover { background: #1e293b; transform: translateY(-1px); }

.t-back {
  background: rgba(15,23,42,0.04); border: 1px solid rgba(15,23,42,0.08);
  color: #64748b; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 600;
}
.t-back:hover { background: rgba(15,23,42,0.08); }

.t-arrow {
  position: absolute; width: 16px; height: 8px; left: 50%;
  transform: translateX(-50%); pointer-events: none;
}
.t-arrow-b { top: -7px; }
.t-arrow-t { bottom: -7px; }

.t-welcome-bg {
  position: fixed; inset: 0; z-index: 100000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(15,23,42,0.35); backdrop-filter: blur(20px);
  padding: 24px; font-family: 'Inter', sans-serif;
}
.t-welcome {
  width: 380px; max-width: 100%; text-align: center;
  background: rgba(255,255,255,0.72); backdrop-filter: blur(48px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.6); border-radius: 20px;
  padding: 36px; color: #0f172a;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5);
}
.t-welcome h2 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #0f172a; }
.t-welcome p { font-size: 14px; color: #64748b; margin: 10px 0 28px; line-height: 1.6; }

.t-wbtns { display: flex; gap: 10px; }
.t-wskip {
  flex: 1; padding: 11px; border-radius: 10px; cursor: pointer;
  border: 1px solid rgba(15,23,42,0.08); background: rgba(15,23,42,0.03);
  color: #64748b; font-weight: 600; font-size: 13px; font-family: inherit;
}
.t-wgo {
  flex: 2; padding: 11px; border-radius: 10px; border: none; cursor: pointer;
  background: #0f172a; color: #fff; font-weight: 700; font-size: 13px; font-family: inherit;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  box-shadow: 0 4px 12px rgba(15,23,42,0.15); transition: all 0.15s;
}
.t-wgo:hover { background: #1e293b; transform: translateY(-1px); }

.t-confirm-bg {
  position: fixed; inset: 0; z-index: 100002;
  display: flex; align-items: center; justify-content: center;
  background: rgba(15,23,42,0.4); backdrop-filter: blur(16px);
  padding: 24px; font-family: 'Inter', sans-serif;
}
.t-confirm {
  width: 340px; max-width: 100%; text-align: center;
  background: rgba(255,255,255,0.8); backdrop-filter: blur(48px);
  border: 1px solid rgba(255,255,255,0.6); border-radius: 18px;
  padding: 28px 32px; color: #0f172a;
  box-shadow: 0 20px 40px rgba(0,0,0,0.12);
}
.t-confirm h3 { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #0f172a; }
.t-confirm p { font-size: 13px; color: #64748b; margin: 0 0 20px; line-height: 1.5; }
.t-cbtns { display: flex; gap: 10px; }
.t-cleave {
  flex: 1; padding: 10px; border-radius: 10px; cursor: pointer;
  border: 1px solid #fecaca; background: #fef2f2;
  color: #dc2626; font-weight: 600; font-size: 13px; font-family: inherit;
}
.t-cstay {
  flex: 1.5; padding: 10px; border-radius: 10px; border: none; cursor: pointer;
  background: #0f172a; color: #fff; font-weight: 700; font-size: 13px; font-family: inherit;
  box-shadow: 0 2px 8px rgba(15,23,42,0.15);
}
`;

function injectCSS() {
    if (document.getElementById("tcss9")) return;
    const s = document.createElement("style"); s.id = "tcss9"; s.textContent = CSS;
    document.head.appendChild(s);
}

// ─── Spotlight ──────────────────────────────────────────────────────────────

const Spotlight = ({ rect, onOverlayClick }) => {
    const [d, setD] = useState("");
    useEffect(() => {
        if (!rect) { setD(""); return; }
        const W = window.innerWidth, H = window.innerHeight, p = 8, r = 14;
        const { x, y, width: w, height: h } = rect;
        setD(`M0 0h${W}v${H}H0Z M${x-p+r} ${y-p} h${w+p*2-r*2} a${r} ${r} 0 0 1 ${r} ${r} v${h+p*2-r*2} a${r} ${r} 0 0 1 -${r} ${r} h-${w+p*2-r*2} a${r} ${r} 0 0 1 -${r} -${r} v-${h+p*2-r*2} a${r} ${r} 0 0 1 ${r} -${r}Z`);
    }, [rect]);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 100000, pointerEvents: "none" }}>
            <svg width="100%" height="100%" style={{ position: "absolute" }} onClick={onOverlayClick}>
                <motion.path d={d} fillRule="evenodd" className="t-overlay-path"
                    initial={false} animate={{ d }}
                    transition={{ type: "spring", stiffness: 400, damping: 40 }}
                    style={{ pointerEvents: "auto" }} />
                {rect && (
                    <motion.rect
                        className="t-pulse-ring"
                        initial={false}
                        animate={{
                            x: rect.x - 9,
                            y: rect.y - 9,
                            width: rect.width + 18,
                            height: rect.height + 18
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 40 }}
                        rx={15} ry={15}
                        fill="none" stroke="rgba(255,255,255,0.6)"
                    />
                )}
            </svg>
        </motion.div>
    );
};

// ─── Tooltip ────────────────────────────────────────────────────────────────

function usePos(ref, targetRect, stepIndex) {
    const [pos, setPos] = useState(null);
    const prevStep = useRef(stepIndex);

    useEffect(() => {
        if (!targetRect) return;
        let dead = false;
        // Use a short delay only on the first render or step change to let DOM settle
        const delay = prevStep.current !== stepIndex ? 60 : 10;
        prevStep.current = stepIndex;
        const t = setTimeout(() => {
            if (dead || !ref.current) return;
            const ttW = ref.current.offsetWidth || 320;
            const ttH = ref.current.offsetHeight || 160;
            const vw = window.innerWidth, vh = window.innerHeight, gap = 14, pad = 16;
            const side = (targetRect.y + targetRect.height + ttH + gap + pad > vh) ? "top" : "bottom";
            let top = side === "bottom" ? targetRect.y + targetRect.height + gap : targetRect.y - ttH - gap;
            let left = targetRect.x + targetRect.width / 2 - ttW / 2;
            left = Math.max(pad, Math.min(left, vw - ttW - pad));
            top = Math.max(pad, Math.min(top, vh - ttH - pad));
            let ax = targetRect.x + targetRect.width / 2 - left;
            ax = Math.max(24, Math.min(ax, ttW - 24));
            if (!dead) setPos({ top, left, side, ax });
        }, delay);
        return () => { dead = true; clearTimeout(t); };
    }, [targetRect, stepIndex]);
    return pos;
}

const Tooltip = ({ step, stepIndex, totalSteps, targetRect, onNext, onPrev, onSkip }) => {
    const ref = useRef(null);
    const pos = usePos(ref, targetRect, stepIndex);
    
    // Delay text update to match movement
    const [displayStep, setDisplayStep] = useState(step);
    const [displayIndex, setDisplayIndex] = useState(stepIndex);
    const [isFading, setIsFading] = useState(false);
    
    useEffect(() => {
        if (displayIndex === stepIndex) {
            setDisplayStep(step);
            setIsFading(false);
            return;
        }
        
        setIsFading(true);
        const t = setTimeout(() => {
            setDisplayStep(step);
            setDisplayIndex(stepIndex);
            setIsFading(false);
        }, 150); // Fade out during the first half of the slide, then fade in with new text
        
        return () => clearTimeout(t);
    }, [step, stepIndex, displayIndex]);

    const Icon = displayStep.icon;
    const last = displayIndex === totalSteps - 1;
    const af = "rgba(255,255,255,0.72)", as = "rgba(255,255,255,0.6)";
    
    return (
        <div ref={ref}
            className={`t-pop ${pos ? "t-vis" : ""} ${pos?.side === "top" ? "t-up" : ""}`}
            style={{ left: pos ? pos.left : -9999, top: pos ? pos.top : -9999 }}
            onClick={e => e.stopPropagation()}>
            {pos && (
                <div className={`t-arrow ${pos.side === "bottom" ? "t-arrow-b" : "t-arrow-t"}`}
                    style={{ left: pos.ax, transform: "translateX(-50%)" }}>
                    <svg width="16" height="8" viewBox="0 0 16 8">
                        <path d={pos.side === "bottom" ? "M0 8 L8 0 L16 8" : "M0 0 L8 8 L16 0"} fill={af} stroke={as} strokeWidth="1" />
                    </svg>
                </div>
            )}
            <div className="t-card">
                <div className="t-bar" style={{ width: `${((displayIndex + 1) / totalSteps) * 100}%` }} />
                <div className="t-body" style={{ opacity: isFading ? 0 : 1, transform: isFading ? 'translateY(4px)' : 'translateY(0)', transition: "all 0.15s ease-in-out" }}>
                    <div className="t-icon" style={{ background: `${displayStep.iconColor}12` }}>
                        {Icon && <Icon size={16} color={displayStep.iconColor} strokeWidth={2.5} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 className="t-title">{displayStep.title}</h3>
                        <p className="t-desc">{displayStep.description}</p>
                    </div>
                </div>
                <div className="t-foot" style={{ opacity: isFading ? 0 : 1, transform: isFading ? 'translateY(4px)' : 'translateY(0)', transition: "all 0.15s ease-in-out" }}>
                    <span className="t-step">{displayIndex + 1} / {totalSteps}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                        {displayIndex > 0 && (
                            <button className="t-btn t-back" onClick={onPrev}><ChevronLeft size={14} /></button>
                        )}
                        <button className="t-btn t-next" onClick={last ? onSkip : onNext}>
                            {last ? "Done" : "Next"} {!last && <ChevronRight size={14} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Confirm Dialog ─────────────────────────────────────────────────────────

const ConfirmExit = ({ onLeave, onStay }) => (
    <motion.div className="t-confirm-bg"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="t-confirm"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 35 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fef3c7", margin: "0 auto 14px",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={20} color="#d97706" />
            </div>
            <h3>End tour early?</h3>
            <p>You can always restart it from the help menu later.</p>
            <div className="t-cbtns">
                <button className="t-cleave" onClick={onLeave}>End Tour</button>
                <button className="t-cstay" onClick={onStay}>Continue</button>
            </div>
        </motion.div>
    </motion.div>
);

// ─── Welcome ────────────────────────────────────────────────────────────────

const Welcome = ({ onStart, onSkip }) => (
    <motion.div className="t-welcome-bg"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="t-welcome"
            initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16,
                background: "linear-gradient(135deg,#6366f1,#a855f7)",
                margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 24px rgba(99,102,241,0.25)" }}>
                <Sparkles size={26} color="#fff" />
            </div>
            <h2>Welcome to Insights</h2>
            <p>Take a quick tour to learn how MARS turns raw data into actionable, revenue-driving opportunities across your entire retail landscape.</p>
            <div className="t-wbtns">
                <button className="t-wskip" onClick={onSkip}>Maybe Later</button>
                <button className="t-wgo" onClick={onStart}>Start Tour <ChevronRight size={18} /></button>
            </div>
        </motion.div>
    </motion.div>
);

// ─── Tour Engine ────────────────────────────────────────────────────────────

const InsightsOnboardingTour = ({ enabled = true }) => {
    const [phase, setPhase] = useState("idle"); // idle | welcome | touring | confirm | done
    const [step, setStep] = useState(0);
    const [rect, setRect] = useState(null);

    useEffect(() => { injectCSS(); }, []);

    useEffect(() => {
        if (!enabled || localStorage.getItem(STORAGE_KEY)) return;
        const t = setTimeout(() => setPhase("welcome"), 800);
        return () => clearTimeout(t);
    }, [enabled]);

    const measure = useCallback(() => {
        const s = STEPS[step];
        if (!s) return;
        const el = document.querySelector(s.target);
        if (el) {
            const r = el.getBoundingClientRect();
            setRect({ x: r.x, y: r.y, width: r.width, height: r.height });
        }
    }, [step]);

    useEffect(() => {
        if (phase !== "touring") return;
        const s = STEPS[step];
        const el = document.querySelector(s?.target);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            const t1 = setTimeout(measure, 100);
            const t2 = setTimeout(measure, 400);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        } else if (step < STEPS.length - 1) {
            setStep(i => i + 1);
        } else {
            finish();
        }
    }, [phase, step, measure]);

    useEffect(() => {
        if (phase !== "touring") return;
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, { passive: true });
        return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure); };
    }, [phase, measure]);

    const finish = useCallback(() => {
        setPhase("done");
        localStorage.setItem(STORAGE_KEY, "true");
    }, []);

    const handleOverlayClick = useCallback(() => {
        setPhase("confirm");
    }, []);

    return (
        <AnimatePresence>
            {phase === "welcome" && (
                <Welcome key="w" onStart={() => { setStep(0); setPhase("touring"); }} onSkip={finish} />
            )}
            {(phase === "touring" || phase === "confirm") && (
                <div key="t">
                    <Spotlight rect={rect} onOverlayClick={handleOverlayClick} />
                    <Tooltip step={STEPS[step]} stepIndex={step}
                        totalSteps={STEPS.length} targetRect={rect}
                        onNext={() => step < STEPS.length - 1 ? setStep(i => i + 1) : finish()}
                        onPrev={() => setStep(i => i - 1)} onSkip={finish} />
                </div>
            )}
            {phase === "confirm" && (
                <ConfirmExit key="c" onLeave={finish} onStay={() => setPhase("touring")} />
            )}
        </AnimatePresence>
    );
};

export const DrillDownTour = ({ enabled = true }) => {
    const [phase, setPhase] = useState("idle");
    const [step, setStep] = useState(0);
    const [rect, setRect] = useState(null);
    const [confirm, setConfirm] = useState(false);

    useEffect(() => { injectCSS(); }, []);

    useEffect(() => {
        if (!enabled || localStorage.getItem(DD_KEY)) return;
        const t = setTimeout(() => setPhase("touring"), 600);
        return () => clearTimeout(t);
    }, [enabled]);

    const measure = useCallback(() => {
        const s = DD_STEPS[step];
        if (!s) return;
        const el = document.querySelector(s.target);
        if (el) {
            const r = el.getBoundingClientRect();
            setRect({ x: r.x, y: r.y, width: r.width, height: r.height });
        }
    }, [step]);

    useEffect(() => {
        if (phase !== "touring") return;
        const s = DD_STEPS[step];
        const el = document.querySelector(s?.target);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            const t1 = setTimeout(measure, 100);
            const t2 = setTimeout(measure, 400);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        } else if (step < DD_STEPS.length - 1) {
            setStep(i => i + 1);
        } else {
            finish();
        }
    }, [phase, step, measure]);

    const finish = useCallback(() => {
        setPhase("done");
        localStorage.setItem(DD_KEY, "true");
    }, []);

    return (
        <AnimatePresence>
            {(phase === "touring" && !confirm) && (
                <div key="d">
                    <Spotlight rect={rect} onOverlayClick={() => setConfirm(true)} />
                    <Tooltip step={DD_STEPS[step]} stepIndex={step}
                        totalSteps={DD_STEPS.length} targetRect={rect}
                        onNext={() => step < DD_STEPS.length - 1 ? setStep(i => i + 1) : finish()}
                        onPrev={() => setStep(i => i - 1)} onSkip={finish} />
                </div>
            )}
            {confirm && (
                <ConfirmExit key="dc" onLeave={finish} onStay={() => setConfirm(false)} />
            )}
        </AnimatePresence>
    );
};

export default InsightsOnboardingTour;
