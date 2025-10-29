/**
 * Animated Splash Screen Component
 * Shows "ttg" → "tagtapgo" animation before auth screens
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';


interface SplashScreenProps {
    onComplete?: () => void;
    duration?: number; // Total duration in milliseconds
}

export default function SplashScreen({
    onComplete,
    duration = 3000
}: SplashScreenProps) {
    const [stage, setStage] = useState<'ttg' | 'expanding' | 'complete'>('ttg');
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Stage 1: Show "ttg" for 800ms
        const ttgTimer = setTimeout(() => {
            setStage('expanding');
        }, 800);

        // Stage 2: Expand to "tagtapgo" and hold for 1200ms
        const expandTimer = setTimeout(() => {
            setStage('complete');
        }, 2000);

        // Stage 3: Fade out after total duration
        const completeTimer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => {
                if (onComplete) onComplete();
            }, 500); // Wait for fade out animation
        }, duration);

        return () => {
            clearTimeout(ttgTimer);
            clearTimeout(expandTimer);
            clearTimeout(completeTimer);
        };
    }, [duration, onComplete]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-primary via-primary-dark to-success"
                >
                    {/* Animated Background Circles */}
                    <div className="absolute inset-0 overflow-hidden">
                        <motion.div
                            className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-white/10"
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.3, 0.5, 0.3],
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: 'easeInOut',
                            }}
                        />
                        <motion.div
                            className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-white/10"
                            animate={{
                                scale: [1, 1.3, 1],
                                opacity: [0.2, 0.4, 0.2],
                            }}
                            transition={{
                                duration: 4,
                                repeat: Infinity,
                                ease: 'easeInOut',
                                delay: 0.5,
                            }}
                        />
                    </div>

                    {/* Logo Animation Container */}
                    <div className="relative z-10 flex items-center justify-center">
                        {stage === 'ttg' && (
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 1.1, opacity: 0 }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                className="text-white font-cal-sans text-8xl font-bold tracking-tight"
                                style={{
                                    textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                                }}
                            >
                                ttg
                            </motion.div>
                        )}

                        {stage === 'expanding' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="relative"
                            >
                                {/* Expanding Animation */}
                                <motion.div
                                    className="text-white font-cal-sans text-7xl font-bold tracking-tight"
                                    style={{
                                        textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                                    }}
                                >
                                    {/* Animate each letter */}
                                    {'tagtapgo'.split('').map((letter, index) => (
                                        <motion.span
                                            key={index}
                                            initial={{
                                                opacity: index < 3 ? 1 : 0,
                                                scale: index < 3 ? 1 : 0.5,
                                                x: index < 3 ? 0 : -20,
                                            }}
                                            animate={{
                                                opacity: 1,
                                                scale: 1,
                                                x: 0,
                                            }}
                                            transition={{
                                                duration: 0.3,
                                                delay: index < 3 ? 0 : (index - 3) * 0.1,
                                                ease: 'easeOut',
                                            }}
                                            className="inline-block"
                                        >
                                            {letter}
                                        </motion.span>
                                    ))}
                                </motion.div>

                                {/* Glow Effect */}
                                <motion.div
                                    className="absolute inset-0 blur-2xl"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0, 0.6, 0] }}
                                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                                    style={{
                                        background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)',
                                    }}
                                />
                            </motion.div>
                        )}

                        {stage === 'complete' && (
                            <motion.div
                                initial={{ scale: 0.95 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                                className="text-white font-cal-sans text-7xl font-bold tracking-tight"
                                style={{
                                    textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                                }}
                            >
                                tagtapgo
                            </motion.div>
                        )}
                    </div>

                    {/* Loading Indicator */}
                    <motion.div
                        className="absolute bottom-20"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                    >
                        <div className="flex space-x-2">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className="w-2 h-2 bg-white rounded-full"
                                    animate={{
                                        scale: [1, 1.5, 1],
                                        opacity: [0.5, 1, 0.5],
                                    }}
                                    transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        delay: i * 0.2,
                                    }}
                                />
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
