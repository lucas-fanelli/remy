/**
 * Shared framer-motion mock for Jest tests.
 *
 * Usage in jest.config.js moduleNameMapper:
 *   'framer-motion': '<rootDir>/src/__tests__/mocks/framer-motion.ts'
 *
 * This eliminates the need for inline jest.mock('framer-motion', ...) blocks
 * in every test file that renders components using framer-motion.
 *
 * MIGRATION: Many test files still contain inline jest.mock('framer-motion') blocks.
 * Once the moduleNameMapper is active, those inline mocks can be removed one by one.
 * The inline mocks will still work (they override the mapper), so migration is incremental.
 */
import React from 'react';

// Create a wrapper that filters out Framer Motion props so they don't leak to the DOM
const createMotionComponent = (Component: any) => {
  return React.forwardRef(
    (
      {
        initial,
        animate,
        exit,
        transition,
        whileHover,
        whileTap,
        whileFocus,
        whileDrag,
        whileInView,
        layout,
        layoutId,
        variants,
        onAnimationStart,
        onAnimationComplete,
        ...props
      }: any,
      ref: any
    ) => React.createElement(Component, { ...props, ref })
  );
};

const mockMotion: any = createMotionComponent;
mockMotion.create = createMotionComponent;
mockMotion.div = createMotionComponent('div');
mockMotion.span = createMotionComponent('span');

export const motion = mockMotion;
export const AnimatePresence = ({ children }: any) => children;
export const useAnimation = () => ({
  start: jest.fn(),
  stop: jest.fn(),
  set: jest.fn(),
});
export const useInView = () => true;
export const useScroll = () => ({ scrollY: { get: () => 0 } });
export const useTransform = () => 0;
export const useMotionValue = (initial: any) => ({
  get: () => initial,
  set: jest.fn(),
  onChange: jest.fn(),
});
