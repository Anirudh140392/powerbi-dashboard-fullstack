import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function EChartsWrapper({ option, style, onEvents }) {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        // Initialize chart
        if (chartRef.current) {
            // Check if instance already exists
            const existingInstance = echarts.getInstanceByDom(chartRef.current);
            if (existingInstance) {
                chartInstance.current = existingInstance;
            } else {
                chartInstance.current = echarts.init(chartRef.current);
            }
        }

        // Resize handler
        const handleResize = () => {
            chartInstance.current?.resize();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            // Cleanup
            window.removeEventListener('resize', handleResize);
            chartInstance.current?.dispose();
            chartInstance.current = null;
        };
    }, []);

    useEffect(() => {
        // Update options
        if (chartInstance.current) {
            chartInstance.current.setOption(option, { notMerge: true });
        }
    }, [option]);

    // Handle events if needed
    useEffect(() => {
        if (chartInstance.current && onEvents) {
            Object.keys(onEvents).forEach((eventName) => {
                // Remove old listeners to avoid duplicates if onEvents changes
                chartInstance.current.off(eventName);
                chartInstance.current.on(eventName, onEvents[eventName]);
            });
        }
    }, [onEvents]);

    return <div ref={chartRef} style={{ width: '100%', height: '100%', ...style }} />;
}
