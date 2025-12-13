'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
    Box,
    Paper,
    PaperProps,
    InputBase,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Typography,
    Divider,
    CircularProgress,
    alpha,
    useTheme,
    ClickAwayListener,
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence, MotionProps } from 'framer-motion';

// Strict Type: Paper + Motion + Polymorphic 'component' prop + form attributes
type MotionPaperProps = PaperProps & MotionProps & {
    component?: React.ElementType;
    onSubmit?: React.FormEventHandler<HTMLFormElement>;
};

const MotionPaper = motion.create(Paper) as React.FC<MotionPaperProps>;
const MotionBox = motion.create(Box);

// Types for live search results
interface SearchResultUser {
    id: string;
    username: string;
    fullName?: string | null;
    avatar?: string | null;
}

interface SearchResultRecipe {
    id: string;
    title: string;
    imageUrl?: string;
}

interface SearchResults {
    users: SearchResultUser[];
    recipes: SearchResultRecipe[];
}

interface PersistentSearchBarProps {
    /** Callback when search is submitted */
    onSearch?: (query: string) => void;
    /** Callback when query changes (for live search) */
    onQueryChange?: (query: string) => void;
    /** Initial search value */
    initialValue?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Enable suggestions dropdown */
    showSuggestions?: boolean;
    /** Recent searches from history */
    recentSearches?: string[];
    /** Live search results from parent */
    results?: SearchResults;
    /** Loading state for live search */
    loading?: boolean;
}

