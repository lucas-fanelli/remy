'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect } from 'react';

/**
 * Semantic Page Tier System:
 * - Tier 0: Root pages (/, /search, /profile, /pantry, /feed)
 * - Tier 1: Detail pages (/recipe/*, /settings/*, /profile/*)
 * 
 * Forward navigation (0 → 1): Zoom In
 * Backward navigation (1 → 0): Zoom Out
 */

function getPageTier(pathname: string): number {
    // Tier 0: Main navigation / root pages
    const tier0Patterns = [
        /^\/$/,           // Home
        /^\/search$/,     // Search
        /^\/pantry$/,     // Pantry
        /^\/feed$/,       // Feed
    ];

    for (const pattern of tier0Patterns) {
        if (pattern.test(pathname)) return 0;
    }

    // Tier 1: All other pages (detail views)
    return 1;
}

interface TemplateProps {
    children: React.ReactNode;
}

export default function Template({ children }: TemplateProps) {
    const pathname = usePathname();
    const previousTierRef = useRef<number>(getPageTier(pathname));
    const currentTier = getPageTier(pathname);

    // Determine direction: 1 = forward (zoom in), -1 = backward (zoom out)
    const direction = currentTier > previousTierRef.current ? 1 :
        currentTier < previousTierRef.current ? -1 : 0;

    // Update ref after determining direction
    useEffect(() => {
        previousTierRef.current = currentTier;
    }, [pathname, currentTier]);

    // Animation variants - with zIndex for proper stacking
    const variants = {
        // Entering page
        enter: (dir: number) => ({
            opacity: 0,
            scale: dir >= 0 ? 0.85 : 1.1,
            zIndex: 2, // Entering page floats on top
        }),
        // Page in view
        center: {
            opacity: 1,
            scale: 1,
            zIndex: 1,
            transition: {
                duration: 0.5,
                ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quad
            },
        },
        // Exiting page
        exit: (dir: number) => ({
            opacity: 0,
            scale: dir >= 0 ? 1.1 : 0.85,
            zIndex: 0, // Exiting page goes behind
            transition: {
                duration: 0.4,
                ease: [0.25, 0.46, 0.45, 0.94],
            },
        }),
    };

    return (
        // Grid wrapper establishes proper stacking context for overlapping pages
        <div style={{
            display: 'grid',
            minHeight: '100vh',
            position: 'relative',
            overflow: 'hidden', // Prevent scale transition from causing scrollbars
            backgroundColor: '#121212', // Fallback solid background
        }}>
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                    key={pathname}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    style={{
                        // Both pages occupy same grid cell for overlap
                        gridArea: '1 / 1',
                        // Establish stacking context for z-index
                        position: 'relative',
                        // Solid background prevents transparency blending
                        backgroundColor: 'var(--mui-palette-background-default, #121212)',
                        // Hint browser for smooth animation
                        willChange: 'transform, opacity',
                        transformOrigin: 'center center',
                    }}
                >
                    {children}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
