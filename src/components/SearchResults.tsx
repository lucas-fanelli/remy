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
        left: 0,
        right: 0,
        mt: 1,
        maxHeight: 400,
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
        <Box sx={{ py: 3, px: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No results found for "{query}"
          </Typography>
        </Box>
      ) : (
        <List sx={{ py: 0 }}>
          {/* Users Section */}
          {users.length > 0 && (
            <>
              <ListItem sx={{ bgcolor: 'background.default' }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  USERS
                </Typography>
              </ListItem>
              {users.map((user) => (
                <ListItem
                  key={user.id}
                  button
                  onClick={() => handleUserClick(user.username)}
                  sx={{
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={user.avatar} sx={{ bgcolor: 'primary.main' }}>
                      <Person />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.username}
                    secondary={user.email}
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                </ListItem>
              ))}
              {recipes.length > 0 && <Divider />}
            </>
          )}

          {/* Recipes Section */}
          {recipes.length > 0 && (
            <>
              <ListItem sx={{ bgcolor: 'background.default' }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  RECIPES
                </Typography>
              </ListItem>
              {recipes.map((recipe) => (
                <ListItem
                  key={recipe.id}
                  button
                  onClick={() => handleRecipeClick(recipe.id)}
                  sx={{
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={recipe.imageUrl}
                      variant="rounded"
                      sx={{ bgcolor: 'secondary.main' }}
                    >
                      <Restaurant />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={recipe.title}
                    secondary={`${recipe.cuisine} • ${recipe.description.substring(0, 50)}${recipe.description.length > 50 ? '...' : ''}`}
                    primaryTypographyProps={{ fontWeight: 600 }}
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