export default function PersistentSearchBar({
    onSearch,
    onQueryChange,
    initialValue = '',
    placeholder = 'Search recipes, ingredients...',
    showSuggestions = true,
    recentSearches = [],
    results,
    loading = false,
}: PersistentSearchBarProps) {
    const theme = useTheme();
    const router = useRouter();
    const pathname = usePathname(); // Used to force snap re-render on route change
    const inputRef = useRef<HTMLInputElement>(null);

    const [query, setQuery] = useState(initialValue);
    const [isFocused, setIsFocused] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    // Live search state
    const [liveResults, setLiveResults] = useState<SearchResults>({ users: [], recipes: [] });
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Check if user has typed something
    const hasQuery = query.trim().length > 0;

    // Debounced search effect
    useEffect(() => {
        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Don't search if query is too short
        if (query.trim().length < 2) {
            setLiveResults({ users: [], recipes: [] });
            setIsSearching(false);
            return;
        }

        // Set loading state
        setIsSearching(true);

        // Debounce: wait 300ms after user stops typing
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
                if (response.ok) {
                    const data = await response.json();
                    setLiveResults({
                        users: data.users || [],
                        recipes: data.recipes || [],
                    });
                }
            } catch (error) {
                console.error('Search error:', error);
                setLiveResults({ users: [], recipes: [] });
            } finally {
                setIsSearching(false);
            }
        }, 300);

        // Cleanup on unmount
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [query]);

    // Combine props results with live results (props take priority)
    const effectiveResults = results || liveResults;
    const effectiveLoading = loading || isSearching;

    // Track if we have live results from API
    const hasLiveResults = effectiveResults.users.length > 0 || effectiveResults.recipes.length > 0;

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
                {/* SIMPLIFIED Search Bar - No layout magic, just CSS transitions */}
                <Box
                    component="form"
                    onSubmit={handleSubmit}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '24px',
                        backgroundColor: isFocused ? focusedBackgroundColor : backgroundColor,
                        border: `1px solid ${isFocused
                            ? alpha(theme.palette.primary.main, 0.3)
                            : 'transparent'}`,
                        px: 2.5,
                        py: 1,
                        transition: 'all 0.2s ease', // CSS handles the container animation
                        transform: isFocused ? 'scale(1.02)' : 'scale(1)',
                        boxShadow: isFocused
                            ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.15)}`
                            : 'none',
                    }}
                >
                    {/* Content: Simple Fade Out/In on route change */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={pathname}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                width: '100%',
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
                                onChange={(e) => {
                                    const newQuery = e.target.value;
                                    setQuery(newQuery);
                                    onQueryChange?.(newQuery);
                                }}
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
                            {query && (
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
                            )}
                        </motion.div>
                    </AnimatePresence>
                </Box>

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
                                {/* "Search for [query]" option when user is typing */}
                                {hasQuery && (
                                    <List dense disablePadding>
                                        <ListItem disablePadding>
                                            <ListItemButton
                                                onClick={() => handleSuggestionClick(query.trim())}
                                                sx={{ py: 1.25, px: 2, backgroundColor: alpha(theme.palette.primary.main, 0.08) }}
                                            >
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    <SearchIcon
                                                        sx={{
                                                            fontSize: 18,
                                                            color: theme.palette.primary.main
                                                        }}
                                                    />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={`Search for "${query.trim()}"`}
                                                    primaryTypographyProps={{
                                                        fontSize: '0.9rem',
                                                        fontWeight: 500,
                                                    }}
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    </List>
                                )}

                                {/* Loading indicator */}
                                {effectiveLoading && hasQuery && (
                                    <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <CircularProgress size={16} />
                                        <Typography variant="caption" color="text.secondary">
                                            Searching...
                                        </Typography>
                                    </Box>
                                )}

                                {/* Live Results: Top 3 Recipes */}
                                {hasLiveResults && (
                                    <>
                                        {effectiveResults.recipes.length > 0 && (
                                            <>
                                                <Divider sx={{ mx: 2, my: 0.5 }} />
                                                <List dense disablePadding>
                                                    {effectiveResults.recipes.slice(0, 3).map((recipe) => (
                                                        <ListItem key={`recipe-${recipe.id}`} disablePadding>
                                                            <ListItemButton
                                                                onClick={() => {
                                                                    setShowDropdown(false);
                                                                    router.push(`/recipe/${recipe.id}`);
                                                                }}
                                                                sx={{ py: 1.25, px: 2 }}
                                                            >
                                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                                    <Box
                                                                        component="span"
                                                                        sx={{
                                                                            width: 24,
                                                                            height: 24,
                                                                            borderRadius: '4px',
                                                                            backgroundColor: alpha(theme.palette.warning.main, 0.2),
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            fontSize: 12,
                                                                        }}
                                                                    >
                                                                        🍳
                                                                    </Box>
                                                                </ListItemIcon>
                                                                <ListItemText
                                                                    primary={recipe.title}
                                                                    primaryTypographyProps={{
                                                                        fontSize: '0.9rem',
                                                                    }}
                                                                />
                                                            </ListItemButton>
                                                        </ListItem>
                                                    ))}
                                                </List>
                                            </>
                                        )}

                                        {/* Live Results: Users */}
                                        {effectiveResults.users.length > 0 && (
                                            <>
                                                <Divider sx={{ mx: 2, my: 0.5 }} />
                                                <List dense disablePadding>
                                                    {effectiveResults.users.slice(0, 2).map((user) => (
                                                        <ListItem key={`user-${user.id}`} disablePadding>
                                                            <ListItemButton
                                                                onClick={() => {
                                                                    setShowDropdown(false);
                                                                    router.push(`/profile/${user.username}`);
                                                                }}
                                                                sx={{ py: 1.25, px: 2 }}
                                                            >
                                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                                    <Box
                                                                        component="span"
                                                                        sx={{
                                                                            width: 24,
                                                                            height: 24,
                                                                            borderRadius: '50%',
                                                                            backgroundColor: alpha(theme.palette.info.main, 0.2),
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            fontSize: 12,
                                                                        }}
                                                                    >
                                                                        👤
                                                                    </Box>
                                                                </ListItemIcon>
                                                                <ListItemText
                                                                    primary={user.fullName || user.username}
                                                                    secondary={user.fullName ? `@${user.username}` : undefined}
                                                                    primaryTypographyProps={{
                                                                        fontSize: '0.9rem',
                                                                    }}
                                                                    secondaryTypographyProps={{
                                                                        fontSize: '0.75rem',
                                                                    }}
                                                                />
                                                            </ListItemButton>
                                                        </ListItem>
                                                    ))}
                                                </List>
                                            </>
                                        )}
                                    </>
                                )}

                                {/* No results found */}
                                {hasQuery && !effectiveLoading && !hasLiveResults && (
                                    <Box sx={{ px: 2, py: 2, textAlign: 'center' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            No matching recipes found
                                        </Typography>
                                    </Box>
                                )}

                                {/* Show suggestions when no query */}
                                {!hasQuery && !effectiveLoading && (
                                    <>
                                        {/* Recent Searches */}
                                        {recentSearches.length > 0 && (
                                            <>
                                                <Box sx={{ px: 2, py: 1 }}>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
                                                    >
                                                        Recent Searches
                                                    </Typography>
                                                </Box>
                                                <List dense disablePadding>
                                                    {recentSearches.slice(0, 3).map((search, index) => (
                                                        <ListItem key={`recent-${index}`} disablePadding>
                                                            <ListItemButton
                                                                onClick={() => handleSuggestionClick(search)}
                                                                sx={{ py: 1, px: 2 }}
                                                            >
                                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                                    <Box
                                                                        component="span"
                                                                        sx={{
                                                                            width: 24,
                                                                            height: 24,
                                                                            borderRadius: '50%',
                                                                            backgroundColor: alpha(theme.palette.grey[500], 0.15),
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            fontSize: 12,
                                                                        }}
                                                                    >
                                                                        🕒
                                                                    </Box>
                                                                </ListItemIcon>
                                                                <ListItemText
                                                                    primary={search}
                                                                    primaryTypographyProps={{ fontSize: '0.9rem' }}
                                                                />
                                                            </ListItemButton>
                                                        </ListItem>
                                                    ))}
                                                </List>
                                                <Divider sx={{ mx: 2, my: 0.5 }} />
                                            </>
                                        )}

                                        {/* Fallback when no recent searches */}
                                        {recentSearches.length === 0 && (
                                            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Type to search recipes...
                                                </Typography>
                                            </Box>
                                        )}
                                    </>
                                )}
                            </Paper>
                        </MotionBox>
                    )}
                </AnimatePresence>
            </Box>
        </ClickAwayListener>
    );
}
