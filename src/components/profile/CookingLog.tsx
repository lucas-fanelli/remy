'use client';
import { Restaurant } from '@mui/icons-material';
import { Alert, Avatar, Box, Button, CircularProgress, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import React from 'react';

/**
 * What this reader has cooked, newest first.
 *
 * The endpoint behind it — paginated, joined to the recipe — was written long before this
 * and never called once. Cooking was recorded from the start and could not be looked at,
 * which is most of why marking something cooked felt like it did nothing.
 */
interface CookedEntry {
  id: string;
  cookedAt: string;
  post: {
    id: string;
    title: string | null;
    imageUrl: string;
    user: { username: string; avatar: string | null } | null;
  } | null;
}

const PAGE_SIZE = 20;

export default function CookingLog() {
  const t = useTranslations('profile');
  const format = useFormatter();
  const router = useRouter();

  const [entries, setEntries] = React.useState<CookedEntry[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  const load = React.useCallback(async (which: number) => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/cooked-recipes?page=${which}&limit=${PAGE_SIZE}`, {
        headers: { 'X-Requested-With': 'fetch' },
      });
      if (!response.ok) throw new Error('Failed to load the cooking log');

      const data = await response.json();
      setEntries((previous) =>
        which === 1 ? data.cookedRecipes : [...previous, ...data.cookedRecipes]
      );
      setTotalPages(data.totalPages ?? 1);
      setPage(which);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(1);
  }, [load]);

  if (loading && entries.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (failed && entries.length === 0) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        {t('cooked.loadFailed')}
      </Alert>
    );
  }

  if (entries.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: { xs: 6, md: 8 } }}>
        <Restaurant sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {t('cooked.emptyTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('cooked.emptyBody')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {entries.map((entry) => (
          <Box
            key={entry.id}
            component="button"
            onClick={() => entry.post && router.push(`/recipe/${entry.post.id}`)}
            disabled={!entry.post}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 1,
              width: '100%',
              border: 0,
              borderRadius: 2,
              background: 'none',
              textAlign: 'left',
              font: 'inherit',
              color: 'inherit',
              cursor: entry.post ? 'pointer' : 'default',
              '&:hover': { backgroundColor: 'action.hover' },
            }}
          >
            <Avatar
              src={entry.post?.imageUrl || undefined}
              variant="rounded"
              sx={{ width: 56, height: 56 }}
            >
              <Restaurant />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>
                {/* A recipe can be deleted after you cooked it; the entry outlives it. */}
                {entry.post?.title || t('cooked.recipeGone')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {format.dateTime(new Date(entry.cookedAt), {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {page < totalPages && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button onClick={() => load(page + 1)} disabled={loading}>
            {t('cooked.loadMore')}
          </Button>
        </Box>
      )}

      {failed && entries.length > 0 && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('cooked.loadFailed')}
        </Alert>
      )}
    </Box>
  );
}
