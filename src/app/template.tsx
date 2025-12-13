'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * SIMPLIFIED Page Transition Template
 * Priority: STABILITY over flashiness
 * 
 * Uses mode="wait" for sequential transitions (old page exits, then new enters)
 * Simple fade + slide up animation
 */

interface TemplateProps {
    children: React.ReactNode;
}

export default function Template({ children }: TemplateProps) {
    const pathname = usePathname();

    // Simple fade + slide variants
    const variants = {
        initial: {
            opacity: 0,
            y: 20,
        },
        animate: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.3,
                ease: 'easeOut',
            },
        },
        exit: {
            opacity: 0,
            y: -20,
            transition: {
                duration: 0.2,
                ease: 'easeIn',
            },
        },
    };

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={pathname}
                variants={variants}
                initial="initial"
                animate="animate"
                exit="exit"
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
