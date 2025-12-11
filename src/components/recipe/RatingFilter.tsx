'use client';

import React from 'react';
import { Box, Chip, Rating, Typography, useTheme, useMediaQuery } from '@mui/material';
import { Star } from '@mui/icons-material';

interface RatingFilterProps {
    value: number | null;
    onChange: (rating: number | null) => void;
}

const ratingOptions = [
    { value: 4, label: '4+ Stars' },
    { value: 3, label: '3+ Stars' },
    { value: 2, label: '2+ Stars' },
];

export default function RatingFilter({ value, onChange }: RatingFilterProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const handleClick = (rating: number) => {
        // Toggle off if same rating is clicked
        if (value === rating) {
            onChange(null);
        } else {
            onChange(rating);
        }
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, flexWrap: 'wrap' }}>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    display: { xs: 'none', sm: 'block' }
                }}
            >
                Filter:
            </Typography>
            {ratingOptions.map((option) => (
                <Chip
                    key={option.value}
                    icon={<Star sx={{ fontSize: { xs: 14, sm: 16 } }} />}
                    label={isMobile ? `${option.value}+` : option.label}
                    size={isMobile ? 'small' : 'medium'}
                    variant={value === option.value ? 'filled' : 'outlined'}
                    color={value === option.value ? 'warning' : 'default'}
                    onClick={() => handleClick(option.value)}
                    sx={{
                        fontWeight: value === option.value ? 600 : 400,
                        fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                        '& .MuiChip-icon': {
                            color: value === option.value ? 'inherit' : 'gold',
                        },
                    }}
                />
            ))}
            {value && (
                <Chip
                    label="Clear"
                    size="small"
                    variant="outlined"
                    onClick={() => onChange(null)}
                    sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                />
            )}
        </Box>
    );
}
