import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import cloud from 'd3-cloud';
import type { Review } from '../types';

interface WordCloudProps {
    reviews: Review[];
    height?: number;
    className?: string;
}

interface WordData {
    text: string;
    size: number;
    sentiment: number;
    count: number;
}

const WordCloud: React.FC<WordCloudProps> = ({ reviews, height = 400, className = '' }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const width = 800;


    useEffect(() => {
        if (!reviews.length) return;

        // Aggregate by sentiment category instead of characteristics
        const frequencyMap: Record<string, { count: number; sentimentSum: number }> = {};

        reviews.forEach(review => {
            const category = review.sentimentCategory || 'General';
            if (!frequencyMap[category]) {
                frequencyMap[category] = { count: 0, sentimentSum: 0 };
            }
            frequencyMap[category].count += 1;
            frequencyMap[category].sentimentSum += review.polarity;
        });

        // Convert to array and sort
        const wordList: WordData[] = Object.entries(frequencyMap).map(([text, data]) => ({
            text,
            size: 0, // Will be calculated
            count: data.count,
            sentiment: data.sentimentSum / data.count
        }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 100); // Top 100 words

        // Scale for font size
        const maxCount = Math.max(...wordList.map(w => w.count));
        const minCount = Math.min(...wordList.map(w => w.count));
        const fontScale = d3.scaleLinear().domain([minCount, maxCount]).range([14, 60]);

        // Color scale based on sentiment
        const colorScale = (sentiment: number) => {
            if (sentiment > 0.1) return '#22c55e'; // Green
            if (sentiment < -0.1) return '#ef4444'; // Red
            return '#94a3b8'; // Gray
        };

        // Generate Layout
        const layout = cloud()
            .size([width, height])
            .words(wordList.map(d => ({ text: d.text, size: fontScale(d.count), data: d })))
            .padding(5)
            .rotate(() => (Math.random() > 0.5 ? 0 : 90))
            .font("Inter")
            .fontSize(d => d.size as number)
            .on("end", (computedWords) => {
                if (!svgRef.current) return;

                const svg = d3.select(svgRef.current);
                svg.selectAll("*").remove();

                const g = svg.append("g")
                    .attr("transform", `translate(${width / 2},${height / 2})`);

                g.selectAll("text")
                    .data(computedWords)
                    .enter().append("text")
                    .style("font-size", d => `${d.size}px`)
                    .style("font-family", "Inter")
                    .style("fill", (d: any) => colorScale(d.data.sentiment))
                    .attr("text-anchor", "middle")
                    .attr("transform", d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
                    .text(d => d.text as string)
                    .style("cursor", "pointer")
                    .on("mouseover", function () {
                        d3.select(this).transition().style("opacity", 0.7);
                    })
                    .on("mouseout", function () {
                        d3.select(this).transition().style("opacity", 1);
                    })
                    .append("title")
                    .text((d: any) => `${d.text}: ${d.data.count} mentions, Avg Sentiment: ${d.data.sentiment.toFixed(2)}`);
            });

        layout.start();

    }, [height, reviews, width]);

    return (
        <div className={`relative w-full overflow-hidden rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),rgba(255,255,255,0.96)_45%,rgba(244,114,182,0.08)_100%)] shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-slate-700/60 dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),rgba(15,23,42,0.95)_48%,rgba(16,185,129,0.12)_100%)] ${className}`.trim()}>
            <div className="pointer-events-none absolute inset-x-8 top-4 h-px bg-gradient-to-r from-transparent via-slate-200/80 to-transparent dark:via-slate-700/60" />
            <div className="pointer-events-none absolute -left-16 top-6 h-28 w-28 rounded-full bg-indigo-300/20 blur-3xl dark:bg-indigo-500/20" />
            <div className="pointer-events-none absolute -right-10 bottom-4 h-24 w-24 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/15" />
            <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
                <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="h-full w-full" />
            </div>
        </div>
    );
};

export default WordCloud;
