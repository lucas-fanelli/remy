'use client';
import { Box, Paper, Card } from '@mui/material';
import { motion } from 'framer-motion';
import type { ComponentType } from 'react';

// Cast needed because MUI's OverridableComponent type isn't directly compatible
// with framer-motion's expected ForwardRefExoticComponent signature.
export const MotionBox = motion.create(Box as unknown as ComponentType<Record<string, unknown>>);
export const MotionPaper = motion.create(
  Paper as unknown as ComponentType<Record<string, unknown>>
);
export const MotionCard = motion.create(Card as unknown as ComponentType<Record<string, unknown>>);
