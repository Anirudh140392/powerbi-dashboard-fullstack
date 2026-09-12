import React, { useEffect, useRef, useMemo, useState } from 'react';
import TagCloud from 'TagCloud';
import type { Review } from '../types';

interface WordSphereProps {
    reviews: Review[];
    onCategoryClick?: (category: string) => void;
    title?: string;
    subtitle?: string;
    className?: string;
}

interface CategoryData {
    text: string;
    count: number;
    sentimentScore: number;
}

const WordSphere3D: React.FC<WordSphereProps> = ({
    reviews,
    onCategoryClick,
    title = 'Category Universe',
    subtitle = 'Move mouse to control • Click to explore',
    className = '',
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tagCloudRef = useRef<any>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');

    // Aggregate by subcategory for granular data
    const categoryData = useMemo(() => {
        const frequencyMap: Record<string, { count: number, sentimentScore: number }> = {};

        reviews.forEach(review => {
            const category = review.subcategory || review.sentimentCategory || 'General';
            const displayName = category.replace(/_/g, ' ');
            
            if (!frequencyMap[displayName]) {
                frequencyMap[displayName] = { count: 0, sentimentScore: 0 };
            }
            
            frequencyMap[displayName].count += 1;
            
            const sent = typeof review.sentiment === 'string' ? review.sentiment.toLowerCase() : '';
            if (sent === 'positive') frequencyMap[displayName].sentimentScore += 1;
            else if (sent === 'negative') frequencyMap[displayName].sentimentScore -= 1;
        });

        const items: CategoryData[] = Object.entries(frequencyMap)
            .map(([text, data]) => ({ text, count: data.count, sentimentScore: data.sentimentScore / data.count }))
            .filter(item => !['General', 'General Feedback', 'Overall Quality'].includes(item.text))
            .sort((a, b) => b.count - a.count)
            .slice(0, 18); // Top 18 for readable sphere

        return items;
    }, [reviews]);

    // Initialize TagCloud
    useEffect(() => {
        if (!containerRef.current || categoryData.length === 0) return;

        // Clear previous instance
        if (tagCloudRef.current) {
            tagCloudRef.current.destroy();
            tagCloudRef.current = null;
        }

        // Clear container
        containerRef.current.innerHTML = '';

        // Create text items with HTML for custom sizing
        const maxCount = Math.max(...categoryData.map(c => c.count));
        const minCount = Math.min(...categoryData.map(c => c.count));

        const texts = categoryData.map(c => {
            const normalized = (c.count - minCount) / (maxCount - minCount || 1);
            const fontSize = 14 + normalized * 26; // 14px to 40px
            const fontWeight = normalized > 0.5 ? 800 : 600;
            const opacity = 0.75 + normalized * 0.25; // 0.75 to 1.0
            
            // Vibrant colors for light background with soft drop shadow
            let color = '#475569'; // slate-600 for neutral
            if (c.sentimentScore > 0.3) color = '#10b981'; // emerald-500
            else if (c.sentimentScore < -0.3) color = '#f43f5e'; // rose-500
            
            return `<span style="font-size:${fontSize}px;font-weight:${fontWeight};opacity:${opacity};color:${color};text-shadow:0 8px 24px ${color}30, 0 2px 4px rgba(0,0,0,0.06)" data-category="${c.text}" data-count="${c.count}">${c.text}</span>`;
        });

        const options = {
            radius: 200,
            maxSpeed: speed,
            initSpeed: speed,
            direction: 135,
            keep: true,
            reverseDirection: false,
            useContainerInlineStyles: true,
            useItemInlineStyles: true,
            containerClass: 'tagcloud',
            itemClass: 'tagcloud--item',
            useHTML: true, // Enable HTML for custom styling
        };

        tagCloudRef.current = TagCloud(containerRef.current, texts, options);

        return () => {
            if (tagCloudRef.current) {
                tagCloudRef.current.destroy();
                tagCloudRef.current = null;
            }
        };
    }, [categoryData, speed]);

    // Handle click events via event delegation
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleClick = (e: Event) => {
            const target = e.target as HTMLElement;
            const item = target.closest('.tagcloud--item');
            if (item) {
                const span = item.querySelector('span[data-category]') as HTMLElement;
                const category = span?.getAttribute('data-category') || item.textContent || '';
                onCategoryClick?.(category);
            }
        };

        container.addEventListener('click', handleClick);
        return () => container.removeEventListener('click', handleClick);
    }, [onCategoryClick]);

    // Pause/Resume control
    const togglePause = () => {
        if (tagCloudRef.current) {
            if (isPaused) {
                tagCloudRef.current.resume();
            } else {
                tagCloudRef.current.pause();
            }
            setIsPaused(!isPaused);
        }
    };

    // Speed change - need to recreate
    const changeSpeed = (newSpeed: 'slow' | 'normal' | 'fast') => {
        setSpeed(newSpeed);
    };

    if (categoryData.length === 0) {
        return (
            <div className={`rounded-[28px] border border-dashed border-slate-200/80 bg-white/70 px-6 py-16 text-center text-sm text-slate-400 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-500 ${className}`.trim()}>
                No review language is available in this slice yet.
            </div>
        );
    }

    return (
        <div className={`rounded-[24px] border border-slate-200/60 bg-white/50 dark:bg-slate-900/40 p-5 shadow-sm dark:border-slate-700/50 backdrop-blur-sm ${className}`.trim()}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">{title}</h3>
                        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                    {/* Size Legend */}
                    <div className="hidden lg:flex items-center justify-end gap-2.5 text-xs text-slate-500 mr-2">
                        <span className="text-[10px] font-bold text-slate-400">Aa</span>
                        <div className="w-12 h-1.5 bg-gradient-to-r from-slate-200 to-slate-400 dark:from-slate-700 dark:to-slate-500 rounded-full" />
                        <span className="text-sm font-extrabold text-slate-600 dark:text-slate-300">Aa</span>
                        <span className="font-medium ml-1 tracking-tight">= More mentions</span>
                    </div>

                    {/* Speed Control */}
                    <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-1 shadow-inner border border-slate-200/50 dark:border-slate-700/50">
                        {(['slow', 'normal', 'fast'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => changeSpeed(s)}
                                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all capitalize duration-200 ${speed === s
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                                    }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* Pause/Play Button */}
                    <button
                        onClick={togglePause}
                        className="p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-inner border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-400"
                        title={isPaused ? 'Resume' : 'Pause'}
                    >
                        {isPaused ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* 3D TagCloud Container */}
            <div
                className="relative flex items-center justify-center bg-white/40 dark:bg-slate-900/40 rounded-3xl overflow-hidden border border-white/80 dark:border-slate-700/50 shadow-[inset_0_0_80px_rgba(255,255,255,0.8),0_8px_32px_rgba(15,23,42,0.04)] backdrop-blur-2xl"
                style={{ height: '480px' }}
            >
                {/* Mesmerizing light background gradients */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-emerald-50/60 pointer-events-none" />
                <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-indigo-400/15 rounded-full blur-[80px] pointer-events-none mix-blend-multiply dark:mix-blend-screen" />
                <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-fuchsia-400/10 rounded-full blur-[80px] pointer-events-none mix-blend-multiply dark:mix-blend-screen" />
                
                {/* Subtle dot grid */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxjaXJjbGUgY3g9IjEiIGN5PSIxIiByPSIxIiBmaWxsPSJyZ2JhKDE1LCAyMyLCA0MiwgMC4wNikiLz4KPC9zdmc+')] opacity-70" />

                <div
                    ref={containerRef}
                    className="tagcloud-container relative z-10"
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#334155', // slate-700
                        cursor: 'pointer',
                    }}
                />

                {/* Pause overlay - Premium Light themed */}
                {isPaused && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/60 backdrop-blur-md z-20 transition-all duration-300">
                        <div className="px-6 py-4 bg-white/95 dark:bg-slate-800/95 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 text-sm font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-500 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-800/50">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                            Paused — Click Play to Resume
                        </div>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="flex justify-between items-center mt-5 px-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wide">
                <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse"></span>
                    {categoryData.length} CATEGORIES TRACKED
                </span>
                <span className="flex items-center gap-1.5 uppercase">
                    SPEED: <span className="text-slate-700 dark:text-slate-200">{speed}</span> 
                    <span className="mx-1.5 opacity-40">•</span> 
                    <span className={isPaused ? "text-amber-500" : "text-emerald-500"}>{isPaused ? 'PAUSED' : 'RUNNING'}</span>
                </span>
            </div>
        </div>
    );
};

export default WordSphere3D;
