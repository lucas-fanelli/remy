'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Global Page Transition Template
 * 
 * Consistent "Slide Up & Fade" transition for ALL pages.
 * Uses mode="wait" for clean sequential transitions.
 * Spring physics for snappy, polished feel.
 * 
 * The isClient pattern prevents SSR hydration mismatch by not rendering
 * the animation wrapper until client-side hydration completes.
 */

interface TemplateProps {
    children: React.ReactNode;
}

export default function Template({ children }: TemplateProps) {
    const pathname = usePathname();
    const [isClient, setIsClient] = useState(false);

    // Wait for client-side hydration to complete before animating
    useEffect(() => {
        setIsClient(true);
    }, [pathname]);

    // During SSR/initial render, show content immediately with proper styling (no animation)
    if (!isClient) {
        return (
            <div
                style={{
                    minHeight: '100vh',
                    backgroundColor: 'var(--mui-palette-background-default, #121212)',
                }}
            >
                {children}
            </div>
        );
    }

    // After hydration, use animated wrapper
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                }}
                style={{
                    minHeight: '100vh',
                    backgroundColor: 'var(--mui-palette-background-default, #121212)',
                }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
