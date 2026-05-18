import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    X,
    Sparkles,
    Image as ImageIcon,
    CheckCircle2
} from 'lucide-react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";

const WalkthroughModal = () => {
    const location = useLocation();
    const { isLoggedIn, user } = useAuth();

    // Queue of walkthroughs to show (each has id, title, steps[], createdOn)
    const [queue, setQueue] = useState([]);
    // Index of the current walkthrough in the queue
    const [queueIndex, setQueueIndex] = useState(0);
    // Index of the current step within the current walkthrough
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    // Track whether we already fetched for this route to avoid re-fetching on
    // every render while the modal is open
    const fetchedRouteRef = useRef(null);

    useEffect(() => {
        if (!isLoggedIn || !user) return;

        const currentRoute = location.pathname;

        // Don't re-fetch if we already checked this route
        if (fetchedRouteRef.current === currentRoute) return;

        const checkWalkthroughs = async () => {
            try {
                const token = sessionStorage.getItem("token");

                console.log(`[WalkthroughModal] Checking route: ${currentRoute}, client: ${user?.dbName}`);

                const response = await axios.get(`${API_BASE}/walkthroughs/active`, {
                    params: { route: currentRoute },
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.data.success && Array.isArray(response.data.data) && response.data.data.length > 0) {
                    const walkthroughs = response.data.data;
                    console.log(`[WalkthroughModal] Received ${walkthroughs.length} walkthrough(s) for route ${currentRoute}`);

                    setQueue(walkthroughs);
                    setQueueIndex(0);
                    setCurrentStepIndex(0);
                    setIsOpen(true);
                    fetchedRouteRef.current = currentRoute;
                } else {
                    // No pending walkthroughs for this route
                    fetchedRouteRef.current = currentRoute;
                }
            } catch (err) {
                console.error('[WalkthroughModal] Error:', err);
            }
        };

        checkWalkthroughs();
    }, [location.pathname, isLoggedIn, user]);

    // Reset fetched route ref when route changes so we re-check
    useEffect(() => {
        fetchedRouteRef.current = null;
    }, [location.pathname]);

    /**
     * Called when the user finishes or skips the current walkthrough.
     * If more walkthroughs are in the queue, advance to the next one.
     * If this was the last one, close the modal and acknowledge on the server.
     */
    const handleFinishCurrent = async () => {
        const nextIndex = queueIndex + 1;

        if (nextIndex < queue.length) {
            // More walkthroughs to show
            setQueueIndex(nextIndex);
            setCurrentStepIndex(0);
        } else {
            // All done — close and acknowledge
            setIsOpen(false);

            try {
                const token = sessionStorage.getItem("token");
                await axios.post(`${API_BASE}/walkthroughs/acknowledge`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log('[WalkthroughModal] ✅ All walkthroughs acknowledged');
            } catch (err) {
                console.error('[WalkthroughModal] Failed to acknowledge:', err);
            }
        }
    };

    if (!isOpen || queue.length === 0) return null;

    const currentWalkthrough = queue[queueIndex];
    if (!currentWalkthrough || !currentWalkthrough.steps?.length) return null;

    const currentStep = currentWalkthrough.steps[currentStepIndex];
    const totalSteps = currentWalkthrough.steps.length;
    const isLastStep = currentStepIndex >= totalSteps - 1;
    const totalWalkthroughs = queue.length;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '24px',
                    backgroundColor: 'rgba(15, 23, 42, 0.55)',
                    backdropFilter: 'blur(8px)',
                }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 24, scale: 0.97 }}
                    transition={{ type: 'spring', damping: 26, stiffness: 260 }}
                    style={{
                        background: '#ffffff',
                        borderRadius: '24px',
                        width: '100%', maxWidth: '400px',
                        overflow: 'hidden',
                        display: 'flex', flexDirection: 'column',
                        boxShadow: '0 25px 60px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)',
                    }}
                >
                    {/* Image */}
                    <div style={{ position: 'relative', height: '220px', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`${queueIndex}-${currentStepIndex}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4 }}
                                style={{ width: '100%', height: '100%' }}
                            >
                                {currentStep.image_url ? (
                                    <img
                                        src={currentStep.image_url}
                                        alt="Feature"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '100%', height: '100%',
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Sparkles style={{ width: 48, height: 48, color: 'rgba(255,255,255,0.3)' }} />
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* Bottom gradient */}
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px',
                            background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)',
                            pointerEvents: 'none',
                        }} />

                        {/* Close */}
                        <button onClick={handleFinishCurrent} style={{
                            position: 'absolute', top: '16px', right: '16px', zIndex: 10,
                            width: '36px', height: '36px', borderRadius: '50%',
                            backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.15)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}>
                            <X style={{ width: 16, height: 16 }} />
                        </button>

                        {/* Step dots */}
                        {totalSteps > 1 && (
                            <div style={{
                                position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
                                zIndex: 10, display: 'flex', gap: '6px', alignItems: 'center',
                            }}>
                                {currentWalkthrough.steps.map((_, i) => (
                                    <div key={i} style={{
                                        width: i === currentStepIndex ? '24px' : '8px',
                                        height: '8px', borderRadius: '100px',
                                        backgroundColor: i === currentStepIndex ? '#fff' : 'rgba(255,255,255,0.45)',
                                        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
                                        boxShadow: i === currentStepIndex ? '0 0 8px rgba(255,255,255,0.5)' : 'none',
                                    }} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div style={{ padding: '24px 28px 20px' }}>
                        {/* Walkthrough queue indicator (only when multiple walkthroughs) */}
                        {totalWalkthroughs > 1 && (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '3px 8px', borderRadius: '6px',
                                backgroundColor: '#fef3c7', marginBottom: '8px',
                            }}>
                                <span style={{
                                    fontSize: '10px', fontWeight: 600, color: '#92400e',
                                    letterSpacing: '0.03em',
                                }}>
                                    Update {queueIndex + 1} of {totalWalkthroughs}
                                </span>
                            </div>
                        )}

                        {/* Step badge */}
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '4px 10px', borderRadius: '6px',
                            backgroundColor: '#eef2ff', marginBottom: '14px',
                        }}>
                            <span style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                backgroundColor: '#6366f1',
                            }} />
                            <span style={{
                                fontSize: '11px', fontWeight: 600, color: '#4f46e5',
                                letterSpacing: '0.03em',
                            }}>
                                Step {currentStepIndex + 1} of {totalSteps}
                            </span>
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`${queueIndex}-${currentStepIndex}`}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.3 }}
                            >
                                <h3 style={{
                                    fontSize: '18px', fontWeight: 700, color: '#1e293b',
                                    lineHeight: 1.35, margin: '0 0 8px 0',
                                }}>
                                    {currentStep.heading}
                                </h3>
                                <p style={{
                                    fontSize: '13.5px', fontWeight: 400, color: '#64748b',
                                    lineHeight: 1.6, margin: 0,
                                }}>
                                    {currentStep.description}
                                </p>
                            </motion.div>
                        </AnimatePresence>

                        {currentStep.routeLabel && (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                marginTop: '14px', padding: '5px 10px', borderRadius: '6px',
                                backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                            }}>
                                <span style={{
                                    width: '5px', height: '5px', borderRadius: '50%',
                                    backgroundColor: '#6366f1',
                                }} />
                                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>
                                    {currentStep.routeLabel}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '0 28px 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {totalSteps > 1 && (
                            <button
                                disabled={currentStepIndex === 0}
                                onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
                                style={{
                                    width: '44px', height: '44px', borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: currentStepIndex === 0 ? '#f8fafc' : '#fff',
                                    color: currentStepIndex === 0 ? '#cbd5e1' : '#475569',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
                                    opacity: currentStepIndex === 0 ? 0.4 : 1, flexShrink: 0,
                                }}
                            >
                                <ChevronLeft style={{ width: 18, height: 18 }} />
                            </button>
                        )}

                        <button
                            onClick={() => {
                                if (!isLastStep) setCurrentStepIndex(currentStepIndex + 1);
                                else handleFinishCurrent();
                            }}
                            style={{
                                flex: 1, height: '44px', borderRadius: '12px', border: 'none',
                                background: isLastStep
                                    ? 'linear-gradient(135deg, #059669, #10b981)'
                                    : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                color: '#fff', fontSize: '13.5px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                cursor: 'pointer',
                                boxShadow: isLastStep
                                    ? '0 4px 14px -3px rgba(5,150,105,0.4)'
                                    : '0 4px 14px -3px rgba(79,70,229,0.4)',
                            }}
                        >
                            {isLastStep ? (
                                <> Got it! <CheckCircle2 style={{ width: 15, height: 15 }} /> </>
                            ) : (
                                <> Next <ChevronRight style={{ width: 15, height: 15 }} /> </>
                            )}
                        </button>

                        {!isLastStep && (
                            <button
                                onClick={handleFinishCurrent}
                                style={{
                                    background: 'none', border: 'none', color: '#94a3b8',
                                    fontSize: '12.5px', fontWeight: 500, cursor: 'pointer',
                                    padding: '8px 2px', flexShrink: 0,
                                }}
                            >
                                Skip
                            </button>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default WalkthroughModal;
