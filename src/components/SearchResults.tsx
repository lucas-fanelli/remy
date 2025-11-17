'use client';
import React from 'react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Divider,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Person, Restaurant } from '@mui/icons-material';
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
  cuisine: string;
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

  if (!query) return null;

  const hasResults = users.length > 0 || recipes.length > 0;

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: '100%',
        left: { xs: '-100%', sm: 0 },
        right: { xs: '-100%', sm: 0 },
        mt: 1,
        maxHeight: { xs: '60vh', sm: 500, md: 400 },
        width: { xs: '100vw', sm: 'auto' },
        overflow: 'auto',
        zIndex: 1000,
        boxShadow: 3,
      }}
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : !hasResults ? (
        <Box sx={{ py: { xs: 2, md: 3 }, px: { xs: 1.5, md: 2 }, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}>
            No results found for "{query}"
          </Typography>
        </Box>
      ) : (
        <List sx={{ py: 0 }}>
          {/* Users Section */}
          {users.length > 0 && (
            <>
              <ListItem sx={{ bgcolor: 'background.default', py: { xs: 0.75, md: 1 } }}>
                <Typography
                  variant="caption"
                  fontWeight={600}
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.625rem', md: '0.75rem' } }}
                >
                  USERS
                </Typography>
              </ListItem>
              {users.map((user) => (
                <ListItem
                  key={user.id}
                  button
                  onClick={() => handleUserClick(user.username)}
                  sx={{
                    py: { xs: 1, md: 1.5 },
                    px: { xs: 1.5, md: 2 },
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
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
                      fontSize: { xs: '0.875rem', md: '1rem' }
                    }}
                    secondaryTypographyProps={{
                      fontSize: { xs: '0.75rem', md: '0.875rem' }
                    }}
                  />
                </ListItem>
              ))}
              {recipes.length > 0 && <Divider />}
            </>
          )}

          {/* Recipes Section */}
          {recipes.length > 0 && (
            <>
              <ListItem sx={{ bgcolor: 'background.default', py: { xs: 0.75, md: 1 } }}>
                <Typography
                  variant="caption"
                  fontWeight={600}
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.625rem', md: '0.75rem' } }}
                >
                  RECIPES
                </Typography>
              </ListItem>
              {recipes.map((recipe) => (
                <ListItem
                  key={recipe.id}
                  button
                  onClick={() => handleRecipeClick(recipe.id)}
                  sx={{
                    py: { xs: 1, md: 1.5 },
                    px: { xs: 1.5, md: 2 },
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
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
                      ? recipe.cuisine
                      : `${recipe.cuisine} • ${recipe.description.substring(0, 50)}${recipe.description.length > 50 ? '...' : ''}`
                    }
                    primaryTypographyProps={{
                      fontWeight: 600,
                      fontSize: { xs: '0.875rem', md: '1rem' }
                    }}
                    secondaryTypographyProps={{
                      fontSize: { xs: '0.75rem', md: '0.875rem' }
                    }}
                  />
                </ListItem>
              ))}
            </>
          )}
        </List>
      )}
    </Paper>
  );
}
