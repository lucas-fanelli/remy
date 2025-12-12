'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Paper,
    InputBase,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Typography,
    Divider,
    alpha,
    useTheme,
    ClickAwayListener,
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    TrendingUp as TrendingIcon,
    History as HistoryIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

const MotionPaper = motion.create(Paper);
const MotionBox = motion.create(Box);

// Mock trending searches - replace with real data as needed
const mockTrendingSuggestions = [
    'Pasta Carbonara',
    'Chocolate Cake',
    'Vegan Recipes',
    'Quick Dinner Ideas',
    'Healthy Breakfast',
];

interface PersistentSearchBarProps {
    /** Callback when search is submitted */
    onSearch?: (query: string) => void;
    /** Initial search value */
    initialValue?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Enable suggestions dropdown */
    showSuggestions?: boolean;
    /** Recent searches from history */
    recentSearches?: string[];
}

export default function PersistentSearchBar({
    onSearch,
    initialValue = '',
    placeholder = 'Search recipes, ingredients...',
    showSuggestions = true,
    recentSearches = [],
}: PersistentSearchBarProps) {
    const theme = useTheme();
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    const [query, setQuery] = useState(initialValue);
    const [isFocused, setIsFocused] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    // Handle focus
    const handleFocus = useCallback(() => {
        setIsFocused(true);
        if (showSuggestions) {
            setShowDropdown(true);
        }
    }, [showSuggestions]);

    // Handle blur with delay for clicks
    const handleBlur = useCallback(() => {
        // Small delay to allow click events on suggestions
        setTimeout(() => {
            setIsFocused(false);
        }, 150);
    }, []);

    // Handle click away
    const handleClickAway = useCallback(() => {
        setShowDropdown(false);
        setIsFocused(false);
    }, []);

    // Handle search submission
    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            setShowDropdown(false);
            if (onSearch) {
                onSearch(query.trim());
            } else {
                router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            }
        }
    }, [query, onSearch, router]);

    // Handle clear
    const handleClear = useCallback(() => {
        setQuery('');
        inputRef.current?.focus();
    }, []);

    // Handle suggestion click
    const handleSuggestionClick = useCallback((suggestion: string) => {
        setQuery(suggestion);
        setShowDropdown(false);
        if (onSearch) {
            onSearch(suggestion);
        } else {
            router.push(`/search?q=${encodeURIComponent(suggestion)}`);
        }
    }, [onSearch, router]);

    // Animation variants for the container
    const containerVariants = {
        rest: {
            scale: 1,
            boxShadow: theme.palette.mode === 'dark'
                ? '0 2px 8px rgba(0,0,0,0.3)'
                : '0 2px 8px rgba(0,0,0,0.08)',
        },
        focused: {
            scale: 1.02,
            boxShadow: theme.palette.mode === 'dark'
                ? '0 4px 20px rgba(0,0,0,0.5)'
                : '0 4px 20px rgba(0,0,0,0.15)',
        },
    };

    // Animation variants for dropdown
    const dropdownVariants = {
        hidden: {
            opacity: 0,
            y: -10,
            scaleY: 0.9,
            transformOrigin: 'top',
        },
        visible: {
            opacity: 1,
            y: 0,
            scaleY: 1,
            transition: {
                type: 'spring',
                stiffness: 400,
                damping: 25,
            },
        },
        exit: {
            opacity: 0,
            y: -5,
            transition: {
                duration: 0.15,
            },
        },
    };

    // Determine background color based on theme
    const backgroundColor = theme.palette.mode === 'dark'
        ? alpha(theme.palette.common.white, 0.12)
        : alpha(theme.palette.common.black, 0.04);

    const focusedBackgroundColor = theme.palette.mode === 'dark'
        ? alpha(theme.palette.common.white, 0.18)
        : alpha(theme.palette.common.black, 0.06);

    return (
        <ClickAwayListener onClickAway={handleClickAway}>
            <Box sx={{ position: 'relative', width: '100%', maxWidth: 600 }}>
                {/* Search Bar */}
                <MotionPaper
                    layoutId="search-bar-container"
                    component="form"
                    onSubmit={handleSubmit}
                    elevation={0}
                    variants={containerVariants}
                    initial="rest"
                    animate={isFocused ? 'focused' : 'rest'}
                    transition={{ duration: 0.2 }}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '24px',
                        backgroundColor: isFocused ? focusedBackgroundColor : backgroundColor,
                        px: 2.5,
                        py: 1,
                        transition: 'background-color 0.2s ease',
                        border: `1px solid ${isFocused
                            ? alpha(theme.palette.primary.main, 0.3)
                            : 'transparent'}`,
                    }}
                >
                    <SearchIcon
                        sx={{
                            color: isFocused
                                ? theme.palette.primary.main
                                : theme.palette.text.secondary,
                            mr: 1.5,
                            fontSize: 22,
                            transition: 'color 0.2s ease',
                        }}
                    />

                    <InputBase
                        inputRef={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder={placeholder}
                        fullWidth
                        sx={{
                            fontSize: '0.95rem',
                            '& input': {
                                py: 0.5,
                            },
                            '& input::placeholder': {
                                color: theme.palette.text.secondary,
                                opacity: 0.8,
                            },
                        }}
                        inputProps={{
                            'aria-label': 'Search recipes',
                        }}
                    />

                    {/* Clear button */}
                    <AnimatePresence>
                        {query && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.15 }}
                            >
                                <IconButton
                                    size="small"
                                    onClick={handleClear}
                                    sx={{
                                        ml: 0.5,
                                        color: theme.palette.text.secondary,
                                        '&:hover': {
                                            color: theme.palette.text.primary,
                                        },
                                    }}
                                    aria-label="Clear search"
                                >
                                    <ClearIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </MotionPaper>

                {/* Suggestions Dropdown */}
                <AnimatePresence>
                    {showDropdown && showSuggestions && (
                        <MotionBox
                            variants={dropdownVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            sx={{
                                position: 'absolute',
                                top: 'calc(100% + 8px)',
                                left: 0,
                                right: 0,
                                zIndex: theme.zIndex.modal,
                            }}
                        >
                            <Paper
                                elevation={8}
                                sx={{
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    maxHeight: 400,
                                    overflowY: 'auto',
                                }}
                            >
                                {/* Recent Searches */}
                                {recentSearches.length > 0 && (
                                    <>
                                        <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
                                            >
                                                Recent
                                            </Typography>
                                        </Box>
                                        <List dense disablePadding>
                                            {recentSearches.slice(0, 3).map((search, index) => (
                                                <ListItem key={`recent-${index}`} disablePadding>
                                                    <ListItemButton
                                                        onClick={() => handleSuggestionClick(search)}
                                                        sx={{ py: 1.25, px: 2 }}
                                                    >
                                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                                            <HistoryIcon
                                                                sx={{
                                                                    fontSize: 18,
                                                                    color: theme.palette.text.secondary
                                                                }}
                                                            />
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary={search}
                                                            primaryTypographyProps={{
                                                                fontSize: '0.9rem',
                                                            }}
                                                        />
                                                    </ListItemButton>
                                                </ListItem>
                                            ))}
                                        </List>
                                        <Divider sx={{ mx: 2, my: 0.5 }} />
                                    </>
                                )}

                                {/* Trending Searches */}
                                <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
                                    >
                                        Trending
                                    </Typography>
                                </Box>
                                <List dense disablePadding>
                                    {mockTrendingSuggestions.map((suggestion, index) => (
                                        <ListItem key={`trending-${index}`} disablePadding>
                                            <ListItemButton
                                                onClick={() => handleSuggestionClick(suggestion)}
                                                sx={{ py: 1.25, px: 2 }}
                                            >
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    <TrendingIcon
                                                        sx={{
                                                            fontSize: 18,
                                                            color: theme.palette.primary.main
                                                        }}
                                                    />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={suggestion}
                                                    primaryTypographyProps={{
                                                        fontSize: '0.9rem',
                                                    }}
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    ))}
                                </List>
                            </Paper>
                        </MotionBox>
                    )}
                </AnimatePresence>
            </Box>
        </ClickAwayListener>
    );
}
