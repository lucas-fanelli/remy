'use client';
import React from 'react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Person, Restaurant, Search } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
}

interface SearchResultsProps {
  query: string;
  users: User[];
  recipes: Recipe[];
  loading: boolean;
  onClose: () => void;
}

export default function SearchResults({ query, users, recipes, loading, onClose }: SearchResultsProps) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  const handleUserClick = (username: string) => {
    router.push(`/profile/${username}`);
    onClose();
  };

  const handleRecipeClick = (recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
    onClose();
  };

  const handleViewAllResults = () => {
    router.push(`/search?q=${encodeURIComponent(query)}`);
    onClose();
  };

  // Don't show anything if query is empty or only whitespace
  if (!query || query.trim().length === 0) return null;

  const hasResults = users.length > 0 || recipes.length > 0;

  // Prioritize users over recipes, limit to 3 results (plus the "Search 'query'" item = 4 total)
  const limitedUsers = users.slice(0, 3);
  const remainingSlots = 3 - limitedUsers.length;
  const limitedRecipes = recipes.slice(0, remainingSlots);

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        mt: 1,
        maxHeight: { xs: '60vh', sm: 500, md: 400 },
        overflow: 'auto',
        zIndex: 1000,
        boxShadow: 3,
      }}
    >
      {loading ? (
        null
      ) : !hasResults ? (
        <Box sx={{ py: { xs: 2, md: 3 }, px: { xs: 1.5, md: 2 }, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}>
            No results found for &ldquo;{query}&rdquo;
          </Typography>
        </Box>
      ) : (
        <List sx={{ py: 0 }}>
          {/* "Search 'query'" - View all results */}
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleViewAllResults}
              sx={{
                py: { xs: 1.25, md: 1.75 },
                px: { xs: 1.5, md: 2 },
                bgcolor: 'action.hover',
              }}
            >
              <ListItemAvatar sx={{ minWidth: { xs: 44, md: 56 } }}>
                <Avatar
                  sx={{
                    bgcolor: 'primary.main',
                    width: { xs: 32, md: 40 },
                    height: { xs: 32, md: 40 }
                  }}
                >
                  <Search sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={`Search "${query}"`}
                secondary="View all results"
                primaryTypographyProps={{
                  fontWeight: 600,
                  fontSize: { xs: '0.875rem', md: '1rem' },
                  color: 'text.primary',
                }}
                secondaryTypographyProps={{
                  fontSize: { xs: '0.75rem', md: '0.875rem' }
                }}
              />
            </ListItemButton>
          </ListItem>

          {/* Users (prioritized, up to 2) */}
          {limitedUsers.map((user) => (
            <React.Fragment key={user.id}>
              <Divider />
              <ListItem
                disablePadding
              >
                <ListItemButton
                  onClick={() => handleUserClick(user.username)}
                  sx={{
                    py: { xs: 1, md: 1.5 },
                    px: { xs: 1.5, md: 2 },
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: { xs: 44, md: 56 } }}>
                    <Avatar
                      src={user.avatar}
                      sx={{
                        bgcolor: 'primary.main',
                        width: { xs: 32, md: 40 },
                        height: { xs: 32, md: 40 }
                      }}
                    >
                      <Person sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.username}
                    secondary={isMobile ? null : user.email}
                    primaryTypographyProps={{
                      fontWeight: 600,
                      fontSize: { xs: '0.875rem', md: '1rem' },
                      color: 'text.primary',
                    }}
                    secondaryTypographyProps={{
                      fontSize: { xs: '0.75rem', md: '0.875rem' }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            </React.Fragment>
          ))}

          {/* Recipes (fill remaining slots) */}
          {limitedRecipes.map((recipe) => (
            <React.Fragment key={recipe.id}>
              <Divider />
              <ListItem
                disablePadding
              >
                <ListItemButton
                  onClick={() => handleRecipeClick(recipe.id)}
                  sx={{
                    py: { xs: 1, md: 1.5 },
                    px: { xs: 1.5, md: 2 },
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: { xs: 44, md: 56 } }}>
                    <Avatar
                      src={recipe.imageUrl}
                      variant="rounded"
                      sx={{
                        bgcolor: 'secondary.main',
                        width: { xs: 32, md: 40 },
                        height: { xs: 32, md: 40 }
                      }}
                    >
                      <Restaurant sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={recipe.title}
                    secondary={isMobile
                      ? null
                      : `${recipe.description.substring(0, 50)}${recipe.description.length > 50 ? '...' : ''}`
                    }
                    primaryTypographyProps={{
                      fontWeight: 600,
                      fontSize: { xs: '0.875rem', md: '1rem' },
                      color: 'text.primary',
                    }}
                    secondaryTypographyProps={{
                      fontSize: { xs: '0.75rem', md: '0.875rem' }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      )}
    </Paper>
  );
}
