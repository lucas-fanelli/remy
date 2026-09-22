'use client';

import { Add, Edit, Delete, Kitchen, FilterList, Search } from '@mui/icons-material';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Autocomplete,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import React, { useState, useEffect, useCallback } from 'react';
import PageFrame from '@/components/layout/PageFrame';
import { MotionCard } from '@/components/motion';
import { useAuth } from '@/contexts/AuthContext';
import { useUnitLabels } from '@/i18n/units';
import { readBody } from '@/lib/api/readBody';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import { UNIT_TO_TASTE } from '@/lib/constants';

interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  expiresAt: string | null;
  notes: string | null;
  addedAt: string;
}

const categories = ['vegetable', 'protein', 'dairy', 'grain', 'spice', 'fruit', 'other'];
const units = ['g', 'kg', 'mL', 'l', 'units', 'cups', 'tbsp', 'tsp', 'oz', 'lbs'];

/**
 * Which branch of the `pantry.categories` select a stored category picks. The stored value
 * 'other' cannot name a branch of its own - in ICU `other` IS the catch-all - so it travels
 * as 'misc', and anything a user typed falls through to the catch-all, which renders the
 * stored text unchanged.
 */
const CATEGORY_SELECTORS: Record<string, string> = { other: 'misc' };

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default function PantryPage() {
  const t = useTranslations('pantry');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const unitLabels = useUnitLabels();
  const apiErrorMessage = useApiErrorMessage();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** A pantry that cannot be read is not an empty pantry, and the page must say which. */
  const [loadFailed, setLoadFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
  const [existingItem, setExistingItem] = useState<PantryItem | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    unit: 'g',
    category: 'other',
    notes: '',
  });

  // What a category is CALLED. The stored value itself never moves: a category the user
  // typed is shown back exactly as it was saved, only the seeded ones have a translation.
  const categoryLabel = useCallback(
    (category: string) =>
      t('categories', {
        category: CATEGORY_SELECTORS[category] ?? category,
        fallback: capitalise(category),
      }),
    [t]
  );

  // ...and the way back, for the free-text side of the picker: typing "Verdura" has to save
  // 'vegetable', because that is what the pantry matcher compares recipes against.
  const storedCategory = useCallback(
    (typed: string) => {
      const normalised = typed.toLowerCase().trim();
      return (
        categories.find((category) => categoryLabel(category).toLowerCase() === normalised) ??
        normalised
      );
    },
    [categoryLabel]
  );

  /** '250 g', '2 tazas', 'a gusto' - a measurement, so only the unit label is translated. */
  const describeAmount = useCallback(
    (quantity: number, unit: string) =>
      quantity === 0
        ? unitLabels.label(UNIT_TO_TASTE)
        : `${format.number(quantity)} ${unitLabels.label(unit, quantity)}`,
    [format, unitLabels]
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadPantry = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pantry');

      if (!response.ok) {
        // Was silent, and the empty state it fell into is unusually costly here: an
        // unreadable pantry renders as "your pantry is empty", which is also what the home
        // page's whole matching block keys off. A 500 told you to go and add ingredients
        // you had already added.
        setLoadFailed(true);
        setSnackbar({
          open: true,
          message: apiErrorMessage(await readBody(response), t('feedback.loadFailed')),
          severity: 'error',
        });
        return;
      }

      setLoadFailed(false);
      const data = await response.json();
      setItems(data.pantry.items);
    } catch (error) {
      console.error('Error loading pantry:', error);
      setLoadFailed(true);
      setSnackbar({ open: true, message: t('feedback.loadFailed'), severity: 'error' });
    } finally {
      setLoading(false);
    }
    // Both stable: next-intl memoises `t` per locale and `apiErrorMessage` depends only
    // on it, which matters because the mount effect below depends on this callback.
  }, [t, apiErrorMessage]);

  useEffect(() => {
    if (!authLoading) {
      if (isAuthenticated) {
        loadPantry();
      } else {
        setLoading(false);
      }
    }
  }, [isAuthenticated, authLoading, loadPantry]);

  const handleOpenDialog = (item?: PantryItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        quantity: item.quantity.toString(),
        unit: item.unit,
        category: item.category || 'other',
        notes: item.notes || '',
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        quantity: '',
        unit: 'g',
        category: 'other',
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setSnackbar({ open: true, message: t('feedback.nameRequired'), severity: 'error' });
      return;
    }

    // Use the category from formData, trim it, and default to 'other' only if empty
    const categoryToSave = formData.category.trim() || 'other';

    // Support "to taste" - use 0 for quantity if not provided.
    // Always send as a number (parseFloat) so the API receives a numeric type.
    const quantity =
      formData.quantity && parseFloat(formData.quantity) > 0 ? parseFloat(formData.quantity) : 0;

    try {
      const url = editingItem ? `/api/pantry/${editingItem.id}` : '/api/pantry';
      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'fetch',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          quantity: quantity || 0,
          unit: formData.unit,
          category: categoryToSave,
          notes: formData.notes.trim() || null,
        }),
      });

      if (response.ok) {
        await loadPantry();
        handleCloseDialog();
        setSnackbar({
          open: true,
          message: editingItem ? t('feedback.updated') : t('feedback.added'),
          severity: 'success',
        });
      } else if (response.status === 409) {
        // Server detected duplicate ingredient — offer to modify existing
        const data = await response.json();
        const existingIngredient = items.find(
          (item) => item.name.toLowerCase() === formData.name.trim().toLowerCase()
        );
        if (existingIngredient) {
          setExistingItem(existingIngredient);
          setModifyDialogOpen(true);
        } else {
          setSnackbar({
            open: true,
            message: apiErrorMessage(data, t('feedback.alreadyExists')),
            severity: 'error',
          });
        }
      } else {
        const error = await response.json();
        setSnackbar({
          open: true,
          message: apiErrorMessage(error, t('feedback.saveFailed')),
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error saving item:', error);
      setSnackbar({ open: true, message: t('feedback.saveFailed'), severity: 'error' });
    }
  };

  const handleModifyExisting = () => {
    if (existingItem) {
      handleOpenDialog(existingItem);
      setModifyDialogOpen(false);
      setExistingItem(null);
    }
  };

  const handleCancelModify = () => {
    setModifyDialogOpen(false);
    setExistingItem(null);
  };

  const handleDeleteClick = (itemId: string) => {
    setItemToDelete(itemId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/pantry/${itemToDelete}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'fetch' },
      });

      if (response.ok) {
        await loadPantry();
        setSnackbar({ open: true, message: t('feedback.deleted'), severity: 'success' });
      } else {
        const error = await response.json();
        setSnackbar({
          open: true,
          message: apiErrorMessage(error, t('feedback.deleteFailed')),
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      setSnackbar({ open: true, message: t('feedback.deleteFailed'), severity: 'error' });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  // Get all unique categories from items (both predefined and custom)
  const allCategories = React.useMemo(() => {
    const customCategories = new Set(items.map((item) => item.category).filter(Boolean));
    const combined = new Set([...categories, ...Array.from(customCategories)]);
    return Array.from(combined).sort();
  }, [items]);

  const filteredItems = items.filter((item) => {
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesSearch =
      !debouncedSearch ||
      item.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (item.notes && item.notes.toLowerCase().includes(debouncedSearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const groupedItems = filteredItems.reduce(
    (acc, item) => {
      const category = item.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, PantryItem[]>
  );

  // Return null during loading - the global LoadingBar shows progress
  // Guard clauses for loading states
  if (authLoading) {
    return null;
  }

  if (loading) {
    return null;
  }

  // Guest user - show sign-in prompt
  if (!isAuthenticated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <PageFrame>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
            <Kitchen sx={{ fontSize: 40, color: 'primary.main' }} />
            <Typography variant="h4" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {t('title')}
            </Typography>
          </Box>
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Kitchen sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
              {t('guest.title')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {t('guest.description')}
            </Typography>
            <Button variant="contained" size="large" onClick={() => router.push('/auth')}>
              {t('guest.action')}
            </Button>
          </Card>
        </PageFrame>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <PageFrame>
        {/* Note: Back button is now in the Navigation component */}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Kitchen sx={{ fontSize: 40, color: 'primary.main' }} />
            <Typography variant="h4" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {t('title')}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            size="large"
          >
            {t('actions.add')}
          </Button>
        </Box>

        {/* Search and Filter */}
        <Card sx={{ mb: 3, p: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <TextField
              placeholder={t('filters.search')}
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              sx={{ flex: 1 }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FilterList />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>{t('filters.category')}</InputLabel>
                <Select
                  value={categoryFilter}
                  label={t('filters.category')}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="all">{t('filters.allCategories')}</MenuItem>
                  {allCategories.map(
                    (cat) =>
                      cat && (
                        <MenuItem key={cat} value={cat}>
                          {categoryLabel(cat)}
                        </MenuItem>
                      )
                  )}
                </Select>
              </FormControl>
              <Chip label={t('filters.count', { count: filteredItems.length })} color="primary" />
            </Box>
          </Box>
        </Card>

        {/* Items by Category.
            The failure branch comes first and deliberately does NOT invite you to add
            your first ingredient: that is the single most misleading thing this page can
            say to someone whose pantry is full and unreadable. */}
        {loadFailed && items.length === 0 ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={loadPantry}>
                {tCommon('actions.retry')}
              </Button>
            }
          >
            {t('feedback.loadFailed')}
          </Alert>
        ) : filteredItems.length === 0 ? (
          <Card sx={{ p: 6, textAlign: 'center' }}>
            <Kitchen sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('empty.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t('empty.description')}
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>
              {t('actions.addFirst')}
            </Button>
          </Card>
        ) : (
          <Grid container spacing={2}>
            {Object.entries(groupedItems).map(([category, categoryItems]) => (
              <Grid item xs={12} md={6} key={category}>
                <MotionCard
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <CardContent>
                    <Typography
                      variant="h6"
                      sx={{ mb: 2, textTransform: 'capitalize', fontWeight: 600 }}
                    >
                      {categoryLabel(category)}
                    </Typography>
                    <List dense>
                      <AnimatePresence>
                        {categoryItems.map((item, index) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <ListItem>
                              <ListItemText
                                primary={item.name}
                                secondary={`${describeAmount(item.quantity, item.unit)}${item.notes ? ` • ${item.notes}` : ''}`}
                              />
                              <ListItemSecondaryAction>
                                <IconButton
                                  edge="end"
                                  size="small"
                                  onClick={() => handleOpenDialog(item)}
                                  sx={{ mr: 1 }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                                <IconButton
                                  edge="end"
                                  size="small"
                                  onClick={() => handleDeleteClick(item.id)}
                                  color="error"
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </ListItemSecondaryAction>
                            </ListItem>
                            {index < categoryItems.length - 1 && <Divider />}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </List>
                  </CardContent>
                </MotionCard>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{editingItem ? t('dialog.editTitle') : t('dialog.addTitle')}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label={t('dialog.name')}
                fullWidth
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoComplete="off"
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label={t('dialog.quantity')}
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  helperText={t('dialog.quantityHelper')}
                  sx={{ flex: 1 }}
                  autoComplete="off"
                />
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel>{t('dialog.unit')}</InputLabel>
                  <Select
                    value={formData.unit}
                    label={t('dialog.unit')}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  >
                    {units.map((unit) => (
                      // The stored code is the value; the plural label is only what is read
                      <MenuItem key={unit} value={unit}>
                        {unitLabels.label(unit, 2)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Autocomplete
                freeSolo
                options={allCategories}
                value={formData.category}
                onChange={(event, newValue) => {
                  // Allow null/empty values
                  const value = newValue ? storedCategory(newValue) : '';
                  setFormData({ ...formData, category: value });
                }}
                onInputChange={(event, newInputValue, reason) => {
                  // When user types, pastes, or clears, update the category
                  if (reason === 'input' || reason === 'clear') {
                    setFormData({ ...formData, category: storedCategory(newInputValue) });
                  }
                }}
                getOptionLabel={(option) => (option ? categoryLabel(option) : '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('dialog.category')}
                    placeholder={t('dialog.categoryPlaceholder')}
                    fullWidth
                    // What the free text resolves to, as a LABEL - so English keeps its old
                    // "Will be saved as: Vegetable" (the stored value capitalised, which is
                    // what it always said) and Spanish only names the category, because
                    // 'vegetable' is what actually travels to the API.
                    helperText={
                      formData.category
                        ? t('dialog.categoryHelper', {
                            category: categoryLabel(formData.category),
                          })
                        : ''
                    }
                  />
                )}
              />
              <TextField
                label={t('dialog.notes')}
                fullWidth
                multiline
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                autoComplete="off"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>{tCommon('actions.cancel')}</Button>
            <Button onClick={handleSubmit} variant="contained">
              {editingItem ? tCommon('actions.update') : tCommon('actions.add')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} maxWidth="xs" fullWidth>
          <DialogTitle>{t('delete.title')}</DialogTitle>
          <DialogContent>
            <Typography>{t('delete.message')}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel} color="inherit">
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
              {tCommon('actions.delete')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modify Existing Ingredient Dialog */}
        <Dialog open={modifyDialogOpen} onClose={handleCancelModify} maxWidth="xs" fullWidth>
          <DialogTitle>{t('duplicate.title')}</DialogTitle>
          <DialogContent>
            <Typography>
              {t('duplicate.message', {
                name: existingItem?.name ?? '',
                amount: describeAmount(existingItem?.quantity ?? 0, existingItem?.unit ?? ''),
              })}
            </Typography>
            <Typography sx={{ mt: 2 }}>{t('duplicate.question')}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancelModify} color="inherit">
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handleModifyExisting} color="primary" variant="contained">
              {t('duplicate.action')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            variant="filled"
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </PageFrame>
    </motion.div>
  );
}
