'use client';
import React, { useState, useEffect } from 'react';
import {
  Container,
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
  Fab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Toolbar,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Kitchen,
  FilterList,
  ArrowBack,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import LoadingWithProgress from '@/components/common/LoadingWithProgress';

const MotionCard = motion.create(Card);

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
const units = ['g', 'kg', 'ml', 'l', 'units', 'cups', 'tbsp', 'tsp', 'oz', 'lbs'];

export default function PantryPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    unit: 'g',
    category: 'other',
    notes: '',
  });

  useEffect(() => {
    if (!token) {
      router.push('/auth');
      return;
    }
    loadPantry();
  }, [token]);

  const loadPantry = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pantry', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setItems(data.pantry.items);
      }
    } catch (error) {
      console.error('Error loading pantry:', error);
      setSnackbar({ open: true, message: 'Failed to load pantry', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

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
    if (!formData.name.trim() || !formData.quantity || parseFloat(formData.quantity) <= 0) {
      setSnackbar({ open: true, message: 'Please fill in all required fields', severity: 'error' });
      return;
    }

    try {
      const url = editingItem ? `/api/pantry/${editingItem.id}` : '/api/pantry';
      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          quantity: parseFloat(formData.quantity),
          unit: formData.unit,
          category: formData.category,
          notes: formData.notes.trim() || null,
        }),
      });

      if (response.ok) {
        await loadPantry();
        handleCloseDialog();
        setSnackbar({
          open: true,
          message: editingItem ? 'Item updated successfully' : 'Item added successfully',
          severity: 'success',
        });
      } else {
        const error = await response.json();
        setSnackbar({ open: true, message: error.error || 'Failed to save item', severity: 'error' });
      }
    } catch (error) {
      console.error('Error saving item:', error);
      setSnackbar({ open: true, message: 'Failed to save item', severity: 'error' });
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const response = await fetch(`/api/pantry/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await loadPantry();
        setSnackbar({ open: true, message: 'Item deleted successfully', severity: 'success' });
      } else {
        const error = await response.json();
        setSnackbar({ open: true, message: error.error || 'Failed to delete item', severity: 'error' });
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      setSnackbar({ open: true, message: 'Failed to delete item', severity: 'error' });
    }
  };

  const filteredItems = items.filter(item =>
    categoryFilter === 'all' || item.category === categoryFilter
  );

  const groupedItems = filteredItems.reduce((acc, item) => {
    const category = item.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, PantryItem[]>);

  return (
    <Box sx={{ minHeight: '100vh', pb: 8, bgcolor: 'background.default' }}>
      {/* Spacer for fixed AppBar - Material Design pattern */}
      <Toolbar />

      <Container maxWidth="lg" sx={{ pt: 2 }}>
        {/* Note: Back button is now in the Navigation component */}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Kitchen sx={{ fontSize: 40, color: 'primary.main' }} />
            <Typography variant="h4" sx={{ fontWeight: 600, color: 'text.primary' }}>
              My Pantry
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            size="large"
          >
            Add Ingredient
          </Button>
        </Box>

        {/* Filter */}
        <Card sx={{ mb: 3, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FilterList />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Filter by Category"
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Chip label={`${filteredItems.length} items`} color="primary" />
          </Box>
        </Card>

        {/* Items by Category */}
        {loading ? (
          <Box>
            <LoadingWithProgress color="primary" inline />
            <Typography sx={{ textAlign: 'center', mt: 2 }}>Loading your pantry...</Typography>
          </Box>
        ) : filteredItems.length === 0 ? (
          <Card sx={{ p: 6, textAlign: 'center' }}>
            <Kitchen sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Your pantry is empty
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Start by adding ingredients you have at home
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>
              Add Your First Ingredient
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
                    <Typography variant="h6" sx={{ mb: 2, textTransform: 'capitalize', fontWeight: 600 }}>
                      {category}
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
                                secondary={`${item.quantity} ${item.unit}${item.notes ? ` • ${item.notes}` : ''}`}
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
                                  onClick={() => handleDelete(item.id)}
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
          <DialogTitle>{editingItem ? 'Edit Ingredient' : 'Add Ingredient'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label="Ingredient Name"
                fullWidth
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Quantity"
                  type="number"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  sx={{ flex: 1 }}
                />
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    value={formData.unit}
                    label="Unit"
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  >
                    {units.map((unit) => (
                      <MenuItem key={unit} value={unit}>
                        {unit}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  label="Category"
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Notes (optional)"
                fullWidth
                multiline
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained">
              {editingItem ? 'Update' : 'Add'}
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
      </Container>
    </Box>
  );
}
