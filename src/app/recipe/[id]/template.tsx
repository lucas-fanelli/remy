'use client';

import { motion } from 'framer-motion';

/**
 * Template file for recipe detail pages
 * 
 * Unlike layout.tsx which persists across navigations, template.tsx
 * creates a NEW instance on every navigation. This is crucial for
 * Framer Motion's `initial` animation to trigger on each page visit.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#templates
 */
export default function RecipeTemplate({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 3, ease: 'easeOut' }}
            style={{ minHeight: '100vh' }}
        >
            {children}
        </motion.div>
    );
}
