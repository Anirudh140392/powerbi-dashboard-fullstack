/**
 * IssueSlider — Slide-in panel showing SKUs affected by a specific NLP issue
 * Opens when user clicks an issue card in the Issues Breakdown section.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, AlertTriangle, Eye, ChevronRight, Package } from 'lucide-react';
import { useIssueDetail } from '../hooks/useRatingsAPI';
import ReviewModal from './ReviewModal';

interface IssueSliderProps {
    isOpen: boolean;
    onClose: () => void;
    issueLabel: string | null;
    subcategory: string | null;
}

const IssueSlider: React.FC<IssueSliderProps> = ({ isOpen, onClose, issueLabel, subcategory }) => {
    const { data: products, loading } = useIssueDetail(isOpen ? subcategory : null);
    const [reviewModal, setReviewModal] = useState<{ webPid: string; productName: string } | null>(null);

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                        />
                        {/* Slider Panel */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                            className="fixed top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle size={18} className="text-red-500" />
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                            {issueLabel || subcategory?.replace(/_/g, ' ')}
                                        </h2>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {products.length} affected SKUs · Click to view reviews
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <X size={18} className="text-slate-500" />
                                </button>
                            </div>

                            {/* Product List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {loading ? (
                                    <div className="flex items-center justify-center py-20">
                                        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : products.length === 0 ? (
                                    <div className="text-center py-20 text-slate-400">
                                        <Package size={40} className="mx-auto mb-3 opacity-40" />
                                        <p className="text-sm">No products found for this issue</p>
                                    </div>
                                ) : (
                                    products.map((product) => (
                                        <motion.div
                                            key={product.web_pid}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="group border border-slate-200/60 dark:border-slate-700/50 rounded-xl p-3.5
                                                hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md
                                                transition-all duration-200 cursor-pointer bg-white dark:bg-slate-800/50"
                                            onClick={() => setReviewModal({ webPid: product.web_pid, productName: product.product_name })}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                        {product.product_name}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        {product.pdp_rating && (
                                                            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                                                <Star size={11} className="fill-amber-400 text-amber-400" />
                                                                {product.pdp_rating.toFixed(1)}
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-red-500 font-semibold">
                                                            {product.negativeCount} negative
                                                        </span>
                                                        <span className="text-xs text-slate-400">
                                                            / {product.reviewCount} total
                                                        </span>
                                                    </div>

                                                    {/* Negative % bar */}
                                                    <div className="mt-2 w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all"
                                                            style={{ width: `${Math.min((product.negativeCount / Math.max(product.reviewCount, 1)) * 100, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <span className="text-[10px] text-indigo-500 font-medium">Reviews</span>
                                                    <Eye size={14} className="text-indigo-500" />
                                                    <ChevronRight size={14} className="text-indigo-500" />
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Review Modal */}
            {reviewModal && (
                <ReviewModal
                    isOpen={!!reviewModal}
                    onClose={() => setReviewModal(null)}
                    webPid={reviewModal.webPid}
                    subcategory={subcategory || ''}
                    productName={reviewModal.productName}
                />
            )}
        </>
    );
};

export default IssueSlider;
