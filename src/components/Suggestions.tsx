'use client';
import React from 'react';
import { Box, Avatar, Typography, Button, Paper } from '@mui/material';
import { motion } from 'framer-motion';

const MotionButton = motion(Button);

interface Suggestion {
  id: string;
  username: string;
  avatar: string;
  subtitle: string;
}

const suggestions: Suggestion[] = [
  { id: '1', username: 'sarah_designs', avatar: '/avatar9.jpg', subtitle: 'Followed by user1 + 2 more' },
  { id: '2', username: 'alex_photos', avatar: '/avatar10.jpg', subtitle: 'Followed by user2 + 3 more' },
  { id: '3', username: 'mike_codes', avatar: '/avatar11.jpg', subtitle: 'New to Recipe Sharing' },
  { id: '4', username: 'emma_art', avatar: '/avatar12.jpg', subtitle: 'Followed by user3 + 1 more' },
  { id: '5', username: 'david_music', avatar: '/avatar13.jpg', subtitle: 'Followed by user4' },
];

export default function Suggestions() {
  return (
    <Paper
      elevation={0}
      sx={{
        position: 'sticky',
        top: 88,
        p: 2,
        backgroundColor: 'transparent',
      }}
    >
      {/* User Profile */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Avatar src="/avatar.jpg" sx={{ width: 56, height: 56, mr: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              your_username
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Your Name
            </Typography>
          </Box>
          <Button size="small" sx={{ textTransform: 'none', fontWeight: 600 }}>
            Switch
          </Button>
        </Box>
      </motion.div>

      {/* Suggestions Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
          Suggestions For You
        </Typography>
        <Typography
          variant="caption"
          fontWeight={600}
          sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}
        >
          See All
        </Typography>
      </Box>

      {/* Suggestions List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {suggestions.map((suggestion, index) => (
          <motion.div
            key={suggestion.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Avatar src={suggestion.avatar} sx={{ width: 32, height: 32, mr: 2 }} />
              </motion.div>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '14px' }}>
                  {suggestion.username}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '12px' }}>
                  {suggestion.subtitle}
                </Typography>
              </Box>
              <MotionButton
                size="small"
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '12px' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Follow
              </MotionButton>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* Footer */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px', lineHeight: 1.5 }}>
          About · Help · Press · API · Jobs · Privacy · Terms · Locations · Language · Meta Verified
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, fontSize: '11px' }}>
          © 2025 RECIPE SHARING APP
        </Typography>
      </Box>
    </Paper>
  );
}
