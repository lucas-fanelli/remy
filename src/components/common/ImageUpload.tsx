'use client';
import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardMedia,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Delete,
  Image as ImageIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const MotionCard = motion.create(Card);

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  required?: boolean;
  aspectRatio?: number;
  compact?: boolean;
}

export default function ImageUpload({
  value,
  onChange,
  label = 'Recipe Image',
  required = true,
  aspectRatio = 16 / 9,
  compact = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 5MB.');
      return;
    }

    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      onChange(data.url);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onChange('');
    setError('');
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {label} {required && <span style={{ color: 'red' }}>*</span>}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {value ? (
        <MotionCard
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          sx={{ position: 'relative', mb: 2 }}
        >
          <CardMedia
            component="img"
            image={value}
            alt="Recipe preview"
            sx={{
              width: '100%',
              aspectRatio: compact ? 'auto' : aspectRatio,
              height: compact ? 120 : 'auto',
              objectFit: 'cover',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              gap: 1,
            }}
          >
            <IconButton
              onClick={handleRemove}
              sx={{
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.8)',
                },
              }}
              size="small"
              aria-label="Remove image"
            >
              <Delete />
            </IconButton>
          </Box>
        </MotionCard>
      ) : (
        <Card
          sx={{
            aspectRatio: compact ? 'auto' : aspectRatio,
            height: compact ? 120 : 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'action.hover',
            border: 2,
            borderColor: required && !value ? 'error.main' : 'divider',
            borderStyle: 'dashed',
            cursor: 'pointer',
            transition: 'all 0.3s',
            '&:hover': {
              backgroundColor: 'action.selected',
              borderColor: 'primary.main',
            },
          }}
          onClick={handleUploadClick}
        >
          <Box sx={{ textAlign: 'center', p: compact ? 1.5 : 3 }}>
            {uploading ? (
              <>
                <CircularProgress size={compact ? 32 : 48} sx={{ mb: compact ? 1 : 2 }} />
                <Typography variant={compact ? 'caption' : 'body2'} color="text.secondary">
                  Uploading...
                </Typography>
              </>
            ) : (
              <>
                <ImageIcon sx={{ fontSize: compact ? 40 : 64, color: 'text.disabled', mb: compact ? 1 : 2 }} />
                <Typography variant={compact ? 'body2' : 'body1'} gutterBottom color="text.primary">
                  Click to upload an image
                </Typography>
                {!compact && (
                  <Typography variant="caption" color="text.secondary">
                    JPEG, PNG, WebP, or GIF (max 5MB)
                  </Typography>
                )}
              </>
            )}
          </Box>
        </Card>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </Box>
  );
}
