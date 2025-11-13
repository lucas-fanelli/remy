'use client';
import React, { useState } from 'react';
import {
  Box,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowBack,
  ArrowForward,
  Restaurant,
  Check,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { CreateRecipeDTO, Ingredient, Instruction, DifficultyLevel } from '@/domain/types/recipe';
import ImageUpload from '@/components/common/ImageUpload';

const MotionBox = motion.create(Box);

interface CreateRecipeFormProps {
  onSubmit: (data: CreateRecipeDTO) => Promise<void>;
  onCancel: () => void;
}

const steps = ['Recipe Info', 'Ingredients', 'Instructions', 'Review'];

const cuisines = [
  'Italian', 'Mexican', 'Japanese', 'Chinese', 'Indian', 'French',
  'Thai', 'Mediterranean', 'American', 'Korean', 'Vietnamese', 'Other'
];

const commonUnits = [
  'cups', 'tbsp', 'tsp', 'g', 'kg', 'oz', 'lb',
  'ml', 'L', 'pieces', 'pinch', 'to taste', 'whole'
];

export default function CreateRecipeForm({ onSubmit, onCancel }: CreateRecipeFormProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [cookingTime, setCookingTime] = useState(30);
  const [prepTime, setPrepTime] = useState(15);
  const [servings, setServings] = useState(4);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [cuisine, setCuisine] = useState('Italian');
  const [caption, setCaption] = useState('');

  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', amount: '', unit: '' },
  ]);

  const [instructions, setInstructions] = useState<Instruction[]>([
    { step: 1, description: '', image: '' },
  ]);

  const canProceed = () => {
    switch (activeStep) {
      case 0: // Recipe Info
        return title.trim() !== '' &&
               description.trim() !== '' &&
               description.length <= 500 &&
               imageUrl.trim() !== '';
      case 1: // Ingredients
        return ingredients.some(i => i.name.trim() !== '') &&
               ingredients.filter(i => i.name.trim()).every(i => i.unit.trim() !== '');
      case 2: // Instructions
        return instructions.some(i => i.description.trim() !== '');
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceed()) {
      setActiveStep((prev) => prev + 1);
      setError('');
    } else {
      if (activeStep === 0) {
        setError('Please fill in all required fields: title, description (max 500 chars), and image URL');
      } else if (activeStep === 1) {
        setError('Please add at least one ingredient with a unit (e.g., cups, tbsp, g)');
      } else if (activeStep === 2) {
        setError('Please add at least one instruction step');
      }
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: '', unit: '' }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const addInstruction = () => {
    setInstructions([
      ...instructions,
      { step: instructions.length + 1, description: '', image: '' },
    ]);
  };

  const removeInstruction = (index: number) => {
    const updated = instructions
      .filter((_, i) => i !== index)
      .map((inst, i) => ({ ...inst, step: i + 1 }));
    setInstructions(updated);
  };

  const updateInstruction = (index: number, field: keyof Instruction, value: string | number) => {
    const updated = [...instructions];
    updated[index] = { ...updated[index], [field]: value };
    setInstructions(updated);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const data: CreateRecipeDTO = {
        title,
        description,
        imageUrl,
        cookingTime,
        prepTime,
        servings,
        difficulty,
        cuisine,
        caption,
        ingredients: ingredients.filter(i => i.name.trim()),
        instructions: instructions.filter(i => i.description.trim()),
        userId: '', // Will be set by the API from session
      };

      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create recipe');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <MotionBox
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Recipe Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g., Grandma's Chocolate Chip Cookies"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="What makes this recipe special?"
                  helperText={`${description.length}/500 characters`}
                  error={description.length > 500}
                  inputProps={{ maxLength: 500 }}
                />
              </Grid>

              <Grid item xs={12}>
                <ImageUpload
                  value={imageUrl}
                  onChange={setImageUrl}
                  label="Recipe Image"
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Cuisine</InputLabel>
                  <Select value={cuisine} onChange={(e) => setCuisine(e.target.value)} label="Cuisine">
                    {cuisines.map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Difficulty</InputLabel>
                  <Select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                    label="Difficulty"
                  >
                    <MenuItem value="easy">Easy</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="hard">Hard</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Prep Time (min)"
                  value={prepTime}
                  onChange={(e) => setPrepTime(Number(e.target.value))}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Cooking Time (min)"
                  value={cookingTime}
                  onChange={(e) => setCookingTime(Number(e.target.value))}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Servings"
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Caption (Optional)"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Share your thoughts about this recipe..."
                />
              </Grid>
            </Grid>
          </MotionBox>
        );

      case 1:
        return (
          <MotionBox
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Ingredients
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Add all ingredients with amounts and units (e.g., "2 cups flour", "1 tsp salt")
              </Typography>
              <Alert severity="info" sx={{ mt: 1 }}>
                💡 Tip: Make sure to select a unit for each ingredient to avoid validation errors
              </Alert>
            </Box>

            {ingredients.map((ingredient, index) => (
              <Card key={index} sx={{ mb: 2, p: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={5}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Ingredient"
                      value={ingredient.name}
                      onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                      placeholder="e.g., All-purpose flour"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Amount"
                      value={ingredient.amount}
                      onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                      placeholder="2"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <FormControl fullWidth size="small" error={!ingredient.unit && ingredient.name !== ''}>
                      <InputLabel>Unit *</InputLabel>
                      <Select
                        value={ingredient.unit}
                        onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                        label="Unit *"
                      >
                        {commonUnits.map((unit) => (
                          <MenuItem key={unit} value={unit}>{unit}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={1}>
                    <IconButton
                      color="error"
                      onClick={() => removeIngredient(index)}
                      disabled={ingredients.length === 1}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </Card>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={addIngredient}
              variant="outlined"
              fullWidth
              sx={{ mt: 2 }}
            >
              Add Ingredient
            </Button>
          </MotionBox>
        );

      case 2:
        return (
          <MotionBox
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Cooking Instructions
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Break down the cooking process into clear steps
              </Typography>
            </Box>

            {instructions.map((instruction, index) => (
              <Card key={index} sx={{ mb: 2, p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Chip label={`Step ${instruction.step}`} color="primary" />
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label={`Step ${instruction.step}`}
                      value={instruction.description}
                      onChange={(e) => updateInstruction(index, 'description', e.target.value)}
                      placeholder="Describe this step in detail..."
                    />
                  </Box>
                  <IconButton
                    color="error"
                    onClick={() => removeInstruction(index)}
                    disabled={instructions.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Card>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={addInstruction}
              variant="outlined"
              fullWidth
              sx={{ mt: 2 }}
            >
              Add Step
            </Button>
          </MotionBox>
        );

      case 3:
        return (
          <MotionBox
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Typography variant="h6" gutterBottom>
              Review Your Recipe
            </Typography>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h5" gutterBottom>{title}</Typography>
                <Typography color="text.secondary" paragraph>{description}</Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip label={cuisine} size="small" />
                  <Chip label={difficulty} size="small" color="primary" />
                  <Chip label={`${prepTime + cookingTime} min total`} size="small" />
                  <Chip label={`${servings} servings`} size="small" />
                </Box>

                <Typography variant="subtitle2" gutterBottom>
                  Ingredients ({ingredients.filter(i => i.name).length})
                </Typography>
                <Box sx={{ mb: 2 }}>
                  {ingredients.filter(i => i.name).map((ing, i) => (
                    <Typography key={i} variant="body2">
                      • {ing.amount} {ing.unit} {ing.name}
                    </Typography>
                  ))}
                </Box>

                <Typography variant="subtitle2" gutterBottom>
                  Instructions ({instructions.filter(i => i.description).length} steps)
                </Typography>
                <Box>
                  {instructions.filter(i => i.description).map((inst, i) => (
                    <Typography key={i} variant="body2" paragraph>
                      {inst.step}. {inst.description}
                    </Typography>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </MotionBox>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <AnimatePresence mode="wait">
        {renderStepContent()}
      </AnimatePresence>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={activeStep === 0 ? onCancel : handleBack}
          disabled={loading}
        >
          {activeStep === 0 ? 'Cancel' : 'Back'}
        </Button>

        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            endIcon={<ArrowForward />}
            onClick={handleNext}
            disabled={loading}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<Check />}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Recipe'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
