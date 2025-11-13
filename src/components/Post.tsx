'use client';
import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardMedia,
  CardContent,
  CardActions,
  Avatar,
  IconButton,
  Typography,
  Box,
  Collapse,
  TextField,
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  ChatBubbleOutline,
  Send,
  BookmarkBorder,
  Bookmark,
  MoreVert,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

const MotionIconButton = motion(IconButton);
const MotionCard = motion(Card);

interface PostProps {
  username: string;
  avatar: string;
  image: string;
  likes: number;
  caption: string;
  timestamp: string;
  comments?: { username: string; text: string }[];
}

export default function Post({
  username,
  avatar,
  image,
  likes: initialLikes,
  caption,
  timestamp,
  comments = [],
}: PostProps) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(initialLikes);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [localComments, setLocalComments] = useState(comments);

  const handleLike = () => {
    setLiked(!liked);
    setLikes(liked ? likes - 1 : likes + 1);
  };

  const handleComment = () => {
    if (comment.trim()) {
      setLocalComments([...localComments, { username: 'you', text: comment }]);
      setComment('');
    }
  };

  const handleDoubleClick = () => {
    if (!liked) {
      setLiked(true);
      setLikes(likes + 1);
    }
  };

  return (
    <MotionCard
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      sx={{
        maxWidth: 614,
        width: '100%',
        mb: 3,
        borderRadius: 1,
      }}
    >
      {/* Header */}
      <CardHeader
        avatar={
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <Avatar src={avatar} alt={username} />
          </motion.div>
        }
        action={
          <MotionIconButton whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <MoreVert />
          </MotionIconButton>
        }
        title={
          <Typography variant="subtitle2" fontWeight={600}>
            {username}
          </Typography>
        }
        subheader={timestamp}
      />

      {/* Image */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
        onDoubleClick={handleDoubleClick}
      >
        <CardMedia
          component="img"
          image={image}
          alt="Post"
          sx={{
            width: '100%',
            aspectRatio: '1 / 1',
            objectFit: 'cover',
          }}
        />
        <AnimatePresence>
          {liked && (
            <motion.div
              key="heart"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1.5 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
              }}
            >
              <Favorite sx={{ fontSize: 100, color: 'white', filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {/* Actions */}
      <CardActions disableSpacing sx={{ px: 2, py: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
          <MotionIconButton
            onClick={handleLike}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <motion.div
              animate={liked ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              {liked ? (
                <Favorite sx={{ color: 'error.main' }} />
              ) : (
                <FavoriteBorder />
              )}
            </motion.div>
          </MotionIconButton>

          <MotionIconButton
            onClick={() => setShowComments(!showComments)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ChatBubbleOutline />
          </MotionIconButton>

          <MotionIconButton whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Send />
          </MotionIconButton>
        </Box>

        <MotionIconButton
          onClick={() => setSaved(!saved)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {saved ? <Bookmark /> : <BookmarkBorder />}
        </MotionIconButton>
      </CardActions>

      {/* Content */}
      <CardContent sx={{ pt: 0 }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            {likes.toLocaleString()} likes
          </Typography>
          <Typography variant="body2">
            <Typography component="span" variant="body2" fontWeight={600}>
              {username}
            </Typography>{' '}
            {caption}
          </Typography>
          {localComments.length > 0 && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1, cursor: 'pointer' }}
              onClick={() => setShowComments(!showComments)}
            >
              View all {localComments.length} comments
            </Typography>
          )}
        </motion.div>

        {/* Comments Section */}
        <Collapse in={showComments}>
          <Box sx={{ mt: 2 }}>
            {localComments.map((cmt, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <Typography component="span" variant="body2" fontWeight={600}>
                    {cmt.username}
                  </Typography>{' '}
                  {cmt.text}
                </Typography>
              </motion.div>
            ))}
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleComment();
                  }
                }}
                variant="standard"
              />
              <MotionIconButton
                size="small"
                onClick={handleComment}
                disabled={!comment.trim()}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Send fontSize="small" />
              </MotionIconButton>
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </MotionCard>
  );
}
