'use client';
import React, { useRef } from 'react';
import { Box, Avatar, Typography, IconButton, Paper } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { motion } from 'framer-motion';

const MotionAvatar = motion(Avatar);

interface Story {
  id: string;
  username: string;
  avatar: string;
  hasStory: boolean;
}

const stories: Story[] = [
  { id: '1', username: 'Your story', avatar: '/avatar1.jpg', hasStory: true },
  { id: '2', username: 'john_doe', avatar: '/avatar2.jpg', hasStory: true },
  { id: '3', username: 'jane_smith', avatar: '/avatar3.jpg', hasStory: true },
  { id: '4', username: 'photography', avatar: '/avatar4.jpg', hasStory: true },
  { id: '5', username: 'travel_blog', avatar: '/avatar5.jpg', hasStory: true },
  { id: '6', username: 'food_lover', avatar: '/avatar6.jpg', hasStory: true },
  { id: '7', username: 'tech_news', avatar: '/avatar7.jpg', hasStory: true },
  { id: '8', username: 'fitness_pro', avatar: '/avatar8.jpg', hasStory: true },
];

export default function Stories() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 2,
        mb: 3,
        backgroundColor: 'background.paper',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* Left Arrow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'absolute',
            left: 0,
            zIndex: 2,
          }}
        >
          <IconButton
            onClick={() => scroll('left')}
            sx={{
              backgroundColor: 'background.paper',
              boxShadow: 2,
              '&:hover': { backgroundColor: 'background.paper' },
            }}
            size="small"
          >
            <ChevronLeft />
          </IconButton>
        </motion.div>

        {/* Stories Container */}
        <Box
          ref={scrollRef}
          sx={{
            display: 'flex',
            gap: 2,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            px: 5,
          }}
        >
          {stories.map((story, index) => (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  minWidth: 66,
                }}
              >
                <Box
                  sx={{
                    background: story.hasStory
                      ? 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
                      : 'transparent',
                    borderRadius: '50%',
                    padding: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MotionAvatar
                    src={story.avatar}
                    alt={story.username}
                    sx={{
                      width: 56,
                      height: 56,
                      border: 3,
                      borderColor: 'background.paper',
                    }}
                  />
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    maxWidth: 66,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '12px',
                  }}
                >
                  {story.username}
                </Typography>
              </Box>
            </motion.div>
          ))}
        </Box>

        {/* Right Arrow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'absolute',
            right: 0,
            zIndex: 2,
          }}
        >
          <IconButton
            onClick={() => scroll('right')}
            sx={{
              backgroundColor: 'background.paper',
              boxShadow: 2,
              '&:hover': { backgroundColor: 'background.paper' },
            }}
            size="small"
          >
            <ChevronRight />
          </IconButton>
        </motion.div>
      </Box>
    </Paper>
  );
}
