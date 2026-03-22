'use client';
import { Box, Paper, Card } from '@mui/material';
import { motion } from 'framer-motion';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MotionBox = motion.create(Box as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MotionPaper = motion.create(Paper as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MotionCard = motion.create(Card as any);
