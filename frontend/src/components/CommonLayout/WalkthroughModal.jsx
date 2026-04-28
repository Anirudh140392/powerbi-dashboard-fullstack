import React, { useState, useEffect } from 'react';
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
    const [walkthrough, setWalkthrough] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [seenKeys, setSeenKeys] = useState(() => {
        const saved = localStorage.getItem('seen_walkthroughs');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        if (!isLoggedIn || !user) return;

        const checkWalkthrough = async () => {
            try {
                const token = sessionStorage.getItem("token");
                const currentRoute = location.pathname;

                console.log(`[WalkthroughModal] Checking route: ${currentRoute}, client: ${user?.dbName}`);

                const response = await axios.get(`${API_BASE}/walkthroughs/active`, {
                    params: { route: currentRoute },
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.data.success && response.data.data) {
                    const data = response.data.data;
                    // Use walkthrough ID + route as a unique key so each page's
                    // steps are tracked independently
                    const seenKey = `${data.id}::${currentRoute}`;

                    if (!seenKeys.includes(seenKey)) {
                        setWalkthrough({ ...data, _seenKey: seenKey });
                        setIsOpen(true);
                        setCurrentIndex(0);
                    }
                }
            } catch (err) {
                console.error('[WalkthroughModal] Error:', err);
            }
        };

        checkWalkthrough();
    }, [location.pathname, isLoggedIn, user]);

    const handleClose = () => {
        setIsOpen(false);
        if (walkthrough) {
            const updated = [...seenKeys, walkthrough._seenKey];
            setSeenKeys(updated);
            localStorage.setItem('seen_walkthroughs', JSON.stringify(updated));
        }
    };

    if (!isOpen || !walkthrough || !walkthrough.steps?.length) return null;

    const currentStep = walkthrough.steps[currentIndex];
    const totalSteps = walkthrough.steps.length;
    const isLastStep = currentIndex >= totalSteps - 1;

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
                                key={currentIndex}
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
                        <button onClick={handleClose} style={{
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
                                {walkthrough.steps.map((_, i) => (
                                    <div key={i} style={{
                                        width: i === currentIndex ? '24px' : '8px',
                                        height: '8px', borderRadius: '100px',
                                        backgroundColor: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.45)',
                                        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
                                        boxShadow: i === currentIndex ? '0 0 8px rgba(255,255,255,0.5)' : 'none',
                                    }} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div style={{ padding: '24px 28px 20px' }}>
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
                                Step {currentIndex + 1} of {totalSteps}
                            </span>
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentIndex}
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
                                disabled={currentIndex === 0}
                                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                                style={{
                                    width: '44px', height: '44px', borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: currentIndex === 0 ? '#f8fafc' : '#fff',
                                    color: currentIndex === 0 ? '#cbd5e1' : '#475569',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                                    opacity: currentIndex === 0 ? 0.4 : 1, flexShrink: 0,
                                }}
                            >
                                <ChevronLeft style={{ width: 18, height: 18 }} />
                            </button>
                        )}

                        <button
                            onClick={() => {
                                if (!isLastStep) setCurrentIndex(currentIndex + 1);
                                else handleClose();
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
                                onClick={handleClose}
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
