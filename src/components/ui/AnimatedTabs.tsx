'use client';

import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface TabItem {
  key: string | number;
  label: string;
  icon?: ReactNode;
}

interface AnimatedTabsProps {
  tabs: TabItem[];
  activeKey: string | number;
  onChange: (key: string | number) => void;
  centered?: boolean;
}

/**
 * AnimatedTabs - Material Design Tabs with Sliding Indicator
 *
 * Uses Framer Motion layoutId for the sliding underline animation.
 * The indicator morphs seamlessly between tabs using spring physics.
 */
export default function AnimatedTabs({
  tabs,
  activeKey,
  onChange,
  centered = true,
}: AnimatedTabsProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: centered ? 'center' : 'flex-start',
        borderBottom: 1,
        borderColor: 'divider',
        gap: { xs: 2, sm: 4 },
        position: 'relative',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;

        return (
          <Box
            key={tab.key}
            onClick={() => onChange(tab.key)}
            sx={{
              position: 'relative',
              px: { xs: 1, sm: 2 },
              py: 1.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              transition: 'color 0.2s',
              color: isActive ? 'primary.main' : 'text.secondary',
              '&:hover': {
                color: isActive ? 'primary.main' : 'text.primary',
              },
            }}
          >
            {/* Tab Icon */}
            {tab.icon && <Box sx={{ display: 'flex', alignItems: 'center' }}>{tab.icon}</Box>}

            {/* Tab Label */}
            <Typography
              variant="button"
              sx={{
                fontWeight: isActive ? 600 : 500,
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {tab.label}
            </Typography>

            {/* Sliding Indicator - Uses layoutId for morph animation */}
            {isActive && (
              <motion.div
                layoutId="active-tab-indicator"
                style={{
                  position: 'absolute',
                  bottom: 2,
                  left: 12,
                  right: 12,
                  height: 3,
                  backgroundColor: theme.palette.primary.main,
                  borderRadius: 3,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 35,
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
