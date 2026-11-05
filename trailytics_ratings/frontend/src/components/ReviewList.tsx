import React from 'react';
import { User, Star } from 'lucide-react';
import type { Review } from '../types';

interface ReviewListProps {
    reviews: Review[];
}

const ReviewList: React.FC<ReviewListProps> = ({ reviews }) => {
    return (
        <div className="space-y-4 h-full overflow-y-auto pr-2 custom-scrollbar">
            {reviews.slice(0, 50).map((review, i) => (
                <div key={i} className="group p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-indigo-500/20 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200">

                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-300">
                                <User size={14} />
                            </div>
                            <div>
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <Star
                                            key={s}
                                            size={10}
                                            className={`${s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
                                        />
                                    ))}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium">Verified Purchase</div>
                            </div>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${review.sentiment === 'Positive' ? 'bg-green-500/10 text-green-500' :
                            review.sentiment === 'Negative' ? 'bg-red-500/10 text-red-500' :
                                'bg-slate-500/10 text-slate-500'
                            }`}>
                            {review.sentiment}
                        </span>
                    </div>

                    <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed">
                        {review.text}
                    </p>

                    {review.characteristics && review.characteristics.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {review.characteristics.slice(0, 3).map((char, j) => (
                                <span key={j} className="text-[10px] px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                    {char}
                                </span>
                            ))}
                            {review.characteristics.length > 3 && (
                                <span className="text-[10px] px-2 py-1 text-slate-400">+{review.characteristics.length - 3}</span>
                            )}
                        </div>
                    )}

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                        <span>{new Date(review.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ReviewList;
