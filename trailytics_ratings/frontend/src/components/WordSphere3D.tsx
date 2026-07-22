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
            const fontSize = 14 + normalized * 22; // 14px to 36px
            const fontWeight = normalized > 0.5 ? 700 : 500;
            const opacity = 0.6 + normalized * 0.4; // 0.6 to 1.0
            
            // Color based on sentiment
            let color = 'inherit';
            if (c.sentimentScore > 0.3) color = '#10b981'; // emerald-500
            else if (c.sentimentScore < -0.3) color = '#ef4444'; // red-500
            
            return `<span style="font-size:${fontSize}px;font-weight:${fontWeight};opacity:${opacity};color:${color}" data-category="${c.text}" data-count="${c.count}">${c.text}</span>`;
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
        <div className={`rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.1),rgba(255,255,255,0.98)_44%,rgba(14,165,233,0.08)_100%)] p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-slate-700/60 dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),rgba(15,23,42,0.96)_44%,rgba(16,185,129,0.1)_100%)] ${className}`.trim()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
                        <p className="text-xs text-slate-500">{subtitle}</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3">
                    {/* Speed Control */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        {(['slow', 'normal', 'fast'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => changeSpeed(s)}
                                className={`px-2 py-1 text-xs rounded transition-all capitalize ${speed === s
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm font-medium'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* Pause/Play Button */}
                    <button
                        onClick={togglePause}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title={isPaused ? 'Resume' : 'Pause'}
                    >
                        {isPaused ? (
                            <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* Size Legend */}
            <div className="flex items-center justify-end gap-2 text-xs text-slate-500 mb-2">
                <span className="text-[10px]">Aa</span>
                <div className="w-12 h-1 bg-gradient-to-r from-slate-200 to-slate-500 rounded-full" />
                <span className="text-sm font-bold">Aa</span>
                <span>= More mentions</span>
            </div>

            {/* 3D TagCloud Container */}
            <div
                className="relative flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
                style={{ height: '400px' }}
            >
                <div
                    ref={containerRef}
                    className="tagcloud-container"
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

                {/* Pause overlay */}
                {isPaused && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm pointer-events-none">
                        <div className="px-4 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg text-sm font-medium text-slate-600 dark:text-slate-300">
                            Paused - Click Play to Resume
                        </div>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="flex justify-between mt-3 text-xs text-slate-500">
                <span>{categoryData.length} categories tracked</span>
                <span>Speed: {speed} • {isPaused ? 'Paused' : 'Running'}</span>
            </div>
        </div>
    );
};

export default WordSphere3D;
