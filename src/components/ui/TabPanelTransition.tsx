'use client';

import { AnimatePresence, motion, Variants } from 'framer-motion';
import { ReactNode, useRef, useState, useEffect } from 'react';

interface TabPanelTransitionProps {
    children: ReactNode;
    activeKey: string | number;
    direction?: 1 | -1;
    slideDistance?: number;
}

/**
 * TabPanelTransition - Material Design Shared Axis X Transition
 * 
 * Implements horizontal slide + fade for tab content switching.
 * Automatically detects direction based on key changes.
 * 
 * @param children - Content to animate
 * @param activeKey - Current active tab key (triggers animation on change)
 * @param direction - Optional explicit direction (1 = right, -1 = left)
 * @param slideDistance - Distance to slide in pixels (default: 50)
 */
export default function TabPanelTransition({
    children,
    activeKey,
    direction: explicitDirection,
    slideDistance = 50,
}: TabPanelTransitionProps) {
    const prevKeyRef = useRef<string | number>(activeKey);
    const [direction, setDirection] = useState(1);

    // Auto-detect direction based on key change
    useEffect(() => {
        if (activeKey !== prevKeyRef.current) {
            const newDirection = activeKey > prevKeyRef.current ? 1 : -1;
            setDirection(explicitDirection ?? newDirection);
            prevKeyRef.current = activeKey;
        }
    }, [activeKey, explicitDirection]);

    const variants: Variants = {
        enter: (dir: number) => ({
            x: dir * slideDistance,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
            transition: {
                x: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                opacity: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
            },
        },
        exit: (dir: number) => ({
            x: dir * -slideDistance,
            opacity: 0,
            transition: {
                x: { duration: 0.25, ease: [0.4, 0, 1, 1] },
                opacity: { duration: 0.2, ease: [0.4, 0, 1, 1] },
            },
        }),
    };

    return (
        <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
                key={activeKey}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{ width: '100%' }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
