import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

export const GlobalLoader: React.FC = () => {
    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center relative overflow-hidden">
            {/* Soft background glow similar to the screenshot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center">
                {/* Purple Icon Box */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-500/20 flex items-center justify-center mb-6"
                >
                    <Star size={36} className="text-white fill-white/30" />
                </motion.div>

                {/* Text */}
                <motion.h2 
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                    className="text-xl font-bold text-slate-900 mb-2"
                >
                    Review Rating Intelligence
                </motion.h2>
                
                <motion.p 
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="text-sm text-slate-500 mb-8"
                >
                    Loading Session..
                </motion.p>

                {/* Spinner */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="w-8 h-8 border-[3px] border-slate-100 border-t-indigo-600 rounded-full animate-spin"
                />
            </div>
        </div>
    );
};
