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

    // Animation variants - increased for visibility
    const variants = {
        // Entering page
        enter: (dir: number) => ({
            opacity: 0,
            scale: dir >= 0 ? 0.85 : 1.15,
            filter: dir >= 0 ? 'brightness(1)' : 'brightness(1)',
        }),
        // Page in view
        center: {
            opacity: 1,
            scale: 1,
            filter: 'brightness(1)',
            transition: {
                duration: 0.7,
                ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quad
            },
        },
        // Exiting page
        exit: (dir: number) => ({
            opacity: dir >= 0 ? 0.4 : 0,
            scale: dir >= 0 ? 1.15 : 0.85,
            filter: dir >= 0 ? 'brightness(0.5)' : 'brightness(1)',
            transition: {
                duration: 0.5,
                ease: [0.25, 0.46, 0.45, 0.94],
            },
        }),
    };

    return (
        <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
                key={pathname}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{
                    // CSS Grid trick for perfect overlapping without layout shift
                    display: 'grid',
                    gridArea: '1 / 1',
                    width: '100%',
                    minHeight: '100%',
                    willChange: 'transform, opacity',
                    // Solid background prevents transparency blending during transitions
                    backgroundColor: 'var(--mui-palette-background-default, #121212)',
                    // Entering page floats on top
                    zIndex: 1,
                }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
