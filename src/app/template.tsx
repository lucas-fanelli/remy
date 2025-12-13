'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Global Page Transition Template
 * 
 * Consistent "Slide Up & Fade" transition for ALL pages.
 * Uses mode="wait" for clean sequential transitions.
 * Spring physics for snappy, polished feel.
 */

interface TemplateProps {
    children: React.ReactNode;
}

export default function Template({ children }: TemplateProps) {
    const pathname = usePathname();

    return (
        <AnimatePresence mode="wait" initial={false}>
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
