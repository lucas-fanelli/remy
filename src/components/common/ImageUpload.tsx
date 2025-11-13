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
  CloudUpload,
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
}

export default function ImageUpload({
  value,
  onChange,
  label = 'Recipe Image',
  required = true,
  aspectRatio = 16 / 9,
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
              aspectRatio: aspectRatio,
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
            aspectRatio: aspectRatio,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'grey.100',
            border: 2,
            borderColor: required && !value ? 'error.main' : 'grey.300',
            borderStyle: 'dashed',
            cursor: 'pointer',
            transition: 'all 0.3s',
            '&:hover': {
              backgroundColor: 'grey.200',
              borderColor: 'primary.main',
            },
          }}
          onClick={handleUploadClick}
        >
          <Box sx={{ textAlign: 'center', p: 3 }}>
            {uploading ? (
              <>
                <CircularProgress size={48} sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Uploading...
                </Typography>
              </>
            ) : (
              <>
                <ImageIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                <Typography variant="body1" gutterBottom>
                  Click to upload an image
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  JPEG, PNG, WebP, or GIF (max 5MB)
                </Typography>
              </>
            )}
          </Box>
        </Card>
      )}

      {!value && (
        <Button
          variant="outlined"
          startIcon={<CloudUpload />}
          onClick={handleUploadClick}
          disabled={uploading}
          fullWidth
          sx={{ mt: 1 }}
        >
          {uploading ? 'Uploading...' : 'Choose Image'}
        </Button>
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
